"""ffmpeg editor: normalize -> (mux narration over motion) -> concat -> burn captions.
All clips become 1080x1920 / 30fps / yuv420p / stereo aac so concat is seamless."""
from __future__ import annotations
import os, subprocess, json, textwrap

W, H, FPS = 1080, 1920, 30
VF = (f"scale={W}:{H}:force_original_aspect_ratio=decrease,"
      f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps={FPS},format=yuv420p")

def _run(cmd):
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode != 0:
        raise RuntimeError("ffmpeg failed:\n" + " ".join(cmd) + "\n" + p.stderr.decode()[-1500:])
    return p

def probe_duration(path: str) -> float:
    out = subprocess.run(["ffprobe","-v","error","-show_entries","format=duration",
                          "-of","json",path], stdout=subprocess.PIPE).stdout
    try: return float(json.loads(out)["format"]["duration"])
    except Exception: return 0.0

def has_audio(path: str) -> bool:
    out = subprocess.run(["ffprobe","-v","error","-select_streams","a","-show_entries",
                          "stream=index","-of","csv=p=0",path], stdout=subprocess.PIPE).stdout
    return bool(out.strip())

def normalize_clip(video: str, out: str, narration: str | None = None) -> float:
    """Return final clip duration. If narration given, lay it over the (silent) motion
    video and freeze the last frame / pad audio so nothing is cut."""
    if narration and os.path.exists(narration):
        vdur, adur = probe_duration(video), probe_duration(narration)
        target = max(vdur, adur, 0.5)
        vpad = max(0.0, target - vdur)
        cmd = ["ffmpeg","-y","-i",video,"-i",narration,
               "-filter_complex",
               f"[0:v]{VF},tpad=stop_mode=clone:stop_duration={vpad:.3f}[v];"
               f"[1:a]apad=whole_dur={target:.3f},aformat=channel_layouts=stereo[a]",
               "-map","[v]","-map","[a]","-t",f"{target:.3f}",
               "-c:v","libx264","-preset","veryfast","-crf","20","-c:a","aac","-b:a","128k",out]
        _run(cmd); return target
    # to-camera (keep own lip-sync audio) or silent motion with no narration
    if has_audio(video):
        cmd = ["ffmpeg","-y","-i",video,"-vf",VF,
               "-c:v","libx264","-preset","veryfast","-crf","20",
               "-c:a","aac","-b:a","128k","-ar","44100",out]
    else:
        cmd = ["ffmpeg","-y","-i",video,"-f","lavfi","-i","anullsrc=cl=stereo:r=44100",
               "-vf",VF,"-shortest","-c:v","libx264","-preset","veryfast","-crf","20",
               "-c:a","aac","-b:a","128k",out]
    _run(cmd); return probe_duration(out)

def _ts(t: float) -> str:
    h=int(t//3600); m=int((t%3600)//60); s=int(t%60); ms=int((t-int(t))*1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

def build_srt(segments: list[tuple[float,float,str]], path: str):
    lines=[]
    for i,(a,b,txt) in enumerate(segments,1):
        wrapped="\n".join(textwrap.wrap(txt.strip(), width=20)[:2]) or " "
        lines.append(f"{i}\n{_ts(a)} --> {_ts(b)}\n{wrapped}\n")
    open(path,"w").write("\n".join(lines))

def concat(norm_paths: list[str], out: str):
    lst=out+".txt"
    open(lst,"w").write("".join(f"file '{os.path.abspath(p)}'\n" for p in norm_paths))
    _run(["ffmpeg","-y","-f","concat","-safe","0","-i",lst,"-c","copy",out])
    os.remove(lst)

def burn_captions(video: str, srt: str, out: str):
    style=("FontName=DejaVu Sans,Fontsize=8,Bold=1,PrimaryColour=&H00FFFFFF,"
           "OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=0,Alignment=2,MarginV=90")
    _run(["ffmpeg","-y","-i",video,"-vf",f"subtitles={srt}:force_style='{style}'",
          "-c:v","libx264","-preset","veryfast","-crf","20","-c:a","copy",out])

def stitch(shots, out_path: str, work_dir: str) -> str:
    """shots: objects with .clip_path, .audio_path, .kind, .vo. Returns final mp4 path."""
    os.makedirs(work_dir, exist_ok=True)
    norm=[]; segs=[]; t=0.0
    for s in shots:
        if not s.clip_path or not os.path.exists(s.clip_path):
            raise RuntimeError(f"shot {s.id}: missing clip")
        np_=os.path.join(work_dir,f"norm_{s.id}.mp4")
        # Every shot's clip already carries its audio (Hedra bakes the voice in),
        # so we normalise and keep the clip's own track — no re-muxing.
        dur=normalize_clip(s.clip_path, np_, None)
        norm.append(np_)
        if s.vo.strip(): segs.append((t, t+dur, s.vo))
        t+=dur
    joined=os.path.join(work_dir,"_joined.mp4")
    concat(norm, joined)
    srt=os.path.join(work_dir,"_caps.srt"); build_srt(segs, srt)
    burn_captions(joined, srt, out_path)
    return out_path
