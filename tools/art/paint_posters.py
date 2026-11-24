"""
Propaganda posters of the Capitol (original designs): the twelve-ray emblem and regime slogans,
printed on cheap paper that the district's weather has already started to eat.

  python3 tools/art/paint_posters.py   ->  assets/build/poster_a.png, poster_b.png
"""

from __future__ import annotations

import math
import pathlib

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "assets/build"
FONT = "/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf"
W, H = 600, 840


def emblem(d: ImageDraw.ImageDraw, cx: float, cy: float, r: float, gold, dark) -> None:
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=gold, width=max(3, int(r * 0.06)))
    for k in range(12):
        a = k * math.pi / 6 - math.pi / 2
        w = 0.13
        p1 = (cx + math.cos(a - w) * r * 0.86, cy + math.sin(a - w) * r * 0.86)
        p2 = (cx + math.cos(a + w) * r * 0.86, cy + math.sin(a + w) * r * 0.86)
        tip = (cx + math.cos(a) * r * 0.38, cy + math.sin(a) * r * 0.38)
        d.polygon([p1, tip, p2], fill=gold)
    s = r / 32
    gem = [(cx, cy - 10 * s), (cx + 7 * s, cy - 4 * s), (cx + 4.5 * s, cy + 7 * s), (cx - 4.5 * s, cy + 7 * s), (cx - 7 * s, cy - 4 * s)]
    d.polygon(gem, fill=gold, outline=dark)


def age(img: Image.Image, seed: int) -> Image.Image:
    rng = np.random.default_rng(seed)
    arr = np.asarray(img.convert("RGB"), np.float32)
    noise = rng.normal(0, 9, arr.shape[:2])[..., None]
    stain = np.asarray(Image.fromarray((rng.random((12, 9)) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC), np.float32) / 255
    arr = arr * (0.82 + 0.25 * stain[..., None]) + noise
    out = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
    # A torn bottom corner.
    alpha = Image.new("L", (W, H), 255)
    ad = ImageDraw.Draw(alpha)
    ad.polygon([(W, H), (W - 130, H), (W - 70, H - 40), (W - 95, H - 90), (W, H - 160)], fill=0)
    out.putalpha(alpha)
    return out


def poster(name: str, bg, ink, gold, lines: list[str], tag: str, seed: int) -> None:
    img = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(img)
    d.rectangle([18, 18, W - 18, H - 18], outline=gold, width=6)
    # Sunburst behind the emblem.
    for k in range(36):
        a = k * math.pi / 18
        d.polygon([(W / 2, 330), (W / 2 + math.cos(a) * 700, 330 + math.sin(a) * 700),
                   (W / 2 + math.cos(a + 0.06) * 700, 330 + math.sin(a + 0.06) * 700)],
                  fill=tuple(int(c * 0.85) for c in bg))
    emblem(d, W / 2, 300, 170, gold, ink)
    y = 520
    for i, line in enumerate(lines):
        font = ImageFont.truetype(FONT, 74 if i == 0 else 52)
        tw = d.textlength(line, font=font)
        d.text(((W - tw) / 2, y), line, font=font, fill=gold if i == 0 else ink)
        y += 86 if i == 0 else 64
    small = ImageFont.truetype(FONT, 26)
    tw = d.textlength(tag, font=small)
    d.text(((W - tw) / 2, H - 70), tag, font=small, fill=gold)
    age(img, seed).save(OUT / f"{name}.png")
    print("wrote", OUT / f"{name}.png")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    poster("poster_a", (122, 22, 26), (246, 230, 196), (226, 190, 96), ["ORDEN", "GRATITUD", "CONCORDIA"], "EL CAPITOLIO VELA POR TI", 1)
    poster("poster_b", (24, 30, 46), (236, 226, 204), (214, 172, 69), ["TU CARBÓN", "ILUMINA", "LA NACIÓN"], "TRABAJA · ENTREGA · AGRADECE", 2)
