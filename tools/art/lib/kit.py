"""
Modular geometry kit for the district: boards, corrugated sheets, frames, roofs, props.
All dimensions in world units (1 unit = 1 cell ≈ 1.9 m). Deterministic jitter (no randomness).
"""

from __future__ import annotations

import math

import bpy
from mathutils import Euler, Vector


def jitter(i: int, salt: int = 0) -> float:
    """Deterministic pseudo-random in [-1, 1]."""
    n = (i * 374761393 + salt * 668265263) & 0xFFFFFFFF
    n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 0x7FFF - 1.0


def link(obj: bpy.types.Object, parent: bpy.types.Object | None = None) -> bpy.types.Object:
    if obj.name not in bpy.context.scene.collection.objects:
        bpy.context.scene.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def box(size, loc, mat, rot=(0.0, 0.0, 0.0), bevel: float = 0.0, name: str = "Box") -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = "ANGLE"
    obj.data.materials.append(mat)
    return obj


def cylinder(radius, depth, loc, mat, rot=(0.0, 0.0, 0.0), verts: int = 16, name="Cyl") -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return obj


def board_wall(origin: Vector, length: float, height: float, axis: str, mat, *, board_w: float = 0.13,
               thick: float = 0.03, salt: int = 0, gap_every: int = 0, outward: float = 1.0) -> list:
    """Vertical board-and-batten wall along X or Y starting at `origin` (bottom-left corner)."""
    parts = []
    n = max(1, int(length / board_w))
    w = length / n
    for i in range(n):
        if gap_every and i % gap_every == gap_every - 1:
            continue
        h = height * (1 + 0.025 * jitter(i, salt))
        t = 0.6 * jitter(i, salt + 3)
        off = (i + 0.5) * w
        if axis == "x":
            loc = (origin.x + off, origin.y + outward * thick * 0.5 * (1 + 0.3 * jitter(i, salt + 5)), origin.z + h / 2)
            size = (w * 0.97, thick, h)
        else:
            loc = (origin.x + outward * thick * 0.5 * (1 + 0.3 * jitter(i, salt + 5)), origin.y + off, origin.z + h / 2)
            size = (thick, w * 0.97, h)
        parts.append(box(size, loc, mat, rot=(0, 0, math.radians(t * 0.6)), name="Board"))
    # Battens (horizontal rails) at the top and bottom
    for z in (0.12, height - 0.12):
        if axis == "x":
            parts.append(box((length, thick * 1.2, 0.06), (origin.x + length / 2, origin.y + outward * thick * 1.4, origin.z + z), mat, name="Rail"))
        else:
            parts.append(box((thick * 1.2, length, 0.06), (origin.x + outward * thick * 1.4, origin.y + length / 2, origin.z + z), mat, name="Rail"))
    return parts


def corrugated_sheet(width: float, length: float, mat, waves: int = 0, amp: float = 0.012,
                     name: str = "Sheet") -> bpy.types.Object:
    """A corrugated metal sheet in the XY plane (corrugation along X), centred at the origin."""
    waves = waves or max(4, int(width / 0.06))
    seg = waves * 4
    verts, faces = [], []
    for i in range(seg + 1):
        x = -width / 2 + width * i / seg
        z = amp * math.sin(i / seg * waves * math.tau)
        verts += [(x, -length / 2, z), (x, length / 2, z)]
    for i in range(seg):
        a = i * 2
        faces.append((a, a + 2, a + 3, a + 1))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    obj = bpy.data.objects.new(name, mesh)
    link(obj)
    sol = obj.modifiers.new("Solid", "SOLIDIFY")
    sol.thickness = 0.008
    obj.data.materials.append(mat)
    for p in mesh.polygons:
        p.use_smooth = True
    return obj


def sheet_roof(width: float, depth: float, base_z: float, rise: float, mat, *, overhang: float = 0.12,
               sheets_per_side: int = 4, salt: int = 0, ridge_mat=None, missing: int = -1) -> list:
    """Gable roof of overlapping corrugated sheets, ridge along X, slopes towards ±Y."""
    parts = []
    half = depth / 2 + overhang
    slope_len = math.hypot(half, rise)
    angle = math.atan2(rise, half)
    sheet_w = (width + 2 * overhang) / sheets_per_side
    for side in (-1, 1):
        for k in range(sheets_per_side):
            idx = k + (side + 1) * 10
            if idx == missing:
                continue
            sheet = corrugated_sheet(sheet_w * 1.08, slope_len * (1.0 + 0.02 * jitter(idx, salt)), mat, name="RoofSheet")
            x = -width / 2 - overhang + sheet_w * (k + 0.5)
            y = side * half / 2
            z = base_z + rise / 2 + 0.01 * k * (1 if k % 2 else -1) * 0.5
            sheet.location = (x, y, z)
            sheet.rotation_euler = Euler((-side * angle + math.radians(0.8 * jitter(idx, salt + 1)), 0, math.radians(0.6 * jitter(idx, salt + 2))), "XYZ")
            parts.append(sheet)
    if ridge_mat is not None:
        parts.append(box((width + 2 * overhang, 0.12, 0.05), (0, 0, base_z + rise + 0.015), ridge_mat, rot=(math.radians(45), 0, 0), name="Ridge"))
    return parts


def gable_infill(width: float, depth: float, base_z: float, rise: float, mat, inset: float = 0.0) -> bpy.types.Object:
    w, d = width / 2 - inset, depth / 2
    verts = [(-w, -d, base_z), (-w, d, base_z), (-w, 0, base_z + rise), (w, -d, base_z), (w, d, base_z), (w, 0, base_z + rise)]
    mesh = bpy.data.meshes.new("Gable")
    mesh.from_pydata(verts, [], [(0, 2, 1), (3, 4, 5)])
    obj = bpy.data.objects.new("Gable", mesh)
    link(obj)
    obj.data.materials.append(mat)
    return obj


def window(center: Vector, facing: str, mats, *, w: float = 0.42, h: float = 0.36, lit: bool = True,
           shutters: bool = False) -> list:
    """Framed window with cross mullion on a wall facing +X or -Y."""
    parts = []
    frame = mats["beam"]
    glass = mats["glass_lit"] if lit else mats["glass_dark"]
    t = 0.05
    if facing == "+x":
        parts.append(box((0.02, w, h), center, glass, name="Glass"))
        for dy in (-w / 2, w / 2):
            parts.append(box((t, t, h + t), center + Vector((0.02, dy, 0)), frame))
        for dz in (-h / 2, h / 2):
            parts.append(box((t, w + t, t), center + Vector((0.02, 0, dz)), frame))
        parts.append(box((t * 0.6, w, t * 0.6), center + Vector((0.03, 0, 0)), frame))
        parts.append(box((t * 0.6, t * 0.6, h), center + Vector((0.03, 0, 0)), frame))
        parts.append(box((0.08, w + 0.12, 0.04), center + Vector((0.05, 0, -h / 2 - 0.03)), frame, name="Sill"))
        if shutters:
            for s in (-1, 1):
                parts.append(box((0.025, w / 2, h + 0.04), center + Vector((0.04, s * (w * 0.75 + 0.03), 0)), mats["planks_pale"], rot=(0, 0, math.radians(s * 8))))
    else:  # facing -y
        parts.append(box((w, 0.02, h), center, glass, name="Glass"))
        for dx in (-w / 2, w / 2):
            parts.append(box((t, t, h + t), center + Vector((dx, -0.02, 0)), frame))
        for dz in (-h / 2, h / 2):
            parts.append(box((w + t, t, t), center + Vector((0, -0.02, dz)), frame))
        parts.append(box((w, t * 0.6, t * 0.6), center + Vector((0, -0.03, 0)), frame))
        parts.append(box((t * 0.6, t * 0.6, h), center + Vector((0, -0.03, 0)), frame))
        parts.append(box((w + 0.12, 0.08, 0.04), center + Vector((0, -0.05, -h / 2 - 0.03)), frame, name="Sill"))
        if shutters:
            for s in (-1, 1):
                parts.append(box((w / 2, 0.025, h + 0.04), center + Vector((s * (w * 0.75 + 0.03), -0.04, 0)), mats["planks_pale"], rot=(0, 0, math.radians(-s * 8))))
    return parts


def door(center: Vector, facing: str, mats, w: float = 0.42, h: float = 0.82) -> list:
    parts = []
    planks = 5
    for i in range(planks):
        off = -w / 2 + (i + 0.5) * w / planks
        if facing == "-y":
            parts.append(box((w / planks * 0.95, 0.04, h), center + Vector((off, -0.02, 0)), mats["planks_pale"], name="DoorPlank"))
        else:
            parts.append(box((0.04, w / planks * 0.95, h), center + Vector((0.02, off, 0)), mats["planks_pale"], name="DoorPlank"))
    for dz in (-h * 0.3, h * 0.3):
        size = (w, 0.05, 0.06) if facing == "-y" else (0.05, w, 0.06)
        shift = Vector((0, -0.05, dz)) if facing == "-y" else Vector((0.05, 0, dz))
        parts.append(box(size, center + shift, mats["beam"], name="DoorBrace"))
    knob = center + (Vector((w * 0.35, -0.07, 0)) if facing == "-y" else Vector((0.07, w * 0.35, 0)))
    parts.append(cylinder(0.02, 0.03, knob, mats["iron"], rot=(math.radians(90), 0, 0) if facing == "-y" else (0, math.radians(90), 0)))
    return parts


def barrel(loc, mats, radius: float = 0.12, height: float = 0.3) -> list:
    parts = [cylinder(radius, height, Vector(loc) + Vector((0, 0, height / 2)), mats["planks"], verts=20, name="Barrel")]
    for dz in (0.06, height - 0.06):
        parts.append(cylinder(radius * 1.03, 0.025, Vector(loc) + Vector((0, 0, dz)), mats["iron"], verts=20, name="Hoop"))
    return parts


def crate(loc, mats, s: float = 0.22, rot: float = 0.0) -> list:
    return [box((s, s, s), Vector(loc) + Vector((0, 0, s / 2)), mats["planks_pale"], rot=(0, 0, rot), bevel=0.01, name="Crate")]


def woodpile(loc, mats, length: float = 0.6, rows: int = 3) -> list:
    parts = []
    k = 0
    for r in range(rows):
        count = 6 - r
        for i in range(count):
            x = loc[0] - (count - 1) * 0.045 + i * 0.09
            parts.append(cylinder(0.045, length * (1 + 0.05 * jitter(k, 9)), (x, loc[1], loc[2] + 0.045 + r * 0.078),
                                  mats["bark"], rot=(math.radians(90), 0, 0), verts=8, name="Log"))
            k += 1
    return parts


def coal_pile(loc, mats, radius: float = 0.5, height: float = 0.35) -> list:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=1.0, location=loc)
    pile = bpy.context.active_object
    pile.scale = (radius, radius * 0.85, height)
    disp_tex = bpy.data.textures.new("CoalLumps", type="VORONOI")
    disp_tex.noise_scale = 0.12
    sub = pile.modifiers.new("Sub", "SUBSURF")
    sub.levels = 2
    sub.render_levels = 3
    disp = pile.modifiers.new("Lumps", "DISPLACE")
    disp.texture = disp_tex
    disp.strength = 0.05
    pile.data.materials.append(mats["coal"])
    bpy.ops.object.shade_smooth()
    return [pile]


def lamppost(loc, mats, height: float = 1.05) -> list:
    x, y, z = loc
    parts = [cylinder(0.03, height, (x, y, z + height / 2), mats["iron"], verts=10, name="Post")]
    parts.append(box((0.22, 0.03, 0.03), (x - 0.09, y, z + height - 0.02), mats["iron"], name="Arm"))
    parts.append(cylinder(0.06, 0.08, (x - 0.18, y, z + height - 0.08), mats["soot"], verts=10, name="Shade"))
    parts.append(cylinder(0.035, 0.05, (x - 0.18, y, z + height - 0.13), mats["lamp"], verts=10, name="Bulb"))
    return parts
