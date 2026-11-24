"""
The map of La Concordia for the start screen: a painted fantasy map on aged parchment, lying on a
table under warm candle light. Two steps:

  1. Paint (numpy + Pillow): coastlines in ink with ripple lines, watercolour biomes, mountain
     hachures, stippled forests, rivers, the regime's railways, a compass rose, stains and folds.
  2. Render (Blender Cycles): the parchment as a displaced sheet (relief, creases, curled edges)
     on a dark wooden table, then project every place to screen coordinates for the HTML overlay.

  python tools/art/render_world_map.py [--samples 64] [--paint-only]

Outputs: public/assets/ui/worldmap.jpg (+ _small), src/content/maps/world.json (marker positions).
"""

from __future__ import annotations

import argparse
import json
import math
import pathlib
import sys

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parents[2]
BUILD = ROOT / "assets/build"
W, H = 3200, 1800  # painted texture (16:9 like the sheet)
HW, HH = 1600, 900  # height map

# Places in map coordinates (u right, v down, 0..1). Áurea sits on a plateau in the spine.
PLACES = {
    "aurea": (0.37, 0.40),
    "d1": (0.27, 0.31),
    "d2": (0.42, 0.22),
    "d3": (0.53, 0.33),
    "d4": (0.135, 0.59),
    "d5": (0.55, 0.50),
    "d6": (0.45, 0.60),
    "d7": (0.69, 0.21),
    "d8": (0.66, 0.42),
    "d9": (0.60, 0.70),
    "d10": (0.40, 0.77),
    "d11": (0.76, 0.69),
    "d12": (0.83, 0.33),
}
SPINE = [(0.26, 0.12), (0.31, 0.22), (0.35, 0.33), (0.38, 0.43), (0.33, 0.55), (0.31, 0.66), (0.24, 0.80)]
EAST_HIGHLANDS = (0.84, 0.31)
RIVERS = [
    [(0.36, 0.47), (0.44, 0.52), (0.55, 0.53), (0.66, 0.58), (0.80, 0.60), (0.95, 0.56)],
    [(0.34, 0.62), (0.28, 0.66), (0.20, 0.66), (0.10, 0.63)],
    [(0.82, 0.37), (0.80, 0.48), (0.86, 0.56), (0.95, 0.56)],
    [(0.42, 0.25), (0.52, 0.27), (0.62, 0.30), (0.72, 0.28), (0.80, 0.18), (0.86, 0.08)],
]


def value_noise(w: int, h: int, cells: int, rng: np.random.Generator) -> np.ndarray:
    gh = max(2, round(cells * h / w)) + 1
    grid = rng.random((gh, cells + 1)).astype(np.float32)
    img = Image.fromarray(grid).resize((w, h), Image.BICUBIC)
    return np.asarray(img, dtype=np.float32)


def fbm(w: int, h: int, seed: int, base: int = 6, octaves: int = 6, gain: float = 0.5) -> np.ndarray:
    rng = np.random.default_rng(seed)
    total = np.zeros((h, w), np.float32)
    amp, norm = 1.0, 0.0
    for o in range(octaves):
        total += amp * value_noise(w, h, base * 2**o, rng)
        norm += amp
        amp *= gain
    return total / norm


def grid(w: int, h: int):
    u = (np.arange(w, dtype=np.float32) + 0.5) / w
    v = (np.arange(h, dtype=np.float32) + 0.5) / h
    return np.meshgrid(u, v)


def blob(u, v, cx, cy, r):
    return np.exp(-(((u - cx) * 16 / 9) ** 2 + (v - cy) ** 2) / (r * r))


def dist_to_polyline(u, v, pts):
    best = np.full(u.shape, 9.0, np.float32)
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        dx, dy = (x1 - x0) * 16 / 9, y1 - y0
        px, py = (u - x0) * 16 / 9, v - y0
        t = np.clip((px * dx + py * dy) / (dx * dx + dy * dy), 0, 1)
        d = np.hypot(px - t * dx, py - t * dy)
        best = np.minimum(best, d)
    return best


def land_and_height(w: int, h: int):
    u, v = grid(w, h)
    n = fbm(w, h, 7, base=3, octaves=4)
    jag = fbm(w, h, 8, base=28, octaves=4)
    shape = 1 - ((u - 0.5) / 0.41) ** 2 - ((v - 0.49) / 0.39) ** 2
    shape += (n - 0.5) * 2.0 + (jag - 0.5) * 0.55
    # A peninsula to the north-west and one to the south-east; islands in the eastern sea.
    shape += 0.7 * blob(u, v, 0.16, 0.22, 0.07) + 0.6 * blob(u, v, 0.84, 0.86, 0.06)
    for ix, iy, ir in ((0.93, 0.36, 0.025), (0.95, 0.45, 0.018), (0.90, 0.80, 0.02), (0.07, 0.86, 0.02), (0.60, 0.95, 0.015)):
        shape += 0.9 * blob(u, v, ix, iy, ir * 1.8)
    # Bays and gulfs; the western gulf gives Marea its harbour, the south-east a long inlet.
    shape -= 1.3 * blob(u, v, 0.06, 0.58, 0.075) + 0.7 * blob(u, v, 0.92, 0.62, 0.06)
    shape -= 0.6 * blob(u, v, 0.55, 0.93, 0.08) + 0.5 * blob(u, v, 0.97, 0.15, 0.08)
    for key, (px, py) in PLACES.items():
        if key != "d4":
            shape += 0.6 * blob(u, v, px, py, 0.06)
    shape += 0.25 * blob(u, v, 0.17, 0.60, 0.03)
    land = shape > 0
    # Relief: the spine, the eastern highlands, rolling lowlands; Áurea flattened into a plateau.
    ridge = 1 - np.abs(fbm(w, h, 11, base=10, octaves=5) * 2 - 1)
    warp = (fbm(w, h, 17, base=6, octaves=3) - 0.5) * 0.08
    spine = np.exp(-((dist_to_polyline(u, v, SPINE) + warp) / 0.075) ** 2)
    spine = np.maximum(spine, 0)
    east = blob(u, v, *EAST_HIGHLANDS, 0.11)
    height = (0.15 + 0.85 * ridge**2) * (0.95 * spine + 0.7 * east) + 0.06 * fbm(w, h, 13, base=14)
    plateau = blob(u, v, *PLACES["aurea"], 0.035)
    height = height * (1 - plateau) + 0.55 * plateau
    height *= np.clip(shape * 6, 0, 1)
    return u, v, land, np.clip(height, 0, 1).astype(np.float32), shape


def rgb(hex_color: str) -> np.ndarray:
    hex_color = hex_color.lstrip("#")
    return np.array([int(hex_color[i:i + 2], 16) for i in (0, 2, 4)], np.float32)


def mix(a: np.ndarray, color: np.ndarray, t: np.ndarray) -> np.ndarray:
    return a * (1 - t[..., None]) + color * t[..., None]


def paint() -> None:
    BUILD.mkdir(parents=True, exist_ok=True)
    u, v, land, height, shape = land_and_height(W, H)
    rng = np.random.default_rng(3)
    # Parchment: warm base, fibres, blotches, darker towards the burnt edges.
    fibres = fbm(W, H, 21, base=180, octaves=3)
    blotch = fbm(W, H, 23, base=5, octaves=5)
    img = np.empty((H, W, 3), np.float32)
    img[:] = rgb("#E7D3A6")
    img = mix(img, rgb("#C9AE79"), np.clip((blotch - 0.45) * 2.2, 0, 1) * 0.55)
    img = mix(img, rgb("#F3E6C4"), np.clip((0.45 - blotch) * 2.0, 0, 1) * 0.5)
    img *= (0.94 + 0.12 * fibres)[..., None]
    # Sea: a cold wash, deeper away from the coast.
    landf = land.astype(np.float32)
    mask_img = Image.fromarray((landf * 255).astype(np.uint8))
    near = np.asarray(mask_img.filter(ImageFilter.GaussianBlur(40)), np.float32) / 255
    sea = 1 - landf
    img = mix(img, rgb("#8FA6A0"), sea * (0.38 + 0.25 * (1 - near)))
    # Biomes on land: northern forests, golden plains, orchards, umber mountains.
    forest = np.clip(blob(u, v, 0.68, 0.22, 0.17) + blob(u, v, 0.50, 0.14, 0.10) + 0.8 * blob(u, v, 0.20, 0.40, 0.09)
                     + 0.7 * blob(u, v, 0.86, 0.45, 0.07) + 0.6 * blob(u, v, 0.50, 0.42, 0.06), 0, 1)
    forest *= np.clip((fbm(W, H, 31, base=12) - 0.35) * 3, 0, 1)
    plains = np.clip(blob(u, v, 0.55, 0.72, 0.16) + blob(u, v, 0.40, 0.76, 0.12), 0, 1)
    orchard = blob(u, v, 0.76, 0.70, 0.08)
    lowland = fbm(W, H, 33, base=9, octaves=4)
    img = mix(img, rgb("#A7AD72"), landf * (0.25 + 0.25 * lowland))
    img = mix(img, rgb("#7E9257"), landf * np.clip((lowland - 0.55) * 3, 0, 1) * 0.35)
    img = mix(img, rgb("#6E8449"), landf * forest * 0.55)
    img = mix(img, rgb("#D2B25E"), landf * plains * 0.45)
    img = mix(img, rgb("#8FA559"), landf * orchard * 0.5)
    img = mix(img, rgb("#8C6A45"), landf * np.clip(height * 1.6 - 0.15, 0, 1) * 0.6)
    img = mix(img, rgb("#E9E2D2"), landf * np.clip(height * 3 - 2.2, 0, 1) * 0.7)  # snow caps

    # Ink layer drawn with Pillow on top.
    base = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    ink = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ink)
    INK = (52, 38, 26)
    # Coastal ripple lines (classic fantasy cartography).
    for radius, alpha in ((14, 150), (30, 110), (52, 80), (80, 55)):
        grown = np.asarray(mask_img.filter(ImageFilter.GaussianBlur(radius)), np.float32) / 255
        ring = Image.fromarray(((grown > 0.06) * 255).astype(np.uint8))
        edge = ImageChops.difference(ring, ring.filter(ImageFilter.MinFilter(3)))
        layer = Image.new("RGBA", (W, H), (60, 78, 80, alpha))
        ink.paste(layer, (0, 0), edge)
    # The coastline itself: a bold ink line.
    coast = ImageChops.difference(mask_img, mask_img.filter(ImageFilter.MinFilter(7)))
    ink.paste(Image.new("RGBA", (W, H), INK + (235,)), (0, 0), coast)
    # Mountain hachures: little peaks drawn where the relief is high.
    pts = rng.random((9000, 2))
    for px, py in pts:
        x, y = int(px * W), int(py * H)
        hgt = height[y, x]
        if not land[y, x] or hgt < 0.32 or rng.random() > hgt:
            continue
        s = 10 + 26 * hgt
        d.line([(x - s, y + s * 0.35), (x, y - s * 0.55), (x + s * 0.8, y + s * 0.35)], fill=INK + (200,), width=3)
        d.line([(x, y - s * 0.55), (x + s * 0.25, y + s * 0.3)], fill=INK + (110,), width=2)
    # Stippled forests: tiny trees.
    for px, py in rng.random((26000, 2)):
        x, y = int(px * W), int(py * H)
        if not land[y, x] or forest[y, x] < 0.35 or height[y, x] > 0.45 or rng.random() > forest[y, x]:
            continue
        s = 7 + rng.random() * 5
        d.polygon([(x, y - s * 1.4), (x - s * 0.7, y + s * 0.3), (x + s * 0.7, y + s * 0.3)], fill=(58, 76, 44, 210), outline=INK + (160,))
        d.line([(x, y + s * 0.3), (x, y + s * 0.8)], fill=INK + (160,), width=2)
    # Plains: short strokes of wheat.
    for px, py in rng.random((9000, 2)):
        x, y = int(px * W), int(py * H)
        if land[y, x] and plains[y, x] > 0.4 and height[y, x] < 0.3 and rng.random() < plains[y, x] * 0.6:
            d.line([(x, y), (x + 5, y - 9)], fill=(120, 92, 40, 140), width=2)
    # Rivers: wobbly ink-blue lines widening towards the sea.
    for river in RIVERS:
        line = []
        for (x0, y0), (x1, y1) in zip(river, river[1:]):
            for k in range(24):
                t = k / 24
                x = x0 + (x1 - x0) * t
                y = y0 + (y1 - y0) * t
                wob = (fbm(64, 1, int(x * 1000 + y * 77), base=4, octaves=2)[0, k % 64] - 0.5) * 0.012
                line.append(((x + wob) * W, (y - wob) * H))
        for i, (a, b) in enumerate(zip(line, line[1:])):
            d.line([a, b], fill=(52, 82, 104, 230), width=int(3 + 6 * i / len(line)))
    # The regime's railways: dashed lines from Áurea to every district.
    ax, ay = PLACES["aurea"]
    for key, (px, py) in PLACES.items():
        if key == "aurea":
            continue
        mx, my = (ax + px) / 2 + (py - ay) * 0.08, (ay + py) / 2 - (px - ax) * 0.08
        prev = None
        for k in range(61):
            t = k / 60
            x = (1 - t) ** 2 * ax + 2 * (1 - t) * t * mx + t * t * px
            y = (1 - t) ** 2 * ay + 2 * (1 - t) * t * my + t * t * py
            p = (x * W, y * H)
            if prev and k % 2 == 0:
                d.line([prev, p], fill=(128, 34, 30, 200), width=4)
            prev = p
    # Compass rose in the south-western sea.
    # Compass rose: in the open sea furthest from any coast, near a corner.
    cands = [(0.08, 0.15), (0.08, 0.85), (0.92, 0.14), (0.92, 0.86), (0.5, 0.92), (0.06, 0.5)]
    bx, by = max(cands, key=lambda c: -near[int(c[1] * H), int(c[0] * W)])
    cx, cy, r = bx * W, by * H, 120
    for k in range(16):
        a = k * math.pi / 8 - math.pi / 2
        length = r if k % 4 == 0 else r * 0.55 if k % 2 == 0 else r * 0.35
        tip = (cx + math.cos(a) * length, cy + math.sin(a) * length)
        side = 0.18 if k % 4 == 0 else 0.12
        l1 = (cx + math.cos(a - math.pi / 2) * r * side, cy + math.sin(a - math.pi / 2) * r * side)
        l2 = (cx + math.cos(a + math.pi / 2) * r * side, cy + math.sin(a + math.pi / 2) * r * side)
        d.polygon([tip, l1, (cx, cy)], fill=(150, 30, 34, 220) if k % 4 == 0 else INK + (200,))
        d.polygon([tip, l2, (cx, cy)], fill=(232, 214, 170, 230), outline=INK + (220,))
    d.ellipse([cx - r * 0.75, cy - r * 0.75, cx + r * 0.75, cy + r * 0.75], outline=INK + (200,), width=3)
    d.ellipse([cx - r * 0.82, cy - r * 0.82, cx + r * 0.82, cy + r * 0.82], outline=INK + (160,), width=2)
    # Double ink frame.
    for inset, width in ((60, 6), (78, 2)):
        d.rectangle([inset, inset, W - inset, H - inset], outline=INK + (210,), width=width)
    # Small ink circles where the towns are (the HTML seals sit on them).
    for key, (px, py) in PLACES.items():
        x, y = px * W, py * H
        rr = 22 if key == "aurea" else 14
        d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=(232, 214, 170, 255), outline=INK + (255,), width=4)
    out = Image.alpha_composite(base.convert("RGBA"), ink)
    # Age it: ink bleeds slightly, the edges burn.
    out = out.filter(ImageFilter.GaussianBlur(0.7)).convert("RGB")
    arr = np.asarray(out, np.float32)
    uu, vv = grid(W, H)
    edge = np.minimum.reduce([uu, 1 - uu, (vv) * 16 / 9, (1 - vv) * 16 / 9])
    burn = np.clip(1 - (edge + (fbm(W, H, 41, base=20, octaves=4) - 0.5) * 0.03) / 0.05, 0, 1)
    arr = mix(arr, rgb("#5A3A1C"), burn**1.5 * 0.85)
    alpha = ((edge + (fbm(W, H, 41, base=20, octaves=4) - 0.5) * 0.03) > 0.004).astype(np.uint8) * 255
    final = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).convert("RGBA")
    final.putalpha(Image.fromarray(alpha))
    final.save(BUILD / "worldmap_paint.png")

    # Height for the sheet: relief + creases from folding + curled edges.
    _, _, _, h_small, _ = land_and_height(HW, HH)
    su, sv = grid(HW, HH)
    crease = sum(np.exp(-((su - c) / 0.003) ** 2) for c in (1 / 3, 2 / 3)) + np.exp(-((sv - 0.5) / 0.005) ** 2)
    curl = np.clip(1 - np.minimum(np.minimum(su, 1 - su) * 16 / 9, np.minimum(sv, 1 - sv)) / 0.04, 0, 1) ** 2
    sheet = 0.5 + 0.35 * h_small - 0.08 * np.clip(crease, 0, 1) + 0.12 * curl + 0.02 * fbm(HW, HH, 51, base=60, octaves=3)
    Image.fromarray((np.clip(sheet, 0, 1) * 65535).astype(np.uint16)).save(BUILD / "worldmap_height.png")
    print("painted", BUILD / "worldmap_paint.png")


def render(samples: int) -> None:
    import bpy
    from bpy_extras.object_utils import world_to_camera_view
    from mathutils import Vector

    sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
    from lib import scene as S  # noqa: E402

    scene = S.reset(samples)
    scene.render.film_transparent = False
    scene.render.resolution_x, scene.render.resolution_y = 2560, 1440
    world = scene.world.node_tree.nodes["Background"]
    world.inputs["Color"].default_value = (0.05, 0.035, 0.025, 1)
    world.inputs["Strength"].default_value = 0.25

    SW, SH, RELIEF = 16.0, 9.0, 0.22
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=800, y_subdivisions=450, size=1)
    sheet = bpy.context.active_object
    sheet.scale = (SW, SH, 1)
    bpy.ops.object.transform_apply(scale=True)
    tex = bpy.data.textures.new("SheetHeight", type="IMAGE")
    tex.image = bpy.data.images.load(str(BUILD / "worldmap_height.png"))
    tex.image.colorspace_settings.name = "Non-Color"
    disp = sheet.modifiers.new("Relief", "DISPLACE")
    disp.texture, disp.texture_coords, disp.strength, disp.mid_level = tex, "UV", RELIEF, 0.5
    bpy.ops.object.shade_smooth()

    mat = bpy.data.materials.new("Parchment")
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes["Principled BSDF"]
    img = nodes.new("ShaderNodeTexImage")
    img.image = bpy.data.images.load(str(BUILD / "worldmap_paint.png"))
    links.new(img.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(img.outputs["Alpha"], bsdf.inputs["Alpha"])
    bsdf.inputs["Roughness"].default_value = 0.78
    bsdf.inputs["Subsurface Weight"].default_value = 0.05
    fib = nodes.new("ShaderNodeTexNoise")
    fib.inputs["Scale"].default_value = 260.0
    fib.inputs["Detail"].default_value = 8
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.12
    links.new(fib.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    sheet.data.materials.append(mat)

    # Dark wooden table under the sheet.
    bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, -0.08))
    table = bpy.context.active_object
    tmat = bpy.data.materials.new("Table")
    tmat.use_nodes = True
    tn, tl = tmat.node_tree.nodes, tmat.node_tree.links
    tb = tn["Principled BSDF"]
    wave = tn.new("ShaderNodeTexWave")
    wave.inputs["Scale"].default_value = 0.6
    wave.inputs["Distortion"].default_value = 6
    wave.inputs["Detail"].default_value = 6
    ramp = tn.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.035, 0.018, 0.009, 1)
    ramp.color_ramp.elements[1].color = (0.11, 0.06, 0.03, 1)
    tl.new(wave.outputs["Fac"], ramp.inputs["Fac"])
    tl.new(ramp.outputs["Color"], tb.inputs["Base Color"])
    tb.inputs["Roughness"].default_value = 0.45
    table.data.materials.append(tmat)

    # Light: a warm key from the upper left at a low angle, two candles, a faint cool fill.
    key = bpy.data.lights.new("Key", type="AREA")
    key.energy, key.size, key.color = 5200, 5, (1.0, 0.82, 0.6)
    ko = bpy.data.objects.new("Key", key)
    ko.location = (-15, 8, 6)
    ko.rotation_euler = (Vector((1, -1, 0)) - ko.location).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(ko)
    for name, loc, energy in (("CandleA", (-8.8, -5.6, 1.4), 260), ("CandleB", (8.9, 5.4, 1.6), 200)):
        c = bpy.data.lights.new(name, type="POINT")
        c.energy, c.color, c.shadow_soft_size = energy, (1.0, 0.55, 0.22), 0.3
        co = bpy.data.objects.new(name, c)
        co.location = loc
        scene.collection.objects.link(co)
    fill = bpy.data.lights.new("Fill", type="AREA")
    fill.energy, fill.size, fill.color = 500, 10, (0.7, 0.8, 1.0)
    fo = bpy.data.objects.new("Fill", fill)
    fo.location = (10, -8, 12)
    fo.rotation_euler = (Vector((0, 0, 0)) - fo.location).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(fo)

    cam_data = bpy.data.cameras.new("Cam")
    cam_data.lens = 50
    cam_data.sensor_width = 36
    cam_data.dof.use_dof = True
    cam_data.dof.aperture_fstop = 5.6
    cam = bpy.data.objects.new("Cam", cam_data)
    cam.location = (0, -7.6, 20.2)
    target = Vector((0, 0.05, 0))
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam_data.dof.focus_distance = (target - cam.location).length
    scene.collection.objects.link(cam)
    scene.camera = cam

    out = BUILD / "worldmap.png"
    scene.render.filepath = str(out)
    bpy.ops.render.render(write_still=True)

    # Project every place onto the screen (the overlay uses these normalised positions).
    hpx = Image.open(BUILD / "worldmap_height.png")
    markers = {}
    for key_, (pu, pv) in PLACES.items():
        hv = hpx.getpixel((min(HW - 1, int(pu * HW)), min(HH - 1, int(pv * HH)))) / 65535
        p = Vector(((pu - 0.5) * SW, (0.5 - pv) * SH, (hv - 0.5) * RELIEF))
        co = world_to_camera_view(scene, cam, p)
        markers[key_] = [round(co.x, 4), round(1 - co.y, 4)]
    data = {"image": "assets/ui/worldmap.jpg", "aspect": 16 / 9, "markers": markers}
    (ROOT / "src/content/maps/world.json").write_text(json.dumps(data, indent=2) + "\n", encoding="utf8")

    target_dir = ROOT / "public/assets/ui"
    target_dir.mkdir(parents=True, exist_ok=True)
    full = Image.open(out).convert("RGB")
    full.save(target_dir / "worldmap.jpg", quality=80, optimize=True, progressive=True)
    full.resize((1280, 720), Image.LANCZOS).save(target_dir / "worldmap_small.jpg", quality=80, optimize=True, progressive=True)
    print("wrote", target_dir / "worldmap.jpg", markers)


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    parser = argparse.ArgumentParser()
    parser.add_argument("--samples", type=int, default=64)
    parser.add_argument("--paint-only", action="store_true")
    parser.add_argument("--render-only", action="store_true")
    args = parser.parse_args(argv)
    if not args.render_only:
        paint()
    if not args.paint_only:
        render(args.samples)
