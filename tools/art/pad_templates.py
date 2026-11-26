"""Grows every district template by PAD cells on each side (DECISIONS I-56).

The new ring continues what touches the old edge (mountains, water, forest, the railway and the
roads leading out), while bare earth, fields and plaza turn into meadow: room to expand.
Run once after `generate_district_templates.py`:  python3 tools/art/pad_templates.py
"""
import json
import pathlib
import sys

PAD = 8
MAPS = pathlib.Path(__file__).resolve().parents[2] / 'src' / 'content' / 'maps'
TO_MEADOW = {'d': 'g', 'p': 'g', 'c': 'g', 'v': 'g', 'b': 'w'}


def pad(t: dict) -> dict:
    w, h = t['width'], t['height']
    if w != 48 or h != 48:
        raise SystemExit(f"{t['id']}: already {w}x{h}, not padding twice")
    W, H = w + 2 * PAD, h + 2 * PAD
    rows = []
    for y in range(H):
        row = []
        for x in range(W):
            ox, oy = min(max(x - PAD, 0), w - 1), min(max(y - PAD, 0), h - 1)
            code = t['terrain'][oy][ox]
            inside = PAD <= x < PAD + w and PAD <= y < PAD + h
            row.append(code if inside else TO_MEADOW.get(code, code))
        rows.append(''.join(row))
    elev = [[t['elevation'][min(max(y - PAD, 0), h - 1)][min(max(x - PAD, 0), w - 1)]
             for x in range(W)] for y in range(H)]
    p = t['plaza']
    return {**t, 'width': W, 'height': H, 'terrain': rows, 'elevation': elev,
            'plaza': {k: v + PAD for k, v in p.items()}}


def main() -> None:
    for f in sorted(MAPS.glob('d*.json')):
        t = json.loads(f.read_text())
        f.write_text(json.dumps(pad(t), separators=(',', ':')) + '\n')
        print(f.name, 'ok')


if __name__ == '__main__':
    sys.exit(main())
