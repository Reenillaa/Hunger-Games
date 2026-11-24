"""
Converts the rendered sprite layers and character sheets to WebP (with alpha) for the game.
Normal maps (_n) move to assets/normals/: not loaded at runtime (future high-end preset).

  python3 tools/art/to_webp.py      (run after render_district_assets.py / render_characters.py)
"""

from __future__ import annotations

import pathlib

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
FOLDERS = [ROOT / "public/assets/district/sprites", ROOT / "public/assets/district/characters"]

before = after = 0
for folder in FOLDERS:
    for png in sorted(folder.glob("*.png")):
        if png.stem.endswith("_n"):
            # Kept for a future lighting preset, outside the published folder.
            keep = ROOT / "assets/normals" / folder.name
            keep.mkdir(parents=True, exist_ok=True)
            png.replace(keep / png.name)
            continue
        webp = png.with_suffix(".webp")
        img = Image.open(png)
        img.save(webp, "WEBP", quality=90, alpha_quality=92, method=6)
        before += png.stat().st_size
        after += webp.stat().st_size
        png.unlink()
print(f"PNG {before / 1e6:.1f} MB -> WebP {after / 1e6:.1f} MB")
