"""
Pre-renders the District XII terrain from the template (src/content/maps/d12.json) into
JPEG chunks for the game (public/assets/district/terrain/<scale>/) plus a manifest.

  python tools/art/render_terrain.py [--scale 1.0] [--samples 24] [--preview]

Blender world: cell (x, y) centre = (X = x, Y = -y). One cell = one unit. Z = elevation.
The terrain is static (fixed template); per-game variety comes from props placed in the game.
"""

from __future__ import annotations

import argparse
import json
import math
import pathlib
import sys
import time

import bpy
from mathutils import Vector, noise

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib import materials as M  # noqa: E402
from lib import scene as S  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[2]
TEMPLATE = json.loads((ROOT / "src/content/maps/d12.json").read_text(encoding="utf8"))
W, H = TEMPLATE["width"], TEMPLATE["height"]
CODES = TEMPLATE["terrain"]
ELEV = TEMPLATE["elevation"]
EXT = 2  # cells rendered beyond the playable map so edges fade instead of ending abruptly
SUB = 4  # mesh subdivisions per cell
BG = (22, 22, 26)

# Layer membership per terrain code (blurred later into smooth vertex weights).
LAYERS = {
    "dry": {"f": 0.45, "s": 0.4, "g": 0.2},
    "forest": {"f": 1.0},
    "dirt": {"d": 0.8, "w": 0.9, "b": 0.9, "v": 0.4, "p": 0.6},
    "coal": {"v": 1.0, "r": 0.9},
    "gravel": {"t": 1.0},
    "cobble": {"p": 1.0},
    "rock": {"R": 1.0, "s": 0.55},
}


def code_at(x: int, y: int) -> str:
    x = min(max(x, 0), W - 1)
    y = min(max(y, 0), H - 1)
    return CODES[y][x]


def _raw_elev(x: int, y: int) -> float:
    xc, yc = min(max(x, 0), W - 1), min(max(y, 0), H - 1)
    e = max(ELEV[yc][xc], 0.0)
    # Beyond the back edges the mountains keep rising gently; beyond the front they stay flat.
    if y < 0 or (x < 0 and y < 26):
        e += 0.35 * max(-x, -y, 0)
    return e


def _blurred_field() -> dict[tuple[int, int], float]:
    """Gaussian-blurred elevation (radius 3) so slopes span several cells instead of walls."""
    kernel = [(dx, dy, math.exp(-(dx * dx + dy * dy) / 5.0)) for dx in range(-3, 4) for dy in range(-3, 4)]
    field = {}
    for y in range(-EXT - 3, H + EXT + 4):
        for x in range(-EXT - 3, W + EXT + 4):
            total = weight = 0.0
            for dx, dy, k in kernel:
                total += _raw_elev(x + dx, y + dy) * k
                weight += k
            # Peaks and saddles along the range: low-frequency variation of mountain height.
            mass = total / weight
            vary = 0.55 + 0.9 * (0.5 + 0.5 * noise.noise(Vector((x * 0.11, y * 0.11, 7.0))))
            field[(x, y)] = mass * (vary if mass > 0.6 else 1.0)
    return field


_FIELD = _blurred_field()


def elev_at(x: int, y: int) -> float:
    return _FIELD.get((x, y), _raw_elev(x, y))


def bilinear(fn, fx: float, fy: float) -> float:
    x0, y0 = math.floor(fx), math.floor(fy)
    tx, ty = fx - x0, fy - y0
    a = fn(x0, y0) * (1 - tx) + fn(x0 + 1, y0) * tx
    b = fn(x0, y0 + 1) * (1 - tx) + fn(x0 + 1, y0 + 1) * tx
    return a * (1 - ty) + b * ty


def smoothstep(e0: float, e1: float, v: float) -> float:
    t = min(max((v - e0) / (e1 - e0), 0.0), 1.0)
    return t * t * (3 - 2 * t)


def height_at(fx: float, fy: float) -> float:
    """Terrain height (world Z) at a point in cell coordinates. Used by the mesh and the props."""
    e = bilinear(elev_at, fx, fy)
    rockness = bilinear(lambda x, y: LAYERS["rock"].get(code_at(x, y), 0.0), fx, fy)
    water = bilinear(lambda x, y: 1.0 if code_at(x, y) == "w" else 0.0, fx, fy)
    p = Vector((fx * 0.19, fy * 0.19, 0.0))
    ridge = noise.ridged_multi_fractal(p, 1.0, 2.0, 4, 1.0, 2.0)
    detail = noise.fractal(Vector((fx * 1.7, fy * 1.7, 3.1)), 0.8, 2.0, 3)
    z = e + rockness * (0.25 + 0.22 * e) * (0.8 * ridge + 0.3 * detail) + (1 - rockness) * 0.05 * detail
    return z - 0.3 * water


def export_heights() -> None:
    """Per-cell ground height for placing sprites on slopes (public/assets/district/terrain/heights.json)."""
    rows = [[round(height_at(x, y), 3) for x in range(W)] for y in range(H)]
    out = ROOT / "public/assets/district/terrain/heights.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"width": W, "height": H, "heights": rows}, separators=(",", ":")) + "\n", encoding="utf8")
    print(f"wrote {out}")


def build_terrain() -> bpy.types.Object:
    n = (W + 2 * EXT) * SUB + 1
    x_min, y_min = -0.5 - EXT, -0.5 - EXT  # in cell space
    verts, weights = [], {k: [] for k in LAYERS}
    outside = []
    for j in range(n):
        for i in range(n):
            fx = x_min + i / SUB
            fy = y_min + j / SUB
            verts.append((fx, -fy, height_at(fx, fy)))
            for key, table in LAYERS.items():
                weights[key].append(bilinear(lambda x, y, t=table: t.get(code_at(x, y), 0.0), fx, fy))
            dist_out = max(-0.5 - fx, fx - (W - 0.5), -0.5 - fy, fy - (H - 0.5), 0.0)
            outside.append(smoothstep(0.0, EXT * 0.9, dist_out))
    faces = []
    for j in range(n - 1):
        for i in range(n - 1):
            a = j * n + i
            faces.append((a, a + 1, a + n + 1, a + n))
    mesh = bpy.data.meshes.new("Terrain")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    for poly in mesh.polygons:
        poly.use_smooth = True
    for key, values in [*weights.items(), ("outside", outside)]:
        attr = mesh.attributes.new(key, "FLOAT", "POINT")
        attr.data.foreach_set("value", values)
    obj = bpy.data.objects.new("Terrain", mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(terrain_material())
    return obj


def terrain_material() -> bpy.types.Material:
    """One Principled BSDF; texture layers are blended at the input level (colour, roughness, normal)."""
    mat = bpy.data.materials.new("TerrainMat")
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes["Principled BSDF"]
    out = nodes["Material Output"]
    common = {"coords": "Object", "blend": 0.0}

    def breakup(attr_name: str, sharpness: float = 0.22, scale: float = 0.9):
        attr = nodes.new("ShaderNodeAttribute")
        attr.attribute_type, attr.attribute_name = "GEOMETRY", attr_name
        tex = nodes.new("ShaderNodeTexNoise")
        tex.inputs["Scale"].default_value = scale
        tex.inputs["Detail"].default_value = 6
        coord = nodes.new("ShaderNodeTexCoord")
        links.new(coord.outputs["Object"], tex.inputs["Vector"])
        add = nodes.new("ShaderNodeMath")
        add.operation = "MULTIPLY_ADD"
        add.inputs[1].default_value = 0.55
        links.new(tex.outputs["Fac"], add.inputs[0])
        links.new(attr.outputs["Fac"], add.inputs[2])
        rng = nodes.new("ShaderNodeMapRange")
        rng.inputs["From Min"].default_value = 0.62 - sharpness
        rng.inputs["From Max"].default_value = 0.62 + sharpness
        links.new(add.outputs["Value"], rng.inputs["Value"])
        return rng.outputs["Result"]

    def blend(state, sockets, factor):
        color = nodes.new("ShaderNodeMix")
        color.data_type = "RGBA"
        links.new(factor, color.inputs["Factor"])
        links.new(state["color"], color.inputs["A"])
        links.new(sockets["color"], color.inputs["B"])
        rough = nodes.new("ShaderNodeMix")
        rough.data_type = "FLOAT"
        links.new(factor, rough.inputs["Factor"])
        links.new(state["roughness"], rough.inputs["A"])
        links.new(sockets["roughness"], rough.inputs["B"])
        normal = nodes.new("ShaderNodeMix")
        normal.data_type = "VECTOR"
        links.new(factor, normal.inputs["Factor"])
        links.new(state["normal"], normal.inputs["A"])
        links.new(sockets["normal"], normal.inputs["B"])
        return {"color": color.outputs["Result"], "roughness": rough.outputs["Result"], "normal": normal.outputs["Result"]}

    def tex(key, **kwargs):
        return M.pbr_sockets(nodes, links, key, **{**common, **kwargs})

    state = tex("grass_patchy", scale=0.7, normal_strength=1.6, saturation=0.5, value=0.6, tint="#55613F", tint_amount=0.3)
    state = blend(state, tex("grass_dry", scale=0.6, normal_strength=1.6, saturation=0.45, value=0.6, tint="#6A6440", tint_amount=0.3), breakup("dry", 0.3, 1.3))
    state = blend(state, tex("dirt_light", scale=0.55, normal_strength=1.8, saturation=0.35, value=0.5, tint="#5E5040", tint_amount=0.25), breakup("dirt", 0.28, 1.1))
    state = blend(state, tex("dirt_coal", scale=0.6, normal_strength=1.8, saturation=0.3, value=0.33, tint="#3B3A2E", tint_amount=0.3), breakup("forest", 0.3, 1.5))
    state = blend(state, tex("dirt_coal", scale=0.7, normal_strength=2.0, saturation=0.2, value=0.4), breakup("coal", 0.18, 1.0))
    state = blend(state, tex("gravel", scale=1.0, normal_strength=2.0, saturation=0.2, value=0.5), breakup("gravel", 0.12, 2.0))
    state = blend(state, tex("cobble", scale=0.32, normal_strength=2.2, saturation=0.3, value=0.55, tint="#5B5753", tint_amount=0.2), breakup("cobble", 0.1, 2.0))

    # Rock: by membership OR by steep slope.
    geo = nodes.new("ShaderNodeNewGeometry")
    sep = nodes.new("ShaderNodeSeparateXYZ")
    links.new(geo.outputs["Normal"], sep.inputs["Vector"])
    slope = nodes.new("ShaderNodeMapRange")
    slope.inputs["From Min"].default_value = 0.9
    slope.inputs["From Max"].default_value = 0.72
    links.new(sep.outputs["Z"], slope.inputs["Value"])
    mx = nodes.new("ShaderNodeMath")
    mx.operation = "MAXIMUM"
    links.new(breakup("rock", 0.15, 0.7), mx.inputs[0])
    links.new(slope.outputs["Result"], mx.inputs[1])
    state = blend(state, tex("rock_dark", scale=0.3, normal_strength=1.6, saturation=0.35, value=0.6), mx.outputs["Value"])

    # Fade towards the background beyond the playable map.
    out_attr = nodes.new("ShaderNodeAttribute")
    out_attr.attribute_type, out_attr.attribute_name = "GEOMETRY", "outside"
    fade = nodes.new("ShaderNodeMix")
    fade.data_type = "RGBA"
    links.new(out_attr.outputs["Fac"], fade.inputs["Factor"])
    links.new(state["color"], fade.inputs["A"])
    fade.inputs["B"].default_value = S.hex_rgba("#121216")
    links.new(fade.outputs["Result"], bsdf.inputs["Base Color"])
    links.new(state["roughness"], bsdf.inputs["Roughness"])
    links.new(state["normal"], bsdf.inputs["Normal"])
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def camera_background(scene) -> None:
    """Camera rays see the coal background colour; lighting still comes from the sky."""
    nodes, links = scene.world.node_tree.nodes, scene.world.node_tree.links
    sky = nodes["Background"]
    coal = nodes.new("ShaderNodeBackground")
    coal.inputs["Color"].default_value = S.hex_rgba("#16161A")
    path = nodes.new("ShaderNodeLightPath")
    mix = nodes.new("ShaderNodeMixShader")
    links.new(path.outputs["Is Camera Ray"], mix.inputs["Fac"])
    links.new(sky.outputs["Background"], mix.inputs[1])
    links.new(coal.outputs["Background"], mix.inputs[2])
    links.new(mix.outputs["Shader"], nodes["World Output"].inputs["Surface"])


def _grass_clump() -> bpy.types.Object:
    """A clump of thin bent blades (source object for scattering)."""
    verts, faces = [], []
    blades = 9
    for b in range(blades):
        ang = b / blades * math.tau + 0.4 * math.sin(b * 7.1)
        r = 0.02 + 0.03 * ((b * 37) % 7) / 7
        h = 0.10 + 0.08 * ((b * 53) % 5) / 5
        lean = 0.04 + 0.03 * ((b * 11) % 3)
        bx, by = math.cos(ang) * r, math.sin(ang) * r
        dx, dy = math.cos(ang) * lean, math.sin(ang) * lean
        w = 0.012
        px, py = -math.sin(ang) * w, math.cos(ang) * w
        base = len(verts)
        verts += [(bx - px, by - py, 0), (bx + px, by + py, 0), (bx + dx * 0.6, by + dy * 0.6, h * 0.6), (bx + dx, by + dy, h)]
        faces += [(base, base + 1, base + 2), (base, base + 2, base + 3)]
    mesh = bpy.data.meshes.new("GrassClump")
    mesh.from_pydata(verts, [], faces)
    obj = bpy.data.objects.new("GrassClump", mesh)
    bpy.context.scene.collection.objects.link(obj)
    mat = bpy.data.materials.new("GrassBlades")
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes["Principled BSDF"]
    info = nodes.new("ShaderNodeObjectInfo")
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = S.hex_rgba("#4C5634")
    ramp.color_ramp.elements[1].color = S.hex_rgba("#8A8456")
    links.new(info.outputs["Random"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.85
    bsdf.inputs["Subsurface Weight"].default_value = 0.0
    obj.data.materials.append(mat)
    obj.hide_render = True
    obj.location = (0, 0, -50)
    return obj


def _pebble() -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.05, location=(0, 0, -50))
    obj = bpy.context.active_object
    obj.name = "Pebble"
    obj.scale = (1.0, 0.8, 0.45)
    obj.data.materials.append(M.district_materials()["stone"])
    obj.hide_render = True
    return obj


def scatter(terrain: bpy.types.Object) -> None:
    """Hair-particle instancing of grass clumps and pebbles, density from the terrain layers."""
    mesh = terrain.data
    attrs = {k: [0.0] * len(mesh.vertices) for k in ("grass", "pebble")}
    get = lambda name: [v.value for v in mesh.attributes[name].data]
    dry, dirt, coal, gravel, cobble, rock, forest, out = (get(n) for n in ("dry", "dirt", "coal", "gravel", "cobble", "rock", "forest", "outside"))
    for i, v in enumerate(mesh.vertices):
        bare = max(dirt[i], coal[i], gravel[i], cobble[i], rock[i])
        wet = 1.0 if v.co.z < -0.05 else 0.0
        attrs["grass"][i] = max(0.0, (1 - bare) * (1 - wet) * (1 - out[i]) * (0.55 + 0.45 * dry[i]))
        attrs["pebble"][i] = max(0.0, min(1.0, 0.6 * dirt[i] + 0.5 * forest[i] + 0.8 * rock[i] * 0.3) * (1 - wet) * (1 - cobble[i]))
    for name, values in attrs.items():
        group = terrain.vertex_groups.new(name=name)
        for i, w in enumerate(values):
            if w > 0.02:
                group.add([i], w, "REPLACE")

    clump, pebble = _grass_clump(), _pebble()
    for name, obj, count, size in (("grass", clump, 150000, 1.15), ("pebble", pebble, 9000, 1.0)):
        mod = terrain.modifiers.new(name, "PARTICLE_SYSTEM")
        settings = mod.particle_system.settings
        settings.type = "HAIR"
        settings.use_advanced_hair = True
        settings.count = count
        settings.hair_length = 1.0
        settings.render_type = "OBJECT"
        settings.instance_object = obj
        settings.particle_size = size
        settings.size_random = 0.6
        settings.use_rotations = True
        settings.rotation_mode = "OB_Z"
        settings.phase_factor_random = 2.0
        settings.distribution = "RAND"
        settings.use_emit_random = True
        mod.particle_system.vertex_group_density = name
        mod.particle_system.seed = 12 if name == "grass" else 31


def build_water() -> None:
    size = W + 2 * EXT
    bpy.ops.mesh.primitive_plane_add(size=size, location=(W / 2 - 0.5, -(H / 2 - 0.5), -0.12))
    plane = bpy.context.active_object
    mat = bpy.data.materials.new("Water")
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = S.hex_rgba("#1C2A2C")
    bsdf.inputs["Roughness"].default_value = 0.08
    bsdf.inputs["Coat Weight"].default_value = 0.4
    tex = nodes.new("ShaderNodeTexNoise")
    tex.inputs["Scale"].default_value = 6.0
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.15
    links.new(tex.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    plane.data.materials.append(mat)


def box(name, size, loc, mat, rot_z=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    obj.rotation_euler = (0, 0, rot_z)
    obj.data.materials.append(mat)
    return obj


def build_railway(mats) -> None:
    rows = [y for y in range(H) if code_at(44, y) == "t"]
    y0, y1 = min(rows), max(rows) + EXT
    cx = 44.5
    k = 0
    y = y0 - 0.3
    while y <= y1 + 0.5:
        jitter = noise.noise(Vector((y * 3.0, 0.5, 0.0))) * 0.04
        box(f"Sleeper{k}", (1.45, 0.16, 0.07), (cx, -y, 0.06), mats["beam"], rot_z=jitter)
        y += 0.32
        k += 1
    for side in (-0.36, 0.36):
        box("Rail", (0.06, (y1 - y0) + 1.6, 0.07), (cx + side, -((y0 + y1) / 2 + 0.3), 0.13), mats["iron"])


def build_bridges(mats) -> None:
    cells = [(x, y) for y in range(H) for x in range(W) if code_at(x, y) == "b"]
    if not cells:
        return
    xs = [c[0] for c in cells]
    y = cells[0][1]
    x0, x1 = min(xs) - 0.9, max(xs) + 0.9
    length = x1 - x0
    for k in range(int(length / 0.22)):
        x = x0 + 0.11 + k * 0.22
        box(f"Plank{k}", (0.2, 1.05, 0.06), (x, -y, 0.12 + 0.01 * math.sin(k)), mats["planks_pale"])
    for side in (-0.5, 0.5):
        box("Beam", (length, 0.12, 0.12), ((x0 + x1) / 2, -y + side, 0.05), mats["beam"])
        box("Railing", (length, 0.05, 0.05), ((x0 + x1) / 2, -y + side, 0.5), mats["beam"])
        for k in range(int(length / 0.6) + 1):
            box("Post", (0.07, 0.07, 0.45), (x0 + k * 0.6, -y + side, 0.3), mats["beam"])


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    parser = argparse.ArgumentParser()
    parser.add_argument("--scale", type=float, default=1.0)
    parser.add_argument("--samples", type=int, default=24)
    parser.add_argument("--preview", action="store_true", help="render a single image only, no chunks")
    parser.add_argument("--reslice", action="store_true", help="re-cut chunks from the last full render")
    parser.add_argument("--heights-only", action="store_true", help="only export per-cell heights")
    parser.add_argument("--crop", type=float, nargs=4, metavar=("X0", "Y0", "X1", "Y1"),
                        help="render only this normalised region (0..1, y from the top) for quick checks")
    args = parser.parse_args(argv)

    t0 = time.time()
    if args.reslice:
        full = ROOT / f"assets/build/terrain_d12_{args.scale:g}x.png"
        old = json.loads((ROOT / f"public/assets/district/terrain/{args.scale:g}x/manifest.json").read_text())
        slice_chunks(full, args.scale, old["originAnchor"], old["width"], old["height"])
        return
    export_heights()
    if args.heights_only:
        return
    scene = S.reset(args.samples)
    S.add_sun(scene)
    camera_background(scene)
    mats = M.district_materials()
    terrain = build_terrain()
    scatter(terrain)
    build_water()
    build_railway(mats)
    build_bridges(mats)

    # Frame: screen x = (X+Y)*64*s, screen y = (X-Y)*32*s - Z*78.38*s for the extended map.
    s = args.scale
    sx_half = (W + 2 * EXT) * 64 * s + 40 * s
    sy_top = (-(1 + 2 * EXT) * 32 - 5.2 * 78.38) * s
    sy_bottom = ((2 * W - 1 + 2 * EXT) * 32 + 40) * s
    res_x = int(round(2 * sx_half))
    res_y = int(round(sy_bottom - sy_top))
    centre_sy = (sy_top + sy_bottom) / 2
    # Target with screen x = 0 and screen y = centre_sy on the ground plane: X+Y = 0, X-Y = centre/(32 s).
    d = centre_sy / (32 * s)
    target = Vector((d / 2, -d / 2, 0.0))
    cam = S.add_iso_camera(scene, target, res_x, res_y, s)
    scene.render.film_transparent = False
    if args.crop:
        x0, y0, x1, y1 = args.crop
        scene.render.use_border, scene.render.use_crop_to_border = True, True
        scene.render.border_min_x, scene.render.border_max_x = x0, x1
        scene.render.border_min_y, scene.render.border_max_y = 1 - y1, 1 - y0

    build_dir = ROOT / "assets/build"
    build_dir.mkdir(parents=True, exist_ok=True)
    full = build_dir / f"terrain_d12_{s:g}x.png"
    scene.render.filepath = str(full)
    bpy.ops.render.render(write_still=True)
    ax, ay = S.anchor_px(scene, cam, Vector((0, 0, 0)))
    print(f"rendered {res_x}x{res_y} in {time.time() - t0:.0f}s; origin anchor = ({ax:.1f}, {ay:.1f})")
    if args.preview:
        return
    slice_chunks(full, s, (ax, ay), res_x, res_y)


def slice_chunks(full: pathlib.Path, scale: float, anchor, res_x: int, res_y: int) -> None:
    """Writes the full-scale chunk set plus a half-scale set for low-end devices."""
    from PIL import Image

    img = Image.open(full).convert("RGB")
    write_chunks(img, scale, anchor, res_x, res_y)
    half = img.resize((res_x // 2, res_y // 2), Image.LANCZOS)
    write_chunks(half, scale / 2, (anchor[0] / 2, anchor[1] / 2), res_x // 2, res_y // 2)


def write_chunks(img, scale: float, anchor, res_x: int, res_y: int) -> None:
    tile = 1024
    folder = ROOT / f"public/assets/district/terrain/{scale:g}x"
    folder.mkdir(parents=True, exist_ok=True)
    for old in folder.glob("*.jpg"):
        old.unlink()
    cols, rows = math.ceil(res_x / tile), math.ceil(res_y / tile)
    for r in range(rows):
        for c in range(cols):
            # 2 px of overlap on the right/bottom hides seams from texture filtering.
            box_ = (c * tile, r * tile, min((c + 1) * tile + 2, res_x), min((r + 1) * tile + 2, res_y))
            piece = img.crop(box_)
            piece.save(folder / f"t_{r}_{c}.jpg", quality=84, optimize=True, progressive=True)
    manifest = {
        "scale": scale,
        "tile": tile,
        "cols": cols,
        "rows": rows,
        "width": res_x,
        "height": res_y,
        "originAnchor": [round(anchor[0], 2), round(anchor[1], 2)],
        "background": "#16161a",
    }
    (folder / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf8")
    print(f"wrote {cols}x{rows} chunks to {folder}")


if __name__ == "__main__":
    main()
