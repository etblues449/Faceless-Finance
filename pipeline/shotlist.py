"""Topic -> structured cinematic shot plan via Claude. Robust parse + offline fallback."""
from __future__ import annotations
import json, requests
from render.base import Shot, ShotPlan
SYSTEM = (
 "You are the director+writer for a faceless UK personal-finance short fronted by a "
 "Chartered Accountant. Output a CINEMATIC plan for a ~30s vertical (9:16) video. "
 "UK context (ISA, pension, HMRC, GBP). Credible, specific, punchy, no hype, no emojis. "
 "The presenter is a real person in their real setting; you CANNOT teleport them to new "
 "locations. Shots are either 'to_camera' (speaking to camera) or 'motion' (the SAME "
 "presenter with cinematic CAMERA MOVEMENT - slow push-in, gentle pan, rack focus - and "
 "subtle natural motion). Never describe a different place or object-only b-roll."
)
INSTRUCT = (
 "Return ONLY valid JSON, no markdown, no preamble, with this exact shape:\n"
 '{"title": str, "caption": str (<=150 chars, 2-3 hashtags), '
 '"shots": [{"kind": "to_camera|motion", "prompt": str (camera move + mood only, e.g. '
 "'slow cinematic push-in, shallow depth of field, confident'), \"vo\": str (ONE short "
 'spoken sentence, max ~14 words), "seconds": int 4-7}]}. '
 "Exactly 4 shots, total spoken time ~30s: open to_camera, two motion shots, close to_camera."
)


def parse_plan(text: str) -> ShotPlan:
    t = text.strip()
    if t.startswith("```"):
        t = t.split("```")[1]
        if t.lstrip().lower().startswith("json"): t = t.lstrip()[4:]
    i, j = t.find("{"), t.rfind("}")
    d = json.loads(t[i:j+1])
    shots = [Shot(id=k+1, kind=s.get("kind","broll"), prompt=s.get("prompt",""),
                  vo=s.get("vo",""), seconds=int(s.get("seconds",6)))
             for k, s in enumerate(d["shots"])]
    return ShotPlan(title=d.get("title","Finance Short"),
                    caption=d.get("caption",""), shots=shots)

def generate(topic: str, cfg) -> ShotPlan:
    cfg.require("anthropic_key")
    r = requests.post("https://api.anthropic.com/v1/messages",
        headers={"x-api-key": cfg.anthropic_key, "anthropic-version":"2023-06-01",
                 "content-type":"application/json"},
        json={"model": cfg.anthropic_model, "max_tokens":1200, "system":SYSTEM,
              "messages":[{"role":"user","content":f"Topic: {topic}\n\n{INSTRUCT}"}]},
        timeout=120)
    r.raise_for_status()
    txt = "".join(b.get("text","") for b in r.json().get("content",[]) if b.get("type")=="text")
    return parse_plan(txt)


def fallback_plan(topic: str) -> ShotPlan:
    return ShotPlan(
        title=f"{topic} (auto)",
        caption=f"{topic} - explained by a UK accountant. #UKfinance #money #ISA",
        shots=[
          Shot(1,"to_camera","Medium close-up, presenter to camera, soft light, confident.",
               f"Most people get {topic} completely wrong.", 5),
          Shot(2,"motion","Slow cinematic push-in on the presenter, shallow depth of field, subtle motion.",
               "The tax rules quietly reward whoever plans ahead.", 7),
          Shot(3,"motion","Gentle pan across the presenter, golden tone, calm confident energy.",
               "A small move now compounds into thousands later.", 7),
          Shot(4,"to_camera","Medium close-up, presenter to camera, direct and warm.",
               "Sort it before the tax year ends. Follow for more.", 6),
        ])
