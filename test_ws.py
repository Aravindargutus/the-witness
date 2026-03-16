"""Test the WebSocket interrogation endpoint."""
import asyncio
import websockets
import json

async def test():
    url = "ws://localhost:8080/ws/interrogate/TEST123/meena"
    print(f"Connecting to {url}...")
    try:
        async with websockets.connect(url) as ws:
            msg = await asyncio.wait_for(ws.recv(), timeout=15)
            data = json.loads(msg)
            print(f"Got: {data}")
            if data.get("type") == "connected":
                print("SUCCESS! WebSocket endpoint works!")
            elif data.get("type") == "error":
                print(f"Server error: {data['text']}")
            await ws.close()
    except Exception as e:
        print(f"FAILED: {type(e).__name__}: {e}")

asyncio.run(test())
