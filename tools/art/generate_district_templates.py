"""
Terrain templates of the other playable districts (src/content/maps/d11.json, d4.json). Each has
its own plan — plaza, streets, land — sharing only the codes and the Capitol's railway (x 44–45):

  d11  the farm district: a small town in the south-west and, around it, a grid of crop parcels
       (c) cut by straight dirt tracks and irrigation canals, orchard rows to the east, low hills
  d4   the harbour district: the town climbs a slope above the sea; the plaza opens onto the quay,
       piers (b) run into the water, a sandy beach (d), rocky shore (s) and tall cliffs to the east

Codes as in generate_d12_template.py, plus  c = cultivated parcel (buildable, rendered as furrows).

  python3 tools/art/generate_district_templates.py
"""

from __future__ import annotations

import json
import math
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from generate_d12_template import RAIL_X, W, H, fbm  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[2]
LEGEND = {
    "R": "rock", "s": "scree", "v": "coalSeam", "w": "water", "b": "bridge", "f": "forest",
    "g": "grass", "d": "dirt", "p": "plaza", "t": "rail", "r": "road", "c": "crops",
}


def blank(code: str = "g"):
    return [[code] * W for _ in range(H)], [[0.0] * W for _ in range(H)]


def town_core(terrain, plaza, radius: float, seed: int, keep=("w", "b", "R", "t")) -> None:
    px, py = (plaza[0] + plaza[2]) / 2, (plaza[1] + plaza[3]) / 2
    for y in range(H):
        for x in range(W):
            if terrain[y][x] not in keep and math.hypot((x - px) * 0.9, y - py) < radius + 2.5 * fbm(x, y, seed):
                terrain[y][x] = "d"
    for y in range(plaza[1], plaza[3] + 1):
        for x in range(plaza[0], plaza[2] + 1):
            terrain[y][x] = "p"


def flatten(elevation, plaza, inner: float = 7, outer: float = 12) -> None:
    px, py = (plaza[0] + plaza[2]) / 2, (plaza[1] + plaza[3]) / 2
    for y in range(H):
        for x in range(W):
            d = math.hypot(x - px, y - py)
            if d < outer and elevation[y][x] > 0:
                elevation[y][x] = round(elevation[y][x] * max(0.0, (d - inner) / (outer - inner)), 2)


def railway(terrain, elevation, y0: int = 0) -> None:
    for y in range(y0, H):
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
                elif code in ("g", "d", "s", "f", "c"):
                    terrain[y][x] = "r"
                    elevation[y][x] = min(elevation[y][x], 0.2)
    return road


D11_PLAZA = (9, 31, 14, 36)
D4_PLAZA = (19, 18, 24, 23)


def build_d11() -> dict:
    terrain, elevation = blank("c")
    # A low ridge along the far north edge; everything else is farmland.
    for y in range(H):
        for x in range(W):
            n = fbm(x, y, 5)
            hill = 2.0 + 1.6 * n - y
            if hill > 0.5:
                terrain[y][x] = "R" if hill > 1.5 else "s"
                elevation[y][x] = round(min(1.8, 0.4 + hill * 0.4), 2)
            else:
                elevation[y][x] = round(0.45 * max(0.0, fbm(x * 0.7, y * 0.7, 44) - 0.35), 2)
    # Fallow strips and meadows between the parcels so the land is not one flat colour.
    for y in range(H):
        for x in range(W):
            if terrain[y][x] == "c" and fbm(x * 1.6, y * 1.6, 61) > 0.66:
                terrain[y][x] = "g"
    # Orchard rows in the east: every other row planted.
    for y in range(28, 44):
        for x in range(30, 43):
            if terrain[y][x] in ("c", "g") and y % 2 == 0:
                terrain[y][x] = "f"
    # Irrigation canals: one north–south, two east–west; straight, man-made.
    for y in range(4, H):
        for x in (21,):
            terrain[y][x] = "w"
            elevation[y][x] = -0.25
    for x in range(0, 44):
        for y in (14, 26):
            if terrain[y][x] not in ("R", "s"):
                terrain[y][x] = "w"
                elevation[y][x] = -0.25
    railway(terrain, elevation, 6)
    town_core(terrain, D11_PLAZA, 6.0, 11)
    flatten(elevation, D11_PLAZA)
    road = make_road(terrain, elevation)
    # Straight farm tracks every eight cells, crossing the canals on small bridges.
    for x in (8, 16, 29, 37):
        road([(x, 4), (x, 46)])
    for y in (8, 20, 33, 41):
        road([(1, y), (43, y)])
    road([(14, 33), (43, 33)])                 # main street to the station
    return pack("d11", terrain, elevation, D11_PLAZA)


def build_d4() -> dict:
    terrain, elevation = blank("g")
    # The sea fills the west and a deep bay; the coast is ragged with rocks.
    for y in range(H):
        coast = 16 + 4.0 * math.sin(y / 6.0 + 1.3) + 3.5 * (fbm(0, y * 1.3, 21) - 0.5)
        for x in range(W):
            bay = math.hypot((x - 12) * 0.8, y - 38) < 7.5
            if x < coast or bay:
                terrain[y][x] = "w"
                elevation[y][x] = -0.25
            elif x < coast + 1.2 and fbm(x, y, 3) > 0.55:
                terrain[y][x] = "s"
                elevation[y][x] = 0.25
            elif x < coast + 3.0:
                terrain[y][x] = "d"
                elevation[y][x] = 0.05
            else:
                # The land climbs to the east and north: a terraced coast up to the cliffs.
                rise = max(0.0, (x - coast - 3) * 0.045) + max(0.0, (10 - y) * 0.06)
                elevation[y][x] = round(min(1.4, rise), 2)
    # Tall cliffs and scree along the east, pines on the heights.
    for y in range(H):
        for x in range(W):
            if terrain[y][x] == "w":
                continue
            n = fbm(x, y, 7)
            cliff = (x - 36) * 0.45 + 2.0 * (n - 0.5) - max(0, y - 30) * 0.25
            if cliff > 1.2 and x < 44:
                terrain[y][x] = "R"
                elevation[y][x] = round(min(4.8, 1.6 + cliff * 0.9), 2)
            elif cliff > 0.4 and x < 44:
                terrain[y][x] = "s"
                elevation[y][x] = round(max(elevation[y][x], 0.9 + cliff * 0.5), 2)
            elif terrain[y][x] == "g" and y < 12 and fbm(x, y, 31) > 0.5:
                terrain[y][x] = "f"
    railway(terrain, elevation, 0)
    town_core(terrain, D4_PLAZA, 7.0, 17)
    flatten(elevation, D4_PLAZA, 6, 11)
    road = make_road(terrain, elevation)
    # The quay runs along the shore below the plaza; piers reach into the sea.
    road([(19, 20), (15, 20)])
    for y in (12, 20, 28):
        x = 20
        while x > 0 and terrain[y][x - 1] != "w":
            x -= 1
        road([(x + 2, y), (max(0, x - 5), y)])
    road([(24, 20), (34, 20), (43, 20)])       # up the hill to the station
    road([(21, 23), (22, 34), (26, 46)])       # south along the slope
    road([(24, 18), (27, 9), (30, 3)])         # cliff path to the north
    return pack("d4", terrain, elevation, D4_PLAZA)


def pack(map_id: str, terrain, elevation, plaza) -> dict:
    return {
        "id": map_id,
        "width": W,
        "height": H,
        "legend": LEGEND,
        "plaza": {"x0": plaza[0], "y0": plaza[1], "x1": plaza[2], "y1": plaza[3]},
        "terrain": ["".join(row) for row in terrain],
        "elevation": elevation,
    }


def main() -> None:
    for data in (build_d11(), build_d4()):
        out = ROOT / f"src/content/maps/{data['id']}.json"
        out.write_text(json.dumps(data, separators=(",", ":")) + "\n", encoding="utf8")
        print(data["id"])
        print("\n".join(f"{i:2} {r}" for i, r in enumerate(data["terrain"])))


if __name__ == "__main__":
    main()
