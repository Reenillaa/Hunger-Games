"""
Terrain templates of the other playable districts (src/content/maps/d11.json, d4.json).
Same grid, codes, plaza (in front of the town hall) and railway as District 12
(see generate_d12_template.py), different land:

  d11  wide fields and orchards (f = orchard rows here), low hills, a river with a bridge
  d4   the coast: open sea to the west, a sandy beach (d), cliffs to the north, a harbour

  python3 tools/art/generate_district_templates.py
"""

from __future__ import annotations

import json
import math
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from generate_d12_template import PLAZA, RAIL_X, W, H, fbm  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[2]
LEGEND = {
    "R": "rock", "s": "scree", "v": "coalSeam", "w": "water", "b": "bridge", "f": "forest",
    "g": "grass", "d": "dirt", "p": "plaza", "t": "rail", "r": "road",
}


def blank():
    return [["g"] * W for _ in range(H)], [[0.0] * W for _ in range(H)]


def town_core(terrain, radius: float, seed: int) -> None:
    px, py = (PLAZA[0] + PLAZA[2]) / 2, (PLAZA[1] + PLAZA[3]) / 2
    for y in range(H):
        for x in range(W):
            if terrain[y][x] == "g" and math.hypot((x - px) * 0.9, y - py) < radius + 2.5 * fbm(x, y, seed):
                terrain[y][x] = "d"
    for y in range(PLAZA[1], PLAZA[3] + 1):
        for x in range(PLAZA[0], PLAZA[2] + 1):
            terrain[y][x] = "p"


def flatten_core(elevation) -> None:
    px, py = (PLAZA[0] + PLAZA[2]) / 2, (PLAZA[1] + PLAZA[3]) / 2
    for y in range(H):
        for x in range(W):
            d = math.hypot(x - px, y - py)
            if d < 13 and elevation[y][x] > 0:
                elevation[y][x] = round(elevation[y][x] * max(0.0, (d - 8) / 5), 2)


def railway(terrain, elevation) -> None:
    for y in range(8, H):
        for x in RAIL_X:
            if terrain[y][x] != "w":
                terrain[y][x] = "t"
                elevation[y][x] = 0.0


def make_road(terrain, elevation):
    def road(points) -> None:
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
    return road


def build_d11() -> dict:
    terrain, elevation = blank()
    # Low hills along the back edge only: the district is a wide, open plain.
    for y in range(H):
        for x in range(W):
            n = fbm(x, y, 5)
            hill = 2.5 + 1.8 * n - y
            if hill > 0.6:
                terrain[y][x] = "R" if hill > 1.6 else "s"
                elevation[y][x] = round(min(2.0, 0.4 + hill * 0.45), 2)
    # Orchard blocks in regular rows (rendered as tended groves), west and south-east.
    for y in range(H):
        for x in range(W):
            if terrain[y][x] != "g":
                continue
            west = x < 14 and 10 < y < 40 and fbm(x, y, 9) > 0.42
            south_east = x > 30 and y > 33 and x < 43 and fbm(x, y, 12) > 0.45
            if west or south_east:
                terrain[y][x] = "f"
    # A slow river from the north hills to the south-west, crossed by the main road.
    for y in range(H):
        cx = 17 + y * -0.12 + 2.5 * math.sin(y / 6.0)
        for x in range(W):
            if abs(x - cx) <= 0.9 and terrain[y][x] not in ("R",):
                terrain[y][x] = "w"
                elevation[y][x] = -0.25
    # Rolling hills under the fields (the town core stays level).
    for y in range(H):
        for x in range(W):
            if terrain[y][x] in ("g", "f") and elevation[y][x] == 0.0:
                elevation[y][x] = round(0.55 * max(0.0, fbm(x * 0.8, y * 0.8, 44) - 0.3), 2)
    railway(terrain, elevation)
    town_core(terrain, 7.5, 11)
    flatten_core(elevation)
    road = make_road(terrain, elevation)
    road([(24, 20), (23, 12), (20, 4)])        # north fields
    road([(29, 20), (34, 10), (38, 5)])        # north-east fields
    road([(29, 24), (36, 24), (43, 24)])       # station
    road([(24, 24), (12, 26), (4, 30)])        # bridge and western orchards
    road([(26, 26), (26, 40), (30, 46)])       # south lane
    return pack("d11", terrain, elevation)


def build_d4() -> dict:
    terrain, elevation = blank()
    # Cliffs to the north, a headland to the north-west.
    for y in range(H):
        for x in range(W):
            n = fbm(x, y, 7)
            cliff = 4.0 + 2.0 * n - y
            if cliff > 0:
                terrain[y][x] = "R"
                elevation[y][x] = round(min(3.0, 0.8 + cliff * 0.5), 2)
            elif cliff > -1.4:
                terrain[y][x] = "s"
                elevation[y][x] = round(max(0.15, 0.5 + cliff * 0.25), 2)
    # The open sea to the west with a sandy beach; a small bay forms the harbour.
    for y in range(H):
        coast = 11 + 3.0 * math.sin(y / 7.0) + 3.0 * (fbm(0, y, 21) - 0.5) + (y - 24) * 0.08
        for x in range(W):
            bay = math.hypot(x - 11, (y - 22) * 1.4) < 3.2
            if x < coast or bay:
                terrain[y][x] = "w"
                elevation[y][x] = -0.25
            elif x < coast + 2.2 and terrain[y][x] in ("g", "s"):
                terrain[y][x] = "d"
                elevation[y][x] = 0.05
    # Pines on the cliff tops (north-east).
    for y in range(H):
        for x in range(W):
            if terrain[y][x] == "g" and y < 12 and x > 30 and fbm(x, y, 31) > 0.45:
                terrain[y][x] = "f"
    # The land climbs from the beach towards the cliffs: a terraced coast.
    for y in range(H):
        for x in range(W):
            if terrain[y][x] in ("g", "f"):
                elevation[y][x] = round(min(1.1, max(0.0, (x - 14) * 0.03) + max(0.0, (14 - y) * 0.08)), 2)
            if terrain[y][x] == "R":
                elevation[y][x] = round(min(4.5, elevation[y][x] * 1.5 + 0.6), 2)
    railway(terrain, elevation)
    town_core(terrain, 8.0, 17)
    flatten_core(elevation)
    road = make_road(terrain, elevation)
    road([(24, 23), (16, 22), (14, 22)])       # harbour
    road([(29, 24), (36, 24), (43, 24)])       # station
    road([(24, 20), (20, 12), (17, 7)])        # cliff path
    road([(26, 26), (24, 38), (20, 46)])       # south along the shore
    return pack("d4", terrain, elevation)


def pack(map_id: str, terrain, elevation) -> dict:
    return {
        "id": map_id,
        "width": W,
        "height": H,
        "legend": LEGEND,
        "plaza": {"x0": PLAZA[0], "y0": PLAZA[1], "x1": PLAZA[2], "y1": PLAZA[3]},
        "terrain": ["".join(row) for row in terrain],
        "elevation": elevation,
    }


def main() -> None:
    for data in (build_d11(), build_d4()):
        out = ROOT / f"src/content/maps/{data['id']}.json"
        out.write_text(json.dumps(data, separators=(",", ":")) + "\n", encoding="utf8")
        print(data["id"])
        print("\n".join(data["terrain"]))


if __name__ == "__main__":
    main()
