"""Hedra render adapters (server-callable, proven). Avatar = lip-sync to-camera;
Omnia = image->motion for walk/b-roll. Uses the user's existing Hedra credits."""
from __future__ import annotations
import os, time, tempfile, requests
from .base import Shot, RenderError

class HedraEngine:
    name = "hedra"
    motion_max_seconds = 8

    def __init__(self, cfg):
        self.cfg = cfg
        cfg.require("hedra_key")
        self.h = {"X-API-Key": cfg.hedra_key}
        self.base = cfg.hedra_base
        self._img_cache: dict[str,str] = {}

    # ---- assets ----
    def _create_asset(self, name, type_):
        r = requests.post(f"{self.base}/assets", headers=self.h,
                          json={"name": name, "type": type_}, timeout=60)
        r.raise_for_status(); return r.json()["id"]

    def _upload(self, asset_id, data: bytes, filename, content_type):
        r = requests.post(f"{self.base}/assets/{asset_id}/upload", headers=self.h,
                          files={"file": (filename, data, content_type)}, timeout=300)
        r.raise_for_status(); return asset_id

    def _image_asset(self, url: str) -> str:
        if url in self._img_cache: return self._img_cache[url]
        data = requests.get(url, timeout=120).content
        aid = self._create_asset("presenter.png", "image")
        self._upload(aid, data, "presenter.png", "image/png")
        self._img_cache[url] = aid; return aid

    def _audio_asset(self, path: str) -> str:
        data = open(path,"rb").read()
        aid = self._create_asset(os.path.basename(path), "audio")
        self._upload(aid, data, os.path.basename(path), "audio/mpeg")
        return aid

    # ---- generation ----
    def _generate(self, model_id, image_id, audio_id, prompt, duration_ms):
        gi = {"text_prompt": prompt or "", "aspect_ratio": "9:16", "resolution": "540p"}
        if duration_ms: gi["duration_ms"] = duration_ms
        body = {"type":"video","ai_model_id":model_id,"start_keyframe_id":image_id,
                "generated_video_inputs": gi}
        if audio_id: body["audio_id"] = audio_id
        r = requests.post(f"{self.base}/generations", headers=self.h, json=body, timeout=120)
        r.raise_for_status(); return r.json()["id"]

    def _poll(self, gen_id, timeout=900) -> str:
        t0=time.time()
        while time.time()-t0 < timeout:
            r = requests.get(f"{self.base}/generations/{gen_id}/status", headers=self.h, timeout=60)
            r.raise_for_status(); j=r.json(); st=j.get("status")
            if st=="complete":
                return j.get("url") or j.get("asset",{}).get("url") or j.get("output",{}).get("url")
            if st in ("error","failed"):
                raise RenderError(f"Hedra generation failed: {j}")
            time.sleep(8)
        raise RenderError("Hedra generation timed out")

    def _download(self, url, out):
        d = requests.get(url, timeout=300).content
        open(out,"wb").write(d); return out

    def _out(self, shot): 
        return os.path.join(self.cfg.out_dir, f"shot_{shot.id}_hedra.mp4")

    def render_to_camera(self, shot: Shot, image_url: str) -> str:
        if not shot.audio_path: raise RenderError("to_camera needs audio")
        img = self._image_asset(image_url); aud = self._audio_asset(shot.audio_path)
        gen = self._generate(self.cfg.hedra_avatar_model, img, aud, shot.prompt, None)
        out = self._out(shot); return self._download(self._poll(gen), out)

    def render_motion(self, shot: Shot, image_url: str) -> str:
        img = self._image_asset(image_url)
        secs = min(shot.seconds, self.motion_max_seconds)
        gen = self._generate(self.cfg.hedra_omnia_model, img, None, shot.prompt, secs*1000)
        out = self._out(shot); return self._download(self._poll(gen), out)
