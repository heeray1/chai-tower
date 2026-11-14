"""CrazyGames cover images (1920x1080, 800x1200, 800x800) from the game art: title + a stacked chai tower on the stall.
Run (from chai-tower/):  ../video-maker/.tools/img-venv/bin/python art/covers.py   -> dist/covers/
Covers may only carry the game title (no "Play", no icons, no borders): docs.crazygames.com/requirements/game-covers/
"""
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

from gen import RAW, cutout

HERE = Path(__file__).parent
OUT = HERE.parent / "dist" / "covers"
SPR = OUT / "sprites"
FONT = "/System/Library/Fonts/SFNSRounded.ttf"
# bottom -> top: (item, width as a share of the tower's base width, sideways shift, tilt in degrees)
TOWER = [("biscuit", 1.00, 0, 0), ("kulhad", .50, -.04, 2), ("samosa", .66, .04, -3), ("glass", .36, -.02, 3),
         ("bun", .60, .02, -4), ("kettle", .62, .10, 10)]


def sprites():
    SPR.mkdir(parents=True, exist_ok=True)
    out = {}
    for k in {t[0] for t in TOWER}:
        dst = SPR / f"{k}.png"
        if not dst.exists():
            cutout(RAW / f"{k}.png", dst, max_side=900, holes=k == "kettle")
        out[k] = clean(Image.open(dst).convert("RGBA"))
    return out


def clean(im):
    """Remove the grey floor-shadow sliver the cutout leaves under an item at full size (bottom 30% only)."""
    px = im.load(); w, h = im.size
    for y in range(int(h * .7), h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and min(r, g, b) > 120 and max(r, g, b) - min(r, g, b) < 34:
                px[x, y] = (r, g, b, 0)
    return im.crop(im.getchannel("A").point(lambda a: 255 if a > 40 else 0).getbbox())


def background(w, h):
    st = Image.open(RAW / "stall.png").convert("RGB")
    s = max(w / st.width, h / st.height)
    st = st.resize((round(st.width * s), round(st.height * s)), Image.LANCZOS)
    st = st.crop(((st.width - w) // 2, st.height - h, (st.width - w) // 2 + w, st.height))   # keep the counter
    st = st.filter(ImageFilter.GaussianBlur(max(w, h) / 450))                                # soft, so the tower pops
    dark = Image.new("RGB", (w, h), (40, 18, 8))
    mask = Image.radial_gradient("L").resize((w, h)).point(lambda v: int(v * .75))          # vignette
    return Image.composite(dark, st, mask)


def tower(spr, base_w):
    """Stack the items into one RGBA image, bottom item centred; returns the image."""
    parts, y = [], 0
    for k, share, dx, tilt in TOWER:
        im = spr[k]; im = im.resize((round(base_w * share), round(base_w * share * im.height / im.width)), Image.LANCZOS)
        im = im.rotate(tilt, resample=Image.BICUBIC, expand=True)
        parts.append((im, round(dx * base_w), y)); y += im.height * .80      # small overlap: items sit on each other
    W, H = round(base_w * 1.6), round(y + base_w * .3)
    canvas = Image.new("RGBA", (W, H))
    for im, dx, yy in parts:
        canvas.alpha_composite(im, (W // 2 - im.width // 2 + dx, round(H - yy - im.height)))
    tray = Image.new("RGBA", (W, H)); d = ImageDraw.Draw(tray)
    tw, th = base_w * 1.15, base_w * .07
    d.rounded_rectangle((W / 2 - tw / 2, H - th * .6, W / 2 + tw / 2, H + th * .4), radius=th / 2, fill=(196, 202, 210, 255), outline=(95, 102, 112, 255), width=max(2, int(th / 6)))
    tray.alpha_composite(canvas, (0, -round(th * .55)))
    return tray


def fit(im, max_w, max_h):
    k = min(1, max_w / im.width, max_h / im.height)
    return im if k == 1 else im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)


def shadowed(layer, blur, offset, alpha=150):
    sh = Image.new("RGBA", layer.size, (20, 8, 2, 0)); sh.putalpha(layer.getchannel("A").point(lambda a: a * alpha // 255))
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    out = Image.new("RGBA", (layer.width, layer.height)); out.alpha_composite(sh, offset); out.alpha_composite(layer)
    return out


def title(size, lines=1):
    f = ImageFont.truetype(FONT, size)
    try: f.set_variation_by_name("Heavy")
    except Exception:
        try: f.set_variation_by_name("Black")
        except Exception: pass
    words = [("Chai", (255, 244, 224)), ("Tower", (255, 207, 63))]
    gap, stroke = size * .28, max(3, size // 11)
    boxes = [f.getbbox(t, stroke_width=stroke) for t, _ in words]
    if lines == 1:
        W = round(sum(b[2] - b[0] for b in boxes) + gap + stroke * 2); H = round(max(b[3] for b in boxes) + stroke * 2)
        pos = [(stroke - boxes[0][0], stroke), (round(boxes[0][2] - boxes[0][0] + gap) + stroke - boxes[1][0], stroke)]
    else:
        W = round(max(b[2] - b[0] for b in boxes) + stroke * 2); lh = size * 1.02; H = round(lh + boxes[1][3] + stroke * 2)
        pos = [((W - (b[2] - b[0])) // 2 - b[0], stroke + round(i * lh)) for i, b in enumerate(boxes)]
    im = Image.new("RGBA", (W, H)); d = ImageDraw.Draw(im)
    for (t, col), p in zip(words, pos):
        d.text(p, t, font=f, fill=col, stroke_width=stroke, stroke_fill=(58, 29, 18))
    return shadowed(im, size / 14, (0, size // 14), 170)


def steam(img, x, y, scale):
    layer = Image.new("RGBA", img.size); d = ImageDraw.Draw(layer); r = random.Random(4)
    for i in range(9):
        cx, cy, rr = x + r.uniform(-.25, .25) * scale, y - i * scale * .16, scale * (.08 + i * .012)
        d.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), fill=(255, 255, 255, 46))
    img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(scale * .05)))


def cover(w, h, spr, layout):
    S = 2; W, H = w * S, h * S                                    # draw at 2x, then downscale: crisp edges
    img = background(W, H).convert("RGBA")
    if layout == "landscape":
        t = shadowed(fit(tower(spr, round(H * .5)), W * .45, H * .95), H * .02, (0, round(H * .015)))
        tx, ty = round(W * .70 - t.width / 2), round(H * .985 - t.height)
        ti = title(round(H * .23), lines=2); px, py = round(W * .31 - ti.width / 2), round(H * .5 - ti.height / 2)
    elif layout == "portrait":
        ti = fit(title(round(W * .2), lines=2), W * .9, H * .3); px, py = round(W / 2 - ti.width / 2), round(H * .03)
        t = shadowed(fit(tower(spr, round(W * .62)), W * .9, H * .985 - (py + ti.height * .92)), W * .02, (0, round(W * .015)))
        tx, ty = round(W / 2 - t.width / 2), round(H * .985 - t.height)
    else:
        ti = fit(title(round(W * .15), lines=1), W * .9, H * .2); px, py = round(W / 2 - ti.width / 2), round(H * .035)
        t = shadowed(fit(tower(spr, round(W * .44)), W * .9, H * .99 - (py + ti.height * .95)), W * .02, (0, round(W * .015)))
        tx, ty = round(W / 2 - t.width / 2), round(H * .99 - t.height)
    img.alpha_composite(t, (tx, ty))
    img.alpha_composite(ti, (px, py))
    return img.convert("RGB").resize((w, h), Image.LANCZOS)


if __name__ == "__main__":
    spr = sprites()
    for name, (w, h), layout in [("cover-1920x1080", (1920, 1080), "landscape"), ("cover-800x1200", (800, 1200), "portrait"),
                                  ("cover-800x800", (800, 800), "square")]:
        cover(w, h, spr, layout).save(OUT / f"{name}.png", optimize=True)
        print("saved", OUT / f"{name}.png")
