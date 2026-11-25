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
_ARGV = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
MAP = _ARGV[_ARGV.index("--map") + 1] if "--map" in _ARGV else "d12"
# Per-map setup: layer membership per terrain code (blurred later into smooth vertex weights).
MAPS = {
    "d12": {
        "out": "public/assets/district/terrain",
        "water": "w", "wet": "w", "soot": "rvt", "rise_back": True, "background": "#121216",
        "layers": {
            "dry": {"f": 0.45, "s": 0.4, "g": 0.2},
            "forest": {"f": 1.0},
            "dirt": {"d": 0.8, "w": 0.9, "b": 0.9, "v": 0.4, "p": 0.6},
            "coal": {"v": 1.0, "r": 0.9},
            "gravel": {"t": 1.0},
            "cobble": {"p": 1.0},
            "rock": {"R": 1.0, "s": 0.55},
        },
    },
    "arena_forest": {
        "out": "public/assets/arena/terrain",
        "water": "wW", "wet": "wW", "soot": "", "rise_back": False, "background": "#0E130E",
        "layers": {
            "dry": {"b": 0.9, "c": 0.25},
            "forest": {"F": 0.75, "D": 1.0, "v": 0.5},
            "dirt": {"u": 0.5, "v": 0.6, "w": 0.7, "X": 0.3},
            "coal": {},
            "gravel": {"X": 0.4, "r": 0.3},
            "cobble": {"u": 0.7, "X": 0.8},
            "rock": {"R": 1.0, "r": 0.75},
        },
    },
}
MAPS["d11"] = {
    "out": "public/assets/districts/d11/terrain",
    "water": "w", "wet": "w", "soot": "", "rise_back": True, "rise_left": True, "background": "#151a12",
    "dirt_tint": "#6E5A42",
    "grass_tint": "#8FA048", "grass_amount": 0.35,
    "dry_tint": "#D8B04E", "dry_amount": 0.55, "dry_saturation": 0.95, "dry_value": 0.85,
    "layers": {
        "dry": {"g": 0.75, "f": 0.15, "s": 0.5},
        "field": {"c": 1.0},
        "forest": {},
        "dirt": {"d": 0.8, "w": 0.9, "b": 0.9, "p": 0.6, "f": 0.35},
        "coal": {},
        "gravel": {"t": 1.0},
        "cobble": {"p": 1.0},
        "rock": {"R": 1.0, "s": 0.45},
    },
}
MAPS["d4"] = {
    "out": "public/assets/districts/d4/terrain",
    "water": "w", "wet": "w", "soot": "", "rise_back": True, "rise_left": False, "background": "#101a20",
    "dirt_tint": "#D8C08E",
    "grass_tint": "#5E8A6A", "grass_amount": 0.4,
    "dry_tint": "#9AA27A", "dry_amount": 0.35,
    "layers": {
        "dry": {"g": 0.3, "s": 0.4},
        "forest": {"f": 1.0},
        "dirt": {"d": 1.0, "w": 0.7, "b": 0.9, "p": 0.6},
        "coal": {},
        "gravel": {"t": 1.0},
        "cobble": {"p": 1.0},
        "rock": {"R": 1.0, "s": 0.55},
    },
}
MAPS["d7"] = {
    "out": "public/assets/districts/d7/terrain",
    "water": "w", "wet": "w", "soot": "", "rise_back": True, "rise_left": True, "background": "#0f150e",
    "dirt_tint": "#5E4A36", "grass_tint": "#4E7A36", "grass_amount": 0.35,
    "dry_tint": "#7A6A3A", "dry_amount": 0.3,
    "layers": {
        "dry": {"g": 0.25, "s": 0.4},
        "forest": {"f": 1.0},
        "dirt": {"d": 0.8, "w": 0.9, "b": 0.9, "p": 0.6},
        "coal": {},
        "gravel": {"t": 1.0},
        "cobble": {"p": 1.0},
        "rock": {"R": 1.0, "s": 0.55},
    },
}
MAPS["d2"] = {
    "out": "public/assets/districts/d2/terrain",
    "water": "w", "wet": "w", "soot": "", "rise_back": True, "rise_left": True, "background": "#14161a",
    "dirt_tint": "#7A7468", "grass_tint": "#6E8A4E", "grass_amount": 0.3,
    "dry_tint": "#8E8A6A", "dry_amount": 0.35,
    "layers": {
        "dry": {"g": 0.45, "s": 0.5},
        "forest": {"f": 0.8},
        "dirt": {"d": 0.5, "w": 0.8, "b": 0.9, "p": 0.6},
        "coal": {},
        "gravel": {"t": 1.0, "d": 0.45},
        "cobble": {"p": 1.0},
        "rock": {"R": 1.0, "s": 0.75},
    },
}
MAPS["d1"] = {
    "out": "public/assets/districts/d1/terrain",
    "water": "w", "wet": "w", "soot": "", "rise_back": True, "rise_left": True, "background": "#141a14",
    "dirt_tint": "#8E7A5E", "grass_tint": "#5E9A4A", "grass_amount": 0.45,
    "dry_tint": "#9AAE5A", "dry_amount": 0.2,
    "layers": {
        "dry": {"g": 0.15, "s": 0.3},
        "forest": {"f": 1.0},
        "dirt": {"d": 0.8, "w": 0.9, "b": 0.9, "p": 0.6, "r": 1.0},
        "coal": {},
        "gravel": {"t": 1.0, "r": 0.9},
        "cobble": {"p": 1.0, "r": 0.85},
        "rock": {"R": 1.0, "s": 0.55},
    },
}
MAPS["d3"] = {
    "out": "public/assets/districts/d3/terrain",
    "water": "w", "wet": "w", "soot": "", "rise_back": True, "rise_left": True, "background": "#121418",
    "dirt_tint": "#6E6A62", "grass_tint": "#6E8A5A", "grass_amount": 0.3,
    "dry_tint": "#8E8E6E", "dry_amount": 0.4,
    "layers": {
        "dry": {"g": 0.45, "s": 0.5},
        "forest": {"f": 1.0},
        "dirt": {"d": 0.8, "w": 0.9, "b": 0.9, "p": 0.6, "r": 1.0},
        "coal": {},
        "gravel": {"t": 1.0, "r": 1.0, "d": 0.3},
        "cobble": {"p": 1.0, "r": 0.85},
        "rock": {"R": 1.0, "s": 0.55},
    },
}
MAPS["d5"] = {
    "out": "public/assets/districts/d5/terrain",
    "water": "w", "wet": "w", "soot": "v", "rise_back": True, "rise_left": True, "background": "#141416",
    "dirt_tint": "#5E4E42", "grass_tint": "#5E7A48", "grass_amount": 0.3,
    "dry_tint": "#7E7A5A", "dry_amount": 0.35,
    "layers": {
        "dry": {"g": 0.35, "s": 0.5},
        "forest": {"f": 1.0},
        "dirt": {"d": 0.8, "w": 0.9, "b": 0.9, "p": 0.6, "r": 1.0},
        "coal": {"v": 1.0},
        "gravel": {"t": 1.0, "r": 0.9},
        "cobble": {"p": 1.0, "r": 0.85},
        "rock": {"R": 1.0, "s": 0.55},
    },
}
MAPS["d6"] = {
    "out": "public/assets/districts/d6/terrain",
    "water": "w", "wet": "w", "soot": "", "rise_back": True, "rise_left": True, "background": "#121214",
    "dirt_tint": "#5A5048", "grass_tint": "#5E764A", "grass_amount": 0.3,
    "dry_tint": "#7A7458", "dry_amount": 0.4,
    "layers": {
        "dry": {"g": 0.4, "s": 0.5},
        "forest": {"f": 1.0},
        "dirt": {"d": 0.8, "w": 0.9, "b": 0.9, "p": 0.6, "r": 1.0},
        "coal": {},
        "gravel": {"t": 1.0, "r": 0.9},
        "cobble": {"p": 1.0, "r": 0.85},
        "rock": {"R": 1.0, "s": 0.55},
    },
}
MAPS["d8"] = {
    "out": "public/assets/districts/d8/terrain",
    "water": "w", "wet": "w", "soot": "", "rise_back": True, "rise_left": True, "background": "#16140f",
    "dirt_tint": "#7A6046", "grass_tint": "#6A7E4A", "grass_amount": 0.3,
    "dry_tint": "#9A8A5A", "dry_amount": 0.45,
    "layers": {
        "dry": {"g": 0.5, "s": 0.5},
        "forest": {"f": 1.0},
        "dirt": {"d": 0.8, "w": 0.9, "b": 0.9, "p": 0.6, "r": 1.0},
        "coal": {},
        "gravel": {"t": 1.0, "r": 1.0},
        "cobble": {"p": 1.0, "r": 0.85},
        "rock": {"R": 1.0, "s": 0.55},
    },
}
MAPS["d9"] = {
    "out": "public/assets/districts/d9/terrain",
    "water": "w", "wet": "w", "soot": "", "rise_back": True, "rise_left": True, "background": "#18160e",
    "dirt_tint": "#7A6040", "grass_tint": "#9AA04A", "grass_amount": 0.35,
    "dry_tint": "#D8B85A", "dry_amount": 0.6,
    "dry_saturation": 0.95, "dry_value": 0.9,
    "layers": {
        "dry": {"g": 0.6, "s": 0.5},
        "field": {"c": 1.0},
        "forest": {"f": 0.8},
        "dirt": {"d": 0.8, "w": 0.9, "b": 0.9, "p": 0.6, "r": 1.0},
        "coal": {},
        "gravel": {"t": 1.0, "r": 0.7},
        "cobble": {"p": 1.0, "r": 0.85},
        "rock": {"R": 1.0, "s": 0.55},
    },
}
MAPS["d10"] = {
    "out": "public/assets/districts/d10/terrain",
    "water": "w", "wet": "w", "soot": "", "rise_back": True, "rise_left": True, "background": "#141810",
    "dirt_tint": "#7A6448", "grass_tint": "#7EA048", "grass_amount": 0.45,
    "dry_tint": "#B8A85A", "dry_amount": 0.3,
    "layers": {
        "dry": {"g": 0.25, "s": 0.4},
        "forest": {"f": 1.0},
        "dirt": {"d": 0.8, "w": 0.9, "b": 0.9, "p": 0.6, "r": 1.0},
        "coal": {},
        "gravel": {"t": 1.0, "r": 0.6},
        "cobble": {"p": 1.0, "r": 0.85},
        "rock": {"R": 1.0, "s": 0.55},
    },
}
MAPS["arena_tundra"] = {
    "out": "public/assets/arena_tundra/terrain",
    "water": "wW", "wet": "wW", "soot": "", "rise_back": False, "background": "#10141a",
    "grass_tint": "#EEF2F6", "grass_amount": 0.9, "dry_tint": "#DDE4EA", "dry_amount": 0.85,
    "dry_saturation": 0.2, "dry_value": 1.25, "dirt_tint": "#B8C2CC", "vegetation": 0.12,
    "layers": {
        "dry": {"c": 0.95, "b": 0.85, "F": 0.85, "D": 0.75, "X": 0.3, "v": 0.5},
        "forest": {"F": 0.15, "D": 0.3},
        "dirt": {"u": 0.4, "w": 0.8, "X": 0.2},
        "coal": {},
        "gravel": {"X": 0.3, "r": 0.3},
        "cobble": {"u": 0.7, "X": 0.8},
        "rock": {"R": 1.0, "r": 0.75},
    },
}
CFG = MAPS[MAP]
TEMPLATE = json.loads((ROOT / f"src/content/maps/{MAP}.json").read_text(encoding="utf8"))
W, H = TEMPLATE["width"], TEMPLATE["height"]
CODES = TEMPLATE["terrain"]
ELEV = TEMPLATE["elevation"]
EXT = 2  # cells rendered beyond the playable map so edges fade instead of ending abruptly
SUB = 4  # mesh subdivisions per cell
BG = (22, 22, 26)

LAYERS = CFG["layers"]


def _proximity(codes: str, radius: float) -> dict[tuple[int, int], float]:
    """1 on cells of `codes`, fading linearly to 0 at `radius` cells away."""
    src = [(x, y) for y in range(H) for x in range(W) if CODES[y][x] in codes]
    field = {}
    r = int(math.ceil(radius))
    for (sx, sy) in src:
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                d = math.hypot(dx, dy)
                if d <= radius:
                    k = (sx + dx, sy + dy)
                    field[k] = max(field.get(k, 0.0), 1.0 - d / radius)
    return field


_FIELDS: dict[str, dict[tuple[int, int], float]] = {}


def field_value(name: str, x: int, y: int) -> float:
    if not _FIELDS:
        _FIELDS["wet"] = _proximity(CFG["wet"], 2.6)
        _FIELDS["soot"] = _proximity(CFG["soot"], 2.2)
    return _FIELDS[name].get((x, y), 0.0)


def code_at(x: int, y: int) -> str:
    x = min(max(x, 0), W - 1)
    y = min(max(y, 0), H - 1)
    return CODES[y][x]


def _raw_elev(x: int, y: int) -> float:
    xc, yc = min(max(x, 0), W - 1), min(max(y, 0), H - 1)
    e = max(ELEV[yc][xc], 0.0)
    # Beyond the back edges the mountains keep rising gently; beyond the front they stay flat.
    if CFG["rise_back"] and (y < 0 or (CFG.get("rise_left", True) and x < 0 and y < 26)):
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
    water = bilinear(lambda x, y: 1.0 if code_at(x, y) in CFG["water"] else 0.0, fx, fy)
    p = Vector((fx * 0.19, fy * 0.19, 0.0))
    ridge = noise.ridged_multi_fractal(p, 1.0, 2.0, 4, 1.0, 2.0)
    detail = noise.fractal(Vector((fx * 1.7, fy * 1.7, 3.1)), 0.8, 2.0, 3)
    z = e + rockness * (0.25 + 0.22 * e) * (0.8 * ridge + 0.3 * detail) + (1 - rockness) * 0.05 * detail
    return z - 0.3 * water


def export_heights() -> None:
    """Per-cell ground height for placing sprites on slopes (public/assets/district/terrain/heights.json)."""
    rows = [[round(height_at(x, y), 3) for x in range(W)] for y in range(H)]
    out = ROOT / CFG["out"] / "heights.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"width": W, "height": H, "heights": rows}, separators=(",", ":")) + "\n", encoding="utf8")
    print(f"wrote {out}")


def build_terrain() -> bpy.types.Object:
    n = (W + 2 * EXT) * SUB + 1
    x_min, y_min = -0.5 - EXT, -0.5 - EXT  # in cell space
    verts, weights = [], {k: [] for k in LAYERS}
    weights["wet"], weights["soot"] = [], []
    outside = []
    for j in range(n):
        for i in range(n):
            fx = x_min + i / SUB
            fy = y_min + j / SUB
            verts.append((fx, -fy, height_at(fx, fy)))
            for key, table in LAYERS.items():
                weights[key].append(bilinear(lambda x, y, t=table: t.get(code_at(x, y), 0.0), fx, fy))
            for key in ("wet", "soot"):
                weights[key].append(bilinear(lambda x, y, k=key: field_value(k, x, y), fx, fy))
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

    state = tex("grass_patchy", scale=0.7, normal_strength=1.6, saturation=0.85, value=0.72, tint=CFG.get("grass_tint", "#5E7F38"), tint_amount=CFG.get("grass_amount", 0.3))
    state = blend(state, tex("grass_dry", scale=0.6, normal_strength=1.6, saturation=CFG.get("dry_saturation", 0.7), value=CFG.get("dry_value", 0.7), tint=CFG.get("dry_tint", "#8C8044"), tint_amount=CFG.get("dry_amount", 0.3)), breakup("dry", 0.3, 1.3))
    state = blend(state, tex("dirt_light", scale=0.55, normal_strength=1.8, saturation=0.55, value=0.58 if MAP != "d4" else 0.95, tint=CFG.get("dirt_tint", "#6E5A42"), tint_amount=0.25 if MAP != "d4" else 0.55), breakup("dirt", 0.28, 1.1))
    state = blend(state, tex("dirt_coal", scale=0.6, normal_strength=1.8, saturation=0.3, value=0.33, tint="#3B3A2E", tint_amount=0.3), breakup("forest", 0.3, 1.5))
    state = blend(state, tex("dirt_coal", scale=0.7, normal_strength=2.0, saturation=0.2, value=0.4), breakup("coal", 0.18, 1.0))
    state = blend(state, tex("gravel", scale=1.0, normal_strength=2.0, saturation=0.2, value=0.5), breakup("gravel", 0.12, 2.0))
    state = blend(state, tex("cobble", scale=0.32, normal_strength=2.2, saturation=0.3, value=0.55, tint="#5B5753", tint_amount=0.2), breakup("cobble", 0.1, 2.0))

    # Cultivated parcels: furrows of dark soil alternating with golden stubble (District 11).
    if "field" in LAYERS:
        coord = nodes.new("ShaderNodeTexCoord")
        wave = nodes.new("ShaderNodeTexWave")
        wave.wave_type, wave.bands_direction = "BANDS", "X"
        wave.inputs["Scale"].default_value = 1.6
        wave.inputs["Distortion"].default_value = 1.2
        wave.inputs["Detail"].default_value = 2.0
        links.new(coord.outputs["Object"], wave.inputs["Vector"])
        furrow = nodes.new("ShaderNodeMix")
        furrow.data_type = "RGBA"
        links.new(wave.outputs["Fac"], furrow.inputs["Factor"])
        furrow.inputs["A"].default_value = S.hex_rgba("#4A3524")
        furrow.inputs["B"].default_value = S.hex_rgba("#C9A24E")
        rough = nodes.new("ShaderNodeValue")
        rough.outputs[0].default_value = 0.92
        bump = nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.6
        links.new(wave.outputs["Fac"], bump.inputs["Height"])
        state = blend(state, {"color": furrow.outputs["Result"], "roughness": rough.outputs[0], "normal": bump.outputs["Normal"]},
                      breakup("field", 0.1, 2.0))

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

    # Life in the ground: large colour patches (greener / browner), wet banks, coal soot.
    def noise_fac(scale: float, lo: float, hi: float, seed_w: float):
        coord = nodes.new("ShaderNodeTexCoord")
        tex = nodes.new("ShaderNodeTexNoise")
        tex.noise_dimensions = "4D"
        tex.inputs["W"].default_value = seed_w
        tex.inputs["Scale"].default_value = scale
        tex.inputs["Detail"].default_value = 3
        links.new(coord.outputs["Object"], tex.inputs["Vector"])
        rng = nodes.new("ShaderNodeMapRange")
        rng.inputs["From Min"].default_value = lo
        rng.inputs["From Max"].default_value = hi
        links.new(tex.outputs["Fac"], rng.inputs["Value"])
        return rng.outputs["Result"]

    def tint(color_socket, factor, hex_color: str, mode: str = "MULTIPLY", amount: float = 1.0):
        mix = nodes.new("ShaderNodeMix")
        mix.data_type, mix.blend_type = "RGBA", mode
        if amount != 1.0:
            mul = nodes.new("ShaderNodeMath")
            mul.operation = "MULTIPLY"
            mul.inputs[1].default_value = amount
            links.new(factor, mul.inputs[0])
            factor = mul.outputs["Value"]
        links.new(factor, mix.inputs["Factor"])
        links.new(color_socket, mix.inputs["A"])
        mix.inputs["B"].default_value = S.hex_rgba(hex_color)
        return mix.outputs["Result"]

    color = state["color"]
    color = tint(color, noise_fac(0.06, 0.45, 0.75, 1.0), "#A9D46E", amount=0.6)  # lush patches
    color = tint(color, noise_fac(0.08, 0.5, 0.8, 7.0), "#D8B878", amount=0.45)  # parched patches
    color = tint(color, noise_fac(0.25, 0.55, 0.8, 5.0), "#C8E08A", amount=0.3)  # clover glades
    color = tint(color, noise_fac(0.9, 0.4, 0.7, 3.0), "#8C8C80", amount=0.25)  # fine mottling
    wet_attr = nodes.new("ShaderNodeAttribute")
    wet_attr.attribute_type, wet_attr.attribute_name = "GEOMETRY", "wet"
    color = tint(color, wet_attr.outputs["Fac"], "#6E7660", amount=0.75)
    soot_attr = nodes.new("ShaderNodeAttribute")
    soot_attr.attribute_type, soot_attr.attribute_name = "GEOMETRY", "soot"
    soot_mask = nodes.new("ShaderNodeMath")
    soot_mask.operation = "MULTIPLY"
    links.new(soot_attr.outputs["Fac"], soot_mask.inputs[0])
    links.new(noise_fac(0.7, 0.3, 0.7, 11.0), soot_mask.inputs[1])
    color = tint(color, soot_mask.outputs["Value"], "#2A2A2C", mode="MIX", amount=0.8)
    wet_rough = nodes.new("ShaderNodeMix")
    wet_rough.data_type = "FLOAT"
    links.new(wet_attr.outputs["Fac"], wet_rough.inputs["Factor"])
    links.new(state["roughness"], wet_rough.inputs["A"])
    wet_rough.inputs["B"].default_value = 0.35
    state = {**state, "color": color, "roughness": wet_rough.outputs["Result"]}

    # Fade towards the background beyond the playable map.
    out_attr = nodes.new("ShaderNodeAttribute")
    out_attr.attribute_type, out_attr.attribute_name = "GEOMETRY", "outside"
    fade = nodes.new("ShaderNodeMix")
    fade.data_type = "RGBA"
    links.new(out_attr.outputs["Fac"], fade.inputs["Factor"])
    links.new(state["color"], fade.inputs["A"])
    fade.inputs["B"].default_value = S.hex_rgba(CFG["background"])
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


def _random_colour_material(name: str, colours: list[str], roughness: float = 0.85, constant: bool = False,
                            glossy: bool = False) -> bpy.types.Material:
    """Per-instance colour picked from a ramp by the instance's random value."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes["Principled BSDF"]
    info = nodes.new("ShaderNodeObjectInfo")
    ramp = nodes.new("ShaderNodeValToRGB")
    if constant:
        ramp.color_ramp.interpolation = "CONSTANT"
    elements = ramp.color_ramp.elements
    while len(elements) < len(colours):
        elements.new(0.5)
    for i, c in enumerate(colours):
        elements[i].position = i / len(colours)
        elements[i].color = S.hex_rgba(c)
    links.new(info.outputs["Random"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = roughness
    if glossy:
        bsdf.inputs["Coat Weight"].default_value = 0.8
    return mat


def _blades(name: str, blades: int, r_max: float, h_min: float, h_max: float, width: float,
            mat: bpy.types.Material, salt: int = 0) -> bpy.types.Object:
    """A clump of thin bent blades (source object for scattering)."""
    verts, faces = [], []
    for b in range(blades):
        k = b + salt * 31
        ang = b / blades * math.tau + 0.6 * math.sin(k * 7.1)
        r = r_max * (0.3 + 0.7 * ((k * 37) % 7) / 7)
        h = h_min + (h_max - h_min) * ((k * 53) % 5) / 5
        lean = h * (0.25 + 0.2 * ((k * 11) % 3))
        bx, by = math.cos(ang) * r, math.sin(ang) * r
        dx, dy = math.cos(ang) * lean, math.sin(ang) * lean
        px, py = -math.sin(ang) * width, math.cos(ang) * width
        base = len(verts)
        verts += [(bx - px, by - py, 0), (bx + px, by + py, 0), (bx + dx * 0.5, by + dy * 0.5, h * 0.65), (bx + dx, by + dy, h)]
        faces += [(base, base + 1, base + 2), (base, base + 2, base + 3)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    obj.hide_render = True
    obj.location = (0, 0, -50)
    return obj


def _blob(name: str, radius: float, squash: float, mat: bpy.types.Material, lumps: float = 0.4,
          subdiv: int = 2) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv, radius=radius, location=(0, 0, -50))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (1.0, 0.9, squash)
    if lumps > 0:
        tex = bpy.data.textures.new(name + "Tex", type="VORONOI")
        tex.noise_scale = radius * 0.6
        disp = obj.modifiers.new("Disp", "DISPLACE")
        disp.texture, disp.strength = tex, radius * lumps
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    obj.hide_render = True
    return obj


def _flower(mat) -> bpy.types.Object:
    """A small bloom on a stem, so meadows read as flowers instead of dots on the ground."""
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.04, location=(0, 0, 0))
    head = bpy.context.active_object
    for v in head.data.vertices:
        v.co.z = v.co.z * 0.45 + 0.09
    bpy.ops.mesh.primitive_cylinder_add(vertices=4, radius=0.005, depth=0.09, location=(0, 0, 0.045))
    stem = bpy.context.active_object
    stem.data.materials.append(_random_colour_material("Stem", ["#4A6A2A"]))
    head.data.materials.append(mat)
    bpy.ops.object.select_all(action="DESELECT")
    stem.select_set(True)
    head.select_set(True)
    bpy.context.view_layer.objects.active = head
    bpy.ops.object.join()
    head.name = "Flower"
    head.location = (0, 0, -50)
    head.hide_render = True
    return head


def _leaf(mat) -> bpy.types.Object:
    """A fallen leaf: a flat curled disc lying on the ground."""
    bpy.ops.mesh.primitive_circle_add(vertices=8, radius=0.028, fill_type="NGON", location=(0, 0, -50))
    obj = bpy.context.active_object
    obj.name = "Leaf"
    obj.scale = (1.0, 0.5, 1.0)
    for i, v in enumerate(obj.data.vertices):
        v.co.z = 0.004 + 0.006 * abs(v.co.x) / 0.028
    obj.data.materials.append(mat)
    obj.hide_render = True
    return obj


def _puddle(mat) -> bpy.types.Object:
    bpy.ops.mesh.primitive_circle_add(vertices=24, radius=0.14, fill_type="NGON", location=(0, 0, -50))
    obj = bpy.context.active_object
    obj.name = "Puddle"
    obj.scale = (1.0, 0.65, 1.0)
    for i, v in enumerate(obj.data.vertices):
        v.co.x *= 1 + 0.25 * math.sin(i * 1.7)
        v.co.y *= 1 + 0.25 * math.cos(i * 2.3)
        v.co.z = 0.004
    obj.data.materials.append(mat)
    obj.hide_render = True
    return obj


def scatter(terrain: bpy.types.Object) -> None:
    """Hair-particle instancing of vegetation and ground detail; density from terrain layers."""
    mesh = terrain.data
    n = len(mesh.vertices)
    names = ("dry", "dirt", "coal", "gravel", "cobble", "rock", "forest", "outside", "wet", "soot", "field")
    L = {k: ([v.value for v in mesh.attributes[k].data] if k in mesh.attributes else [0.0] * n) for k in names}
    dens = {k: [0.0] * n for k in ("grass", "lush", "tall", "bush", "fern", "flower", "leaf", "reed", "puddle", "pebble", "wheat")}
    for i, v in enumerate(mesh.vertices):
        bare = max(L["dirt"][i], L["coal"][i], L["gravel"][i], L["cobble"][i], L["rock"][i], L["field"][i])
        water = 1.0 if v.co.z < -0.05 else 0.0
        alive = (1 - bare) * (1 - water) * (1 - L["outside"][i]) * (1 - 0.7 * L["soot"][i])
        wild = noise.noise(Vector((v.co.x * 0.25, v.co.y * 0.25, 5.0))) * 0.5 + 0.5
        dens["grass"][i] = alive * (0.6 + 0.4 * L["dry"][i])
        dens["tall"][i] = alive * (0.1 + 0.9 * L["dry"][i]) * wild ** 2
        dens["bush"][i] = alive * (0.2 + 0.8 * L["forest"][i]) * wild ** 2
        # Flowers grow in clusters (meadow patches), not as uniform noise.
        bloom = max(0.0, noise.noise(Vector((v.co.x * 0.7, v.co.y * 0.7, 13.0))) * 2.4 - 0.35)
        dens["flower"][i] = alive * (1 - L["forest"][i]) * (1 - L["dry"][i] * 0.5) * min(1.0, bloom)
        glade = max(0.0, noise.noise(Vector((v.co.x * 0.4, v.co.y * 0.4, 21.0))) * 1.5)
        dens["lush"][i] = alive * (1 - L["dry"][i]) * min(1.0, glade + 0.6 * L["wet"][i])
        dens["fern"][i] = alive * L["forest"][i] * (0.4 + 0.6 * wild)
        dens["leaf"][i] = (1 - water) * (1 - L["outside"][i]) * (1 - L["cobble"][i]) * (0.15 + 0.85 * L["forest"][i]) * (1 - L["rock"][i])
        dens["reed"][i] = L["wet"][i] ** 1.5 * (1 - water) * (1 - L["cobble"][i]) * (1 - L["rock"][i])
        dens["puddle"][i] = L["coal"][i] * (1 - water) * (1 - L["outside"][i])
        dens["wheat"][i] = L["field"][i] * (1 - water) * (0.5 + 0.5 * wild)
        dens["pebble"][i] = min(1.0, 0.5 * L["dirt"][i] + 0.4 * L["forest"][i] + 0.4 * L["rock"][i] + 0.3 * L["soot"][i]) * (1 - water) * (1 - L["cobble"][i])
    for name, values in dens.items():
        group = terrain.vertex_groups.new(name=name)
        for i, w in enumerate(values):
            if w > 0.02:
                group.add([i], min(1.0, w), "REPLACE")

    blade_mat = _random_colour_material("GrassBlades", ["#3B5A24", "#4A6B2A", "#5B7D31", "#6E8C38", "#86964A", "#55722D"])
    lush_mat = _random_colour_material("LushBlades", ["#3F6A26", "#4F7E2E", "#64923A", "#7AA444"])
    dry_mat = _random_colour_material("DryBlades", ["#8E8048", "#AE9A5C", "#7C7444", "#C2A866"])
    reed_mat = _random_colour_material("Reeds", ["#4E6A36", "#6A7A3E", "#7A6A40"])
    bush_mat = _random_colour_material("Bush", ["#2C4A22", "#3A5A2A", "#4A6630", "#34502A", "#5A6E34"], roughness=0.9)
    fern_mat = _random_colour_material("Fern", ["#4E7A2E", "#5E8A36", "#6E9A3E"], roughness=0.8)
    flower_mat = _random_colour_material(
        "Flowers", ["#F4F1E6", "#F0CC3E", "#B27CD0", "#E0503A", "#F4F1E6", "#F2A4C2", "#7EA2E8"], 0.6, constant=True)
    leaf_mat = _random_colour_material("Leaves", ["#A0642A", "#C48A3A", "#7A4A22", "#B8A040"], 0.9)
    puddle_mat = _random_colour_material("PuddleWater", ["#1E2427", "#262C2E"], roughness=0.05, glossy=True)
    sources = [
        ("grass", _blades("Clump", 12, 0.07, 0.07, 0.15, 0.016, blade_mat), 300000, 1.0, 1),
        ("lush", _blades("LushClump", 16, 0.09, 0.12, 0.22, 0.014, lush_mat, 7), 60000, 1.0, 8),
        ("tall", _blades("TallClump", 12, 0.07, 0.16, 0.28, 0.012, dry_mat, 3), 36000, 1.0, 2),
        ("reed", _blades("ReedClump", 14, 0.06, 0.3, 0.48, 0.01, reed_mat, 5), 10000, 1.0, 3),
        ("bush", _blob("Bush", 0.15, 0.8, bush_mat, 0.7), 4200, 1.0, 4),
        ("fern", _blades("Fern", 7, 0.02, 0.08, 0.12, 0.03, fern_mat, 9), 22000, 1.0, 9),
        ("flower", _flower(flower_mat), 55000, 1.0, 5),
        ("leaf", _leaf(leaf_mat), 26000, 1.0, 10),
        ("puddle", _puddle(puddle_mat), 260, 1.0, 6),
        ("pebble", _blob("Pebble", 0.05, 0.45, M.district_materials()["stone"], 0.2, 1), 16000, 1.0, 7),
        ("wheat", _blades("WheatClump", 14, 0.06, 0.18, 0.3, 0.012,
                          _random_colour_material("Wheat", ["#D8B04E", "#C89A3A", "#E6C46A", "#B8903A"]), 11),
         140000 if "field" in LAYERS else 0, 1.0, 11),
    ]
    veg = CFG.get("vegetation", 1.0)
    for name, obj, count, size, seed in sources:
        if name in ("grass", "lush", "flower", "fern", "tall", "leaf", "bush", "reed"):
            count = int(count * veg)
        if count == 0:
            continue
        mod = terrain.modifiers.new(name, "PARTICLE_SYSTEM")
        settings = mod.particle_system.settings
        settings.type = "HAIR"
        settings.use_advanced_hair = True
        settings.count = count
        settings.hair_length = 1.0
        settings.render_type = "OBJECT"
        settings.instance_object = obj
        settings.particle_size = size
        settings.size_random = 0.6 if name != "puddle" else 0.5
        settings.use_rotations = True
        settings.rotation_mode = "OB_Z"
        settings.phase_factor_random = 2.0
        settings.distribution = "RAND"
        settings.use_emit_random = True
        mod.particle_system.vertex_group_density = name
        mod.particle_system.seed = seed * 17


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


def build_fords(mats) -> None:
    """Stepping stones across the river fords of the arena (shallow cells in the river bed)."""
    k = 0
    for y in range(H):
        rx = 6 + y * 0.55 + 2.0 * math.sin(y / 4.5)
        for x in range(W):
            if code_at(x, y) == "w" and abs(x - rx) < 0.7:
                for j in range(3):
                    ox = 0.3 * noise.noise(Vector((x + j, y, 1.0)))
                    oy = -0.33 + j * 0.33
                    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.16, location=(x + ox, -(y + oy), -0.1))
                    st = bpy.context.active_object
                    st.name = f"Stone{k}"
                    st.scale = (1.2, 1.0, 0.45)
                    st.data.materials.append(mats["stone"])
                    k += 1


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
    parser.add_argument("--map", default="d12", choices=list(MAPS))
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
        full = ROOT / f"assets/build/terrain_{MAP}_{args.scale:g}x.png"
        old = json.loads((ROOT / CFG["out"] / f"{args.scale:g}x/manifest.json").read_text())
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
    if MAP == "d12":
        build_railway(mats)
        build_bridges(mats)
    else:
        build_fords(mats)

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
    full = build_dir / f"terrain_{MAP}_{s:g}x.png"
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
    folder = ROOT / CFG["out"] / f"{scale:g}x"
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
        "background": CFG["background"],
    }
    (folder / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf8")
    print(f"wrote {cols}x{rows} chunks to {folder}")


if __name__ == "__main__":
    main()
