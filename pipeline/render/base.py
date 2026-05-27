"""Render adapter contract. Every engine implements render_to_camera + render_motion
and returns a local path to a 9:16 mp4. Swapping engines never touches the orchestrator."""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional, Protocol


@dataclass
class Shot:
    id: int
    kind: str                 # "to_camera" | "walk" | "broll"
    prompt: str               # cinematic visual description (camera, motion, setting, light)
    vo: str = ""              # voiceover / spoken line
    seconds: int = 6          # target duration; motion shots are clamped to engine max
    audio_path: Optional[str] = None   # filled by the voice step
    clip_path: Optional[str] = None    # filled by the render step


@dataclass
class ShotPlan:
    title: str
    caption: str
    shots: list[Shot] = field(default_factory=list)


class RenderEngine(Protocol):
    name: str
    motion_max_seconds: int

    def render_to_camera(self, shot: Shot, image_url: str) -> str: ...
    def render_motion(self, shot: Shot, image_url: str) -> str: ...


class RenderError(RuntimeError):
    pass
