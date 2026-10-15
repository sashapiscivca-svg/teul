# The town's shops and businesses, each one known from across the street: its own silhouette and roof (a glass
# roof over the flowers, a steep gable over the bakery, a flat roof with a terrace over the café, a tin barrel over
# the household shop, a sawtooth over the workshop, a mansard over the bar, a portico at the post), its own walls,
# shop windows, awning, signboard and one thing that says what it is (a loaf, a cup, a cog, a frog, a tyre).
# Run inside gen_base_content.py after village_items.py (it uses item, b, slot, facade_windows) and before
# growth_items.py, whose worn variants copy these models. Footprints, ids and door positions are the old ones:
# the door stays at x = W // 2 - 26 on the street side, so maps, routes and tests stand as they were.

PALETTES["facade"] = [
    "#b8583e", "#4a4856", "#2f3f6a", "#2f6b4f", "#f3e4bf", "#a8dcc4", "#9b7fc4", "#7d9aa0", "#a5532f", "#7a2e3a",
    "#d9a63a", "#9a3f2c", "#8fb8dc", "#34343e", "#e2b33c", "#f6c9a0", "#7a8a3a", "#e6d2a2", "#5c3a2a", "#c94f3d",
]
BRICK, SLATE, NAVY, FOREST, CREAM, MINT, LILAC, TIN, RUST, BURGUNDY = PALETTES["facade"][:10]
MUSTARD, TILE, SKY, CHARCOAL, GOLD, PEACH, OLIVE, SAND, OAK, TOMATO = PALETTES["facade"][10:]

# where each shop's front wall stands (hundredths of a tile from the back): the worn variants put their cracks,
# tape and peeling paint on it, and the strip before it holds the shop's crates, buckets and tables
SHOP_FRONT = {}


def fc(color):
    return {"default": color, "palette": "facade"}


def _shell(W, D, F, wall_h, body="wall"):
    """The plinth and pavement, and the walls up to the front line F. A wall of another material (brick, planks)
    keeps a plain "wall" core inside it, which the worn variants look for."""
    out = [b(0, 0, 0, W, D, 6, "stone"), b(10, 10, 6, W - 20, F - 10, wall_h, body)]
    if body != "wall":
        out.append(b(16, 16, 6, W - 32, F - 22, wall_h - 4, "wall"))
    return out


def _door(W, F, slot_="door", h=90):
    """The street door where it always was (x = W // 2 - 26): frame, door, knob and step."""
    dx = W // 2 - 26
    return [b(dx - 6, F - 2, 6, 64, 4, h + 8, "trim"), b(dx, F - 1, 6, 52, 4, h, slot_), b(dx + 40, F + 2, 48, 6, 4, 6, "knob", "ball"),
            b(dx - 10, F, 0, 72, 12, 9, "stone")]


def _back_door(W, wall_h):
    dx = W // 2 - 26
    return [b(W - dx - 52, 6, 6, 44, 4, 84, "door"), b(W - dx - 58, 4, 6, 56, 4, 92, "trim"), b(W - dx - 62, 0, 0, 64, 8, 8, "stone"),
            b(12, 12, 6, 6, 6, wall_h, "trim", "cyl"), b(W - 18, 12, 6, 6, 6, wall_h, "trim", "cyl")]


def _win(x, z, w, h, F, panes=2, sill=True, glass="glass", frame="trim"):
    """A window on the front wall: frame, glass, glazing bars, a sill."""
    out = [b(x - 4, F - 2, z - 4, w + 8, 4, h + 8, frame), b(x, F - 1, z, w, 4, h, glass)]
    for i in range(1, panes):
        out.append(b(x + w * i // panes - 2, F, z, 4, 4, h, frame))
    if sill:
        out.append(b(x - 6, F - 2, z - 8, w + 12, 8, 4, frame))
    return out


def _slabs(x, y, z, w, d, h, inset, slot_, n=None):
    """A roof as stacked slabs, each inset from the one below by inset(t) = (left, right, back, front) at height
    t (0..1): the steps read as rows of tiles, as on the gable roofs."""
    n = n or max(4, min(16, round(h / 6)))
    out = []
    for k in range(n):
        lft, rgt, bk, fr = inset((k + 0.5) / n)
        bw, bd = w - lft - rgt, d - bk - fr
        if bw < 4 or bd < 4:
            break
        z0, z1 = z + round(h * k / n), z + round(h * (k + 1) / n)
        out.append(b(round(x + lft), round(y + bk), z0, round(bw), round(bd), z1 - z0, slot_))
    return out


def hip_roof(x, y, z, w, d, h, slot_="roof"):
    s = min(w, d) / 2
    return _slabs(x, y, z, w, d, h, lambda t: (s * t, s * t, s * t, s * t), slot_)


def front_gable(x, y, z, w, d, h, slot_="roof", end="wall", edge="trim"):
    """A pitched roof with its ridge running back from the street, so the gable faces the street: the slopes in
    the roof's colour, the gable's triangle in the wall's, and boards along its edges."""
    n = max(4, min(16, round(h / 7)))
    out = _slabs(x, y, z, w, d - 6, h, lambda t: (w / 2 * t, w / 2 * t, 0, 0), slot_, n)
    for k in range(n):
        t = (k + 0.5) / n
        z0, z1 = z + round(h * k / n), z + round(h * (k + 1) / n)
        half = w / 2 * (1 - t)
        if half < 6:
            break
        out.append(b(round(x + w / 2 - half + 10), y + d - 8, z0, round(2 * half - 20), 6, z1 - z0, end))
        out += [b(round(x + w / 2 - half), y + d - 6, z0, 12, 8, z1 - z0, edge), b(round(x + w / 2 + half - 12), y + d - 6, z0, 12, 8, z1 - z0, edge)]
    return out


def mansard_roof(x, y, z, w, d, h_low, h_top, slot_="roof", cap="roof_top"):
    """Steep lower slopes, nearly upright, under a low hipped top."""
    i = min(w, d) * 0.16
    out = _slabs(x, y, z, w, d, h_low, lambda t: (i * t, i * t, i * t, i * t), slot_)
    s = (min(w, d) - 2 * i) / 2
    out += _slabs(x + i, y + i, z + h_low, w - 2 * i, d - 2 * i, h_top, lambda t: (s * t, s * t, s * t, s * t), cap)
    return out


def barrel_roof(x, y, z, w, d, h, slot_="roof"):
    """A round tin roof (its arch faces the street), as on a store shed."""
    return _slabs(x, y, z, w, d, h, lambda t: ((w / 2) * (1 - (1 - t * t) ** 0.5),) * 2 + (0, 0), slot_, max(8, min(18, round(h / 6))))


def shed_roof(x, y, z, w, d, h, slot_="roof"):
    """One slope rising to the street."""
    return _slabs(x, y, z, w, d, h, lambda t: (0, 0, d * t, 0), slot_)


def sawtooth_roof(x, y, z, w, d, h, teeth, slot_="roof", glass="glass", frame="trim"):
    """A workshop's sawtooth: each tooth's upright side is glazed (toward the back), its slope runs to the front."""
    p = d / teeth
    out = []
    for j in range(teeth):
        y0 = y + j * p
        out += _slabs(x, y0, z, w, p, h, lambda t: (0, 0, 0, p * t), slot_)
        out += [b(x + 8, round(y0) - 2, z + 6, w - 16, 4, h - 14, glass)]
        out += [b(x + 8 + k * (w - 16) // 6, round(y0) - 3, z + 6, 4, 4, h - 14, frame) for k in range(7)]
    return out


def flat_roof(W, F, z, rim=16, slot_="roof_flat", edge="trim"):
    """A flat roof behind a low parapet."""
    return [b(6, 6, z, W - 12, F - 2, 8, slot_),
            b(6, F - 6, z, W - 12, 10, rim, edge), b(6, 4, z, W - 12, 10, rim, edge), b(4, 4, z, 10, F, rim, edge), b(W - 14, 4, z, 10, F, rim, edge)]


def awning(x0, x1, z, F, depth=56, drop=26, stripe=40, rows=3, a="awn_a", bb="awn_b"):
    """A striped awning sloping out from the wall, with a scalloped flap along its edge."""
    out = []
    for r in range(rows):
        y = F + r * depth // rows
        zz = z - r * drop // rows
        for i, x in enumerate(range(x0, x1, stripe)):
            out.append(b(x, y, zz, min(stripe, x1 - x), depth // rows + 2, 6, a if i % 2 == 0 else bb))
    for i, x in enumerate(range(x0, x1, stripe)):
        out.append(b(x, F + depth - 2, z - drop - 8, min(stripe, x1 - x), 3, 12, a if i % 2 == 0 else bb))
        out.append(b(x + stripe // 2 - 8, F + depth - 2, z - drop - 14, 16, 3, 8, a if i % 2 == 0 else bb, "ball"))
    return out


def blade_sign(x, F, z, slot_="sign", w=8, d=56, h=40, shape=None):
    """A sign standing out from the wall on an iron bracket, read from along the street."""
    return [b(x, F, z + h + 4, 4, d + 10, 4, "iron"), b(x, F, z + h - 10, 4, 4, 18, "iron"), b(x - w // 2 + 2, F + 10, z, w, d, h, slot_, shape),
            b(x, F + 14, z + h, 2, 2, 6, "iron"), b(x, F + d + 4, z + h, 2, 2, 6, "iron")]


def shop(id, name, w, d, F, model, slots_):
    SHOP_FRONT[id] = F
    base = {"stone": slot("ceramic", 1), "trim": slot("ceramic", 0), "door": slot("wood", 0), "knob": slot("metal", 1), "glass": slot("glass", 1),
            "iron": fc(CHARCOAL)}
    item(id, "village", w, d, "floor", model, {**base, **slots_}, "free", name=name)


def _flowers(x, y, z, n, step=16, size=16, cols=("fl_a", "fl_b", "fl_c")):
    return [b(x + i * step, y + (i % 2) * 4, z + (i % 3) * 3, size, size, size, cols[i % len(cols)] if i % 4 else "leafy", "ball") for i in range(n)]


# ---- the flower shop «Півонія»: pink walls under a glass roof like a little greenhouse, white ribs over it, a
# peony on the gable, flower boxes under wide windows, buckets of flowers on a stepped stand ------------------
W, D, F, H = 500, 300, 250, 100
m = _shell(W, D, F, H) + _door(W, F) + _back_door(W, H) + facade_windows(W, F + 10, 46, front=False)
m += [b(0, 0, 6 + H, W, F + 14, 76, "roof_glass", "gable")]
m += [b(x, 0, 6 + H, 6, F + 14, 78, "trim", "gable") for x in (0, 70, 140, 210, 290, 360, 430, W - 6)]
m += [b(0, (F + 14) // 2 - 5, 6 + H + 74, W, 10, 6, "trim")]
for x0 in (26, 290):
    m += _win(x0, 22, 184, 70, F, panes=3)
    m += [b(x0 - 4, F, 10, 192, 16, 12, "box")] + _flowers(x0, F + 2, 20, 12)
# the peony over the door: five pink petals round a yellow heart
for px, pz in ((-26, 0), (26, 0), (-16, 24), (16, 24), (0, -20)):
    m.append(b(W // 2 - 18 + px, F + 4, 116 + pz, 36, 10, 30, "petal", "ball"))
m.append(b(W // 2 - 12, F + 10, 124, 24, 8, 22, "heart", "ball"))
m += [b(W // 2 - 4, F + 4, 96, 8, 6, 22, "leafy")]
# a stepped stand of buckets by the door, potted bushes on the other side
m += [b(150, F + 2, 0, 60, 44, 14, "stand"), b(150, F + 2, 14, 60, 24, 14, "stand")]
m += [b(152 + i * 20, F + 26 - (i // 3) * 22, 14 + (i // 3) * 14, 16, 16, 14, "bucket", "cyl") for i in range(6)]
m += [b(150 + (i % 3) * 20, F + 26 - (i // 3) * 22, 28 + (i // 3) * 14, 20, 20, 20, ("fl_a", "fl_b", "fl_c")[i % 3], "ball") for i in range(6)]
m += [b(300, F + 8, 0, 36, 36, 28, "pot", "cyl"), b(296, F + 4, 26, 44, 40, 44, "leafy", "ball"), b(306, F + 8, 50, 16, 14, 14, "fl_a", "ball"),
      b(440, F + 8, 0, 36, 36, 28, "pot", "cyl"), b(436, F + 4, 26, 44, 40, 44, "leafy", "ball"), b(454, F + 10, 52, 14, 14, 14, "fl_c", "ball")]
# climbing roses up the left corner
m += [b(4, F - 30 + (k % 2) * 8, 10 + k * 16, 18, 18, 18, "leafy" if k % 3 else "fl_a", "ball") for k in range(6)]
shop("flower_shop", "Квітковий магазин «Півонія»", 5, 3, F, m, {
    "wall": slot("fabric_pink", 1), "roof_glass": slot("glass", 3), "door": slot("leaf", 1), "glass": slot("glass", 3), "box": slot("wood", 3),
    "fl_a": slot("fabric_pink", 0), "fl_b": slot("autumn", 3), "fl_c": slot("fabric", 3), "leafy": slot("leaf", 1), "petal": slot("fabric_pink", 2),
    "heart": slot("autumn", 3), "stand": slot("wood", 1), "bucket": slot("metal", 0), "pot": slot("pot", 0)})

# ---- the café «Липа»: two storeys, deep green, a red-and-cream awning over the windows and two tables, a cup
# hanging on a bracket, and up on the flat roof a terrace with a parasol and a little linden in a tub ----------
W, D, F, H = 500, 300, 240, 150
m = _shell(W, D, F, H) + _door(W, F) + _back_door(W, H) + facade_windows(W, F + 10, 100, front=False)
for x0 in (30, 300):
    m += _win(x0, 18, 170, 72, F, panes=3)
for x0 in (50, 225, 400):
    m += _win(x0, 116, 50, 30, F, panes=2) + [b(x0 - 22, F, 112, 16, 4, 38, "shutter"), b(x0 + 56, F, 112, 16, 4, 38, "shutter")]
m += [b(10, F, 104, W - 20, 6, 6, "trim")]
m += awning(20, 480, 104, F, depth=56, drop=26)
m += flat_roof(W, F, 6 + H)
# the roof terrace: a parasol over a table, the linden in its tub, a rail
m += [b(330, 110, 164, 6, 6, 56, "iron"), b(284, 64, 214, 98, 98, 20, "awn_a", "cone"), b(318, 98, 236, 30, 30, 6, "awn_b", "cone"),
      b(312, 92, 164, 40, 40, 4, "iron", "cyl"), b(310, 90, 190, 44, 44, 4, "table", "cyl"), b(330, 110, 164, 6, 6, 26, "iron")]
m += [b(60, 80, 164, 50, 50, 30, "tub", "cyl"), b(80, 100, 192, 10, 10, 30, "bark", "cyl"), b(44, 64, 214, 82, 82, 66, "linden", "ball"), b(70, 90, 260, 50, 50, 30, "linden2", "ball")]
# a cup on the bracket at the corner, a chalkboard by the door, two tables with chairs under the awning
m += [b(466, F, 152, 4, 66, 4, "iron"), b(466, F + 30, 132, 4, 4, 20, "iron"), b(454, F + 24, 102, 28, 28, 30, "cup", "cyl"), b(454, F + 22, 132, 28, 30, 4, "coffee", "cyl"),
      b(458, F + 50, 110, 12, 8, 14, "cup", "round"), b(446, F + 20, 98, 44, 38, 4, "cup", "cyl")]
m += [b(300, F + 20, 0, 34, 6, 46, "board"), b(300, F + 26, 0, 34, 6, 42, "board"), b(304, F + 18, 10, 26, 2, 30, "chalk")]
for tx in (60, 380):
    m += [b(tx + 16, F + 28, 0, 6, 6, 34, "iron", "cyl"), b(tx, F + 12, 34, 38, 38, 4, "table", "cyl"),
          b(tx - 24, F + 18, 0, 20, 20, 20, "chair"), b(tx - 24, F + 18, 20, 4, 20, 24, "chair"), b(tx + 42, F + 18, 0, 20, 20, 20, "chair"), b(tx + 58, F + 18, 20, 4, 20, 24, "chair")]
shop("cafe_house", "Кав'ярня «Липа»", 5, 3, F, m, {
    "wall": fc(FOREST), "trim": slot("ceramic", 1), "door": slot("wood", 2), "glass": slot("glass", 2), "shutter": slot("ceramic", 1),
    "awn_a": slot("fabric", 1), "awn_b": slot("ceramic", 0), "roof_flat": fc(SLATE), "table": slot("ceramic", 0), "tub": slot("wood", 2),
    "bark": slot("wood", 2), "linden": slot("leaf", 2), "linden2": slot("leaf", 3), "cup": slot("ceramic", 0), "coffee": slot("earth", 3),
    "board": slot("wood", 2), "chalk": slot("ceramic", 5), "chair": slot("wood", 1)})

# ---- the bakery «Паляниця»: brick under a steep gable turned to the street, a round window in the gable, a tall
# chimney from the ovens, a big loaf hanging over the door, loaves in the windows and a bench before them ------
W, D, F, H = 400, 300, 256, 104
m = _shell(W, D, F, H, body="stone_brick") + _door(W, F) + _back_door(W, H) + facade_windows(W, F + 10, 50, front=False)
m += front_gable(-4, 0, 6 + H, W + 8, F + 14, 150, end="stone_brick", edge="trim")
m += [b(W // 2 - 22, F + 2, 6 + H + 34, 44, 4, 44, "trim", "ball"), b(W // 2 - 17, F + 4, 6 + H + 39, 34, 4, 34, "glass", "ball"),
      b(W // 2 - 2, F + 7, 6 + H + 39, 4, 2, 34, "trim"), b(W // 2 - 17, F + 7, 6 + H + 54, 34, 2, 4, "trim")]
m += [b(270, 70, 170, 44, 44, 150, "chimney"), b(264, 64, 320, 56, 56, 10, "chimney"), b(278, 78, 330, 28, 28, 10, "chimney_pot", "cyl")]
for x0 in (34, 254):
    m += _win(x0, 24, 112, 64, F, panes=2) + [b(x0 - 6, F, 92, 124, 6, 8, "stone_arch")]
    m += [b(x0 + 8 + i * 34, F + 3, 24, 30, 12, 14, "loaf", "ball") for i in range(3)]
# the loaf on two chains over the door: a round palianytsia with its crust cut across
m += [b(W // 2 - 50, F + 8, 132, 2, 2, 24, "iron"), b(W // 2 + 48, F + 8, 132, 2, 2, 24, "iron"), b(W // 2 - 70, F + 2, 154, 140, 12, 6, "iron"),
      b(W // 2 - 66, F + 2, 100, 132, 24, 36, "bread", "ball"), b(W // 2 - 30, F + 22, 114, 6, 4, 18, "crust"), b(W // 2 + 22, F + 22, 114, 6, 4, 18, "crust"),
      b(W // 2 - 40, F + 22, 118, 80, 4, 4, "crust")]
m += [b(260, F + 18, 18, 110, 22, 6, "bench"), b(266, F + 20, 0, 8, 16, 18, "bench"), b(356, F + 20, 0, 8, 16, 18, "bench"),
      b(30, F + 10, 0, 30, 30, 34, "sack", "round"), b(36, F + 14, 32, 18, 18, 8, "sack_tie", "ball"), b(70, F + 14, 0, 26, 26, 26, "sack", "round")]
shop("bakery", "Пекарня «Паляниця»", 4, 3, F, m, {
    "stone_brick": fc(BRICK), "wall": fc(BRICK), "roof": fc(SLATE), "trim": slot("ceramic", 1), "door": slot("wood", 2), "glass": slot("pastel", 3),
    "chimney": fc(BRICK), "chimney_pot": slot("pot", 0), "stone_arch": fc(SAND), "loaf": slot("wood", 3), "bread": fc(MUSTARD),
    "crust": slot("wood", 0), "bench": slot("wood", 1), "sack": fc(SAND), "sack_tie": slot("wood", 2)})

# ---- the grocery «Колосок»: a low flat-roofed box with a glass front from end to end, a tall green fascia with
# white letters and a golden ear of wheat, a canopy over crates of apples, oranges and cabbages ----------------
W, D, F, H = 500, 300, 236, 112
m = _shell(W, D, F, H) + _door(W, F, slot_="door") + _back_door(W, H) + facade_windows(W, F + 10, 52, front=False)
m += flat_roof(W, F, 6 + H, rim=10)
for x0, x1 in ((16, W // 2 - 34), (W // 2 + 34, W - 16)):
    m += [b(x0, F - 2, 10, x1 - x0, 4, 92, "trim"), b(x0 + 4, F - 1, 14, x1 - x0 - 8, 4, 84, "glass")]
    m += [b(x, F, 14, 4, 4, 84, "trim") for x in range(x0 + 50, x1 - 20, 50)]
m += [b(W // 2 - 26, F - 1, 6, 52, 4, 90, "glass")]
m += [b(0, F - 4, 104, W, 16, 52, "sign"), b(0, F + 10, 104, W, 4, 4, "trim"), b(0, F + 10, 152, W, 4, 4, "trim")]
m += [b(130 + i * 34, F + 12, 118, 24, 3, 22, "letters") for i in range(8)]
m += [b(52, F + 12, 112, 6, 4, 38, "stalk")] + [b(44 + (k % 2) * 14, F + 12, 124 + (k // 2) * 9, 12, 5, 12, "wheat", "ball") for k in range(6)] + [b(50, F + 12, 152, 10, 4, 10, "wheat", "ball")]
m += [b(0, F, 96, W, 58, 6, "canopy"), b(4, F + 52, 6, 6, 6, 90, "iron", "cyl"), b(W - 10, F + 52, 6, 6, 6, 90, "iron", "cyl")]
m += [b(250, 80, 124, 70, 50, 34, "vent"), b(262, 92, 158, 46, 26, 4, "iron")]
for x0, goods in ((24, ("apple", "orange")), (W - 194, ("cabbage", "orange"))):
    m += [b(x0, F + 8, 0, 170, 40, 22, "crate"), b(x0, F + 8, 22, 170, 22, 18, "crate")]
    m += [b(x0 + 4 + i * 20, F + 26, 22, 18, 18, 16, goods[i % 2], "ball") for i in range(8)]
    m += [b(x0 + 4 + i * 20, F + 8, 40, 18, 18, 16, goods[(i + 1) % 2], "ball") for i in range(8)]
shop("grocery", "Крамниця «Колосок»", 5, 3, F, m, {
    "wall": slot("ceramic", 1), "trim": slot("ceramic", 0), "door": slot("glass", 0), "glass": slot("glass", 1), "roof_flat": fc(SLATE),
    "sign": fc(FOREST), "letters": slot("ceramic", 0), "stalk": fc(GOLD), "wheat": fc(GOLD), "canopy": fc(FOREST), "vent": slot("metal", 0),
    "crate": slot("wood", 1), "apple": slot("fabric", 1), "orange": slot("autumn", 1), "cabbage": slot("leaf", 3)})

# ---- the post office «Пошта»: tall pale blue walls under a dark hipped roof, a white portico of four columns and
# a pediment with a clock and a golden post horn; a yellow letter box; a sign on the back too ------------------
W, D, F, H = 500, 300, 226, 150
m = _shell(W, D, F, H) + _door(W, F, h=110) + _back_door(W, H) + facade_windows(W, F + 10, 70, front=False)
m += hip_roof(-6, -6, 6 + H, W + 12, F + 22, 84)
for x0 in (40, 400):
    m += _win(x0, 40, 60, 90, F, panes=2)
m += [b(110, F, 0, 280, 72, 12, "stone"), b(118, F, 12, 264, 66, 4, "plinth")]
m += [b(x, F + 36, 16, 24, 24, 130, "column", "cyl") for x in (122, 182, 294, 354)]
m += [b(x - 4, F + 32, 140, 32, 32, 8, "column") for x in (122, 182, 294, 354)]
m += [b(108, F, 148, 284, 72, 14, "trim")]
m += front_gable(108, F - 6, 162, 284, 78, 54, slot_="roof", end="trim", edge="trim")
m += [b(W // 2 - 18, F + 72, 168, 36, 4, 36, "clock", "ball"), b(W // 2 - 1, F + 75, 184, 2, 2, 14, "hand"), b(W // 2 - 1, F + 75, 184, 10, 2, 2, "hand")]
m += [b(160, F + 62, 120, 180, 4, 22, "sign"), b(176, F + 66, 126, 22, 2, 10, "horn", "round"), b(198, F + 66, 128, 10, 2, 6, "horn"),
      b(216, F + 66, 128, 108, 2, 10, "letters")]
# the letter box by the steps, and the back's sign with an envelope (the street sees this side of it)
m += [b(46, F + 34, 0, 8, 8, 50, "iron", "cyl"), b(30, F + 22, 50, 40, 32, 36, "box", "round"), b(30, F + 22, 86, 40, 32, 6, "boxtop", "round"), b(38, F + 54, 72, 24, 2, 4, "iron")]
m += [b(140, 2, 104, 220, 4, 36, "sign"), b(156, 0, 112, 40, 2, 22, "env"), b(162, -1, 124, 14, 1, 3, "horn"), b(176, -1, 124, 14, 1, 3, "horn"), b(208, 0, 116, 136, 2, 12, "letters")]
shop("post_office", "Пошта «Липове»", 5, 3, F, m, {
    "wall": slot("ceramic", 2), "roof": fc(NAVY), "trim": slot("ceramic", 0), "door": fc(NAVY), "column": slot("ceramic", 0), "plinth": slot("ceramic", 1),
    "clock": slot("ceramic", 0), "hand": slot("metal", 2), "sign": fc(NAVY), "horn": fc(GOLD), "letters": slot("ceramic", 0), "env": slot("ceramic", 0),
    "box": fc(GOLD), "boxtop": fc(NAVY)})

# ---- the workshop «Друге життя»: a plank shed under a sawtooth roof with its glass to the light, a barn door
# braced with an X, a big cog on the gable, planks and a sawhorse out front, mended chairs by the back wall -----
W, D, F, H = 500, 300, 250, 104
m = _shell(W, D, F, H, body="plank") + _door(W, F) + _back_door(W, H)
m += [b(x, 9, 20, 6, 2, H - 20, "batten") for x in range(30, W - 20, 40)] + [b(x, F - 1, 20, 6, 2, H - 20, "batten") for x in range(20, W - 20, 40) if not 160 < x < 340]
m += sawtooth_roof(0, 0, 6 + H, W, F + 12, 64, 3)
m += [b(150, F - 2, 6, 64, 4, 96, "barn"), b(286, F - 2, 6, 64, 4, 96, "barn"), b(150, F + 1, 50, 64, 3, 6, "trim"), b(286, F + 1, 50, 64, 3, 6, "trim")]
m += [b(152 + k * 8, F + 1, 10 + k * 11, 10, 3, 10, "trim") for k in range(8)] + [b(340 - k * 8, F + 1, 10 + k * 11, 10, 3, 10, "trim") for k in range(8)]
for x0 in (40, 390):
    m += _win(x0, 40, 70, 46, F, panes=3)
# the cog over the door, on the front and on the back (the street sees the back)
for y_, face in ((F + 2, 1), (2, -1)):
    m += [b(W // 2 - 26, y_, 116, 52, 6, 52, "cog", "ball"), b(W // 2 - 10, y_ + 2 * face, 132, 20, 4, 20, "trim", "ball")]
    m += [b(W // 2 - 6 + dx, y_, 138 + dz, 12, 6, 12, "cog") for dx, dz in ((0, 26), (0, -34), (26, -4), (-26, -4), (19, 17), (-19, 17), (19, -25), (-19, -25))]
m += [b(120, 2, 76, 260, 4, 26, "sign"), b(136, 0, 84, 228, 2, 10, "letters")]
m += [b(20, F + 10, 0, 10, 30, 100, "plank"), b(32, F + 12, 0, 10, 30, 94, "plank"), b(44, F + 8, 0, 10, 30, 106, "plank"),
      b(380, F + 16, 30, 90, 20, 8, "plank"), b(386, F + 12, 0, 6, 28, 32, "batten"), b(458, F + 12, 0, 6, 28, 32, "batten")]
shop("workshop", "Майстерня «Друге життя»", 5, 3, F, m, {
    "plank": slot("wood", 1), "wall": slot("wood", 1), "batten": slot("wood", 0), "roof": fc(TIN), "trim": slot("wood", 4), "door": slot("wood", 2),
    "glass": slot("glass", 0), "barn": fc(RUST), "cog": fc(GOLD), "sign": slot("wood", 3), "letters": slot("wood", 2)})

# ---- the bar «Жабка»: burgundy boards under a slate mansard with dormers, a green frog with round eyes on both
# sides, lanterns by the door, barrels for tables ----------------------------------------------------------------
W, D, F, H = 500, 300, 250, 100
m = _shell(W, D, F, H) + _door(W, F) + _back_door(W, H) + facade_windows(W, F + 10, 46, front=False)
m += mansard_roof(-4, -4, 6 + H, W + 8, F + 18, 70, 24)
# dormers on the front slope and on the back one
for x0 in (90, 330):
    m += [b(x0, F - 40, 6 + H + 14, 80, 46, 44, "dormer"), b(x0 - 4, F - 44, 6 + H + 58, 88, 54, 8, "roof_top"), b(x0 + 16, F + 5, 6 + H + 22, 48, 3, 28, "glass"),
          b(x0, -10, 6 + H + 14, 80, 46, 44, "dormer"), b(x0 - 4, -14, 6 + H + 58, 88, 54, 8, "roof_top"), b(x0 + 16, -13, 6 + H + 22, 48, 3, 28, "glass")]
for x0 in (40, 340):
    m += _win(x0, 30, 120, 56, F, panes=4)
for y_, face in ((F + 4, 1), (0, -1)):
    m += [b(W // 2 - 50, y_, 112, 100, 6, 6, "iron"), b(W // 2 - 40, y_, 120, 80, 8, 60, "frog", "ball"), b(W // 2 - 36, y_, 168, 24, 8, 24, "eye", "ball"),
          b(W // 2 + 12, y_, 168, 24, 8, 24, "eye", "ball"), b(W // 2 - 29, y_ + 3 * face, 176, 10, 4, 10, "pupil", "ball"), b(W // 2 + 19, y_ + 3 * face, 176, 10, 4, 10, "pupil", "ball"),
          b(W // 2 - 22, y_ + 2 * face, 136, 44, 6, 6, "mouth")]
m += [b(W // 2 - 50, F, 70, 10, 10, 22, "lantern", "round"), b(W // 2 + 40, F, 70, 10, 10, 22, "lantern", "round")]
m += [b(20, F + 8, 0, 40, 40, 56, "barrel", "cyl"), b(20, F + 8, 18, 40, 40, 4, "hoop", "cyl"), b(20, F + 8, 40, 40, 40, 4, "hoop", "cyl"),
      b(440, F + 8, 0, 40, 40, 56, "barrel", "cyl"), b(440, F + 8, 18, 40, 40, 4, "hoop", "cyl"), b(440, F + 8, 40, 40, 40, 4, "hoop", "cyl")]
shop("bar_house", "Бар «Жабка»", 5, 3, F, m, {
    "wall": fc(BURGUNDY), "roof": fc(SLATE), "roof_top": fc(CHARCOAL), "trim": slot("ceramic", 1), "door": slot("wood", 5), "glass": slot("pastel", 3),
    "dormer": fc(BURGUNDY), "frog": slot("leaf", 1), "eye": slot("ceramic", 0), "pupil": slot("ceramic", 5), "mouth": slot("leaf", 0),
    "lantern": slot("metal", 1), "barrel": slot("wood", 1), "hoop": slot("metal", 2)})

# ---- the clothes shop «Льон»: two storeys of linen white, a stepped front rising over the roof with a navy
# cornice, two shop windows with a dressed mannequin each under navy-and-white awnings, a shirt on a bracket ----
W, D, F, H = 500, 300, 250, 176
m = _shell(W, D, F, H) + _door(W, F) + _back_door(W, H) + facade_windows(W, F + 10, 120, front=False)
m += [b(14, 4, 6 + H, W - 28, F - 10, 36, "roof", "gable")]
m += [b(0, F - 14, 6 + H, W, 14, 30, "wall"), b(60, F - 14, 6 + H + 30, W - 120, 14, 30, "wall"), b(150, F - 14, 6 + H + 60, W - 300, 14, 28, "wall")]
m += [b(-4, F - 16, 6 + H + 30, W + 8, 22, 8, "cornice"), b(56, F - 16, 6 + H + 60, W - 112, 22, 8, "cornice"), b(146, F - 16, 6 + H + 88, W - 292, 22, 8, "cornice"),
      b(W // 2 - 14, F - 12, 6 + H + 96, 28, 14, 28, "cornice", "ball")]
# the name on the stepped front
m += [b(100, F, 6 + H + 6, W - 200, 4, 22, "cornice"), b(120, F + 3, 6 + H + 12, W - 240, 2, 10, "letters")]
m += [b(10, F, 100, W - 20, 6, 8, "cornice")]
for x0 in (30, 304):
    m += _win(x0, 14, 166, 80, F, panes=1)
    m += [b(x0 + 74, F + 2, 14, 6, 6, 40, "stand", "cyl"), b(x0 + 60, F + 2, 50, 34, 8, 36, "dress"), b(x0 + 66, F + 2, 84, 22, 8, 10, "dress"), b(x0 + 70, F + 2, 92, 14, 8, 14, "head", "ball")]
    m += awning(x0 - 10, x0 + 186, 110, F, depth=46, drop=20, stripe=49, rows=2, bb="awn_a") + [b(x0 - 10, F + 46, 82, 196, 3, 4, "awn_b")]
for x0 in (40, 160, 290, 410):
    m += _win(x0, 120, 50, 50, F, panes=2) + [b(x0 - 6, F, 114, 62, 14, 6, "cornice"), b(x0 - 2, F + 8, 120, 54, 4, 12, "rail")]
m += [b(466, F, 150, 4, 64, 4, "iron"), b(466, F + 30, 140, 4, 4, 10, "iron"), b(460, F + 12, 100, 14, 52, 40, "shirt"), b(460, F + 2, 126, 14, 72, 14, "shirt"),
      b(460, F + 32, 130, 14, 12, 10, "head")]
shop("clothes_shop", "Крамниця одягу «Льон»", 5, 3, F, m, {
    "wall": slot("ceramic", 0), "roof": fc(SLATE), "cornice": fc(NAVY), "trim": fc(NAVY), "door": fc(NAVY), "glass": slot("glass", 2), "awn_a": fc(NAVY),
    "awn_b": slot("ceramic", 0), "letters": slot("ceramic", 0), "stand": slot("metal", 0), "dress": slot("fabric", 7), "head": slot("ceramic", 1), "rail": slot("metal", 2), "shirt": fc(SKY)})

# ---- the salon «Локон»: a small mint house under a tall lilac hipped roof, a barber's pole, a round mirror for a
# window, scissors on a bracket ----------------------------------------------------------------------------------
W, D, F, H = 400, 300, 256, 100
m = _shell(W, D, F, H) + _door(W, F) + _back_door(W, H) + facade_windows(W, F + 10, 46, front=False)
m += hip_roof(-8, -8, 6 + H, W + 16, F + 24, 110)
m += [b(W // 2 - 16, F - 50, 6 + H + 108, 32, 32, 22, "finial", "ball")]
m += [b(36, F - 2, 20, 104, 4, 70, "trim", "ball"), b(42, F, 26, 92, 4, 58, "glass", "ball"), b(70, F + 2, 26, 36, 6, 30, "chair")]
m += _win(256, 26, 110, 60, F, panes=2)
m += [b(W // 2 - 60, F, 100, 120, 6, 22, "sign"), b(W // 2 - 50, F + 6, 106, 100, 2, 10, "letters")]
m += [b(160, F + 22, 0, 16, 16, 100, "pole", "cyl")] + [b(160, F + 22, 8 + i * 16, 16, 16, 6, "stripe" if i % 2 == 0 else "stripe2", "cyl") for i in range(6)] + [b(156, F + 18, 100, 24, 24, 10, "cap", "ball")]
m += blade_sign(372, F, 96, slot_="sign", w=6, d=50, h=34, shape="round")
m += [b(374, F + 22, 104, 4, 30, 4, "blade"), b(374, F + 22, 116, 4, 30, 4, "blade"), b(374, F + 50, 102, 4, 10, 10, "blade", "round"), b(374, F + 50, 116, 4, 10, 10, "blade", "round")]
m += [b(300, F + 10, 0, 30, 30, 26, "pot", "cyl"), b(296, F + 6, 24, 38, 38, 36, "leafy", "ball")]
shop("hair_salon", "Перукарня «Локон»", 4, 3, F, m, {
    "wall": fc(MINT), "roof": fc(LILAC), "finial": slot("metal", 1), "trim": slot("ceramic", 0), "door": slot("fabric", 7), "glass": slot("glass", 2),
    "chair": slot("fabric", 7), "sign": slot("ceramic", 0), "letters": fc(LILAC), "pole": slot("ceramic", 0), "stripe": slot("fabric", 1),
    "stripe2": slot("fabric", 6), "cap": slot("metal", 1), "blade": slot("metal", 0), "pot": slot("pot", 0), "leafy": slot("leaf", 1)})

# ---- the household shop «Господарчий»: a round tin roof like a store shed, mustard walls, a roller shutter, a
# board with a hammer and a spanner in the arch, a ladder, a wheelbarrow and buckets out front -------------------
W, D, F, H = 400, 300, 250, 66
m = _shell(W, D, F, H) + _door(W, F) + _back_door(W, H)
m += barrel_roof(-6, 0, 6 + H, W + 12, F + 12, 130, slot_="roof_tin")
m += [b(x, 0, 6 + H, 4, F + 14, 4, "trim") for x in (0, W - 4)]
m += [b(60, F + 12, 84, 280, 6, 40, "sign"), b(90, F + 18, 100, 140, 2, 10, "letters"),
      b(256, F + 18, 108, 34, 3, 10, "hammer"), b(270, F + 18, 92, 6, 3, 18, "handle"), b(300, F + 18, 94, 6, 3, 24, "spanner"), b(296, F + 18, 116, 14, 3, 8, "spanner")]
m += [b(250, F - 2, 6, 120, 4, 74, "shutter")] + [b(250, F, 10 + k * 9, 120, 3, 2, "trim") for k in range(8)]
m += _win(30, 20, 110, 50, F, panes=2)
m += [b(16, F + 20, 0, 6, 6, 120, "ladder"), b(56, F + 20, 0, 6, 6, 120, "ladder")] + [b(16, F + 20, 14 + k * 22, 46, 4, 4, "ladder") for k in range(5)]
m += [b(270, F + 12, 14, 80, 34, 22, "barrow"), b(280, F + 18, 0, 14, 14, 14, "barrow_leg"), b(342, F + 20, 0, 18, 18, 18, "wheel", "cyl")]
m += [b(374, F + 10, 0, 22, 22, 26, "bucket", "cyl"), b(374, F + 10, 26, 22, 22, 22, "bucket2", "cyl"), b(100, F + 22, 0, 22, 22, 26, "bucket2", "cyl"),
      b(130, F + 20, 0, 6, 6, 110, "rake", "cyl"), b(120, F + 16, 104, 26, 10, 6, "rake"), b(144, F + 22, 0, 6, 6, 96, "rake", "cyl"), b(138, F + 20, 0, 18, 14, 18, "spade")]
shop("hardware_store", "Господарчий магазин", 4, 3, F, m, {
    "wall": fc(MUSTARD), "roof_tin": fc(TIN), "trim": slot("ceramic", 0), "door": slot("leaf", 0), "glass": slot("glass", 2), "sign": slot("leaf", 0),
    "letters": slot("ceramic", 0), "hammer": slot("metal", 0), "handle": slot("wood", 1), "spanner": slot("metal", 0), "shutter": slot("metal", 0),
    "ladder": slot("wood", 3), "barrow": fc(TOMATO), "barrow_leg": slot("metal", 2), "wheel": slot("ceramic", 5), "bucket": slot("metal", 0),
    "bucket2": slot("fabric", 6), "rake": slot("wood", 2), "spade": slot("metal", 0)})

# ---- the doughnut shop «Пончикова»: a pink box with a flat roof and a giant glazed doughnut standing on it, a
# pink-and-white awning, a board with its name -------------------------------------------------------------------
W, D, F, H = 400, 300, 250, 104
m = _shell(W, D, F, H) + _door(W, F) + _back_door(W, H) + facade_windows(W, F + 10, 46, front=False)
m += flat_roof(W, F, 6 + H, rim=12)
m += [b(146, 116, 124, 8, 8, 30, "iron"), b(246, 116, 124, 8, 8, 30, "iron")]
m += [b(120, 60, 150, 160, 120, 40, "dough", "cyl"), b(126, 66, 186, 148, 108, 14, "icing", "cyl"), b(176, 98, 150, 48, 56, 52, "hole", "cyl")]
m += [b(136 + (k * 37) % 120, 70 + (k * 53) % 92, 200, 8, 8, 4, ("sp1", "sp2", "sp3")[k % 3]) for k in range(14) if not (166 < 136 + (k * 37) % 120 < 226 and 90 < 70 + (k * 53) % 92 < 156)]
for x0 in (24, 254):
    m += _win(x0, 20, 122, 66, F, panes=2)
m += awning(10, 390, 104, F, depth=46, drop=22, rows=2)
m += [b(W // 2 - 80, F, 110, 160, 6, 26, "sign", "round"), b(W // 2 - 60, F + 6, 118, 120, 2, 10, "letters")]
m += [b(30, F + 10, 0, 30, 30, 34, "bin", "cyl"), b(340, F + 14, 0, 30, 10, 44, "board"), b(344, F + 12, 14, 22, 2, 24, "chalk")]
shop("donut_shop", "Пончикова", 4, 3, F, m, {
    "wall": slot("fabric_pink", 1), "trim": slot("ceramic", 0), "door": slot("earth", 3), "glass": slot("glass", 2), "roof_flat": slot("fabric_pink", 2),
    "dough": slot("autumn", 1), "icing": slot("fabric_pink", 0), "hole": slot("ceramic", 5), "sp1": slot("fabric", 6), "sp2": slot("autumn", 3),
    "sp3": slot("leaf", 1), "awn_a": slot("fabric_pink", 0), "awn_b": slot("ceramic", 0), "sign": slot("earth", 3), "letters": slot("fabric_pink", 3),
    "bin": slot("metal", 0), "board": slot("wood", 2), "chalk": slot("ceramic", 5)})

# ---- the car service «СТО»: a flat-roofed shed of grey block with two ribbed roller doors, a chequered band under
# the roof, a sign with a tyre on the roof and on the back wall, a tall pylon by the forecourt, tyres stacked ---
W, D, F, H = 500, 400, 352, 128
m = _shell(W, D, F, H) + _door(W, F) + _back_door(W, H) + facade_windows(W, F + 10, 60, front=False)
m += flat_roof(W, F, 6 + H, rim=12)
for x0 in (22, 286):
    m += [b(x0 - 6, F - 2, 6, 204, 4, 116, "trim"), b(x0, F - 1, 6, 192, 4, 108, "bay")] + [b(x0, F + 1, 16 + i * 18, 192, 3, 3, "bay_line") for i in range(6)]
for y_ in (F - 2, 6):
    m += [b(10 + k * 24, y_, 6 + H - 14, 24, 6, 12, "check_a" if k % 2 == 0 else "check_b") for k in range(20)]
m += [b(130, F - 40, 6 + H + 8, 240, 14, 54, "sign"), b(150, F - 26, 6 + H + 24, 120, 3, 20, "letters"),
      b(290, F - 28, 6 + H + 12, 46, 6, 46, "tyre", "ball"), b(303, F - 24, 6 + H + 25, 20, 4, 20, "rim", "ball"),
      b(150, F - 43, 6 + H + 24, 120, 3, 20, "letters"), b(290, F - 46, 6 + H + 12, 46, 6, 46, "tyre", "ball"), b(303, F - 48, 6 + H + 25, 20, 4, 20, "rim", "ball")]
m += [b(130, 2, 50, 240, 4, 56, "sign"), b(150, 0, 70, 120, 2, 18, "letters"), b(290, -2, 54, 46, 6, 46, "tyre", "ball"), b(303, -4, 67, 20, 4, 20, "rim", "ball")]
m += [b(476, F + 20, 0, 12, 12, 250, "iron"), b(450, F + 10, 200, 46, 30, 80, "sign"), b(458, F + 6, 232, 30, 3, 30, "tyre", "ball"), b(458, F + 40, 232, 30, 3, 30, "tyre", "ball"),
      b(456, F + 6, 212, 34, 3, 12, "letters"), b(456, F + 40, 212, 34, 3, 12, "letters")]
m += [b(14, F + 6, z, 40, 40, 16, "tyre", "cyl") for z in (0, 16, 32, 48)] + [b(24, F + 16, 64, 20, 20, 4, "rim", "cyl")]
m += [b(64, F + 10, 0, 30, 30, 44, "drum", "cyl"), b(64, F + 10, 44, 30, 30, 3, "rim", "cyl")]
shop("car_service", "СТО", 5, 4, F, m, {
    "wall": slot("stone", 1), "roof_flat": fc(CHARCOAL), "trim": slot("ceramic", 0), "door": slot("metal", 2), "glass": slot("glass", 1),
    "bay": slot("metal", 0), "bay_line": slot("stone", 2), "check_a": slot("ceramic", 0), "check_b": fc(CHARCOAL), "sign": fc(TOMATO),
    "letters": slot("ceramic", 0), "tyre": slot("ceramic", 5), "rim": slot("metal", 0), "drum": slot("fabric", 6)})

# ---- the driving school «Автошкола»: pale blue under a single slope rising to the street, a traffic light at
# the corner, the red learner's triangle and a sign over the door -----------------------------------------------
W, D, F, H = 400, 300, 256, 104
m = _shell(W, D, F, H) + _door(W, F) + _back_door(W, H) + facade_windows(W, F + 10, 46, front=False)
m += shed_roof(-6, -6, 6 + H, W + 12, F + 20, 64)
m += [b(-6, F + 6, 6 + H + 56, W + 12, 10, 10, "trim")]
for x0 in (30, 260):
    m += _win(x0, 22, 110, 66, F, panes=3)
m += [b(W // 2 - 80, F, 104, 160, 6, 24, "sign", "round"), b(W // 2 - 60, F + 6, 112, 90, 2, 10, "letters"), b(W // 2 + 40, F + 6, 104, 26, 4, 26, "tri", "cone")]
m += [b(372, F + 22, 0, 8, 8, 110, "iron", "cyl"), b(364, F + 18, 110, 24, 14, 60, "light_box")]
m += [b(368, F + 30, 152 - k * 18, 16, 4, 14, c, "ball") for k, c in enumerate(("red", "amber", "green"))]
m += [b(20, F + 14, 0, 18, 18, 30, "cone_", "cone"), b(16, F + 10, 0, 26, 26, 4, "cone_"), b(50, F + 20, 0, 16, 16, 26, "cone_", "cone")]
shop("driving_school", "Автошкола", 4, 3, F, m, {
    "wall": slot("pastel", 1), "roof": fc(NAVY), "trim": slot("ceramic", 0), "door": slot("fabric", 6), "glass": slot("glass", 2), "sign": slot("ceramic", 0),
    "letters": slot("fabric", 6), "tri": slot("fabric", 1), "light_box": fc(CHARCOAL), "red": slot("fabric", 1), "amber": slot("autumn", 1),
    "green": slot("leaf", 1), "cone_": slot("autumn", 0)})
