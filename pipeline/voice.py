"""ElevenLabs TTS per shot, with an offline silent fallback for tests."""
from __future__ import annotations
import os, subprocess, requests

def tts(text: str, cfg, out_path: str) -> str:
    cfg.require("eleven_key","eleven_voice")
    r = requests.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{cfg.eleven_voice}",
        headers={"xi-api-key": cfg.eleven_key, "accept":"audio/mpeg",
                 "content-type":"application/json"},
        json={"text": text, "model_id": cfg.eleven_model,
              "voice_settings":{"stability":0.5,"similarity_boost":0.8}},
        timeout=120)
    r.raise_for_status()
    open(out_path,"wb").write(r.content)
    return out_path

def silent(seconds: float, out_path: str) -> str:
    subprocess.run(["ffmpeg","-y","-f","lavfi","-i",
                    f"anullsrc=cl=stereo:r=44100","-t",f"{seconds:.2f}",out_path],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    return out_path
