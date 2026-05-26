"""Higgsfield premium adapter (cinematic Soul look). Behind a validation flag:
it refuses to run until HIGGSFIELD_API_BASE is set, so the unattended pipeline never
silently depends on an unverified endpoint. Best-effort image->video REST contract."""
from __future__ import annotations
import os, time, requests
from .base import Shot, RenderError

class HiggsfieldEngine:
    name = "higgsfield"
    motion_max_seconds = 8

    def __init__(self, cfg):
        self.cfg = cfg
        if not cfg.hf_base or not cfg.hf_token:
            raise RenderError(
                "Higgsfield adapter not configured. The cinematic look is proven via the "
                "Higgsfield MCP, but headless use needs a validated REST endpoint. Set "
                "HIGGSFIELD_API_BASE + HIGGSFIELD_TOKEN and confirm ONE live call, then set "
                "RENDER_MOTION=higgsfield. Until then the default engine (hedra) is used.")
        self.h = {"Authorization": f"Bearer {cfg.hf_token}", "Content-Type":"application/json"}
        self.base = cfg.hf_base.rstrip("/")

    def _generate(self, prompt, image_url, seconds):
        body = {"prompt": prompt, "start_image_url": image_url,
                "duration": min(seconds, self.motion_max_seconds), "enhance_prompt": True}
        r = requests.post(f"{self.base}/generate", headers=self.h, json=body, timeout=120)
        r.raise_for_status(); j=r.json()
        return j.get("id") or j.get("request_id") or j.get("job_id")

    def _poll(self, jid, timeout=900):
        t0=time.time()
        while time.time()-t0 < timeout:
            r = requests.get(f"{self.base}/status/{jid}", headers=self.h, timeout=60)
            r.raise_for_status(); j=r.json(); st=(j.get("status") or "").lower()
            if st in ("completed","complete","succeeded","done"):
                return j.get("url") or (j.get("result") or {}).get("url") or (j.get("output") or [{}])[0].get("url")
            if st in ("failed","error"): raise RenderError(f"Higgsfield failed: {j}")
            time.sleep(8)
        raise RenderError("Higgsfield timed out")

    def _dl(self, url, out):
        open(out,"wb").write(requests.get(url, timeout=300).content); return out

    def render_motion(self, shot: Shot, image_url: str) -> str:
        jid = self._generate(shot.prompt, image_url, shot.seconds)
        out = os.path.join(self.cfg.out_dir, f"shot_{shot.id}_hf.mp4")
        return self._dl(self._poll(jid), out)

    def render_to_camera(self, shot: Shot, image_url: str) -> str:
        # Higgsfield is used for cinematic motion; lip-sync stays on Hedra by default.
        raise RenderError("Use hedra for to_camera lip-sync; higgsfield handles motion shots.")
