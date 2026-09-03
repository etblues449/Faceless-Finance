#!/usr/bin/env python3
"""
select_clips.py — the deterministic pre-selection stage of the podcast clip
intelligence layer.

Given a *timestamped* long-form transcript (WebVTT / SRT / "[HH:MM:SS] text"),
it segments the episode into candidate clip windows, scores each on the
measurable proxies that separate viral podcast clips from the rest, and returns
the strongest non-overlapping candidates with exact timestamps and a feature
breakdown.

This is the mechanical shortlist. The editorial packaging — spoken hook, text
overlay, format, edit instructions — is done by Claude in SKILL.md, using these
candidates as evidence. Keeping the two apart is the whole design: the machine
finds *where*, the model decides *how*.

Zero dependencies (stdlib only). Offline-testable:

    python select_clips.py --selftest            # runs on the bundled sample
    python select_clips.py --file episode.vtt     # real transcript -> JSON
    python select_clips.py --file episode.srt --top 5 --min 18 --max 60

Design mirrors the pipeline/ modules: import-safe, offline fallback, --selftest.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
from dataclasses import dataclass, field, asdict
from typing import List, Optional


# ---------------------------------------------------------------------------
# 1. Parsing timestamped transcripts into cues
# ---------------------------------------------------------------------------

@dataclass
class Cue:
    start: float          # seconds
    end: float            # seconds
    text: str


_TS = re.compile(
    r"(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?"
)


def _parse_ts(token: str) -> Optional[float]:
    """Parse HH:MM:SS(.mmm) / MM:SS(.mmm) into seconds. None if not a stamp."""
    m = _TS.fullmatch(token.strip())
    if not m:
        return None
    h = int(m.group(1) or 0)
    mnt = int(m.group(2))
    sec = int(m.group(3))
    ms = m.group(4)
    frac = int(ms) / (10 ** len(ms)) if ms else 0.0
    return h * 3600 + mnt * 60 + sec + frac


_ARROW = re.compile(r"\s*-->\s*")
_INLINE = re.compile(r"^\[?\s*((?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?)\s*\]?\s*(.*)$")


def parse_transcript(raw: str) -> List[Cue]:
    """
    Robustly parse WebVTT, SRT, or line-stamped transcripts into cues.

    Supported shapes:
      WEBVTT / SRT:  "00:01:23.400 --> 00:01:27.000\ntext..."
      Line-stamped:  "[00:01:23] text..."  or  "1:23 text..."
    """
    lines = raw.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    cues: List[Cue] = []

    # First pass: arrow-delimited blocks (VTT / SRT).
    i = 0
    n = len(lines)
    consumed_arrow = False
    while i < n:
        line = lines[i].strip()
        if "-->" in line:
            consumed_arrow = True
            a, _, b = line.partition("-->")
            start = _parse_ts(a.strip().split()[0]) if a.strip() else None
            end = _parse_ts(b.strip().split()[0]) if b.strip() else None
            i += 1
            body: List[str] = []
            while i < n and lines[i].strip() != "" and "-->" not in lines[i]:
                # skip pure cue-index integers (SRT)
                if not lines[i].strip().isdigit():
                    body.append(lines[i].strip())
                i += 1
            text = " ".join(body).strip()
            if start is not None and end is not None and text:
                cues.append(Cue(start, end, _clean(text)))
            continue
        i += 1

    if consumed_arrow and cues:
        return _fill_gaps(cues)

    # Second pass: inline line stamps.
    stamped: List[Cue] = []
    for line in lines:
        s = line.strip()
        if not s or s.upper() == "WEBVTT":
            continue
        m = _INLINE.match(s)
        if not m:
            continue
        ts = _parse_ts(m.group(1))
        body = _clean(m.group(2).strip())
        if ts is None or not body:
            continue
        stamped.append(Cue(ts, ts, body))
    # Infer each cue's end as the next cue's start (last one gets a nominal tail).
    for k in range(len(stamped)):
        if k + 1 < len(stamped):
            stamped[k].end = max(stamped[k].start, stamped[k + 1].start)
        else:
            stamped[k].end = stamped[k].start + _estimate_secs(stamped[k].text)
    return _fill_gaps(stamped)


_TAG = re.compile(r"<[^>]+>")            # VTT inline tags <c>, <00:00:01.000>
_SPEAKER = re.compile(r"^\s*[A-Z][A-Za-z .'-]{0,30}:\s")  # "HOST: ", "Alex: "


def _clean(text: str) -> str:
    text = _TAG.sub("", text)
    text = _SPEAKER.sub("", text)
    return re.sub(r"\s+", " ", text).strip()


def _estimate_secs(text: str) -> float:
    # ~2.8 words/sec conversational speech.
    return max(1.0, len(text.split()) / 2.8)


def _fill_gaps(cues: List[Cue]) -> List[Cue]:
    """Ensure monotonic, non-degenerate cues."""
    out: List[Cue] = []
    for c in cues:
        if c.end <= c.start:
            c.end = c.start + _estimate_secs(c.text)
        out.append(c)
    out.sort(key=lambda c: c.start)
    return out


# ---------------------------------------------------------------------------
# 2. Lexicons — the reverse-engineered signal words
# ---------------------------------------------------------------------------

# Openings that stop the scroll. See references/selection-rubric.md.
HOOK_WORDS = {
    "biggest", "worst", "best", "never", "always", "everyone", "everybody",
    "nobody", "no one", "secret", "mistake", "myth", "truth", "wrong", "reason",
    "why", "how", "what", "actually", "honestly", "listen", "look", "here's",
    "problem", "nobody's", "stop", "warning", "danger", "most", "single",
    "hardest", "fastest", "richest", "poorest", "insane", "crazy", "shocking",
}
CONTRARIAN = {
    "but", "however", "actually", "myth", "wrong", "opposite", "contrary",
    "everyone thinks", "most people", "nobody tells", "here's the thing",
    "the truth is", "unpopular", "controversial",
}
EMOTION = {
    "crazy", "insane", "shocking", "terrifying", "brutal", "love", "hate",
    "fear", "afraid", "scared", "regret", "confession", "embarrassing",
    "painful", "devastating", "incredible", "unbelievable", "wild", "nuts",
    "obsessed", "desperate", "furious", "heartbroken",
}
PAYOFF = {
    "because", "so", "which means", "that's why", "the reason", "the point",
    "turns out", "the answer", "the result", "in the end", "bottom line",
    "and that's", "the lesson", "moral", "which is why", "the takeaway",
}
BACKREF = {
    "as i said", "like i said", "like i mentioned", "as i mentioned",
    "earlier", "going back", "as we discussed", "as we said", "before that",
    "coming back", "to that point", "that point i made", "as you said",
}
# Pronouns that, when a clip *opens* on them, signal a dangling reference.
DANGLING_OPENERS = {
    "he", "she", "they", "it", "this", "that", "these", "those", "them",
    "and", "but", "so", "because", "which", "then", "also", "plus",
}

_NUM = re.compile(r"[£$€]\s?\d|\d+\s?%|\b\d[\d,]*\b|\bpercent\b|\bthousand\b|\bmillion\b|\bbillion\b")
_SENT_SPLIT = re.compile(r"(?<=[.!?])\s+")


# ---------------------------------------------------------------------------
# 3. Candidate windows
# ---------------------------------------------------------------------------

@dataclass
class Candidate:
    start: float
    end: float
    duration: float
    score: float
    opening_line: str
    quotable_line: str
    closing_line: str
    text: str = ""
    features: dict = field(default_factory=dict)


def _windows(cues: List[Cue], min_s: float, max_s: float, stride: int):
    """Yield (i, j) inclusive cue-index windows whose span is in [min_s, max_s]."""
    n = len(cues)
    for i in range(0, n, stride):
        j = i
        while j < n and (cues[j].end - cues[i].start) < min_s:
            j += 1
        while j < n and (cues[j].end - cues[i].start) <= max_s:
            yield (i, j)
            j += 1


def _duration_fit(dur: float, min_s: float, max_s: float) -> float:
    """Bell curve peaking at the sweet-spot band, 0..1."""
    peak = min(45.0, max(22.0, (min_s + max_s) / 2.4))
    sigma = 13.0
    return math.exp(-((dur - peak) ** 2) / (2 * sigma * sigma))


def _lex_hits(text: str, lex) -> int:
    low = text.lower()
    return sum(1 for w in lex if w in low)


def _score_window(cues: List[Cue], i: int, j: int,
                  min_s: float, max_s: float) -> Candidate:
    seg = cues[i:j + 1]
    text = " ".join(c.text for c in seg).strip()
    dur = seg[-1].end - seg[0].start
    sents = [s for s in _SENT_SPLIT.split(text) if s.strip()]
    opening = sents[0] if sents else text
    closing = sents[-1] if sents else text
    words = text.split()
    wc = max(1, len(words))

    # --- feature signals, each normalised to ~0..1 ---
    open_low = opening.lower()
    first_word = re.sub(r"[^a-z']", "", (words[0].lower() if words else ""))

    hook = 0.0
    hook += min(1.0, _lex_hits(opening, HOOK_WORDS) * 0.34)
    if opening.strip().endswith("?") or open_low.split(" ")[0] in {
            "why", "how", "what", "when", "who", "do", "does", "is", "are", "can"}:
        hook += 0.30
    if _NUM.search(opening):
        hook += 0.22
    if re.search(r"\byou\b|\byour\b", open_low):
        hook += 0.14
    hook = min(1.0, hook)

    payoff = min(1.0, _lex_hits(" ".join(sents[-2:]), PAYOFF) * 0.4)
    if _NUM.search(closing):
        payoff += 0.2
    payoff = min(1.0, payoff)

    specificity = min(1.0, len(_NUM.findall(text)) / 4.0)
    emotion = min(1.0, _lex_hits(text, EMOTION) * 0.3)
    contrarian = min(1.0, _lex_hits(text, CONTRARIAN) * 0.35)

    # self-containment: penalise backward references, most heavily at the open.
    backref = _lex_hits(text, BACKREF)
    dangle = 1 if first_word in DANGLING_OPENERS else 0
    containment = max(0.0, 1.0 - 0.25 * backref - 0.5 * dangle)

    # quotability: a short, punchy sentence carrying a strong marker.
    quotable_line, quot = _best_quote(sents)

    fit = _duration_fit(dur, min_s, max_s)

    # density penalty: rambling, marker-free windows read flat.
    density = min(1.0, (len(_NUM.findall(text)) + _lex_hits(text, EMOTION)
                        + _lex_hits(text, HOOK_WORDS)) / (wc / 22.0 + 1e-6) / 3.0)

    weights = {
        "hook": 26, "payoff": 15, "quotable": 14, "specificity": 12,
        "emotion": 10, "contrarian": 8, "containment": 9, "fit": 6,
    }
    raw = (
        weights["hook"] * hook
        + weights["payoff"] * payoff
        + weights["quotable"] * quot
        + weights["specificity"] * specificity
        + weights["emotion"] * emotion
        + weights["contrarian"] * contrarian
        + weights["containment"] * containment
        + weights["fit"] * fit
    )
    raw *= (0.6 + 0.4 * density)          # flat windows get damped
    score = round(min(100.0, raw), 1)

    return Candidate(
        start=round(seg[0].start, 2),
        end=round(seg[-1].end, 2),
        duration=round(dur, 2),
        score=score,
        opening_line=opening.strip(),
        quotable_line=quotable_line.strip(),
        closing_line=closing.strip(),
        text=text,
        features={
            "hook": round(hook, 2), "payoff": round(payoff, 2),
            "quotable": round(quot, 2), "specificity": round(specificity, 2),
            "emotion": round(emotion, 2), "contrarian": round(contrarian, 2),
            "containment": round(containment, 2), "duration_fit": round(fit, 2),
            "density": round(density, 2), "word_count": wc,
        },
    )


def _best_quote(sents: List[str]):
    """Pick the most 'overlay-able' sentence: short, punchy, marker-bearing."""
    best, best_val = "", 0.0
    for s in sents:
        w = s.split()
        if not (3 <= len(w) <= 16):
            continue
        val = 0.0
        val += _lex_hits(s, HOOK_WORDS) * 0.3
        val += _lex_hits(s, EMOTION) * 0.3
        val += _lex_hits(s, CONTRARIAN) * 0.25
        if _NUM.search(s):
            val += 0.3
        val += max(0.0, (12 - abs(len(w) - 8)) / 12.0) * 0.4   # ~8-word ideal
        if val > best_val:
            best, best_val = s, val
    return (best or (sents[0] if sents else "")), min(1.0, best_val)


def _dedupe(cands: List[Candidate], top: int) -> List[Candidate]:
    """Greedy: keep highest-scoring windows that don't overlap already-kept ones."""
    kept: List[Candidate] = []
    for c in sorted(cands, key=lambda x: x.score, reverse=True):
        if all(c.end <= k.start or c.start >= k.end for k in kept):
            kept.append(c)
        if len(kept) >= top:
            break
    return sorted(kept, key=lambda x: x.start)


# ---------------------------------------------------------------------------
# 4. Public API
# ---------------------------------------------------------------------------

def select(raw: str, top: int = 5, min_s: float = 18.0, max_s: float = 60.0,
           stride: int = 1, keep_text: bool = False) -> List[dict]:
    cues = parse_transcript(raw)
    if not cues:
        return []
    scored = [_score_window(cues, i, j, min_s, max_s)
              for (i, j) in _windows(cues, min_s, max_s, stride)]
    if not scored:
        return []
    best = _dedupe(scored, top)
    # Present strongest-first so consumers lead with the best clip; rank == strength.
    best = sorted(best, key=lambda x: x.score, reverse=True)
    out = []
    for rank, c in enumerate(best, 1):
        d = asdict(c)
        d["rank"] = rank
        d["timecode"] = f"{_hms(c.start)} - {_hms(c.end)}"
        if not keep_text:
            d.pop("text", None)
        out.append(d)
    return out


def _hms(sec: float) -> str:
    sec = int(round(sec))
    return f"{sec // 3600:02d}:{(sec % 3600) // 60:02d}:{sec % 60:02d}"


# ---------------------------------------------------------------------------
# 5. Self-test (offline, no keys, no network)
# ---------------------------------------------------------------------------

SAMPLE_VTT = """WEBVTT

00:00:00.000 --> 00:00:05.000
HOST: So tell me about the early days, what was that like for you.

00:00:05.000 --> 00:00:09.500
GUEST: Yeah it was fine, we just kind of figured it out as we went along really.

00:00:30.000 --> 00:00:34.000
GUEST: Here's the biggest mistake I see people make with money.

00:00:34.000 --> 00:00:39.000
They save what's left after spending, and there's never anything left.

00:00:39.000 --> 00:00:44.000
The people who actually get rich do the exact opposite. They spend what's left after saving.

00:00:44.000 --> 00:00:49.000
I put 20 percent away the day I get paid, before I can touch it.

00:00:49.000 --> 00:00:54.000
That one switch turned 200 pounds a month into 40,000 pounds in eight years.

00:00:54.000 --> 00:00:58.000
And that's why the reason most people stay broke has nothing to do with income.

00:01:10.000 --> 00:01:15.000
HOST: Right, and going back to what we said earlier about budgeting apps.

00:01:15.000 --> 00:01:19.000
GUEST: They can help but honestly most people just need the one habit.
"""


def _selftest() -> int:
    print("== parse ==")
    cues = parse_transcript(SAMPLE_VTT)
    assert len(cues) >= 8, f"expected >=8 cues, got {len(cues)}"
    assert cues[0].start == 0.0
    assert "HOST:" not in cues[0].text, "speaker label should be stripped"
    print(f"  parsed {len(cues)} cues OK")

    # SRT + inline stamped parse to the same content.
    srt = ("1\n00:00:30,000 --> 00:00:34,000\n"
           "Here's the biggest mistake I see people make with money.\n")
    assert parse_transcript(srt)[0].text.startswith("Here's the biggest")
    inline = "[00:00:30] Here's the biggest mistake I see people make with money.\n" \
             "[00:00:34] They save what's left after spending.\n"
    ic = parse_transcript(inline)
    assert len(ic) == 2 and ic[0].start == 30.0
    print("  SRT + inline-stamp parse OK")

    print("== select ==")
    res = select(SAMPLE_VTT, top=3, min_s=15, max_s=55, keep_text=True)
    assert res, "expected at least one candidate"
    top = res[0]
    # The money-mistake stretch (~30s-58s) must beat the vague small-talk open.
    assert top["start"] >= 29.0, f"top clip started too early: {top}"
    assert top["score"] > 30, f"top score unexpectedly low: {top['score']}"
    assert "mistake" in top["text"].lower() or "opposite" in top["text"].lower()
    # non-overlap
    for a, b in zip(res, res[1:]):
        assert a["end"] <= b["start"] or b["end"] <= a["start"], "overlap!"
    print(f"  top clip {top['timecode']}  score={top['score']}")
    print(f"    hook: {top['opening_line']!r}")
    print(f"    quote: {top['quotable_line']!r}")
    print(f"    features: {top['features']}")

    print("== edge cases ==")
    assert select("", top=3) == []
    assert select("no timestamps here at all, just prose", top=3) == []
    print("  empty / unstamped input handled OK")

    print("\nALL SELF-TESTS PASSED")
    return 0


# ---------------------------------------------------------------------------
# 6. CLI
# ---------------------------------------------------------------------------

def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Shortlist clip-worthy moments from a timestamped transcript.")
    p.add_argument("--file", help="path to a .vtt / .srt / line-stamped transcript")
    p.add_argument("--top", type=int, default=5, help="max non-overlapping candidates (default 5)")
    p.add_argument("--min", type=float, default=18.0, help="min clip seconds (default 18)")
    p.add_argument("--max", type=float, default=60.0, help="max clip seconds (default 60)")
    p.add_argument("--stride", type=int, default=1, help="cue stride for window starts (default 1)")
    p.add_argument("--text", action="store_true", help="include full window text in output")
    p.add_argument("--selftest", action="store_true", help="run offline self-test and exit")
    args = p.parse_args(argv)

    if args.selftest:
        return _selftest()

    if not args.file:
        p.error("provide --file PATH or --selftest")
    if not os.path.exists(args.file):
        p.error(f"no such file: {args.file}")
    with open(args.file, "r", encoding="utf-8", errors="replace") as fh:
        raw = fh.read()

    res = select(raw, top=args.top, min_s=args.min, max_s=args.max,
                 stride=args.stride, keep_text=args.text)
    json.dump({"clips": res, "count": len(res)}, sys.stdout, indent=2, ensure_ascii=False)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
