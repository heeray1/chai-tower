"""Chai Tower item art: Z-Image-Turbo (local) glossy 3D icons -> white background cut out -> cropped sprites in ../assets/.
Run:  $VIDEO_MAKER/.tools/img-venv/bin/python art/gen.py [keys...]   (from chai-tower/; VIDEO_MAKER defaults to ../video-maker)
Skips raw images that already exist; delete art/raw/<key>.png to redo one.
"""
import os
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).parent
VM = Path(os.environ.get("VIDEO_MAKER", Path(__file__).resolve().parents[2] / "video-maker"))
GEN = VM / ".tools/img-venv/bin/mflux-generate-z-image-turbo"
MODEL = VM / ".tools/models/z-image-turbo-q8"
RAW = HERE / "raw"
OUT = HERE.parent / "assets"

STYLE = ("single cute glossy 3D rendered game item, Microsoft Fluent 3D emoji style, soft studio lighting, smooth clay-like "
         "surfaces, vibrant warm colours, straight front side view, perfectly upright, centered, fills the frame, "
         "plain pure white background, no text, no letters, no logo, no shadow on background")
ITEMS = {
    "kulhad": "a terracotta clay kulhad cup full of milky chai, wider at the top and narrower at the bottom, orange-brown clay",
    "golden": "a shiny solid gold kulhad cup, wider at the top, gleaming gold with a few sparkles",
    "glass": "a small straight cutting chai glass full of milky brown tea with a little froth on top, tall and narrow",
    "biscuit": "a long flat rectangular packet of glucose biscuits lying flat, yellow wrapper with a red stripe, wide and thin",
    "samosa": "a golden crispy fried samosa standing upright, triangular pyramid shape, flaky pastry",
    "tumbler": "a plain shiny brass Indian tumbler drinking cup, warm golden-brown brass metal, straight sides slightly narrower at the bottom, no face, no eyes, not a character",
    "rusk": "a long golden brown toasted rusk biscuit lying flat, wide and thin, crunchy texture",
    "bun": "a bun maska, a soft round golden bread bun cut in half with a thick layer of yellow butter in the middle, wide",
    "kettle": "a big chunky red enamel tea kettle with a curved spout, a black lid knob and a black top handle, heavy",
}
GREEN: set[str] = set()   # shiny steel is near-white: draw these on green and key the green out
SIZE = {"biscuit": (1024, 512), "rusk": (1024, 512), "bun": (896, 640)}   # wide items get a wide canvas
STALL = ("front view of the wooden counter of an Indian roadside chai stall, a big brass tea pot on a small stove with "
         "steam, glass jars of biscuits, a small steel tray of kulhads, warm evening light, cosy, cute 3D animated movie "
         "style, no people, no text, no letters, wide composition")


def gen(key: str, prompt: str, w: int, h: int, seed: str = "21") -> Path:
    dst = RAW / f"{key}.png"
    if not dst.exists():
        subprocess.run([str(GEN), "--model", str(MODEL), "--steps", "9", "--width", str(w), "--height", str(h),
                        "--seed", seed, "--prompt", prompt, "--output", str(dst)], check=True, capture_output=True)
        print("gen", key, flush=True)
    return dst


def cutout(src: Path, dst: Path, max_side: int = 320, green: bool = False, holes: bool = False) -> None:
    im = Image.open(src).convert("RGB")
    key = (255, 0, 255)
    filled = im.copy()
    w, h = filled.size
    seeds = [(x, y) for x in range(0, w, 16) for y in (0, h - 1)] + [(x, y) for y in range(0, h, 16) for x in (0, w - 1)]
    for xy in seeds:
        px = filled.getpixel(xy)
        if px == key:
            continue
        if green and px[1] > 120 and px[1] > px[0] + 50 and px[1] > px[2] + 50:
            ImageDraw.floodfill(filled, xy, key, thresh=70)
        elif not green and min(px) > 225:
            ImageDraw.floodfill(filled, xy, key, thresh=28)
    f = np.asarray(filled)
    bg = (f[:, :, 0] == 255) & (f[:, :, 1] == 0) & (f[:, :, 2] == 255)
    # soft floor shadows: light, grey (unsaturated) pixels that touch the background -> grow the background into them
    rgb = np.asarray(im).astype(int)
    if green:   # green spill / green-tinted shadow under the item
        shadowish = (rgb[:, :, 1] > rgb[:, :, 0] + 25) & (rgb[:, :, 1] > rgb[:, :, 2] + 25)
    else:
        shadowish = (rgb.min(2) > 200) & (rgb.max(2) - rgb.min(2) < 18)
    if not green:
        shadowish[: int(h * .62)] = False      # floor shadows only sit under the item; keeps shiny steel intact
    for _ in range(500):
        grown = bg.copy()
        grown[1:] |= bg[:-1]; grown[:-1] |= bg[1:]; grown[:, 1:] |= bg[:, :-1]; grown[:, :-1] |= bg[:, 1:]
        new = grown & shadowish & ~bg
        if not new.any():
            break
        bg |= new
    if holes:   # enclosed background, e.g. the gap inside a kettle handle
        from PIL import ImageDraw as _D
        white = (rgb.min(2) > 232) & ~bg
        lab = Image.fromarray((white * 255).astype(np.uint8), "L")
        arr = np.asarray(lab).copy()
        for yy in range(0, h, 6):
            for xx in range(0, w, 6):
                if arr[yy, xx] == 255:
                    tmp = Image.fromarray(arr, "L"); _D.floodfill(tmp, (xx, yy), 128); t = np.asarray(tmp)
                    region = t == 128
                    if region.sum() > h * w * .004:
                        bg |= region
                    arr = np.where(region, 0, arr).astype(np.uint8)
    # leftover shadow line under the item: per column, peel light & greyish pixels upward from the bottom edge
    if not green:
        light = (rgb.min(2) > 175) & (rgb.max(2) - rgb.min(2) < 45)
        start = int(h * .55)
        for x in range(w):
            col = ~bg[:, x]
            ys = np.nonzero(col[start:])[0]
            if not len(ys):
                continue
            y = start + ys[-1]
            while y >= start and col[y] and light[y, x]:
                bg[y, x] = True
                y -= 1
    alpha = Image.fromarray(np.where(bg, 0, 255).astype(np.uint8), "L")
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.0))
    rgba = im.copy()
    rgba.putalpha(alpha)
    rgba = rgba.crop(alpha.point(lambda a: 255 if a > 40 else 0).getbbox())   # tight crop: sprite = item bounds
    rgba.thumbnail((max_side, max_side), Image.LANCZOS)
    rgba.save(dst, optimize=True)
    print("cut", dst.name, rgba.size, flush=True)


if __name__ == "__main__":
    RAW.mkdir(exist_ok=True)
    OUT.mkdir(exist_ok=True)
    want = set(sys.argv[1:])
    for key, desc in ITEMS.items():
        if want and key not in want:
            continue
        w, h = SIZE.get(key, (768, 768))
        style = STYLE.replace("plain pure white background", "plain solid bright green chroma key background") if key in GREEN else STYLE
        cutout(gen(key, f"{desc}. {style}", w, h), OUT / f"{key}.png", green=key in GREEN, holes=key == "kettle")
    if not want or "stall" in want:
        src = gen("stall", STALL, 1344, 768, seed="7")
        im = Image.open(src).convert("RGB")
        im.thumbnail((1200, 1200), Image.LANCZOS)
        im.save(OUT / "stall.jpg", quality=82, optimize=True)
        print("stall", im.size)
