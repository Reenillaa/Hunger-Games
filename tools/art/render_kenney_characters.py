"""
Walk-cycle spritesheets from Kenney's Mini Characters (CC0, DECISIONS I-69): each role uses a
real rigged model and its own `idle` and `walk` animations, rendered in the 8 isometric
directions with the game's camera. Same sheet format as render_characters.py.

  python tools/art/render_kenney_characters.py [--only miner,warden] [--samples 24]
"""
from __future__ import annotations

import argparse
import json
import math
import pathlib
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib import scene as S  # noqa: E402
from render_characters import DIRECTIONS, FRAME_H, FRAME_W, OUT, ROOT, SCALE, WALK_FRAMES, direction_rotation  # noqa: E402

KIT = ROOT / "assets/models/kenney_mini-characters/glb"
ROLES = {
    "miner": ("character-worker", 0.95),
    "worker": ("character-male-b", 0.95),
    "woman": ("character-female-a", 0.92),
    "woman_b": ("character-female-c", 0.92),
    "child": ("character-male-d", 0.7),
    "elder": ("character-male-g", 0.9),
    "warden": ("character-soldier", 1.0),
    "contestant": ("character-male-e", 0.95),
    "contestant_f": ("character-female-d", 0.92),
}


def _action(name: str):
    for a in bpy.data.actions:
        if a.name == name or a.name.endswith(f"|{name}") or a.name.startswith(f"{name}"):
            return a
    return None


def _assign(arm, act) -> None:
    ad = arm.animation_data or arm.animation_data_create()
    ad.action = act
    if hasattr(ad, "action_slot") and getattr(act, "slots", None):
        ad.action_slot = act.slots[0]


def render_role(role: str, samples: int) -> dict:
    from PIL import Image

    model, height = ROLES[role]
    scene = S.reset(samples)
    S.add_sun(scene)
    before = set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(KIT / f"{model}.glb"))
    new = [o for o in scene.objects if o not in before]
    arm = next(o for o in new if o.type == "ARMATURE")
    pivot = bpy.data.objects.new("Pivot", None)
    scene.collection.objects.link(pivot)
    for o in new:
        if o.parent is None:
            o.parent = pivot
    idle, walk = _action("idle"), _action("walk")
    _assign(arm, idle or walk)
    scene.frame_set(1)
    bpy.context.view_layer.update()
    zs = [(o.matrix_world @ Vector(c)).z for o in new if o.type == "MESH" for c in o.bound_box]
    # Skinned meshes report their rest bounds at half the posed size: measured, then doubled.
    k = 1.9 * height / max(1e-6, max(zs) - min(zs))
    pivot.scale = (k, k, k)
    for o in new:
        if o.type == "MESH":
            for slot in o.material_slots:
                mat = slot.material
                if mat and mat.node_tree and "Principled BSDF" in mat.node_tree.nodes:
                    b = mat.node_tree.nodes["Principled BSDF"]
                    b.inputs["Roughness"].default_value = 0.85
                    if "Specular IOR Level" in b.inputs:
                        b.inputs["Specular IOR Level"].default_value = 0.25
    cam = S.add_iso_camera(scene, Vector((0, 0, 0)), FRAME_W, FRAME_H, SCALE)
    cam.data.shift_y = (FRAME_H * 0.4) / max(FRAME_W, FRAME_H)
    scene.render.resolution_x, scene.render.resolution_y = FRAME_W, FRAME_H
    holdout = S.shadow_catcher(4)
    holdout.is_shadow_catcher, holdout.is_holdout = False, True
    tmp = ROOT / "assets/build/kchar_tmp.png"
    sheet = Image.new("RGBA", (FRAME_W * (WALK_FRAMES + 1), FRAME_H * len(DIRECTIONS)), (0, 0, 0, 0))
    w0, w1 = (int(walk.frame_range[0]), int(walk.frame_range[1])) if walk else (1, 1)
    for d, _ in enumerate(DIRECTIONS):
        pivot.rotation_euler = (0, 0, direction_rotation(d))
        for f in range(WALK_FRAMES + 1):
            if f == 0:
                _assign(arm, idle or walk)
                scene.frame_set(1)
            else:
                _assign(arm, walk)
                scene.frame_set(w0 + round((f - 1) / WALK_FRAMES * (w1 - w0)))
            bpy.context.view_layer.update()
            scene.render.filepath = str(tmp)
            bpy.ops.render.render(write_still=True)
            sheet.alpha_composite(Image.open(tmp).convert("RGBA"), (f * FRAME_W, d * FRAME_H))
    sheet.save(OUT / f"{role}.png", optimize=True)
    ax, ay = S.anchor_px(scene, cam, Vector((0, 0, 0)))
    return {"name": role, "frameWidth": FRAME_W, "frameHeight": FRAME_H, "anchor": [round(ax, 1), round(ay, 1)],
            "scale": SCALE, "directions": DIRECTIONS, "walkFrames": WALK_FRAMES}


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", default="")
    parser.add_argument("--samples", type=int, default=24)
    args = parser.parse_args(argv)
    (ROOT / "assets/build").mkdir(parents=True, exist_ok=True)
    path = OUT / "manifest.json"
    manifest = json.loads(path.read_text()) if path.exists() else {"characters": {}}
    for role in [r for r in args.only.split(",") if r] or list(ROLES):
        manifest["characters"][role] = render_role(role, args.samples)
        path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf8")
        print(role, "ok", flush=True)


if __name__ == "__main__":
    main()
