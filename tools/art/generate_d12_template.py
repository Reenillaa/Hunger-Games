"""
Generates the fixed terrain template of District XII (src/content/maps/d12.json).

The template is the single source of truth shared by the game logic (buildable cells, zones)
and the art pipeline (pre-rendered terrain). Deterministic: no randomness beyond a fixed hash.

  python3 tools/art/generate_d12_template.py

Grid: 48x48 cells, cell (x, y). Screen top corner = (0, 0); the valley opens towards the viewer.
Terrain codes:
  R rock / mountain (unbuildable)   s scree / foothill (unbuildable)   v coal seam (mine sites)
  w river                           b bridge (road over river)         f forest floor
  g grass (buildable)               d dirt (buildable, town core)      p plaza (fixed)
  t railway (fixed)                 r dirt road (initial roads)
"""

from __future__ import annotations

import json
import math
import pathlib

W = H = 48
ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "src/content/maps/d12.json"


def hash_noise(x: float, y: float, seed: int = 0) -> float:
    """Smooth value noise in [0, 1] from a fixed integer hash (bilinear)."""
    def h(ix: int, iy: int) -> float:
        n = (ix * 374761393 + iy * 668265263 + seed * 982451653) & 0xFFFFFFFF
        n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
        return ((n ^ (n >> 16)) & 0xFFFF) / 0xFFFF

    x0, y0 = math.floor(x), math.floor(y)
    fx, fy = x - x0, y - y0
    sx, sy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    top = h(x0, y0) * (1 - sx) + h(x0 + 1, y0) * sx
    bottom = h(x0, y0 + 1) * (1 - sx) + h(x0 + 1, y0 + 1) * sx
    return top * (1 - sy) + bottom * sy


def fbm(x: float, y: float, seed: int) -> float:
    return 0.55 * hash_noise(x / 6, y / 6, seed) + 0.3 * hash_noise(x / 3, y / 3, seed + 7) + 0.15 * hash_noise(x, y, seed + 13)


PLAZA = (24, 21, 29, 26)  # x0, y0, x1, y1 (inclusive)
RAIL_X = (44, 45)


def river_x(y: float) -> float:
    """River centre line: born in the north-west mountains, crossing to the south."""
    return 9 + y * 0.33 + 2.2 * math.sin(y / 5.5)


def build() -> dict:
    terrain = [["g"] * W for _ in range(H)]
    elevation = [[0.0] * W for _ in range(H)]

    for y in range(H):
        for x in range(W):
            n = fbm(x, y, 3)
            # Mountain mass along the back edges (small y, and small x in the north half).
            back = 5.5 + 2.5 * n - y
            side = (4.0 + 2.0 * n - x) if y < 26 else -99
            mountain = max(back, side * 0.9)
            if mountain > 0:
                terrain[y][x] = "R"
                elevation[y][x] = round(min(4.0, 0.8 + mountain * 0.65 + n * 0.6), 2)
            elif mountain > -1.6:
                terrain[y][x] = "s"
                elevation[y][x] = round(max(0.15, 0.55 + mountain * 0.25), 2)

    # Coal seams at the mountain foot: future mine sites.
    for (cx, cy) in [(16, 8), (32, 8), (6, 14)]:
        for dy in range(-1, 2):
            for dx in range(-1, 2):
                x, y = cx + dx, cy + dy
                if terrain[y][x] in ("s", "g"):
                    terrain[y][x] = "v"
                    elevation[y][x] = max(elevation[y][x], 0.3)

    # Forest beyond the fence: south-west corner.
    for y in range(H):
        for x in range(W):
            if terrain[y][x] == "g" and (x < 17 - 3 * fbm(x, y, 9)) and y > 31 + 3 * fbm(x, y, 5):
                terrain[y][x] = "f"

    # River (1-2 cells wide) with a bridge where the main road crosses.
    for y in range(H):
        cx = river_x(y)
        for x in range(W):
            if abs(x - cx) <= (0.6 if y < 12 else 1.0) and terrain[y][x] not in ("R",):
                terrain[y][x] = "w"
                elevation[y][x] = -0.25

    # Railway along the east edge, from the coal loading yard to the south.
    for y in range(8, H):
        for x in RAIL_X:
            if terrain[y][x] != "w":
                terrain[y][x] = "t"
                elevation[y][x] = 0.0

    # Town core: dirt around the plaza.
    px, py = (PLAZA[0] + PLAZA[2]) / 2, (PLAZA[1] + PLAZA[3]) / 2
    for y in range(H):
        for x in range(W):
            if terrain[y][x] == "g" and math.hypot((x - px) * 0.9, y - py) < 8.5 + 2.5 * fbm(x, y, 11):
                terrain[y][x] = "d"
    for y in range(PLAZA[1], PLAZA[3] + 1):
        for x in range(PLAZA[0], PLAZA[2] + 1):
            terrain[y][x] = "p"

    # Initial dirt roads: plaza -> mines, plaza -> station, plaza -> bridge -> forest gate.
    def road(points: list[tuple[int, int]]) -> None:
        for (x0, y0), (x1, y1) in zip(points, points[1:]):
            steps = max(abs(x1 - x0), abs(y1 - y0))
            for i in range(steps + 1):
                x = round(x0 + (x1 - x0) * i / steps)
                y = round(y0 + (y1 - y0) * i / steps)
                code = terrain[y][x]
                if code == "w":
                    terrain[y][x] = "b"
                elif code in ("g", "d", "s", "f"):
                    terrain[y][x] = "r"
                    elevation[y][x] = min(elevation[y][x], 0.2)

    road([(26, 21), (26, 14), (16, 8)])        # north-west mine
    road([(27, 21), (31, 9)])                  # north mine
    road([(29, 24), (36, 24), (43, 24)])       # station
    road([(24, 24), (14, 26), (9, 30), (6, 36)])  # bridge and forest gate
    road([(26, 26), (26, 40), (30, 46)])       # south lane

    return {
        "id": "d12",
        "width": W,
        "height": H,
        "legend": {
            "R": "rock", "s": "scree", "v": "coalSeam", "w": "water", "b": "bridge", "f": "forest",
            "g": "grass", "d": "dirt", "p": "plaza", "t": "rail", "r": "road",
        },
        "plaza": {"x0": PLAZA[0], "y0": PLAZA[1], "x1": PLAZA[2], "y1": PLAZA[3]},
        "terrain": ["".join(row) for row in terrain],
        "elevation": elevation,
    }


def main() -> None:
    data = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, separators=(",", ":")) + "\n", encoding="utf8")
    print("\n".join(data["terrain"]))


if __name__ == "__main__":
    main()
