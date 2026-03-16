"""Quick test of Gemini Live API connection."""
import os, asyncio
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / '.env')

print('API Key present:', bool(os.getenv('GOOGLE_API_KEY')))
print('API Key prefix:', os.getenv('GOOGLE_API_KEY', '')[:12] + '...')

from google import genai
from google.genai import types

async def test():
    client = genai.Client(api_key=os.getenv('GOOGLE_API_KEY'))
    config = types.LiveConnectConfig(
        response_modalities=['AUDIO'],
        system_instruction='You are a test. Say hello briefly.',
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name='Kore')
            )
        ),
    )
    print('Connecting to Gemini Live...')
    try:
        async with client.aio.live.connect(
            model='gemini-2.5-flash-native-audio-preview-12-2025', config=config
        ) as session:
            print('SUCCESS: Connected to Gemini Live!')
            # Send a text message to trigger a response
            await session.send_client_content(
                turns=types.Content(role='user', parts=[types.Part(text='Say hello in one word.')])
            )
            print('Sent message, waiting for response...')
            async for response in session.receive():
                if response.data:
                    print(f'Got audio: {len(response.data)} bytes')
                if response.text:
                    print(f'Got text: {response.text}')
                if response.server_content and response.server_content.turn_complete:
                    print('Turn complete!')
                    break
        print('DONE - Gemini Live works!')
    except Exception as e:
        print(f'FAILED: {type(e).__name__}: {e}')

asyncio.run(test())
