"""
Generates the fixed template of the forest arena (src/content/maps/arena_forest.json), shared by
the arena rules (movement, cover, vision, resources) and the pre-rendered terrain.

  python3 tools/art/generate_arena_template.py

Codes:
  c clearing   F forest   D dense forest   b brush   r rocks (cover)   R cliff (impassable)
  w shallow water (ford, drinkable)   W deep water (impassable)   v cave (hide)   u ruins (cover)
  X the Relicario plaza (supplies at the start)
"""

from __future__ import annotations

import json
import math
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from generate_d12_template import fbm  # noqa: E402

N = 40
ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "src/content/maps/arena_forest.json"


def build() -> dict:
    t = [["F"] * N for _ in range(N)]
    elev = [[0.0] * N for _ in range(N)]
    cx = cy = N / 2 - 0.5
    for y in range(N):
        for x in range(N):
            n = fbm(x * 1.3, y * 1.3, 21)
            m = fbm(x * 0.9, y * 0.9, 33)
            if n > 0.62:
                t[y][x] = "D"
            elif n < 0.36:
                t[y][x] = "c"
            elif m > 0.6:
                t[y][x] = "b"
            # Rocky hills in the north-east with caves and cliffs.
            hill = 1.0 - math.hypot(x - 31, y - 8) / 9 + (fbm(x, y, 41) - 0.5) * 0.5
            if hill > 0.55:
                t[y][x] = "R" if hill > 0.92 else "r"
                elev[y][x] = round(hill * 2.4, 2)
            # Edges: the arena wall is a dense, impassable thicket.
            if x in (0, N - 1) or y in (0, N - 1):
                t[y][x] = "D"
    for (x, y) in [(29, 11), (34, 9), (27, 6)]:
        t[y][x] = "v"
    # River from the north-west to the south-east with fords; a lake in the south-west.
    for y in range(N):
        rx = 6 + y * 0.55 + 2.0 * math.sin(y / 4.5)
        for x in range(N):
            d = abs(x - rx)
            if d < 0.7:
                t[y][x] = "w" if y % 9 in (4, 5) else "W"
            elif d < 1.2 and t[y][x] not in ("R", "r"):
                t[y][x] = "w"
    for y in range(N):
        for x in range(N):
            if math.hypot((x - 9) * 1.1, y - 31) < 4.2 + (fbm(x, y, 55) - 0.5) * 2:
                t[y][x] = "W" if math.hypot((x - 9) * 1.1, y - 31) < 2.8 else "w"
    # Ruins of an abandoned research station in the south-east.
    for y in range(27, 33):
        for x in range(28, 34):
            if (x + y) % 3 != 0:
                t[y][x] = "u"
    # The Relicario: a clearing in the centre with the supply cache.
    for y in range(N):
        for x in range(N):
            d = math.hypot(x - cx, y - cy)
            if d < 2.2:
                t[y][x] = "X"
            elif d < 4.6 and t[y][x] not in ("W", "w"):
                t[y][x] = "c"
    return {
        "id": "arena_forest",
        "width": N,
        "height": N,
        "legend": {"c": "clearing", "F": "forest", "D": "dense", "b": "brush", "r": "rocks", "R": "cliff",
                   "w": "shallow", "W": "deep", "v": "cave", "u": "ruins", "X": "cache"},
        "terrain": ["".join(row) for row in t],
        "elevation": elev,
    }


if __name__ == "__main__":
    data = build()
    OUT.write_text(json.dumps(data, separators=(",", ":")) + "\n", encoding="utf8")
    print("\n".join(data["terrain"]))
