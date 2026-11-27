"""
Build-menu thumbnails (public/assets/ui/thumbs/<kind>.webp) from the base sprite of every
building, and of each district's own version (`<kind>__dN`, without the upgrade levels).

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
made: list[str] = []
for name, asset in assets.items():
    if asset["kind"] != "building" or name.startswith("site") or name.endswith(("_l2", "_l3")):
        continue
    src = SPRITES / f"{name}.webp"
    if not src.exists():
        continue
    img = Image.open(src).convert("RGBA")
    img = img.crop(img.getbbox())
    img.thumbnail((220, 170), Image.LANCZOS)
    img.save(OUT / f"{name}.webp", "WEBP", quality=82, method=6)
    made.append(name)
    print("thumb", name)

# The game picks a district's own thumbnail only when it exists (no failed image requests).
INDEX = ROOT / "src/content/thumbIndex.json"
INDEX.write_text(json.dumps(sorted(n for n in made if "__" in n), indent=2) + "\n", encoding="utf8")
