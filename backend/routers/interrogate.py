"""
WebSocket endpoint for real-time voice interrogation.

Browser  ─── webm audio chunks ───►  Backend  ─── PCM audio ───►  Gemini Live
Browser  ◄── JSON text + audio  ────  Backend  ◄── audio/text ──  Gemini Live
"""

import asyncio
import base64
import json
import logging
import os
import re
import traceback
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from google import genai
from google.genai import types

from middleware.rate_limit import ws_text_limiter, ws_voice_limiter

logger = logging.getLogger(__name__)

# Suppress SDK warning about non-data parts in Live API responses
try:
    import google.genai.types as _gtypes
    _gtypes._live_server_data_warning_logged = True
except (AttributeError, ImportError):
    pass

router = APIRouter()

LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025"
SEND_SAMPLE_RATE = 16000
RECV_SAMPLE_RATE = 24000
MAX_HISTORY_TURNS = 40  # keep last 40 messages (~20 back-and-forth exchanges)

# Audio safety limits
MAX_AUDIO_CHUNK_BYTES = 1 * 1024 * 1024   # 1 MB per chunk
MAX_AUDIO_BUFFER_BYTES = 10 * 1024 * 1024  # 10 MB total per turn

_INJECTION_PATTERNS = [
    "ignore previous instructions",
    "ignore all previous",
    "disregard your instructions",
    "forget everything",
    "new instructions:",
    "system prompt",
    "you are now",
]


def _sanitize_user_input(text: str) -> str:
    """Truncate and block obvious prompt-injection attempts."""
    text = text[:1000]  # hard length cap
    lower = text.lower()
    for pattern in _INJECTION_PATTERNS:
        if pattern in lower:
            logger.warning("Prompt injection attempt blocked: %.100s", text)
            return "[input blocked]"
    return text

# Module-level singleton — avoids creating a new client per request
_genai_client: genai.Client | None = None


def _get_genai_client() -> genai.Client:
    global _genai_client
    if _genai_client is None:
        _genai_client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
    return _genai_client

WITNESS_CONFIG = {
    "meena": {"prompt": "meena_prompt.txt", "voice": "Kore"},
    "arjun": {"prompt": "arjun_prompt.txt", "voice": "Puck"},
    "rajan": {"prompt": "rajan_prompt.txt", "voice": "Charon"},
}

PROMPTS_DIR = Path(__file__).resolve().parent.parent.parent / "agents" / "prompts"


def _load_prompt(witness_id: str) -> str:
    cfg = WITNESS_CONFIG.get(witness_id)
    if not cfg:
        raise ValueError(f"Unknown witness: {witness_id}")
    path = PROMPTS_DIR / cfg["prompt"]
    if not path.exists():
        raise FileNotFoundError(f"Prompt not found: {path}")
    return path.read_text(encoding="utf-8")


@router.websocket("/interrogate/{session_id}/{witness_id}")
async def interrogate(websocket: WebSocket, session_id: str, witness_id: str):
    await websocket.accept()

    # Validate session_id is a well-formed UUID to prevent injection
    if not re.fullmatch(
        r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
        session_id,
        re.IGNORECASE,
    ):
        await websocket.send_json({"type": "error", "text": "Invalid session"})
        await websocket.close()
        return

    if witness_id not in WITNESS_CONFIG:
        await websocket.send_json({"type": "error", "text": f"Unknown witness: {witness_id}"})
        await websocket.close()
        return

    try:
        system_prompt = _load_prompt(witness_id)
        voice_name = WITNESS_CONFIG[witness_id]["voice"]
    except Exception as e:
        await websocket.send_json({"type": "error", "text": str(e)})
        await websocket.close()
        return

    client = _get_genai_client()

    # Conversation history for text-based exchanges
    conversation_history = []

    # Tell the browser we're connected
    await websocket.send_json({"type": "connected", "witness": witness_id})

    # Active Live session (created per voice turn)
    live_session = None
    live_session_cm = None
    live_tasks = []
    ws_lock = asyncio.Lock()  # Protect concurrent WebSocket writes

    async def _handle_voice_turn(audio_chunks_list: list[bytes], history: list):
        """Handle a voice turn: transcribe user audio, send text to Live API, get voice response."""
        nonlocal live_session, live_session_cm
        cm = None
        try:
            # Step 1: Transcribe the user's recorded audio
            print(f"[{witness_id}] Transcribing user voice ({len(audio_chunks_list)} chunks)...")
            user_pcm = b"".join(audio_chunks_list)
            # User audio is 16kHz PCM from the mic
            wav_data = _pcm_to_wav(user_pcm, sample_rate=SEND_SAMPLE_RATE, channels=1, bits_per_sample=16)
            user_text = await _transcribe_audio_from_wav(wav_data)
            if not user_text:
                print(f"[{witness_id}] Could not transcribe user audio")
                async with ws_lock:
                    await websocket.send_json({
                        "type": "turn_complete",
                        "text": "[could not understand audio - please try again]",
                        "witness": witness_id,
                    })
                return
            print(f"[{witness_id}] User said: {user_text[:80]}")

            # Send user transcript to browser
            async with ws_lock:
                await websocket.send_json({
                    "type": "user_transcript",
                    "text": user_text,
                })

            # Add to conversation history (history is the copy sent to Live, conversation_history is persistent)
            history.append(types.Content(role="user", parts=[types.Part(text=user_text)]))
            conversation_history.append(types.Content(role="user", parts=[types.Part(text=user_text)]))
            if len(conversation_history) > MAX_HISTORY_TURNS:
                conversation_history[:] = conversation_history[-MAX_HISTORY_TURNS:]
            print(f"[{witness_id}] History now has {len(conversation_history)} turns")

            # Step 2: Create Live session for voice response
            config = types.LiveConnectConfig(
                response_modalities=["AUDIO"],
                system_instruction=system_prompt,
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name=voice_name
                        )
                    )
                ),
            )
            print(f"[{witness_id}] Creating Live session for text-to-voice response...")
            cm = client.aio.live.connect(model=LIVE_MODEL, config=config)
            session = await cm.__aenter__()
            live_session = session
            live_session_cm = cm
            print(f"[{witness_id}] Live voice session ready")

            # Start receiving Gemini's audio response
            recv_task = asyncio.create_task(
                _gemini_to_browser(websocket, session, witness_id, session_id, ws_lock)
            )
            live_tasks.append(recv_task)

            # Inject full conversation history as text, then mark turn complete
            # This triggers the model to respond with audio
            await session.send_client_content(
                turns=history, turn_complete=True
            )
            print(f"[{witness_id}] Sent {len(history)} turns via send_client_content (last: '{user_text[:50]}')")

            # Wait for audio response (returns bool + audio chunks)
            got_audio, response_audio_chunks = await recv_task

            if got_audio and response_audio_chunks:
                # Transcribe model's voice response and add to conversation history
                print(f"[{witness_id}] Transcribing model response ({len(response_audio_chunks)} chunks)...")
                resp_wav = _pcm_to_wav(b"".join(response_audio_chunks), sample_rate=RECV_SAMPLE_RATE, channels=1, bits_per_sample=16)
                reply_text = await _transcribe_audio_from_wav(resp_wav)
                print(f"[{witness_id}] Model said: {reply_text[:80] if reply_text else '(empty)'}")
                if reply_text:
                    conversation_history.append(types.Content(role="model", parts=[types.Part(text=reply_text)]))
                    if len(conversation_history) > MAX_HISTORY_TURNS:
                        conversation_history[:] = conversation_history[-MAX_HISTORY_TURNS:]
                    _save_statement(session_id, witness_id, reply_text)
                async with ws_lock:
                    await websocket.send_json({
                        "type": "turn_complete",
                        "text": reply_text or "[voice response]",
                        "witness": witness_id,
                    })
            else:
                print(f"[{witness_id}] No audio response from text-to-voice, sending text fallback")
                # Fallback: use text API for response
                response = await client.aio.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=history,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                    ),
                )
                reply_text = response.text.strip() if response.text else "[no response]"
                conversation_history.append(types.Content(role="model", parts=[types.Part(text=reply_text)]))
                if len(conversation_history) > MAX_HISTORY_TURNS:
                    conversation_history[:] = conversation_history[-MAX_HISTORY_TURNS:]
                _save_statement(session_id, witness_id, reply_text)
                async with ws_lock:
                    await websocket.send_json({
                        "type": "turn_complete",
                        "text": reply_text,
                        "witness": witness_id,
                    })

        except asyncio.CancelledError:
            raise
        except Exception as e:
            print(f"[{witness_id}] Voice turn error: {e}")
            traceback.print_exc()
            try:
                async with ws_lock:
                    await websocket.send_json({"type": "error", "text": f"Voice failed: {e}"})
            except Exception:
                pass
        finally:
            if cm:
                try:
                    await cm.__aexit__(None, None, None)
                except Exception:
                    pass
            live_session = None
            live_session_cm = None

    voice_turn_task = None
    voice_audio_buffer = []  # Collect audio chunks for current voice turn
    total_audio_bytes = 0
    is_recording = False

    try:
        while True:
            message = await websocket.receive()

            if message.get("type") == "websocket.disconnect":
                break

            # Text questions — use standard Gemini API (fast, reliable)
            if "text" in message and message["text"]:
                try:
                    data = json.loads(message["text"])
                    if data.get("type") == "text":
                        user_text = _sanitize_user_input(data.get("text", ""))
                        if not user_text:
                            continue
                        print(f"[{witness_id}] Text question: {user_text}")

                        # Rate limit text questions
                        try:
                            ws_text_limiter.check(f"{session_id}:{witness_id}")
                        except Exception as e:
                            async with ws_lock:
                                await websocket.send_json({"type": "error", "text": "Too many questions. Please slow down."})
                            continue

                        # Build conversation for context
                        conversation_history.append(
                            types.Content(role="user", parts=[types.Part(text=user_text)])
                        )

                        # Call standard Gemini API
                        response = await client.aio.models.generate_content(
                            model="gemini-2.5-flash",
                            contents=conversation_history,
                            config=types.GenerateContentConfig(
                                system_instruction=system_prompt,
                            ),
                        )
                        reply_text = response.text.strip() if response.text else "[no response]"
                        print(f"[{witness_id}] Reply: {reply_text[:80]}")

                        # Save to history
                        conversation_history.append(
                            types.Content(role="model", parts=[types.Part(text=reply_text)])
                        )
                        if len(conversation_history) > MAX_HISTORY_TURNS:
                            conversation_history[:] = conversation_history[-MAX_HISTORY_TURNS:]

                        # Save as statement
                        _save_statement(session_id, witness_id, reply_text)

                        # Send to browser
                        async with ws_lock:
                            await websocket.send_json({
                                "type": "turn_complete",
                                "text": reply_text,
                                "witness": witness_id,
                            })

                    elif data.get("type") == "end_turn":
                        print(f"[{witness_id}] End of voice turn ({len(voice_audio_buffer)} chunks buffered)")
                        is_recording = False
                        if voice_audio_buffer:
                            # Rate limit voice turns
                            try:
                                ws_voice_limiter.check(f"{session_id}:{witness_id}")
                            except Exception:
                                async with ws_lock:
                                    await websocket.send_json({"type": "error", "text": "Too many voice turns. Please wait."})
                                voice_audio_buffer.clear()
                                total_audio_bytes = 0
                                continue
                            # Dispatch collected audio as a complete turn
                            chunks = list(voice_audio_buffer)
                            voice_audio_buffer.clear()
                            total_audio_bytes = 0
                            # Wait for previous turn to finish
                            if voice_turn_task and not voice_turn_task.done():
                                print(f"[{witness_id}] Waiting for previous voice turn...")
                                await voice_turn_task
                            voice_turn_task = asyncio.create_task(_handle_voice_turn(chunks, list(conversation_history)))

                    elif data.get("type") == "audio":
                        # Base64-encoded audio from browser
                        audio_bytes = base64.b64decode(data["data"])
                        voice_audio_buffer.append(audio_bytes)
                except (json.JSONDecodeError, KeyError) as e:
                    print(f"[{witness_id}] JSON parse error: {e}")

            # Binary data = raw PCM audio from browser mic → buffer it
            elif "bytes" in message and message["bytes"]:
                chunk = message["bytes"]
                if len(chunk) > MAX_AUDIO_CHUNK_BYTES:
                    async with ws_lock:
                        await websocket.send_json({"type": "error", "text": "Audio chunk too large."})
                    continue
                if total_audio_bytes + len(chunk) > MAX_AUDIO_BUFFER_BYTES:
                    async with ws_lock:
                        await websocket.send_json({"type": "error", "text": "Audio buffer full. Click 'End Turn' to send."})
                    continue
                is_recording = True
                voice_audio_buffer.append(chunk)
                total_audio_bytes += len(chunk)

    except WebSocketDisconnect:
        print(f"[{witness_id}] Browser disconnected")
    except Exception as e:
        logger.error("WebSocket error for %s/%s", session_id, witness_id, exc_info=True)
        try:
            await websocket.send_json({"type": "error", "text": "An error occurred. Please try again."})
        except Exception:
            pass
    finally:
        if voice_turn_task and not voice_turn_task.done():
            voice_turn_task.cancel()
        for t in live_tasks:
            t.cancel()
        try:
            await websocket.close()
        except Exception:
            pass


async def _gemini_to_browser(websocket: WebSocket, session, witness_id: str, session_id: str, ws_lock: asyncio.Lock) -> tuple[bool, list[bytes]]:
    """Receive audio from Gemini Live and forward to browser. Returns (got_audio, audio_chunks)."""
    audio_chunks = []
    chunk_count = 0

    try:
        async for response in session.receive():
            sc = response.server_content

            # Log non-audio content (text, thoughts)
            if sc and sc.model_turn and sc.model_turn.parts:
                for part in sc.model_turn.parts:
                    if part.text:
                        print(f"[{witness_id}] Model text: {part.text[:100]}")
                    if part.thought:
                        print(f"[{witness_id}] Model thought")

            audio_data = response.data

            if audio_data:
                chunk_count += 1
                audio_chunks.append(audio_data)
                async with ws_lock:
                    await websocket.send_bytes(audio_data)
                if chunk_count % 50 == 1:
                    print(f"[{witness_id}] Audio chunk #{chunk_count}: {len(audio_data)}B")

            if sc and sc.turn_complete:
                total_bytes = sum(len(c) for c in audio_chunks)
                print(f"[{witness_id}] Turn complete! {chunk_count} chunks ({total_bytes} bytes)")
                if audio_chunks:
                    return True, list(audio_chunks)
                else:
                    print(f"[{witness_id}] Empty turn_complete (model thought only, no audio)")
                    return False, []
    except asyncio.CancelledError:
        print(f"[{witness_id}] Gemini recv loop cancelled")
    except Exception as e:
        print(f"[{witness_id}] Gemini recv loop ended: {e}")
        traceback.print_exc()

    return bool(audio_chunks), list(audio_chunks)

async def _transcribe_audio_from_wav(wav_data: bytes) -> str:
    """Use Gemini Flash to transcribe WAV audio."""
    try:
        if len(wav_data) < 100:
            return ""
        client = _get_genai_client()
        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Content(
                    role="user",
                    parts=[
                        types.Part(
                            inline_data=types.Blob(
                                data=wav_data,
                                mime_type="audio/wav",
                            )
                        ),
                        types.Part(text="Transcribe this audio exactly. Return only the spoken words, nothing else."),
                    ],
                )
            ],
        )
        return response.text.strip() if response.text else ""
    except Exception as e:
        print(f"[transcribe] Failed: {e}")
        return ""


def _pcm_to_wav(pcm_data: bytes, sample_rate: int = 24000, channels: int = 1, bits_per_sample: int = 16) -> bytes:
    """Wrap raw PCM bytes in a WAV header."""
    import struct
    data_size = len(pcm_data)
    byte_rate = sample_rate * channels * bits_per_sample // 8
    block_align = channels * bits_per_sample // 8

    header = struct.pack(
        '<4sI4s4sIHHIIHH4sI',
        b'RIFF',
        36 + data_size,
        b'WAVE',
        b'fmt ',
        16,  # chunk size
        1,   # PCM format
        channels,
        sample_rate,
        byte_rate,
        block_align,
        bits_per_sample,
        b'data',
        data_size,
    )
    return header + pcm_data


def _save_statement(session_id: str, witness_id: str, text: str):
    """Save witness statement to our store and trigger contradiction check."""
    try:
        from services.firestore import db
        import uuid

        statement_id = str(uuid.uuid4())
        ref = db.collection("sessions").document(session_id).collection("statements").document(statement_id)
        ref.set({
            "statement_id": statement_id,
            "session_id": session_id,
            "witness_id": witness_id,
            "text": text,
            "topic": _classify_topic(text),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        print(f"[{witness_id}] Saved: {text[:60]}...")

        # Trigger contradiction check asynchronously (fire-and-forget)
        asyncio.create_task(_run_contradiction_check(session_id))
    except Exception as e:
        print(f"[{witness_id}] Failed to save statement: {e}")


async def _run_contradiction_check(session_id: str):
    """Background task to check for contradictions after a new statement."""
    try:
        from services.contradiction import check_contradictions
        found = await check_contradictions(session_id)
        if found:
            print(f"[contradiction] Detected {len(found)} new contradiction(s) in session {session_id}")
    except Exception as e:
        print(f"[contradiction] Check failed: {e}")


def _classify_topic(text: str) -> str:
    text_lower = text.lower()
    if any(w in text_lower for w in ["left", "arrived", "when", "time", "pm", "am", "midnight"]):
        return "timeline"
    if any(w in text_lower for w in ["floor", "lab", "room", "office", "elevator", "stairs"]):
        return "location"
    if any(w in text_lower for w in ["saw", "heard", "meena", "arjun", "rajan", "shalini", "dr."]):
        return "other_witness"
    if any(w in text_lower for w in ["patent", "dispute", "money", "equipment", "steal"]):
        return "motive"
    if any(w in text_lower for w in ["door", "key", "access", "card", "enter", "unlock"]):
        return "access"
    return "general"
