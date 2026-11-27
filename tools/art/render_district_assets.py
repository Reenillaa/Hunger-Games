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


def _limb(mat, r0: float, r1: float, start: Vector, vec: Vector, name: str):
    """A tapering, slightly bent limb (two cone segments)."""
    mid = start + vec * 0.5 + Vector((0, 0, 0.06 * vec.length))
    for (p0, p1, ra, rb) in ((start, mid, r0, (r0 + r1) / 2), (mid, start + vec, (r0 + r1) / 2, r1)):
        d = p1 - p0
        bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=ra, radius2=rb, depth=d.length, location=p0 + d / 2)
        o = bpy.context.active_object
        o.name = name
        o.rotation_mode = "QUATERNION"
        o.rotation_quaternion = d.to_track_quat("Z", "Y")
        o.data.materials.append(mat)
        bpy.ops.object.shade_smooth()


def hanging_tree(m) -> None:
    """The old tree beside the town hall: a huge, leafless, twisted oak with one long bough
    and two frayed ropes swaying from it. A warning, never a scene: no figures."""
    bark = M.flat("OldBark", "#4A3A30", 0.85)
    _limb(bark, 0.32, 0.16, Vector((0, 0, 0)), Vector((0.08, 0.05, 1.55)), "Trunk")
    for k in range(4):
        a = k * 1.6 + 0.3
        _limb(bark, 0.12, 0.03, Vector((0, 0, 0.18)), Vector((math.cos(a) * 0.55, math.sin(a) * 0.55, -0.16)), "Root")
    # The long bough reaching towards the plaza.
    _limb(bark, 0.13, 0.05, Vector((0.05, 0.03, 1.3)), Vector((1.3, 0.12, 0.28)), "Bough")
    for k in range(6):
        a = k * 1.05 + 1.4
        start = Vector((0.06, 0.04, 1.4 + 0.07 * k))
        vec = Vector((math.cos(a) * 0.6, math.sin(a) * 0.6, 0.55 + 0.1 * (k % 3)))
        _limb(bark, 0.07, 0.015, start, vec, "Branch")
        tw = Vector((math.cos(a + 0.9) * 0.3, math.sin(a + 0.9) * 0.3, 0.25))
        _limb(bark, 0.02, 0.006, start + vec * 0.75, tw, "Twig")
    rope = M.flat("Rope", "#C4AE84", 0.9)
    for x, length in ((0.72, 0.5), (1.08, 0.36)):
        z_top = 1.3 + 0.28 * (x / 1.3)
        K.cylinder(0.014, length, (x, 0.07 * x, z_top - length / 2), rope, verts=6, name="Rope")
        bpy.ops.mesh.primitive_torus_add(major_radius=0.06, minor_radius=0.012, location=(x, 0.07 * x, z_top - length - 0.05), rotation=(math.radians(90), 0, 0))
        loop = bpy.context.active_object
        loop.data.materials.append(rope)


def _train_body(m, length: float, nose: int) -> None:
    """A Capitol carriage along Y (cell +y is Blender -y). `nose` -1/+1 adds a streamlined nose
    at that end (Blender y sign); 0 is a middle carriage."""
    pearl = M.flat("TrainPearl", "#F3F1EC", 0.35)
    gold = M.flat("TrainGold", "#D4A73A", 0.3, metallic=0.9)
    glass = M.flat("TrainGlass", "#1D2B3A", 0.1, metallic=0.4)
    under = M.flat("TrainUnder", "#3A3E46", 0.6)
    W, H = 0.78, 0.78
    body_len = length - (0.7 if nose else 0)
    by = -nose * 0.35 if nose else 0.0
    K.box((W, body_len, H), (0, by, 0.22 + H / 2), pearl, bevel=0.08, name="Body")
    K.box((W - 0.12, body_len - 0.1, 0.14), (0, by, 0.12), under, name="Bogie")
    for yy in (by - body_len / 2 + 0.35, by + body_len / 2 - 0.35):
        for x in (-0.28, 0.28):
            K.cylinder(0.09, 0.06, (x, yy, 0.09), under, rot=(0, math.radians(90), 0), verts=12, name="Wheel")
    # Window band and gold stripe on both sides.
    for side in (-1, 1):
        K.box((0.02, body_len - 0.3, 0.2), (side * (W / 2 + 0.005), by, 0.22 + H * 0.62), glass, name="Windows")
        K.box((0.02, body_len - 0.1, 0.05), (side * (W / 2 + 0.006), by, 0.22 + H * 0.38), gold, name="Stripe")
    K.box((W * 0.6, body_len - 0.2, 0.05), (0, by, 0.22 + H + 0.02), M.flat("TrainRoof", "#D9D6CF", 0.5), bevel=0.02, name="Roof")
    if nose:
        ny = nose * (body_len / 2 - 0.35 + 0.35) + by
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(0, ny + nose * 0.05, 0.22 + H / 2), segments=24, ring_count=12)
        n = bpy.context.active_object
        n.scale = (W / 1.0, 0.9, H / 1.0)
        n.data.materials.append(pearl)
        bpy.ops.object.shade_smooth()
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.3, location=(0, ny + nose * 0.32, 0.22 + H * 0.68), segments=16, ring_count=8)
        w = bpy.context.active_object
        w.scale = (0.85, 0.55, 0.35)
        w.data.materials.append(glass)
        bpy.ops.object.shade_smooth()
        K.box((W * 0.9, 0.05, 0.05), (0, ny + nose * 0.42, 0.22 + H * 0.3), gold, name="NoseStripe")
        lamp = M.flat("TrainLamp", "#FFF3C4", 0.2, emission="#FFE9A8", strength=4.0)
        for x in (-0.22, 0.22):
            K.cylinder(0.05, 0.03, (x, ny + nose * 0.47, 0.32), lamp, rot=(math.radians(90), 0, 0), verts=12, name="Headlamp")


def train_head(m): _train_body(m, 2.8, -1)
def train_car(m): _train_body(m, 2.8, 0)
def train_tail(m): _train_body(m, 2.8, 1)


def platform(m) -> None:
    """The district's station: a stone platform with a small canopy, a bench and a lamp."""
    stone = m["stone"]
    K.box((0.9, 2.8, 0.18), (0, 0, 0.09), stone, bevel=0.02, name="Platform")
    K.box((0.06, 2.8, 0.04), (0.42, 0, 0.19), M.flat("Edge", "#E3C44A", 0.6), name="Edge")
    wood = M.flat("CanopyWood", "#6B4A30", 0.8)
    for y in (-0.9, 0.9):
        K.box((0.06, 0.06, 0.9), (-0.25, y, 0.63), wood, name="Post")
    roof = K.box((0.8, 2.3, 0.05), (-0.1, 0, 1.1), M.flat("CanopyRoof", "#7A3A30", 0.7), name="Canopy")
    roof.rotation_euler = (0, math.radians(-10), 0)
    K.box((0.18, 0.6, 0.05), (-0.25, 0.3, 0.4), wood, name="BenchSeat")
    K.box((0.04, 0.6, 0.2), (-0.33, 0.3, 0.52), wood, name="BenchBack")
    K.lamppost((-0.3, -1.25, 0.18), m)


def coffin(m) -> None:
    """A plain pine coffin with a band of black cloth and a few flowers on the lid."""
    pine = M.flat("Pine", "#B88A5A", 0.75)
    K.box((0.42, 1.05, 0.26), (0, 0, 0.13), pine, bevel=0.03, name="Box")
    K.box((0.46, 1.09, 0.05), (0, 0, 0.285), M.flat("PineLid", "#A57A4C", 0.7), bevel=0.02, name="Lid")
    K.box((0.47, 0.12, 0.31), (0, 0.15, 0.15), M.flat("Mourning", "#1E1C20", 0.8), name="Band")
    petals = [M.flat("WreathW", "#F4F1EA", 0.6), M.flat("WreathY", "#F2C94C", 0.6), M.flat("WreathG", "#4F8A3A", 0.8)]
    for i in range(7):
        a = i * 0.9
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.05, location=(math.cos(a) * 0.09, -0.2 + math.sin(a) * 0.12, 0.33), segments=8, ring_count=6)
        bpy.context.active_object.data.materials.append(petals[i % 3])


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


# ----------------------------------------------------------------------------- districts 7 and 2

def _logs(W: float, D: float, H: float, mat, z0: float = 0.0) -> None:
    """Walls of stacked round logs with crossing ends at the corners."""
    r = 0.07
    rows = int(H / (2 * r))
    for i in range(rows):
        z = z0 + r + i * 2 * r
        for side in (-1, 1):
            K.cylinder(r, W + 0.16, (0, side * D / 2, z), mat, rot=(0, 1.5708, 0), verts=10, name="LogX")
            K.cylinder(r, D + 0.16, (side * W / 2, 0, z + r), mat, rot=(1.5708, 0, 0), verts=10, name="LogY")


def _log_mat() -> bpy.types.Material:
    return M.flat("Log", "#7A5636", roughness=0.85)


def _shingles() -> bpy.types.Material:
    return M.flat("Shingles", "#4A3A2E", roughness=0.9)


def _granite() -> bpy.types.Material:
    return M.flat("Granite", "#8E8C88", roughness=0.85)


def house_shack__d7(m) -> None:
    """District 7: a log cabin with a steep shingle roof, stone chimney and a chopping block."""
    W, D, H = 1.4, 1.15, 0.8
    K.box((W - 0.1, D - 0.1, H), (0, 0, H / 2), m["soot"], name="Core")
    _logs(W, D, H, _log_mat())
    gable(W, D, H + 0.05, 0.65, _shingles(), ridge=m["beam"])
    K.box((0.26, 0.26, 1.6), (W / 2 - 0.2, 0.25, 0.8), m["stone"], name="Chimney")
    K.door(Vector((-0.25, -D / 2 - 0.08, 0.38)), "-y", m)
    K.window(Vector((0.3, -D / 2 - 0.08, 0.5)), "-y", m, lit=True)
    K.cylinder(0.14, 0.22, (-W / 2 - 0.2, -D / 2 - 0.25, 0.11), _log_mat(), verts=12, name="Block")
    K.woodpile((0.3, -D / 2 - 0.32, 0), m, length=0.5, rows=3)


def house_terrace__d7(m) -> None:
    """District 7: a long log house for the logging crews."""
    W, D, H = 2.5, 1.15, 0.8
    K.box((W - 0.1, D - 0.1, H), (0, 0, H / 2), m["soot"], name="Core")
    _logs(W, D, H, _log_mat())
    gable(W, D, H + 0.05, 0.6, _shingles(), ridge=m["beam"])
    for i, x in enumerate((-0.8, 0.4)):
        K.door(Vector((x, -D / 2 - 0.08, 0.38)), "-y", m)
        K.window(Vector((x + 0.42, -D / 2 - 0.08, 0.5)), "-y", m, lit=i == 1)
    K.box((0.24, 0.24, 1.5), (-0.9, 0.25, 0.75), m["stone"], name="Chimney")
    K.woodpile((1.0, -D / 2 - 0.3, 0), m, length=0.6, rows=4)


def town_hall__d7(m) -> None:
    """District 7: a great timber hall with carved gables and a belfry above the plaza."""
    W, D, H = 2.6, 2.0, 1.2
    K.box((W + 0.2, D + 0.2, 0.15), (0, 0, 0.075), m["stone"], name="Plinth")
    K.box((W - 0.1, D - 0.1, H), (0, 0, 0.15 + H / 2), m["soot"], name="Core")
    _logs(W, D, H, _log_mat(), z0=0.15)
    gable(W, D, 0.15 + H, 0.9, _shingles(), ridge=m["beam"])
    gold = M.flat("Gold", "#C9A44C", roughness=0.35, metallic=0.9)
    for side in (-1, 1):
        K.box((0.06, 0.05, 1.3), (side * 0.6, -D / 2 - 0.14, 1.75), m["beam"], rot=(0, side * -0.9, 0), name="Bargeboard")
    K.door(Vector((0, -D / 2 - 0.08, 0.6)), "-y", m, w=0.5, h=0.85)
    for x in (-0.8, 0.8):
        K.window(Vector((x, -D / 2 - 0.08, 0.75)), "-y", m, lit=x < 0, w=0.3, h=0.42)
    # Belfry: a square timber tower with a pyramid roof and the regime's bell.
    tx, ty = 0.0, 0.3
    K.box((0.55, 0.55, 1.2), (tx, ty, 2.55), m["planks"], name="Belfry")
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.48, radius2=0, depth=0.6, location=(tx, ty, 3.45))
    roof = bpy.context.active_object
    roof.rotation_euler = (0, 0, math.radians(45))
    roof.data.materials.append(_shingles())
    K.cylinder(0.11, 0.18, (tx, ty - 0.2, 2.7), gold, verts=16, name="Bell")
    K.box((0.5, 0.02, 0.7), (0.7, -D / 2 - 0.1, 1.0), m["cloth_red"], name="Banner")
    K.cylinder(0.1, 0.02, (0.7, -D / 2 - 0.12, 1.15), gold, rot=(1.5708, 0, 0), verts=20, name="Emblem")


def warehouse__d7(m) -> None:
    """District 7: the sawmill: an open shed with a big blade, a log ramp and stacked planks."""
    K.box((2.2, 1.6, 0.06), (0, 0.2, 0.03), m["planks"], name="Floor")
    for x in (-1.0, 0.0, 1.0):
        for y in (-0.5, 0.9):
            K.box((0.1, 0.1, 1.1), (x, y, 0.55), m["beam"], name="Post")
    gable(2.3, 1.6, 1.1, 0.45, m["roof_rust"], ridge=m["metal_rust"])
    K.cylinder(0.35, 0.02, (0.3, 0.2, 0.55), M.flat("Blade", "#B8BEC6", 0.3, metallic=1.0), rot=(1.5708, 0, 0), verts=32, name="Saw")
    K.box((1.2, 0.3, 0.3), (-0.3, 0.2, 0.35), m["beam"], name="Bench")
    for i in range(5):
        K.cylinder(0.12, 1.4, (0.0, -1.05 - (i % 2) * 0.2, 0.12 + (i // 2) * 0.22), _log_mat(), rot=(0, 1.5708, 0), verts=12, name="Log")
    for k in range(4):
        K.box((1.0, 0.25, 0.05), (1.0, -0.9, 0.05 + k * 0.06), m["planks_pale"], name="Plank")


def economato__d7(m) -> None:
    _logs(1.4, 1.15, 0.8, _log_mat())
    K.box((1.3, 1.05, 0.8), (0, 0, 0.4), m["soot"], name="Core")
    gable(1.4, 1.15, 0.85, 0.55, _shingles(), ridge=m["beam"])
    K.box((1.5, 0.5, 0.05), (0, -0.82, 0.72), _shingles(), rot=(0.25, 0, 0), name="Porch")
    for x in (-0.6, 0.6):
        K.box((0.06, 0.06, 0.7), (x, -1.0, 0.35), m["beam"], name="PorchPost")
    K.door(Vector((-0.25, -0.65, 0.38)), "-y", m)
    K.window(Vector((0.3, -0.65, 0.5)), "-y", m, lit=True)
    K.crate((0.5, -1.05, 0), m, s=0.18)


def house_shack__d2(m) -> None:
    """District 2: a granite house with deep windows, a slate roof and a walled yard."""
    W, D, H = 1.4, 1.2, 0.9
    K.box((W, D, H), (0, 0, H / 2), m["stone"], bevel=0.02, name="Granite")
    gable(W, D, H, 0.35, _slate(), ridge=m["iron"])
    K.door(Vector((-0.3, -D / 2 - 0.02, 0.4)), "-y", m)
    K.window(Vector((0.25, -D / 2 - 0.02, 0.55)), "-y", m, lit=False, w=0.28, h=0.4)
    K.window(Vector((W / 2 + 0.02, 0.0, 0.55)), "+x", m, lit=True, w=0.28, h=0.4)
    for x in (-0.7, 0.7):
        K.box((0.12, 0.6, 0.35), (x, -D / 2 - 0.3, 0.175), m["stone"], name="YardWall")
    K.box((0.22, 0.22, 0.5), (0.4, 0.25, H + 0.35), m["stone"], name="Chimney")


def house_terrace__d2(m) -> None:
    """District 2: a stepped row of stone houses climbing the slope."""
    for k in range(3):
        x = -0.85 + k * 0.85
        h = 0.85 + k * 0.18
        K.box((0.84, 1.2, h), (x, 0, h / 2), m["stone"], bevel=0.02, name="Unit")
        K.box((0.9, 1.3, 0.08), (x, 0, h + 0.04), _slate(), name="Roof")
        K.box((0.9, 0.06, 0.12), (x, -0.62, h + 0.1), m["stone"], name="Parapet")
        K.window(Vector((x + 0.15, -0.62, 0.55)), "-y", m, lit=k == 1, w=0.24, h=0.36)
        K.door(Vector((x - 0.2, -0.62, 0.36)), "-y", m, w=0.26, h=0.65)


def town_hall__d2(m) -> None:
    """District 2: a granite stronghold of a hall: buttresses, battlements and tall banners."""
    W, D, H = 2.6, 2.0, 1.7
    g = m["stone"]
    K.box((W + 0.3, D + 0.3, 0.2), (0, 0, 0.1), m["stone"], name="Plinth")
    K.box((W, D, H), (0, 0, 0.2 + H / 2), g, bevel=0.02, name="Walls")
    for k in range(7):
        K.box((0.2, 0.2, 0.22), (-W / 2 + 0.1 + k * (W - 0.2) / 6, -D / 2, 0.2 + H + 0.11), g, name="Merlon")
        K.box((0.2, 0.2, 0.22), (-W / 2 + 0.1 + k * (W - 0.2) / 6, D / 2, 0.2 + H + 0.11), g, name="Merlon")
    for x in (-1.0, -0.35, 0.35, 1.0):
        K.box((0.2, 0.35, 1.2), (x, -D / 2 - 0.15, 0.8), g, name="Buttress")
    for i in range(4):
        K.box((1.4 - i * 0.12, 0.2, 0.05), (0, -D / 2 - 0.45 + i * 0.09, 0.025 + i * 0.05), m["stone"], name="Step")
    K.door(Vector((0, -D / 2 - 0.02, 0.65)), "-y", m, w=0.5, h=0.95)
    for x in (-0.68, 0.68):
        K.window(Vector((x, -D / 2 - 0.02, 1.2)), "-y", m, lit=x < 0, w=0.18, h=0.7)
        K.box((0.36, 0.02, 1.2), (x, -D / 2 - 0.36, 1.25), m["cloth_red"], name="Banner")
    gold = M.flat("Gold", "#C9A44C", roughness=0.35, metallic=0.9)
    K.cylinder(0.2, 0.03, (0, -D / 2 - 0.04, 1.55), gold, rot=(1.5708, 0, 0), verts=28, name="Emblem")
    K.box((0.5, 0.5, 0.9), (W / 2 - 0.25, D / 2 - 0.25, 0.2 + H + 0.45), g, name="Turret")


def warehouse__d2(m) -> None:
    """District 2: a stone storehouse with an arched gate and cut blocks ready for the train."""
    W, D, H = 2.4, 2.0, 1.1
    K.box((W, D, H), (0, 0, H / 2), m["stone"], bevel=0.02, name="Walls")
    gable(W, D, H, 0.4, _slate(), ridge=m["iron"])
    K.cylinder(0.4, 0.06, (0, -D / 2 - 0.02, 0.45), m["soot"], rot=(1.5708, 0, 0), verts=24, name="Arch")
    K.box((0.8, 0.06, 0.45), (0, -D / 2 - 0.02, 0.22), m["soot"], name="Gate")
    for i in range(6):
        K.box((0.32, 0.22, 0.2), (0.85 + (i % 2) * 0.34, -D / 2 - 0.4, 0.1 + (i // 2) * 0.2), m["stone"], name="Block")


def economato__d2(m) -> None:
    W, D, H = 1.5, 1.3, 0.9
    K.box((W, D, H), (0, 0, H / 2), m["stone"], bevel=0.02, name="Walls")
    gable(W, D, H, 0.35, _slate(), ridge=m["iron"])
    K.box((1.4, 0.45, 0.03), (0, -D / 2 - 0.2, 0.75), m["iron"], rot=(0.2, 0, 0), name="IronAwning")
    K.door(Vector((-0.35, -D / 2 - 0.02, 0.4)), "-y", m)
    K.window(Vector((0.25, -D / 2 - 0.02, 0.5)), "-y", m, lit=True, w=0.5, h=0.32)
    K.crate((0.55, -D / 2 - 0.3, 0), m, s=0.18)


# ----------------------------------------------------------------------------- style-driven districts

STYLES = {
    "d1": dict(walls="#EDE8DE", roof="#C9C2B4", roof_kind="flat", trim="#C9A44C", feature="dome", stack=None),
    "d3": dict(walls="#8E969C", roof="#4E565C", roof_kind="flat", trim="#6FA0C8", feature="antenna", stack=None),
    "d5": dict(walls="#8E4A3A", roof="#3A3A40", roof_kind="gable", trim="#D8C8A8", feature="chimney", stack="cooling"),
    "d6": dict(walls="#5A4038", roof="#3E4652", roof_kind="gable", trim="#C8B48A", feature="canopy", stack=None),
    "d8": dict(walls="#B07A48", roof="#4A4040", roof_kind="saw", trim="#E6DCC8", feature="clock", stack="stacks"),
    "d9": dict(walls="#C8B89A", roof="#C8A858", roof_kind="thatch", trim="#8E6A3A", feature="silo", stack=None),
    "d10": dict(walls="#9C3A2E", roof="#4A3A2E", roof_kind="gable", trim="#EDEAE2", feature="cupola", stack=None),
}


def _style_mats(st):
    return (M.flat(f"W{st['walls']}", st["walls"], 0.8), M.flat(f"R{st['roof']}", st["roof"], 0.75),
            M.flat(f"T{st['trim']}", st["trim"], 0.5, metallic=0.6 if st["trim"] == "#C9A44C" else 0.0))


def _style_roof(st, W, D, z, rise, roof, trim) -> None:
    kind = st["roof_kind"]
    if kind == "flat":
        K.box((W + 0.08, D + 0.08, 0.08), (0, 0, z + 0.04), roof, name="FlatRoof")
        for side in (-1, 1):
            K.box((W + 0.1, 0.06, 0.14), (0, side * (D / 2 + 0.02), z + 0.15), trim, name="Parapet")
            K.box((0.06, D + 0.1, 0.14), (side * (W / 2 + 0.02), 0, z + 0.15), trim, name="Parapet")
    elif kind == "saw":
        n = max(2, int(W / 0.6))
        for k in range(n):
            x = -W / 2 + (k + 0.5) * W / n
            K.box((W / n, D, 0.05), (x, 0, z + 0.2), roof, rot=(0, 0.6, 0), name="Saw")
            K.box((0.03, D, 0.3), (x + W / n * 0.45, 0, z + 0.15), M.flat("SawGlass", "#9FC8E0", 0.1), name="SawGlass")
    elif kind == "thatch":
        gable(W, D, z, rise * 1.2, roof, overhang=0.18)
        K.box((W + 0.4, 0.12, 0.12), (0, 0, z + rise * 1.2 + 0.03), roof, name="ThatchRidge")
    else:
        gable(W, D, z, rise, roof, ridge=trim)


def _style_body(m, st, W, D, H, doors=1) -> None:
    walls, roof, trim = _style_mats(st)
    K.box((W, D, H), (0, 0, H / 2), walls, bevel=0.02, name="Walls")
    K.box((W + 0.04, D + 0.04, 0.08), (0, 0, 0.04), trim, name="Base")
    _style_roof(st, W, D, H, 0.42, roof, trim)
    xs = [-W / 2 + (i + 0.5) * W / doors for i in range(doors)]
    for i, x in enumerate(xs):
        K.door(Vector((x - 0.15, -D / 2 - 0.02, 0.4)), "-y", m, w=0.3, h=0.7)
        K.window(Vector((x + 0.22, -D / 2 - 0.02, 0.55)), "-y", m, lit=i % 2 == 0, w=0.24, h=0.32)
    K.window(Vector((W / 2 + 0.02, 0.0, 0.55)), "+x", m, lit=True, w=0.26, h=0.32)
    if st["roof_kind"] in ("gable", "thatch"):
        K.box((0.2, 0.2, 0.5), (W / 2 - 0.3, 0.2, H + 0.4), walls, name="Chimney")
    if st["feature"] == "dome":
        # Marble villas: a pergola and potted bay trees on the roof terrace, gilded door frames.
        wood = M.flat("Pergola", "#E9E2D2", 0.6)
        for x in (-W / 2 + 0.2, -W / 2 + 0.75):
            for y in (-D / 2 + 0.2, D / 2 - 0.2):
                K.box((0.05, 0.05, 0.45), (x, y, H + 0.3), wood, name="PergolaPost")
        for k in range(6):
            K.box((0.62, 0.035, 0.035), (-W / 2 + 0.47, -D / 2 + 0.2 + k * (D - 0.4) / 5, H + 0.54), wood, name="PergolaSlat")
        green = M.flat("Bay", "#4E7A3A", 0.8)
        for x in (W / 2 - 0.25, W / 2 - 0.55):
            K.cylinder(0.08, 0.14, (x, -D / 2 + 0.25, H + 0.15), m["stone"], verts=12, name="Pot")
            bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.13, location=(x, -D / 2 + 0.25, H + 0.33))
            bpy.context.active_object.data.materials.append(green)
        for x in xs:
            K.box((0.38, 0.03, 0.06), (x - 0.15, -D / 2 - 0.04, 0.78), trim, name="Lintel")
    elif st["feature"] == "antenna":
        # Technician housing: solar panels and a humming air unit on the roof, a lit glass band.
        panel = M.flat("Solar", "#1E2C44", 0.25, metallic=0.4)
        for k in range(2 if W < 2 else 4):
            K.box((0.42, 0.55, 0.03), (-W / 2 + 0.35 + k * 0.52, 0.05, H + 0.2), panel, rot=(0.35, 0, 0), name="Solar")
        K.box((0.3, 0.3, 0.22), (W / 2 - 0.3, D / 2 - 0.3, H + 0.19), m["iron"], name="AirUnit")
        K.cylinder(0.1, 0.03, (W / 2 - 0.3, D / 2 - 0.3, H + 0.31), M.flat("Fan", "#2A2E32", 0.5), verts=16, name="Fan")
        K.box((W + 0.02, 0.03, 0.08), (0, -D / 2 - 0.01, H - 0.12), M.flat("LedBand", "#9FC8E0", 0.2, emission="#CFE8FF", strength=1.2), name="LedBand")
    if st["feature"] == "cupola":
        K.box((W + 0.1, 0.45, 0.04), (0, -D / 2 - 0.2, 0.62), roof, rot=(0.2, 0, 0), name="Porch")
        for x in (-W / 2 + 0.1, W / 2 - 0.1):
            K.box((0.05, 0.05, 0.6), (x, -D / 2 - 0.38, 0.3), trim, name="PorchPost")


def style_house(key: str, terrace: bool):
    def build(m) -> None:
        st = STYLES[key]
        if terrace:
            _style_body(m, st, 2.5, 1.2, 1.0 if st["roof_kind"] != "flat" else 1.25, doors=2)
        else:
            _style_body(m, st, 1.45, 1.2, 0.9 if st["roof_kind"] != "flat" else 1.1)
    return build


def style_town_hall(key: str):
    def build(m) -> None:
        st = STYLES[key]
        walls, roof, trim = _style_mats(st)
        W, D, H = 2.6, 2.0, 1.5
        K.box((W + 0.2, D + 0.2, 0.15), (0, 0, 0.075), m["stone"], name="Plinth")
        K.box((W, D, H), (0, 0, 0.15 + H / 2), walls, bevel=0.02, name="Walls")
        _style_roof(st, W, D, 0.15 + H, 0.55, roof, trim)
        for i in range(4):
            K.box((1.5 - i * 0.12, 0.2, 0.05), (0, -D / 2 - 0.4 + i * 0.09, 0.025 + i * 0.05), m["stone"], name="Step")
        K.door(Vector((0, -D / 2 - 0.02, 0.6)), "-y", m, w=0.5, h=0.9)
        for x in (-0.85, 0.85):
            K.window(Vector((x, -D / 2 - 0.02, 0.85)), "-y", m, lit=x < 0, w=0.3, h=0.55)
        gold = M.flat("Gold", "#C9A44C", roughness=0.35, metallic=0.9)
        K.box((0.5, 0.02, 0.7), (0.45, -D / 2 - 0.04, 1.25), m["cloth_red"], name="Banner")
        K.cylinder(0.11, 0.02, (0.45, -D / 2 - 0.06, 1.4), gold, rot=(1.5708, 0, 0), verts=20, name="Emblem")
        top = 0.15 + H
        f = st["feature"]
        if f == "dome":
            for x in (-0.7, -0.25, 0.25, 0.7):
                K.cylinder(0.08, 1.2, (x, -D / 2 - 0.25, 0.75), walls, verts=14, name="Column")
            K.box((1.7, 0.4, 0.1), (0, -D / 2 - 0.2, 1.4), trim, name="Entablature")
            K.cylinder(0.6, 0.35, (0, 0.1, top + 0.35), walls, verts=24, name="Drum")
            bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=0.6, location=(0, 0.1, top + 0.55))
            dome = bpy.context.active_object
            dome.scale = (1, 1, 0.8)
            dome.data.materials.append(gold)
        elif f == "antenna":
            K.box((W + 0.05, 0.06, 0.35), (0, -D / 2 - 0.01, H * 0.62), M.flat("GlassBand", "#9FC8E0", 0.1, emission="#CFE8FF", strength=0.6), name="GlassBand")
            K.cylinder(0.04, 1.8, (0.8, 0.4, top + 0.9), m["iron"], verts=8, name="Mast")
            for z in (0.6, 1.1, 1.5):
                K.box((0.5 - z * 0.15, 0.03, 0.03), (0.8, 0.4, top + z), m["iron"], name="Dish")
            K.cylinder(0.05, 0.05, (0.8, 0.4, top + 1.82), M.flat("Beacon", "#FF4A3A", 0.3, emission="#FF4A3A", strength=4), verts=8, name="Beacon")
        elif f == "chimney":
            K.cylinder(0.22, 2.6, (0.9, 0.5, 1.3), walls, verts=16, name="Stack")
            K.cylinder(0.26, 0.12, (0.9, 0.5, 2.6), trim, verts=16, name="StackRim")
            K.cylinder(0.25, 0.03, (-0.6, -D / 2 - 0.03, 1.3), M.flat("ClockFace", "#E9E4D8", 0.5), rot=(1.5708, 0, 0), verts=24, name="Clock")
        elif f == "canopy":
            K.box((W + 0.6, 0.9, 0.05), (0, -D / 2 - 0.45, 1.05), m["roof_dark"], rot=(0.08, 0, 0), name="Canopy")
            for x in (-1.3, -0.45, 0.45, 1.3):
                K.cylinder(0.035, 1.0, (x, -D / 2 - 0.82, 0.5), m["iron"], verts=8, name="CanopyPost")
            K.cylinder(0.32, 0.04, (0, -D / 2 - 0.03, 1.5), M.flat("ClockFace", "#E9E4D8", 0.5), rot=(1.5708, 0, 0), verts=28, name="Clock")
            K.cylinder(0.35, 0.03, (0, -D / 2 - 0.02, 1.5), gold, rot=(1.5708, 0, 0), verts=28, name="ClockRim")
        elif f == "clock":
            K.box((0.6, 0.6, 2.0), (-0.9, 0.4, top + 1.0 - 0.6), walls, bevel=0.02, name="ClockTower")
            K.cylinder(0.2, 0.03, (-0.9, 0.09, top + 1.0), M.flat("ClockFace", "#E9E4D8", 0.5), rot=(1.5708, 0, 0), verts=24, name="Clock")
            gable(0.6, 0.6, top + 1.4, 0.35, roof)
        elif f == "silo":
            K.cylinder(0.45, 2.6, (0.9, 0.5, 1.3), M.flat("SiloStone", "#B8A88A", 0.85), verts=24, name="Silo")
            bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.5, radius2=0.05, depth=0.5, location=(0.9, 0.5, 2.85))
            bpy.context.active_object.data.materials.append(roof)
        elif f == "cupola":
            K.box((0.5, 0.5, 0.45), (0, 0.1, top + 0.75), trim, name="Cupola")
            bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.42, radius2=0, depth=0.35, location=(0, 0.1, top + 1.15))
            c = bpy.context.active_object
            c.rotation_euler = (0, 0, math.radians(45))
            c.data.materials.append(roof)
            K.cylinder(0.015, 0.4, (0, 0.1, top + 1.45), m["iron"], verts=6, name="Vane")
            K.box((0.25, 0.02, 0.08), (0.05, 0.1, top + 1.55), m["iron"], name="VaneArrow")
    return build


def style_warehouse(key: str):
    def build(m) -> None:
        st = STYLES[key]
        walls, roof, trim = _style_mats(st)
        W, D, H = 2.4, 2.0, 1.1
        K.box((W, D, H), (0, 0, H / 2), walls, bevel=0.02, name="Walls")
        _style_roof(st, W, D, H, 0.45, roof, trim)
        K.box((0.9, 0.04, 0.75), (0, -D / 2 - 0.02, 0.38), m["planks"], name="Gate")
        if st["stack"] == "cooling":
            bpy.ops.mesh.primitive_cone_add(vertices=28, radius1=0.7, radius2=0.45, depth=1.8, location=(0.8, 0.9, 0.9))
            bpy.context.active_object.data.materials.append(M.flat("Concrete", "#B8B4AC", 0.9))
        elif st["stack"] == "stacks":
            for x in (-0.8, 0.0):
                K.cylinder(0.14, 2.2, (x, 0.7, 1.1), walls, verts=12, name="Stack")
        else:
            for i in range(4):
                K.crate((0.9 + (i % 2) * 0.25, -D / 2 - 0.3 - (i // 2) * 0.25, 0), m, s=0.2, rot=0.3 * i)
    return build


def style_shop(key: str):
    def build(m) -> None:
        st = STYLES[key]
        walls, roof, trim = _style_mats(st)
        W, D, H = 1.5, 1.3, 0.9
        K.box((W, D, H), (0, 0, H / 2), walls, bevel=0.02, name="Walls")
        _style_roof(st, W, D, H, 0.38, roof, trim)
        for k in range(5):
            K.box((0.3, 0.45, 0.03), (-0.6 + k * 0.3, -D / 2 - 0.2, 0.74), trim if k % 2 else roof, rot=(0.3, 0, 0), name="Awning")
        K.door(Vector((-0.35, -D / 2 - 0.02, 0.4)), "-y", m)
        K.window(Vector((0.25, -D / 2 - 0.02, 0.5)), "-y", m, lit=True, w=0.5, h=0.32)
        K.crate((0.55, -D / 2 - 0.3, 0), m, s=0.18)
    return build


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
    "hanging_tree": (hanging_tree, (2, 2), "tree"),
    "train_head": (train_head, (1, 3), "building"),
    "train_car": (train_car, (1, 3), "building"),
    "train_tail": (train_tail, (1, 3), "building"),
    "platform": (platform, (1, 3), "building"),
    "coffin": (coffin, (1, 1), "building"),
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
    "house_shack__d7": (house_shack__d7, (2, 2), "building"),
    "house_terrace__d7": (house_terrace__d7, (3, 2), "building"),
    "town_hall__d7": (town_hall__d7, (3, 3), "building"),
    "warehouse__d7": (warehouse__d7, (3, 3), "building"),
    "economato__d7": (economato__d7, (2, 2), "building"),
    "house_shack__d2": (house_shack__d2, (2, 2), "building"),
    "house_terrace__d2": (house_terrace__d2, (3, 2), "building"),
    "town_hall__d2": (town_hall__d2, (3, 3), "building"),
    "warehouse__d2": (warehouse__d2, (3, 3), "building"),
    "economato__d2": (economato__d2, (2, 2), "building"),
    "poster_b": (poster_b, (1, 1), "prop"),
}

def _mesh_bounds():
    bpy.context.view_layer.update()
    xs, ys, zs = [], [], []
    for o in bpy.context.scene.objects:
        if o.type != "MESH":
            continue
        for c in o.bound_box:
            v = o.matrix_world @ Vector(c)
            xs.append(v.x)
            ys.append(v.y)
            zs.append(v.z)
    return min(xs), max(xs), min(ys), max(ys), max(zs)


def upgraded(base, footprint, level: int):
    """Same house, visibly better off (DECISIONS I-57). Level 2: a lean-to annex, flower boxes
    under the front windows and a radio aerial. Level 3: also a fenced front yard with shrubs,
    a gate lamp and a little pennant. Works around any regional builder via the mesh bounds."""
    def build(m) -> None:
        base(m)
        x0, x1, y0, y1, z1 = _mesh_bounds()
        fw, fd = footprint[0] / 2, footprint[1] / 2
        cx = (x0 + x1) / 2
        annex_wall = M.flat("AnnexWall", "#C9B08A", 0.85)
        annex_roof = M.flat("AnnexRoof", "#7A4E3A", 0.8)
        room = fw - x1 - 0.03
        if room > 0.22:
            aw = min(0.5, room)
            ad = (y1 - y0) * 0.55
            ay = (y0 + y1) / 2 + (y1 - y0) * 0.15
            K.box((aw, ad, 0.55), (x1 + aw / 2, ay, 0.275), annex_wall, bevel=0.01, name="Annex")
            roof = K.box((aw + 0.08, ad + 0.1, 0.05), (x1 + aw / 2, ay, 0.6), annex_roof, name="AnnexRoof")
            roof.rotation_euler = (0, math.radians(-14), 0)
            K.window(Vector((x1 + aw / 2, ay - ad / 2 - 0.02, 0.32)), "-y", m, lit=True, w=0.18, h=0.2)
        planter = M.flat("Planter", "#6B4A2E", 0.8)
        petals = [M.flat("PetalRed", "#E0483E", 0.6), M.flat("PetalYellow", "#F2C94C", 0.6),
                  M.flat("PetalPink", "#F28DB2", 0.6)]
        for i, x in enumerate((cx - (x1 - x0) * 0.3, cx + (x1 - x0) * 0.3)):
            K.box((0.3, 0.1, 0.08), (x, y0 - 0.06, 0.42), planter, name="Planter")
            for j in range(4):
                bpy.ops.mesh.primitive_uv_sphere_add(radius=0.045, location=(x - 0.11 + j * 0.075, y0 - 0.07, 0.49), segments=8, ring_count=6)
                bpy.context.active_object.data.materials.append(petals[(i + j) % 3])
        metal = M.flat("Aerial", "#9AA0A6", 0.4, metallic=0.8)
        K.cylinder(0.012, 0.5, (x0 + 0.2, (y0 + y1) / 2, z1 + 0.2), metal, verts=6, name="Aerial")
        K.box((0.3, 0.012, 0.012), (x0 + 0.2, (y0 + y1) / 2, z1 + 0.38), metal, name="AerialBar")
        if level >= 3:
            post = M.flat("Picket", "#F1ECE0", 0.7)
            fy = max(y0 - 0.38, -fd + 0.06)
            n = int((x1 - x0 + 0.2) / 0.12)
            for i in range(n + 1):
                x = x0 - 0.1 + i * 0.12
                if abs(x - cx) < 0.14:
                    continue  # the gate
                K.box((0.035, 0.035, 0.22), (x, fy, 0.11), post, name="Picket")
            for side in (x0 - 0.1, x1 + 0.1):
                K.box((0.035, abs(y0 - fy), 0.035), (side, (y0 + fy) / 2, 0.16), post, name="Rail")
            K.box((x1 - x0 + 0.2, 0.025, 0.03), (cx, fy, 0.16), post, name="Rail")
            leaf = M.flat("Shrub", "#4F9A3A", 0.9)
            for x in (x0 + 0.12, x1 - 0.12):
                bpy.ops.mesh.primitive_ico_sphere_add(radius=0.13, subdivisions=2, location=(x, (y0 + fy) / 2, 0.12))
                bpy.context.active_object.data.materials.append(leaf)
            K.lamppost((x1 - 0.02, fy + 0.02, 0), m)
            flag = M.flat("Pennant", "#E9A23B", 0.7)
            K.cylinder(0.01, 0.4, (x0 + 0.2, (y0 + y1) / 2, z1 + 0.62), metal, verts=6, name="Mast")
            K.box((0.18, 0.01, 0.1), (x0 + 0.29, (y0 + y1) / 2, z1 + 0.76), flag, name="Pennant")
    return build


for _k in ("d1", "d3", "d5", "d6", "d8", "d9", "d10"):
    CATALOGUE[f"house_shack__{_k}"] = (style_house(_k, False), (2, 2), "building")
    CATALOGUE[f"house_terrace__{_k}"] = (style_house(_k, True), (3, 2), "building")
    CATALOGUE[f"town_hall__{_k}"] = (style_town_hall(_k), (3, 3), "building")
    CATALOGUE[f"warehouse__{_k}"] = (style_warehouse(_k), (3, 3), "building")
    CATALOGUE[f"economato__{_k}"] = (style_shop(_k), (2, 2), "building")

for _name in [k for k in list(CATALOGUE) if k in ("house_shack", "house_terrace") or k.startswith(("house_shack__", "house_terrace__"))]:
    _b, _fp, _kind = CATALOGUE[_name]
    for _lvl in (2, 3):
        CATALOGUE[f"{_name}_l{_lvl}"] = (upgraded(_b, _fp, _lvl), _fp, _kind)


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
