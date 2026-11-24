"""
Renders animated characters for the district into spritesheets:
8 directions (rows) × [idle + 8 walk frames] (columns), at 2x, plus manifest.json.

  python tools/art/render_characters.py [--only miner] [--samples 24]

Characters are built from articulated primitives (hip, knee, shoulder, elbow pivots) so the walk
cycle is posed per frame without an armature. Height ≈ 0.92 units (≈ 72 px at 1x).
"""

from __future__ import annotations

import argparse
import json
import math
import pathlib
import sys
import time

import bpy
from mathutils import Vector

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib import materials as M  # noqa: E402
from lib import scene as S  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "public/assets/district/characters"
SCALE = 2.0
FRAME_W, FRAME_H = 104, 208
WALK_FRAMES = 8
# Screen directions, clockwise from "towards the viewer" (S). Angle in screen space, y down.
DIRECTIONS = ["s", "sw", "w", "nw", "n", "ne", "e", "se"]


def direction_rotation(index: int) -> float:
    """Model Z rotation so its forward (-Y local) points along screen direction `index`."""
    a = math.pi / 2 + index * math.pi / 4  # s = down (+y screen), then clockwise via west
    sx, sy = math.cos(a), math.sin(a)
    x = (sx / 64 + sy / 32) / 2
    y = (sx / 64 - sy / 32) / 2
    return math.atan2(x, -y)


class Rig:
    """Articulated figure: empties as joints, primitives parented to them."""

    def __init__(self, scale: float = 1.0):
        self.s = scale
        self.root = self._empty("Root", (0, 0, 0), None)
        self.body = self._empty("Body", (0, 0, 0), self.root)
        self.joints: dict[str, bpy.types.Object] = {}

    def _empty(self, name, loc, parent):
        e = bpy.data.objects.new(name, None)
        bpy.context.scene.collection.objects.link(e)
        e.location = loc
        if parent is not None:
            e.parent = parent
        return e

    def joint(self, name: str, loc, parent: bpy.types.Object | None = None) -> bpy.types.Object:
        j = self._empty(name, tuple(c * self.s for c in loc), parent or self.body)
        self.joints[name] = j
        return j

    def part(self, kind: str, size, loc, mat, parent, rot=(0.0, 0.0, 0.0), verts: int = 12):
        s = self.s
        if kind == "cyl":
            r1, r2, depth = size
            bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1 * s, radius2=r2 * s, depth=depth * s)
        elif kind == "sphere":
            bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=size[0] * s)
        else:
            bpy.ops.mesh.primitive_cube_add(size=1)
        obj = bpy.context.active_object
        if kind == "box":
            obj.scale = tuple(c * s for c in size)
        elif kind == "sphere" and len(size) > 1:
            obj.scale = (1, size[1], size[2])
        obj.parent = parent
        obj.location = tuple(c * s for c in loc)
        obj.rotation_euler = rot
        obj.data.materials.append(mat)
        if kind != "box":
            bpy.ops.object.shade_smooth()
        return obj


def build_character(spec: dict) -> Rig:
    m = M.district_materials()
    skin = M.flat(f"Skin{spec['skin']}", spec["skin"], roughness=0.6)
    top = M.flat(f"Top{spec['top']}", spec["top"], roughness=0.92)
    bottom = M.flat(f"Bottom{spec['bottom']}", spec["bottom"], roughness=0.92)
    boots = M.flat("Boots", "#1E1B19", roughness=0.7)
    hair = M.flat(f"Hair{spec['hair']}", spec["hair"], roughness=0.8)
    rig = Rig(spec.get("scale", 1.0))
    hip_z = 0.44
    # Legs: thigh pivot at hip, shin pivot at knee.
    for side, x in (("L", -0.055), ("R", 0.055)):
        hip = rig.joint(f"Hip{side}", (x, 0, hip_z))
        rig.part("cyl", (0.05, 0.042, 0.22), (0, 0, -0.11), bottom, hip)
        knee = rig.joint(f"Knee{side}", (0, 0, -0.22), hip)
        rig.part("cyl", (0.04, 0.034, 0.2), (0, 0, -0.1), bottom if not spec.get("skirt") else M.flat("Stockings", "#2A2626", roughness=0.9), knee)
        rig.part("box", (0.07, 0.11, 0.045), (0, -0.025, -0.205), boots, knee)
    # Torso and pelvis.
    rig.part("cyl", (0.115, 0.1, 0.12), (0, 0, hip_z + 0.02), bottom, rig.body)
    rig.part("cyl", (0.1, 0.13, 0.3), (0, 0, hip_z + 0.2), top, rig.body)
    if spec.get("skirt"):
        rig.part("cyl", (0.17, 0.1, 0.36), (0, 0, hip_z - 0.1), bottom, rig.body, verts=16)
    if spec.get("coat"):
        rig.part("cyl", (0.15, 0.135, 0.42), (0, 0.005, hip_z + 0.12), top, rig.body, verts=14)
    neck_z = hip_z + 0.36
    rig.part("cyl", (0.035, 0.035, 0.05), (0, 0, neck_z), skin, rig.body)
    head = rig.joint("Head", (0, 0, neck_z + 0.09))
    rig.part("sphere", (0.075, 0.95, 1.12), (0, 0, 0), skin, head)
    hat = spec.get("hat", "hair")
    if hat == "helmet":
        rig.part("sphere", (0.088, 1.0, 0.6), (0, 0.005, 0.045), M.flat("Helmet", "#8A7B4E", roughness=0.45), head)
        rig.part("cyl", (0.1, 0.1, 0.015), (0, 0, 0.025), M.flat("Helmet", "#8A7B4E"), head)
        rig.part("cyl", (0.022, 0.022, 0.03), (0, -0.085, 0.045), m["lamp"], head, rot=(math.radians(90), 0, 0))
    elif hat == "cap":
        rig.part("sphere", (0.08, 1.0, 0.55), (0, 0.005, 0.04), top, head)
        rig.part("box", (0.11, 0.07, 0.012), (0, -0.07, 0.03), top, head)
    elif hat == "scarf":
        rig.part("sphere", (0.083, 1.05, 1.0), (0, 0.012, 0.012), M.flat(f"Scarf{spec['scarf']}", spec["scarf"], roughness=0.95), head)
    elif hat == "warden":
        rig.part("sphere", (0.088, 1.0, 0.65), (0, 0.004, 0.04), M.flat("WardenHelm", "#D9D6CC", roughness=0.35), head)
        rig.part("cyl", (0.093, 0.093, 0.012), (0, 0, 0.012), M.flat("Gold", "#C9A44C", roughness=0.35, metallic=0.9), head)
    else:
        rig.part("sphere", (0.079, 1.0, 0.8), (0, 0.012, 0.03), hair, head)
        if spec.get("bun"):
            rig.part("sphere", (0.035,), (0, 0.07, 0.04), hair, head)
    # Arms: shoulder pivot, elbow pivot.
    for side, x in (("L", -0.14), ("R", 0.14)):
        sh = rig.joint(f"Shoulder{side}", (x, 0, neck_z - 0.04))
        rig.part("cyl", (0.034, 0.03, 0.17), (0, 0, -0.085), top, sh)
        el = rig.joint(f"Elbow{side}", (0, 0, -0.17), sh)
        rig.part("cyl", (0.029, 0.025, 0.15), (0, 0, -0.075), top if spec.get("long_sleeves", True) else skin, el)
        rig.part("sphere", (0.026,), (0, 0, -0.165), skin, el)
    if spec.get("tool") == "pick":
        el = rig.joints["ElbowR"]
        rig.part("cyl", (0.012, 0.012, 0.32), (0, 0.06, -0.12), m["beam"], el, rot=(math.radians(70), 0, 0))
        rig.part("box", (0.03, 0.18, 0.02), (0, 0.18, -0.07), m["iron"], el, rot=(math.radians(-20), 0, 0))
    if spec.get("rifle"):
        sh = rig.joints["ShoulderR"]
        rig.part("cyl", (0.012, 0.012, 0.42), (0.02, 0.05, -0.02), m["soot"], sh, rot=(math.radians(-12), 0, 0))
    return rig


def pose(rig: Rig, phase: float, walking: bool) -> None:
    """Walk cycle: legs and arms swing in opposition, knees bend on the passing leg, body bobs."""
    j = rig.joints
    swing = math.radians(26) if walking else 0.0
    arm = math.radians(20) if walking else 0.0
    s = math.sin(phase)
    j["HipL"].rotation_euler = (swing * s, 0, 0)
    j["HipR"].rotation_euler = (-swing * s, 0, 0)
    j["KneeL"].rotation_euler = (-math.radians(32) * max(0.0, -s) if walking else 0.0, 0, 0)
    j["KneeR"].rotation_euler = (-math.radians(32) * max(0.0, s) if walking else 0.0, 0, 0)
    j["ShoulderL"].rotation_euler = (-arm * s, math.radians(-4), 0)
    j["ShoulderR"].rotation_euler = (arm * s, math.radians(4), 0)
    j["ElbowL"].rotation_euler = (math.radians(14 if walking else 6), 0, 0)
    j["ElbowR"].rotation_euler = (math.radians(14 if walking else 6), 0, 0)
    rig.body.location.z = (0.012 * abs(math.cos(phase)) if walking else 0.0) * rig.s


SPECS = {
    "miner": {"skin": "#C49A7A", "top": "#3A3E45", "bottom": "#2B2A2E", "hair": "#2A221C", "hat": "helmet"},
    "worker": {"skin": "#B58463", "top": "#5A4A3A", "bottom": "#3E3B38", "hair": "#3A2A20", "hat": "cap"},
    "woman": {"skin": "#C9A285", "top": "#5C5048", "bottom": "#2E3446", "hair": "#4A3226", "hat": "scarf", "scarf": "#6E2E28", "skirt": True},
    "woman_b": {"skin": "#9C7356", "top": "#6A5A44", "bottom": "#4A3A30", "hair": "#1E1814", "bun": True, "skirt": True},
    "child": {"skin": "#C9A285", "top": "#6E6650", "bottom": "#3A3632", "hair": "#5A3E2A", "hat": "cap", "scale": 0.72},
    "elder": {"skin": "#C49A7A", "top": "#4A4540", "bottom": "#35322F", "hair": "#B8B2A8", "coat": True},
    "warden": {"skin": "#C9A285", "top": "#C8C4B8", "bottom": "#9A968C", "hair": "#2A221C", "hat": "warden", "rifle": True},
    # Arena jumpsuits (identical for every contestant: the regime erases the districts).
    "contestant": {"skin": "#C49A7A", "top": "#4E5A3C", "bottom": "#3C4630", "hair": "#2A221C"},
    "contestant_f": {"skin": "#C9A285", "top": "#4E5A3C", "bottom": "#3C4630", "hair": "#5A3A24", "bun": True},
}


def render_variant(name: str, samples: int) -> dict:
    from PIL import Image

    scene = S.reset(samples)
    S.add_sun(scene)
    M.reset_cache()
    rig = build_character(SPECS[name])
    cam = S.add_iso_camera(scene, Vector((0, 0, 0)), FRAME_W, FRAME_H, SCALE)
    # Feet (world origin) sit near the bottom of the frame: shift the view up.
    cam.data.shift_y = (FRAME_H * 0.4) / max(FRAME_W, FRAME_H)
    scene.render.resolution_x, scene.render.resolution_y = FRAME_W, FRAME_H
    holdout = S.shadow_catcher(4)
    holdout.is_shadow_catcher, holdout.is_holdout = False, True
    tmp = ROOT / "assets/build/char_tmp.png"
    sheet = Image.new("RGBA", (FRAME_W * (WALK_FRAMES + 1), FRAME_H * len(DIRECTIONS)), (0, 0, 0, 0))
    for d, _ in enumerate(DIRECTIONS):
        rig.root.rotation_euler = (0, 0, direction_rotation(d))
        for f in range(WALK_FRAMES + 1):
            walking = f > 0
            pose(rig, (f - 1) / WALK_FRAMES * math.tau if walking else 0.0, walking)
            bpy.context.view_layer.update()
            scene.render.filepath = str(tmp)
            bpy.ops.render.render(write_still=True)
            sheet.alpha_composite(Image.open(tmp).convert("RGBA"), (f * FRAME_W, d * FRAME_H))
    out = OUT / f"{name}.png"
    sheet.save(out, optimize=True)
    ax, ay = S.anchor_px(scene, cam, Vector((0, 0, 0)))
    return {"name": name, "frameWidth": FRAME_W, "frameHeight": FRAME_H, "anchor": [round(ax, 1), round(ay, 1)],
            "scale": SCALE, "directions": DIRECTIONS, "walkFrames": WALK_FRAMES}


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", default="")
    parser.add_argument("--samples", type=int, default=24)
    args = parser.parse_args(argv)
    OUT.mkdir(parents=True, exist_ok=True)
    (ROOT / "assets/build").mkdir(parents=True, exist_ok=True)
    manifest_path = OUT / "manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {"characters": {}}
    for name in [n for n in args.only.split(",") if n] or list(SPECS):
        t0 = time.time()
        manifest["characters"][name] = render_variant(name, args.samples)
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf8")
        print(f"{name}: {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
