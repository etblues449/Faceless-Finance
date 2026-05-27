"""Central config from environment. Import-safe (never touches network)."""
from __future__ import annotations
import os

def _b(v, default=False):
    if v is None: return default
    return str(v).strip().lower() in ("1", "true", "yes", "on")

class Config:
    def __init__(self, env=None):
        e = env or os.environ
        # LLM + voice
        self.anthropic_key   = e.get("ANTHROPIC_API_KEY", "")
        self.anthropic_model = e.get("ANTHROPIC_MODEL", "claude-sonnet-4-6")
        self.eleven_key      = e.get("ELEVENLABS_API_KEY", "")
        self.eleven_voice    = e.get("ELEVENLABS_VOICE_ID", "")
        self.eleven_model    = e.get("ELEVENLABS_MODEL", "eleven_multilingual_v2")
        # render engine selection (modular / future-proof)
        self.engine_to_camera = e.get("RENDER_TO_CAMERA", "hedra")   # hedra | higgsfield
        self.engine_motion    = e.get("RENDER_MOTION", "hedra")      # hedra | higgsfield
        # Hedra
        self.hedra_key        = e.get("HEDRA_API_KEY", "")
        self.hedra_base       = e.get("HEDRA_BASE", "https://api.hedra.com/web-app/public")
        self.hedra_avatar_model = e.get("HEDRA_AVATAR_MODEL_ID", "26f0fc66-152b-40ab-abed-76c43df99bc8")
        self.hedra_omnia_model  = e.get("HEDRA_OMNIA_MODEL_ID",  "ab372b84-432f-44f5-bacc-c2542465f712")
        # Higgsfield (premium / optional)
        self.hf_token         = e.get("HIGGSFIELD_TOKEN", "")
        self.hf_base          = e.get("HIGGSFIELD_API_BASE", "https://api.higgsfield.ai/v1")
        self.hf_video_model   = e.get("HIGGSFIELD_VIDEO_MODEL", "")  # slug from docs.higgsfield.ai
        self.hf_soul_id       = e.get("HIGGSFIELD_SOUL_ID", "64da88e0-fe5f-4af6-a2da-3b8de23fad64")
        # images
        self.presenter_url    = e.get("PRESENTER_IMAGE_URL", "")     # head-and-shoulders still (lip-sync)
        self.fullbody_url     = e.get("FULLBODY_IMAGE_URL", "")      # full-body still (walk/motion)
        # publish
        self.post_enabled     = _b(e.get("POST_TO_TIKTOK"), False)
        self.worker_url       = e.get("WORKER_PUBLISH_URL", "")      # the worker/ endpoint
        self.worker_secret    = e.get("WORKER_SECRET", "")
        self.blotato_key      = e.get("BLOTATO_API_KEY", "")
        self.blotato_account  = e.get("BLOTATO_TIKTOK_ACCOUNT_ID", "")
        # app review (pipeline reports finished video to the Worker so the app can review it)
        self.worker_ingest_url= e.get("WORKER_INGEST_URL", "")
        self.ingest_secret    = e.get("INGEST_SECRET", "")
        # output
        self.out_dir          = e.get("OUT_DIR", os.path.join(os.path.dirname(__file__), "out"))

    def require(self, *names):
        missing = [n for n in names if not getattr(self, n, "")]
        if missing:
            raise RuntimeError("Missing required config: " + ", ".join(missing))
