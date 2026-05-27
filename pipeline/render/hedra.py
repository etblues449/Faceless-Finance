"""Hedra render adapters (server-callable, proven). Both models take image + audio + prompt:
   Avatar  -> lip-sync to-camera close-up.
   Omnia   -> image+audio+motion/camera prompt = the walking/b-roll cinematic shot.
Omnia REQUIRES audio (it reasons over image+audio+prompt jointly), so every shot is voiced."""
from __future__ import annotations
import os, time, json, requests
from .base import Shot, RenderError

class HedraEngine:
    name = "hedra"
    motion_max_seconds = 8

    def __init__(self, cfg):
        self.cfg = cfg
        cfg.require("hedra_key")
        self.h = {"X-API-Key": cfg.hedra_key}
        self.base = cfg.hedra_base
        self._img_cache: dict[str, str] = {}

    # ---- assets ----
    def _create_asset(self, name, type_):
        r = requests.post(f"{self.base}/assets", headers=self.h, json={"name": name, "type": type_}, timeout=60)
        if r.status_code not in (200, 201): raise RenderError(f"create asset {r.status_code}: {r.text[:300]}")
        return r.json()["id"]

    def _upload(self, asset_id, data, filename, content_type):
        r = requests.post(f"{self.base}/assets/{asset_id}/upload", headers=self.h,
                          files={"file": (filename, data, content_type)}, timeout=300)
        if r.status_code not in (200, 201): raise RenderError(f"upload {r.status_code}: {r.text[:300]}")
        return asset_id

    def _image_asset(self, ref):
        if ref in self._img_cache: return self._img_cache[ref]
        if os.path.exists(ref):                      # committed repo image (robust: works private or public)
            data = open(ref, "rb").read()
            ext = os.path.splitext(ref)[1].lower()
            ct = "image/jpeg" if ext in (".jpg", ".jpeg") else "image/png"
            fn = os.path.basename(ref)
        else:
            data = requests.get(ref, timeout=120).content; ct = "image/png"; fn = "presenter.png"
        aid = self._create_asset(fn, "image")
        self._upload(aid, data, fn, ct)
        self._img_cache[ref] = aid; return aid

    def _audio_asset(self, path):
        aid = self._create_asset(os.path.basename(path), "audio")
        self._upload(aid, open(path, "rb").read(), os.path.basename(path), "audio/mpeg")
        return aid

    # ---- generation ----
    def _generate(self, model_id, image_id, audio_id, prompt):
        body = {"type": "video", "ai_model_id": model_id,
                "start_keyframe_id": image_id, "audio_id": audio_id,
                "generated_video_inputs": {"text_prompt": prompt or "",
                                           "aspect_ratio": "9:16", "resolution": self.cfg.hedra_resolution}}
        r = requests.post(f"{self.base}/generations", headers=self.h, json=body, timeout=120)
        if r.status_code not in (200, 201, 202):
            raise RenderError(f"Hedra generations {r.status_code}: {r.text[:400]}")
        return r.json()["id"]

    def _poll(self, gen_id, timeout=900):
        t0 = time.time()
        while time.time() - t0 < timeout:
            r = requests.get(f"{self.base}/generations/{gen_id}/status", headers=self.h, timeout=60)
            r.raise_for_status(); j = r.json(); st = j.get("status")
            if st == "complete":
                return j.get("url") or (j.get("asset") or {}).get("url") or (j.get("output") or {}).get("url")
            if st in ("error", "failed"): raise RenderError(f"Hedra generation failed: {j}")
            time.sleep(8)
        raise RenderError("Hedra generation timed out")

    def _shot(self, model_id, shot, image_url):
        if not shot.audio_path:
            raise RenderError(f"shot {shot.id}: Hedra needs an audio track")
        img = self._image_asset(image_url)
        aud = self._audio_asset(shot.audio_path)
        gen = self._generate(model_id, img, aud, shot.prompt)
        out = os.path.join(self.cfg.out_dir, f"shot_{shot.id}_hedra.mp4")
        open(out, "wb").write(requests.get(self._poll(gen), timeout=300).content)
        return out

    def render_to_camera(self, shot: Shot, image_url: str) -> str:
        return self._shot(self.cfg.hedra_avatar_model, shot, image_url)

    def render_motion(self, shot: Shot, image_url: str) -> str:
        return self._shot(self.cfg.hedra_omnia_model, shot, image_url)
