"""
base_witness.py
Shared base class for all witness agents.
Each witness loads its prompt, connects to Gemini Live API,
streams mic audio in, plays audio back out, and saves
every spoken claim to Firestore.
"""

import asyncio
import os
from pathlib import Path
from google import genai
from google.genai import types
from google.cloud import firestore
import pyaudio

# ── Audio constants (do not change — Live API requires these) ──────────────
FORMAT           = pyaudio.paInt16
CHANNELS         = 1
SEND_SAMPLE_RATE = 16000   # mic input
RECV_SAMPLE_RATE = 24000   # speaker output
CHUNK_SIZE       = 1024

# ── Model ──────────────────────────────────────────────────────────────────
LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025"


class WitnessAgent:
    """
    Base class for a witness agent.
    Subclass this and set:
        self.witness_id  = "meena" | "arjun" | "rajan"
        self.prompt_file = path to the .txt system prompt
        self.voice       = one of "Puck","Charon","Kore","Fenrir","Aoede","Leda","Orus","Zephyr"
    """

    witness_id:  str = "witness"
    prompt_file: str = ""
    voice:       str = "Kore"

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.client     = genai.Client()
        self.db         = firestore.Client()
        self.pya        = pyaudio.PyAudio()

        # Load the system prompt from file
        prompt_path = Path(self.prompt_file)
        if not prompt_path.exists():
            raise FileNotFoundError(f"Prompt file not found: {self.prompt_file}")
        self.system_prompt = prompt_path.read_text(encoding="utf-8")

        # Queues for thread-safe audio passing
        self._mic_queue    = asyncio.Queue(maxsize=10)
        self._output_queue = asyncio.Queue()

    # ── Firestore helpers ──────────────────────────────────────────────────

    def _save_statement(self, text: str):
        """Write a witnessed statement to Firestore."""
        ref = (
            self.db
            .collection("sessions")
            .document(self.session_id)
            .collection("statements")
            .document()
        )
        ref.set({
            "witness":    self.witness_id,
            "text":       text,
            "topic":      self._classify_topic(text),
            "created_at": firestore.SERVER_TIMESTAMP,
        })
        print(f"[Firestore] Saved statement from {self.witness_id}: {text[:60]}...")

    def _classify_topic(self, text: str) -> str:
        """
        Quick keyword classification so the contradiction engine
        can group statements by topic.
        """
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

    # ── Audio I/O ──────────────────────────────────────────────────────────

    async def _listen_mic(self):
        """Continuously read from microphone and push chunks to queue."""
        mic_stream = await asyncio.to_thread(
            self.pya.open,
            format=FORMAT,
            channels=CHANNELS,
            rate=SEND_SAMPLE_RATE,
            input=True,
            frames_per_buffer=CHUNK_SIZE,
        )
        try:
            while True:
                data = await asyncio.to_thread(
                    mic_stream.read, CHUNK_SIZE, False
                )
                await self._mic_queue.put(data)
        finally:
            mic_stream.close()

    async def _play_audio(self):
        """Drain output queue and play through speaker."""
        speaker_stream = await asyncio.to_thread(
            self.pya.open,
            format=FORMAT,
            channels=CHANNELS,
            rate=RECV_SAMPLE_RATE,
            output=True,
        )
        try:
            while True:
                chunk = await self._output_queue.get()
                if chunk is None:
                    break
                await asyncio.to_thread(speaker_stream.write, chunk)
        finally:
            speaker_stream.close()

    async def _send_audio(self, session):
        """Pull mic chunks from queue and stream them to Gemini Live."""
        while True:
            chunk = await self._mic_queue.get()
            await session.send_realtime_input(
                audio=types.Blob(
                    data=chunk,
                    mime_type=f"audio/pcm;rate={SEND_SAMPLE_RATE}"
                )
            )

    async def _receive_audio(self, session):
        """
        Receive responses from Gemini Live.
        - Audio chunks go to the output queue for playback.
        - Text transcripts (if any) get saved to Firestore.
        """
        transcript_buffer = []

        async for response in session.receive():
            # Audio output — play it
            if response.data:
                await self._output_queue.put(response.data)

            # Text transcript — save to Firestore
            if response.text:
                transcript_buffer.append(response.text)

            # Turn complete — flush transcript buffer to Firestore
            if response.server_content and response.server_content.turn_complete:
                if transcript_buffer:
                    full_text = " ".join(transcript_buffer).strip()
                    if full_text:
                        self._save_statement(full_text)
                    transcript_buffer = []

    # ── Main entry point ───────────────────────────────────────────────────

    async def run(self):
        """
        Start the witness session.
        Opens a Gemini Live connection with the witness system prompt,
        then runs mic input, audio output, and Firestore saving concurrently.
        """
        config = types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            system_instruction=self.system_prompt,
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name=self.voice
                    )
                )
            ),
        )

        print(f"\n[{self.witness_id.upper()}] Connecting to Gemini Live...")
        print("Use headphones to avoid echo. Press Ctrl+C to end session.\n")

        async with self.client.aio.live.connect(
            model=LIVE_MODEL,
            config=config
        ) as session:
            print(f"[{self.witness_id.upper()}] Connected. You may begin the interrogation.\n")

            await asyncio.gather(
                self._listen_mic(),
                self._send_audio(session),
                self._receive_audio(session),
                self._play_audio(),
            )
