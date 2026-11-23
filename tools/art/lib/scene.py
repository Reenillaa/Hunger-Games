"""Scene, camera, lighting and multi-pass rendering shared by every art script (ART_BIBLE §3, §11)."""

from __future__ import annotations

import math
import os

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

ELEVATION_DEG = 30.0
# Direction the sunlight travels (world space). Shared by every render so all art matches.
SUN_TRAVEL = Vector((-0.28, 0.9, -1.3)).normalized()
TILE_W_1X = 128


def px_per_unit(scale: float) -> float:
    """Screen pixels per world unit along the ground axes, at the given sprite scale (1x, 2x...)."""
    return TILE_W_1X * scale / math.sqrt(2)


def hex_rgba(value: str, alpha: float = 1.0) -> tuple[float, float, float, float]:
    """sRGB hex -> linear RGBA."""
    value = value.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(value[i : i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (out[0], out[1], out[2], alpha)


def reset(samples: int = 64) -> bpy.types.Scene:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 6
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 0.35
    world = bpy.data.worlds.new("World")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = hex_rgba("#8E99AB")
    bg.inputs["Strength"].default_value = 0.85
    scene.world = world
    return scene


def add_sun(scene: bpy.types.Scene, energy: float = 3.6) -> bpy.types.Object:
    """Key light from the viewer's front-left: tops brightest, left (-Y) faces lit, right (+X) faces in half shade."""
    data = bpy.data.lights.new("Sun", type="SUN")
    data.energy = energy
    data.angle = math.radians(6)
    data.color = (1.0, 0.93, 0.84)
    sun = bpy.data.objects.new("Sun", data)
    direction = SUN_TRAVEL
    sun.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(sun)
    return sun


def add_iso_camera(scene: bpy.types.Scene, target: Vector, res_x: int, res_y: int, scale: float) -> bpy.types.Object:
    cam_data = bpy.data.cameras.new("IsoCam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = max(res_x, res_y) / px_per_unit(scale)
    cam_data.clip_start = 0.1
    cam_data.clip_end = 400
    cam = bpy.data.objects.new("IsoCam", cam_data)
    scene.collection.objects.link(cam)
    horizontal = 120.0
    height = horizontal * math.tan(math.radians(ELEVATION_DEG))
    offset = Vector((horizontal / math.sqrt(2), -horizontal / math.sqrt(2), height))
    cam.location = target + offset
    cam.rotation_euler = (-offset).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    scene.render.resolution_x = res_x
    scene.render.resolution_y = res_y
    scene.render.resolution_percentage = 100
    return cam


def anchor_px(scene: bpy.types.Scene, cam: bpy.types.Object, point: Vector) -> tuple[float, float]:
    co = world_to_camera_view(scene, cam, point)
    return (co.x * scene.render.resolution_x, (1 - co.y) * scene.render.resolution_y)


def shadow_catcher(size: float) -> bpy.types.Object:
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, 0))
    plane = bpy.context.active_object
    plane.name = "ShadowCatcher"
    plane.is_shadow_catcher = True
    return plane


def normal_override() -> bpy.types.Material:
    """Camera-space normals (OpenGL: +X right, +Y up, +Z viewer) as colour, for the normal pass."""
    mat = bpy.data.materials.get("NormalPass")
    if mat:
        return mat
    mat = bpy.data.materials.new("NormalPass")
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    for node in list(nodes):
        nodes.remove(node)
    geo = nodes.new("ShaderNodeNewGeometry")
    xform = nodes.new("ShaderNodeVectorTransform")
    xform.vector_type, xform.convert_from, xform.convert_to = "NORMAL", "WORLD", "CAMERA"
    remap = nodes.new("ShaderNodeVectorMath")
    remap.operation = "MULTIPLY_ADD"
    remap.inputs[1].default_value = (0.5, 0.5, -0.5)  # Cycles camera Z points into the scene
    remap.inputs[2].default_value = (0.5, 0.5, 0.5)
    emit = nodes.new("ShaderNodeEmission")
    out = nodes.new("ShaderNodeOutputMaterial")
    links.new(geo.outputs["Normal"], xform.inputs["Vector"])
    links.new(xform.outputs["Vector"], remap.inputs[0])
    links.new(remap.outputs["Vector"], emit.inputs["Color"])
    links.new(emit.outputs["Emission"], out.inputs["Surface"])
    return mat


def _render(scene: bpy.types.Scene, path: str) -> None:
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def render_sprite(scene: bpy.types.Scene, base_path: str, catcher: bpy.types.Object,
                  emissive: list[bpy.types.Material] | None = None, normals: bool = True) -> list[str]:
    """
    Renders the sprite layers required by ART_BIBLE §11.1:
      <base>.png    colour with baked sun shading + AO (no ground shadow)
      <base>_s.png  ground shadow only (shadow catcher, objects hidden from camera)
      <base>_e.png  emission only (windows, lamps), additive, unlit in game
      <base>_n.png  camera-space normals (night lighting)
    """
    written = []
    objects = [o for o in scene.objects if o.type == "MESH" and o != catcher]

    # The ground plane is a holdout in every pass except the shadow one: anything below
    # ground level is cut out of the sprite instead of showing through.
    def ground_as_holdout(on: bool) -> None:
        catcher.is_shadow_catcher = not on
        catcher.is_holdout = on

    # 1. Colour (no ground shadow, emitters switched off: windows look unlit by day).
    ground_as_holdout(True)
    strengths = {}
    for mat in bpy.data.materials:
        node = mat.node_tree.nodes.get("Principled BSDF") if mat.node_tree else None
        if node and node.inputs["Emission Strength"].default_value > 0:
            strengths[mat.name] = node.inputs["Emission Strength"].default_value
            node.inputs["Emission Strength"].default_value = 0.0
    _render(scene, base_path + ".png")
    for name, value in strengths.items():
        bpy.data.materials[name].node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = value
    written.append(base_path + ".png")

    # 2. Shadow only: objects invisible to camera but still casting shadows.
    ground_as_holdout(False)
    for o in objects:
        o.visible_camera = False
    _render(scene, base_path + "_s.png")
    written.append(base_path + "_s.png")
    for o in objects:
        o.visible_camera = True

    # 3. Emission only: all lights off, world black, non-emissive surfaces black holdouts.
    if emissive:
        ground_as_holdout(True)
        world_strength = scene.world.node_tree.nodes["Background"].inputs["Strength"]
        saved_strength = world_strength.default_value
        world_strength.default_value = 0.0
        lights = [o for o in scene.objects if o.type == "LIGHT"]
        for light in lights:
            light.hide_render = True
        _render(scene, base_path + "_e.png")
        written.append(base_path + "_e.png")
        for light in lights:
            light.hide_render = False
        world_strength.default_value = saved_strength

    # 4. Normals.
    if normals:
        ground_as_holdout(True)
        layer = scene.view_layers[0]
        layer.material_override = normal_override()
        saved = (scene.cycles.samples, scene.cycles.use_denoising, scene.view_settings.view_transform, scene.view_settings.look, scene.view_settings.exposure)
        scene.cycles.samples, scene.cycles.use_denoising = 16, False
        scene.view_settings.view_transform, scene.view_settings.look, scene.view_settings.exposure = "Raw", "None", 0.0
        _render(scene, base_path + "_n.png")
        written.append(base_path + "_n.png")
        layer.material_override = None
        (scene.cycles.samples, scene.cycles.use_denoising, scene.view_settings.view_transform,
         scene.view_settings.look, scene.view_settings.exposure) = saved

    ground_as_holdout(False)
    return written


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)
