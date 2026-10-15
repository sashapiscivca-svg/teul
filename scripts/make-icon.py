#!/usr/bin/env python3
"""The world's icon, as pixel art: a small town at night and a rift of warm light running down its sky
(the title's «Розлом»). One 36×36 master (an adaptive icon's 108 dp, 3 dp a pixel; what matters sits in the
middle 22×22 = the 66 dp safe zone), scaled by whole numbers, nearest neighbour, to every size the app needs:
Android launcher (adaptive foreground, legacy square and round), the splash screens, and the web icons.

Run: python3 scripts/make-icon.py [preview_dir]
"""
import math
import os
import sys

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, "app/android/app/src/main/res")
PUBLIC = os.path.join(ROOT, "app/public")

N = 36
BG = "#0e1030"  # the launcher's background colour: the night at the top of the sky

SKY = ["#0e1030", "#121437", "#16183f", "#1b1c47", "#22204e", "#2c2654", "#382d5a"]
HOUSE = "#1a1b38"
HOUSE_EDGE = "#2c2e5c"
ROOF = "#34335e"
LIT = "#f6c85a"
LIT_IN = "#ffe7a0"
CRACK_IN = ["#8cbfe8", "#a8d2f0", "#c6e2f4"]
LIP = "#fff3c4"
GLOW = "#f6b347"
GOLD = "#e8c060"
STREET = "#121328"


def hexc(c, a=255):
    c = c.lstrip("#")
    return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), a)


def master():
    img = Image.new("RGBA", (N, N), hexc(BG))
    px = img.load()

    def put(x, y, c, a=255):
        if 0 <= x < N and 0 <= y < N:
            if a == 255:
                px[x, y] = hexc(c)
            else:
                r, g, b, _ = px[x, y]
                cr, cg, cb, _ = hexc(c)
                k = a / 255
                px[x, y] = (round(r + (cr - r) * k), round(g + (cg - g) * k), round(b + (cb - b) * k), 255)

    def rect(x, y, w, h, c, a=255):
        for j in range(y, y + h):
            for i in range(x, x + w):
                put(i, j, c, a)

    # the sky in hard bands, with a dithered seam between them
    ground = 28
    band = ground / len(SKY)
    for y in range(N):
        i = min(len(SKY) - 1, int(y / band))
        for x in range(N):
            c = SKY[i]
            if i > 0 and y == int(i * band) and (x + y) % 2 == 0:
                c = SKY[i - 1]
            put(x, y, c)
    # stars
    for x, y, c in [(9, 7, "#c9cdf0"), (26, 9, "#ffe7b0"), (12, 13, "#8a90c0"), (28, 15, "#c9cdf0"), (7, 11, "#8a90c0"), (24, 6, "#8a90c0")]:
        put(x, y, c)
    put(26, 8, "#ffe7b0", 110)
    put(26, 10, "#ffe7b0", 110)
    put(25, 9, "#ffe7b0", 110)
    put(27, 9, "#ffe7b0", 110)

    # the rift: straight runs between kinks, widest in the middle, from high in the sky into the street
    path = {}
    pts = [(3, 21), (7, 19), (10, 21), (14, 22), (17, 19), (21, 20), (25, 21), (29, 20)]
    for (y0, x0), (y1, x1) in zip(pts, pts[1:]):
        for y in range(y0, y1 + 1):
            path[y] = round(x0 + (x1 - x0) * (y - y0) / (y1 - y0))
    top, bot = 3, 28

    def half(y):
        t = (y - top) / (bot - top)
        return 1.45 * max(0.0, math.sin(math.pi * min(1.0, t * 1.1))) ** 0.7
    # its glow on the night
    for y in range(top - 1, bot + 1):
        c = path.get(y, 20)
        w = half(y)
        if w < 0.6:
            continue
        for dx in range(-int(w) - 3, int(w) + 4):
            d = abs(dx) - w
            if 0.5 < d <= 2.6 and (d < 1.6 or (dx + y) % 2 == 0):
                put(c + dx, y, "#8a6aa0", int(110 * (1 - d / 2.6)))
    # the other light inside, and bright lips
    for y in range(top, bot + 1):
        c = path[y]
        w = half(y)
        if w < 0.6:
            put(c, y, LIP)
            continue
        a, b = round(c - w), round(c + w)
        for x in range(a, b + 1):
            k = (y - top) / (bot - top)
            put(x, y, CRACK_IN[0] if k < 0.35 else CRACK_IN[1] if k < 0.7 else CRACK_IN[2])
        put(a - 1, y, LIP)
        put(b + 1, y, LIP)
    # a small cloud lit inside the rift (it is day in there)
    put(path[12], 12, "#f4f8fc")

    # the town: the church on the left with its spire and cross, houses with lit windows
    def house(x, w, h, roof, lit=()):
        y = ground - h
        rect(x, y, w, h, HOUSE)
        rect(x, y, 1, h, HOUSE_EDGE)
        for i in range(roof):
            inset = round((roof - 1 - i) * (w / 2) / roof)
            rect(x + inset, y - roof + i, w - inset * 2, 1, ROOF)
        for (wx, wy) in lit:
            rect(x + wx, y + wy, 2, 2, LIT)
            put(x + wx, y + wy, LIT_IN)

    # church: nave, tower, spire, cross, a warm rose window
    rect(4, 21, 9, 8, HOUSE)
    rect(4, 21, 1, 8, HOUSE_EDGE)
    for i in range(3):
        rect(4 + i, 18 + i, 9 - i * 2, 1, ROOF)
    rect(8, 14, 3, 7, HOUSE)
    rect(8, 14, 1, 7, HOUSE_EDGE)
    for i in range(5):
        hw = (i + 1) // 2
        rect(9 - hw, 9 + i, 1 + hw * 2, 1, ROOF if i % 2 else HOUSE_EDGE)
    for (x, y) in [(9, 5), (9, 6), (9, 7), (9, 8), (8, 6), (10, 6)]:
        put(x, y, GOLD)
    put(9, 16, LIT)
    rect(7, 23, 3, 3, "#c47a22")
    put(8, 24, LIT_IN)
    rect(11, 26, 1, 3, "#3a2418")

    house(0, 4, 6, 2, [(1, 2)])
    house(13, 5, 8, 3, [(2, 2)])
    house(23, 5, 6, 3, [(2, 2)])
    house(28, 8, 9, 3, [(2, 2), (5, 5)])
    # chimney with a little smoke on the right house
    rect(33, 15, 1, 3, ROOF)
    put(34, 13, "#3c4068")
    put(34, 12, "#3c4068", 150)

    # the street, with the rift's light falling on it
    rect(0, ground, N, N - ground, STREET)
    rect(0, ground, N, 1, "#1e2040")
    for x in range(17, 24):
        put(x, ground, GLOW, 150 if abs(x - 20) <= 1 else 70)
    for x in range(18, 23):
        put(x, ground + 1, GLOW, 80 if abs(x - 20) <= 1 else 35)
    # lamps
    for lx in (2,):
        rect(lx, ground - 5, 1, 5, "#2d3160")
        put(lx, ground - 6, LIT_IN)
        put(lx - 1, ground - 6, GLOW, 90)
        put(lx + 1, ground - 6, GLOW, 90)
    return img


def scaled(img, size):
    return img.resize((size, size), Image.NEAREST)


def crop_mid(img, n):
    """The square the small icons show: the middle across, a little high so the cross stays in."""
    o = (N - n) // 2
    return img.crop((o, o - 2, o + n, o - 2 + n))


def rounded(img, radius_frac=0.18):
    s = img.size[0]
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, s - 1, s - 1), radius=round(s * radius_frac), fill=255)
    out = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def circle(img):
    s = img.size[0]
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, s - 1, s - 1), fill=255)
    out = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}


def write_android(m):
    legacy = crop_mid(m, 24)  # the middle of the picture, for the old square/round icons (48 dp)
    for d, k in DENSITIES.items():
        folder = os.path.join(RES, f"mipmap-{d}")
        fg = round(108 * k)
        scaled(m, fg).save(os.path.join(folder, "ic_launcher_foreground.png"))
        s = round(48 * k)
        scaled(legacy, s).save(os.path.join(folder, "ic_launcher.png"))
        circle(scaled(legacy, s)).save(os.path.join(folder, "ic_launcher_round.png"))
    with open(os.path.join(RES, "values/ic_launcher_background.xml"), "w") as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">%s</color>\n</resources>\n' % BG.upper())
    # the splash: the night colour with the icon in the middle, a whole-number scale, a quarter of the short side
    for path, root, dirs, files in [(None, *t) for t in os.walk(RES)]:
        for name in files:
            if name != "splash.png":
                continue
            p = os.path.join(root, name)
            w, h = Image.open(p).size
            k = max(1, (min(w, h) // 3) // 24)
            icon = rounded(scaled(legacy, 24 * k))
            out = Image.new("RGBA", (w, h), hexc(BG))
            out.paste(icon, ((w - icon.size[0]) // 2, (h - icon.size[1]) // 2), icon)
            out.convert("RGB").save(p)


def write_web(m):
    os.makedirs(PUBLIC, exist_ok=True)
    legacy = crop_mid(m, 24)
    scaled(legacy, 192).save(os.path.join(PUBLIC, "icon-192.png"))
    scaled(legacy, 528).crop((8, 8, 520, 520)).save(os.path.join(PUBLIC, "icon-512.png"))
    scaled(legacy, 48).save(os.path.join(PUBLIC, "favicon.png"))
    scaled(legacy, 192).save(os.path.join(PUBLIC, "apple-touch-icon.png"))


def preview(m, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    legacy = crop_mid(m, 24)
    sheet = Image.new("RGBA", (1040, 560), hexc("#3a3f60"))
    sheet.paste(scaled(m, 432), (16, 16))
    # the safe zone (66 dp) outlined over the master
    d = ImageDraw.Draw(sheet)
    o = 16 + (432 - 264) // 2
    d.rectangle((o, o, o + 264, o + 264), outline=(255, 80, 80, 255))
    x = 470
    for size in (192, 96, 48):
        ic = rounded(scaled(legacy, size))
        sheet.paste(ic, (x, 16), ic)
        x += size + 20
    x = 470
    for size in (144, 72):
        ic = circle(scaled(m.crop((3, 3, 33, 33)), size))  # an adaptive icon masked round, as launchers show it
        sheet.paste(ic, (x, 240), ic)
        x += size + 20
    sq = rounded(scaled(m.crop((3, 3, 33, 33)), 144), 0.22)
    sheet.paste(sq, (x, 240), sq)
    sheet.save(os.path.join(out_dir, "icon-sheet.png"))
    scaled(m, 360).save(os.path.join(out_dir, "master.png"))


if __name__ == "__main__":
    m = master()
    if len(sys.argv) > 1:
        preview(m, sys.argv[1])
        if "--preview-only" in sys.argv:
            sys.exit(0)
    write_android(m)
    write_web(m)
    print("icon written")
