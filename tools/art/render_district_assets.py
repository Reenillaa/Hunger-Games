"""
Renders the District XII sprite catalogue (buildings and props) at 2x with the four layers
required by ART_BIBLE §11.1 into public/assets/district/sprites/, plus manifest.json.

  python tools/art/render_district_assets.py [--only house_shack,pine_a] [--samples 48]

Every model is built around its footprint centre at the world origin (ground plane z = 0).
Footprint (w, d) is in cells along X (cell x) and -Y (cell y).
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
from lib import kit as K  # noqa: E402
from lib import materials as M  # noqa: E402
from lib import scene as S  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "public/assets/district/sprites"
SCALE = 2.0
SUN_DIR = S.SUN_TRAVEL


# ----------------------------------------------------------------------------- buildings

def with_variant(builder, swaps: dict[str, str]):
    """Same model, different material choices: cheap visual variety for repeated buildings."""
    def build(m):
        builder({**m, **{k: m[v] for k, v in swaps.items()}})
    return build


def house_shack(m) -> None:
    W, D, H = 1.45, 1.25, 0.95
    base = 0.12
    K.box((W + 0.12, D + 0.12, base), (0, 0, base / 2), m["stone"], bevel=0.02, name="Foundation")
    K.box((W - 0.06, D - 0.06, H), (0, 0, base + H / 2), m["soot"], name="Core")
    K.board_wall(Vector((-W / 2, -D / 2, base)), W, H, "x", m["planks"], salt=1, outward=-1)
    K.board_wall(Vector((-W / 2, D / 2, base)), W, H, "x", m["planks"], salt=2, outward=1)
    K.board_wall(Vector((W / 2, -D / 2, base)), D, H, "y", m["planks"], salt=3, outward=1)
    K.board_wall(Vector((-W / 2, -D / 2, base)), D, H, "y", m["planks"], salt=4, outward=-1)
    for x in (-W / 2, W / 2):
        g = K.gable_infill(0.02, D, base + H, 0.5, m["planks"])
        g.location.x = x
    K.sheet_roof(W, D, base + H, 0.5, m["roof_rust"], sheets_per_side=4, salt=7, ridge_mat=m["metal_rust"])
    K.door(Vector((-0.32, -D / 2 - 0.03, base + 0.41)), "-y", m)
    K.window(Vector((0.22, -D / 2 - 0.03, base + 0.55)), "-y", m, lit=False, shutters=True)
    K.window(Vector((W / 2 + 0.03, -0.15, base + 0.55)), "+x", m, lit=True)
    # Stove pipe with cap.
    K.cylinder(0.05, 0.75, (0.45, 0.3, base + H + 0.5), m["iron"], verts=12, name="StovePipe")
    K.cylinder(0.08, 0.03, (0.45, 0.3, base + H + 0.88), m["iron"], verts=12, name="PipeCap")
    K.barrel((W / 2 + 0.2, -D / 2 - 0.18, 0), m)
    K.woodpile((0.25, -D / 2 - 0.25, 0), m, length=0.5, rows=3)
    K.crate((-W / 2 - 0.12, -D / 2 - 0.2, 0), m, s=0.2, rot=0.3)


def house_terrace(m) -> None:
    W, D, H = 2.5, 1.25, 1.0
    base = 0.1
    K.box((W + 0.1, D + 0.1, base), (0, 0, base / 2), m["stone"], name="Foundation")
    K.box((W, D, 0.35), (0, 0, base + 0.175), m["stone"], bevel=0.01, name="StoneSkirt")
    K.box((W - 0.06, D - 0.06, H), (0, 0, base + H / 2), m["soot"], name="Core")
    top = base + 0.35
    K.board_wall(Vector((-W / 2, -D / 2, top)), W, H - 0.35, "x", m["planks_pale"], salt=11, outward=-1)
    K.board_wall(Vector((-W / 2, D / 2, top)), W, H - 0.35, "x", m["planks_pale"], salt=12, outward=1)
    K.board_wall(Vector((W / 2, -D / 2, top)), D, H - 0.35, "y", m["planks_pale"], salt=13, outward=1)
    K.board_wall(Vector((-W / 2, -D / 2, top)), D, H - 0.35, "y", m["planks_pale"], salt=14, outward=-1)
    for x in (-W / 2, W / 2):
        g = K.gable_infill(0.02, D, base + H, 0.45, m["planks_pale"])
        g.location.x = x
    K.sheet_roof(W, D, base + H, 0.45, m["roof_dark"], sheets_per_side=7, salt=17, ridge_mat=m["iron"], missing=14)
    for i, x in enumerate((-0.85, 0.35)):
        K.door(Vector((x, -D / 2 - 0.03, base + 0.41)), "-y", m)
        K.window(Vector((x + 0.45, -D / 2 - 0.03, base + 0.6)), "-y", m, lit=i == 0)
    K.window(Vector((W / 2 + 0.03, 0.0, base + 0.6)), "+x", m, lit=True)
    for x in (-0.6, 0.7):
        K.box((0.22, 0.22, 0.7), (x, 0.25, base + H + 0.45), m["stone"], bevel=0.01, name="Chimney")
        K.box((0.27, 0.27, 0.05), (x, 0.25, base + H + 0.82), m["soot"], name="ChimneyCap")
    K.barrel((W / 2 + 0.15, -D / 2 - 0.15, 0), m)
    K.barrel((W / 2 + 0.15, -D / 2 + 0.15, 0), m, radius=0.1, height=0.26)
    # Clothes line between two posts.
    for x in (-1.1, 0.0):
        K.box((0.04, 0.04, 0.75), (x, -D / 2 - 0.55, 0.375), m["beam"])
    K.box((1.1, 0.008, 0.008), (-0.55, -D / 2 - 0.55, 0.72), m["soot"])
    for i, x in enumerate((-0.9, -0.62, -0.35)):
        K.box((0.16, 0.01, 0.22), (x, -D / 2 - 0.55, 0.6), m["cloth_red"] if i == 1 else m["cloth"])


def mine_headframe(m) -> None:
    # Timber headframe over the shaft.
    H = 2.6
    legs = [(-0.55, -0.55), (0.55, -0.55), (0.55, 0.55), (-0.55, 0.55)]
    top = 0.28
    for i, (x, y) in enumerate(legs):
        tx, ty = math.copysign(top, x), math.copysign(top, y)
        mid = Vector(((x + tx) / 2, (y + ty) / 2, H / 2))
        vec = Vector((tx - x, ty - y, H))
        beam = K.box((0.1, 0.1, vec.length), mid, m["beam"], name="Leg")
        beam.rotation_mode = "QUATERNION"
        beam.rotation_quaternion = vec.to_track_quat("Z", "Y")
    for z in (0.7, 1.4, 2.05):
        k = 0.55 - (0.55 - top) * z / H
        for side in range(4):
            a, b = legs[side], legs[(side + 1) % 4]
            sx = (a[0] + b[0]) / 2 * k / 0.55
            sy = (a[1] + b[1]) / 2 * k / 0.55
            length = 2 * k
            rot = (0, 0, 0) if side % 2 == 1 else (0, 0, math.radians(90))
            K.box((0.07, length, 0.07) if side % 2 == 1 else (0.07, length, 0.07), (sx, sy, z), m["beam"], rot=rot, name="Brace")
    K.box((0.75, 0.75, 0.06), (0, 0, H + 0.03), m["planks_pale"], name="Platform")
    # Sheave wheel.
    wheel_z = H + 0.42
    K.cylinder(0.34, 0.05, (0, 0, wheel_z), m["iron"], rot=(math.radians(90), 0, 0), verts=32, name="Rim")
    K.cylinder(0.3, 0.06, (0, 0, wheel_z), m["soot"], rot=(math.radians(90), 0, 0), verts=32, name="RimInner")
    for k in range(8):
        a = k * math.pi / 8
        K.box((0.02, 0.03, 0.6), (0, 0, wheel_z), m["iron"], rot=(0, a, 0), name="Spoke")
    for y in (-0.08, 0.08):
        K.box((0.06, 0.04, 0.42), (0, y, H + 0.21), m["beam"], name="Bearing")
    # Back stays towards the hoist house (+Y, away from the viewer).
    for x in (-0.3, 0.3):
        vec = Vector((0, 1.3, -H))
        mid = Vector((x, 0.65, H / 2 + 0.2))
        beam = K.box((0.08, 0.08, vec.length), mid, m["beam"], name="Stay")
        beam.rotation_mode = "QUATERNION"
        beam.rotation_quaternion = vec.to_track_quat("Z", "Y")
    # Hoist house.
    K.box((1.0, 0.8, 0.75), (0, 1.25, 0.375), m["planks"], name="HoistHouse")
    for i, y in enumerate((1.05, 1.45)):
        sheet = K.corrugated_sheet(1.15, 0.5, m["roof_dark"], name="HoistRoof")
        sheet.location = (0, y, 0.82 + (0.08 if i == 0 else -0.08) * -1)
        sheet.rotation_euler = (math.radians(-12 if i == 0 else 12), 0, 0)
    K.cylinder(0.006, 1.2, (0, 0.62, H + 0.35), m["soot"], rot=(math.radians(55), 0, 0), name="Cable")
    # Shaft collar, rails and a loaded cart.
    K.box((0.9, 0.9, 0.12), (0, 0, 0.06), m["stone"], bevel=0.02, name="Collar")
    K.box((0.5, 0.5, 0.13), (0, 0, 0.07), m["soot"], name="Shaft")
    for y in (-0.6, -0.9, -1.2):
        K.box((0.5, 0.06, 0.04), (0, y, 0.02), m["beam"], name="Sleeper")
    for x in (-0.12, 0.12):
        K.box((0.03, 1.0, 0.03), (x, -0.95, 0.05), m["iron"], name="CartRail")
    K.box((0.34, 0.46, 0.22), (0, -1.05, 0.2), m["metal_rust"], bevel=0.015, name="Cart")
    K.coal_pile((0, -1.05, 0.29), m, radius=0.15, height=0.08)
    K.coal_pile((-0.8, -0.8, 0.0), m, radius=0.42, height=0.3)
    K.lamppost((0.75, -0.55, 0.0), m, height=0.95)


def town_hall(m) -> None:
    W, D, H = 2.3, 1.9, 1.35
    K.box((W + 0.2, D + 0.2, 0.14), (0, 0, 0.07), m["stone"], bevel=0.02, name="Plinth")
    K.box((W, D, H), (0, 0, 0.14 + H / 2), m["stone"], bevel=0.015, name="Walls")
    K.box((W + 0.06, D + 0.06, 0.08), (0, 0, 0.14 + H), m["soot"], name="Cornice")
    # Hipped tar roof.
    r = 0.12
    z0 = 0.18 + H
    verts = [(-W / 2 - r, -D / 2 - r, z0), (W / 2 + r, -D / 2 - r, z0), (W / 2 + r, D / 2 + r, z0), (-W / 2 - r, D / 2 + r, z0),
             (-W / 4, 0, z0 + 0.75), (W / 4, 0, z0 + 0.75)]
    faces = [(0, 1, 5, 4), (1, 2, 5), (2, 3, 4, 5), (3, 0, 4)]
    mesh = bpy.data.meshes.new("HipRoof")
    mesh.from_pydata(verts, [], faces)
    roof = bpy.data.objects.new("HipRoof", mesh)
    K.link(roof)
    sol = roof.modifiers.new("Solid", "SOLIDIFY")
    sol.thickness = 0.05
    roof.data.materials.append(m["roof_tar"])
    # Front facade (-Y): steps, double door, windows, regime banner.
    for i in range(3):
        K.box((0.9 - i * 0.12, 0.18, 0.05), (0, -D / 2 - 0.25 + i * 0.07, 0.025 + i * 0.05), m["stone"], name="Step")
    K.door(Vector((-0.12, -D / 2 - 0.03, 0.55)), "-y", m, w=0.26, h=0.78)
    K.door(Vector((0.14, -D / 2 - 0.03, 0.55)), "-y", m, w=0.26, h=0.78)
    K.box((0.7, 0.06, 0.08), (0, -D / 2 - 0.04, 0.98), m["beam"], name="Lintel")
    for x in (-0.8, 0.8):
        K.window(Vector((x, -D / 2 - 0.03, 0.75)), "-y", m, w=0.32, h=0.5, lit=x < 0)
        K.window(Vector((x, -D / 2 - 0.03, 1.2)), "-y", m, w=0.32, h=0.3, lit=False)
    for y in (-0.5, 0.4):
        K.window(Vector((W / 2 + 0.03, y, 0.75)), "+x", m, w=0.32, h=0.5, lit=y > 0)
    K.box((0.5, 0.02, 0.62), (0, -D / 2 - 0.035, 1.25), m["cloth_red"], name="Banner")
    K.cylinder(0.13, 0.02, (0, -D / 2 - 0.05, 1.33), m["lamp"] if False else M.flat("Gold", "#C9A44C", roughness=0.35, metallic=0.9),
               rot=(math.radians(90), 0, 0), verts=24, name="Emblem")
    K.box((0.03, 0.03, 0.3), (0, -D / 2 - 0.06, 1.33), m["soot"], name="EmblemBar")
    # Flag pole on the roof.
    K.cylinder(0.02, 1.0, (W / 2 - 0.3, 0.3, z0 + 0.4), m["iron"], verts=8, name="FlagPole")
    K.box((0.02, 0.45, 0.28), (W / 2 - 0.3, 0.07, z0 + 0.75), m["cloth_red"], name="Flag")
    K.lamppost((-W / 2 - 0.25, -D / 2 - 0.35, 0), m)
    K.lamppost((W / 2 + 0.35, -D / 2 - 0.35, 0), m)


def warehouse(m) -> None:
    W, D, H = 2.4, 2.0, 1.2
    K.box((W + 0.1, D + 0.1, 0.1), (0, 0, 0.05), m["stone"], name="Slab")
    K.box((W - 0.04, D - 0.04, H), (0, 0, 0.1 + H / 2), m["soot"], name="Core")
    # Vertical corrugated cladding.
    for axis, length, pos in (("x", W, -D / 2), ("x", W, D / 2), ("y", D, W / 2), ("y", D, -W / 2)):
        panels = int(length / 0.4)
        for k in range(panels):
            sheet = K.corrugated_sheet(length / panels * 1.04, H, m["roof_dark"] if k % 3 else m["roof_rust"], name="Clad")
            off = -length / 2 + (k + 0.5) * length / panels
            if axis == "x":
                sheet.location = (off, pos + (0.015 if pos > 0 else -0.015), 0.1 + H / 2)
                sheet.rotation_euler = (math.radians(90), 0, 0)
            else:
                sheet.location = (pos + (0.015 if pos > 0 else -0.015), off, 0.1 + H / 2)
                sheet.rotation_euler = (math.radians(90), 0, math.radians(90))
    K.sheet_roof(W, D, 0.1 + H, 0.55, m["roof_rust"], sheets_per_side=6, salt=21, ridge_mat=m["iron"])
    for x in (-W / 2, W / 2):
        g = K.gable_infill(0.02, D, 0.1 + H, 0.55, m["roof_dark"])
        g.location.x = x
    # Sliding door with rail.
    K.box((1.0, 0.05, 0.95), (-0.35, -D / 2 - 0.05, 0.575), m["planks"], name="SlidingDoor")
    K.box((1.6, 0.04, 0.05), (-0.1, -D / 2 - 0.06, 1.08), m["iron"], name="DoorRail")
    for dz in (0.3, 0.75):
        K.box((1.0, 0.03, 0.05), (-0.35, -D / 2 - 0.09, 0.1 + dz), m["beam"], name="DoorBrace")
    K.window(Vector((W / 2 + 0.03, 0.2, 0.85)), "+x", m, lit=False)
    for i, (x, y) in enumerate(((0.75, -1.25), (0.97, -1.2), (0.85, -1.45), (1.3, -0.6))):
        K.crate((x, y, 0), m, s=0.22, rot=0.25 * i)
    K.crate((0.86, -1.27, 0.22), m, s=0.2, rot=0.6)
    K.barrel((1.4, -0.95, 0), m)
    K.barrel((1.42, -0.68, 0), m)


def economato(m) -> None:
    W, D, H = 1.6, 1.4, 1.0
    K.box((W + 0.1, D + 0.1, 0.1), (0, 0, 0.05), m["stone"], name="Base")
    K.box((W - 0.06, D - 0.06, H), (0, 0, 0.1 + H / 2), m["soot"], name="Core")
    K.board_wall(Vector((-W / 2, -D / 2, 0.1)), W, H, "x", m["planks_pale"], salt=31, outward=-1)
    K.board_wall(Vector((-W / 2, D / 2, 0.1)), W, H, "x", m["planks_pale"], salt=32, outward=1)
    K.board_wall(Vector((W / 2, -D / 2, 0.1)), D, H, "y", m["planks_pale"], salt=33, outward=1)
    K.board_wall(Vector((-W / 2, -D / 2, 0.1)), D, H, "y", m["planks_pale"], salt=34, outward=-1)
    # False front facade with sign.
    K.box((W + 0.1, 0.06, 0.45), (0, -D / 2 - 0.05, 0.1 + H + 0.18), m["planks"], name="FalseFront")
    K.box((1.0, 0.03, 0.22), (0, -D / 2 - 0.09, 0.1 + H + 0.2), M.flat("SignBoard", "#2E2A24", roughness=0.8), name="Sign")
    K.box((0.6, 0.02, 0.05), (0, -D / 2 - 0.1, 0.1 + H + 0.22), M.flat("SignPaint", "#C9A44C", roughness=0.5), name="SignText")
    K.sheet_roof(W, D, 0.1 + H, 0.35, m["roof_rust"], sheets_per_side=4, salt=37)
    # Striped awning.
    for k in range(8):
        mat = m["cloth_red"] if k % 2 == 0 else m["cloth"]
        x = -W / 2 + (k + 0.5) * W / 8
        K.box((W / 8, 0.42, 0.02), (x, -D / 2 - 0.22, 0.95), mat, rot=(math.radians(-22), 0, 0), name="Awning")
    for x in (-W / 2 + 0.05, W / 2 - 0.05):
        K.box((0.04, 0.04, 0.85), (x, -D / 2 - 0.4, 0.43), m["beam"], name="AwningPost")
    K.door(Vector((0.35, -D / 2 - 0.03, 0.5)), "-y", m)
    K.window(Vector((-0.35, -D / 2 - 0.03, 0.55)), "-y", m, w=0.55, h=0.4, lit=True)
    for i, x in enumerate((-0.55, -0.3, -0.05)):
        K.box((0.16, 0.12, 0.2), (x, -D / 2 - 0.35, 0.1), m["cloth"], bevel=0.04, name="Sack")
    K.crate((0.65, -D / 2 - 0.3, 0), m, s=0.2)
    K.barrel((W / 2 + 0.15, -0.3, 0), m)


def stage(m) -> None:
    W, D, Hd = 2.6, 1.5, 0.45
    for x in (-W / 2 + 0.1, 0, W / 2 - 0.1):
        for y in (-D / 2 + 0.1, D / 2 - 0.1):
            K.box((0.1, 0.1, Hd), (x, y, Hd / 2), m["beam"], name="StagePost")
    for k in range(int(W / 0.16)):
        x = -W / 2 + 0.08 + k * 0.16
        K.box((0.15, D, 0.05), (x, 0, Hd + 0.025), m["planks_pale"], name="Deck")
    K.box((W, 0.05, Hd), (0, -D / 2, Hd / 2), m["planks"], name="Skirt")
    for i in range(4):
        K.box((0.6, 0.15, 0.05), (W / 2 - 0.45, -D / 2 - 0.12 - i * 0.12, Hd - 0.11 * (i + 1) + 0.03), m["planks"], name="Stair")
    # Backdrop with three regime banners and emblem.
    K.box((W, 0.08, 1.1), (0, D / 2 - 0.05, Hd + 0.55), m["planks"], name="Backdrop")
    gold = M.flat("Gold", "#C9A44C", roughness=0.35, metallic=0.9)
    for x in (-0.85, 0, 0.85):
        K.box((0.42, 0.02, 0.95), (x, D / 2 - 0.1, Hd + 0.58), m["cloth_red"], name="Banner")
        K.cylinder(0.1, 0.02, (x, D / 2 - 0.12, Hd + 0.75), gold, rot=(math.radians(90), 0, 0), verts=20, name="Emblem")
    K.box((0.5, 0.35, 0.55), (-0.5, 0.1, Hd + 0.3), m["planks"], name="Lectern")
    K.box((0.5, 0.35, 0.4), (0.5, 0.15, Hd + 0.2), m["soot"], name="Urn")
    K.lamppost((-W / 2 - 0.2, -D / 2 - 0.2, 0), m, height=1.3)
    K.lamppost((W / 2 + 0.2, -D / 2 - 0.2, 0), m, height=1.3)


def lumber_camp(m) -> None:
    # Open shed with a log pile, saw horse and chopping block.
    for x in (-0.7, 0.1):
        for y in (-0.5, 0.5):
            K.box((0.07, 0.07, 0.8), (x, y, 0.4), m["beam"])
    sheet = K.corrugated_sheet(1.1, 1.2, m["roof_rust"], name="ShedRoof")
    sheet.location = (-0.3, 0, 0.86)
    sheet.rotation_euler = (0, math.radians(8), math.radians(90))
    K.woodpile((-0.3, 0.1, 0), m, length=0.9, rows=4)
    for k in range(5):
        K.cylinder(0.07, 1.1, (0.6, -0.55 + k * 0.17, 0.07), m["bark"], rot=(0, math.radians(90), 0), verts=10, name="Log")
    K.box((0.5, 0.06, 0.06), (0.55, 0.5, 0.35), m["beam"], name="SawHorse")
    for x in (0.35, 0.75):
        K.box((0.05, 0.25, 0.05), (x, 0.5, 0.18), m["beam"], rot=(math.radians(25), 0, 0))
    K.cylinder(0.14, 0.25, (0.2, -0.8, 0.125), m["bark"], verts=12, name="Block")
    K.box((0.03, 0.03, 0.4), (0.25, -0.8, 0.4), m["beam"], rot=(0, math.radians(25), 0), name="AxeHandle")
    K.box((0.12, 0.02, 0.07), (0.32, -0.8, 0.58), m["iron"], name="AxeHead")


def quarry(m) -> None:
    for i, (x, y, s) in enumerate(((-0.4, 0.3, 0.32), (0.1, 0.45, 0.28), (-0.6, -0.3, 0.22), (0.5, -0.2, 0.25))):
        K.box((s * 1.3, s, s * 0.9), (x, y, s * 0.45), m["stone"], rot=(0, 0, 0.4 * i), bevel=0.02, name="Block")
    K.box((0.28, 0.28, 0.22), (-0.4, 0.3, 0.68), m["stone"], rot=(0, 0, 0.2), bevel=0.02)
    rock(m, 47, 0.35)
    # Tripod hoist.
    for a in (0, 2.1, 4.2):
        vec = Vector((math.cos(a) * 0.5, math.sin(a) * 0.5, -1.3))
        leg = K.box((0.06, 0.06, vec.length), Vector((0.3, -0.5, 0.65)) + Vector((vec.x / 2, vec.y / 2, 0)), m["beam"])
        leg.rotation_mode = "QUATERNION"
        leg.rotation_quaternion = vec.to_track_quat("Z", "Y")
    K.cylinder(0.006, 0.9, (0.3, -0.5, 0.75), m["soot"], verts=6, name="Chain")
    K.box((0.25, 0.2, 0.15), (0.3, -0.5, 0.25), m["stone"], name="Hanging")
    K.barrel((-0.7, -0.75, 0), m)


def garden(m) -> None:
    soil = M.flat("Soil", "#3B3126", roughness=1.0)
    K.box((1.7, 1.6, 0.05), (0, 0, 0.025), soil, name="Bed")
    leaf = [M.flat("Cabbage", "#4E6A36", roughness=0.8), M.flat("Potato", "#3E5A2C", roughness=0.85)]
    for r in range(5):
        y = -0.6 + r * 0.3
        K.box((1.5, 0.12, 0.05), (0, y, 0.07), soil, name="Row")
        for k in range(6):
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.08 + 0.02 * K.jitter(k + r * 7, 3), location=(-0.62 + k * 0.25, y, 0.13))
            plant = bpy.context.active_object
            plant.scale = (1, 1, 0.7)
            plant.data.materials.append(leaf[(k + r) % 2])
            bpy.ops.object.shade_smooth()
    # Picket fence and scarecrow.
    for k in range(9):
        K.box((0.04, 0.03, 0.32), (-0.85 + k * 0.21, -0.85, 0.16), m["planks_pale"])
        K.box((0.03, 0.04, 0.32), (0.88, -0.85 + k * 0.21, 0.16), m["planks_pale"])
    K.box((1.75, 0.025, 0.04), (0, -0.86, 0.24), m["beam"])
    K.box((0.025, 1.75, 0.04), (0.89, 0, 0.24), m["beam"])
    K.box((0.04, 0.04, 0.9), (-0.6, 0.6, 0.45), m["beam"], name="Scarecrow")
    K.box((0.5, 0.04, 0.04), (-0.6, 0.6, 0.65), m["beam"])
    K.box((0.22, 0.12, 0.3), (-0.6, 0.6, 0.62), m["cloth"])
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.08, location=(-0.6, 0.6, 0.86))
    bpy.context.active_object.data.materials.append(M.flat("Sack", "#8A7A5A"))
    K.box((0.2, 0.2, 0.04), (-0.6, 0.6, 0.94), m["cloth_red"])


def infirmary(m) -> None:
    W, D, H = 1.5, 1.3, 1.0
    white = M.flat("Whitewash", "#B8B4A8", roughness=0.85)
    K.box((W + 0.1, D + 0.1, 0.12), (0, 0, 0.06), m["stone"], name="Base")
    K.box((W, D, H), (0, 0, 0.12 + H / 2), white, bevel=0.01, name="Walls")
    for x in (-W / 2, W / 2):
        g = K.gable_infill(0.02, D, 0.12 + H, 0.45, white)
        g.location.x = x
    K.sheet_roof(W, D, 0.12 + H, 0.45, m["roof_dark"], sheets_per_side=4, salt=51, ridge_mat=m["iron"])
    K.door(Vector((-0.3, -D / 2 - 0.03, 0.53)), "-y", m)
    K.window(Vector((0.3, -D / 2 - 0.03, 0.65)), "-y", m, lit=True)
    K.window(Vector((W / 2 + 0.03, 0, 0.65)), "+x", m, lit=True)
    # Original sign: a green plate with a white leaf (not a protected emblem).
    K.box((0.32, 0.03, 0.32), (-0.3, -D / 2 - 0.05, 1.05), M.flat("MedPlate", "#2F5A44", roughness=0.6))
    K.box((0.06, 0.02, 0.2), (-0.3, -D / 2 - 0.07, 1.05), white)
    K.box((0.2, 0.02, 0.06), (-0.3, -D / 2 - 0.07, 1.05), white)
    for i in range(2):
        K.box((0.5, 0.18, 0.08), (0.95, -0.4 + i * 0.3, 0.25), m["cloth"], name="Cot")
    K.lamppost((-W / 2 - 0.2, -D / 2 - 0.2, 0), m)


def school(m) -> None:
    W, D, H = 2.4, 1.3, 1.0
    K.box((W + 0.1, D + 0.1, 0.1), (0, 0, 0.05), m["stone"], name="Base")
    K.box((W - 0.06, D - 0.06, H), (0, 0, 0.1 + H / 2), m["soot"], name="Core")
    K.board_wall(Vector((-W / 2, -D / 2, 0.1)), W, H, "x", m["planks_pale"], salt=61, outward=-1)
    K.board_wall(Vector((-W / 2, D / 2, 0.1)), W, H, "x", m["planks_pale"], salt=62, outward=1)
    K.board_wall(Vector((W / 2, -D / 2, 0.1)), D, H, "y", m["planks_pale"], salt=63, outward=1)
    K.board_wall(Vector((-W / 2, -D / 2, 0.1)), D, H, "y", m["planks_pale"], salt=64, outward=-1)
    for x in (-W / 2, W / 2):
        g = K.gable_infill(0.02, D, 0.1 + H, 0.5, m["planks_pale"])
        g.location.x = x
    K.sheet_roof(W, D, 0.1 + H, 0.5, m["roof_rust"], sheets_per_side=6, salt=67, ridge_mat=m["metal_rust"])
    for x in (-0.7, 0.0, 0.7):
        K.window(Vector((x, -D / 2 - 0.03, 0.62)), "-y", m, lit=x == 0.0)
    K.door(Vector((W / 2 + 0.03, 0.1, 0.5)), "+x", m)
    # Bell tower.
    K.box((0.35, 0.35, 0.5), (0.8, 0, 0.1 + H + 0.6), m["planks"], name="Belfry")
    K.cylinder(0.08, 0.12, (0.8, 0, 0.1 + H + 0.62), M.flat("Bronze", "#8C6B3A", roughness=0.4, metallic=0.9), verts=12, name="Bell")
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.32, depth=0.35, location=(0.8, 0, 0.1 + H + 1.02), rotation=(0, 0, math.radians(45)))
    bpy.context.active_object.data.materials.append(m["roof_rust"])
    K.box((0.6, 0.04, 0.45), (-W / 2 - 0.3, -0.3, 0.4), M.flat("Chalk", "#2B3A33"), name="Board")


def site(w: int, d: int):
    """Construction site: foundation, scaffolding, stacked planks (same model for every building)."""
    def build(m) -> None:
        W, D = w * 0.85, d * 0.85
        K.box((W, D, 0.1), (0, 0, 0.05), m["stone"], name="Footing")
        for x in (-W / 2, 0, W / 2):
            for y in (-D / 2, D / 2):
                K.box((0.06, 0.06, 1.1), (x, y, 0.55), m["beam"], name="Pole")
        for z in (0.5, 1.0):
            K.box((W, 0.05, 0.05), (0, -D / 2, z), m["beam"])
            K.box((0.05, D, 0.05), (W / 2, 0, z), m["beam"])
            K.box((W, 0.25, 0.03), (0, -D / 2 - 0.12, z - 0.02), m["planks_pale"], name="Walkway")
        K.box((W * 0.6, D * 0.5, 0.35), (-W * 0.1, D * 0.1, 0.27), m["planks"], name="Frame")
        for k in range(4):
            K.box((0.7, 0.12, 0.04), (W / 2 + 0.25, -D / 2 + 0.2, 0.03 + k * 0.045), m["planks_pale"], rot=(0, 0, 0.05 * k))
        K.barrel((-W / 2 - 0.2, -D / 2 - 0.15, 0), m)
    return build


# ----------------------------------------------------------------------------- nature & props

def pine(m, height: float, salt: int) -> None:
    trunk_h = height * 0.3
    K.cylinder(0.06 + height * 0.01, trunk_h + 0.2, (0, 0, trunk_h / 2), m["bark"], verts=10, name="Trunk")
    leaves = M.flat(f"Needles{salt}", ("#253526", "#2D3B28", "#2A3326")[salt % 3], roughness=0.9)
    tiers = 7
    for t in range(tiers):
        f = t / tiers
        z = trunk_h * 0.6 + f * (height - trunk_h * 0.6)
        r = (0.55 - 0.45 * f) * height * 0.4
        bpy.ops.mesh.primitive_cone_add(vertices=18, radius1=r, radius2=0.0, depth=height * 0.3, location=(0.02 * K.jitter(t, salt), 0, z + height * 0.15))
        cone = bpy.context.active_object
        cone.rotation_euler = (math.radians(4 * K.jitter(t, salt + 1)), math.radians(4 * K.jitter(t, salt + 2)), K.jitter(t, salt) * 3)
        tex = bpy.data.textures.new(f"Bough{salt}{t}", type="VORONOI")
        tex.noise_scale = 0.07
        sub = cone.modifiers.new("Sub", "SUBSURF")
        sub.levels, sub.render_levels = 1, 2
        disp = cone.modifiers.new("Disp", "DISPLACE")
        disp.texture, disp.strength = tex, 0.11 * height
        cone.data.materials.append(leaves)
        bpy.ops.object.shade_smooth()


def pine_a(m): pine(m, 1.9, 1)
def pine_b(m): pine(m, 1.5, 2)
def pine_c(m): pine(m, 2.3, 3)


def dead_tree(m) -> None:
    K.cylinder(0.07, 1.3, (0, 0, 0.65), m["bark"], verts=8, name="Trunk")
    for k in range(5):
        a = k * 1.3
        z = 0.6 + 0.12 * k
        vec = Vector((math.cos(a) * 0.45, math.sin(a) * 0.45, 0.35))
        b = K.cylinder(0.025, vec.length, Vector((0, 0, z)) + vec / 2, m["bark"], verts=6, name="Branch")
        b.rotation_mode = "QUATERNION"
        b.rotation_quaternion = vec.to_track_quat("Z", "Y")


def rock(m, salt: int, size: float) -> None:
    for k in range(3 if size > 0.4 else 1):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=size * (1 - 0.3 * k),
                                              location=(0.25 * k * K.jitter(k, salt) * size * 2, 0.2 * k * size, size * 0.35 * (1 - 0.3 * k)))
        r = bpy.context.active_object
        r.scale = (1.0 + 0.3 * K.jitter(k, salt + 1), 0.85 + 0.2 * K.jitter(k, salt + 2), 0.65)
        tex = bpy.data.textures.new(f"RockDisp{salt}{k}", type="VORONOI")
        tex.noise_scale = 0.35
        disp = r.modifiers.new("Disp", "DISPLACE")
        disp.texture, disp.strength = tex, size * 0.5
        r.data.materials.append(m["rock"])


def rock_a(m): rock(m, 41, 0.45)
def rock_b(m): rock(m, 42, 0.28)
def rock_c(m): rock(m, 43, 0.6)


def lamp(m): K.lamppost((0.09, 0, 0), m)
def coal_heap(m): K.coal_pile((0, 0, 0), m, radius=0.45, height=0.32)


def supplies(m) -> None:
    for i, (x, y) in enumerate(((0, 0), (0.24, 0.05), (0.1, -0.22))):
        K.crate((x, y, 0), m, s=0.22, rot=0.3 * i)
    K.crate((0.08, 0.0, 0.22), m, s=0.2, rot=0.8)
    K.barrel((-0.3, 0.1, 0), m)


def fence(m) -> None:
    for k in range(4):
        x = -0.45 + k * 0.3
        K.box((0.04, 0.04, 0.5 + 0.03 * K.jitter(k, 5)), (x, 0, 0.25), m["beam"], rot=(0, math.radians(3 * K.jitter(k, 7)), 0))
    for z in (0.18, 0.4):
        K.box((1.0, 0.004, 0.004), (0, 0, z), m["iron"], name="Wire")


CATALOGUE = {
    # name: (builder, footprint (w, d), canvas (w, h) px at 2x, kind)
    "house_shack": (house_shack, (2, 2), "building"),
    "house_terrace": (house_terrace, (3, 2), "building"),
    "house_shack_b": (with_variant(house_shack, {"roof_rust": "roof_dark", "planks": "planks_pale"}), (2, 2), "building"),
    "house_shack_c": (with_variant(house_shack, {"planks": "beam"}), (2, 2), "building"),
    "house_terrace_b": (with_variant(house_terrace, {"roof_dark": "roof_rust", "planks_pale": "planks"}), (3, 2), "building"),
    "mine_headframe": (mine_headframe, (3, 3), "building"),
    "town_hall": (town_hall, (3, 3), "building"),
    "warehouse": (warehouse, (3, 3), "building"),
    "economato": (economato, (2, 2), "building"),
    "stage": (stage, (3, 2), "building"),
    "lumber_camp": (lumber_camp, (2, 2), "building"),
    "quarry": (quarry, (2, 2), "building"),
    "garden": (garden, (2, 2), "building"),
    "infirmary": (infirmary, (2, 2), "building"),
    "school": (school, (3, 2), "building"),
    "site_2x2": (site(2, 2), (2, 2), "building"),
    "site_3x2": (site(3, 2), (3, 2), "building"),
    "site_3x3": (site(3, 3), (3, 3), "building"),
    "pine_a": (pine_a, (1, 1), "tree"),
    "pine_b": (pine_b, (1, 1), "tree"),
    "pine_c": (pine_c, (1, 1), "tree"),
    "dead_tree": (dead_tree, (1, 1), "tree"),
    "rock_a": (rock_a, (1, 1), "rock"),
    "rock_b": (rock_b, (1, 1), "rock"),
    "rock_c": (rock_c, (1, 1), "rock"),
    "lamp": (lamp, (1, 1), "prop"),
    "coal_heap": (coal_heap, (1, 1), "prop"),
    "supplies": (supplies, (1, 1), "prop"),
    "fence": (fence, (1, 1), "prop"),
}


def frame_for(objects) -> tuple[int, int, float]:
    """Image size and vertical centre (px at SCALE) covering the model and its ground shadow."""
    ppu = S.px_per_unit(SCALE)
    xs, ys = [], []
    for obj in objects:
        if obj.type != "MESH":
            continue
        deps = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
        mesh = deps.to_mesh()
        mw = obj.matrix_world
        for v in mesh.vertices:
            p = mw @ v.co
            for q in (p, p + SUN_DIR * (max(p.z, 0) / -SUN_DIR.z)):
                sx = (q.x + q.y) * ppu * math.sqrt(2) / 2
                sy = (q.x - q.y) * ppu * math.sqrt(2) / 4 - q.z * ppu * math.cos(math.radians(30))
                xs.append(sx)
                ys.append(sy)
        deps.to_mesh_clear()
    pad = 12
    half_w = max(abs(min(xs)), abs(max(xs))) + pad
    top, bottom = min(ys) - pad, max(ys) + pad
    return int(math.ceil(2 * half_w)), int(math.ceil(bottom - top)), (top + bottom) / 2


def render_asset(name: str, samples: int) -> dict:
    builder, footprint, kind = CATALOGUE[name]
    scene = S.reset(samples)
    S.add_sun(scene)
    M.reset_cache()
    mats = M.district_materials()
    builder(mats)
    objects = list(scene.objects)
    res_x, res_y, centre = frame_for(objects)
    cam = S.add_iso_camera(scene, Vector((0, 0, 0)), res_x, res_y, SCALE)
    cam.data.shift_y = -centre / max(res_x, res_y)
    catcher = S.shadow_catcher(max(footprint) * 6 + 4)
    emissive = [mat for mat in bpy.data.materials if mat.node_tree and "Principled BSDF" in mat.node_tree.nodes
                and mat.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value > 0]
    used = {slot.material for o in scene.objects if o.type == "MESH" for slot in o.material_slots}
    has_emission = any(mat in used for mat in emissive)
    S.render_sprite(scene, str(OUT / name), catcher, emissive=[1] if has_emission else None, normals=kind != "rock" or True)
    ax, ay = S.anchor_px(scene, cam, Vector((0, 0, 0)))
    return {"name": name, "kind": kind, "footprint": list(footprint), "size": [res_x, res_y],
            "anchor": [round(ax, 1), round(ay, 1)], "scale": SCALE,
            "layers": ["color", "shadow", "normal"] + (["emission"] if has_emission else [])}


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", default="")
    parser.add_argument("--samples", type=int, default=48)
    args = parser.parse_args(argv)
    OUT.mkdir(parents=True, exist_ok=True)
    manifest_path = OUT / "manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {"scale": SCALE, "assets": {}}
    names = [n for n in args.only.split(",") if n] or list(CATALOGUE)
    for name in names:
        t0 = time.time()
        manifest["assets"][name] = render_asset(name, args.samples)
        print(f"{name}: {time.time() - t0:.0f}s {manifest['assets'][name]['size']}")
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf8")


if __name__ == "__main__":
    main()
