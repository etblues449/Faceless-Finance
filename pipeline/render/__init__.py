from .base import Shot, ShotPlan, RenderEngine, RenderError

def get_engine(name: str, cfg):
    name = (name or "hedra").lower()
    if name == "hedra":
        from .hedra import HedraEngine
        return HedraEngine(cfg)
    if name == "higgsfield":
        from .higgsfield import HiggsfieldEngine
        return HiggsfieldEngine(cfg)
    raise RenderError(f"unknown render engine: {name}")
