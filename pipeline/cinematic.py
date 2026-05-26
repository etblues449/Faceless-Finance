#!/usr/bin/env python3
"""Cinematic multi-shot orchestrator: topic -> shot list -> voice -> render -> stitch -> publish.
   python cinematic.py --selftest     # offline, mock renders, real stitch
   python cinematic.py --dry-run       # real script+voice flow, no publish (uses fallback plan)
   python cinematic.py --topic "ISAs"  # full live run
"""
from __future__ import annotations
import os, sys, argparse, datetime, subprocess
sys.path.insert(0, os.path.dirname(__file__))
from config import Config
import shotlist, voice, edit
from render import get_engine
from render.base import Shot

TOPICS = [
 "ISA allowance mistakes before the tax year ends",
 "Pension tax relief most people never claim",
 "Emergency fund: how much a UK household really needs",
 "Salary sacrifice and how it quietly boosts take-home",
 "The real cost of lifestyle creep on a good salary",
 "Capital gains allowance changes you should plan around",
]
def pick_topic() -> str:
    return TOPICS[datetime.date.today().toordinal() % len(TOPICS)]

class MockEngine:
    """Offline stand-in: makes real (tiny) clips so the editor runs for real in selftest."""
    name="mock"; motion_max_seconds=8
    def __init__(self,cfg): self.cfg=cfg
    def _make(self, shot, color, tone):
        out=os.path.join(self.cfg.out_dir,f"shot_{shot.id}_mock.mp4")
        secs=min(shot.seconds,6)
        cmd=["ffmpeg","-y","-f","lavfi","-i",f"color=c={color}:s=608x1080:d={secs}:r=30"]
        if tone: cmd+=["-f","lavfi","-i",f"sine=frequency=300:duration={secs}"]
        cmd+=["-vf","format=yuv420p","-c:v","libx264","-preset","ultrafast"]
        if tone: cmd+=["-c:a","aac","-shortest"]
        cmd+=[out]
        subprocess.run(cmd,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=True)
        return out
    def render_to_camera(self,shot,image_url): return self._make(shot,"navy",True)
    def render_motion(self,shot,image_url):     return self._make(shot,"teal",False)

def run(cfg: Config, topic=None, dry_run=False, selftest=False) -> str:
    os.makedirs(cfg.out_dir, exist_ok=True)
    topic = topic or pick_topic()
    print(f"[1/5] topic: {topic}")

    if selftest or dry_run:
        plan = shotlist.fallback_plan(topic)
    else:
        try: plan = shotlist.generate(topic, cfg)
        except Exception as e:
            print(f"  shotlist via Claude failed ({e}); using fallback"); plan = shotlist.fallback_plan(topic)
    print(f"[2/5] plan: '{plan.title}' - {len(plan.shots)} shots: {[s.kind for s in plan.shots]}")

    if selftest:
        tc = mo = MockEngine(cfg)
    else:
        tc = get_engine(cfg.engine_to_camera, cfg)
        mo = get_engine(cfg.engine_motion, cfg)

    presenter = cfg.presenter_url; fullbody = cfg.fullbody_url or cfg.presenter_url
    for s in plan.shots:
        if s.vo.strip():
            ap=os.path.join(cfg.out_dir,f"vo_{s.id}.mp3")
            s.audio_path = voice.silent(min(s.seconds,6), ap) if selftest else voice.tts(s.vo, cfg, ap)
        if s.kind=="to_camera":
            s.clip_path = tc.render_to_camera(s, presenter)
        else:
            s.clip_path = mo.render_motion(s, fullbody)
        print(f"  shot {s.id} [{s.kind}] -> {os.path.basename(s.clip_path)}")
    print("[3/5] all shots rendered")

    final=os.path.join(cfg.out_dir, f"final_{datetime.date.today():%Y%m%d}.mp4")
    edit.stitch(plan.shots, final, os.path.join(cfg.out_dir,"work"))
    print(f"[4/5] stitched -> {final}")

    if selftest or dry_run or not cfg.post_enabled:
        print(f"[5/5] publish skipped -> {final}")
    else:
        import publish; print(f"[5/5] {publish.publish(final, plan, cfg)}")
    return final

def _probe(path):
    out=subprocess.run(["ffprobe","-v","error","-select_streams","v","-show_entries",
        "stream=width,height","-of","csv=p=0",path],stdout=subprocess.PIPE).stdout.decode().strip()
    dur=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of",
        "csv=p=0",path],stdout=subprocess.PIPE).stdout.decode().strip()
    return out, dur

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--selftest",action="store_true")
    ap.add_argument("--dry-run",action="store_true")
    ap.add_argument("--topic")
    args=ap.parse_args()
    cfg=Config()
    if args.selftest:
        final=run(cfg, topic="Self test", selftest=True)
        wh,dur=_probe(final); ok = wh=="1080,1920" and float(dur or 0)>0
        print(f"\nSELFTEST {'PASS' if ok else 'FAIL'}: {wh} {dur}s -> {final}")
        sys.exit(0 if ok else 1)
    run(cfg, topic=args.topic, dry_run=args.dry_run)

if __name__=="__main__":
    main()
