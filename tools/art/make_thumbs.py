"""
Build-menu thumbnails (public/assets/ui/thumbs/<kind>.webp) from the base sprite of every
building (regional variants excluded).

  python3 tools/art/make_thumbs.py
"""

from __future__ import annotations

import json
import pathlib

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
SPRITES = ROOT / "public/assets/district/sprites"
OUT = ROOT / "public/assets/ui/thumbs"
OUT.mkdir(parents=True, exist_ok=True)

assets = json.loads((SPRITES / "manifest.json").read_text())["assets"]
for name, asset in assets.items():
    if asset["kind"] != "building" or "__" in name or name.startswith("site") or name[-2:-1] == "_":
        continue
    src = SPRITES / f"{name}.webp"
    if not src.exists():
        continue
    img = Image.open(src).convert("RGBA")
    img = img.crop(img.getbbox())
    img.thumbnail((220, 170), Image.LANCZOS)
    img.save(OUT / f"{name}.webp", "WEBP", quality=82, method=6)
    print("thumb", name)
