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


D7_PLAZA = (21, 22, 26, 27)
D2_PLAZA = (22, 26, 27, 31)


def build_d7() -> dict:
    """The timber district: a clearing in a dense forest, a log river, sawmills on its banks."""
    terrain, elevation = blank("f")
    px, py = (D7_PLAZA[0] + D7_PLAZA[2]) / 2, (D7_PLAZA[1] + D7_PLAZA[3]) / 2
    for y in range(H):
        for x in range(W):
            n = fbm(x, y, 71)
            # Clearings: the town's and a few logged patches with stumps (grass).
            d = math.hypot((x - px) * 0.9, y - py)
            if d < 10 + 3 * n or (n > 0.68 and d < 22):
                terrain[y][x] = "g"
            # Hills all around the valley.
            ridge = (abs(x - 24) - 15) * 0.35 + (n - 0.5) * 2
            if ridge > 1.4 and y < 30:
                terrain[y][x] = "R" if ridge > 2.4 else "s"
                elevation[y][x] = round(min(3.2, 0.6 + ridge * 0.6), 2)
            elif terrain[y][x] in ("f", "g"):
                elevation[y][x] = round(0.6 * max(0.0, fbm(x * 0.6, y * 0.6, 73) - 0.3) + max(0.0, (abs(x - 24) - 10) * 0.05), 2)
    # The log river winds from the north-east to the south-west past the town.
    for y in range(H):
        cx = 38 - y * 0.4 + 2.0 * math.sin(y / 4.0)
        for x in range(W):
            if abs(x - cx) <= 1.0 and terrain[y][x] != "R":
                terrain[y][x] = "w"
                elevation[y][x] = -0.25
    railway(terrain, elevation, 4)
    town_core(terrain, D7_PLAZA, 6.5, 19)
    flatten(elevation, D7_PLAZA)
    road = make_road(terrain, elevation)
    road([(26, 24), (34, 24), (43, 24)])       # station
    road([(21, 24), (12, 20), (4, 12)])        # western logging road
    road([(23, 27), (22, 38), (18, 46)])       # south through the woods
    road([(24, 22), (27, 12), (30, 4)])        # north, across the river
    return pack("d7", terrain, elevation, D7_PLAZA)


def build_d2() -> dict:
    """The quarry district: a stone town on terraces in a high valley, quarries cut in the cliffs."""
    terrain, elevation = blank("g")
    for y in range(H):
        for x in range(W):
            n = fbm(x, y, 81)
            # Mountains wrap the valley on three sides; the town sits on a raised shelf.
            wall = max((14 - x) * 0.4, (x - 36) * 0.4, (12 - y) * 0.45) + (n - 0.5) * 1.6
            if wall > 1.2:
                terrain[y][x] = "R"
                elevation[y][x] = round(min(5.0, 1.8 + wall * 0.9), 2)
            elif wall > 0.2:
                terrain[y][x] = "s"
                elevation[y][x] = round(0.8 + wall * 0.8, 2)
            else:
                # Terraces: the valley floor climbs in steps towards the north.
                step = math.floor(max(0.0, (34 - y)) / 6) * 0.25
                elevation[y][x] = round(step + 0.2 * n, 2)
            if terrain[y][x] == "g" and fbm(x * 1.4, y * 1.4, 83) > 0.7:
                terrain[y][x] = "f"
    # A mountain stream down the east side.
    for y in range(12, H):
        cx = 33 + 1.5 * math.sin(y / 3.5)
        for x in range(W):
            if abs(x - cx) <= 0.7 and terrain[y][x] in ("g", "f", "s"):
                terrain[y][x] = "w"
                elevation[y][x] = -0.25
    railway(terrain, elevation, 10)
    town_core(terrain, D2_PLAZA, 7.0, 23)
    flatten(elevation, D2_PLAZA, 6, 10)
    road = make_road(terrain, elevation)
    road([(27, 28), (36, 28), (43, 28)])       # station
    road([(22, 27), (16, 20), (15, 12)])       # up to the western quarries
    road([(27, 25), (28, 16), (26, 11)])       # north to the high quarry
    road([(24, 31), (23, 40), (24, 46)])       # down the valley
    return pack("d2", terrain, elevation, D2_PLAZA)


def build_generic(map_id: str, plaza, seed: int, *, hills: float = 1.0, river=None, lake=None,
                  seams=(), crops: str = "", gardens: bool = False, paddocks: bool = False,
                  woods: float = 0.0, yard: bool = False, roads=()) -> dict:
    """A district plan from ingredients: hills at the back, a river, a lake, coal seams, crops,
    formal gardens, hedged paddocks, woods, a rail yard and its own street layout."""
    terrain, elevation = blank("g")
    for y in range(H):
        for x in range(W):
            n = fbm(x, y, seed)
            back = (3.5 + 2.0 * n - y) * hills
            if back > 0.6:
                terrain[y][x] = "R" if back > 1.8 else "s"
                elevation[y][x] = round(min(3.5, 0.5 + back * 0.6), 2)
            elif woods and fbm(x * 1.2, y * 1.2, seed + 3) > 1 - woods:
                terrain[y][x] = "f"
            else:
                elevation[y][x] = round(0.4 * max(0.0, fbm(x * 0.7, y * 0.7, seed + 5) - 0.4), 2)
    if crops:
        for y in range(H):
            for x in range(W):
                if terrain[y][x] == "g" and (crops == "all" or fbm(x * 0.8, y * 0.8, seed + 7) > 0.45):
                    terrain[y][x] = "c"
    if gardens:
        # Formal gardens: clipped hedge rows (f) in neat squares.
        for y in range(6, H - 4):
            for x in range(4, 42):
                if terrain[y][x] in ("g", "c") and (x % 6 in (0, 1)) and (y % 6 in (0, 1, 2, 3)) and fbm(x, y, seed + 9) > 0.4:
                    terrain[y][x] = "f"
    if paddocks:
        # Hedged paddocks: lines of hedge every 7 cells with gaps for gates.
        for y in range(5, H):
            for x in range(0, 43):
                if terrain[y][x] == "g" and ((x % 7 == 0 and y % 5 != 2) or (y % 7 == 0 and x % 5 != 2)):
                    terrain[y][x] = "f"
    for (cx, cy) in seams:
        for dy in range(-1, 2):
            for dx in range(-1, 2):
                if terrain[cy + dy][cx + dx] in ("g", "s", "c", "f"):
                    terrain[cy + dy][cx + dx] = "v"
    if river:
        for y in range(H):
            rx = river(y)
            for x in range(W):
                if abs(x - rx) <= 0.9 and terrain[y][x] != "R":
                    terrain[y][x] = "w"
                    elevation[y][x] = -0.25
    if lake:
        lx, ly, lr = lake
        for y in range(H):
            for x in range(W):
                if math.hypot(x - lx, (y - ly) * 1.2) < lr + (fbm(x, y, seed + 11) - 0.5) * 2:
                    terrain[y][x] = "w"
                    elevation[y][x] = -0.25
    railway(terrain, elevation, 6)
    if yard:
        # A marshalling yard: extra tracks beside the main line and a branch to the town.
        for y in range(10, H - 2):
            for x in (38, 40, 42):
                if terrain[y][x] not in ("w", "R"):
                    terrain[y][x] = "t"
                    elevation[y][x] = 0.0
        for x in range(30, 46):
            if terrain[36][x] not in ("w",):
                terrain[36][x] = "t"
    town_core(terrain, plaza, 6.5, seed + 13)
    flatten(elevation, plaza)
    road = make_road(terrain, elevation)
    for r in roads:
        road(r)
    return pack(map_id, terrain, elevation, plaza)


GENERIC = {
    "d1": dict(plaza=(21, 14, 26, 19), seed=101, hills=0.8, gardens=True, lake=(16, 36, 4.5),
               roads=[[(26, 16), (36, 16), (43, 16)], [(23, 19), (22, 30), (24, 46)], [(21, 16), (10, 16), (4, 22)]]),
    "d3": dict(plaza=(24, 28, 29, 33), seed=103, hills=0.7, woods=0.12, river=lambda y: 8 + 0.15 * y,
               roads=[[(29, 30), (43, 30)], [(26, 28), (26, 8)], [(24, 31), (4, 31)], [(18, 8), (18, 46)], [(34, 8), (34, 46)], [(4, 20), (43, 20)], [(4, 40), (43, 40)]]),
    "d5": dict(plaza=(12, 22, 17, 27), seed=105, hills=1.3, seams=[(10, 9), (22, 8), (32, 9)], lake=(32, 24, 6),
               roads=[[(17, 24), (43, 34)], [(14, 22), (12, 12), (10, 9)], [(15, 22), (22, 12)], [(14, 27), (14, 46)]]),
    "d6": dict(plaza=(22, 20, 27, 25), seed=107, hills=0.9, woods=0.1, yard=True,
               roads=[[(27, 22), (43, 22)], [(24, 25), (24, 46)], [(22, 22), (6, 22), (4, 12)], [(25, 20), (25, 8)]]),
    "d8": dict(plaza=(18, 24, 23, 29), seed=108, hills=1.0, river=lambda y: 30 + 4 * math.sin(y / 7),
               roads=[[(23, 26), (43, 26)], [(20, 24), (20, 8)], [(18, 26), (4, 26)], [(20, 29), (20, 46)], [(8, 14), (36, 14)], [(8, 38), (36, 38)]]),
    "d9": dict(plaza=(30, 10, 35, 15), seed=109, hills=0.4, crops="all", river=lambda y: 12 + 3 * math.sin(y / 6),
               roads=[[(35, 12), (43, 12)], [(32, 15), (28, 30), (24, 46)], [(30, 12), (4, 20)], [(30, 30), (6, 40)]]),
    "d10": dict(plaza=(14, 14, 19, 19), seed=110, hills=0.6, paddocks=True, river=lambda y: 36 - 0.2 * y,
                roads=[[(19, 16), (43, 16)], [(16, 19), (18, 46)], [(14, 16), (4, 24)], [(18, 30), (40, 34)]]),
}


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
    generic = [build_generic(k, **v) for k, v in GENERIC.items()]
    for data in (build_d11(), build_d4(), build_d7(), build_d2(), *generic):
        out = ROOT / f"src/content/maps/{data['id']}.json"
        out.write_text(json.dumps(data, separators=(",", ":")) + "\n", encoding="utf8")
        print(data["id"])
        print("\n".join(f"{i:2} {r}" for i, r in enumerate(data["terrain"])))


if __name__ == "__main__":
    main()
