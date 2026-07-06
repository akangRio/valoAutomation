import asyncio
import json
import os
import argparse
import sys

async def generate_tts(text, audio_path, json_path, voice="en-US-GuyNeural"):
    import edge_tts
    communicate = edge_tts.Communicate(text, voice, boundary="WordBoundary")
    
    timestamps = []
    # Ensure parent directories exist
    os.makedirs(os.path.dirname(audio_path), exist_ok=True)
    os.makedirs(os.path.dirname(json_path), exist_ok=True)
    
    with open(audio_path, "wb") as fp:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                fp.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                # convert ticks (100-ns) to milliseconds
                start_ms = chunk["offset"] / 10000.0
                duration_ms = chunk["duration"] / 10000.0
                end_ms = start_ms + duration_ms
                
                timestamps.append({
                    "word": chunk["text"],
                    "startMs": round(start_ms, 2),
                    "endMs": round(end_ms, 2)
                })
                
    with open(json_path, "w", encoding="utf-8") as jf:
        json.dump(timestamps, jf, indent=2)

def generate_mock_tts(text, audio_path, json_path):
    # Ensure parent directories exist
    os.makedirs(os.path.dirname(audio_path), exist_ok=True)
    os.makedirs(os.path.dirname(json_path), exist_ok=True)
    
    # Just write some dummy MP3 bytes
    with open(audio_path, "wb") as f:
        f.write(b'\xff\xfb\x90\x44\x00\x00\x00\x03\x48\x00\x00\x00\x00' * 100)
        
    # Generate mock timestamps based on 300ms per word
    words = text.split()
    timestamps = []
    current_time_ms = 100.0
    for word in words:
        duration = len(word) * 40.0 + 100.0 # dynamic word-length based duration
        end_time_ms = current_time_ms + duration
        
        timestamps.append({
            "word": word,
            "startMs": round(current_time_ms, 2),
            "endMs": round(end_time_ms, 2)
        })
        current_time_ms = end_time_ms + 50.0 # 50ms interval pause
        
    with open(json_path, "w", encoding="utf-8") as jf:
        json.dump(timestamps, jf, indent=2)

def main():
    parser = argparse.ArgumentParser(description="Edge TTS Generator and Boundary Aligner")
    parser.add_argument("--text", required=True, help="Text script to synthesize")
    parser.add_argument("--audio", required=True, help="Output MP3 file path")
    parser.add_argument("--json", required=True, help="Output timestamps JSON path")
    parser.add_argument("--voice", default="en-US-GuyNeural", help="Voice model")
    parser.add_argument("--mock", action="store_true", help="Run in mock mode without network calls")
    
    args = parser.parse_args()
    
    if args.mock:
        generate_mock_tts(args.text, args.audio, args.json)
        print(json.dumps({"status": "success", "audio_path": args.audio, "json_path": args.json, "mocked": True}))
        return
        
    try:
        asyncio.run(generate_tts(args.text, args.audio, args.json, args.voice))
        print(json.dumps({"status": "success", "audio_path": args.audio, "json_path": args.json, "mocked": False}))
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
