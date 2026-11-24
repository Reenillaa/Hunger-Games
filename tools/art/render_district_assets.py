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
    """The town hall presides over the plaza: the Criba is held on the stage at its steps (-Y)."""
    W, D, H = 2.6, 2.1, 1.75
    stone = m["stone"]
    pale = M.flat("HallStone", "#9A958C", roughness=0.8)
    gold = M.flat("Gold", "#C9A44C", roughness=0.35, metallic=0.9)
    K.box((W + 0.24, D + 0.24, 0.16), (0, 0, 0.08), stone, bevel=0.02, name="Plinth")
    K.box((W, D, H), (0, 0, 0.16 + H / 2), pale, bevel=0.015, name="Walls")
    for z in (0.16 + H * 0.5, 0.16 + H):
        K.box((W + 0.06, D + 0.06, 0.07), (0, 0, z), m["soot"], name="Cornice")
    # Hipped tar roof with a clock tower.
    r = 0.12
    z0 = 0.2 + H
    verts = [(-W / 2 - r, -D / 2 - r, z0), (W / 2 + r, -D / 2 - r, z0), (W / 2 + r, D / 2 + r, z0), (-W / 2 - r, D / 2 + r, z0),
             (-W / 4, 0, z0 + 0.7), (W / 4, 0, z0 + 0.7)]
    faces = [(0, 1, 5, 4), (1, 2, 5), (2, 3, 4, 5), (3, 0, 4)]
    mesh = bpy.data.meshes.new("HipRoof")
    mesh.from_pydata(verts, [], faces)
    roof = bpy.data.objects.new("HipRoof", mesh)
    K.link(roof)
    sol = roof.modifiers.new("Solid", "SOLIDIFY")
    sol.thickness = 0.05
    roof.data.materials.append(m["roof_tar"])
    K.box((0.55, 0.55, 0.9), (0, -0.1, z0 + 0.45), pale, bevel=0.01, name="Tower")
    K.box((0.62, 0.62, 0.06), (0, -0.1, z0 + 0.92), m["soot"], name="TowerCornice")
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.45, radius2=0, depth=0.45, location=(0, -0.1, z0 + 1.17))
    spire = bpy.context.active_object
    spire.rotation_euler = (0, 0, math.radians(45))
    spire.data.materials.append(m["roof_tar"])
    K.cylinder(0.17, 0.03, (0, -0.39, z0 + 0.55), M.flat("ClockFace", "#E9E4D8", 0.5), rot=(math.radians(90), 0, 0), verts=32, name="Clock")
    K.cylinder(0.19, 0.02, (0, -0.38, z0 + 0.55), gold, rot=(math.radians(90), 0, 0), verts=32, name="ClockRim")
    K.box((0.015, 0.01, 0.12), (0, -0.41, z0 + 0.59), m["soot"], name="Hand")
    # Portico: wide steps down to the plaza, four columns and a pediment.
    for i in range(4):
        K.box((1.9 - i * 0.12, 0.2, 0.05), (0, -D / 2 - 0.42 + i * 0.09, 0.025 + i * 0.05), stone, name="Step")
    for x in (-0.75, -0.25, 0.25, 0.75):
        K.cylinder(0.08, 1.15, (x, -D / 2 - 0.22, 0.2 + 0.575), pale, verts=16, name="Column")
        K.box((0.2, 0.2, 0.06), (x, -D / 2 - 0.22, 0.23), stone, name="Base")
        K.box((0.2, 0.2, 0.06), (x, -D / 2 - 0.22, 1.36), stone, name="Capital")
    K.box((1.85, 0.42, 0.1), (0, -D / 2 - 0.16, 1.44), m["soot"], name="Entablature")
    ped = bpy.data.meshes.new("Pediment")
    y = -D / 2 - 0.37
    ped.from_pydata([(-0.95, y, 1.49), (0.95, y, 1.49), (0, y, 1.85)], [], [(0, 1, 2)])
    pobj = bpy.data.objects.new("Pediment", ped)
    K.link(pobj)
    pobj.modifiers.new("Solid", "SOLIDIFY").thickness = 0.3
    pobj.data.materials.append(pale)
    K.cylinder(0.12, 0.02, (0, y - 0.02, 1.62), gold, rot=(math.radians(90), 0, 0), verts=24, name="Emblem")
    # Tall doors and windows behind the columns; long regime banners on either side.
    K.door(Vector((-0.12, -D / 2 - 0.03, 0.62)), "-y", m, w=0.26, h=0.9)
    K.door(Vector((0.14, -D / 2 - 0.03, 0.62)), "-y", m, w=0.26, h=0.9)
    for x in (-1.05, 1.05):
        K.window(Vector((x, -D / 2 - 0.03, 0.62)), "-y", m, w=0.3, h=0.5, lit=x < 0)
        K.box((0.34, 0.02, 0.9), (x, -D / 2 - 0.04, 1.35), m["cloth_red"], name="Banner")
        K.cylinder(0.09, 0.02, (x, -D / 2 - 0.06, 1.5), gold, rot=(math.radians(90), 0, 0), verts=20, name="BannerEmblem")
    for yy in (-0.6, 0.0, 0.6):
        K.window(Vector((W / 2 + 0.03, yy, 0.62)), "+x", m, w=0.3, h=0.5, lit=yy > 0)
        K.window(Vector((W / 2 + 0.03, yy, 1.4)), "+x", m, w=0.3, h=0.4, lit=False)
    # Flags of the regime on the roof corners.
    for x in (-W / 2 + 0.2, W / 2 - 0.2):
        K.cylinder(0.02, 0.9, (x, -D / 2 + 0.2, z0 + 0.35), m["iron"], verts=8, name="FlagPole")
        K.box((0.02, 0.4, 0.25), (x, -D / 2 + 0.4, z0 + 0.66), m["cloth_red"], name="Flag")
    K.lamppost((-W / 2 - 0.3, -D / 2 - 0.45, 0), m)
    K.lamppost((W / 2 + 0.3, -D / 2 - 0.45, 0), m)


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
    """The Criba stage, built against the town hall steps: the hall itself is the backdrop."""
    W, D, Hd = 2.7, 1.3, 0.4
    for x in (-W / 2 + 0.1, 0, W / 2 - 0.1):
        for y in (-D / 2 + 0.1, D / 2 - 0.1):
            K.box((0.1, 0.1, Hd), (x, y, Hd / 2), m["beam"], name="StagePost")
    for k in range(int(W / 0.16)):
        x = -W / 2 + 0.08 + k * 0.16
        K.box((0.15, D, 0.05), (x, 0, Hd + 0.025), m["planks_pale"], name="Deck")
    K.box((W, 0.05, Hd), (0, -D / 2, Hd / 2), m["cloth_red"], name="Skirt")
    for i in range(3):
        K.box((0.6, 0.15, 0.05), (0, -D / 2 - 0.12 - i * 0.12, Hd - 0.12 * (i + 1) + 0.03), m["planks"], name="Stair")
    gold = M.flat("Gold", "#C9A44C", roughness=0.35, metallic=0.9)
    glass = M.flat("UrnGlass", "#CFE2EA", roughness=0.05)
    # Two glass urns full of folded slips (girls left, boys right) and the herald's lectern.
    for x in (-0.85, 0.85):
        K.cylinder(0.2, 0.45, (x, 0.15, Hd + 0.27), glass, verts=24, name="Urn")
        K.cylinder(0.17, 0.28, (x, 0.15, Hd + 0.17), M.flat("Slips", "#EDE6D2", 0.9), verts=24, name="Slips")
        K.cylinder(0.22, 0.04, (x, 0.15, Hd + 0.5), gold, verts=24, name="UrnRim")
    K.box((0.4, 0.3, 0.6), (0, 0.1, Hd + 0.3), m["planks"], name="Lectern")
    K.cylinder(0.12, 0.02, (0, -0.06, Hd + 0.48), gold, rot=(math.radians(90), 0, 0), verts=20, name="Emblem")
    K.cylinder(0.01, 0.5, (0.12, -0.1, Hd + 0.65), m["iron"], verts=6, name="Mic")
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


# ----------------------------------------------------------------------------- arena (forest)

def _foliage(centre, radius: float, mat, salt: int, squash: float = 0.85) -> None:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=radius, location=centre)
    blob = bpy.context.active_object
    blob.scale = (1.0, 1.0, squash)
    tex = bpy.data.textures.new(f"Leafy{salt}", type="VORONOI")
    tex.noise_scale = radius * 0.35
    disp = blob.modifiers.new("Disp", "DISPLACE")
    disp.texture, disp.strength = tex, radius * 0.55
    blob.data.materials.append(mat)
    bpy.ops.object.shade_smooth()


def broadleaf(m, height: float, spread: float, salt: int, greens: tuple[str, ...], bark: str = "bark") -> None:
    """A deciduous tree: forked trunk and clustered leafy crowns in several greens."""
    trunk = K.cylinder(0.08 + height * 0.012, height * 0.55, (0, 0, height * 0.27), m[bark] if bark in m else M.flat(bark, "#E6E2D6", 0.7), verts=10, name="Trunk")
    trunk.scale = (1.0, 1.0, 1.0)
    mats = [M.flat(f"Leaf{salt}{i}", c, roughness=0.85) for i, c in enumerate(greens)]
    for k in range(3):
        a = k * 2.1 + salt
        vec = Vector((math.cos(a) * spread * 0.45, math.sin(a) * spread * 0.45, height * 0.25))
        b = K.cylinder(0.035, vec.length, Vector((0, 0, height * 0.45)) + vec / 2, m["bark"] if bark == "bark" else M.flat(bark, "#E6E2D6", 0.7), verts=6, name="Branch")
        b.rotation_mode = "QUATERNION"
        b.rotation_quaternion = vec.to_track_quat("Z", "Y")
    clusters = 7
    for k in range(clusters):
        a = k / clusters * math.tau + 0.4 * K.jitter(k, salt)
        r = spread * (0.35 + 0.25 * abs(K.jitter(k, salt + 3)))
        z = height * (0.68 + 0.18 * K.jitter(k, salt + 5))
        _foliage((math.cos(a) * r, math.sin(a) * r, z), spread * (0.42 + 0.1 * K.jitter(k, salt + 7)), mats[k % len(mats)], salt * 10 + k)
    _foliage((0, 0, height * 0.9), spread * 0.55, mats[0], salt * 10 + 9)


def oak_a(m): broadleaf(m, 1.9, 0.85, 51, ("#3E6A2A", "#4C7A30", "#5A8A36"))
def oak_b(m): broadleaf(m, 1.6, 0.75, 52, ("#4A6E26", "#5E7E2C", "#6F8E34"))
def birch(m): broadleaf(m, 2.1, 0.55, 53, ("#7A9A3A", "#8AAA44", "#A0B04A"), bark="BirchBark")


def bush_big(m) -> None:
    greens = [M.flat(f"Shrub{i}", c, roughness=0.9) for i, c in enumerate(("#365A26", "#44682C", "#527634"))]
    for k in range(5):
        a = k * 1.25
        _foliage((math.cos(a) * 0.22, math.sin(a) * 0.18, 0.18), 0.24, greens[k % 3], 70 + k, squash=0.7)
    berries = M.flat("Berries", "#B0283A", roughness=0.4)
    for k in range(9):
        a = k * 0.7
        K.cylinder(0.025, 0.03, (math.cos(a) * 0.36, math.sin(a) * 0.3, 0.22 + 0.06 * K.jitter(k, 9)), berries, verts=6)


def ruin_wall(m) -> None:
    stone = m["stone"]
    for row in range(4):
        n = 5 - (row if row > 1 else 0)
        for k in range(n):
            if row == 3 and k in (1, 3):
                continue
            K.box((0.2, 0.18, 0.15), (-0.42 + k * 0.21 + (row % 2) * 0.1, 0, 0.08 + row * 0.16), stone, rot=(0, 0, 0.04 * K.jitter(k + row * 5, 3)), bevel=0.02)
    moss = M.flat("Moss", "#4E6A2C", roughness=1.0)
    K.box((0.5, 0.2, 0.04), (-0.15, 0.0, 0.66), moss)
    K.box((0.22, 0.18, 0.15), (0.45, 0.25, 0.08), stone, rot=(0.3, 0.2, 0.5), bevel=0.02)


def ruin_pillar(m) -> None:
    stone = M.flat("PaleStone", "#B9B2A2", roughness=0.8)
    K.cylinder(0.16, 0.9, (0, 0, 0.45), stone, verts=12)
    K.box((0.42, 0.42, 0.1), (0, 0, 0.05), stone, bevel=0.02)
    drum = K.cylinder(0.16, 0.3, (0.38, 0.12, 0.14), stone, rot=(math.radians(90), 0, 0.6), verts=12)
    drum.name = "Fallen"
    K.box((0.3, 0.3, 0.06), (0, 0, 0.93), M.flat("Moss", "#4E6A2C", roughness=1.0))


def cave_mouth(m) -> None:
    rock(m, 61, 0.55)
    dark = M.flat("CaveDark", "#09090B", roughness=1.0)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=0.3, location=(0.05, -0.38, 0.12))
    hole = bpy.context.active_object
    hole.scale = (1.0, 0.35, 0.75)
    hole.data.materials.append(dark)


def pedestal(m) -> None:
    metal = M.flat("PlateMetal", "#8A8F96", roughness=0.35, metallic=1.0)
    K.cylinder(0.32, 0.08, (0, 0, 0.04), metal, verts=32)
    K.cylinder(0.26, 0.02, (0, 0, 0.09), M.flat("PlateGlow", "#C9A44C", 0.3, metallic=1.0), verts=32)


def relicario(m) -> None:
    """The Relicario: a gilded reliquary on a stepped dais, spilling the supplies of the games."""
    gold = M.flat("Gold", "#C9A44C", roughness=0.25, metallic=1.0)
    ivory = M.flat("Ivory", "#E6DFCF", roughness=0.4)
    for i, r in enumerate((1.9, 1.55, 1.2)):
        K.cylinder(r, 0.12, (0, 0, 0.06 + i * 0.12), ivory if i != 1 else M.flat("Marble", "#D8D0BE", 0.3), verts=8)
    # The casket: a long golden shell with an arched open lid.
    K.box((1.2, 0.7, 0.45), (0, 0, 0.58), gold, bevel=0.05)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.36, depth=1.2, location=(0, 0.42, 1.08))
    lid = bpy.context.active_object
    lid.rotation_euler = (math.radians(70), math.radians(90), 0)
    lid.scale = (1.0, 1.0, 1.0)
    lid.data.materials.append(gold)
    for x in (-0.62, 0.62):
        K.cylinder(0.07, 0.9, (x, -0.38, 0.8), gold, verts=12)
        K.cylinder(0.12, 0.12, (x, -0.38, 1.3), gold, verts=12)
    # Supplies spilling down the steps.
    for i, (x, y) in enumerate(((-0.9, -0.7), (0.8, -0.8), (-1.1, 0.4), (1.0, 0.5), (0.2, -1.2))):
        K.crate((x, y, 0.24 if abs(x) < 1 else 0.12), m, s=0.24, rot=0.4 * i)
    for i, (x, y) in enumerate(((-0.4, -1.3), (0.6, -1.25), (-1.35, -0.3))):
        K.barrel((x, y, 0.12), m, radius=0.1, height=0.26)
    rack = m["beam"]
    for k in range(3):
        spear = K.cylinder(0.015, 0.9, (1.3 + 0.08 * k, -0.2 + 0.1 * k, 0.55), rack, rot=(0.25, 0.2, 0), verts=6)
        spear.name = "Spear"
    K.box((0.5, 0.06, 0.25), (-0.3, -0.36, 0.95), M.flat("Crest", "#9C1C2B", 0.6))


def _poster_material(name: str) -> bpy.types.Material:
    mat = bpy.data.materials.new(f"Poster_{name}")
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes["Principled BSDF"]
    img = nodes.new("ShaderNodeTexImage")
    img.image = bpy.data.images.load(str(ROOT / f"assets/build/{name}.png"))
    links.new(img.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(img.outputs["Alpha"], bsdf.inputs["Alpha"])
    bsdf.inputs["Roughness"].default_value = 0.85
    return mat


def poster_board(m, name: str) -> None:
    """A propaganda poster of the Capitol pasted on a rough wooden board (facing the street, -Y)."""
    for x in (-0.32, 0.32):
        K.box((0.07, 0.07, 1.25), (x, 0.03, 0.62), m["beam"], name="Post")
    K.box((0.78, 0.05, 0.98), (0, 0.02, 0.78), m["planks"], name="Board")
    K.box((0.86, 0.12, 0.05), (0, 0.02, 1.3), m["beam"], name="Cap")
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -0.012, 0.78))
    plane = bpy.context.active_object
    plane.scale = (0.62, 0.87, 1)
    plane.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    plane.data.materials.append(_poster_material(name))


def poster_a(m): poster_board(m, "poster_a")
def poster_b(m): poster_board(m, "poster_b")


# ----------------------------------------------------------------------------- other districts

def farm(m) -> None:
    """District 11: a barn with a hayloft and rows of wheat inside a fence (3x3)."""
    wheat = M.flat("Wheat", "#D8B04E", roughness=0.9)
    soil = M.flat("Soil", "#4E3A28", roughness=1.0)
    K.box((2.9, 2.9, 0.04), (0, 0, 0.02), soil, name="Field")
    for r in range(9):
        y = -1.2 + r * 0.3
        if -0.35 < y < 1.0 and r > 4:
            continue
        for k in range(18):
            x = -1.32 + k * 0.155
            if x > 0.15 and y > -0.35:
                continue
            h = 0.16 + 0.05 * K.jitter(r * 31 + k, 4)
            K.box((0.05, 0.05, h), (x, y, 0.04 + h / 2), wheat, rot=(0.12 * K.jitter(k, r), 0.1 * K.jitter(r, k), 0), name="Wheat")
    red = M.flat("BarnRed", "#8E2E24", roughness=0.85)
    K.box((1.0, 1.2, 0.75), (0.75, 0.55, 0.375), red, bevel=0.01, name="Barn")
    for side in (-1, 1):
        K.box((1.12, 0.72, 0.05), (0.75, 0.55 + side * 0.3, 0.92), m["roof_dark"], rot=(side * -0.62, 0, 0), name="BarnRoof")
    K.box((0.4, 0.04, 0.5), (0.75, -0.06, 0.26), m["planks_pale"], name="BarnDoor")
    K.box((0.04, 0.04, 0.5), (0.75, -0.08, 0.26), m["beam"], name="DoorX")
    for k in range(4):
        K.box((0.04, 0.04, 0.45), (-1.42 + k * 0.95, -1.42, 0.22), m["beam"], name="FencePost")
    K.box((2.9, 0.03, 0.03), (0, -1.42, 0.36), m["beam"], name="FenceRail")
    K.cylinder(0.02, 0.8, (-0.6, -0.6, 0.4), m["beam"], verts=6, name="Scarecrow")
    K.box((0.5, 0.03, 0.03), (-0.6, -0.6, 0.62), m["beam"], name="ScarecrowArms")
    K.cylinder(0.08, 0.1, (-0.6, -0.6, 0.85), wheat, verts=10, name="ScarecrowHead")
    for i in range(3):
        K.cylinder(0.16, 0.22, (1.25, -0.4 + i * 0.36, 0.11), wheat, rot=(0, 1.5708, 0), verts=14, name="HayBale")


def fishery(m) -> None:
    """District 4: a fishing shed by the water with drying nets, barrels and a boat on trestles (3x2)."""
    blue = M.flat("ShedBlue", "#3E5A6E", roughness=0.85)
    K.box((1.3, 1.0, 0.7), (-0.55, 0.25, 0.35), blue, bevel=0.01, name="Shed")
    K.box((1.45, 1.15, 0.06), (-0.55, 0.25, 0.75), m["roof_rust"], rot=(0.18, 0, 0), name="Roof")
    K.box((0.35, 0.04, 0.5), (-0.55, -0.27, 0.25), m["planks_pale"], name="ShedDoor")
    net = M.flat("Net", "#6E7A6A", roughness=1.0)
    for k in range(3):
        x = 0.45 + k * 0.32
        K.cylinder(0.02, 0.7, (x, -0.35, 0.35), m["beam"], verts=6, name="NetPole")
    K.box((0.7, 0.01, 0.45), (0.77, -0.35, 0.42), net, name="Net")
    for i, (x, y) in enumerate(((0.3, 0.45), (0.5, 0.6), (0.2, 0.7))):
        K.barrel((x, y, 0), m, radius=0.1, height=0.24)
    hull = M.flat("Hull", "#C8B48A", roughness=0.7)
    stripe = M.flat("HullStripe", "#9C1C2B", roughness=0.6)
    for x in (0.7, 1.2):
        K.box((0.05, 0.4, 0.22), (x, 0.55, 0.11), m["beam"], name="Trestle")
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=0.5, location=(0.95, 0.55, 0.36))
    boat = bpy.context.active_object
    boat.scale = (1.0, 0.32, 0.22)
    boat.data.materials.append(hull)
    K.box((0.95, 0.33, 0.03), (0.95, 0.55, 0.38), stripe, name="Stripe")


def fruit_tree(m) -> None:
    """District 11 orchards: a pruned, round fruit tree."""
    K.cylinder(0.05, 0.6, (0, 0, 0.3), m["bark"], verts=8, name="Trunk")
    leaves = M.flat("OrchardLeaf", "#4E7A2E", roughness=0.85)
    _foliage((0, 0, 0.85), 0.42, leaves, 81, squash=0.85)
    fruit = M.flat("Fruit", "#C8382A", roughness=0.4)
    for k in range(10):
        a = k * 2.4
        K.cylinder(0.04, 0.05, (0.36 * math.cos(a), 0.36 * math.sin(a), 0.72 + 0.1 * K.jitter(k, 3)), fruit, verts=8, name="Fruit")


def boat(m) -> None:
    """District 4: a small fishing boat afloat (placed on water cells)."""
    hull = M.flat("Hull", "#C8B48A", roughness=0.7)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=0.45, location=(0, 0, -0.02))
    b = bpy.context.active_object
    b.scale = (1.0, 0.36, 0.25)
    b.data.materials.append(hull)
    K.box((0.85, 0.3, 0.03), (0, 0, 0.06), M.flat("HullStripe", "#3E5A6E", 0.6), name="Deck")
    K.cylinder(0.015, 0.7, (0.05, 0, 0.4), m["beam"], verts=6, name="Mast")


# ----------------------------------------------------------------------------- regional architecture

def gable(W: float, D: float, z: float, rise: float, mat, overhang: float = 0.12, ridge=None) -> None:
    """A simple pitched roof: two slabs meeting at a ridge along X (tiles or slate by material)."""
    half = D / 2 + overhang
    slope = math.atan2(rise, half)
    length = math.hypot(half, rise)
    for side in (-1, 1):
        K.box((W + 2 * overhang, length, 0.06), (0, side * half / 2, z + rise / 2), mat,
              rot=(side * -slope, 0, 0), name="RoofSlab")
    if ridge is not None:
        K.box((W + 2 * overhang, 0.1, 0.08), (0, 0, z + rise + 0.02), ridge, name="Ridge")
    for x in (-W / 2, W / 2):
        g = K.gable_infill(0.02, D, z, rise, mat if ridge is None else ridge)
        g.location.x = x


def _tiles() -> bpy.types.Material:
    return M.flat("Terracotta", "#B5562E", roughness=0.75)


def _whitewash() -> bpy.types.Material:
    return M.flat("Whitewash", "#E8E0CC", roughness=0.92)


def _slate() -> bpy.types.Material:
    return M.flat("Slate", "#3E4652", roughness=0.6)


def house_shack__d11(m) -> None:
    """District 11: a whitewashed adobe farmhouse, clay tiles, green shutters, a porch and hay."""
    W, D, H = 1.45, 1.2, 0.85
    K.box((W, D, H), (0, 0, H / 2), _whitewash(), bevel=0.04, name="Adobe")
    K.box((W + 0.04, D + 0.04, 0.12), (0, 0, 0.06), M.flat("Plinth", "#B89A6A", 0.9), name="Plinth")
    gable(W, D, H, 0.42, _tiles(), ridge=M.flat("RidgeTile", "#8E3E22", 0.8))
    green = M.flat("Shutter", "#4E6A3A", 0.7)
    K.door(Vector((-0.3, -D / 2 - 0.02, 0.4)), "-y", m)
    for x in (0.2,):
        K.window(Vector((x, -D / 2 - 0.02, 0.5)), "-y", m, lit=False)
        for dx in (-0.27, 0.27):
            K.box((0.1, 0.02, 0.36), (x + dx, -D / 2 - 0.04, 0.5), green, name="Shutter")
    K.window(Vector((W / 2 + 0.02, 0.0, 0.5)), "+x", m, lit=True)
    for x in (-0.65, 0.65):
        K.box((0.05, 0.05, 0.7), (x, -D / 2 - 0.42, 0.35), m["beam"], name="PorchPost")
    K.box((W + 0.1, 0.5, 0.04), (0, -D / 2 - 0.22, 0.72), M.flat("Reed", "#B8A06A", 0.95), name="PorchRoof")
    wheat = M.flat("Wheat", "#D8B04E", roughness=0.9)
    K.cylinder(0.16, 0.24, (W / 2 + 0.2, -D / 2 - 0.1, 0.12), wheat, rot=(0, 1.5708, 0), verts=14, name="HayBale")
    for i in range(3):
        K.cylinder(0.07, 0.16, (-W / 2 - 0.12, -0.3 + i * 0.18, 0.08), M.flat("Clay", "#A8603A", 0.8), verts=10, name="Pot")


def house_terrace__d11(m) -> None:
    """District 11: a long adobe row for field workers with an arcade and a tiled roof."""
    W, D, H = 2.5, 1.2, 0.9
    K.box((W, D, H), (0, 0, H / 2), _whitewash(), bevel=0.04, name="Adobe")
    gable(W, D, H, 0.4, _tiles(), ridge=M.flat("RidgeTile", "#8E3E22", 0.8))
    for k in range(5):
        x = -1.05 + k * 0.52
        K.box((0.08, 0.08, 0.66), (x, -D / 2 - 0.36, 0.33), _whitewash(), name="Arcade")
    K.box((W + 0.15, 0.5, 0.06), (0, -D / 2 - 0.2, 0.69), _tiles(), rot=(0.12, 0, 0), name="ArcadeRoof")
    for i, x in enumerate((-0.85, 0.35)):
        K.door(Vector((x, -D / 2 - 0.02, 0.4)), "-y", m)
        K.window(Vector((x + 0.45, -D / 2 - 0.02, 0.52)), "-y", m, lit=i == 0)
    K.window(Vector((W / 2 + 0.02, 0.0, 0.52)), "+x", m, lit=True)
    K.box((0.2, 0.2, 0.45), (0.8, 0.2, H + 0.4), _whitewash(), name="Chimney")


def town_hall__d11(m) -> None:
    """District 11: a whitewashed hall with a shaded arcade, clay roof and the Capitol's watchtower."""
    W, D, H = 2.6, 2.0, 1.5
    white = _whitewash()
    K.box((W + 0.2, D + 0.2, 0.14), (0, 0, 0.07), M.flat("Plinth", "#B89A6A", 0.9), name="Plinth")
    K.box((W, D, H), (0, 0, 0.14 + H / 2), white, bevel=0.03, name="Walls")
    gable(W, D, 0.14 + H, 0.55, _tiles(), ridge=M.flat("RidgeTile", "#8E3E22", 0.8))
    # Arcade of rounded arches along the plaza side.
    for k in range(5):
        x = -1.0 + k * 0.5
        K.box((0.12, 0.12, 0.85), (x, -D / 2 - 0.35, 0.56), white, name="Pier")
        K.cylinder(0.19, 0.12, (x + 0.25, -D / 2 - 0.35, 0.98), white, rot=(1.5708, 0, 0), verts=20, name="Arch") if k < 4 else None
    K.box((W + 0.15, 0.55, 0.12), (0, -D / 2 - 0.3, 1.12), white, name="ArcadeTop")
    K.box((W + 0.25, 0.6, 0.05), (0, -D / 2 - 0.3, 1.2), _tiles(), name="ArcadeRoof")
    for x in (-0.75, 0.0, 0.75):
        K.window(Vector((x, -D / 2 - 0.02, 1.45)), "-y", m, lit=x < 0, w=0.28, h=0.32)
    K.door(Vector((0.0, -D / 2 - 0.02, 0.55)), "-y", m, w=0.5, h=0.85)
    # The watchtower: timber legs, a platform and a searchlight looking over the fields.
    tx, ty = 1.0, 0.6
    for dx in (-0.22, 0.22):
        for dy in (-0.22, 0.22):
            K.box((0.07, 0.07, 2.2), (tx + dx, ty + dy, 1.1), m["beam"], name="TowerLeg")
    K.box((0.7, 0.7, 0.08), (tx, ty, 2.2), m["planks"], name="Platform")
    K.box((0.75, 0.75, 0.06), (tx, ty, 2.6), m["roof_dark"], name="TowerRoof")
    K.cylinder(0.07, 0.12, (tx, ty - 0.3, 2.35), m["lamp"], rot=(1.4, 0, 0), verts=12, name="Searchlight")
    K.box((0.5, 0.02, 0.7), (0, -D / 2 - 0.62, 1.55), m["cloth_red"], name="Banner")
    K.cylinder(0.12, 0.02, (0, -D / 2 - 0.64, 1.7), M.flat("Gold", "#C9A44C", 0.35, metallic=0.9), rot=(1.5708, 0, 0), verts=24, name="Emblem")


def warehouse__d11(m) -> None:
    """District 11: the regime's granary: corrugated silos with conical caps and a loading barn."""
    metal = M.flat("SiloMetal", "#9AA0A6", roughness=0.45, metallic=0.6)
    for i, (x, y) in enumerate(((-0.8, 0.4), (0.0, 0.5), (0.8, 0.4))):
        K.cylinder(0.42, 1.8, (x, y, 0.9), metal, verts=24, name="Silo")
        bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.46, radius2=0.04, depth=0.35, location=(x, y, 1.97))
        bpy.context.active_object.data.materials.append(metal)
    K.box((2.4, 0.9, 0.7), (0, -0.55, 0.35), M.flat("BarnRed", "#8E2E24", 0.85), name="LoadingBarn")
    K.box((2.5, 1.0, 0.05), (0, -0.55, 0.74), m["roof_dark"], rot=(0.1, 0, 0), name="BarnRoof")
    K.box((0.6, 0.03, 0.5), (0, -1.01, 0.27), m["planks_pale"], name="Door")


def house_shack__d4(m) -> None:
    """District 4: a fisher's cottage on stilts, painted boards, slate roof and drying nets."""
    W, D, H = 1.4, 1.2, 0.8
    lift = 0.3
    for x in (-0.6, 0.6):
        for y in (-0.5, 0.5):
            K.box((0.07, 0.07, lift), (x, y, lift / 2), m["beam"], name="Stilt")
    paint = M.flat("BoardBlue", "#6E9AB8", roughness=0.8)
    K.box((W, D, H), (0, 0, lift + H / 2), paint, name="Core")
    K.board_wall(Vector((-W / 2, -D / 2, lift)), W, H, "x", paint, salt=21, outward=-1)
    K.board_wall(Vector((W / 2, -D / 2, lift)), D, H, "y", paint, salt=22, outward=1)
    gable(W, D, lift + H, 0.4, _slate(), ridge=M.flat("WhiteTrim", "#EDEAE2", 0.6))
    K.door(Vector((-0.3, -D / 2 - 0.03, lift + 0.38)), "-y", m)
    K.window(Vector((0.25, -D / 2 - 0.03, lift + 0.5)), "-y", m, lit=False)
    K.window(Vector((W / 2 + 0.03, 0.0, lift + 0.5)), "+x", m, lit=True)
    for i in range(3):
        K.box((0.3, 0.12, 0.05), (-0.3, -D / 2 - 0.2 - i * 0.12, lift - 0.05 - i * 0.1), m["planks"], name="Step")
    net = M.flat("Net", "#6E7A6A", roughness=1.0)
    K.box((0.04, 0.04, 0.8), (W / 2 + 0.3, -0.3, 0.4), m["beam"], name="NetPole")
    K.box((0.02, 0.6, 0.45), (W / 2 + 0.3, 0.0, 0.5), net, name="Net")
    K.barrel((W / 2 + 0.15, -D / 2 - 0.2, 0), m, radius=0.1, height=0.24)


def house_terrace__d4(m) -> None:
    """District 4: a row of narrow harbour houses, each painted a different faded colour."""
    W, D, H = 2.5, 1.2, 1.1
    colours = ["#D9D2C0", "#7EA2B8", "#C9A86A", "#B86A5A"]
    for k in range(4):
        x = -0.94 + k * 0.625
        mat = M.flat(f"Facade{k}", colours[k], roughness=0.85)
        h = H + 0.08 * K.jitter(k, 9)
        K.box((0.62, D, h), (x, 0, h / 2), mat, bevel=0.01, name="Facade")
        K.window(Vector((x, -D / 2 - 0.02, 0.75)), "-y", m, lit=k % 2 == 0, w=0.24, h=0.28)
    gable(W, D, H + 0.05, 0.42, _slate(), ridge=M.flat("WhiteTrim", "#EDEAE2", 0.6))
    for x in (-0.94, 0.31):
        K.door(Vector((x, -D / 2 - 0.02, 0.38)), "-y", m, w=0.3, h=0.7)
    K.window(Vector((W / 2 + 0.02, 0.0, 0.7)), "+x", m, lit=True)
    for x in (-0.6, 0.65):
        K.box((0.18, 0.18, 0.4), (x, 0.25, H + 0.45), M.flat("WhiteTrim", "#EDEAE2", 0.6), name="Chimney")


def town_hall__d4(m) -> None:
    """District 4: a white stucco harbour hall with blue roofs and a square lighthouse clock tower."""
    W, D, H = 2.6, 2.0, 1.3
    white = M.flat("Stucco", "#EDEAE2", roughness=0.8)
    blue = M.flat("RoofBlue", "#3E6A8E", roughness=0.55)
    K.box((W + 0.2, D + 0.2, 0.14), (0, 0, 0.07), m["stone"], name="Plinth")
    K.box((W, D, H), (0, 0, 0.14 + H / 2), white, bevel=0.03, name="Walls")
    gable(W, D, 0.14 + H, 0.5, blue, ridge=white)
    for i in range(4):
        K.box((1.7 - i * 0.12, 0.2, 0.05), (0, -D / 2 - 0.4 + i * 0.09, 0.025 + i * 0.05), m["stone"], name="Step")
    K.door(Vector((0, -D / 2 - 0.02, 0.6)), "-y", m, w=0.5, h=0.9)
    for x in (-0.85, 0.85):
        K.window(Vector((x, -D / 2 - 0.02, 0.75)), "-y", m, lit=x < 0, w=0.32, h=0.5)
        K.box((0.42, 0.04, 0.06), (x, -D / 2 - 0.04, 1.03), blue, name="Lintel")
    # The tower: square, white, a clock and a lantern room that lights the harbour at night.
    tx, ty = -0.85, 0.55
    K.box((0.6, 0.6, 2.6), (tx, ty, 1.3), white, bevel=0.02, name="Tower")
    K.box((0.7, 0.7, 0.08), (tx, ty, 2.62), blue, name="Gallery")
    K.cylinder(0.24, 0.35, (tx, ty, 2.85), m["glass_lit"], verts=16, name="Lantern")
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.3, radius2=0.02, depth=0.3, location=(tx, ty, 3.18))
    bpy.context.active_object.data.materials.append(blue)
    K.cylinder(0.17, 0.03, (tx, ty - 0.31, 2.1), M.flat("ClockFace", "#E9E4D8", 0.5), rot=(1.5708, 0, 0), verts=24, name="Clock")
    K.box((0.5, 0.02, 0.6), (0.5, -D / 2 - 0.04, 1.15), m["cloth_red"], name="Banner")
    K.cylinder(0.1, 0.02, (0.5, -D / 2 - 0.06, 1.3), M.flat("Gold", "#C9A44C", 0.35, metallic=0.9), rot=(1.5708, 0, 0), verts=20, name="Emblem")
    for k in range(3):
        K.barrel((1.1 + 0.05 * k, -D / 2 - 0.3 - 0.2 * k, 0), m, radius=0.1, height=0.24)


def warehouse__d4(m) -> None:
    """District 4: a boathouse with wide doors, a hull inside and coils of rope."""
    W, D, H = 2.4, 2.1, 1.1
    plank = M.flat("BoatPlank", "#6E5A48", roughness=0.85)
    K.box((W, D, H), (0, 0, H / 2), plank, name="Core")
    K.board_wall(Vector((-W / 2, -D / 2, 0)), W, H, "x", plank, salt=31, outward=-1)
    gable(W, D, H, 0.55, m["roof_rust"], ridge=m["metal_rust"])
    K.box((1.2, 0.04, 0.85), (0, -D / 2 - 0.04, 0.43), M.flat("BoathouseDoor", "#2E3E4E", 0.7), name="BigDoor")
    hull = M.flat("Hull", "#C8B48A", roughness=0.7)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=0.5, location=(0.0, -D / 2 - 0.55, 0.12))
    b = bpy.context.active_object
    b.scale = (1.0, 0.33, 0.24)
    b.data.materials.append(hull)
    rope = M.flat("Rope", "#B8A06A", roughness=0.95)
    for x in (0.9, 1.1):
        K.cylinder(0.14, 0.08, (x, -D / 2 - 0.25, 0.04), rope, verts=16, name="Rope")


# ----------------------------------------------------------------------------- more structures

def tavern(m) -> None:
    """A low timber tavern with a lantern, a hanging sign and benches outside."""
    W, D, H = 1.5, 1.3, 0.85
    K.box((W + 0.1, D + 0.1, 0.1), (0, 0, 0.05), m["stone"], name="Foundation")
    K.box((W - 0.06, D - 0.06, H), (0, 0, 0.1 + H / 2), m["soot"], name="Core")
    K.board_wall(Vector((-W / 2, -D / 2, 0.1)), W, H, "x", m["planks"], salt=41, outward=-1)
    K.board_wall(Vector((W / 2, -D / 2, 0.1)), D, H, "y", m["planks"], salt=42, outward=1)
    gable(W, D, 0.1 + H, 0.45, m["roof_dark"], ridge=m["iron"])
    K.door(Vector((-0.3, -D / 2 - 0.03, 0.5)), "-y", m)
    K.window(Vector((0.25, -D / 2 - 0.03, 0.6)), "-y", m, lit=True)
    K.window(Vector((W / 2 + 0.03, 0.0, 0.6)), "+x", m, lit=True)
    K.box((0.04, 0.4, 0.04), (-0.62, -D / 2 - 0.2, 0.95), m["iron"], name="SignArm")
    K.box((0.02, 0.28, 0.2), (-0.62, -D / 2 - 0.32, 0.8), M.flat("SignBoard", "#8E5A2A", 0.8), name="Sign")
    K.cylinder(0.06, 0.1, (0.0, -D / 2 - 0.1, 0.95), m["lamp"], verts=10, name="Lantern")
    for x in (-0.45, 0.35):
        K.box((0.5, 0.14, 0.05), (x, -D / 2 - 0.45, 0.2), m["planks_pale"], name="Bench")
    K.barrel((W / 2 + 0.15, -D / 2 - 0.2, 0), m)


def bakery(m) -> None:
    """A stone bakehouse with a domed oven and a tall chimney."""
    W, D, H = 1.4, 1.2, 0.8
    K.box((W, D, H), (0, 0, H / 2), m["stone"], bevel=0.02, name="Stone")
    gable(W, D, H, 0.4, m["roof_rust"], ridge=m["metal_rust"])
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=10, radius=0.38, location=(0.55, -0.75, 0.05))
    dome = bpy.context.active_object
    dome.scale = (1.0, 1.0, 0.85)
    dome.data.materials.append(M.flat("OvenClay", "#A8603A", 0.85))
    K.box((0.22, 0.04, 0.18), (0.55, -1.1, 0.12), M.flat("OvenMouth", "#1A0E08", 1.0, emission="#FF8A3A", strength=3.0), name="OvenMouth")
    K.box((0.24, 0.24, 1.0), (-0.45, 0.3, H + 0.3), m["stone"], name="Chimney")
    K.door(Vector((-0.2, -D / 2 - 0.02, 0.4)), "-y", m)
    for i in range(3):
        K.box((0.3, 0.2, 0.06), (-0.55 + i * 0.05, -0.85, 0.05 + i * 0.07), m["planks_pale"], name="BreadRack")


def windmill(m) -> None:
    """A tapering timber windmill with four sails, for grinding the harvest."""
    plank = M.flat("MillPlank", "#9C7A52", roughness=0.85)
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.6, radius2=0.38, depth=1.6, location=(0, 0, 0.8))
    tower = bpy.context.active_object
    tower.data.materials.append(plank)
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.48, radius2=0.05, depth=0.5, location=(0, 0, 1.85))
    bpy.context.active_object.data.materials.append(m["roof_dark"])
    sail = M.flat("Sail", "#E6DCC8", roughness=0.9)
    hub = Vector((0, -0.45, 1.45))
    K.cylinder(0.06, 0.2, hub, m["beam"], rot=(1.5708, 0, 0), verts=10, name="Hub")
    for k in range(4):
        a = k * math.pi / 2 + 0.35
        arm = Vector((math.cos(a) * 0.55, 0, math.sin(a) * 0.55))
        bar = K.box((0.05, 0.03, 1.1), hub + arm * 0.5, m["beam"], name="Arm")
        bar.rotation_euler = (0, -a + math.pi / 2, 0)
        panel = K.box((0.26, 0.02, 0.85), hub + arm * 0.62 + Vector((0, -0.02, 0)), sail, name="SailPanel")
        panel.rotation_euler = (0, -a + math.pi / 2, 0)
    K.door(Vector((0, -0.55, 0.35)), "-y", m, w=0.3, h=0.6)
    wheat = M.flat("Wheat", "#D8B04E", roughness=0.9)
    for i in range(2):
        K.box((0.3, 0.2, 0.18), (0.55, -0.4 + i * 0.25, 0.09), M.flat("Sack", "#C8B48A", 0.95), name="Sack")
    K.cylinder(0.14, 0.2, (-0.6, -0.4, 0.1), wheat, rot=(0, 1.5708, 0), verts=12, name="HayBale")


def smokehouse(m) -> None:
    """A tarred plank smokehouse with racks of fish and a column of smoke-stained boards."""
    tar = M.flat("TarPlank", "#2E2A26", roughness=0.85)
    W, D, H = 1.2, 1.0, 0.9
    K.box((W, D, H), (0, 0, H / 2), tar, name="Core")
    K.board_wall(Vector((-W / 2, -D / 2, 0)), W, H, "x", tar, salt=51, outward=-1)
    gable(W, D, H, 0.35, m["roof_dark"], ridge=m["iron"])
    K.box((0.3, 0.3, 0.35), (0, 0, H + 0.45), tar, name="Vent")
    fish = M.flat("SmokedFish", "#A86A2A", roughness=0.6)
    for x in (0.75, 1.0):
        K.box((0.04, 0.04, 0.8), (x, -0.4, 0.4), m["beam"], name="RackPost")
    K.box((0.04, 0.6, 0.04), (0.88, -0.1, 0.75), m["beam"], name="RackBar")
    for k in range(5):
        K.box((0.05, 0.03, 0.22), (0.88, -0.35 + k * 0.13, 0.58), fish, name="Fish")
    K.door(Vector((-0.25, -D / 2 - 0.03, 0.4)), "-y", m)


def market(m) -> None:
    """Two striped market stalls with crates of produce and a scale."""
    stripes = [M.flat("AwningA", "#9C1C2B", 0.8), M.flat("AwningB", "#E6DCC8", 0.8)]
    produce = [M.flat("Apples", "#C8382A", 0.5), M.flat("Greens", "#5E8A36", 0.8), M.flat("Turnip", "#D8C8A8", 0.7)]
    for i, x in enumerate((-0.45, 0.5)):
        for dx in (-0.35, 0.35):
            for dy in (-0.25, 0.25):
                K.box((0.04, 0.04, 0.8), (x + dx, dy, 0.4), m["beam"], name="StallPost")
        K.box((0.8, 0.55, 0.08), (x, 0, 0.45), m["planks"], name="Counter")
        for k in range(5):
            K.box((0.16, 0.65, 0.03), (x - 0.32 + k * 0.16, -0.02, 0.82), stripes[k % 2], rot=(0.25, 0, 0), name="Awning")
        for k in range(3):
            K.box((0.18, 0.16, 0.1), (x - 0.24 + k * 0.24, -0.08, 0.54), produce[(k + i) % 3], name="Produce")
    K.crate((0.0, -0.6, 0), m, s=0.2)
    K.crate((0.22, -0.65, 0), m, s=0.18, rot=0.4)


def well(m) -> None:
    """A round stone well with a roof and a bucket on a rope."""
    K.cylinder(0.32, 0.4, (0, 0, 0.2), m["stone"], verts=20, name="WellRing")
    K.cylinder(0.25, 0.05, (0, 0, 0.38), M.flat("WellWater", "#1E2A2E", 0.1), verts=20, name="Water")
    for x in (-0.3, 0.3):
        K.box((0.05, 0.05, 0.8), (x, 0, 0.6), m["beam"], name="Post")
    K.box((0.75, 0.05, 0.05), (0, 0, 0.95), m["beam"], name="Axle")
    gable(0.7, 0.6, 1.0, 0.25, m["roof_dark"], overhang=0.06)
    K.cylinder(0.07, 0.1, (0.05, -0.05, 0.6), m["metal_rust"], verts=10, name="Bucket")


def _regional_shop(m, walls, roof, ridge, awning_cols, sign) -> None:
    W, D, H = 1.5, 1.3, 0.85
    K.box((W, D, H), (0, 0, H / 2), walls, bevel=0.03, name="Walls")
    gable(W, D, H, 0.42, roof, ridge=ridge)
    for k in range(5):
        K.box((0.3, 0.45, 0.03), (-0.6 + k * 0.3, -D / 2 - 0.2, 0.72), awning_cols[k % 2], rot=(0.3, 0, 0), name="Awning")
    K.door(Vector((-0.35, -D / 2 - 0.02, 0.4)), "-y", m)
    K.window(Vector((0.25, -D / 2 - 0.02, 0.48)), "-y", m, lit=True, w=0.5, h=0.32)
    K.box((0.7, 0.03, 0.16), (0, -D / 2 - 0.03, 0.82), sign, name="Sign")
    for i, x in enumerate((0.55, 0.75)):
        K.crate((x, -D / 2 - 0.3, 0), m, s=0.18, rot=0.3 * i)


def economato__d11(m) -> None:
    _regional_shop(m, _whitewash(), _tiles(), M.flat("RidgeTile", "#8E3E22", 0.8),
                   [M.flat("AwnGreen", "#4E6A3A", 0.8), M.flat("AwnCream", "#E6DCC8", 0.8)], M.flat("SignOchre", "#C9A44C", 0.6))


def economato__d4(m) -> None:
    _regional_shop(m, M.flat("BoardSea", "#5E8AA8", 0.8), _slate(), M.flat("WhiteTrim", "#EDEAE2", 0.6),
                   [M.flat("AwnBlue", "#2E4E6E", 0.8), M.flat("AwnWhite", "#EDEAE2", 0.8)], M.flat("SignWhite", "#EDEAE2", 0.6))


def _clinic(m, walls, roof, ridge) -> None:
    W, D, H = 1.5, 1.3, 0.9
    K.box((W, D, H), (0, 0, H / 2), walls, bevel=0.03, name="Walls")
    gable(W, D, H, 0.4, roof, ridge=ridge)
    K.door(Vector((0, -D / 2 - 0.02, 0.42)), "-y", m)
    for x in (-0.48, 0.48):
        K.window(Vector((x, -D / 2 - 0.02, 0.52)), "-y", m, lit=x < 0)
    red = M.flat("CrossRed", "#B0283A", 0.6)
    K.box((0.26, 0.02, 0.08), (0, -D / 2 - 0.03, 0.82), red, name="CrossH")
    K.box((0.08, 0.02, 0.26), (0, -D / 2 - 0.03, 0.82), red, name="CrossV")
    K.box((0.04, 0.4, 0.02), (W / 2 + 0.25, 0, 0.5), m["beam"], name="Line")
    K.box((0.02, 0.3, 0.25), (W / 2 + 0.25, 0, 0.36), M.flat("Sheet", "#F2EEE4", 0.9), name="Sheet")


def infirmary__d11(m) -> None:
    _clinic(m, _whitewash(), _tiles(), M.flat("RidgeTile", "#8E3E22", 0.8))


def infirmary__d4(m) -> None:
    _clinic(m, M.flat("Stucco", "#EDEAE2", 0.8), M.flat("RoofBlue", "#3E6A8E", 0.55), M.flat("WhiteTrim", "#EDEAE2", 0.6))


def _schoolhouse(m, walls, roof, ridge, bell_mat) -> None:
    W, D, H = 2.4, 1.2, 0.85
    K.box((W, D, H), (0, 0, H / 2), walls, bevel=0.03, name="Walls")
    gable(W, D, H, 0.4, roof, ridge=ridge)
    K.box((0.3, 0.3, 0.35), (0, 0, H + 0.55), walls, name="BellCote")
    K.box((0.38, 0.38, 0.05), (0, 0, H + 0.75), roof, name="BellRoof")
    K.cylinder(0.06, 0.1, (0, -0.16, H + 0.55), bell_mat, verts=12, name="Bell")
    K.door(Vector((-0.9, -D / 2 - 0.02, 0.4)), "-y", m)
    for x in (-0.3, 0.3, 0.9):
        K.window(Vector((x, -D / 2 - 0.02, 0.52)), "-y", m, lit=x > 0.5)
    K.box((0.5, 0.03, 0.3), (0.3, -D / 2 - 0.4, 0.3), M.flat("Chalkboard", "#2E3A2E", 0.7), name="Board")


def school__d11(m) -> None:
    _schoolhouse(m, _whitewash(), _tiles(), M.flat("RidgeTile", "#8E3E22", 0.8), M.flat("Brass", "#C9A44C", 0.3, metallic=0.9))


def school__d4(m) -> None:
    _schoolhouse(m, M.flat("BoardOchre", "#C9A86A", 0.8), _slate(), M.flat("WhiteTrim", "#EDEAE2", 0.6), M.flat("Brass", "#C9A44C", 0.3, metallic=0.9))


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
    "oak_a": (oak_a, (1, 1), "tree"),
    "oak_b": (oak_b, (1, 1), "tree"),
    "birch": (birch, (1, 1), "tree"),
    "bush_big": (bush_big, (1, 1), "tree"),
    "ruin_wall": (ruin_wall, (1, 1), "rock"),
    "ruin_pillar": (ruin_pillar, (1, 1), "rock"),
    "cave_mouth": (cave_mouth, (1, 1), "rock"),
    "pedestal": (pedestal, (1, 1), "prop"),
    "relicario": (relicario, (4, 4), "building"),
    "poster_a": (poster_a, (1, 1), "prop"),
    "farm": (farm, (3, 3), "building"),
    "fishery": (fishery, (3, 2), "building"),
    "fruit_tree": (fruit_tree, (1, 1), "tree"),
    "boat": (boat, (1, 1), "prop"),
    "tavern": (tavern, (2, 2), "building"),
    "bakery": (bakery, (2, 2), "building"),
    "windmill": (windmill, (2, 2), "building"),
    "smokehouse": (smokehouse, (2, 2), "building"),
    "market": (market, (2, 2), "building"),
    "well": (well, (1, 1), "building"),
    "house_shack__d11": (house_shack__d11, (2, 2), "building"),
    "house_terrace__d11": (house_terrace__d11, (3, 2), "building"),
    "town_hall__d11": (town_hall__d11, (3, 3), "building"),
    "warehouse__d11": (warehouse__d11, (3, 3), "building"),
    "house_shack__d4": (house_shack__d4, (2, 2), "building"),
    "house_terrace__d4": (house_terrace__d4, (3, 2), "building"),
    "town_hall__d4": (town_hall__d4, (3, 3), "building"),
    "warehouse__d4": (warehouse__d4, (3, 3), "building"),
    "economato__d11": (economato__d11, (2, 2), "building"),
    "economato__d4": (economato__d4, (2, 2), "building"),
    "infirmary__d11": (infirmary__d11, (2, 2), "building"),
    "infirmary__d4": (infirmary__d4, (2, 2), "building"),
    "school__d11": (school__d11, (3, 2), "building"),
    "school__d4": (school__d4, (3, 2), "building"),
    "poster_b": (poster_b, (1, 1), "prop"),
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
