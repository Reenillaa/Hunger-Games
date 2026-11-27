"""
District terrain as a low-poly diorama (DECISIONS I-81), rendered with the same engine, sun and
look as the sprites, so the ground and the models are one piece: an irregular faceted mesh
built on the game's own relief (export_relief.ts), colours by terrain with natural (warped)
borders, the river sunk into its bed under a water surface, and real Kenney pieces baked in
(grass, flowers, stones, coal, the mountain's pine woods and boulders, the tunnel, the cobbled
plaza, the railway and the bridges) with their shadows and ambient occlusion.

Paths are NOT baked: the game draws every path (template and laid in play) over this image.

  node tools/art/export_relief.ts d12 > assets/build/relief_d12.json
  python tools/art/render_terrain_lp.py --map d12 [--scale 0.75] [--samples 16] [--preview] [--crop x0 y0 x1 y1]

Blender world: cell (x, y) centre = (X = x, Y = -y); one cell = one unit; Z = height in cells.
"""

from __future__ import annotations

import argparse
import json
import math
import pathlib
import random
import sys
import time

import bpy
from mathutils import Vector, noise

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib import scene as S  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[2]
MODELS = ROOT / "assets/models"
N = "kenney_nature-kit/glb"
TOWN = "kenney_fantasy-town-kit/glb"
TRAIN = "kenney_train-kit/glb"

# Flat-colour materials of the nature kit, mapped to the game's palette (same as the sprites).
PALETTE_SWAPS = [
    ("leafsdark", "#3F7F2E"), ("leafsfall", "#D9822B"), ("leafs", "#5FAE3E"), ("grass", "#6DBB45"),
    ("bark", "#7A4E33"), ("wooddark", "#5E3B26"), ("wood", "#A36B42"), ("stonedark", "#6E7078"),
    ("stone", "#9A9CA3"), ("rock", "#8E9097"), ("dirt", "#9C7448"), ("sand", "#E1C98F"),
    ("flower", "#E34B5C"), ("yellow", "#F2C14E"), ("purple", "#9C5BD4"), ("red", "#D8433A"),
    ("mushroom", "#D8433A"),
]
ROCK = {"dirt": "#8C8880", "grass": "#5E9440"}
COAL = {"dirt": "#2F2C2A", "grass": "#3B3735"}
TUNNEL = {"dirt": "#736D65", "grass": "#558A3B"}

# Ground colours (sRGB), the District 12 palette of the painter.
C = {
    "grass": "#69AA44", "grass2": "#76B44B", "grassDry": "#8DAA4E", "forest": "#548F37",
    "moss": "#5A9640", "mossDark": "#4B8236", "rock": "#8F887D", "rock2": "#7B746A",
    "rock3": "#A29B8F", "dirt": "#A88A66", "dirt2": "#9A7D5B", "trodden": "#94795A",
    "scree": "#A29C8F", "coal": "#3D3936", "sand": "#D8C48E", "bed": "#8C7A5A",
    "beyond": "#4F8A3A", "beyond2": "#5C963F",
}


# --------------------------------------------------------------------------------- helpers
def lin(hex_: str) -> tuple[float, float, float]:
    r, g, b, _ = S.hex_rgba(hex_)
    return (r, g, b)


def mix(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def smooth(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def fbm(x, y, seed=0.0, octaves=3):
    s, amp, norm, f = 0.0, 0.5, 0.0, 1.0
    for o in range(octaves):
        s += noise.noise(Vector((x * f, y * f, seed + o * 3.7))) * amp
        norm += amp
        amp *= 0.5
        f *= 2.0
    return 0.5 + 0.5 * s / norm


def hash2(x, y, k=0.0):
    v = math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453
    return v - math.floor(v)


# --------------------------------------------------------------------------------- the map
class Map:
    def __init__(self, data: dict) -> None:
        self.W, self.H = data["width"], data["height"]
        self.terrain = data["terrain"]
        self.corners = data["corners"]
        self.peak = max(max(r) for r in self.corners)

    def code(self, x: int, y: int) -> str:
        if 0 <= x < self.W and 0 <= y < self.H:
            return self.terrain[y][x]
        return "X"

    def inside(self, u: float, v: float) -> bool:
        return -0.5 <= u <= self.W - 0.5 and -0.5 <= v <= self.H - 0.5

    def relief(self, u: float, v: float) -> float:
        """The game's surface height (bilinear on the corner heights, like Relief.at)."""
        a = min(float(self.W), max(0.0, u + 0.5))
        b = min(float(self.H), max(0.0, v + 0.5))
        i = min(self.W - 1, int(math.floor(a)))
        j = min(self.H - 1, int(math.floor(b)))
        fx, fy = a - i, b - j
        c = self.corners
        p, q, r, s = c[j][i], c[j][i + 1], c[j + 1][i], c[j + 1][i + 1]
        return p + (q - p) * fx + (r - p) * fy + (p - q - r + s) * fx * fy

    def wet(self, u: float, v: float) -> float:
        """0..1: how much a point lies in the river (bilinear on water cell centres)."""
        i, j = math.floor(u), math.floor(v)
        fx, fy = u - i, v - j
        w = lambda x, y: 1.0 if self.code(x, y) in "wb" else 0.0  # noqa: E731
        a, b, c, d = w(i, j), w(i + 1, j), w(i, j + 1), w(i + 1, j + 1)
        return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy

    def height(self, u: float, v: float) -> float:
        if self.inside(u, v):
            h = self.relief(u, v)
        else:
            # Beyond the edge the land goes on: the edge's height, rising gently, under the mist.
            cu = min(self.W - 0.5, max(-0.5, u))
            cv = min(self.H - 0.5, max(-0.5, v))
            d = math.hypot(u - cu, v - cv)
            h = self.relief(cu, cv) + d * 0.12 + (fbm(u * 0.2, v * 0.2, 9) - 0.5) * 1.2 * min(1.0, d / 3)
            h = max(0.0, h)
        wv = self.wet(u, v)
        if wv > 0:
            h -= 0.34 * smooth(0.25, 0.95, wv)
        return h


# ----------------------------------------------------------------------------- the terrain
def build_terrain(m: Map, B: int, step: float) -> bpy.types.Object:
    u0, v0 = -B - 0.5, -B - 0.5
    nu = int(round((m.W + 2 * B) / step)) + 1
    nv = int(round((m.H + 2 * B) / step)) + 1
    verts, coords = [], []
    for j in range(nv):
        for i in range(nu):
            u = u0 + i * step
            v = v0 + j * step
            if 0 < i < nu - 1 and 0 < j < nv - 1:
                # Irregular facets: every vertex nudged a little (no visible grid).
                u += (hash2(i, j, 1) - 0.5) * step * 0.62
                v += (hash2(i, j, 2) - 0.5) * step * 0.62
            coords.append((u, v))
            verts.append((u, -v, m.height(u, v)))
    faces = []
    for j in range(nv - 1):
        for i in range(nu - 1):
            a = j * nu + i
            b, c, d = a + 1, a + nu + 1, a + nu
            if hash2(i, j, 3) < 0.5:
                faces += [(a, d, b), (b, d, c)]
            else:
                faces += [(a, d, c), (a, c, b)]
    mesh = bpy.data.meshes.new("Terrain")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    col = mesh.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    for poly in mesh.polygons:
        cu = sum(coords[k][0] for k in poly.vertices) / 3
        cv = sum(coords[k][1] for k in poly.vertices) / 3
        z = sum(verts[k][2] for k in poly.vertices) / 3
        rgb = face_colour(m, cu, cv, z, poly.normal)
        for li in poly.loop_indices:
            col.data[li].color = (*rgb, 1.0)
    obj = bpy.data.objects.new("Terrain", mesh)
    bpy.context.scene.collection.objects.link(obj)
    mat = bpy.data.materials.new("TerrainMat")
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes["Principled BSDF"]
    attr = nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Col"
    links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.92
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.2
    obj.data.materials.append(mat)
    return obj


def face_colour(m: Map, u: float, v: float, z: float, normal) -> tuple[float, float, float]:
    steep = 1 - abs(normal.z)
    # Borders follow a warped lookup, so grass, earth and scree meet in natural curves.
    wu = u + (fbm(u * 0.33, v * 0.33, 1) - 0.5) * 1.3 + (fbm(u * 1.1, v * 1.1, 21) - 0.5) * 0.35
    wv = v + (fbm(u * 0.33, v * 0.33, 2) - 0.5) * 1.3 + (fbm(u * 1.1, v * 1.1, 22) - 0.5) * 0.35
    own = m.code(round(u), round(v))
    code = own if own in "Rptwb" else m.code(round(wu), round(wv))
    if own == "p":
        # Grey grout between the plaza's flagstones.
        base = mix(lin("#7E776B"), lin("#8A8377"), fbm(u * 0.9, v * 0.9, 14))
    elif own in "wb" or m.wet(u, v) > 0.35:
        base = lin(C["bed"]) if z < -0.12 else lin(C["sand"])
    elif own == "X":
        base = mix(lin(C["beyond"]), lin(C["beyond2"]), fbm(u * 0.15, v * 0.15, 3))
        if steep > 0.4:
            base = mix(base, lin(C["rock2"]), 0.6)
    elif code == "R" or z > 0.35:
        band = 0.5 + 0.5 * math.sin(z * 4.0 + fbm(u, v, 4) * 3)
        face = mix(mix(lin(C["rock2"]), lin(C["rock"]), band), lin(C["rock3"]), smooth(0.6, 0.8, fbm(u * 0.4, v * 0.4, 5)) * 0.6)
        top = mix(lin(C["mossDark"]), lin(C["moss"]), fbm(u * 0.5, v * 0.5, 6))
        top = mix(top, lin(C["rock3"]), smooth(0.64, 0.8, fbm(u * 0.3, v * 0.3, 7)) * 0.7)
        if code == "f":
            top = mix(lin(C["forest"]), lin(C["moss"]), 0.4)
        base = mix(top, face, smooth(0.18, 0.4, steep))
    elif code == "f":
        base = mix(lin(C["forest"]), lin(C["grass"]), fbm(u * 0.4, v * 0.4, 8) * 0.6)
    elif code == "g" or code == "c":
        base = mix(lin(C["grass"]), lin(C["grass2"]), smooth(0.35, 0.65, fbm(u * 0.18, v * 0.18, 9)))
        base = mix(base, lin(C["grassDry"]), smooth(0.62, 0.8, fbm(u * 0.11, v * 0.11, 10)) * 0.6)
    elif code == "s":
        base = mix(lin(C["scree"]), lin(C["dirt2"]), fbm(u * 0.5, v * 0.5, 11) * 0.4)
    elif code == "v":
        base = mix(lin(C["coal"]), lin(C["scree"]), 0.25 + smooth(0.4, 0.7, fbm(u * 0.8, v * 0.8, 12)) * 0.45)
    else:  # earth: around houses, under paths, the plaza and the rails
        base = mix(lin(C["dirt"]), lin(C["dirt2"]), fbm(u * 0.35, v * 0.35, 13))
        if code in "prt":
            base = mix(base, lin(C["trodden"]), 0.5)
        # Grass takes the bare earth back away from the paths and the plaza.
        if code == "d" and not near(m, round(wu), round(wv), "prt") and fbm(u * 0.21, v * 0.21, 41) > 0.52:
            base = mix(lin(C["grass"]), lin(C["grass2"]), 0.4)
    jitter = 0.97 + hash2(u * 3.1, v * 2.7, 5) * 0.06
    return tuple(min(1.0, ch * jitter) for ch in base)


def near(m: Map, x: int, y: int, codes: str, r: int = 1) -> bool:
    return any(m.code(x + dx, y + dy) in codes for dx in range(-r, r + 1) for dy in range(-r, r + 1))


def build_water(m: Map, B: int) -> None:
    mesh = bpy.data.meshes.new("Water")
    size = m.W + 2 * B
    mesh.from_pydata(
        [(-B - 0.5, B + 0.5, -0.07), (m.W + B - 0.5, B + 0.5, -0.07),
         (m.W + B - 0.5, -(m.H + B - 0.5), -0.07), (-B - 0.5, -(m.H + B - 0.5), -0.07)],
        [], [(0, 1, 2, 3)])
    obj = bpy.data.objects.new("Water", mesh)
    bpy.context.scene.collection.objects.link(obj)
    mat = bpy.data.materials.new("WaterMat")
    mat.use_nodes = True
    b = mat.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = S.hex_rgba("#2F9AD0")
    b.inputs["Roughness"].default_value = 0.22
    if "Specular IOR Level" in b.inputs:
        b.inputs["Specular IOR Level"].default_value = 0.35
    obj.data.materials.append(mat)
    _ = size


# ------------------------------------------------------------------------------ the pieces
_LIB: dict[str, tuple[bpy.types.Mesh, float]] = {}


def model(rel: str, swaps: dict | None = None, grade: tuple | None = None) -> tuple[bpy.types.Mesh, float]:
    """Imports a Kenney model once, merged into one mesh (instanced afterwards). Returns the
    mesh and its height."""
    key = f"{rel}:{sorted((swaps or {}).items())}:{grade}"
    if key in _LIB:
        return _LIB[key]
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(MODELS / rel))
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == "MESH"]
    for o in meshes:
        for slot in o.material_slots:
            mat = slot.material
            if not mat or not mat.node_tree or "Principled BSDF" not in mat.node_tree.nodes:
                continue
            # Unique copy per recolour so other users of the material keep theirs.
            mat = mat.copy()
            slot.material = mat
            b = mat.node_tree.nodes["Principled BSDF"]
            base = b.inputs["Base Color"]
            name = mat.name.lower()
            if base.is_linked and grade:
                nodes, links = mat.node_tree.nodes, mat.node_tree.links
                src = base.links[0].from_socket
                hs = nodes.new("ShaderNodeHueSaturation")
                hs.inputs["Hue"].default_value = 0.5 + grade[0]
                hs.inputs["Saturation"].default_value = grade[1]
                hs.inputs["Value"].default_value = grade[2]
                links.new(src, hs.inputs["Color"])
                links.new(hs.outputs["Color"], base)
            elif not base.is_linked:
                swap = next((c for k, c in (swaps or {}).items() if k in name), None)
                if not swap:
                    swap = next((c for k, c in PALETTE_SWAPS if k in name), None)
                if swap:
                    base.default_value = S.hex_rgba(swap)
            b.inputs["Roughness"].default_value = 0.85
            if "Specular IOR Level" in b.inputs:
                b.inputs["Specular IOR Level"].default_value = 0.25
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    for o in meshes:
        # Bake parent transforms into the meshes before joining.
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = mw
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    zs = [v.co.z for v in obj.data.vertices]
    mesh = obj.data
    height = max(zs) - min(zs)
    for o in new:
        if o.name in bpy.data.objects and o != obj:
            bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.objects.remove(obj, do_unlink=True)
    _LIB[key] = (mesh, height)
    return _LIB[key]


_COUNT = [0]


def place(rel: str, x: float, y: float, z: float, *, height: float | None = None, scale: float = 1.0,
          rot: float = 0.0, swaps: dict | None = None, grade: tuple | None = None) -> None:
    mesh, h = model(rel, swaps, grade)
    k = (height / h) if height else scale
    _COUNT[0] += 1
    o = bpy.data.objects.new(f"P{_COUNT[0]}", mesh)
    o.location = (x, -y, z)
    o.rotation_euler = (0, 0, math.radians(rot))
    o.scale = (k, k, k)
    bpy.context.scene.collection.objects.link(o)


def scatter(m: Map, tunnel: tuple[float, float] | None) -> None:
    rng = random.Random(12)
    grass = [f"{N}/grass_large.glb", f"{N}/grass.glb", f"{N}/grass_leafs.glb"]
    flowers = [f"{N}/flower_redA.glb", f"{N}/flower_yellowB.glb", f"{N}/flower_purpleC.glb"]
    pebbles = [f"{N}/rock_smallA.glb", f"{N}/rock_smallB.glb", f"{N}/rock_smallC.glb"]
    pines = [f"{N}/tree_pineTallA_detailed.glb", f"{N}/tree_pineRoundA.glb", f"{N}/tree_pineSmallA.glb"]

    def spot(x, y, spread=0.42):
        u = x + (rng.random() - 0.5) * 2 * spread
        v = y + (rng.random() - 0.5) * 2 * spread
        return u, v, m.height(u, v)

    for y in range(m.H):
        for x in range(m.W):
            c = m.code(x, y)
            if tunnel and abs(x - tunnel[0]) <= 3 and abs(y - tunnel[1]) <= 3:
                continue
            if c in "gc":
                for _ in range(rng.choice((0, 1, 1, 2))):
                    u, v, z = spot(x, y)
                    place(rng.choice(grass), u, v, z, scale=0.9 + rng.random() * 0.6, rot=rng.random() * 360)
                if rng.random() < 0.05:
                    u, v, z = spot(x, y)
                    place(rng.choice(flowers), u, v, z, height=0.3, rot=rng.random() * 360)
                if rng.random() < 0.03:
                    u, v, z = spot(x, y)
                    place(rng.choice(pebbles), u, v, z, height=0.14, rot=rng.random() * 360, swaps=ROCK)
            elif c == "f":
                for _ in range(rng.choice((1, 2))):
                    u, v, z = spot(x, y)
                    place(f"{N}/grass_leafsLarge.glb", u, v, z, scale=0.9 + rng.random() * 0.5, rot=rng.random() * 360)
                if rng.random() < 0.04:
                    u, v, z = spot(x, y)
                    place(f"{N}/mushroom_redGroup.glb", u, v, z, height=0.18, rot=rng.random() * 360)
            elif c == "d" and not near(m, x, y, "prt"):
                if rng.random() < 0.25:
                    u, v, z = spot(x, y)
                    place(rng.choice(pebbles), u, v, z, height=0.1 + rng.random() * 0.06, rot=rng.random() * 360, swaps=ROCK)
                if rng.random() < 0.2:
                    u, v, z = spot(x, y)
                    place(grass[0], u, v, z, scale=0.8, rot=rng.random() * 360)
            elif c == "s":
                if rng.random() < 0.35:
                    u, v, z = spot(x, y)
                    place(rng.choice(pebbles), u, v, z, height=0.12 + rng.random() * 0.12, rot=rng.random() * 360, swaps=ROCK)
            elif c == "v":
                for _ in range(rng.choice((0, 1, 1, 2))):
                    u, v, z = spot(x, y)
                    place(rng.choice(pebbles), u, v, z, height=0.1 + rng.random() * 0.12, rot=rng.random() * 360, swaps=COAL)
            elif c == "R":
                h = m.relief(x, y)
                if h < 0.6:
                    continue
                e = 0.3
                level = 1 / math.sqrt(1 + ((m.relief(x + e, y) - m.relief(x - e, y)) / (2 * e)) ** 2
                                      + ((m.relief(x, y + e) - m.relief(x, y - e)) / (2 * e)) ** 2)
                wood = math.sin(x * 0.45 + math.cos(y * 0.3) * 2) + math.cos(y * 0.5 - x * 0.2)
                if level > 0.86 and wood > -0.3:
                    for _ in range(rng.choice((1, 1, 2))):
                        if rng.random() < 0.75:
                            u, v, z = spot(x, y, 0.38)
                            place(rng.choice(pines), u, v, z, height=1.6 + rng.random() * 1.2, rot=rng.random() * 360)
                elif level <= 0.86 and rng.random() < 0.1:
                    u, v, z = spot(x, y, 0.3)
                    place(f"{N}/rock_largeA.glb", u, v, z - 0.05, height=0.5 + rng.random() * 0.3, rot=rng.random() * 360, swaps=ROCK)
                if level > 0.86 and rng.random() < 0.6:
                    u, v, z = spot(x, y)
                    place(grass[2], u, v, z, scale=1.1, rot=rng.random() * 360)


def build_pieces(m: Map, tunnel: tuple[float, float] | None) -> None:
    muted = (0.02, 1.0, 0.6)
    for y in range(m.H):
        for x in range(m.W):
            c = m.code(x, y)
            if c == "p":
                # Flagstones: one group of worn slabs per cell, alternating direction.
                for k, (du, dv) in enumerate(((0.0, 0.0),)):
                    r = (hash2(x, y, k) - 0.5) * 8 + (90 if (x + y) % 2 else 0)
                    place(f"{N}/path_stone.glb", x + du, y + dv, 0.0, scale=1.25, rot=r,
                          swaps={"stonedark": "#8E877B", "stone": "#B1AA9C"})
            elif c == "t":
                # One line down the middle of the two-cell-wide railway strip.
                along_y = m.code(x, y - 1) == "t" or m.code(x, y + 1) == "t"
                if along_y and m.code(x + 1, y) == "t" and m.code(x - 1, y) != "t":
                    place(f"{TRAIN}/track-single-detailed.glb", x + 0.5, y, 0.0, scale=1.0, rot=0, grade=muted)
                elif not along_y and m.code(x, y + 1) == "t" and m.code(x, y - 1) != "t":
                    place(f"{TRAIN}/track-single-detailed.glb", x, y + 0.5, 0.0, scale=1.0, rot=90, grade=muted)
            elif c == "b":
                across = 90 if m.code(x - 1, y) in "wb" or m.code(x + 1, y) in "wb" else 0
                place(f"{N}/bridge_wood.glb", x, y, -0.02, scale=1.0, rot=across)
    if tunnel:
        place(f"{N}/cliff_blockCave_rock.glb", tunnel[0], tunnel[1], 0.0, height=2.2, rot=180, swaps=TUNNEL)


def find_tunnel(m: Map) -> tuple[float, float] | None:
    for y in range(1, m.H):
        row = m.terrain[y]
        x = row.find("t")
        if x < 0:
            continue
        if any(m.code(x, y - k) == "R" for k in (1, 2, 3)):
            return (x + 0.5, y - 1.5)
        return None
    return None


# ------------------------------------------------------------------------------------ main
def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    p = argparse.ArgumentParser()
    p.add_argument("--map", default="d12")
    p.add_argument("--scale", type=float, default=0.75)
    p.add_argument("--samples", type=int, default=16)
    p.add_argument("--border", type=int, default=8)
    p.add_argument("--step", type=float, default=0.5)
    p.add_argument("--preview", action="store_true")
    p.add_argument("--crop", type=float, nargs=4)
    args = p.parse_args(argv)
    t0 = time.time()
    data = json.loads((ROOT / f"assets/build/relief_{args.map}.json").read_text())
    m = Map(data)
    B = args.border
    scene = S.reset(args.samples)
    S.add_sun(scene)
    scene.render.film_transparent = False
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = S.hex_rgba("#8E99AB")
    tunnel = find_tunnel(m)
    build_terrain(m, B, args.step)
    build_water(m, B)
    build_pieces(m, tunnel)
    scatter(m, tunnel)
    print(f"scene built: {_COUNT[0]} pieces in {time.time() - t0:.0f}s")

    # Frame the whole domain. Screen (1x world px): x = (cx - cy) * 64, y = (cx + cy) * 32 - z * 78.38.
    s = args.scale
    lo, hi = -B - 0.5, max(m.W, m.H) + B - 0.5
    xs = [(a - b) * 64 for a in (lo, hi) for b in (lo, hi)]
    top = (2 * lo) * 32 - (m.peak + 3.5) * 78.38
    bottom = (2 * hi) * 32 + 40
    res_x = int(round((max(xs) - min(xs)) * s))
    res_y = int(round((bottom - top) * s))
    centre_y = (top + bottom) / 2  # world px; screen x centre is 0
    # A ground point with screen (0, centre_y): cx = cy = centre_y / 64.
    d = centre_y / 64
    cam = S.add_iso_camera(scene, Vector((d, -d, 0.0)), res_x, res_y, s)
    if args.crop:
        x0, y0, x1, y1 = args.crop
        scene.render.use_border, scene.render.use_crop_to_border = True, True
        scene.render.border_min_x, scene.render.border_max_x = x0, x1
        scene.render.border_min_y, scene.render.border_max_y = 1 - y1, 1 - y0
    scene.render.image_settings.color_mode = "RGB"
    out = ROOT / f"assets/build/terrain_lp_{args.map}_{s:g}x{'_crop' if args.crop else ''}.png"
    scene.render.filepath = str(out)
    bpy.ops.render.render(write_still=True)
    ax, ay = S.anchor_px(scene, cam, Vector((0, 0, 0)))
    print(f"rendered {res_x}x{res_y} in {time.time() - t0:.0f}s; anchor of cell (0,0) = ({ax:.1f}, {ay:.1f})")
    if args.preview or args.crop:
        return
    write_chunks(out, args.map, s, (ax, ay), res_x, res_y)


def write_chunks(full: pathlib.Path, map_id: str, scale: float, anchor, res_x: int, res_y: int) -> None:
    from PIL import Image

    img = Image.open(full).convert("RGB")
    for k, im in ((scale, img), (scale / 2, img.resize((res_x // 2, res_y // 2), Image.LANCZOS))):
        folder = ROOT / f"public/assets/district/terrain/{map_id}/{'hi' if k == scale else 'lo'}"
        folder.mkdir(parents=True, exist_ok=True)
        for old in folder.glob("*.webp"):
            old.unlink()
        tile = 2048
        w, h = im.size
        cols, rows = math.ceil(w / tile), math.ceil(h / tile)
        for r in range(rows):
            for c in range(cols):
                box = (c * tile, r * tile, min((c + 1) * tile + 2, w), min((r + 1) * tile + 2, h))
                im.crop(box).save(folder / f"t_{r}_{c}.webp", "WEBP", quality=86, method=6)
        f = k / scale
        manifest = {"scale": k, "tile": tile, "cols": cols, "rows": rows, "width": w, "height": h,
                    "originAnchor": [round(anchor[0] * f, 2), round(anchor[1] * f, 2)]}
        (folder / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf8")
        print(f"wrote {cols}x{rows} chunks to {folder}")


if __name__ == "__main__":
    main()
