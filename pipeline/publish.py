"""Publish the finished mp4. Prefers the repo's Worker (OAuth multi-platform);
falls back to Blotato (needs a public URL, so we host via tmpfiles first)."""
from __future__ import annotations
import os, requests

def _host_tmpfiles(path: str) -> str:
    r = requests.post("https://tmpfiles.org/api/v1/upload",
                      files={"file": open(path,"rb")}, timeout=300)
    r.raise_for_status(); u = r.json()["data"]["url"]
    return u.replace("tmpfiles.org/", "tmpfiles.org/dl/")

def report_to_app(final_path: str, plan, cfg) -> str:
    """Host the mp4 and tell the Worker so the app review screen shows it."""
    if not cfg.worker_ingest_url or not cfg.ingest_secret:
        return "app ingest skipped (set WORKER_INGEST_URL + INGEST_SECRET)"
    url = _host_tmpfiles(final_path)
    r = requests.post(cfg.worker_ingest_url,
        headers={"x-ingest-secret": cfg.ingest_secret, "content-type":"application/json"},
        json={"video_url": url, "title": plan.title, "caption": plan.caption}, timeout=120)
    r.raise_for_status(); return f"app ingest ok -> {url}"

def publish(final_path: str, plan, cfg) -> str:
    if cfg.worker_url:
        with open(final_path,"rb") as f:
            r = requests.post(cfg.worker_url,
                headers={"Authorization": f"Bearer {cfg.worker_secret}"} if cfg.worker_secret else {},
                files={"video": (os.path.basename(final_path), f, "video/mp4")},
                data={"caption": plan.caption, "title": plan.title}, timeout=600)
        r.raise_for_status(); return f"worker: {r.status_code}"
    if cfg.blotato_key and cfg.blotato_account:
        url = _host_tmpfiles(final_path)
        r = requests.post("https://backend.blotato.com/v2/posts",
            headers={"blotato-api-key": cfg.blotato_key, "content-type":"application/json"},
            json={"post":{"accountId":cfg.blotato_account,
                  "content":{"text":plan.caption,"mediaUrls":[url],"platform":"tiktok"},
                  "target":{"targetType":"tiktok","privacyLevel":"PUBLIC_TO_EVERYONE",
                            "isAiGenerated":True,"disableComments":False,"disableDuet":False,
                            "disableStitch":False}}}, timeout=120)
        r.raise_for_status(); return f"blotato: {r.status_code}"
    return "publish skipped (no worker/blotato configured) - mp4 saved as artifact"
