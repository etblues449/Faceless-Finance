#!/usr/bin/env python3
"""
Faceless Finance — fully automated UK Chartered-Accountant finance video pipeline.

Flow (one run = one video):
  pick topic -> Claude writes a CA script + caption -> ElevenLabs speaks it in your
  cloned voice -> Hedra animates your presenter still to the audio (lip-sync) ->
  download the mp4 -> (optional) host it + post to TikTok via Blotato.

Schedule it with cron for hands-off autopilot. Uses your existing Hedra credits.

Usage:
  python3 faceless_finance.py              # run the full pipeline once
  python3 faceless_finance.py --dry-run    # topic + script only (no media, no spend)
  python3 faceless_finance.py --credits    # show your Hedra credit balance
  python3 faceless_finance.py --selftest   # offline checks (no keys/network needed)

Configuration: see faceless_finance.env.example -> copy to .env (same folder).
"""

import os
import sys
import json
import time
import argparse
import datetime
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
STATE_FILE = HERE / "state.json"
OUT_DIR = HERE / "out"

HEDRA_BASE = "https://api.hedra.com/web-app/public"
HEDRA_AVATAR_MODEL = "26f0fc66-152b-40ab-abed-76c43df99bc8"  # Hedra Avatar (talking-head, lip-sync)

# Rotating UK personal-finance topics. Add your own freely.
TOPICS = [
    {"topic": "The £100k personal allowance taper",
     "angle": "the 60% effective tax trap between £100k and £125,140 and how a pension contribution claws it back"},
    {"topic": "ISA vs SIPP",
     "angle": "where £20k goes furthest for a UK higher-rate taxpayer"},
    {"topic": "Stamp duty bands in 2026",
     "angle": "what you actually pay at each threshold"},
    {"topic": "The dividend allowance cut",
     "angle": "what changed and one legal way to structure around it"},
    {"topic": "Salary sacrifice",
     "angle": "the legitimate move HMRC is completely fine with"},
    {"topic": "Emergency fund sizing",
     "angle": "the CA rule of thumb most people get wrong"},
]


# --------------------------------------------------------------------------- #
# small utilities
# --------------------------------------------------------------------------- #
def log(msg):
    print(f"[{datetime.datetime.now():%Y-%m-%d %H:%M:%S}] {msg}", flush=True)


def load_dotenv():
    """Minimal .env loader (no external dependency)."""
    envpath = HERE / ".env"
    if envpath.exists():
        for line in envpath.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def load_state():
    try:
        return json.loads(STATE_FILE.read_text())
    except Exception:
        return {}


def save_state(s):
    STATE_FILE.write_text(json.dumps(s, indent=2))


def pick_topic(state=None):
    """Date-based rotation so it works even on fresh/stateless runners (GitHub
    Actions). Wed/Fri/Sun land on different topics; all topics cycle over ~2 weeks."""
    idx = datetime.date.today().toordinal() % len(TOPICS)
    return TOPICS[idx]


def _parse_claude_json(txt):
    """Extract {script, caption} from Claude's reply. Tolerant of stray markdown."""
    txt = txt.replace("```json", "").replace("```", "").strip()
    data = json.loads(txt)
    script = (data.get("script") or "").strip()
    caption = (data.get("caption") or "").strip()
    if not script:
        raise ValueError("Claude returned no 'script' field")
    return script, caption


# --------------------------------------------------------------------------- #
# config
# --------------------------------------------------------------------------- #
class Cfg:
    def __init__(self):
        g = os.environ.get
        self.anthropic_key = g("ANTHROPIC_API_KEY", "")
        self.anthropic_model = g("ANTHROPIC_MODEL", "claude-sonnet-4-6")
        self.eleven_key = g("ELEVENLABS_API_KEY", "")
        self.eleven_voice = g("ELEVENLABS_VOICE_ID", "Ddap889CVJzcRLn7e4nG")
        self.hedra_key = g("HEDRA_API_KEY", "")
        self.hedra_model = g("HEDRA_MODEL_ID", HEDRA_AVATAR_MODEL)
        self.presenter_url = g(
            "PRESENTER_IMAGE_URL",
            "https://d8j0ntlcm91z4.cloudfront.net/user_3DTLmgHXqDZdcq1wpnNDD4pHteF/"
            "hf_20260526_025508_42fb418a-ed9d-4080-8591-fd6c8deecfb5.png",
        )
        self.aspect = g("ASPECT_RATIO", "9:16")
        self.resolution = g("RESOLUTION", "720p")
        self.post = g("POST_TO_TIKTOK", "false").lower() == "true"
        self.blotato_key = g("BLOTATO_API_KEY", "")
        self.blotato_account = g("BLOTATO_TIKTOK_ACCOUNT_ID", "")

    def require(self, *names):
        missing = [n for n in names if not getattr(self, n)]
        if missing:
            env_names = {
                "anthropic_key": "ANTHROPIC_API_KEY",
                "eleven_key": "ELEVENLABS_API_KEY",
                "hedra_key": "HEDRA_API_KEY",
            }
            sys.exit("Missing required keys in .env: " +
                     ", ".join(env_names.get(m, m) for m in missing))


# --------------------------------------------------------------------------- #
# pipeline steps (each takes requests + cfg so the script imports without deps
# during --selftest)
# --------------------------------------------------------------------------- #
def write_script(requests, cfg, topic):
    system = ("You are a UK Chartered Accountant making a faceless, credibility-led "
              "personal-finance TikTok. Plain-English CA voice, UK context only (£, HMRC, "
              "ISA, SIPP, National Insurance). Spell numbers as words for clean "
              "text-to-speech. Return ONLY valid minified JSON, no markdown, no preamble.")
    user = (f"Topic: {topic['topic']}. Angle: {topic['angle']}. "
            'Return JSON exactly: {"script": a punchy spoken narration of about '
            "THIRTY-FIVE words (max 45) - one hook line then one clear payoff, spoken in "
            'roughly thirteen seconds, "caption": a TikTok caption under 150 characters '
            "ending with 3-5 relevant hashtags}.")
    r = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={"x-api-key": cfg.anthropic_key,
                 "anthropic-version": "2023-06-01",
                 "content-type": "application/json"},
        json={"model": cfg.anthropic_model, "max_tokens": 1024, "system": system,
              "messages": [{"role": "user", "content": user}]},
        timeout=60,
    )
    r.raise_for_status()
    txt = "".join(b.get("text", "") for b in r.json().get("content", []))
    return _parse_claude_json(txt)


def make_voice(requests, cfg, script):
    OUT_DIR.mkdir(exist_ok=True)
    r = requests.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{cfg.eleven_voice}",
        headers={"xi-api-key": cfg.eleven_key, "content-type": "application/json"},
        json={"text": script, "model_id": "eleven_multilingual_v2"},
        timeout=180,
    )
    r.raise_for_status()
    path = OUT_DIR / "voiceover.mp3"
    path.write_bytes(r.content)
    return path


def _h(cfg, json_ct=True):
    h = {"X-API-Key": cfg.hedra_key}
    if json_ct:
        h["Content-Type"] = "application/json"
    return h


def hedra_create_asset(requests, cfg, name, type_):
    r = requests.post(f"{HEDRA_BASE}/assets", headers=_h(cfg),
                      json={"name": name, "type": type_}, timeout=60)
    r.raise_for_status()
    return r.json()["id"]


def hedra_upload(requests, cfg, asset_id, path, mime):
    with open(path, "rb") as f:
        r = requests.post(f"{HEDRA_BASE}/assets/{asset_id}/upload",
                          headers=_h(cfg, json_ct=False),
                          files={"file": (os.path.basename(path), f, mime)}, timeout=300)
    r.raise_for_status()
    return r


def get_or_upload_image(requests, cfg, state):
    cached = state.get("image_asset_id")
    if cached:
        log(f"Reusing presenter image asset {cached}")
        return cached
    OUT_DIR.mkdir(exist_ok=True)
    log("Downloading presenter still ...")
    img = requests.get(cfg.presenter_url, timeout=120)
    img.raise_for_status()
    path = OUT_DIR / "presenter.png"
    path.write_bytes(img.content)
    aid = hedra_create_asset(requests, cfg, "presenter.png", "image")
    hedra_upload(requests, cfg, aid, path, "image/png")
    state["image_asset_id"] = aid
    save_state(state)
    log(f"Presenter image uploaded once, cached as asset {aid}")
    return aid


def hedra_generate(requests, cfg, image_id, audio_id, prompt):
    body = {
        "type": "video",
        "ai_model_id": cfg.hedra_model,
        "start_keyframe_id": image_id,
        "audio_id": audio_id,
        "generated_video_inputs": {
            "text_prompt": prompt,
            "aspect_ratio": cfg.aspect,
            "resolution": cfg.resolution,
        },
    }
    r = requests.post(f"{HEDRA_BASE}/generations", headers=_h(cfg), json=body, timeout=60)
    r.raise_for_status()
    return r.json()["id"]


def hedra_video_url_from_asset(requests, cfg, asset_id):
    try:
        r = requests.get(f"{HEDRA_BASE}/assets?type=video", headers=_h(cfg, json_ct=False), timeout=60)
        if r.ok:
            items = r.json()
            items = items if isinstance(items, list) else items.get("assets", items.get("data", []))
            for a in items:
                if a.get("id") == asset_id:
                    return a.get("url") or (a.get("asset") or {}).get("url")
    except Exception as e:
        log(f"  (asset lookup failed: {e})")
    return None


def hedra_poll(requests, cfg, gen_id, timeout_s=1200):
    start = time.time()
    while True:
        r = requests.get(f"{HEDRA_BASE}/generations/{gen_id}/status",
                         headers=_h(cfg, json_ct=False), timeout=60)
        r.raise_for_status()
        j = r.json()
        status = (j.get("status") or "").lower()
        log(f"  status={status} progress={j.get('progress')} eta={j.get('eta_sec')}")
        if status in ("complete", "completed", "succeeded", "success"):
            url = j.get("url") or j.get("download_url") or j.get("video_url")
            if not url and j.get("asset_id"):
                url = hedra_video_url_from_asset(requests, cfg, j["asset_id"])
            return url, j
        if status in ("error", "failed"):
            raise RuntimeError(f"Hedra generation failed: {json.dumps(j)[:400]}")
        if time.time() - start > timeout_s:
            raise TimeoutError(f"Hedra render exceeded {timeout_s}s; last status: {json.dumps(j)[:300]}")
        time.sleep(15)


def host_public(requests, path, mime):
    with open(path, "rb") as f:
        r = requests.post("https://tmpfiles.org/api/v1/upload",
                          files={"file": (os.path.basename(path), f, mime)}, timeout=300)
    r.raise_for_status()
    url = r.json()["data"]["url"]
    return url.replace("https://tmpfiles.org/", "https://tmpfiles.org/dl/")


def post_tiktok(requests, cfg, video_url, caption):
    body = {"post": {
        "accountId": cfg.blotato_account,
        "content": {"text": caption, "mediaUrls": [video_url], "platform": "tiktok"},
        "target": {"targetType": "tiktok", "privacyLevel": "PUBLIC_TO_EVERYONE",
                   "disabledComments": False, "disabledDuet": False, "disabledStitch": False,
                   "isBrandedContent": False, "isYourBrand": False, "isAiGenerated": True},
    }}
    r = requests.post("https://backend.blotato.com/v2/posts",
                      headers={"blotato-api-key": cfg.blotato_key, "content-type": "application/json"},
                      json=body, timeout=120)
    r.raise_for_status()
    return r.json()


# --------------------------------------------------------------------------- #
# selftest (offline)
# --------------------------------------------------------------------------- #
def selftest():
    ok = True
    sample = '```json\n{"script":"Here is the hook. And the clear payoff.","caption":"Save tax legally #UKtax #ISA #money"}\n```'
    s, c = _parse_claude_json(sample)
    assert s.startswith("Here is the hook"), "script parse failed"
    assert c.endswith("#money"), "caption parse failed"
    print("✓ Claude JSON parser")
    t = pick_topic()
    assert t in TOPICS, "topic pick failed"
    print("✓ Topic rotation (date-based)")
    body = {"type": "video", "ai_model_id": HEDRA_AVATAR_MODEL,
            "start_keyframe_id": "img", "audio_id": "aud",
            "generated_video_inputs": {"text_prompt": "x", "aspect_ratio": "9:16", "resolution": "720p"}}
    json.dumps(body)
    print("✓ Hedra generation body is valid JSON")
    print("\nALL OFFLINE CHECKS PASSED" if ok else "FAILED")
    return 0


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #
def main():
    ap = argparse.ArgumentParser(description="Faceless Finance autopilot")
    ap.add_argument("--dry-run", action="store_true", help="topic + script only, no media")
    ap.add_argument("--credits", action="store_true", help="show Hedra credit balance")
    ap.add_argument("--selftest", action="store_true", help="offline checks, no keys needed")
    args = ap.parse_args()

    if args.selftest:
        return selftest()

    load_dotenv()
    import requests  # imported here so --selftest works without the dependency
    cfg = Cfg()

    if args.credits:
        cfg.require("hedra_key")
        r = requests.get(f"{HEDRA_BASE}/credits", headers=_h(cfg, json_ct=False), timeout=30)
        print(r.status_code, r.text)
        return 0

    cfg.require("anthropic_key", "eleven_key", "hedra_key")
    state = load_state()
    topic = pick_topic(state)
    save_state(state)
    log(f"Topic: {topic['topic']}")

    script, caption = write_script(requests, cfg, topic)
    log(f"Script ({len(script.split())} words): {script}")
    log(f"Caption: {caption}")
    if args.dry_run:
        log("Dry run — stopping before any media generation or spend.")
        return 0

    audio = make_voice(requests, cfg, script)
    log(f"Voiceover saved: {audio}")

    audio_id = hedra_create_asset(requests, cfg, "voiceover.mp3", "audio")
    hedra_upload(requests, cfg, audio_id, audio, "audio/mpeg")
    log(f"Audio asset: {audio_id}")

    image_id = get_or_upload_image(requests, cfg, state)

    prompt = ("A UK chartered accountant presenter speaking straight to camera, natural "
              "accurate lip-sync, calm confident delivery, subtle head movement and blinking, "
              "steady framing, photorealistic")
    gen_id = hedra_generate(requests, cfg, image_id, audio_id, prompt)
    log(f"Generation started: {gen_id}")

    video_url, info = hedra_poll(requests, cfg, gen_id)
    log(f"Render complete. Video URL: {video_url}")

    OUT_DIR.mkdir(exist_ok=True)
    mp4 = OUT_DIR / f"finance_{datetime.datetime.now():%Y%m%d_%H%M%S}.mp4"
    if video_url:
        vr = requests.get(video_url, headers=_h(cfg, json_ct=False), timeout=600)
        if vr.ok and vr.content:
            mp4.write_bytes(vr.content)
            log(f"Saved video: {mp4}  ({len(vr.content)//1024} kB)")

    if cfg.post and cfg.blotato_key and cfg.blotato_account:
        public = host_public(requests, mp4, "video/mp4") if mp4.exists() else video_url
        res = post_tiktok(requests, cfg, public, caption)
        log(f"Posted to TikTok ✓  {json.dumps(res)[:300]}")
    else:
        watch = None
        if mp4.exists():
            try:
                watch = host_public(requests, mp4, "video/mp4")
            except Exception as e:
                log(f"  (couldn't host preview: {e})")
        log("POST_TO_TIKTOK is off — review first, then set POST_TO_TIKTOK=true to auto-post.")
        if watch:
            log(f"▶ WATCH YOUR VIDEO: {watch}")
        elif video_url:
            log(f"▶ WATCH YOUR VIDEO: {video_url}")
    log("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
