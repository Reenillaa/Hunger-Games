"""
Renders the backdrop of Áurea (the capital) for the preparation week: a monumental colonnade,
regime banners, a giant screen and tiers of an extravagant audience. Perspective camera.

  python tools/art/render_capital.py [--samples 48]   ->  public/assets/capital/backdrop.jpg
"""

from __future__ import annotations

import argparse
import math
import pathlib
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib import kit as K  # noqa: E402
from lib import materials as M  # noqa: E402
from lib import scene as S  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[2]


def marble_floor() -> bpy.types.Material:
    mat = bpy.data.materials.new("MarbleFloor")
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes["Principled BSDF"]
    tiles = nodes.new("ShaderNodeTexBrick")
    tiles.inputs["Color1"].default_value = S.hex_rgba("#EFE9DC")
    tiles.inputs["Color2"].default_value = S.hex_rgba("#D9D0BE")
    tiles.inputs["Mortar"].default_value = S.hex_rgba("#B08A3A")
    tiles.inputs["Scale"].default_value = 0.35
    tiles.inputs["Mortar Size"].default_value = 0.01
    tiles.offset = 0.0
    veins = nodes.new("ShaderNodeTexNoise")
    veins.inputs["Scale"].default_value = 3.0
    veins.inputs["Detail"].default_value = 8
    mix = nodes.new("ShaderNodeMix")
    mix.data_type, mix.blend_type = "RGBA", "MULTIPLY"
    mix.inputs["Factor"].default_value = 0.18
    links.new(tiles.outputs["Color"], mix.inputs["A"])
    links.new(veins.outputs["Color"], mix.inputs["B"])
    links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.12
    return mat


def build(samples: int) -> None:
    scene = S.reset(samples)
    scene.render.film_transparent = False
    world = scene.world.node_tree.nodes["Background"]
    world.inputs["Color"].default_value = S.hex_rgba("#1F2A44")
    world.inputs["Strength"].default_value = 0.35
    ivory = M.flat("Ivory", "#EFE9DC", roughness=0.35)
    gold = M.flat("Gold", "#C9A44C", roughness=0.25, metallic=1.0)
    red = M.flat("Banner", "#9C1C2B", roughness=0.8)
    glass = M.flat("Windows", "#0E1424", roughness=0.1, emission="#CFE2FF", strength=2.5)
    screen = M.flat("Screen", "#0B1020", roughness=0.2, emission="#6FA0FF", strength=1.8)

    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, 0))
    bpy.context.active_object.data.materials.append(marble_floor())

    # Grand staircase up to the palace.
    for i in range(10):
        K.box((26 - i * 0.4, 1.2, 0.3), (0, 22 + i * 1.2, 0.15 + i * 0.3), ivory)
    # Palace facade with tall lit windows.
    K.box((60, 6, 28), (0, 40, 14), ivory)
    for k in range(-11, 12):
        K.box((1.6, 0.3, 9), (k * 2.6, 36.9, 12), glass)
        K.box((1.8, 0.4, 0.4), (k * 2.6, 36.8, 16.8), gold)
    K.box((62, 7, 1.2), (0, 40, 28.6), gold)
    # Giant screen with the regime's emblem.
    K.box((16, 0.5, 9), (0, 36.5, 20), screen)
    K.cylinder(3.2, 0.3, (0, 36.1, 20.5), gold, rot=(math.radians(90), 0, 0), verts=48)
    K.cylinder(2.6, 0.32, (0, 36.0, 20.5), screen, rot=(math.radians(90), 0, 0), verts=48)
    K.box((0.6, 0.34, 5.2), (0, 35.95, 20.5), gold)

    # Colonnades on both sides with banners between the columns.
    for side in (-1, 1):
        for k in range(9):
            x = side * (11 + k * 0.4)
            y = 4 + k * 3.6
            K.cylinder(0.75, 14, (x, y, 7), ivory, verts=24)
            K.cylinder(0.95, 0.6, (x, y, 0.3), gold, verts=24)
            K.cylinder(1.0, 0.8, (x, y, 14.2), gold, verts=24)
            if k % 2 == 0:
                K.box((0.08, 2.2, 8), (x - side * 0.9, y + 1.8, 9), red)
                K.cylinder(0.55, 0.1, (x - side * 0.96, y + 1.8, 11), gold, rot=(0, math.radians(90), 0), verts=24)
        K.box((1.2, 36, 1.2), (side * 12.5, 18, 14.8), gold)
        # Audience tiers: an extravagant crowd in impossible colours.
        colours = ["#E04A8C", "#3FD1C4", "#F2C14E", "#9B5DE5", "#F15BB5", "#00BBF9", "#FEE440", "#FF8C42"]
        mats = [M.flat(f"Crowd{i}", c, roughness=0.5) for i, c in enumerate(colours)]
        for tier in range(5):
            K.box((3, 34, 0.6), (side * (17 + tier * 2.2), 18, 0.3 + tier * 1.4), ivory)
            for j in range(26):
                x = side * (17 + tier * 2.2) + (j % 2) * 0.6 - 0.3
                y = 2.5 + j * 1.25
                body = K.cylinder(0.32, 1.1, (x, y, 1.15 + tier * 1.4), mats[(j * 3 + tier) % len(mats)], verts=10)
                head = K.cylinder(0.22, 0.38, (x, y, 1.95 + tier * 1.4), mats[(j + tier * 5) % len(mats)], verts=10)
                body.scale.x = head.scale.x = 1.0

    # Light: cold key from above, warm spotlights on the stairs.
    sun = S.add_sun(scene, energy=2.4)
    sun.data.color = (0.85, 0.9, 1.0)
    for x in (-6, 6):
        light = bpy.data.lights.new("Spot", type="SPOT")
        light.energy = 9000
        light.spot_size = math.radians(30)
        light.color = (1.0, 0.86, 0.6)
        obj = bpy.data.objects.new("Spot", light)
        obj.location = (x, 6, 22)
        obj.rotation_euler = (Vector((0, 26, 0)) - obj.location).to_track_quat("-Z", "Y").to_euler()
        scene.collection.objects.link(obj)

    cam_data = bpy.data.cameras.new("Cam")
    cam_data.lens = 24
    cam = bpy.data.objects.new("Cam", cam_data)
    cam.location = (0, -14, 3.2)
    cam.rotation_euler = (Vector((0, 34, 12)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.render.resolution_x, scene.render.resolution_y = 1920, 1080

    # Bloom is applied in the game (Phaser 4 filter), not baked here.
    out = ROOT / "assets/build/capital.png"
    scene.render.filepath = str(out)
    bpy.ops.render.render(write_still=True)
    from PIL import Image

    target = ROOT / "public/assets/capital"
    target.mkdir(parents=True, exist_ok=True)
    Image.open(out).convert("RGB").save(target / "backdrop.jpg", quality=82, optimize=True, progressive=True)
    print("wrote", target / "backdrop.jpg")


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    parser = argparse.ArgumentParser()
    parser.add_argument("--samples", type=int, default=48)
    build(parser.parse_args(argv).samples)
