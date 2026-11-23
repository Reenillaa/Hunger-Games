"""
Downloads the curated CC0 texture set (tools/art/textures.json) into assets/src/textures/<key>/
and appends any new entry to assets/LICENSES.md. Idempotent. Standard library only.

  python3 tools/art/fetch_textures.py
"""

from __future__ import annotations

import io
import json
import pathlib
import urllib.request
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
CONFIG = json.loads((ROOT / "tools/art/textures.json").read_text(encoding="utf8"))
OUT = ROOT / "assets/src/textures"
LICENSES = ROOT / "assets/LICENSES.md"
WANTED = ("_Color.", "_NormalGL.", "_Roughness.", "_AmbientOcclusion.", "_Displacement.")


def fetch(asset_id: str, dest: pathlib.Path) -> None:
    url = f"https://ambientcg.com/get?file={asset_id}_{CONFIG['resolution']}.zip"
    req = urllib.request.Request(url, headers={"User-Agent": "diezmo-asset-fetcher"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = resp.read()
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        for name in zf.namelist():
            if any(tag in name for tag in WANTED) and name.lower().endswith((".jpg", ".png")):
                kind = next(tag.strip("_.") for tag in WANTED if tag in name)
                (dest / f"{kind}.jpg").write_bytes(zf.read(name))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    lines = LICENSES.read_text(encoding="utf8") if LICENSES.exists() else ""
    for key, asset_id in CONFIG["materials"].items():
        dest = OUT / key
        if (dest / "Color.jpg").exists():
            print(f"skip {key} ({asset_id})")
            continue
        dest.mkdir(parents=True, exist_ok=True)
        fetch(asset_id, dest)
        print(f"got  {key} ({asset_id}): {sorted(p.name for p in dest.iterdir())}")
        row = f"| texture `{key}` | {asset_id} | ambientCG | https://ambientcg.com/view?id={asset_id} | CC0 1.0 | Colour-graded towards the ART_BIBLE palette at render time |"
        if asset_id not in lines:
            lines += row + "\n"
    LICENSES.write_text(lines, encoding="utf8")


if __name__ == "__main__":
    main()
