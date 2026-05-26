"""Higgsfield headless adapter — official REST API (api.higgsfield.ai/v1).
Animates a full-body Soul still into a cinematic motion shot, on YOUR Higgsfield
credits (no third-party gateway). Submit -> poll -> download.

Activate by setting HIGGSFIELD_TOKEN (API key from cloud.higgsfield.ai -> API) and
HIGGSFIELD_VIDEO_MODEL (confirm the slug in docs.higgsfield.ai), then RENDER_MOTION=higgsfield.
Until a token is set it refuses to run, so the pipeline never makes blind calls."""
from __future__ import annotations
import os, time, requests
from .base import Shot, RenderError

class HiggsfieldEngine:
    name = "higgsfield"
    motion_max_seconds = 10            # official cinematic models do 5-15s; we cap shots small

    def __init__(self, cfg):
        self.cfg = cfg
        if not cfg.hf_token:
            raise RenderError(
                "Higgsfield not configured. Create an API key at cloud.higgsfield.ai -> API, "
                "set HIGGSFIELD_TOKEN + HIGGSFIELD_VIDEO_MODEL (slug from docs.higgsfield.ai), "
                "then RENDER_MOTION=higgsfield. Default engine (hedra) is used until then.")
        self.base = (cfg.hf_base or "https://api.higgsfield.ai/v1").rstrip("/")
        self.model = cfg.hf_video_model or "dop-turbo"   # confirm against docs.higgsfield.ai
        self.h = {"Authorization": f"Bearer {cfg.hf_token}", "Content-Type": "application/json"}

    def _submit(self, prompt, image_url, seconds) -> str:
        body = {
            "task": "image-to-video",
            "model": self.model,
            "input_image": image_url,
            "prompt": prompt,
            "duration": min(seconds, self.motion_max_seconds),
            "motion_intensity": "high",
            "aspect_ratio": "9:16",
        }
        r = requests.post(f"{self.base}/generations", headers=self.h, json=body, timeout=120)
        if r.status_code not in (200, 201, 202):
            raise RenderError(f"Higgsfield submit {r.status_code}: {r.text[:300]}")
        j = r.json()
        gid = j.get("id") or j.get("request_id") or j.get("generation_id")
        if not gid: raise RenderError(f"Higgsfield: no id in response: {j}")
        return gid

    def _poll(self, gid, timeout=900) -> str:
        t0 = time.time()
        while time.time() - t0 < timeout:
            r = requests.get(f"{self.base}/generations/{gid}", headers=self.h, timeout=60)
            r.raise_for_status(); j = r.json()
            st = (j.get("status") or "").lower()
            if st in ("completed", "complete", "succeeded", "done"):
                url = (j.get("output_url") or j.get("url")
                       or (j.get("output") or {}).get("url")
                       or (j.get("result") or {}).get("url")
                       or (j.get("assets") or [{}])[0].get("url"))
                if not url: raise RenderError(f"Higgsfield done but no url: {j}")
                return url
            if st in ("failed", "error", "cancelled"):
                raise RenderError(f"Higgsfield failed: {j}")
            time.sleep(8)
        raise RenderError("Higgsfield timed out")

    def render_motion(self, shot: Shot, image_url: str) -> str:
        gid = self._submit(shot.prompt, image_url, shot.seconds)
        out = os.path.join(self.cfg.out_dir, f"shot_{shot.id}_hf.mp4")
        url = self._poll(gid)
        open(out, "wb").write(requests.get(url, timeout=300).content)
        return out

    def render_to_camera(self, shot: Shot, image_url: str) -> str:
        # Lip-sync stays on Hedra; Higgsfield is the cinematic-motion engine.
        raise RenderError("higgsfield handles motion shots; use hedra for to_camera lip-sync.")
