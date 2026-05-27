"""Topic -> structured cinematic shot plan via Claude. Robust parse + offline fallback.

Length is governed by SPOKEN WORDS, because Hedra renders each clip to the length of
its voiceover. ~30s Short => ~70 words total, so we cap the budget here and clamp
per-line as a safety net even if the model overshoots."""
from __future__ import annotations
import json, requests
from render.base import Shot, ShotPlan

# --- length governor (the only real duration lever for a Hedra render) ---
TARGET_SECONDS   = 28          # aim for a tight 25-32s Short
WORDS_PER_SECOND = 2.6         # ~ UK TTS pace
TOTAL_WORD_CAP   = 75          # hard ceiling across all shots (~28-30s)
PER_LINE_WORDS   = 13          # max words in any single spoken line
VALID_KINDS      = ("to_camera", "motion")

SYSTEM = (
 "You are the director+writer for a faceless UK personal-finance short fronted by a "
 "Chartered Accountant. Output a CINEMATIC plan for a ~28s vertical (9:16) video. "
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
 'spoken sentence, max 13 words), "seconds": int 4-7}]}. '
 "Exactly 4 shots in this order: open to_camera (hook), motion, motion, close to_camera "
 "(payoff + 'follow for more'). HARD LIMIT: the spoken lines together MUST total 75 words "
 "or fewer (about 28 seconds). Be ruthless - cut filler, keep it punchy."
)


def _trim_words(text: str, max_words: int) -> str:
    w = text.split()
    if len(w) <= max_words:
        return text.strip()
    out = " ".join(w[:max_words]).rstrip(",;:- ")
    if not out.endswith((".", "!", "?")):
        out += "."
    return out


def _clamp_plan(plan: ShotPlan) -> ShotPlan:
    """Enforce the length governor regardless of what the model returned."""
    for s in plan.shots:
        if s.kind not in VALID_KINDS:
            s.kind = "to_camera" if s.id == 1 or s.id == len(plan.shots) else "motion"
        s.vo = _trim_words(s.vo, PER_LINE_WORDS)
        s.seconds = min(max(int(s.seconds or 6), 4), 7)
    # global word ceiling: trim from the longest lines until under cap
    def total():
        return sum(len(s.vo.split()) for s in plan.shots)
    guard = 0
    while total() > TOTAL_WORD_CAP and guard < 50:
        longest = max(plan.shots, key=lambda s: len(s.vo.split()))
        longest.vo = _trim_words(longest.vo, max(4, len(longest.vo.split()) - 1))
        guard += 1
    return plan


def parse_plan(text: str) -> ShotPlan:
    t = text.strip()
    if t.startswith("```"):
        t = t.split("```")[1]
        if t.lstrip().lower().startswith("json"): t = t.lstrip()[4:]
    i, j = t.find("{"), t.rfind("}")
    d = json.loads(t[i:j+1])
    shots = [Shot(id=k+1, kind=s.get("kind", "motion"), prompt=s.get("prompt", ""),
                  vo=s.get("vo", ""), seconds=int(s.get("seconds", 6)))
             for k, s in enumerate(d["shots"])]
    return _clamp_plan(ShotPlan(title=d.get("title", "Finance Short"),
                                caption=d.get("caption", ""), shots=shots))


def generate(topic: str, cfg) -> ShotPlan:
    cfg.require("anthropic_key")
    r = requests.post("https://api.anthropic.com/v1/messages",
        headers={"x-api-key": cfg.anthropic_key, "anthropic-version": "2023-06-01",
                 "content-type": "application/json"},
        json={"model": cfg.anthropic_model, "max_tokens": 1200, "system": SYSTEM,
              "messages": [{"role": "user", "content": f"Topic: {topic}\n\n{INSTRUCT}"}]},
        timeout=120)
    r.raise_for_status()
    txt = "".join(b.get("text", "") for b in r.json().get("content", []) if b.get("type") == "text")
    return parse_plan(txt)


def fallback_plan(topic: str) -> ShotPlan:
    return _clamp_plan(ShotPlan(
        title=f"{topic} (auto)",
        caption=f"{topic} - explained by a UK accountant. #UKfinance #money #ISA",
        shots=[
          Shot(1, "to_camera", "Medium close-up, presenter to camera, soft light, confident.",
               f"Most people get {topic} completely wrong.", 5),
          Shot(2, "motion", "Slow cinematic push-in on the presenter, shallow depth of field, subtle motion.",
               "The tax rules quietly reward whoever plans ahead.", 6),
          Shot(3, "motion", "Gentle pan across the presenter, golden tone, calm confident energy.",
               "A small move now compounds into thousands later.", 6),
          Shot(4, "to_camera", "Medium close-up, presenter to camera, direct and warm.",
               "Sort it before the tax year ends. Follow for more.", 6),
        ]))
