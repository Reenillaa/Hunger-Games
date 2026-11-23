"""
Art pipeline spike (TASKS F1-11, DECISIONS D-02).

Builds two procedural test models in Blender (headless, `bpy`), renders them with the
standard isometric camera (orthographic, 45° azimuth, 30° elevation => 2:1 tiles) and writes:
  - <name>.png          colour pass (baked soft shadow via a shadow catcher, transparent bg)
  - <name>_n.png        camera-space normal map (OpenGL convention: +X right, +Y up, +Z viewer)
  - <name>.json         anchor (pixel of the ground origin) and scale metadata

Usage (Python with the `bpy` wheel installed):
  python tools/art/spike_render.py --out assets/build/spike [--samples 48]

Logical grid mapping: cell (cx, cy) <-> Blender world (X = cx, Y = -cy). One cell = 1 unit.
Everything here is PLACEHOLDER geometry to validate the pipeline, not final art.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

# 2x production scale: a tile is 256 px wide, so 1 world unit spans 256/sqrt(2) px horizontally.
PX_PER_UNIT = 256 / math.sqrt(2)
ELEVATION_DEG = 30.0


def hex_rgb(value: str) -> tuple[float, float, float, float]:
    """sRGB hex -> linear RGBA for Blender materials."""
    value = value.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(value[i : i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (out[0], out[1], out[2], 1.0)


# ---------------------------------------------------------------- scene setup

def reset_scene(samples: int) -> bpy.types.Scene:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"
    world = bpy.data.worlds.new("World")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = hex_rgb("#3a4150")
    bg.inputs["Strength"].default_value = 0.55
    scene.world = world
    return scene


def add_camera(scene: bpy.types.Scene, target: Vector, res_x: int, res_y: int) -> bpy.types.Object:
    cam_data = bpy.data.cameras.new("IsoCam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = max(res_x, res_y) / PX_PER_UNIT
    cam = bpy.data.objects.new("IsoCam", cam_data)
    scene.collection.objects.link(cam)
    # Camera sits towards +X/-Y, looking at the target from 30 degrees above the horizon.
    horizontal = 20.0
    height = horizontal * math.tan(math.radians(ELEVATION_DEG))
    offset = Vector((horizontal / math.sqrt(2), -horizontal / math.sqrt(2), height))
    cam.location = target + offset
    cam.rotation_euler = (-offset).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    scene.render.resolution_x = res_x
    scene.render.resolution_y = res_y
    scene.render.resolution_percentage = 100
    return cam


def add_sun(scene: bpy.types.Scene) -> None:
    """Key light from the upper-left of the screen (ART_BIBLE §3): world -X, high."""
    sun_data = bpy.data.lights.new("Sun", type="SUN")
    sun_data.energy = 3.0
    sun_data.angle = math.radians(14)
    sun_data.color = (1.0, 0.95, 0.88)
    sun = bpy.data.objects.new("Sun", sun_data)
    direction = Vector((0.8, 0.2, -1.6)).normalized()  # direction the light travels
    sun.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(sun)


def add_shadow_catcher(scene: bpy.types.Scene, size: float) -> bpy.types.Object:
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, 0))
    plane = bpy.context.active_object
    plane.name = "ShadowCatcher"
    plane.is_shadow_catcher = True
    return plane


# ---------------------------------------------------------------- materials

def material(name: str, color: str, roughness: float = 0.8, noise: float = 0.0,
             bands: float = 0.0, emission: str | None = None, strength: float = 0.0) -> bpy.types.Material:
    """Principled material with optional procedural variation (noise / plank bands)."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = roughness
    base = hex_rgb(color)
    if noise > 0 or bands > 0:
        mix = nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.inputs["A"].default_value = base
        darker = tuple(c * 0.55 for c in base[:3]) + (1.0,)
        mix.inputs["B"].default_value = darker
        if bands > 0:
            tex = nodes.new("ShaderNodeTexWave")
            tex.inputs["Scale"].default_value = bands
            tex.inputs["Distortion"].default_value = 1.5
            factor_out = tex.outputs["Fac"]
        else:
            tex = nodes.new("ShaderNodeTexNoise")
            tex.inputs["Scale"].default_value = noise
            factor_out = tex.outputs["Fac"]
        ramp = nodes.new("ShaderNodeMapRange")
        ramp.inputs["From Min"].default_value = 0.3
        ramp.inputs["From Max"].default_value = 0.9
        links.new(factor_out, ramp.inputs["Value"])
        links.new(ramp.outputs["Result"], mix.inputs["Factor"])
        links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    else:
        bsdf.inputs["Base Color"].default_value = base
    if emission:
        bsdf.inputs["Emission Color"].default_value = hex_rgb(emission)
        bsdf.inputs["Emission Strength"].default_value = strength
    return mat


def normal_override_material() -> bpy.types.Material:
    """Emits camera-space normals mapped to 0..1 (rendered with the Raw view transform)."""
    mat = bpy.data.materials.new("NormalPass")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    for node in list(nodes):
        nodes.remove(node)
    geo = nodes.new("ShaderNodeNewGeometry")
    xform = nodes.new("ShaderNodeVectorTransform")
    xform.vector_type = "NORMAL"
    xform.convert_from = "WORLD"
    xform.convert_to = "CAMERA"
    remap = nodes.new("ShaderNodeVectorMath")
    remap.operation = "MULTIPLY_ADD"
    # Cycles camera space looks down +Z; flip Z so surfaces facing the viewer encode B > 0.5.
    remap.inputs[1].default_value = (0.5, 0.5, -0.5)
    remap.inputs[2].default_value = (0.5, 0.5, 0.5)
    emit = nodes.new("ShaderNodeEmission")
    out = nodes.new("ShaderNodeOutputMaterial")
    links.new(geo.outputs["Normal"], xform.inputs["Vector"])
    links.new(xform.outputs["Vector"], remap.inputs[0])
    links.new(remap.outputs["Vector"], emit.inputs["Color"])
    links.new(emit.outputs["Emission"], out.inputs["Surface"])
    return mat


# ---------------------------------------------------------------- models

def box(name: str, size: tuple[float, float, float], location: tuple[float, float, float],
        mat: bpy.types.Material, bevel: float = 0.0) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel > 0:
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
    obj.data.materials.append(mat)
    return obj


def gable_roof(width: float, depth: float, base_z: float, rise: float, overhang: float,
               mat: bpy.types.Material) -> bpy.types.Object:
    """Ridge along the world X axis."""
    w = width / 2 + overhang
    d = depth / 2 + overhang
    t = 0.06  # thickness
    verts = [
        (-w, -d, base_z), (w, -d, base_z), (w, 0, base_z + rise), (-w, 0, base_z + rise),
        (-w, d, base_z), (w, d, base_z),
        (-w, -d, base_z + t), (w, -d, base_z + t), (w, 0, base_z + rise + t), (-w, 0, base_z + rise + t),
        (-w, d, base_z + t), (w, d, base_z + t),
    ]
    faces = [
        (6, 7, 8, 9), (9, 8, 11, 10),  # top surfaces
        (0, 3, 2, 1), (3, 4, 5, 2),    # undersides
        (0, 1, 7, 6), (4, 10, 11, 5),  # eaves
        (0, 6, 9, 3), (3, 9, 10, 4),   # west edge
        (1, 2, 8, 7), (2, 5, 11, 8),   # east edge
    ]
    mesh = bpy.data.meshes.new("Roof")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new("Roof", mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    for poly in mesh.polygons:
        poly.use_smooth = False
    return obj


def gable_ends(width: float, depth: float, base_z: float, rise: float, mat: bpy.types.Material) -> None:
    w = width / 2
    d = depth / 2
    verts = [(-w, -d, base_z), (-w, d, base_z), (-w, 0, base_z + rise),
             (w, -d, base_z), (w, d, base_z), (w, 0, base_z + rise)]
    mesh = bpy.data.meshes.new("GableEnds")
    mesh.from_pydata(verts, [], [(0, 2, 1), (3, 4, 5)])
    mesh.update()
    obj = bpy.data.objects.new("GableEnds", mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)


def build_miner_house() -> None:
    """2x2-cell miner's house: plank walls, rusty corrugated roof, chimney, lit window."""
    wood = material("Planks", "#6B5443", roughness=0.9, bands=9.0)
    rust = material("RustRoof", "#8E4B2E", roughness=0.7, noise=6.0)
    stone = material("Stone", "#4A4D52", roughness=0.95, noise=12.0)
    soot = material("Soot", "#2B2A2E", roughness=0.9)
    lamp = material("LampWindow", "#2B2A2E", emission="#E8A24A", strength=6.0)

    W, D, H = 1.8, 1.6, 1.15
    box("Foundation", (W + 0.1, D + 0.1, 0.12), (0, 0, 0.06), stone, bevel=0.02)
    box("Walls", (W, D, H), (0, 0, 0.12 + H / 2), wood, bevel=0.015)
    gable_ends(W, D, 0.12 + H, 0.7, wood)
    gable_roof(W, D, 0.12 + H, 0.7, 0.14, rust)
    box("Chimney", (0.26, 0.26, 1.0), (0.55, 0.35, 0.12 + H + 0.45), stone, bevel=0.02)
    box("ChimneyCap", (0.32, 0.32, 0.06), (0.55, 0.35, 0.12 + H + 0.98), soot)
    # Door on the -Y face (front-left on screen), window on the +X face (front-right).
    box("Door", (0.42, 0.04, 0.78), (-0.35, -D / 2 - 0.01, 0.12 + 0.39), soot)
    box("Window", (0.04, 0.42, 0.34), (W / 2 + 0.01, -0.2, 0.12 + 0.68), lamp)
    box("WindowFrame", (0.05, 0.5, 0.06), (W / 2 + 0.02, -0.2, 0.12 + 0.48), wood)
    # A coal sack and crate by the door for scale and silhouette.
    box("Crate", (0.3, 0.3, 0.28), (0.25, -D / 2 - 0.3, 0.14), wood, bevel=0.02)


def cylinder(name: str, radius: float, depth: float, location: tuple[float, float, float],
             mat: bpy.types.Material) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=radius, depth=depth, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return obj


def build_miner(parent_name: str = "Miner") -> bpy.types.Object:
    """Low-poly placeholder miner (~0.92 units tall = ~72 px at 1x)."""
    skin = material("Skin", "#C49A7A", roughness=0.6)
    shirt = material("Shirt", "#3E4552", roughness=0.9, noise=20.0)
    trousers = material("Trousers", "#2B2A2E", roughness=0.9)
    helmet = material("Helmet", "#9A8A5A", roughness=0.5)
    lamp = material("HeadLamp", "#E8A24A", emission="#E8A24A", strength=8.0)

    root = bpy.data.objects.new(parent_name, None)
    bpy.context.scene.collection.objects.link(root)
    parts = [
        cylinder("LegL", 0.055, 0.42, (-0.07, 0, 0.21), trousers),
        cylinder("LegR", 0.055, 0.42, (0.07, 0, 0.21), trousers),
        cylinder("Torso", 0.13, 0.33, (0, 0, 0.58), shirt),
        cylinder("ArmL", 0.042, 0.34, (-0.17, 0, 0.56), shirt),
        cylinder("ArmR", 0.042, 0.34, (0.17, 0, 0.56), shirt),
    ]
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.085, location=(0, 0, 0.83), segments=16, ring_count=8)
    head = bpy.context.active_object
    head.data.materials.append(skin)
    bpy.ops.object.shade_smooth()
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.095, location=(0, 0, 0.87), segments=16, ring_count=8)
    hat = bpy.context.active_object
    hat.scale = (1, 1, 0.6)
    hat.data.materials.append(helmet)
    bpy.ops.object.shade_smooth()
    # Head lamp faces local -Y (the character's front).
    lamp_obj = cylinder("Lamp", 0.025, 0.03, (0, -0.095, 0.88), lamp)
    lamp_obj.rotation_euler = (math.radians(90), 0, 0)
    for obj in [*parts, head, hat, lamp_obj]:
        obj.parent = root
    return root


# ---------------------------------------------------------------- rendering

def anchor_px(scene: bpy.types.Scene, cam: bpy.types.Object, point: Vector) -> tuple[float, float]:
    co = world_to_camera_view(scene, cam, point)
    return (co.x * scene.render.resolution_x, (1 - co.y) * scene.render.resolution_y)


def render_passes(scene: bpy.types.Scene, out_path: str, catcher: bpy.types.Object | None) -> None:
    scene.render.filepath = out_path + ".png"
    bpy.ops.render.render(write_still=True)
    # Normal pass: override every material, hide the shadow catcher, raw output.
    view_layer = scene.view_layers[0]
    view_layer.material_override = normal_override_material()
    if catcher:
        catcher.hide_render = True
    previous_samples = scene.cycles.samples
    scene.cycles.samples = 16
    scene.cycles.use_denoising = False  # denoising would corrupt encoded vectors
    scene.view_settings.view_transform = "Raw"
    scene.render.filepath = out_path + "_n.png"
    bpy.ops.render.render(write_still=True)
    view_layer.material_override = None
    if catcher:
        catcher.hide_render = False
    scene.cycles.samples = previous_samples
    scene.cycles.use_denoising = True
    scene.view_settings.view_transform = "Standard"


def render_house(out_dir: str, samples: int) -> dict:
    scene = reset_scene(samples)
    add_sun(scene)
    catcher = add_shadow_catcher(scene, 8)
    build_miner_house()
    cam = add_camera(scene, Vector((0, 0, 0.75)), 640, 640)
    path = os.path.join(out_dir, "house_miner")
    render_passes(scene, path, catcher)
    ax, ay = anchor_px(scene, cam, Vector((0, 0, 0)))
    meta = {"name": "house_miner", "footprint": [2, 2], "anchor": [round(ax, 2), round(ay, 2)],
            "scale": 2, "size": [640, 640]}
    with open(path + ".json", "w", encoding="utf8") as fh:
        json.dump(meta, fh, indent=2)
    return meta


DIRECTIONS = ["s", "sw", "w", "nw", "n", "ne", "e", "se"]


def render_miner(out_dir: str, samples: int) -> list[dict]:
    metas = []
    scene = reset_scene(samples)
    add_sun(scene)
    catcher = add_shadow_catcher(scene, 3)
    root = build_miner()
    cam = add_camera(scene, Vector((0, 0, 0.45)), 192, 192)
    # Screen "south" (towards the viewer) is world direction (+1, -1). The model faces local -Y.
    for i, name in enumerate(DIRECTIONS):
        root.rotation_euler = (0, 0, math.radians(45 + i * 45))
        bpy.context.view_layer.update()
        path = os.path.join(out_dir, f"miner_{name}")
        render_passes(scene, path, catcher)
        ax, ay = anchor_px(scene, cam, Vector((0, 0, 0)))
        metas.append({"name": f"miner_{name}", "anchor": [round(ax, 2), round(ay, 2)], "scale": 2,
                      "size": [192, 192]})
    with open(os.path.join(out_dir, "miner.json"), "w", encoding="utf8") as fh:
        json.dump(metas, fh, indent=2)
    return metas


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--samples", type=int, default=48)
    args = parser.parse_args(argv)
    os.makedirs(args.out, exist_ok=True)
    t0 = time.time()
    house = render_house(args.out, args.samples)
    t1 = time.time()
    miners = render_miner(args.out, args.samples)
    t2 = time.time()
    print(json.dumps({"house": house, "miner_frames": len(miners),
                      "seconds": {"house": round(t1 - t0, 1), "miner_8_dirs": round(t2 - t1, 1)}}, indent=2))


if __name__ == "__main__":
    main()
