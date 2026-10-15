#!/usr/bin/env python3
"""Authoring tool: writes content/base/pack.json. The JSON is the source of truth; this script only
makes the (long) catalog easy to maintain. Boxes are [x, y, z, w, d, h] in hundredths of a tile,
relative to the item's footprint origin. For wall items x runs along the wall, y is the distance
from the wall, z is the height."""
import json
import pathlib

PALETTES = {
    "fabric": ["#3f8c94", "#d9534f", "#e8a23a", "#8a63c9", "#5aa469", "#e8e0c8", "#4a8fd0", "#d86aa0"],
    "wood": ["#8a5a2e", "#a8743c", "#6a4528", "#c9a050", "#e8e0c8", "#3a2a40"],
    "metal": ["#c0c4cc", "#f4b860", "#3a2a40", "#d9534f"],
    "pastel": ["#ffd9d9", "#d9f0ff", "#e0ffd9", "#fff2c0", "#e9d9ff"],
    "leaf": ["#3f7f4a", "#5aa469", "#4a9458", "#7ab87a"],
    "pot": ["#c8553d", "#d9684d", "#e8e0c8", "#6a4528"],
    "ceramic": ["#f2efe6", "#e8e0c8", "#cfd8e8", "#f4d6d6", "#d6ecdc", "#3a3a44"],
    "glass": ["#cfe8f5", "#a8d8ea", "#e8f4f8", "#d6f0e6"],
    "fabric_pink": ["#f4b6c8", "#ffd6e4", "#e8a0b8", "#ffffff"],
    "autumn": ["#d9662e", "#e8a23a", "#c8423a", "#f4d35e"],
    "earth": ["#5a3a24", "#6a4528", "#3e2a1c", "#7a5238"],
    "stone": ["#8a8490", "#a09aa6", "#6a6470", "#57525c"],
    "skin": ["#e8b48a", "#c68a5e", "#8d5a3b", "#f2cfae"],
}

items = []


def slot(palette, i=0):
    return {"default": PALETTES[palette][i], "palette": palette}


def b(x, y, z, w, d, h, s, shape=None):
    out = {"box": [x, y, z, w, d, h], "slot": s}
    if shape and shape != "box":
        out["shape"] = shape
    return out


def item(id, category, w, d, layer, model, slots, acquire, actions=None, surface=False, name=None):
    it = {
        "id": id,
        "name": name or f"item.{id}",
        "category": category,
        "footprint": {"w": w, "d": d},
        "layer": layer,
        "model": model,
        "slots": slots,
        "acquire": acquire,
    }
    if actions:
        it["actions"] = actions
    if surface:
        it["rules"] = {"provides_surface": True}
    items.append(it)


def coins(n):
    return {"coins": n}


def action(kind, count):
    return {"action": {"kind": kind, "count": count}}


def token(kind, n):
    return {"token": {"kind": kind, "n": n}}


# ---- helpers for richer models

def legs4(w, d, h, size=10, inset=8, slot="legs", shape="cyl", z=0):
    xs = [inset, w - inset - size]
    ys = [inset, d - inset - size]
    return [b(x, y, z, size, size, h, slot, shape) for x in xs for y in ys]


def pot(x, y, w, h, slot="pot"):
    """A flower pot with a lip."""
    return [b(x + 4, y + 4, 0, w - 8, w - 8, h - 4, slot, "cyl"), b(x, y, h - 6, w, w, 6, slot, "cyl"), b(x + 6, y + 6, h - 1, w - 12, w - 12, 2, "soil", "cyl")]


def books(x0, x1, y, z, depth, slots, seed):
    out = []
    x = x0
    i = 0
    while x < x1 - 6:
        w = 7 + (seed * 7 + i * 5) % 6
        h = 24 + (seed * 3 + i * 11) % 12
        if x + w > x1:
            break
        out.append(b(x, y, z, w, depth, h, slots[(i + seed) % len(slots)]))
        x += w + 1
        i += 1
    return out


SOIL = slot("wood", 5)

# ---- seating
item("stool", "seating", 1, 1, "floor",
     legs4(100, 100, 34, 8, 18, "legs") + [b(18, 18, 14, 64, 64, 4, "legs", "cyl"), b(12, 12, 34, 76, 76, 8, "legs", "cyl"), b(15, 15, 42, 70, 70, 7, "cushion", "cyl")],
     {"legs": slot("wood"), "cushion": slot("fabric")}, coins(25), ["sit"])
item("chair", "seating", 1, 1, "floor",
     legs4(100, 100, 38, 8, 10, "legs", "box") + [b(10, 10, 38, 80, 80, 6, "legs"), b(13, 14, 44, 74, 72, 7, "cushion", "round"),
      b(10, 10, 44, 8, 8, 50, "legs"), b(82, 10, 44, 8, 8, 50, "legs"), b(10, 10, 86, 80, 8, 12, "legs", "round"),
      b(30, 12, 52, 6, 4, 34, "legs"), b(47, 12, 52, 6, 4, 34, "legs"), b(64, 12, 52, 6, 4, 34, "legs")],
     {"legs": slot("wood"), "cushion": slot("fabric", 1)}, coins(45), ["sit"])
item("armchair", "seating", 1, 1, "floor",
     legs4(100, 100, 8, 9, 6, "legs") + [b(0, 0, 8, 100, 100, 28, "body", "round"),
      b(0, 0, 36, 100, 24, 52, "body", "round"), b(0, 22, 36, 17, 78, 24, "body", "round"), b(83, 22, 36, 17, 78, 24, "body", "round"),
      b(17, 26, 36, 66, 72, 12, "cushion", "round"), b(17, 22, 48, 66, 12, 34, "cushion", "round")],
     {"body": slot("fabric", 3), "cushion": slot("fabric", 5), "legs": slot("wood", 2)}, coins(90), ["sit", "rest"])
for name, width, price, acts in [("sofa2", 2, 120, ["sit"]), ("sofa3", 3, 180, ["sit", "rest"])]:
    w = width * 100
    seat = [b(20 + i * ((w - 40) // width), 26, 36, (w - 40) // width - 2, 72, 12, "cushion", "round") for i in range(width)]
    backc = [b(20 + i * ((w - 40) // width), 22, 48, (w - 40) // width - 2, 12, 34, "cushion", "round") for i in range(width)]
    extra = [b(24, 34, 48, 24, 12, 22, "pillow", "round"), b(w - 48, 34, 48, 24, 12, 22, "pillow", "round")] if width == 3 else []
    item(name, "seating", width, 1, "floor",
         legs4(w, 100, 8, 10, 6, "legs") + [b(0, 0, 8, w, 100, 28, "body", "round"), b(0, 0, 36, w, 22, 54, "body", "round"),
          b(0, 22, 36, 20, 78, 26, "body", "round"), b(w - 20, 22, 36, 20, 78, 26, "body", "round")] + seat + backc + extra,
         {"body": slot("fabric"), "cushion": slot("fabric", 5), "legs": slot("wood", 2), "pillow": slot("fabric", 7)}, coins(price), acts)
item("bench", "seating", 2, 1, "floor",
     [b(14, 20, 0, 12, 60, 34, "wood"), b(174, 20, 0, 12, 60, 34, "wood"), b(26, 46, 10, 148, 8, 6, "wood"),
      b(4, 14, 34, 192, 72, 7, "wood", "round"), b(10, 20, 41, 180, 60, 6, "cushion", "round")],
     {"wood": slot("wood", 1), "cushion": slot("fabric", 2)}, coins(60), ["sit"])
item("bean_bag", "seating", 1, 1, "floor",
     [b(6, 6, 0, 88, 88, 40, "body", "ball"), b(14, 10, 22, 64, 40, 40, "body", "ball"), b(30, 44, 30, 40, 36, 14, "body", "ball")],
     {"body": slot("fabric", 2)}, coins(70), ["sit", "rest"])
item("rocking_chair", "seating", 1, 1, "floor",
     [b(14, 0, 0, 8, 100, 6, "wood", "round"), b(78, 0, 0, 8, 100, 6, "wood", "round")] + legs4(100, 100, 18, 8, 14, "wood", "cyl", 6) +
     [b(10, 14, 24, 80, 72, 6, "wood"), b(14, 18, 30, 72, 64, 8, "cushion", "round"), b(10, 14, 30, 8, 8, 60, "wood", "cyl"), b(82, 14, 30, 8, 8, 60, "wood", "cyl"),
      b(10, 14, 84, 80, 8, 10, "wood", "round"), b(30, 16, 38, 5, 4, 46, "wood"), b(47, 16, 38, 5, 4, 46, "wood"), b(64, 16, 38, 5, 4, 46, "wood")],
     {"wood": slot("wood", 3), "cushion": slot("fabric", 5)}, action("rest", 5), ["sit", "rest"])
item("bed", "seating", 2, 2, "floor",
     legs4(200, 200, 8, 12, 6, "frame") + [b(0, 0, 8, 200, 200, 20, "frame", "round"), b(0, 0, 28, 200, 14, 74, "frame", "round"), b(0, 186, 28, 200, 14, 22, "frame", "round"),
      b(8, 14, 28, 184, 172, 16, "sheet", "round"), b(8, 76, 44, 184, 110, 10, "blanket", "round"), b(8, 70, 50, 184, 12, 6, "sheet", "round"),
      b(22, 22, 44, 72, 42, 14, "pillow", "round"), b(106, 22, 44, 72, 42, 14, "pillow", "round")],
     {"frame": slot("wood"), "sheet": slot("fabric", 5), "blanket": slot("fabric", 6), "pillow": slot("pastel", 0)}, coins(200), ["rest"])

item("bar_stool", "seating", 1, 1, "floor",
     [b(26, 26, 0, 48, 48, 4, "legs", "cyl"), b(45, 45, 4, 10, 10, 54, "legs", "cyl"), b(30, 30, 22, 40, 40, 3, "legs", "cyl"),
      b(22, 22, 56, 56, 56, 6, "legs", "cyl"), b(20, 20, 62, 60, 60, 8, "cushion", "cyl")],
     {"legs": slot("metal"), "cushion": slot("fabric", 0)}, coins(40), ["sit"])
item("pouf", "seating", 1, 1, "floor", [b(12, 12, 0, 76, 76, 28, "body", "cyl"), b(14, 14, 26, 72, 72, 8, "body", "ball"), b(46, 46, 32, 8, 8, 4, "button", "ball")],
     {"body": slot("fabric", 7), "button": slot("fabric", 5)}, coins(35), ["sit"])
item("sofa_l", "seating", 2, 2, "floor",
     [b(x, y, 0, 10, 10, 8, "legs", "cyl") for x, y in ((6, 6), (184, 6), (6, 184), (84, 184), (184, 84))] + [b(0, 0, 8, 200, 100, 28, "body", "round"), b(0, 100, 8, 100, 100, 28, "body", "round"),
      b(0, 0, 36, 200, 22, 54, "body", "round"), b(0, 22, 36, 22, 178, 54, "body", "round"), b(178, 22, 36, 22, 78, 26, "body", "round"),
      b(22, 26, 36, 76, 72, 12, "cushion", "round"), b(100, 26, 36, 76, 72, 12, "cushion", "round"), b(26, 100, 36, 72, 96, 12, "cushion", "round"),
      b(26, 40, 48, 26, 14, 22, "pillow", "round"), b(150, 26, 48, 24, 12, 22, "pillow", "round")],
     {"body": slot("fabric", 4), "cushion": slot("fabric", 5), "legs": slot("wood", 2), "pillow": slot("fabric", 7)}, coins(260), ["sit", "rest"])
item("window_seat", "seating", 2, 1, "floor",
     [b(0, 0, 0, 200, 94, 36, "wood"), b(8, 92, 6, 88, 2, 24, "front"), b(104, 92, 6, 88, 2, 24, "front"), b(4, 4, 36, 192, 88, 12, "cushion", "round"),
      b(10, 8, 48, 40, 14, 26, "pillow", "round"), b(150, 8, 48, 40, 14, 26, "pillow", "round")],
     {"wood": slot("wood", 4), "front": slot("wood", 1), "cushion": slot("fabric", 5), "pillow": slot("fabric", 6)}, coins(150), ["sit", "rest"])

# ---- tables (surfaces): nothing may stand above the top, which is the surface height
item("side_table", "tables", 1, 1, "floor",
     [b(24, 24, 0, 52, 52, 6, "wood", "cyl"), b(42, 42, 6, 16, 16, 40, "wood", "cyl"), b(6, 6, 46, 88, 88, 7, "wood", "cyl")],
     {"wood": slot("wood")}, coins(35), surface=True)
item("coffee_table", "tables", 2, 1, "floor",
     legs4(200, 100, 30, 10, 12, "wood") + [b(14, 18, 10, 172, 64, 4, "wood"), b(4, 8, 30, 192, 84, 8, "top", "round")],
     {"wood": slot("wood", 1), "top": slot("wood", 3)}, coins(70), surface=True)
item("dining_table", "tables", 3, 2, "floor",
     legs4(300, 200, 46, 14, 14, "wood") + [b(12, 12, 40, 276, 176, 8, "wood"), b(0, 0, 48, 300, 200, 8, "top", "round")],
     {"wood": slot("wood", 2), "top": slot("wood", 3)}, coins(140), surface=True)
item("desk", "tables", 2, 1, "floor",
     [b(4, 6, 0, 62, 88, 50, "wood"), b(10, 94, 6, 50, 2, 12, "front"), b(10, 94, 20, 50, 2, 12, "front"), b(10, 94, 34, 50, 2, 12, "front"),
      b(30, 96, 10, 10, 2, 3, "metal"), b(30, 96, 24, 10, 2, 3, "metal"), b(30, 96, 38, 10, 2, 3, "metal"),
      b(184, 6, 0, 12, 88, 50, "wood"), b(66, 10, 36, 118, 6, 14, "wood"), b(0, 0, 50, 200, 100, 6, "top", "round")],
     {"wood": slot("wood", 3), "front": slot("wood", 1), "metal": slot("metal", 1), "top": slot("wood", 1)}, coins(110), surface=True)
item("round_table", "tables", 2, 2, "floor",
     [b(54, 54, 0, 92, 92, 8, "wood", "cyl"), b(84, 84, 8, 32, 32, 40, "wood", "cyl"), b(4, 4, 48, 192, 192, 8, "top", "cyl")],
     {"wood": slot("wood", 1), "top": slot("wood", 3)}, coins(100), surface=True)
item("console", "tables", 2, 1, "floor",
     legs4(200, 100, 46, 8, 24, "wood") + [b(26, 30, 12, 148, 40, 4, "wood"), b(0, 20, 46, 200, 60, 6, "wood", "round")],
     {"wood": slot("wood", 2)}, coins(80), surface=True)
item("nightstand", "tables", 1, 1, "floor",
     legs4(100, 100, 6, 8, 10, "wood") + [b(8, 8, 6, 84, 84, 42, "wood", "round"), b(16, 90, 12, 68, 3, 14, "front"), b(16, 90, 30, 68, 3, 14, "front"),
      b(44, 92, 17, 12, 3, 4, "trim"), b(44, 92, 35, 12, 3, 4, "trim"), b(5, 5, 48, 90, 90, 5, "wood", "round")],
     {"wood": slot("wood", 4), "front": slot("wood", 1), "trim": slot("metal", 1)}, coins(45), surface=True)
item("kotatsu", "tables", 2, 2, "floor",
     [b(4, 4, 0, 192, 192, 36, "blanket", "round"), b(20, 196, 0, 40, 4, 2, "blanket"), b(0, 0, 36, 200, 200, 6, "wood", "round"), b(16, 16, 42, 168, 168, 3, "top", "round")],
     {"wood": slot("wood", 3), "blanket": slot("fabric", 3), "top": slot("wood", 4)}, {"all": [token("leaf", 2), coins(120)]}, ["rest"], surface=True)

# ---- storage
item("bookshelf", "storage", 2, 1, "floor",
     [b(8, 0, 8, 184, 6, 132, "wood"), b(0, 0, 0, 8, 100, 140, "wood"), b(192, 0, 0, 8, 100, 140, "wood"), b(8, 0, 0, 184, 100, 8, "wood"),
      b(8, 6, 50, 184, 94, 4, "wood"), b(8, 6, 96, 184, 94, 4, "wood")]
     + books(12, 188, 16, 8, 74, ["books", "books2", "books3"], 1) + books(12, 150, 16, 54, 74, ["books2", "books3", "books"], 2)
     + books(12, 120, 16, 100, 74, ["books3", "books", "books2"], 3) + [b(140, 30, 100, 30, 30, 24, "books", "ball"), b(0, 0, 140, 200, 100, 6, "wood", "round")],
     {"wood": slot("wood", 2), "books": slot("fabric", 1), "books2": slot("fabric", 6), "books3": slot("fabric", 4)}, coins(95), ["read"])
item("wardrobe", "storage", 2, 1, "floor",
     [b(4, 4, 0, 192, 88, 8, "wood"), b(0, 0, 8, 200, 94, 144, "wood"), b(8, 94, 18, 89, 2, 126, "door"), b(103, 94, 18, 89, 2, 126, "door"),
      b(88, 96, 70, 4, 3, 24, "trim", "round"), b(108, 96, 70, 4, 3, 24, "trim", "round"), b(0, 0, 152, 200, 98, 8, "wood", "round")],
     {"wood": slot("wood"), "door": slot("wood", 1), "trim": slot("metal")}, coins(150))
item("dresser", "storage", 2, 1, "floor",
     legs4(200, 94, 8, 10, 8, "wood") + [b(0, 0, 8, 200, 92, 62, "wood")]
     + [b(x, 92, z, 92, 2, 16, "front") for x in (6, 102) for z in (14, 34, 54)]
     + [b(x + 40, 94, z + 6, 10, 5, 6, "trim", "ball") for x in (6, 102) for z in (14, 34, 54)] + [b(0, 0, 70, 200, 98, 5, "top", "round")],
     {"wood": slot("wood", 1), "front": slot("wood", 4), "trim": slot("metal", 1), "top": slot("wood", 3)}, coins(110), surface=True)
item("shelf_low", "storage", 2, 1, "floor",
     [b(0, 0, 0, 200, 60, 50, "wood", "round"), b(8, 56, 8, 56, 4, 34, "inside"), b(72, 56, 8, 56, 4, 34, "inside"), b(136, 56, 8, 56, 4, 34, "inside"),
      b(14, 50, 8, 44, 8, 22, "basket", "round"), b(142, 50, 8, 44, 8, 22, "basket", "round")],
     {"wood": slot("wood", 4), "inside": slot("wood", 5), "basket": slot("fabric", 5)}, coins(60), surface=True)
item("chest", "storage", 1, 1, "floor",
     [b(5, 15, 0, 90, 70, 36, "wood", "round"), b(3, 13, 36, 94, 74, 12, "wood", "round"), b(18, 13, 0, 8, 74, 48, "trim"), b(74, 13, 0, 8, 74, 48, "trim"),
      b(44, 85, 26, 12, 3, 14, "trim", "round")],
     {"wood": slot("wood", 2), "trim": slot("metal", 1)}, coins(50), surface=True)
item("cabinet_glass", "storage", 1, 1, "floor",
     [b(8, 12, 0, 84, 76, 8, "wood"), b(5, 10, 8, 90, 80, 132, "wood"), b(12, 88, 18, 76, 2, 112, "glass"), b(12, 89, 72, 76, 2, 3, "wood"),
      b(80, 90, 70, 4, 3, 14, "wood", "round"), b(3, 8, 140, 94, 84, 6, "wood", "round")],
     {"wood": slot("wood", 1), "glass": slot("pastel", 1)}, coins(130))
item("tv_stand", "storage", 2, 1, "floor",
     legs4(200, 100, 6, 8, 14, "wood") + [b(0, 10, 6, 200, 80, 38, "wood"), b(8, 88, 12, 88, 2, 26, "front"), b(104, 88, 12, 88, 2, 26, "front"),
      b(86, 90, 22, 6, 2, 6, "trim"), b(108, 90, 22, 6, 2, 6, "trim"), b(0, 10, 44, 200, 80, 4, "top", "round")],
     {"wood": slot("wood", 5), "front": slot("wood", 1), "trim": slot("metal", 1), "top": slot("wood", 3)}, coins(90), surface=True)
item("toy_box", "storage", 1, 1, "floor",
     [b(10, 15, 0, 80, 70, 36, "body", "round"), b(8, 13, 36, 84, 74, 6, "trim", "round"), b(40, 84, 12, 20, 2, 16, "trim", "round")],
     {"body": slot("fabric", 1), "trim": slot("fabric", 5)}, coins(55), surface=True)

# ---- lighting
item("floor_lamp", "lighting", 1, 1, "floor",
     [b(28, 28, 0, 44, 44, 5, "metal", "cyl"), b(47, 47, 5, 6, 6, 104, "metal", "cyl"), b(44, 44, 100, 12, 12, 10, "bulb", "ball"), b(20, 20, 102, 60, 60, 36, "shade", "cone")],
     {"metal": slot("metal", 2), "shade": slot("pastel", 3), "bulb": slot("pastel", 3)}, coins(40))
item("table_lamp", "lighting", 1, 1, "surface",
     [b(30, 30, 0, 40, 40, 24, "metal", "ball"), b(46, 46, 22, 8, 8, 8, "metal", "cyl"), b(18, 18, 28, 64, 64, 30, "shade", "cone")],
     {"metal": slot("metal"), "shade": slot("pastel", 3)}, coins(30))
item("lantern", "lighting", 1, 1, "floor",
     [b(24, 24, 0, 52, 52, 8, "metal", "cyl"), b(30, 30, 8, 40, 40, 34, "glass", "cyl"), b(42, 42, 14, 16, 16, 18, "flame", "ball"),
      b(22, 22, 42, 56, 56, 14, "metal", "cone"), b(46, 46, 56, 8, 8, 10, "metal", "round")],
     {"metal": slot("metal", 2), "glass": slot("pastel", 3), "flame": slot("pastel", 3)}, action("brew_tea", 5))
item("wall_lamp", "lighting", 1, 1, "wall",
     [b(40, 0, 104, 20, 4, 30, "metal", "round"), b(47, 4, 114, 6, 20, 6, "metal"), b(30, 16, 92, 40, 34, 28, "shade", "cone"), b(44, 26, 92, 12, 12, 8, "bulb", "ball")],
     {"metal": slot("metal", 1), "shade": slot("pastel", 3), "bulb": slot("pastel", 3)}, coins(45))
item("candle", "lighting", 1, 1, "surface",
     [b(28, 28, 0, 44, 44, 6, "metal", "cyl"), b(40, 40, 6, 20, 20, 24, "wax", "cyl"), b(46, 46, 30, 8, 8, 12, "flame", "ball")],
     {"metal": slot("metal", 1), "wax": slot("pastel", 3), "flame": slot("pastel", 3)}, coins(12))
item("lava_lamp", "lighting", 1, 1, "surface",
     [b(30, 30, 0, 40, 40, 14, "metal", "cone"), b(36, 36, 14, 28, 28, 40, "glow", "cyl"), b(40, 40, 54, 20, 20, 8, "metal", "cyl")],
     {"metal": slot("metal"), "glow": slot("pastel", 0)}, coins(45))
item("floor_orb", "lighting", 1, 1, "floor",
     [b(26, 26, 0, 48, 48, 8, "metal", "cyl"), b(12, 12, 8, 76, 76, 70, "glow", "ball")],
     {"metal": slot("metal", 2), "glow": slot("pastel", 3)}, coins(70))
sag = [146, 138, 134, 138, 146]
item("string_lights", "lighting", 2, 1, "wall",
     [b(5, 0, 150, 190, 3, 3, "wire")] + [b(18 + i * 38, 0, sag[i] - 2, 6, 3, 4, "wire") for i in range(5)] + [b(16 + i * 38, 2, sag[i] - 14, 10, 8, 12, "bulb", "ball") for i in range(5)],
     {"wire": slot("metal", 2), "bulb": slot("pastel", 3)}, coins(60))
item("neon_sign", "lighting", 2, 1, "wall",
     [b(10, 0, 70, 180, 4, 56, "frame", "round")] + [b(26 + i * 28, 4, 96 + (6 if i % 2 else 0), 30, 4, 5, "glow", "round") for i in range(5)]
     + [b(40, 4, 82, 120, 4, 4, "glow", "round"), b(150, 4, 108, 10, 4, 10, "glow", "ball")],
     {"frame": slot("metal", 2), "glow": slot("pastel", 4)}, coins(110))
item("fireplace", "lighting", 2, 1, "floor",
     [b(0, 0, 0, 200, 92, 110, "stone"), b(36, 86, 6, 128, 6, 70, "hole"), b(60, 86, 6, 80, 10, 8, "log", "cyl"),
      b(66, 86, 10, 24, 12, 30, "fire", "ball"), b(88, 86, 10, 26, 12, 40, "fire", "ball"), b(112, 86, 10, 24, 12, 28, "fire", "ball"),
      b(28, 88, 0, 144, 8, 6, "stone", "round"), b(0, 0, 110, 200, 100, 10, "mantel", "round")],
     {"stone": slot("metal", 0), "hole": slot("wood", 5), "log": slot("wood", 2), "fire": slot("pastel", 3), "mantel": slot("wood", 2)},
     {"all": [coins(300), token("leaf", 4)]}, ["rest"])

# ---- decor (mostly on surfaces)
item("cup", "decor", 1, 1, "surface", [b(32, 32, 0, 36, 36, 4, "saucer", "cyl"), b(38, 38, 4, 24, 24, 16, "cup", "cyl"), b(62, 46, 8, 8, 8, 8, "cup", "round")],
     {"cup": slot("pastel", 1), "saucer": slot("pastel", 4)}, coins(4), ["brew_tea"])
item("teapot", "decor", 1, 1, "surface",
     [b(18, 18, 0, 64, 64, 40, "pot", "ball"), b(78, 44, 14, 16, 10, 10, "pot", "round"), b(6, 44, 10, 12, 10, 24, "pot", "round"),
      b(34, 34, 34, 32, 32, 6, "lid", "cyl"), b(45, 45, 40, 10, 10, 8, "lid", "ball")],
     {"pot": slot("pastel", 4), "lid": slot("metal")}, action("brew_tea", 3), ["brew_tea"])
item("book_stack", "decor", 1, 1, "surface",
     [b(15, 15, 0, 70, 60, 9, "b1", "round"), b(20, 18, 9, 60, 54, 8, "b2", "round"), b(17, 22, 17, 64, 48, 7, "b3", "round")],
     {"b1": slot("fabric", 3), "b2": slot("fabric", 5), "b3": slot("fabric", 1)}, coins(8), ["read"])
item("globe", "decor", 1, 1, "surface",
     [b(30, 30, 0, 40, 40, 6, "base", "cyl"), b(47, 47, 6, 6, 6, 14, "base", "cyl"), b(22, 22, 18, 56, 56, 52, "globe", "ball"), b(46, 46, 68, 8, 8, 6, "base", "ball")],
     {"base": slot("wood"), "globe": slot("fabric", 6)}, coins(55))
item("music_box", "decor", 1, 1, "surface",
     [b(15, 20, 0, 70, 60, 24, "wood", "round"), b(13, 18, 24, 74, 64, 6, "trim", "round"), b(85, 46, 8, 10, 6, 6, "trim", "round")],
     {"wood": slot("wood", 3), "trim": slot("metal", 1)}, {"all": [token("page", 2), coins(40)]})
item("vase", "decor", 1, 1, "surface",
     [b(28, 28, 0, 44, 44, 36, "vase", "ball"), b(39, 39, 30, 22, 22, 16, "vase", "cyl"), b(36, 28, 46, 14, 14, 12, "flower", "ball"),
      b(50, 42, 50, 14, 14, 12, "flower", "ball"), b(38, 50, 44, 12, 12, 10, "flower", "ball")],
     {"vase": slot("pastel", 4), "flower": slot("fabric", 7)}, action("water_plant", 5))
item("cat_bed", "decor", 1, 1, "floor",
     [b(4, 4, 0, 76, 76, 18, "bed", "cyl"), b(14, 14, 8, 56, 56, 12, "cushion", "cyl"), b(72, 72, 0, 24, 24, 6, "dish", "cyl")],
     {"bed": slot("fabric", 1), "cushion": slot("fabric", 2), "dish": slot("metal")}, coins(40), ["feed_cat"])
item("tv", "decor", 1, 1, "surface",
     [b(36, 42, 0, 28, 16, 4, "frame", "round"), b(46, 46, 4, 8, 8, 12, "frame"), b(4, 44, 14, 92, 12, 58, "frame", "round"), b(8, 56, 18, 84, 2, 50, "screen")],
     {"frame": slot("metal", 2), "screen": slot("pastel", 1)}, coins(160), ["listen"])
item("radio", "decor", 1, 1, "surface",
     [b(12, 28, 0, 76, 40, 36, "body", "round"), b(18, 67, 6, 40, 2, 24, "grill"), b(62, 64, 12, 14, 6, 14, "metal", "ball"), b(76, 40, 36, 3, 3, 30, "metal", "cyl")],
     {"body": slot("wood", 3), "grill": slot("metal", 1), "metal": slot("metal")}, coins(55), ["listen"])
item("photo_frame", "decor", 1, 1, "surface", [b(25, 40, 0, 50, 12, 4, "frame", "round"), b(25, 46, 4, 50, 6, 56, "frame", "round"), b(31, 52, 10, 38, 1, 44, "art")],
     {"frame": slot("wood", 1), "art": slot("pastel", 2)}, coins(18))
item("teddy", "decor", 1, 1, "surface",
     [b(26, 30, 0, 48, 42, 40, "fur", "ball"), b(36, 56, 6, 28, 18, 24, "belly", "ball"), b(28, 30, 34, 44, 40, 36, "fur", "ball"),
      b(26, 36, 62, 14, 10, 14, "fur", "ball"), b(60, 36, 62, 14, 10, 14, "fur", "ball"), b(42, 58, 42, 16, 10, 12, "belly", "ball")],
     {"fur": slot("fabric", 5), "belly": slot("pastel", 3)}, coins(30))
item("trophy", "decor", 1, 1, "surface",
     [b(28, 28, 0, 44, 44, 10, "base", "round"), b(44, 44, 10, 12, 12, 14, "gold", "cyl"), b(30, 30, 24, 40, 40, 26, "gold", "cyl"),
      b(20, 46, 32, 10, 8, 14, "gold", "round"), b(70, 46, 32, 10, 8, 14, "gold", "round")],
     {"base": slot("wood", 2), "gold": slot("metal", 1)}, action("brew_tea", 8))
item("aquarium", "decor", 2, 1, "floor",
     [b(0, 0, 0, 200, 100, 34, "stand"), b(6, 8, 34, 188, 84, 8, "gravel"), b(14, 20, 40, 16, 16, 34, "plant", "ball"), b(36, 26, 40, 12, 12, 24, "plant", "ball"),
      b(150, 30, 40, 22, 22, 28, "plant", "ball"), b(80, 44, 54, 16, 8, 8, "fish", "ball"), b(120, 56, 68, 14, 8, 7, "fish", "ball"),
      b(4, 6, 34, 192, 88, 62, "water"), b(2, 4, 96, 196, 92, 4, "stand")],
     {"stand": slot("wood", 5), "water": slot("pastel", 1), "gravel": slot("pot", 3), "plant": slot("leaf", 2), "fish": slot("fabric", 1)}, coins(220), ["feed_cat"])
item("easel", "decor", 1, 1, "floor",
     [b(47, 18, 0, 6, 6, 110, "wood"), b(18, 40, 0, 6, 6, 124, "wood"), b(76, 40, 0, 6, 6, 124, "wood"), b(12, 42, 40, 76, 14, 4, "wood"),
      b(16, 46, 44, 68, 4, 62, "canvas"), b(22, 50, 60, 24, 1, 20, "paint", "round"), b(50, 50, 72, 26, 1, 16, "paint2", "round")],
     {"wood": slot("wood", 2), "canvas": slot("pastel", 3), "paint": slot("fabric", 6), "paint2": slot("fabric", 1)}, coins(75), ["paint"])
item("piano", "decor", 2, 1, "floor",
     [b(0, 0, 0, 200, 60, 104, "body", "round"), b(4, 86, 0, 8, 8, 58, "body"), b(188, 86, 0, 8, 8, 58, "body"), b(0, 60, 58, 200, 32, 10, "body"),
      b(6, 64, 68, 188, 22, 3, "keys")] + [b(10 + i * 13, 64, 71, 6, 12, 2, "black") for i in range(14) if i % 7 not in (2, 6)]
     + [b(60, 52, 80, 80, 4, 18, "body"), b(70, 56, 82, 60, 2, 14, "keys")],
     {"body": slot("wood", 5), "keys": slot("pastel", 3), "black": slot("metal", 2)}, {"all": [coins(350), token("page", 3)]}, ["play_music"])

# ---- plants
def plant(id, price_or_acquire, layer, model, extra_slots=None, acts=None):
    slots = {"pot": slot("pot"), "leaf": slot("leaf"), "soil": SOIL}
    slots.update(extra_slots or {})
    item(id, "plants", 1, 1, layer, model, slots, price_or_acquire, acts or ["water_plant"])


plant("fern", coins(10), "floor", pot(22, 22, 56, 30) + [b(8, 14, 30, 50, 46, 26, "leaf", "ball"), b(42, 18, 32, 50, 50, 30, "leaf", "ball"),
      b(18, 44, 28, 52, 48, 24, "leaf", "ball"), b(28, 26, 46, 44, 44, 28, "leaf", "ball")])
plant("cactus", coins(15), "floor", pot(26, 26, 48, 26) + [b(36, 36, 26, 28, 28, 56, "leaf", "cyl"), b(36, 36, 72, 28, 28, 16, "leaf", "ball"),
      b(20, 44, 44, 16, 12, 24, "leaf", "cyl"), b(20, 44, 64, 16, 12, 8, "leaf", "ball"), b(44, 44, 86, 12, 12, 8, "flower", "ball")], {"flower": slot("fabric", 7)})
plant("palm", coins(50), "floor", pot(22, 22, 56, 30) + [b(44, 44, 30, 12, 12, 70, "trunk", "cyl"), b(2, 12, 94, 60, 40, 16, "leaf", "ball"),
      b(36, 2, 96, 40, 60, 16, "leaf", "ball"), b(38, 40, 94, 60, 52, 16, "leaf", "ball"), b(10, 40, 92, 44, 56, 14, "leaf", "ball"), b(30, 30, 104, 40, 40, 18, "leaf", "ball")],
      {"trunk": slot("wood", 2)})
plant("bonsai", action("water_plant", 10), "surface", [b(16, 24, 0, 68, 52, 12, "pot", "round"), b(44, 44, 12, 10, 10, 22, "trunk", "cyl"),
      b(18, 26, 28, 44, 38, 20, "leaf", "ball"), b(44, 34, 34, 40, 34, 18, "leaf", "ball")], {"trunk": slot("wood", 2)})
plant("flower_pot", coins(12), "surface", pot(32, 32, 36, 18) + [b(30, 34, 18, 18, 18, 12, "leaf", "ball"), b(34, 30, 26, 14, 14, 12, "flower", "ball"),
      b(52, 44, 24, 14, 14, 12, "flower", "ball"), b(42, 50, 30, 12, 12, 10, "flower", "ball")], {"flower": slot("fabric", 7)})
plant("monstera", coins(65), "floor", pot(22, 22, 56, 30) + [b(46, 46, 30, 8, 8, 40, "stem", "cyl"), b(0, 20, 50, 56, 48, 14, "leaf", "ball"),
      b(44, 0, 62, 56, 50, 14, "leaf", "ball"), b(34, 44, 44, 60, 56, 14, "leaf", "ball"), b(20, 18, 80, 52, 46, 14, "leaf", "ball")], {"stem": slot("wood", 2)})
plant("ficus", coins(95), "floor", pot(22, 22, 56, 30) + [b(45, 45, 30, 10, 10, 80, "trunk", "cyl"), b(8, 8, 96, 84, 84, 44, "leaf", "ball"),
      b(24, 24, 128, 52, 52, 30, "leaf", "ball"), b(4, 32, 108, 40, 40, 26, "leaf", "ball")], {"trunk": slot("wood", 2)})
plant("succulent", coins(10), "surface", pot(30, 30, 40, 16) + [b(28, 28, 14, 44, 44, 14, "leaf", "ball"), b(38, 38, 22, 24, 24, 10, "leaf", "cone")])
plant("hanging_plant", coins(50), "wall", [b(46, 0, 168, 8, 22, 4, "stem"), b(48, 18, 130, 3, 3, 40, "stem"), b(28, 6, 104, 44, 40, 28, "pot", "cyl"),
      b(18, 4, 86, 64, 52, 30, "leaf", "ball"), b(20, 10, 68, 28, 24, 24, "leaf", "ball"), b(52, 14, 72, 26, 24, 22, "leaf", "ball")], {"stem": slot("metal")})

# ---- rugs
for name, w, d, price, idx in [("rug_small", 2, 2, 40, 1), ("rug_long", 3, 2, 65, 6), ("rug_runner", 1, 3, 45, 3), ("rug_big", 3, 3, 120, 2)]:
    W, D = w * 100, d * 100
    model = [b(0, 0, 0, W, D, 2, "border", "round"), b(12, 12, 2, W - 24, D - 24, 1, "rug"), b(24, 24, 3, W - 48, 6, 1, "accent"), b(24, D - 30, 3, W - 48, 6, 1, "accent")]
    if w >= 2 and d >= 2:
        model.append(b(W // 2 - 30, D // 2 - 30, 3, 60, 60, 1, "accent", "cyl"))
    item(name, "rugs", w, d, "rug", model, {"border": slot("fabric", 5), "rug": slot("fabric", idx), "accent": slot("fabric", 5)}, coins(price))
item("rug_round", "rugs", 2, 2, "rug", [b(0, 0, 0, 200, 200, 2, "border", "cyl"), b(14, 14, 2, 172, 172, 1, "rug", "cyl"), b(60, 60, 3, 80, 80, 1, "accent", "cyl")],
     {"border": slot("fabric", 5), "rug": slot("fabric", 2), "accent": slot("fabric", 5)}, coins(55))

# ---- wall items: x runs along the wall, y is the distance from it, z the height
item("painting_small", "wall", 1, 1, "wall",
     [b(10, 0, 40, 80, 6, 62, "frame", "round"), b(16, 6, 46, 68, 2, 50, "art"), b(16, 7, 46, 68, 2, 20, "art2"), b(56, 7, 72, 12, 2, 12, "art3", "ball")],
     {"frame": slot("wood", 2), "art": slot("pastel", 1), "art2": slot("leaf", 1), "art3": slot("pastel", 3)}, coins(25))
item("painting_wide", "wall", 2, 1, "wall",
     [b(10, 0, 40, 180, 6, 62, "frame", "round"), b(16, 6, 46, 168, 2, 50, "art"), b(16, 7, 46, 168, 2, 14, "art2"), b(60, 7, 46, 70, 3, 26, "art2", "round"),
      b(130, 8, 76, 14, 2, 14, "art3", "ball")],
     {"frame": slot("wood", 3), "art": slot("pastel", 2), "art2": slot("leaf", 0), "art3": slot("pastel", 3)}, coins(45))
item("mirror", "wall", 1, 1, "wall", [b(15, 0, 30, 70, 6, 112, "frame", "round"), b(21, 6, 36, 58, 2, 100, "glass")],
     {"frame": slot("metal", 1), "glass": slot("pastel", 1)}, coins(60))
item("wall_clock", "wall", 1, 1, "wall",
     [b(20, 0, 74, 60, 8, 60, "frame", "round"), b(25, 8, 79, 50, 2, 50, "face"), b(48, 10, 102, 4, 2, 20, "hands"), b(48, 10, 102, 16, 2, 4, "hands"), b(47, 11, 101, 6, 2, 6, "hands", "ball")],
     {"frame": slot("metal", 2), "face": slot("pastel", 3), "hands": slot("metal", 2)}, {"all": [token("leaf", 3), coins(60)]})
item("poster", "wall", 1, 1, "wall", [b(20, 0, 50, 60, 2, 90, "art"), b(20, 1, 50, 60, 2, 30, "art2"), b(30, 2, 92, 40, 1, 30, "art3", "round"),
     b(22, 2, 136, 8, 2, 4, "frame"), b(70, 2, 136, 8, 2, 4, "frame")],
     {"art": slot("pastel", 4), "art2": slot("fabric", 6), "art3": slot("pastel", 3), "frame": slot("metal", 1)}, coins(20))
item("banner", "wall", 1, 1, "wall", [b(25, 0, 40, 50, 4, 110, "cloth"), b(22, 0, 150, 56, 6, 4, "wood", "cyl"), b(30, 4, 54, 40, 2, 10, "trim"), b(44, 4, 30, 12, 2, 12, "trim", "round")],
     {"cloth": slot("fabric", 0), "wood": slot("wood", 2), "trim": slot("metal", 1)}, coins(35))
item("wall_shelf", "wall", 2, 1, "wall",
     [b(24, 0, 76, 6, 20, 14, "metal"), b(170, 0, 76, 6, 20, 14, "metal"), b(10, 0, 90, 180, 24, 6, "wood", "round")] + books(30, 110, 6, 96, 14, ["book", "book2"], 4)
     + [b(130, 6, 96, 20, 16, 14, "book2", "cyl"), b(132, 7, 108, 16, 14, 14, "book", "ball")],
     {"wood": slot("wood", 1), "metal": slot("metal", 2), "book": slot("fabric", 1), "book2": slot("fabric", 6)}, coins(55))
item("dreamcatcher", "wall", 1, 1, "wall", [b(25, 0, 62, 50, 3, 50, "ring", "round"), b(32, 2, 69, 36, 1, 36, "web"), b(30, 0, 30, 4, 3, 30, "feather"),
     b(48, 0, 22, 4, 3, 40, "feather"), b(66, 0, 30, 4, 3, 30, "feather"), b(44, 2, 84, 12, 2, 12, "bead", "ball")],
     {"ring": slot("wood", 3), "web": slot("pastel", 3), "feather": slot("pastel", 4), "bead": slot("fabric", 6)}, action("rest", 4))

# ---- openings: windows and doors are wall items like any other
def window(id, w, z, h, price, curtains=True, mullions=1, tall=False):
    W = w * 100
    model = [b(4, 8, z - 4, W - 8, 18, 6, "frame", "round"), b(10, 0, z, W - 20, 8, h, "frame"), b(18, 8, z + 8, W - 36, 2, h - 16, "glass")]
    for i in range(mullions):
        x = 10 + (W - 20) * (i + 1) // (mullions + 1) - 3
        model.append(b(x, 9, z + 8, 6, 3, h - 16, "frame"))
    if tall or h >= 100:
        model.append(b(18, 9, z + h // 2, W - 36, 3, 5, "frame"))
    if curtains:
        model += [b(0, 4, z + h + 10, W, 4, 4, "rod", "cyl"), b(0, 10, z - 6, 18, 6, h + 16, "curtain", "round"), b(W - 18, 10, z - 6, 18, 6, h + 16, "curtain", "round")]
    slots = {"frame": slot("wood", 4), "glass": slot("pastel", 1)}
    if curtains:
        slots.update({"curtain": slot("fabric", 5), "rod": slot("metal", 2)})
    item(id, "openings", w, 1, "wall", model, slots, price)


window("window_basic", 2, 50, 100, coins(30))
window("window_tall", 1, 30, 140, coins(40), curtains=False, mullions=0, tall=True)
window("window_wide", 3, 50, 100, coins(80), mullions=2)
item("window_round", "openings", 1, 1, "wall", [b(15, 0, 60, 70, 8, 70, "frame", "round"), b(22, 8, 67, 56, 2, 56, "glass"), b(47, 9, 67, 6, 3, 56, "frame"), b(22, 9, 92, 56, 3, 6, "frame")],
     {"frame": slot("metal", 1), "glass": slot("pastel", 1)}, coins(70))
# Doors are two cells of wall wide and about one and a half times the person's height, with a deep frame.
def door(id, w, price, panels, glass=False, arch=False):
    W = w * 100
    inner = W - 64
    model = [
        b(24, 0, 0, 14, 14, 176, "frame", "round" if arch else None), b(W - 38, 0, 0, 14, 14, 176, "frame", "round" if arch else None),
        b(20, 0, 164, W - 40, 16, 18, "frame", "round"), b(20, 0, 0, W - 40, 16, 4, "frame"),
    ]
    pw = inner // panels
    for i in range(panels):
        x = 32 + i * pw
        model += [b(x, 4, 0, pw - 2, 6, 164, "panel")]
        if glass:
            model += [b(x + 10, 10, 96, pw - 22, 2, 56, "glass"), b(x + pw // 2 - 2, 11, 96, 3, 2, 56, "panel")]
        else:
            model += [b(x + 10, 10, 96, pw - 22, 2, 54, "inset"), b(x + 10, 10, 14, pw - 22, 2, 66, "inset")]
        kx = x + pw - 16 if (i == panels - 1) else x + 6
        model += [b(kx, 10, 80, 8, 8, 8, "knob", "ball")]
    model += [b(16, 14, 0, W - 32, 12, 2, "mat", "round")]
    slots = {"frame": slot("wood", 4), "panel": slot("wood", 1), "inset": slot("wood", 3), "knob": slot("metal", 1), "mat": slot("fabric", 2)}
    if glass:
        slots["glass"] = slot("pastel", 1)
    item(id, "openings", w, 1, "wall", model, slots, price, ["enter"])


door("door_basic", 2, coins(35), 1)
door("door_arch", 2, coins(60), 1, glass=True, arch=True)
door("door_double", 3, coins(110), 2, glass=True)
door("door_garden", 2, coins(80), 1, glass=True)


# =========================================================================================================
# v4 catalogue: families of furniture for every room of a home. Names are Ukrainian literals.
# =========================================================================================================
EXTRA_TAGS = {}


def tag(id, *tags):
    EXTRA_TAGS[id] = list(tags)


# ---- living room ------------------------------------------------------------------------------------------
for w, price in [(2, 150), (3, 210)]:
    W = w * 100
    item(f"sofa_modern{w}", "seating", w, 1, "floor",
         [b(x, y, 0, 6, 6, 14, "legs", "cyl") for x in (8, W - 14) for y in (10, 84)]
         + [b(0, 4, 14, 22 // 1 if False else W, 92, 16, "body"), b(0, 4, 30, W, 22, 40, "body"), b(0, 26, 30, 12, 70, 18, "body"), b(W - 12, 26, 30, 12, 70, 18, "body")]
         + [b(14 + i * ((W - 28) // w), 28, 30, (W - 28) // w - 2, 66, 10, "cushion") for i in range(w)],
         {"body": slot("fabric", 6), "cushion": slot("fabric", 6), "legs": slot("metal", 2)}, coins(price), ["sit", "rest"], name=f"Модерн-диван {'малий' if w == 2 else ''}".strip())
item("chesterfield", "seating", 3, 1, "floor",
     legs4(300, 100, 8, 10, 8, "legs", "ball") + [b(0, 0, 8, 300, 100, 26, "body", "round"), b(0, 0, 34, 300, 24, 46, "body", "round"),
      b(0, 18, 34, 26, 82, 30, "body", "cyl"), b(274, 18, 34, 26, 82, 30, "body", "cyl"),
      b(26, 24, 34, 248, 74, 12, "cushion", "round")] + [b(30 + i * 30, 22, 52 + (i % 2) * 10, 4, 3, 4, "button", "ball") for i in range(8)],
     {"body": slot("fabric", 1), "cushion": slot("fabric", 1), "legs": slot("wood", 2), "button": slot("wood", 2)}, coins(320), ["sit", "rest"], name="Честерфілд")
item("loveseat", "seating", 2, 1, "floor",
     [b(4, 6, 0, 192, 90, 34, "body", "round"), b(4, 4, 34, 192, 26, 34, "body", "round"), b(20, 30, 34, 76, 62, 12, "cushion", "round"), b(104, 30, 34, 76, 62, 12, "cushion", "round")],
     {"body": slot("fabric", 7), "cushion": slot("fabric", 5)}, coins(160), ["sit", "rest"], name="Канапка")
item("wingback", "seating", 1, 1, "floor",
     legs4(100, 100, 10, 8, 8, "legs", "cyl") + [b(4, 6, 10, 92, 90, 24, "body", "round"), b(4, 4, 34, 92, 18, 70, "body", "round"),
      b(4, 20, 34, 16, 50, 46, "body", "round"), b(80, 20, 34, 16, 50, 46, "body", "round"), b(20, 24, 34, 60, 70, 12, "cushion", "round")],
     {"body": slot("fabric", 0), "cushion": slot("fabric", 5), "legs": slot("wood", 2)}, coins(130), ["sit", "rest"], name="Крісло з вухами")
item("egg_chair", "seating", 1, 1, "floor",
     [b(30, 30, 0, 40, 40, 6, "metal", "cyl"), b(46, 46, 6, 8, 8, 20, "metal", "cyl"), b(6, 6, 22, 88, 88, 80, "body", "ball"), b(22, 30, 40, 56, 62, 30, "cushion", "ball")],
     {"metal": slot("metal", 0), "body": slot("ceramic", 0), "cushion": slot("fabric", 2)}, coins(240), ["sit", "rest"], name="Крісло-яйце")
item("lounge_chair", "seating", 1, 1, "floor",
     [b(10, 4, 0, 6, 92, 6, "wood", "round"), b(84, 4, 0, 6, 92, 6, "wood", "round"), b(8, 10, 6, 84, 84, 12, "cushion", "round"), b(8, 6, 18, 84, 24, 40, "cushion", "round")],
     {"wood": slot("wood", 3), "cushion": slot("fabric", 4)}, coins(140), ["sit", "rest"], name="Лаунж-крісло")
item("rattan_chair", "seating", 1, 1, "floor",
     [b(10, 10, 0, 80, 80, 30, "rattan", "cyl"), b(6, 6, 30, 88, 88, 10, "rattan", "cyl"), b(10, 6, 40, 80, 30, 40, "rattan", "round"), b(18, 18, 40, 64, 64, 8, "cushion", "cyl")],
     {"rattan": slot("wood", 3), "cushion": slot("fabric", 5)}, coins(110), ["sit"], name="Плетене крісло")
item("ottoman", "seating", 1, 1, "floor", [b(14, 14, 0, 72, 72, 8, "legs"), b(10, 10, 8, 80, 80, 26, "body", "round"), b(46, 46, 34, 8, 8, 2, "body", "ball")],
     {"body": slot("fabric", 3), "legs": slot("wood", 5)}, coins(55), ["sit"], name="Оттоманка")
for i, col in enumerate([2, 0]):
    item(f"floor_cushion{i}", "seating", 1, 1, "floor", [b(12, 12, 0, 76, 76, 14, "body", "round"), b(44, 44, 14, 12, 12, 2, "body", "ball")],
         {"body": slot("fabric", col)}, coins(20), ["sit"], name=f"Подушка для підлоги {i + 1}")
item("glass_table", "tables", 2, 1, "floor",
     [b(10, 14, 0, 10, 72, 34, "metal"), b(180, 14, 0, 10, 72, 34, "metal"), b(10, 46, 10, 180, 8, 4, "metal"), b(0, 6, 34, 200, 88, 4, "glass")],
     {"metal": slot("metal", 2), "glass": slot("glass", 1)}, coins(120), surface=True, name="Скляний столик")
item("drum_table", "tables", 1, 1, "floor", [b(16, 16, 0, 68, 68, 40, "body", "cyl"), b(12, 12, 40, 76, 76, 6, "top", "cyl")],
     {"body": slot("fabric", 2), "top": slot("wood", 3)}, coins(60), surface=True, name="Барабан-столик")
item("crate_table", "tables", 1, 1, "floor",
     [b(8, 8, 0, 84, 84, 36, "wood"), b(8, 90, 6, 84, 2, 6, "slat"), b(8, 90, 18, 84, 2, 6, "slat"), b(90, 8, 6, 2, 84, 6, "slat"), b(90, 8, 18, 2, 84, 6, "slat")],
     {"wood": slot("wood", 1), "slat": slot("wood", 2)}, coins(30), surface=True, name="Ящик-столик")
item("media_console", "storage", 3, 1, "floor",
     legs4(300, 100, 10, 8, 12, "legs", "cyl") + [b(0, 10, 10, 300, 80, 34, "wood"), b(10, 88, 16, 88, 2, 22, "front"), b(106, 88, 16, 88, 2, 22, "front"), b(202, 88, 16, 88, 2, 22, "front"), b(0, 10, 44, 300, 80, 4, "top")],
     {"wood": slot("wood", 2), "front": slot("wood", 4), "legs": slot("metal", 2), "top": slot("wood", 3)}, coins(130), surface=True, name="Медіа-консоль")
item("record_player", "decor", 1, 1, "surface", [b(10, 20, 0, 80, 64, 12, "body", "round"), b(18, 28, 12, 50, 50, 2, "disc", "cyl"), b(38, 48, 14, 10, 10, 2, "label", "cyl"), b(72, 30, 12, 6, 30, 6, "arm")],
     {"body": slot("wood", 3), "disc": slot("metal", 2), "label": slot("fabric", 1), "arm": slot("metal", 0)}, coins(90), ["listen"], name="Програвач")
tag("record_player", "switch")

# ---- bedroom ----------------------------------------------------------------------------------------------
item("bed_single", "seating", 1, 2, "floor",
     legs4(100, 200, 8, 10, 6, "frame") + [b(0, 0, 8, 100, 200, 20, "frame", "round"), b(0, 0, 28, 100, 14, 64, "frame", "round"),
      b(6, 14, 28, 88, 180, 14, "sheet", "round"), b(6, 80, 42, 88, 112, 10, "blanket", "round"), b(18, 22, 42, 64, 40, 12, "pillow", "round")],
     {"frame": slot("wood", 1), "sheet": slot("fabric", 5), "blanket": slot("fabric", 4), "pillow": slot("pastel", 1)}, coins(130), ["rest"], name="Односпальне ліжко")
item("bunk_bed", "seating", 1, 2, "floor",
     [b(x, y, 0, 8, 8, 150, "frame") for x in (0, 92) for y in (0, 192)] + [b(0, 0, 18, 100, 200, 8, "frame"), b(4, 6, 26, 92, 188, 12, "sheet", "round"), b(4, 80, 38, 92, 112, 8, "blanket", "round"),
      b(0, 0, 92, 100, 200, 8, "frame"), b(4, 6, 100, 92, 188, 12, "sheet", "round"), b(4, 80, 112, 92, 112, 8, "blanket2", "round"),
      b(0, 180, 124, 100, 6, 20, "frame")] + [b(94, 60 + i * 0, 30 + i * 18, 6, 6, 4, "frame") for i in range(4)],
     {"frame": slot("wood", 3), "sheet": slot("fabric", 5), "blanket": slot("fabric", 6), "blanket2": slot("fabric", 1)}, coins(260), ["rest"], name="Двоярусне ліжко")
item("canopy_bed", "seating", 2, 2, "floor",
     [b(x, y, 0, 8, 8, 170, "frame", "cyl") for x in (0, 192) for y in (0, 192)] + [b(0, 0, 10, 200, 200, 18, "frame", "round"), b(6, 10, 28, 188, 184, 16, "sheet", "round"),
      b(6, 80, 44, 188, 112, 10, "blanket", "round"), b(20, 18, 44, 70, 40, 14, "pillow", "round"), b(110, 18, 44, 70, 40, 14, "pillow", "round"),
      b(0, 0, 166, 200, 200, 6, "canopy", "round"), b(0, 0, 120, 8, 200, 46, "canopy"), b(192, 0, 120, 8, 200, 46, "canopy")],
     {"frame": slot("wood", 5), "sheet": slot("fabric", 5), "blanket": slot("fabric", 3), "pillow": slot("pastel", 4), "canopy": slot("pastel", 4)}, {"all": [coins(420), token("leaf", 5)]}, ["rest"], name="Ліжко з балдахіном")
item("futon", "seating", 2, 1, "floor", [b(0, 0, 0, 200, 100, 8, "wood"), b(4, 4, 8, 192, 92, 14, "mattress", "round"), b(10, 10, 22, 50, 30, 10, "pillow", "round")],
     {"wood": slot("wood", 3), "mattress": slot("fabric", 5), "pillow": slot("fabric", 0)}, coins(110), ["rest", "sit"], name="Футон")
item("wardrobe_tall", "storage", 1, 1, "floor",
     [b(6, 6, 0, 88, 86, 6, "wood"), b(2, 2, 6, 96, 90, 154, "wood"), b(8, 90, 14, 84, 2, 136, "door"), b(76, 92, 74, 4, 3, 22, "trim", "round"), b(0, 0, 160, 100, 96, 6, "wood", "round")],
     {"wood": slot("wood", 4), "door": slot("wood", 1), "trim": slot("metal", 1)}, coins(110), name="Висока шафа")
item("vanity", "tables", 2, 1, "floor",
     legs4(200, 70, 50, 8, 6, "wood", "cyl") + [b(0, 0, 50, 200, 70, 8, "wood", "round"), b(10, 60, 30, 70, 6, 20, "front"), b(120, 60, 30, 70, 6, 20, "front")],
     {"wood": slot("ceramic", 0), "front": slot("ceramic", 3)}, coins(150), surface=True, name="Туалетний столик")
item("wall_mirror_round", "wall", 1, 1, "wall", [b(14, 0, 70, 72, 6, 72, "frame", "round"), b(20, 4, 76, 60, 3, 60, "glass", "round")],
     {"frame": slot("metal", 1), "glass": slot("glass", 0)}, coins(70), name="Кругле дзеркало")
tag("wall_mirror_round", "mirror")
item("chest_drawers", "storage", 1, 1, "floor",
     legs4(100, 90, 8, 8, 8, "wood", "cyl") + [b(0, 0, 8, 100, 88, 92, "wood")] + [b(8, 86, 14 + i * 22, 84, 2, 18, "front") for i in range(4)]
     + [b(44, 88, 20 + i * 22, 12, 3, 4, "trim") for i in range(4)] + [b(0, 0, 100, 100, 94, 5, "wood", "round")],
     {"wood": slot("wood", 1), "front": slot("wood", 4), "trim": slot("metal", 1)}, coins(120), surface=True, name="Комод високий")

# ---- kitchen ----------------------------------------------------------------------------------------------
def counter(id, name, extra, slots_extra, price, acts=None, surface=True):
    model = [b(4, 4, 0, 92, 88, 8, "plinth"), b(0, 0, 8, 100, 94, 50, "body"), b(6, 92, 14, 88, 2, 38, "front"), b(44, 94, 44, 12, 3, 3, "trim"), b(0, 0, 58, 100, 100, 6, "top")] + extra
    slots = {"plinth": slot("wood", 5), "body": slot("ceramic", 0), "front": slot("ceramic", 2), "trim": slot("metal", 0), "top": slot("wood", 3)}
    slots.update(slots_extra)
    item(id, "kitchen", 1, 1, "floor", model, slots, price, acts, surface=surface, name=name)


counter("counter", "Тумба кухонна", [], {}, coins(70))
counter("counter_sink", "Мийка", [b(14, 14, 60, 72, 60, 6, "sink", "round"), b(46, 10, 64, 8, 8, 16, "tap", "cyl"), b(46, 10, 76, 8, 18, 4, "tap")],
        {"sink": slot("metal", 0), "tap": slot("metal", 0)}, coins(110), ["brew_tea", "wash"], surface=False)
counter("counter_drawers", "Тумба з шухлядами", [b(6, 93, 14, 88, 2, 2, "trim"), b(6, 93, 30, 88, 2, 2, "trim")], {}, coins(85))
item("stove", "kitchen", 1, 1, "floor",
     [b(0, 0, 0, 100, 94, 58, "body"), b(8, 92, 8, 84, 2, 36, "glass"), b(10, 94, 46, 80, 2, 8, "panel"), b(0, 0, 58, 100, 100, 4, "top"),
      b(14, 14, 62, 28, 28, 2, "burner", "cyl"), b(58, 14, 62, 28, 28, 2, "burner", "cyl"), b(14, 56, 62, 28, 28, 2, "burner", "cyl"), b(58, 56, 62, 28, 28, 2, "burner", "cyl")],
     {"body": slot("ceramic", 0), "glass": slot("metal", 2), "panel": slot("metal", 0), "top": slot("metal", 2), "burner": slot("metal", 2)}, coins(160), ["brew_tea"], name="Плита")
item("fridge", "kitchen", 1, 1, "floor",
     [b(2, 4, 0, 96, 92, 170, "body", "round"), b(6, 94, 110, 88, 2, 56, "door"), b(6, 94, 6, 88, 2, 100, "door"), b(80, 96, 120, 4, 3, 26, "trim"), b(80, 96, 70, 4, 3, 26, "trim")],
     {"body": slot("ceramic", 2), "door": slot("ceramic", 2), "trim": slot("metal", 0)}, coins(220), name="Холодильник")
item("wall_cabinet", "kitchen", 1, 1, "wall", [b(4, 0, 120, 92, 34, 50, "body"), b(8, 34, 124, 84, 2, 42, "front"), b(44, 36, 126, 12, 2, 3, "trim")],
     {"body": slot("ceramic", 0), "front": slot("ceramic", 2), "trim": slot("metal", 0)}, coins(60), name="Навісна шафка")
item("kitchen_island", "kitchen", 2, 1, "floor",
     [b(4, 4, 0, 192, 92, 8, "plinth"), b(0, 0, 8, 200, 100, 52, "body"), b(8, 98, 14, 88, 2, 40, "front"), b(104, 98, 14, 88, 2, 40, "front"), b(0, 0, 60, 200, 100, 6, "top")],
     {"plinth": slot("wood", 5), "body": slot("fabric", 0), "front": slot("fabric", 0), "top": slot("ceramic", 0)}, coins(240), surface=True, name="Кухонний острів")
item("bar_table", "kitchen", 1, 1, "floor", [b(30, 30, 0, 40, 40, 4, "metal", "cyl"), b(46, 46, 4, 8, 8, 72, "metal", "cyl"), b(8, 8, 76, 84, 84, 5, "top", "cyl")],
     {"metal": slot("metal", 2), "top": slot("wood", 1)}, coins(75), surface=True, name="Барний столик")
item("dining_chair_wood", "kitchen", 1, 1, "floor",
     legs4(100, 100, 40, 8, 14, "wood") + [b(12, 12, 40, 76, 76, 6, "wood", "round"), b(12, 12, 46, 76, 8, 44, "wood"), b(16, 16, 46, 68, 68, 4, "cushion", "round")],
     {"wood": slot("wood", 1), "cushion": slot("fabric", 1)}, coins(40), ["sit"], name="Дерев'яний стілець")
item("dining_chair_metal", "kitchen", 1, 1, "floor",
     legs4(100, 100, 40, 6, 16, "metal", "cyl") + [b(14, 14, 40, 72, 72, 6, "seat", "cyl"), b(18, 14, 46, 64, 6, 38, "seat", "round")],
     {"metal": slot("metal", 2), "seat": slot("fabric", 2)}, coins(45), ["sit"], name="Металевий стілець")
item("round_dining", "kitchen", 2, 2, "floor",
     [b(78, 78, 0, 44, 44, 6, "wood", "cyl"), b(92, 92, 6, 16, 16, 44, "wood", "cyl"), b(10, 10, 50, 180, 180, 6, "top", "cyl")],
     {"wood": slot("wood", 2), "top": slot("ceramic", 0)}, coins(150), surface=True, name="Круглий обідній стіл")
for id, name, model, slots_, price, acts in [
    ("microwave", "Мікрохвильовка", [b(8, 30, 0, 84, 50, 34, "body", "round"), b(14, 78, 6, 50, 2, 22, "glass"), b(70, 78, 6, 16, 2, 22, "panel")], {"body": slot("ceramic", 0), "glass": slot("metal", 2), "panel": slot("metal", 0)}, coins(80), ["brew_tea"]),
    ("kettle", "Чайник електричний", [b(28, 28, 0, 44, 44, 6, "base", "cyl"), b(30, 30, 6, 40, 40, 32, "body", "cyl"), b(70, 44, 16, 10, 8, 16, "body", "round"), b(36, 36, 38, 28, 28, 4, "base", "cyl")], {"base": slot("metal", 2), "body": slot("ceramic", 3)}, coins(35), ["brew_tea"]),
    ("toaster", "Тостер", [b(20, 30, 0, 60, 40, 30, "body", "round"), b(30, 40, 30, 14, 20, 2, "slot"), b(54, 40, 30, 14, 20, 2, "slot")], {"body": slot("metal", 3), "slot": slot("metal", 2)}, coins(30), None),
    ("coffee_machine", "Кавоварка", [b(18, 24, 0, 64, 54, 6, "base"), b(18, 24, 6, 64, 18, 52, "body", "round"), b(36, 46, 6, 24, 24, 16, "cup", "cyl"), b(18, 24, 58, 64, 54, 6, "body", "round")], {"base": slot("metal", 2), "body": slot("metal", 3), "cup": slot("ceramic", 0)}, coins(95), ["brew_tea"]),
    ("fruit_bowl", "Ваза з фруктами", [b(20, 20, 0, 60, 60, 12, "bowl", "cyl"), b(26, 28, 10, 22, 22, 18, "apple", "ball"), b(48, 34, 10, 22, 22, 18, "orange", "ball"), b(36, 46, 14, 22, 22, 18, "apple", "ball")], {"bowl": slot("ceramic", 4), "apple": slot("fabric", 1), "orange": slot("fabric", 2)}, coins(25), None),
    ("plate_stack", "Стос тарілок", [b(24, 24, i * 4, 52, 52, 4, "plate", "cyl") for i in range(5)], {"plate": slot("ceramic", 0)}, coins(15), None),
    ("cooking_pot", "Каструля", [b(22, 22, 0, 56, 56, 30, "pot", "cyl"), b(18, 46, 22, 6, 8, 6, "pot"), b(76, 46, 22, 6, 8, 6, "pot"), b(26, 26, 30, 48, 48, 4, "lid", "cyl"), b(44, 44, 34, 12, 12, 6, "lid", "ball")], {"pot": slot("metal", 3), "lid": slot("metal", 0)}, coins(30), ["brew_tea"]),
    ("spice_rack", "Спеції", [b(10, 40, 0, 80, 20, 4, "wood")] + [b(14 + i * 18, 44, 4, 12, 12, 18, f"jar{i % 3}", "cyl") for i in range(4)], {"wood": slot("wood", 1), "jar0": slot("fabric", 1), "jar1": slot("fabric", 2), "jar2": slot("fabric", 4)}, coins(20), None),
]:
    item(id, "kitchen", 1, 1, "surface", model, slots_, price, acts, name=name)
tag("microwave", "switch")
tag("coffee_machine", "switch")

# ---- bathroom ---------------------------------------------------------------------------------------------
item("bathtub", "bath", 2, 1, "floor",
     [b(x, y, 0, 10, 10, 8, "feet", "ball") for x in (8, 182) for y in (8, 82)] + [b(0, 0, 8, 200, 100, 44, "tub", "round"), b(10, 10, 40, 180, 80, 10, "water"), b(180, 40, 52, 10, 20, 14, "tap", "round")],
     {"tub": slot("ceramic", 0), "water": slot("glass", 1), "tap": slot("metal", 1), "feet": slot("metal", 1)}, coins(260), ["rest"], name="Ванна")
item("shower", "bath", 1, 1, "floor",
     [b(0, 0, 0, 100, 100, 8, "tray"), b(0, 0, 8, 4, 100, 170, "frame"), b(0, 0, 8, 100, 4, 170, "frame"), b(46, 6, 150, 8, 30, 6, "metal", "round"), b(46, 30, 140, 8, 8, 10, "metal", "cyl"),
      b(96, 4, 8, 4, 96, 170, "glass"), b(4, 96, 8, 92, 4, 170, "glass")],
     {"tray": slot("ceramic", 0), "frame": slot("ceramic", 2), "metal": slot("metal", 0), "glass": slot("glass", 0)}, coins(230), ["wash"], name="Душ")
item("toilet", "bath", 1, 1, "floor", [b(26, 6, 0, 48, 30, 70, "body", "round"), b(28, 30, 0, 44, 56, 30, "body", "cyl"), b(24, 28, 30, 52, 62, 6, "seat", "cyl")],
     {"body": slot("ceramic", 0), "seat": slot("ceramic", 1)}, coins(90), ["sit"], name="Унітаз")
item("washbasin", "bath", 1, 1, "floor", [b(40, 10, 0, 20, 20, 60, "body", "cyl"), b(10, 6, 60, 80, 70, 14, "body", "round"), b(20, 14, 72, 60, 52, 2, "water"), b(46, 8, 74, 8, 8, 14, "tap", "cyl")],
     {"body": slot("ceramic", 0), "water": slot("glass", 1), "tap": slot("metal", 0)}, coins(80), ["wash"], name="Умивальник")
item("towel_rail", "bath", 1, 1, "wall", [b(14, 0, 110, 6, 10, 6, "metal"), b(80, 0, 110, 6, 10, 6, "metal"), b(14, 8, 110, 72, 4, 4, "metal", "cyl"), b(24, 6, 70, 52, 6, 44, "towel", "round")],
     {"metal": slot("metal", 0), "towel": slot("fabric", 0)}, coins(30), name="Рушникотримач")
item("washing_machine", "bath", 1, 1, "floor", [b(2, 4, 0, 96, 92, 84, "body", "round"), b(20, 94, 18, 60, 2, 50, "door", "round"), b(28, 95, 26, 44, 2, 34, "glass", "round"), b(10, 94, 72, 80, 2, 8, "panel")],
     {"body": slot("ceramic", 0), "door": slot("metal", 0), "glass": slot("glass", 1), "panel": slot("ceramic", 2)}, coins(190), name="Пральна машина")
item("laundry_basket", "bath", 1, 1, "floor", [b(20, 20, 0, 60, 60, 40, "basket", "cyl"), b(26, 26, 36, 48, 48, 10, "cloth", "ball")],
     {"basket": slot("wood", 3), "cloth": slot("fabric", 6)}, coins(25), name="Кошик для білизни")
item("bath_mat", "bath", 1, 1, "rug", [b(6, 10, 0, 88, 80, 3, "mat", "round"), b(16, 20, 3, 68, 60, 1, "accent", "round")],
     {"mat": slot("fabric", 6), "accent": slot("fabric", 5)}, coins(15), name="Килимок для ванної")

# ---- study and hobbies -----------------------------------------------------------------------------------
item("desk_l", "office", 2, 2, "floor",
     [b(0, 0, 0, 10, 100, 52, "frame"), b(190, 0, 0, 10, 100, 52, "frame"), b(0, 190, 0, 10, 10, 52, "frame"), b(0, 0, 52, 200, 100, 6, "top"), b(0, 100, 52, 100, 100, 6, "top")],
     {"frame": slot("metal", 2), "top": slot("wood", 4)}, coins(170), surface=True, name="Кутовий стіл")
item("computer", "office", 1, 1, "surface",
     [b(40, 50, 0, 20, 14, 4, "body", "round"), b(46, 54, 4, 8, 6, 10, "body"), b(6, 50, 14, 88, 8, 50, "body", "round"), b(10, 58, 18, 80, 1, 42, "screen"), b(16, 70, 0, 68, 22, 3, "keys", "round")],
     {"body": slot("metal", 2), "screen": slot("glass", 1), "keys": slot("ceramic", 5)}, coins(260), ["read"], name="Комп'ютер")
tag("computer", "switch")
item("office_chair", "office", 1, 1, "floor",
     [b(16, 16, 0, 68, 68, 4, "base", "cyl"), b(46, 46, 4, 8, 8, 30, "base", "cyl"), b(14, 16, 34, 72, 70, 10, "seat", "round"), b(16, 12, 44, 68, 12, 52, "seat", "round"), b(12, 30, 46, 8, 50, 6, "base"), b(80, 30, 46, 8, 50, 6, "base")],
     {"base": slot("metal", 2), "seat": slot("fabric", 3)}, coins(95), ["sit"], name="Офісне крісло")
item("gaming_chair", "office", 1, 1, "floor",
     [b(16, 16, 0, 68, 68, 4, "base", "cyl"), b(46, 46, 4, 8, 8, 30, "base", "cyl"), b(14, 16, 34, 72, 70, 10, "seat", "round"), b(18, 10, 44, 64, 14, 70, "seat", "round"), b(30, 12, 90, 40, 14, 14, "accent", "round"), b(26, 12, 50, 8, 14, 50, "accent")],
     {"base": slot("metal", 2), "seat": slot("metal", 2), "accent": slot("fabric", 1)}, coins(180), ["sit"], name="Геймерське крісло")
item("filing_cabinet", "office", 1, 1, "floor", [b(10, 6, 0, 80, 88, 96, "body", "round")] + [b(16, 92, 8 + i * 30, 68, 2, 24, "front") for i in range(3)] + [b(42, 94, 26 + i * 30, 16, 2, 3, "trim") for i in range(3)],
     {"body": slot("metal", 0), "front": slot("metal", 0), "trim": slot("metal", 2)}, coins(70), surface=True, name="Картотека")
item("whiteboard", "office", 2, 1, "wall", [b(10, 0, 70, 180, 4, 76, "frame"), b(14, 4, 74, 172, 1, 68, "board"), b(40, 5, 120, 60, 1, 4, "ink"), b(40, 5, 108, 90, 1, 3, "ink2"), b(40, 4, 74, 40, 8, 4, "frame")],
     {"frame": slot("metal", 0), "board": slot("ceramic", 0), "ink": slot("fabric", 6), "ink2": slot("fabric", 1)}, coins(65), name="Дошка")
item("ladder_shelf", "storage", 1, 1, "floor",
     [b(4, 30, 0, 6, 6, 150, "wood"), b(90, 30, 0, 6, 6, 150, "wood")] + [b(4, 10 + i * 14, 20 + i * 36, 92, 60 - i * 12, 4, "wood") for i in range(4)]
     + [b(12, 20, 24, 20, 30, 20, "pot", "cyl"), b(14, 22, 44, 16, 26, 16, "leaf", "ball"), b(40, 30, 60, 40, 24, 22, "book")],
     {"wood": slot("wood", 3), "pot": slot("pot"), "leaf": slot("leaf"), "book": slot("fabric", 6)}, coins(80), name="Полиця-драбинка")
item("guitar", "office", 1, 1, "floor", [b(30, 40, 0, 40, 20, 10, "stand"), b(26, 44, 10, 48, 16, 40, "body", "ball"), b(44, 48, 46, 12, 8, 48, "neck"), b(42, 46, 92, 16, 10, 10, "neck", "round")],
     {"stand": slot("metal", 2), "body": slot("wood", 1), "neck": slot("wood", 2)}, coins(140), ["play_music"], name="Гітара")
item("sewing_machine", "office", 1, 1, "surface", [b(10, 30, 0, 80, 40, 8, "body", "round"), b(10, 34, 8, 20, 32, 40, "body", "round"), b(10, 34, 40, 74, 32, 14, "body", "round"), b(70, 40, 20, 10, 20, 20, "body")],
     {"body": slot("ceramic", 3)}, coins(110), ["paint"], name="Швейна машинка")
item("bookcase_tall", "storage", 1, 1, "floor",
     [b(0, 0, 0, 100, 6, 180, "wood"), b(0, 0, 0, 6, 100, 180, "wood"), b(94, 0, 0, 6, 100, 180, "wood")] + [b(6, 6, z, 88, 94, 4, "wood") for z in (0, 46, 92, 138)]
     + books(10, 90, 14, 4, 76, ["b1", "b2", "b3"], 5) + books(10, 70, 14, 50, 76, ["b2", "b3", "b1"], 6) + books(10, 90, 14, 96, 76, ["b3", "b1", "b2"], 7) + [b(0, 0, 180, 100, 100, 6, "wood")],
     {"wood": slot("wood", 2), "b1": slot("fabric", 6), "b2": slot("fabric", 1), "b3": slot("fabric", 2)}, coins(110), ["read"], name="Висока книжкова шафа")

# ---- kids --------------------------------------------------------------------------------------------------
item("rocking_horse", "kids", 1, 1, "floor",
     [b(16, 6, 0, 8, 88, 6, "rocker", "round"), b(76, 6, 0, 8, 88, 6, "rocker", "round"), b(20, 30, 6, 60, 40, 30, "body", "round"), b(30, 66, 30, 40, 20, 40, "body", "round"), b(36, 76, 66, 28, 18, 14, "mane"), b(30, 30, 36, 40, 20, 6, "saddle", "round")],
     {"rocker": slot("wood", 2), "body": slot("ceramic", 1), "mane": slot("wood", 5), "saddle": slot("fabric", 1)}, coins(80), ["sit"], name="Конячка-гойдалка")
item("toy_blocks", "kids", 1, 1, "floor", [b(16, 16, 0, 24, 24, 24, "a"), b(44, 20, 0, 24, 24, 24, "b"), b(28, 46, 0, 24, 24, 24, "c"), b(30, 22, 24, 24, 24, 24, "c"), b(60, 56, 0, 24, 24, 24, "a")],
     {"a": slot("fabric", 1), "b": slot("fabric", 6), "c": slot("fabric", 2)}, coins(20), name="Кубики")
item("dollhouse", "kids", 1, 1, "floor", [b(10, 20, 0, 80, 60, 70, "body"), b(16, 78, 10, 22, 2, 20, "window"), b(56, 78, 10, 22, 2, 20, "window"), b(36, 78, 40, 26, 2, 20, "window"), b(6, 16, 70, 88, 68, 20, "roof", "cone")],
     {"body": slot("pastel", 4), "window": slot("glass", 0), "roof": slot("fabric", 1)}, coins(90), name="Ляльковий будиночок")
item("toy_car", "kids", 1, 1, "floor", [b(16, 30, 6, 68, 40, 16, "body", "round"), b(28, 34, 22, 40, 32, 14, "body", "round")] + [b(x, y, 0, 14, 8, 14, "wheel", "cyl") for x in (20, 66) for y in (26, 66)],
     {"body": slot("fabric", 1), "wheel": slot("metal", 2)}, coins(30), name="Іграшкова машинка")
item("play_mat", "kids", 2, 2, "rug", [b(0, 0, 0, 200, 200, 2, "mat")] + [b(10 + (i % 4) * 46, 10 + (i // 4) * 46, 2, 44, 44, 1, ["a", "b", "c"][(i + i // 4) % 3]) for i in range(16)],
     {"mat": slot("ceramic", 0), "a": slot("fabric", 6), "b": slot("fabric", 2), "c": slot("fabric", 4)}, coins(50), name="Ігровий килимок")
item("plush_cat", "kids", 1, 1, "surface", [b(26, 30, 0, 48, 40, 30, "fur", "ball"), b(30, 34, 26, 40, 34, 30, "fur", "ball"), b(32, 40, 52, 10, 8, 10, "fur", "cone"), b(58, 40, 52, 10, 8, 10, "fur", "cone")],
     {"fur": slot("fabric", 2)}, coins(25), name="Плюшевий кіт")

# ---- plants -----------------------------------------------------------------------------------------------
plant("snake_plant", coins(35), "floor", pot(26, 26, 48, 26) + [b(34 + i * 8, 40, 26, 8, 6, 50 + (i % 2) * 14, "leaf", "round") for i in range(4)] + [b(40, 30, 26, 6, 8, 44, "leaf", "round")])
plant("fiddle_leaf", coins(85), "floor", pot(24, 24, 52, 30) + [b(46, 46, 30, 8, 8, 70, "stem", "cyl"), b(20, 20, 70, 36, 30, 22, "leaf", "ball"), b(44, 30, 86, 34, 30, 22, "leaf", "ball"), b(30, 40, 104, 36, 30, 22, "leaf", "ball"), b(46, 46, 120, 30, 30, 20, "leaf", "ball")], {"stem": slot("wood", 2)})
plant("olive_tree", coins(120), "floor", pot(22, 22, 56, 34) + [b(46, 46, 34, 8, 8, 60, "stem", "cyl"), b(14, 14, 86, 72, 72, 36, "leaf", "ball"), b(26, 26, 112, 48, 48, 22, "leaf", "ball")], {"stem": slot("wood", 2)})
plant("bamboo", coins(55), "floor", pot(26, 26, 48, 22) + [b(38, 40, 22, 6, 6, 90, "stem", "cyl"), b(52, 46, 22, 6, 6, 70, "stem", "cyl"), b(44, 54, 22, 6, 6, 110, "stem", "cyl"), b(28, 30, 90, 30, 20, 10, "leaf", "ball"), b(44, 40, 120, 30, 22, 10, "leaf", "ball"), b(46, 50, 80, 30, 20, 10, "leaf", "ball")], {"stem": slot("leaf", 3)})
plant("orchid", coins(45), "surface", pot(32, 32, 36, 16) + [b(44, 44, 16, 4, 4, 30, "stem", "cyl"), b(36, 40, 40, 14, 12, 10, "flower", "ball"), b(48, 46, 46, 14, 12, 10, "flower", "ball"), b(30, 34, 16, 40, 30, 8, "leaf", "ball")], {"stem": slot("leaf", 0), "flower": slot("fabric", 7)})
plant("herb_pots", coins(25), "surface", [b(10, 36, 0, 24, 24, 16, "pot", "cyl"), b(38, 36, 0, 24, 24, 16, "pot", "cyl"), b(66, 36, 0, 24, 24, 16, "pot", "cyl"), b(10, 36, 14, 24, 24, 14, "leaf", "ball"), b(38, 36, 14, 24, 24, 18, "leaf", "ball"), b(66, 36, 14, 24, 24, 12, "leaf", "ball")])
plant("terrarium", coins(60), "surface", [b(20, 20, 0, 60, 60, 8, "soil", "cyl"), b(28, 28, 8, 20, 20, 12, "leaf", "ball"), b(50, 40, 8, 14, 14, 18, "leaf", "cyl"), b(20, 20, 0, 60, 60, 50, "glass", "ball")], {"glass": slot("glass", 0)})
plant("big_cactus", coins(70), "floor", pot(24, 24, 52, 28) + [b(38, 38, 28, 24, 24, 90, "leaf", "cyl"), b(38, 38, 110, 24, 24, 14, "leaf", "ball"), b(18, 44, 60, 18, 14, 34, "leaf", "cyl"), b(64, 42, 50, 18, 14, 40, "leaf", "cyl"), b(18, 44, 88, 18, 14, 10, "leaf", "ball"), b(64, 42, 84, 18, 14, 10, "leaf", "ball")])
plant("flower_box", coins(40), "wall", [b(6, 0, 70, 88, 26, 18, "pot"), b(10, 4, 86, 22, 20, 14, "flower", "ball"), b(36, 6, 88, 22, 20, 14, "leaf", "ball"), b(62, 4, 86, 22, 20, 14, "flower", "ball")], {"flower": slot("fabric", 1)})

# ---- lights -----------------------------------------------------------------------------------------------
for id, name, layer, model, slots_, price in [
    ("desk_lamp", "Настільна лампа на шарнірі", "surface", [b(30, 40, 0, 40, 30, 4, "metal", "cyl"), b(46, 52, 4, 6, 6, 36, "metal"), b(46, 30, 36, 6, 26, 6, "metal"), b(34, 14, 26, 30, 26, 16, "shade", "cone"), b(42, 22, 24, 12, 12, 6, "bulb", "ball")], {"metal": slot("metal", 2), "shade": slot("fabric", 1), "bulb": slot("pastel", 3)}, coins(45)),
    ("paper_lantern", "Паперовий ліхтар", "floor", [b(40, 40, 0, 20, 20, 6, "metal", "cyl"), b(47, 47, 6, 6, 6, 50, "metal", "cyl"), b(18, 18, 56, 64, 64, 60, "shade", "ball")], {"metal": slot("wood", 5), "shade": slot("ceramic", 0)}, coins(65)),
    ("tripod_lamp", "Лампа-тринога", "floor", [b(10, 10, 0, 6, 6, 110, "wood"), b(84, 10, 0, 6, 6, 110, "wood"), b(47, 84, 0, 6, 6, 110, "wood"), b(20, 20, 100, 60, 60, 40, "shade", "cyl")], {"wood": slot("wood", 1), "shade": slot("ceramic", 1)}, coins(85)),
    ("fairy_jar", "Банка зі світлячками", "surface", [b(34, 34, 0, 32, 32, 34, "glass", "cyl"), b(36, 36, 34, 28, 28, 6, "lid", "cyl"), b(42, 42, 6, 8, 8, 6, "bulb", "ball"), b(50, 46, 16, 6, 6, 6, "bulb", "ball"), b(40, 48, 24, 6, 6, 6, "bulb", "ball")], {"glass": slot("glass", 0), "lid": slot("wood", 1), "bulb": slot("pastel", 3)}, coins(30)),
    ("wall_sconce", "Бра-свічка", "wall", [b(42, 0, 100, 16, 4, 30, "metal", "round"), b(46, 4, 104, 8, 16, 4, "metal"), b(44, 14, 108, 12, 12, 16, "wax", "cyl"), b(47, 17, 124, 6, 6, 8, "flame", "ball")], {"metal": slot("metal", 1), "wax": slot("pastel", 3), "flame": slot("pastel", 3)}, coins(40)),
    ("neon_heart", "Неонове серце", "wall", [b(30, 0, 80, 40, 3, 40, "frame", "round"), b(36, 3, 98, 12, 3, 12, "glow", "ball"), b(52, 3, 98, 12, 3, 12, "glow", "ball"), b(40, 3, 88, 20, 3, 14, "glow", "round")], {"frame": slot("metal", 2), "glow": slot("fabric", 7)}, coins(90)),
    ("floor_lamp_arc", "Дугова лампа", "floor", [b(20, 20, 0, 30, 30, 8, "metal", "cyl"), b(32, 32, 8, 6, 6, 130, "metal", "cyl"), b(32, 32, 134, 50, 6, 6, "metal"), b(64, 22, 108, 34, 34, 26, "shade", "cone")], {"metal": slot("metal", 2), "shade": slot("metal", 0)}, coins(120)),
]:
    item(id, "lighting", 1, 1, layer, model, slots_, price, name=name)
    tag(id, "light")

# ---- decor ------------------------------------------------------------------------------------------------
for id, name, layer, w, model, slots_, price, acts in [
    ("vase_tall", "Висока ваза", "floor", 1, [b(32, 32, 0, 36, 36, 70, "vase", "cyl"), b(28, 28, 60, 44, 44, 10, "vase", "cyl"), b(40, 40, 70, 4, 4, 30, "stem", "cyl"), b(52, 44, 70, 4, 4, 40, "stem", "cyl"), b(34, 34, 96, 14, 14, 10, "flower", "ball"), b(48, 40, 106, 14, 14, 10, "flower", "ball")], {"vase": slot("ceramic", 2), "stem": slot("leaf", 0), "flower": slot("fabric", 1)}, coins(50), ["water_plant"]),
    ("candles_set", "Набір свічок", "surface", 1, [b(20, 30, 0, 18, 18, 30, "wax", "cyl"), b(44, 40, 0, 18, 18, 22, "wax", "cyl"), b(66, 30, 0, 16, 16, 16, "wax", "cyl"), b(26, 36, 30, 6, 6, 8, "flame", "ball"), b(50, 46, 22, 6, 6, 8, "flame", "ball"), b(71, 35, 16, 6, 6, 8, "flame", "ball")], {"wax": slot("ceramic", 1), "flame": slot("pastel", 3)}, coins(25), None),
    ("record_crate", "Ящик з платівками", "floor", 1, [b(14, 14, 0, 72, 72, 40, "wood")] + [b(18 + i * 10, 18, 40, 6, 64, 14, f"r{i % 3}") for i in range(6)], {"wood": slot("wood", 1), "r0": slot("fabric", 1), "r1": slot("fabric", 6), "r2": slot("fabric", 2)}, coins(45), ["listen"]),
    ("piggy_bank", "Скарбничка", "surface", 1, [b(26, 34, 6, 48, 34, 30, "body", "ball"), b(70, 44, 18, 10, 14, 12, "body", "cyl")] + [b(x, y, 0, 8, 8, 8, "body", "cyl") for x in (30, 60) for y in (38, 58)], {"body": slot("pastel", 0)}, coins(15), None),
    ("hourglass", "Пісочний годинник", "surface", 1, [b(32, 32, 0, 36, 36, 6, "wood", "cyl"), b(36, 36, 6, 28, 28, 18, "glass", "cone"), b(36, 36, 24, 28, 28, 18, "glass", "cyl"), b(32, 32, 42, 36, 36, 6, "wood", "cyl"), b(44, 44, 6, 12, 12, 6, "sand", "ball")], {"wood": slot("wood", 2), "glass": slot("glass", 0), "sand": slot("wood", 3)}, coins(35), None),
    ("fish_bowl", "Акваріум-куля", "surface", 1, [b(20, 20, 0, 60, 60, 54, "water", "ball"), b(40, 40, 18, 16, 8, 8, "fish", "ball"), b(30, 30, 2, 40, 40, 6, "gravel", "cyl")], {"water": slot("glass", 1), "fish": slot("fabric", 2), "gravel": slot("pot", 3)}, coins(70), ["feed_cat"]),
    ("bird_cage", "Пташина клітка", "floor", 1, [b(36, 36, 0, 28, 28, 6, "metal", "cyl"), b(47, 47, 6, 6, 6, 60, "metal", "cyl"), b(20, 20, 66, 60, 60, 60, "cage", "cyl"), b(24, 24, 120, 52, 52, 20, "metal", "cone"), b(44, 44, 84, 14, 12, 14, "bird", "ball")], {"metal": slot("metal", 1), "cage": slot("glass", 2), "bird": slot("fabric", 2)}, coins(110), None),
    ("bust", "Погруддя", "floor", 1, [b(24, 24, 0, 52, 52, 60, "stand"), b(30, 34, 60, 40, 30, 26, "stone", "round"), b(36, 38, 84, 28, 28, 32, "stone", "ball")], {"stand": slot("ceramic", 5), "stone": slot("ceramic", 0)}, coins(140), None),
    ("tapestry", "Гобелен", "wall", 2, [b(10, 0, 50, 180, 3, 110, "cloth"), b(4, 0, 160, 192, 6, 4, "rod", "cyl"), b(30, 3, 70, 140, 1, 70, "pattern"), b(70, 4, 90, 60, 1, 30, "pattern2", "round")], {"cloth": slot("fabric", 3), "rod": slot("wood", 2), "pattern": slot("fabric", 5), "pattern2": slot("fabric", 2)}, coins(90), None),
    ("world_map", "Мапа світу", "wall", 2, [b(10, 0, 60, 180, 3, 90, "frame"), b(16, 3, 66, 168, 1, 78, "sea"), b(30, 4, 90, 40, 1, 40, "land", "round"), b(80, 4, 100, 50, 1, 30, "land", "round"), b(140, 4, 80, 30, 1, 40, "land", "round")], {"frame": slot("wood", 2), "sea": slot("glass", 1), "land": slot("leaf", 3)}, coins(70), ["read"]),
    ("calendar", "Календар", "wall", 1, [b(30, 0, 90, 40, 2, 50, "paper"), b(30, 2, 128, 40, 1, 12, "top"), b(34, 2, 96, 32, 1, 26, "grid")], {"paper": slot("ceramic", 0), "top": slot("fabric", 1), "grid": slot("ceramic", 2)}, coins(10), None),
    ("wall_tv", "Телевізор на стіну", "wall", 2, [b(10, 0, 70, 180, 6, 90, "frame", "round"), b(16, 6, 76, 168, 1, 78, "screen")], {"frame": slot("metal", 2), "screen": slot("glass", 1)}, coins(280), ["listen"]),
    ("coat_rack", "Вішак", "wall", 1, [b(10, 0, 120, 80, 6, 10, "wood", "round"), b(20, 6, 112, 6, 10, 8, "metal"), b(48, 6, 112, 6, 10, 8, "metal"), b(74, 6, 112, 6, 10, 8, "metal"), b(16, 8, 60, 20, 10, 54, "coat", "round"), b(60, 8, 80, 18, 8, 34, "scarf", "round")], {"wood": slot("wood", 1), "metal": slot("metal", 1), "coat": slot("fabric", 0), "scarf": slot("fabric", 1)}, coins(45), None),
    ("floating_shelf", "Плаваюча полиця", "wall", 1, [b(6, 0, 96, 88, 22, 5, "wood")] + books(12, 50, 4, 101, 14, ["b1", "b2"], 8) + [b(60, 6, 101, 18, 14, 18, "pot", "cyl"), b(58, 4, 115, 22, 18, 14, "leaf", "ball")], {"wood": slot("wood", 4), "b1": slot("fabric", 3), "b2": slot("fabric", 2), "pot": slot("pot"), "leaf": slot("leaf")}, coins(40), None),
    ("painting_tall", "Висока картина", "wall", 1, [b(18, 0, 40, 64, 6, 100, "frame", "round"), b(24, 6, 46, 52, 2, 88, "art"), b(24, 7, 46, 52, 2, 30, "art2"), b(40, 7, 96, 20, 2, 20, "art3", "ball")], {"frame": slot("wood", 5), "art": slot("pastel", 4), "art2": slot("fabric", 3), "art3": slot("pastel", 3)}, coins(55), None),
    ("painting_abstract", "Абстракція", "wall", 2, [b(10, 0, 50, 180, 4, 70, "frame"), b(14, 4, 54, 172, 1, 62, "art"), b(30, 5, 60, 50, 1, 40, "a", "round"), b(90, 5, 70, 40, 1, 40, "b", "ball"), b(140, 5, 58, 30, 1, 52, "c")], {"frame": slot("metal", 2), "art": slot("ceramic", 0), "a": slot("fabric", 1), "b": slot("fabric", 2), "c": slot("fabric", 6)}, coins(75), None),
    ("photo_wall", "Фотостіна", "wall", 2, [b(14, 0, 80, 46, 3, 40, "f1"), b(66, 0, 90, 40, 3, 50, "f2"), b(112, 0, 70, 70, 3, 44, "f1"), b(30, 0, 128, 60, 3, 30, "f2"), b(110, 0, 122, 40, 3, 34, "f1")], {"f1": slot("wood", 5), "f2": slot("ceramic", 0)}, coins(50), None),
]:
    item(id, "decor" if layer != "wall" else "wall", w, 1, layer, model, slots_, price, acts, name=name)
tag("candles_set", "light")
tag("wall_tv", "switch")
tag("fish_bowl", "aquarium")

# ---- rugs -------------------------------------------------------------------------------------------------
for id, name, w, d, model_extra, slots_, price, shape in [
    ("rug_stripes", "Смугастий килим", 2, 3, [b(14, 14 + i * 34, 2, 172, 16, 1, "accent") for i in range(8)], {"accent": slot("fabric", 6)}, 85, "round"),
    ("rug_checker", "Килим у клітинку", 2, 2, [b(14 + (i % 4) * 43, 14 + (i // 4) * 43, 2, 43, 43, 1, "accent") for i in range(16) if (i + i // 4) % 2 == 0], {"accent": slot("fabric", 3)}, 75, "round"),
    ("rug_round_small", "Круглий килимок", 1, 1, [b(30, 30, 2, 40, 40, 1, "accent", "cyl")], {"accent": slot("fabric", 2)}, 30, "cyl"),
    ("rug_long_runner", "Довга доріжка", 1, 4, [b(14, 30 + i * 60, 2, 72, 20, 1, "accent") for i in range(6)], {"accent": slot("fabric", 1)}, 70, "round"),
    ("rug_shaggy", "Пухнастий килим", 3, 2, [b(16, 16, 2, 268, 168, 3, "rug", "round")], {}, 110, "round"),
    ("rug_oval", "Овальний килим", 3, 2, [b(30, 30, 2, 240, 140, 1, "accent", "ball")], {"accent": slot("fabric", 5)}, 95, "ball"),
]:
    W, D = w * 100, d * 100
    base_shape = "cyl" if shape in ("cyl", "ball") else "round"
    model = [b(0, 0, 0, W, D, 2, "border", base_shape), b(8, 8, 1, W - 16, D - 16, 2, "rug", base_shape)] + model_extra
    sl = {"border": slot("fabric", 5), "rug": slot("fabric", 0)}
    sl.update(slots_)
    item(id, "rugs", w, d, "rug", model, sl, coins(price), name=name)


# ---- garden: outdoor items -----------------------------------------------------------------------------------
def tree(id, name, price, trunk, crowns, w=1, d=1, extra=None, extra_slots=None, leaf=("leaf", 1)):
    model = [b(*trunk, "trunk", "cyl")] + [b(*c, "leaf", "ball") for c in crowns] + (extra or [])
    slots = {"trunk": slot("wood", 2), "leaf": slot(*leaf)}
    slots.update(extra_slots or {})
    item(id, "garden", w, d, "floor", model, slots, price, ["water_plant"], name=name)


tree("tree_oak", "Дуб", coins(160), (88, 88, 0, 24, 24, 110), [(10, 20, 100, 120, 120, 70), (60, 10, 120, 130, 120, 70), (40, 60, 150, 110, 110, 60), (70, 70, 110, 110, 110, 50)], 2, 2)
tree("tree_birch", "Береза", coins(110), (42, 42, 0, 16, 16, 140), [(16, 16, 110, 68, 68, 60), (24, 24, 150, 52, 52, 40)], extra_slots={"trunk": slot("ceramic", 0)}, leaf=("leaf", 3))
tree("tree_apple", "Яблуня", coins(150), (42, 42, 0, 16, 16, 90), [(4, 4, 80, 92, 92, 66), (20, 20, 124, 60, 60, 36)],
     extra=[b(14, 60, 100, 12, 12, 12, "fruit", "ball"), b(70, 40, 110, 12, 12, 12, "fruit", "ball"), b(40, 76, 90, 12, 12, 12, "fruit", "ball"), b(60, 70, 130, 12, 12, 12, "fruit", "ball")],
     extra_slots={"fruit": slot("fabric", 1)})
tree("tree_pine", "Ялина", coins(120), (44, 44, 0, 12, 12, 40), [], extra=[b(6, 6, 30, 88, 88, 50, "leaf", "cone"), b(16, 16, 70, 68, 68, 50, "leaf", "cone"), b(28, 28, 110, 44, 44, 50, "leaf", "cone")], leaf=("leaf", 0))
tree("tree_sakura", "Сакура", {"all": [coins(220), token("leaf", 4)]}, (88, 88, 0, 24, 24, 100), [(20, 20, 90, 120, 120, 60), (60, 50, 120, 110, 110, 56), (40, 80, 100, 100, 90, 50)], 2, 2, leaf=("pastel", 0),
     extra_slots={"leaf": {"default": "#f4b6c8", "palette": "fabric_pink"}})
for id, name, price, model, slots_ in [
    ("bush_round", "Кущ", 35, [b(10, 10, 0, 80, 80, 60, "leaf", "ball"), b(30, 20, 30, 60, 60, 46, "leaf", "ball")], {"leaf": slot("leaf", 1)}),
    ("bush_flowering", "Квітучий кущ", 55, [b(8, 8, 0, 84, 84, 60, "leaf", "ball")] + [b(x, y, z, 12, 12, 12, "flower", "ball") for x, y, z in ((20, 70, 30), (60, 76, 24), (76, 40, 40), (40, 50, 54), (24, 30, 50))], {"leaf": slot("leaf", 0), "flower": slot("fabric", 7)}),
    ("hedge_block", "Живопліт", 45, [b(2, 2, 0, 96, 96, 70, "leaf", "round")], {"leaf": slot("leaf", 0)}),
    ("rose_bush", "Троянди", 60, [b(16, 16, 0, 68, 68, 50, "leaf", "ball")] + [b(x, y, z, 14, 14, 14, "flower", "ball") for x, y, z in ((24, 64, 34), (60, 66, 30), (66, 32, 44), (36, 40, 50))], {"leaf": slot("leaf", 0), "flower": slot("fabric", 1)}),
    ("sunflowers", "Соняшники", 40, [b(30 + i * 20, 40, 0, 4, 4, 90 + i * 10, "stem", "cyl") for i in range(3)] + [b(22 + i * 20, 34, 90 + i * 10, 20, 14, 20, "flower", "ball") for i in range(3)] + [b(28 + i * 20, 38, 96 + i * 10, 8, 6, 8, "center", "ball") for i in range(3)], {"stem": slot("leaf", 0), "flower": slot("fabric", 2), "center": slot("wood", 2)}),
    ("pumpkin", "Гарбуз", 25, [b(14, 14, 0, 72, 72, 46, "body", "ball"), b(46, 46, 44, 8, 8, 12, "stem", "cyl")], {"body": slot("fabric", 2), "stem": slot("leaf", 0)}),
    ("garden_bench", "Садова лавка", 70, [b(10, 20, 0, 10, 60, 30, "metal"), b(180, 20, 0, 10, 60, 30, "metal"), b(4, 14, 30, 192, 72, 6, "wood"), b(4, 10, 36, 192, 8, 44, "wood"), b(4, 14, 40, 10, 72, 20, "metal"), b(186, 14, 40, 10, 72, 20, "metal")], {"metal": slot("metal", 2), "wood": slot("wood", 1)}),
    ("picnic_table", "Стіл для пікніку", 120, [b(10, 10, 0, 180, 18, 30, "wood"), b(10, 172, 0, 180, 18, 30, "wood"), b(30, 60, 0, 12, 80, 54, "wood"), b(158, 60, 0, 12, 80, 54, "wood"), b(10, 40, 54, 180, 120, 6, "top")], {"wood": slot("wood", 1), "top": slot("wood", 3)}),
    ("sun_lounger", "Шезлонг", 80, [b(10, 4, 0, 6, 192, 14, "frame"), b(84, 4, 0, 6, 192, 14, "frame"), b(8, 40, 14, 84, 156, 8, "cushion", "round"), b(8, 4, 14, 84, 40, 46, "cushion", "round")], {"frame": slot("ceramic", 0), "cushion": slot("fabric", 6)}),
    ("parasol_table", "Столик з парасолею", 140, [b(20, 20, 0, 60, 60, 4, "metal", "cyl"), b(46, 46, 0, 8, 8, 160, "metal", "cyl"), b(10, 10, 46, 80, 80, 6, "top", "cyl"), b(0, 0, 140, 100, 100, 30, "canvas", "cone")], {"metal": slot("metal", 0), "top": slot("ceramic", 0), "canvas": slot("fabric", 1)}),
    ("swing", "Гойдалка", 160, [b(4, 40, 0, 10, 10, 170, "frame"), b(186, 40, 0, 10, 10, 170, "frame"), b(4, 40, 166, 192, 10, 10, "frame", "round"), b(70, 44, 60, 4, 4, 106, "rope"), b(126, 44, 60, 4, 4, 106, "rope"), b(64, 30, 50, 72, 32, 8, "seat", "round")], {"frame": slot("wood", 2), "rope": slot("wood", 3), "seat": slot("wood", 1)}),
    ("hammock", "Гамак", 130, [b(4, 40, 0, 12, 12, 110, "post", "cyl"), b(184, 40, 0, 12, 12, 110, "post", "cyl"), b(16, 30, 54, 168, 40, 20, "cloth", "ball")], {"post": slot("wood", 2), "cloth": slot("fabric", 6)}),
    ("fountain", "Фонтан", 260, [b(4, 4, 0, 192, 192, 30, "stone", "cyl"), b(16, 16, 20, 168, 168, 8, "water", "cyl"), b(84, 84, 30, 32, 32, 50, "stone", "cyl"), b(64, 64, 76, 72, 72, 12, "stone", "cyl"), b(70, 70, 86, 60, 60, 4, "water", "cyl"), b(92, 92, 90, 16, 16, 30, "spray", "cone")], {"stone": slot("ceramic", 1), "water": slot("glass", 1), "spray": slot("glass", 2)}),
    ("birdbath", "Поїлка для птахів", 60, [b(36, 36, 0, 28, 28, 50, "stone", "cyl"), b(16, 16, 50, 68, 68, 10, "stone", "cyl"), b(22, 22, 58, 56, 56, 4, "water", "cyl"), b(56, 30, 62, 12, 10, 10, "bird", "ball")], {"stone": slot("ceramic", 1), "water": slot("glass", 1), "bird": slot("fabric", 6)}),
    ("lamp_post", "Ліхтарний стовп", 90, [b(36, 36, 0, 28, 28, 10, "metal", "cyl"), b(45, 45, 10, 10, 10, 150, "metal", "cyl"), b(34, 34, 156, 32, 32, 30, "glass", "cyl"), b(30, 30, 186, 40, 40, 10, "metal", "cone"), b(42, 42, 162, 16, 16, 18, "bulb", "ball")], {"metal": slot("metal", 2), "glass": slot("pastel", 3), "bulb": slot("pastel", 3)}),
    ("stone_lantern", "Кам'яний ліхтар", 75, [b(30, 30, 0, 40, 40, 30, "stone", "round"), b(40, 40, 30, 20, 20, 30, "stone"), b(28, 28, 60, 44, 44, 20, "stone", "round"), b(40, 40, 62, 20, 20, 14, "flame", "ball"), b(20, 20, 80, 60, 60, 14, "stone", "cone")], {"stone": slot("ceramic", 5), "flame": slot("pastel", 3)}),
    ("bbq_grill", "Гриль", 110, [b(46, 46, 0, 8, 8, 40, "metal", "cyl"), b(20, 40, 0, 6, 6, 40, "metal"), b(74, 40, 0, 6, 6, 40, "metal"), b(14, 14, 40, 72, 72, 30, "body", "ball"), b(20, 20, 56, 60, 60, 4, "grate", "cyl")], {"metal": slot("metal", 2), "body": slot("metal", 3), "grate": slot("metal", 0)}),
    ("wheelbarrow", "Тачка", 50, [b(20, 10, 10, 60, 70, 30, "body", "round"), b(44, 80, 0, 12, 16, 16, "wheel", "cyl"), b(24, 0, 10, 6, 30, 6, "metal"), b(70, 0, 10, 6, 30, 6, "metal"), b(26, 16, 34, 48, 50, 8, "soil", "ball")], {"body": slot("fabric", 6), "wheel": slot("metal", 2), "metal": slot("metal", 0), "soil": slot("wood", 5)}),
    ("garden_gnome", "Садовий гном", 30, [b(34, 34, 0, 32, 32, 30, "body", "ball"), b(36, 36, 24, 28, 28, 22, "beard", "ball"), b(36, 36, 44, 28, 28, 30, "hat", "cone")], {"body": slot("fabric", 6), "beard": slot("ceramic", 0), "hat": slot("fabric", 1)}),
    ("birdhouse", "Шпаківня", 55, [b(46, 46, 0, 8, 8, 110, "pole", "cyl"), b(30, 30, 110, 40, 40, 34, "house"), b(26, 26, 144, 48, 48, 14, "roof", "cone"), b(44, 70, 124, 12, 2, 12, "hole", "ball")], {"pole": slot("wood", 2), "house": slot("wood", 3), "roof": slot("fabric", 1), "hole": slot("wood", 5)}),
    ("beehive", "Вулик", 85, [b(20, 20, 0, 60, 60, 10, "stand"), b(22, 22, 10, 56, 56, 26, "box"), b(22, 22, 36, 56, 56, 26, "box"), b(18, 18, 62, 64, 64, 8, "roof", "round")], {"stand": slot("wood", 2), "box": slot("fabric", 2), "roof": slot("wood", 1)}),
    ("mailbox", "Поштова скринька", 35, [b(46, 46, 0, 8, 8, 70, "pole", "cyl"), b(26, 36, 70, 48, 28, 26, "box", "round"), b(74, 40, 80, 4, 4, 20, "flag")], {"pole": slot("wood", 2), "box": slot("fabric", 6), "flag": slot("fabric", 1)}),
    ("doghouse", "Будка", 120, [b(10, 10, 0, 80, 80, 56, "body"), b(30, 88, 0, 40, 2, 40, "hole", "round"), b(4, 4, 56, 92, 92, 34, "roof", "cone")], {"body": slot("wood", 1), "hole": slot("wood", 5), "roof": slot("fabric", 1)}),
    ("sandbox", "Пісочниця", 90, [b(0, 0, 0, 200, 200, 16, "wood"), b(10, 10, 10, 180, 180, 8, "sand"), b(40, 40, 18, 30, 30, 14, "toy", "cone"), b(120, 110, 18, 30, 20, 10, "toy2", "round")], {"wood": slot("wood", 1), "sand": slot("wood", 3), "toy": slot("fabric", 1), "toy2": slot("fabric", 6)}),
    ("well", "Криниця", 180, [b(10, 10, 0, 80, 80, 40, "stone", "cyl"), b(18, 18, 30, 64, 64, 6, "water", "cyl"), b(10, 46, 40, 6, 8, 70, "wood"), b(84, 46, 40, 6, 8, 70, "wood"), b(4, 20, 106, 92, 60, 24, "roof", "cone")], {"stone": slot("ceramic", 1), "water": slot("glass", 1), "wood": slot("wood", 2), "roof": slot("wood", 1)}),
    ("vegetable_patch", "Город", 70, [b(0, 0, 0, 200, 100, 12, "soil", "round")] + [b(16 + i * 36, 30, 10, 24, 40, 20, "leaf", "ball") for i in range(5)] + [b(26 + i * 72, 40, 26, 12, 12, 10, "veg", "ball") for i in range(3)], {"soil": slot("wood", 5), "leaf": slot("leaf", 1), "veg": slot("fabric", 1)}),
    ("flower_bed", "Клумба", 60, [b(0, 0, 0, 200, 100, 14, "border", "round"), b(6, 6, 10, 188, 88, 6, "soil")] + [b(14 + i * 30, 20 + (i % 2) * 30, 14, 20, 20, 18, ["f1", "f2", "f3"][i % 3], "ball") for i in range(6)], {"border": slot("ceramic", 1), "soil": slot("wood", 5), "f1": slot("fabric", 1), "f2": slot("fabric", 2), "f3": slot("fabric", 7)}),
]:
    w = 2 if id in ("garden_bench", "picnic_table", "swing", "hammock", "fountain", "sandbox", "vegetable_patch", "flower_bed") else 1
    d = 2 if id in ("picnic_table", "sun_lounger", "fountain", "sandbox") else 1
    item(id, "garden", w, d, "floor", model, slots_, coins(price), ["sit"] if id in ("garden_bench", "swing", "hammock", "picnic_table", "sun_lounger") else (["water_plant"] if id in ("bush_round", "bush_flowering", "hedge_block", "rose_bush", "sunflowers", "vegetable_patch", "flower_bed") else None), name=name)
for id in ("lamp_post", "stone_lantern"):
    tag(id, "light")
item("pond", "garden", 2, 2, "rug", [b(0, 0, 0, 200, 200, 3, "stone", "cyl"), b(14, 14, 1, 172, 172, 3, "water", "cyl"), b(40, 50, 3, 30, 20, 2, "lily", "cyl"), b(120, 110, 3, 26, 20, 2, "lily", "cyl")],
     {"stone": slot("ceramic", 1), "water": slot("glass", 1), "lily": slot("leaf", 1)}, coins(150), name="Ставок")
item("stepping_stones", "garden", 1, 2, "rug", [b(20, 10, 0, 50, 40, 3, "stone", "cyl"), b(34, 80, 0, 46, 40, 3, "stone", "cyl"), b(16, 146, 0, 50, 40, 3, "stone", "cyl")],
     {"stone": slot("ceramic", 5)}, coins(30), name="Кам'яні сходинки")
# fences and hedges hang on the edge of a cell like wall pictures, so they snap to the garden's border
for id, name, price, model, slots_ in [
    ("fence_wood", "Дерев'яний паркан", 20, [b(4, 4, 0, 10, 8, 70, "post"), b(86, 4, 0, 10, 8, 70, "post"), b(0, 6, 22, 100, 4, 10, "rail"), b(0, 6, 48, 100, 4, 10, "rail")], {"post": slot("wood", 2), "rail": slot("wood", 1)}),
    ("fence_picket", "Білий паркан", 25, [b(2 + i * 20, 4, 0, 12, 6, 60 + (i % 2) * 6, "picket") for i in range(5)] + [b(0, 2, 20, 100, 3, 8, "picket"), b(0, 2, 42, 100, 3, 8, "picket")], {"picket": slot("ceramic", 0)}),
    ("fence_iron", "Кований паркан", 35, [b(4 + i * 16, 4, 0, 4, 4, 80, "iron", "cyl") for i in range(6)] + [b(0, 4, 70, 100, 4, 4, "iron"), b(0, 4, 10, 100, 4, 4, "iron")] + [b(3 + i * 16, 3, 80, 6, 6, 8, "iron", "cone") for i in range(6)], {"iron": slot("metal", 2)}),
    ("hedge_wall", "Живопліт-стінка", 30, [b(0, 0, 0, 100, 30, 70, "leaf", "round")], {"leaf": slot("leaf", 0)}),
    ("garden_gate", "Хвіртка", 40, [b(2, 4, 0, 12, 10, 90, "post"), b(86, 4, 0, 12, 10, 90, "post")] + [b(16 + i * 14, 6, 6, 8, 4, 64, "picket") for i in range(5)] + [b(14, 6, 24, 72, 4, 8, "picket"), b(14, 6, 50, 72, 4, 8, "picket")], {"post": slot("wood", 2), "picket": slot("wood", 1)}),
]:
    item(id, "garden", 1, 1, "wall", model, slots_, coins(price), ["enter"] if id == "garden_gate" else None, name=name)
tag("garden_gate", "door")
tag("fence_wood", "fence")
tag("fence_picket", "fence")
tag("fence_iron", "fence")
tag("hedge_wall", "fence")


# ---- more garden ------------------------------------------------------------------------------------------
tree("tree_willow", "Верба", coins(170), (88, 88, 0, 24, 24, 120), [(20, 20, 90, 160, 160, 60), (40, 40, 70, 120, 120, 50)], 2, 2, leaf=("leaf", 3))
tree("tree_maple", "Клен", coins(150), (88, 88, 0, 24, 24, 100), [(14, 14, 90, 120, 120, 66), (64, 50, 118, 120, 110, 60), (40, 70, 100, 110, 110, 50)], 2, 2,
     extra_slots={"leaf": {"default": "#d9662e", "palette": "autumn"}})
tree("tree_palm", "Пальма", coins(140), (44, 44, 0, 12, 12, 150), [(4, 30, 140, 92, 40, 16), (30, 4, 144, 40, 92, 16), (20, 20, 150, 60, 60, 20)], leaf=("leaf", 1))
for id, name, price, w, d, layer, model, slots_ in [
    ("rock_big", "Великий камінь", 40, 1, 1, "floor", [b(8, 14, 0, 84, 72, 46, "stone", "ball"), b(40, 40, 0, 52, 50, 30, "stone", "ball")], {"stone": slot("ceramic", 5)}),
    ("rocks", "Камінці", 20, 1, 1, "floor", [b(10, 30, 0, 34, 30, 16, "stone", "ball"), b(46, 20, 0, 30, 26, 14, "stone", "ball"), b(40, 56, 0, 24, 22, 10, "stone", "ball")], {"stone": slot("ceramic", 5)}),
    ("log_bench", "Колода", 45, 2, 1, "floor", [b(4, 28, 0, 192, 44, 36, "wood", "cyl"), b(4, 28, 0, 12, 44, 36, "ring", "cyl")], {"wood": slot("wood", 2), "ring": slot("wood", 3)}),
    ("mushrooms", "Гриби", 15, 1, 1, "floor", [b(30, 40, 0, 8, 8, 14, "stem", "cyl"), b(22, 32, 12, 24, 24, 10, "cap", "ball"), b(58, 50, 0, 6, 6, 10, "stem", "cyl"), b(52, 44, 8, 18, 18, 8, "cap", "ball")], {"stem": slot("ceramic", 0), "cap": slot("fabric", 1)}),
    ("reeds", "Очерет", 25, 1, 1, "floor", [b(20 + i * 14, 30 + (i % 2) * 20, 0, 4, 4, 60 + (i % 3) * 16, "reed", "cyl") for i in range(5)] + [b(22 + i * 14, 30 + (i % 2) * 20, 50 + (i % 3) * 16, 8, 8, 14, "head", "cyl") for i in range(5)], {"reed": slot("leaf", 0), "head": slot("wood", 2)}),
    ("pond_big", "Великий ставок", 260, 3, 3, "rug", [b(0, 0, 0, 300, 300, 3, "stone", "cyl"), b(16, 16, 1, 268, 268, 3, "water", "cyl"), b(60, 80, 3, 36, 28, 2, "lily", "cyl"), b(180, 150, 3, 30, 24, 2, "lily", "cyl"), b(200, 70, 3, 26, 22, 2, "lily", "cyl"), b(206, 74, 4, 8, 8, 4, "flower", "ball")], {"stone": slot("ceramic", 5), "water": slot("glass", 1), "lily": slot("leaf", 1), "flower": slot("fabric", 7)}),
    ("rose_arch", "Арка з трояндами", 180, 2, 1, "floor", [b(4, 40, 0, 10, 10, 170, "frame"), b(186, 40, 0, 10, 10, 170, "frame"), b(4, 40, 160, 192, 10, 14, "frame", "round"), b(0, 30, 120, 30, 30, 60, "leaf", "ball"), b(170, 30, 120, 30, 30, 60, "leaf", "ball"), b(30, 30, 150, 140, 30, 30, "leaf", "ball")] + [b(x, 36, z, 10, 10, 10, "flower", "ball") for x, z in ((10, 140), (180, 150), (60, 170), (120, 172), (94, 160))], {"frame": slot("ceramic", 0), "leaf": slot("leaf", 0), "flower": slot("fabric", 7)}),
    ("tulips", "Тюльпани", 30, 1, 1, "floor", [b(16 + (i % 3) * 26, 20 + (i // 3) * 36, 0, 4, 4, 30, "stem", "cyl") for i in range(6)] + [b(12 + (i % 3) * 26, 16 + (i // 3) * 36, 28, 12, 12, 14, ["f1", "f2"][i % 2], "ball") for i in range(6)], {"stem": slot("leaf", 0), "f1": slot("fabric", 1), "f2": slot("fabric", 2)}),
    ("berry_bush", "Ягідний кущ", 45, 1, 1, "floor", [b(10, 10, 0, 80, 80, 56, "leaf", "ball")] + [b(x, y, z, 8, 8, 8, "berry", "ball") for x, y, z in ((20, 70, 30), (40, 80, 20), (70, 60, 36), (60, 76, 14), (30, 50, 46))], {"leaf": slot("leaf", 0), "berry": slot("fabric", 3)}),
    ("picnic_blanket", "Плед для пікніку", 35, 2, 2, "rug", [b(10, 10, 0, 180, 180, 2, "cloth")] + [b(10 + (i % 6) * 30, 10 + (i // 6) * 30, 2, 30, 30, 1, "check") for i in range(36) if (i + i // 6) % 2 == 0] + [b(140, 40, 3, 40, 30, 20, "basket", "round")], {"cloth": slot("ceramic", 0), "check": slot("fabric", 1), "basket": slot("wood", 3)}),
    ("garden_lights", "Садові ліхтарики", 40, 1, 1, "floor", [b(46, 46, 0, 8, 8, 30, "metal", "cyl"), b(40, 40, 30, 20, 20, 14, "bulb", "ball")], {"metal": slot("metal", 2), "bulb": slot("pastel", 3)}),
]:
    item(id, "garden", w, d, layer, model, slots_, coins(price), ["sit"] if id == "log_bench" else (["water_plant"] if id in ("tulips", "berry_bush", "rose_arch") else None), name=name)
tag("garden_lights", "light")


# ---- vegetable garden ---------------------------------------------------------------------------------------
def bed(id, name, price, crop, w=2, d=1, rows=2):
    """A raised wooden bed with soil and a crop planted in rows."""
    W, D = w * 100, d * 100
    model = [b(0, 0, 0, W, D, 16, "wood", "round"), b(6, 6, 12, W - 12, D - 12, 6, "soil")]
    model += crop(W, D)
    slots = {"wood": slot("wood", 2), "soil": slot("earth", 0), "leaf": slot("leaf", 1), "veg": slot("fabric", 1)}
    item(id, "farm", w, d, "floor", model, slots, coins(price), ["harvest", "water_plant"], name=name)


def plants(W, D, n, top, size, veg=None, vegsize=10, shape="ball"):
    out = []
    for i in range(n):
        x = 14 + i * ((W - 28) // max(1, n - 1)) if n > 1 else W // 2
        for y in ([D // 2] if D <= 100 else [D // 3, 2 * D // 3]):
            x = max(size // 2 + 4, min(W - size // 2 - 4, x))
            out.append(b(x - size // 2, y - size // 2, 18, size, size, top, "leaf", shape))
            if veg:
                for vx, vy, vz in veg:
                    out.append(b(x - size // 2 + vx, y - size // 2 + vy, 18 + vz, vegsize, vegsize, vegsize, "veg", "ball"))
    return out


bed("bed_tomatoes", "Грядка з помідорами", 70, lambda W, D: [b(14 + i * 42, 40, 18, 4, 4, 60, "wood", "cyl") for i in range(5)] + plants(W, D, 5, 50, 22, [(2, 18, 20), (12, 2, 34), (6, 10, 8)]))
bed("bed_carrots", "Грядка з морквою", 50, lambda W, D: plants(W, D, 7, 18, 14, [(3, 10, -4)], 8, "cone"))
bed("bed_cabbage", "Грядка з капустою", 55, lambda W, D: plants(W, D, 4, 26, 30))
bed("bed_potatoes", "Грядка з картоплею", 45, lambda W, D: plants(W, D, 5, 24, 26, [(10, 22, -6)], 8))
bed("bed_strawberries", "Полуниця", 65, lambda W, D: plants(W, D, 6, 12, 20, [(2, 14, 2), (12, 4, 4)], 8))
bed("bed_peppers", "Перець", 60, lambda W, D: plants(W, D, 5, 34, 20, [(4, 14, 12), (12, 6, 22)], 9))
bed("bed_cucumbers", "Огірки на шпалері", 75, lambda W, D: [b(10, 44, 18, 4, 4, 90, "wood", "cyl"), b(W - 14, 44, 18, 4, 4, 90, "wood", "cyl"), b(10, 44, 104, W - 20, 4, 4, "wood")]
    + [b(16 + i * 30, 36, 30 + (i % 2) * 20, 26, 20, 56, "leaf", "ball") for i in range(6)] + [b(24 + i * 30, 52, 40 + (i % 3) * 14, 6, 6, 14, "veg", "cyl") for i in range(5)])
bed("bed_herbs", "Пряні трави", 40, lambda W, D: plants(W, D, 6, 20, 16), w=1, d=2)
for it in items:
    if it["id"] in ("bed_carrots",):
        it["slots"]["veg"] = slot("fabric", 2)
    if it["id"] in ("bed_cucumbers", "bed_herbs"):
        it["slots"]["veg"] = slot("leaf", 0)
    if it["id"] == "bed_potatoes":
        it["slots"]["veg"] = slot("wood", 3)
    if it["id"] == "bed_peppers":
        it["slots"]["veg"] = slot("fabric", 2)
item("corn_row", "farm", 2, 1, "floor", [b(0, 0, 0, 200, 100, 8, "soil", "round")] + [b(14 + i * 34, 40, 6, 6, 6, 110, "leaf", "cyl") for i in range(6)]
     + [b(8 + i * 34, 30, 40 + (i % 2) * 20, 18, 26, 40, "leaf", "ball") for i in range(6)] + [b(16 + i * 34, 46, 80, 8, 8, 24, "veg", "cyl") for i in range(6)],
     {"soil": slot("earth", 0), "leaf": slot("leaf", 0), "veg": slot("fabric", 2)}, coins(70), ["harvest", "water_plant"], name="Кукурудза")
item("pumpkin_patch", "farm", 2, 2, "floor", [b(0, 0, 0, 200, 200, 6, "soil", "round"), b(20, 20, 6, 160, 160, 10, "leaf", "ball")]
     + [b(x, y, 6, 44, 44, 30, "veg", "ball") for x, y in ((24, 30), (120, 40), (70, 110), (130, 130))],
     {"soil": slot("earth", 0), "leaf": slot("leaf", 1), "veg": slot("fabric", 2)}, coins(90), ["harvest", "water_plant"], name="Гарбузи")
item("greenhouse", "farm", 2, 2, "floor",
     [b(0, 0, 0, 200, 200, 8, "frame")] + [b(x, y, 8, 6, 6, 120, "frame") for x in (0, 194) for y in (0, 194)]
     + [b(10, 10, 8, 80, 180, 16, "soil"), b(14, 20, 24, 70, 160, 30, "leaf", "round"), b(0, 0, 128, 200, 200, 50, "glass", "cone"), b(0, 0, 8, 200, 200, 120, "glass")],
     {"frame": slot("ceramic", 0), "soil": slot("earth", 0), "leaf": slot("leaf", 1), "glass": slot("glass", 0)}, {"all": [coins(320), token("leaf", 4)]}, ["harvest", "water_plant"], name="Теплиця")
item("scarecrow", "farm", 1, 1, "floor", [b(47, 47, 0, 6, 6, 120, "wood", "cyl"), b(10, 46, 80, 80, 8, 6, "wood"), b(30, 40, 50, 40, 20, 46, "shirt", "round"), b(36, 38, 96, 28, 26, 26, "head", "ball"), b(30, 34, 118, 40, 34, 10, "hat", "cone"), b(8, 44, 70, 12, 10, 14, "straw", "ball"), b(80, 44, 70, 12, 10, 14, "straw", "ball")],
     {"wood": slot("wood", 2), "shirt": slot("fabric", 1), "head": slot("wood", 3), "hat": slot("wood", 2), "straw": slot("wood", 3)}, coins(60), name="Опудало")
item("compost_bin", "farm", 1, 1, "floor", [b(10, 10, 0, 80, 80, 50, "wood")] + [b(10, 88, 6 + i * 14, 80, 2, 8, "slat") for i in range(3)] + [b(16, 16, 46, 68, 68, 8, "soil", "ball")],
     {"wood": slot("wood", 1), "slat": slot("wood", 2), "soil": slot("earth", 0)}, coins(35), name="Компостер")
item("rain_barrel", "farm", 1, 1, "floor", [b(20, 20, 0, 60, 60, 70, "wood", "cyl"), b(18, 18, 20, 64, 64, 4, "metal", "cyl"), b(18, 18, 52, 64, 64, 4, "metal", "cyl"), b(26, 26, 70, 48, 48, 2, "water", "cyl"), b(78, 46, 16, 10, 6, 6, "metal")],
     {"wood": slot("wood", 2), "metal": slot("metal", 2), "water": slot("glass", 1)}, coins(45), ["water_plant"], name="Бочка для дощу")
item("tool_shed", "farm", 2, 2, "floor", [b(4, 4, 0, 192, 192, 120, "wood"), b(60, 194, 0, 80, 4, 100, "door"), b(124, 196, 50, 8, 2, 8, "metal", "ball"), b(0, 0, 120, 200, 200, 50, "roof", "cone"), b(20, 196, 70, 30, 2, 26, "glass")],
     {"wood": slot("wood", 1), "door": slot("wood", 2), "metal": slot("metal", 1), "roof": slot("fabric", 1), "glass": slot("glass", 0)}, coins(240), name="Сарай")
item("watering_can", "farm", 1, 1, "floor", [b(30, 34, 0, 36, 30, 26, "body", "cyl"), b(66, 44, 14, 24, 8, 6, "body"), b(36, 44, 26, 24, 10, 10, "body", "round")],
     {"body": slot("fabric", 4)}, coins(15), ["water_plant"], name="Лійка")
item("veg_crate", "farm", 1, 1, "floor", [b(14, 20, 0, 72, 60, 30, "wood")] + [b(20 + (i % 3) * 20, 26 + (i // 3) * 24, 24, 18, 18, 16, ["v1", "v2", "v3"][i % 3], "ball") for i in range(6)],
     {"wood": slot("wood", 3), "v1": slot("fabric", 1), "v2": slot("fabric", 2), "v3": slot("leaf", 1)}, coins(30), ["harvest"], name="Ящик з урожаєм")
item("garden_tools", "farm", 1, 1, "wall", [b(10, 0, 100, 80, 6, 8, "wood"), b(20, 6, 30, 4, 4, 80, "handle"), b(14, 6, 30, 16, 6, 20, "metal"), b(48, 6, 40, 4, 4, 70, "handle"), b(42, 6, 36, 16, 8, 10, "metal"), b(76, 6, 20, 4, 4, 86, "handle"), b(70, 6, 16, 16, 6, 8, "metal")],
     {"wood": slot("wood", 2), "handle": slot("wood", 1), "metal": slot("metal", 0)}, coins(35), name="Садовий інвентар")
item("apple_basket", "farm", 1, 1, "floor", [b(26, 26, 0, 48, 48, 26, "wood", "cyl"), b(30, 30, 20, 40, 40, 14, "veg", "ball"), b(46, 30, 26, 4, 40, 26, "wood")],
     {"wood": slot("wood", 3), "veg": slot("fabric", 1)}, coins(20), ["harvest"], name="Кошик яблук")


# ---- orangery -------------------------------------------------------------------------------------------------
def tub_tree(id, name, price, fruit, leaf=("leaf", 0), fruit_slot=("fabric", 2), tall=90):
    model = [b(18, 18, 0, 64, 64, 34, "tub", "round"), b(14, 14, 30, 72, 72, 6, "tub", "round"), b(22, 22, 34, 56, 56, 3, "soil"),
             b(45, 45, 36, 10, 10, tall - 30, "trunk", "cyl"), b(8, 8, tall, 84, 84, 56, "leaf", "ball"), b(22, 22, tall + 34, 56, 56, 30, "leaf", "ball")]
    # fruit hangs on the outside of the crown, where it can be seen
    model += [b(x, min(y + 20, 86), tall + z, 10, 10, 10, "fruit", "ball") for x, y, z in fruit] + [b(86, x, tall + z + 6, 10, 10, 10, "fruit", "ball") for x, _, z in fruit[:2]]
    item(id, "orangery", 1, 1, "floor", model, {"tub": slot("pot", 0), "soil": slot("earth", 0), "trunk": slot("wood", 2), "leaf": slot(*leaf), "fruit": slot(*fruit_slot)},
         coins(price), ["harvest", "water_plant"], name=name)


tub_tree("orange_tree", "Апельсинове дерево", 180, [(14, 60, 20), (60, 70, 30), (70, 30, 14), (34, 40, 44), (50, 76, 6)])
tub_tree("lemon_tree", "Лимонне дерево", 170, [(18, 64, 16), (66, 66, 26), (72, 26, 20), (40, 70, 40)], fruit_slot=("pastel", 3))
tub_tree("fig_tree", "Інжир", 160, [(20, 60, 18), (66, 60, 28), (44, 74, 10)], leaf=("leaf", 2), fruit_slot=("fabric", 3), tall=80)
item("banana_plant", "orangery", 1, 1, "floor", [b(22, 22, 0, 56, 56, 30, "pot", "cyl"), b(44, 44, 30, 12, 12, 60, "stem", "cyl"), b(0, 30, 70, 50, 30, 20, "leaf", "ball"), b(50, 20, 80, 50, 30, 20, "leaf", "ball"), b(30, 50, 96, 40, 50, 20, "leaf", "ball"), b(56, 56, 60, 14, 10, 20, "fruit", "cyl")],
     {"pot": slot("pot", 1), "stem": slot("leaf", 3), "leaf": slot("leaf", 1), "fruit": slot("pastel", 3)}, coins(120), ["water_plant"], name="Банан")
item("bird_of_paradise", "orangery", 1, 1, "floor", [b(26, 26, 0, 48, 48, 26, "pot", "cyl"), b(30, 36, 26, 14, 12, 60, "leaf", "round"), b(56, 30, 26, 14, 12, 70, "leaf", "round"), b(44, 50, 26, 12, 14, 50, "leaf", "round"), b(40, 40, 86, 24, 8, 8, "flower", "round"), b(58, 40, 90, 10, 6, 14, "flower2", "cone")],
     {"pot": slot("ceramic", 5), "leaf": slot("leaf", 0), "flower": slot("fabric", 2), "flower2": slot("fabric", 6)}, coins(95), ["water_plant"], name="Стреліція")
item("big_palm_pot", "orangery", 1, 1, "floor", [b(18, 18, 0, 64, 64, 40, "pot", "round"), b(44, 44, 40, 12, 12, 90, "trunk", "cyl"), b(0, 30, 124, 100, 30, 14, "leaf", "ball"), b(30, 0, 128, 30, 100, 14, "leaf", "ball"), b(20, 20, 134, 60, 60, 18, "leaf", "ball")],
     {"pot": slot("ceramic", 0), "trunk": slot("wood", 2), "leaf": slot("leaf", 1)}, coins(130), ["water_plant"], name="Пальма у вазоні")
item("wicker_chair", "orangery", 1, 1, "floor", [b(14, 14, 0, 72, 72, 30, "rattan", "cyl"), b(10, 10, 30, 80, 80, 8, "rattan", "cyl"), b(10, 6, 38, 80, 24, 60, "rattan", "round"), b(18, 20, 38, 64, 60, 8, "cushion", "round")],
     {"rattan": slot("wood", 3), "cushion": slot("fabric", 4)}, coins(80), ["sit", "rest"], name="Плетене крісло")
item("wicker_sofa", "orangery", 2, 1, "floor", [b(4, 8, 0, 192, 88, 30, "rattan", "round"), b(4, 4, 30, 192, 22, 40, "rattan", "round"), b(4, 22, 30, 18, 78, 22, "rattan", "round"), b(178, 22, 30, 18, 78, 22, "rattan", "round"), b(22, 26, 30, 156, 70, 10, "cushion", "round")],
     {"rattan": slot("wood", 3), "cushion": slot("fabric", 0)}, coins(170), ["sit", "rest"], name="Плетений диван")
item("tiled_fountain", "orangery", 1, 1, "floor", [b(6, 6, 0, 88, 88, 24, "tile", "round"), b(14, 14, 20, 72, 72, 4, "water", "round"), b(40, 40, 24, 20, 20, 30, "tile", "cyl"), b(46, 46, 54, 8, 8, 16, "spray", "cone")],
     {"tile": slot("pot", 0), "water": slot("glass", 1), "spray": slot("glass", 2)}, coins(150), name="Кахляний фонтанчик")
item("potting_bench", "orangery", 2, 1, "floor", [b(4, 20, 0, 8, 8, 50, "wood"), b(188, 20, 0, 8, 8, 50, "wood"), b(4, 72, 0, 8, 8, 50, "wood"), b(188, 72, 0, 8, 8, 50, "wood"), b(0, 14, 50, 200, 72, 6, "wood"), b(0, 6, 56, 200, 8, 40, "wood"),
     b(20, 30, 56, 20, 20, 18, "pot", "cyl"), b(52, 34, 56, 18, 18, 14, "pot", "cyl"), b(20, 30, 72, 22, 22, 14, "leaf", "ball"), b(140, 30, 56, 40, 30, 10, "soil", "round"), b(10, 30, 12, 180, 50, 4, "wood")],
     {"wood": slot("wood", 1), "pot": slot("pot", 0), "leaf": slot("leaf", 1), "soil": slot("earth", 0)}, coins(110), ["water_plant"], name="Стіл для розсади")
item("orchid_stand", "orangery", 1, 1, "floor", [b(40, 40, 0, 20, 20, 6, "metal", "cyl"), b(47, 47, 6, 6, 6, 80, "metal", "cyl"), b(26, 26, 80, 48, 48, 4, "metal", "cyl"), b(34, 34, 84, 32, 32, 14, "pot", "cyl"), b(46, 46, 98, 4, 4, 26, "leaf", "cyl"), b(36, 40, 116, 14, 12, 10, "flower", "ball"), b(50, 48, 122, 14, 12, 10, "flower", "ball")],
     {"metal": slot("metal", 2), "pot": slot("ceramic", 0), "leaf": slot("leaf", 0), "flower": slot("fabric", 7)}, coins(70), ["water_plant"], name="Підставка з орхідеєю")
item("hanging_basket", "orangery", 1, 1, "wall", [b(46, 0, 168, 8, 24, 4, "metal"), b(48, 20, 130, 3, 3, 38, "metal"), b(26, 6, 108, 48, 40, 24, "basket", "cyl"), b(16, 4, 88, 68, 50, 30, "leaf", "ball"), b(24, 10, 80, 12, 10, 10, "flower", "ball"), b(60, 20, 84, 12, 10, 10, "flower", "ball")],
     {"metal": slot("metal", 2), "basket": slot("wood", 3), "leaf": slot("leaf", 1), "flower": slot("fabric", 1)}, coins(50), ["water_plant"], name="Підвісний кошик")
item("citrus_bowl", "orangery", 1, 1, "surface", [b(22, 22, 0, 56, 56, 12, "bowl", "cyl"), b(28, 30, 8, 20, 20, 18, "a", "ball"), b(48, 34, 8, 20, 20, 18, "b", "ball"), b(38, 46, 12, 20, 20, 18, "a", "ball")],
     {"bowl": slot("ceramic", 0), "a": slot("fabric", 2), "b": slot("pastel", 3)}, coins(25), ["harvest"], name="Миска з цитрусами")


# the village: its buildings (items), then (after the styles) its map and people
exec((pathlib.Path(__file__).resolve().parent / "village_items.py").read_text(encoding="utf-8"))

# ---- every side worked: the backs of seats get seams and buttons (a piano's back is as good as its front); case
# furniture gets its front, sides and back from facing.py (run again at the end for what is added later)
def back_details():
    for it in items:
        if it["layer"] != "floor" or it["category"] != "seating":
            continue
        backs = [m for m in it["model"] if m["box"][1] == 0 and m["box"][3] >= 60 and m["box"][5] >= 30 and m.get("shape") in (None, "box", "round")]
        if not backs:
            continue
        bx, by, bz, bw, bd, bh = max(backs, key=lambda m: m["box"][3] * m["box"][5])["box"]
        slot_ = max(backs, key=lambda m: m["box"][3] * m["box"][5])["slot"]
        extra = []
        for x in range(bx + 30, bx + bw - 10, 40):
            extra.append(b(x, 0, bz + 6, 2, 2, bh - 12, slot_))
        for x in range(bx + 20, bx + bw - 10, 40):
            for z in range(bz + 12, bz + bh - 6, 18):
                extra.append(b(x, 0, z, 4, 2, 4, slot_))
        it["model"] = it["model"] + extra


back_details()
exec((pathlib.Path(__file__).resolve().parent / "facing.py").read_text(encoding="utf-8"))
face_items()
exec((pathlib.Path(__file__).resolve().parent / "public_items.py").read_text(encoding="utf-8"))
exec((pathlib.Path(__file__).resolve().parent / "world_items.py").read_text(encoding="utf-8"))
exec((pathlib.Path(__file__).resolve().parent / "cute_animals.py").read_text(encoding="utf-8"))
exec((pathlib.Path(__file__).resolve().parent / "town_items.py").read_text(encoding="utf-8"))
exec((pathlib.Path(__file__).resolve().parent / "home_items.py").read_text(encoding="utf-8"))
exec((pathlib.Path(__file__).resolve().parent / "festive_items.py").read_text(encoding="utf-8"))
exec((pathlib.Path(__file__).resolve().parent / "style_items.py").read_text(encoding="utf-8"))
exec((pathlib.Path(__file__).resolve().parent / "town_things.py").read_text(encoding="utf-8"))
exec((pathlib.Path(__file__).resolve().parent / "driving_items.py").read_text(encoding="utf-8"))
# the shops and businesses, each its own shape (before growth_items.py: its worn variants copy them)
exec((pathlib.Path(__file__).resolve().parent / "shop_fronts.py").read_text(encoding="utf-8"))
exec((pathlib.Path(__file__).resolve().parent / "growth_items.py").read_text(encoding="utf-8"))
exec((pathlib.Path(__file__).resolve().parent / "faiths_items.py").read_text(encoding="utf-8"))
exec((pathlib.Path(__file__).resolve().parent / "square_items.py").read_text(encoding="utf-8"))
exec((pathlib.Path(__file__).resolve().parent / "games_items.py").read_text(encoding="utf-8"))
# partitions, stock, stands and counters for the bigger shop and office interiors (scripts/interior_items.py)
exec((pathlib.Path(__file__).resolve().parent / "interior_items.py").read_text(encoding="utf-8"))

TAGS = {
    "window_basic": ["window"], "window_tall": ["window"], "window_wide": ["window"], "window_round": ["window"],
    "door_basic": ["door"], "door_arch": ["door"], "door_double": ["door"], "door_garden": ["door"], "mirror": ["mirror"], "aquarium": ["aquarium"],
}
LIGHTS = ("floor_lamp", "table_lamp", "lantern", "wall_lamp", "candle", "lava_lamp", "floor_orb", "string_lights", "neon_sign", "fireplace")
for it in items:
    if it["id"] in TAGS:
        it["tags"] = TAGS[it["id"]]
    if it["id"] in LIGHTS:
        it["tags"] = ["light"]
    if it["id"] in ("tv", "radio"):
        it["tags"] = ["switch"]
for it in items:
    if it["id"] in EXTRA_TAGS:
        it["tags"] = EXTRA_TAGS[it["id"]]


actions = [
    ("sit", 10), ("read", 15), ("brew_tea", 5), ("water_plant", 2), ("feed_cat", 2), ("rest", 20), ("enter", 1),
    ("listen", 10), ("play_music", 20), ("paint", 25), ("harvest", 8), ("wash", 2),
]

# Nothing done at home pays: no coins, no tokens. The home is to live in; it could be repeated for ever and would
# turn the room into a job. Coins come from helping the town's people (their requests).
rewards = []

styles = []


def style(sid, kind, params, price=None, acquire=None):
    styles.append({"id": sid, "kind": kind, "name": f"style.{sid}", "params": params,
                   "acquire": acquire or ("free" if price is None else coins(price))})


# floors: id, base, alt, pattern, price
for sid, color, alt, pattern, price in [
    ("floor.oak", "#c28f5c", "#b8834f", "planks", None),
    ("floor.pine", "#d9b98a", "#c9a878", "planks", 60),
    ("floor.walnut", "#7a5238", "#6c4730", "planks", 90),
    ("floor.ash", "#cfc7b8", "#c2baa9", "planks", 70),
    ("floor.slate", "#6a7080", "#5c6270", "tiles", 120),
    ("floor.terracotta", "#c8694a", "#b85d40", "tiles", 110),
    ("floor.checker", "#e8e0c8", "#3a3a48", "checker", 140),
    ("floor.herring", "#a8743c", "#97672f", "herringbone", 180),
    ("floor.marble", "#e6e6ee", "#c9cad8", "marble", 260),
    ("floor.carpet_rose", "#c97a8c", "#b86b7d", "carpet", 100),
    ("floor.carpet_moss", "#5f8f68", "#52805a", "carpet", 100),
    ("floor.midnight", "#2c3250", "#262b45", "tiles", 150),
    ("floor.terracotta_tiles", "#c8694a", "#e8d4b8", "tiles", None),
]:
    style(sid, "floor", {"color": color, "alt": alt, "pattern": pattern}, price)
# outside: no walls around these cells, earth under their edge
for sid, color, alt, pattern, price in [
    ("floor.grass", "#6aa84f", "#5a9443", "grass", None),
    ("floor.meadow", "#86b85a", "#e8d46a", "meadow", 40),
    ("floor.path", "#b9b3a6", "#9a9488", "stones", None),
    ("floor.gravel", "#c9bfa8", "#a89e88", "gravel", 30),
    ("floor.deck", "#a8743c", "#8a5a2e", "planks", 60),
    ("floor.soil", "#6e4a2e", "#5a3a24", "soil", 20),
    ("floor.cobble", "#a89a88", "#6e6458", "stones", 50),
    ("floor.plaza", "#e0d4bc", "#a89c86", "stones", 70),
    ("floor.sand", "#ecd9a6", "#d2bb84", "sand", 40),
    ("floor.water", "#4a8fc0", "#a8d8ea", "water", 120),
    # a lake frozen over in winter (laid by the client on the still water on frosty days, never placed)
    ("floor.ice", "#c4dcee", "#f2f8fc", "ice", None),
    ("floor.moss", "#4f7f3c", "#3f6a30", "grass", 40),
    ("floor.dirt", "#9a7650", "#7e5e3e", "soil", 20),
]:
    style(sid, "floor", {"color": color, "alt": alt, "pattern": pattern, "outdoor": "1"}, price)

# walls: id, left, right, pattern, price
for sid, left, right, pattern, price in [
    ("wall.plum", "#6a5688", "#7d68a0", "plain", None),
    ("wall.sage", "#5f7f6a", "#6f9179", "plain", 60),
    ("wall.ink", "#2f3a5a", "#3a4870", "plain", 100),
    ("wall.cream", "#d8ccb0", "#e6dcc4", "plain", 70),
    ("wall.brick", "#a8553f", "#b96650", "brick", 120),
    ("wall.stripe_blue", "#4a6a9a", "#5a7cae", "stripes", 110),
    ("wall.stripe_rose", "#c98a9a", "#d99cac", "stripes", 110),
    ("wall.panel_oak", "#8a6240", "#9a7050", "panels", 160),
    ("wall.wainscot", "#7f9a9a", "#92acac", "wainscot", 150),
    ("wall.dots", "#e0a8a0", "#ecb8b0", "dots", 90),
    ("wall.charcoal", "#3a3a44", "#46464f", "plain", 80),
    ("wall.sunset", "#d98a5a", "#e89c6c", "plain", 90),
]:
    style(sid, "wall", {"color": left, "color_right": right, "pattern": pattern}, price)
style("wall.glass", "wall", {"color": "#9fcbe8", "color_right": "#b6d9f0", "pattern": "glass"}, None)
style("wall.glass_green", "wall", {"color": "#9fd8c4", "color_right": "#b4e4d2", "pattern": "glass"}, 90)
# underground: the cave's floor and its rock walls
style("floor.cave", "floor", {"color": "#4e4a56", "alt": "#3e3a46", "pattern": "stones"}, 80)
style("wall.rock", "wall", {"color": "#4a4652", "color_right": "#5a5662", "pattern": "brick"}, 80)

# what lies around the room
for sid, kind, price in [
    ("backdrop.sky", "sky", None), ("backdrop.void", "void", None), ("backdrop.forest", "forest", 120),
    ("backdrop.city", "city", 160), ("backdrop.sea", "sea", 200), ("backdrop.mountains", "mountains", 200),
    ("backdrop.space", "space", 260),
]:
    style(sid, "backdrop", {"kind": kind}, price)
for sid, kind, price in [
    ("weather.none", "none", None), ("weather.rain", "rain", 80), ("weather.snow", "snow", 80),
    ("weather.fog", "fog", 70), ("weather.fireflies", "fireflies", 120), ("weather.petals", "petals", 120),
]:
    style(sid, "weather", {"kind": kind}, price)

themes = [
    {"id": "theme.cozy", "name": "theme.cozy", "styles": {"floor": "floor.oak", "wall": "wall.cream", "backdrop": "backdrop.sky", "weather": "weather.none"},
     "settings": {"time_mode": "real", "ambient_color": "#ffb36a", "ambient_strength": "25", "wall_mode": "cut"}, "acquire": "free"},
    {"id": "theme.rainy_loft", "name": "theme.rainy_loft", "styles": {"floor": "floor.slate", "wall": "wall.brick", "backdrop": "backdrop.city", "weather": "weather.rain"},
     "settings": {"time_mode": "fixed", "time_fixed": "20:30", "ambient_color": "#6a8fd0", "ambient_strength": "30"}, "acquire": coins(300)},
    {"id": "theme.forest_cabin", "name": "theme.forest_cabin", "styles": {"floor": "floor.walnut", "wall": "wall.panel_oak", "backdrop": "backdrop.forest", "weather": "weather.fireflies"},
     "settings": {"time_mode": "fixed", "time_fixed": "19:30", "ambient_color": "#ffcf7a", "ambient_strength": "30"}, "acquire": coins(320)},
    {"id": "theme.starlight", "name": "theme.starlight", "styles": {"floor": "floor.midnight", "wall": "wall.ink", "backdrop": "backdrop.space", "weather": "weather.none"},
     "settings": {"time_mode": "fixed", "time_fixed": "23:30", "ambient_color": "#8a63c9", "ambient_strength": "35"}, "acquire": coins(400)},
    {"id": "theme.sakura", "name": "theme.sakura", "styles": {"floor": "floor.ash", "wall": "wall.stripe_rose", "backdrop": "backdrop.mountains", "weather": "weather.petals"},
     "settings": {"time_mode": "fixed", "time_fixed": "10:00", "ambient_color": "#ffb0c8", "ambient_strength": "20"}, "acquire": coins(350)},
]

exec((pathlib.Path(__file__).resolve().parent / "world_maps.py").read_text(encoding="utf-8"))
exec((pathlib.Path(__file__).resolve().parent / "interiors.py").read_text(encoding="utf-8"))
exec((pathlib.Path(__file__).resolve().parent / "town_rooms.py").read_text(encoding="utf-8"))
exec((pathlib.Path(__file__).resolve().parent / "residents.py").read_text(encoding="utf-8"))
exec((pathlib.Path(__file__).resolve().parent / "village_people.py").read_text(encoding="utf-8"))
exec((pathlib.Path(__file__).resolve().parent / "daily_content.py").read_text(encoding="utf-8"))
exec((pathlib.Path(__file__).resolve().parent / "economy.py").read_text(encoding="utf-8"))
exec((pathlib.Path(__file__).resolve().parent / "festival_food.py").read_text(encoding="utf-8"))
exec((pathlib.Path(__file__).resolve().parent / "home_life.py").read_text(encoding="utf-8"))
exec((pathlib.Path(__file__).resolve().parent / "quests.py").read_text(encoding="utf-8"))
exec((pathlib.Path(__file__).resolve().parent / "first_letters.py").read_text(encoding="utf-8"))
exec((pathlib.Path(__file__).resolve().parent / "rift.py").read_text(encoding="utf-8"))
exec((pathlib.Path(__file__).resolve().parent / "work_garden.py").read_text(encoding="utf-8"))
exec((pathlib.Path(__file__).resolve().parent / "town_life.py").read_text(encoding="utf-8"))
exec((pathlib.Path(__file__).resolve().parent / "craft_items.py").read_text(encoding="utf-8"))
exec((pathlib.Path(__file__).resolve().parent / "media_items.py").read_text(encoding="utf-8"))
exec((pathlib.Path(__file__).resolve().parent / "driving.py").read_text(encoding="utf-8"))
exec((pathlib.Path(__file__).resolve().parent / "growth_life.py").read_text(encoding="utf-8"))
exec((pathlib.Path(__file__).resolve().parent / "faiths.py").read_text(encoding="utf-8"))
exec((pathlib.Path(__file__).resolve().parent / "cinema.py").read_text(encoding="utf-8"))
exec((pathlib.Path(__file__).resolve().parent / "games.py").read_text(encoding="utf-8"))
exec((pathlib.Path(__file__).resolve().parent / "home_more.py").read_text(encoding="utf-8"))
for it in items:
    if it["category"] == "village":
        it["hidden"] = True
    extra = [t for t, ids in GIFT_TAGS.items() if it["id"] in ids]
    if extra:
        it["tags"] = sorted(set(it.get("tags", [])) | set(extra))

HOUSE_KIT = (["door_basic"] * 4 + ["door_garden"] + ["garden_gate"] + ["fence_picket"] * 8
             + ["counter", "counter_sink", "stove", "fridge", "round_dining", "dining_chair_wood", "dining_chair_wood"]
             + ["bed", "nightstand", "wardrobe", "rug_small"]
             + ["bathtub", "toilet", "washbasin", "bath_mat"]
             + ["tree_apple", "pond", "garden_bench", "flower_bed", "bush_round", "bush_flowering"]
             + ["bed_tomatoes", "scarecrow", "compost_bin"] + ["garden_plot"] * 6
             + ["lemon_tree", "orange_tree", "wicker_chair", "orchid_stand", "potting_bench"] + ["garden_tub"] * 2)
HOUSE_KIT = HOUSE_KIT + HOUSE_MORE

pack = {
    "schema": 1,
    "id": "base",
    "version": 1,
    "start_coins": 300,
    # items of 1.x the game no longer has (a save opens without them): the green gate to the world beyond the edge
    # at home, and two props only the places out there stood (crates/teul-core/src/content.rs, `retired`)
    "retired": ["portal_gate", "bridge", "planter_box"],
    "start_room": {"rect": {"x": 0, "y": 0, "w": 10, "h": 10}, "area": 520, "cell_price": 8},
    # the whole house for a new home (or an old one that has only its first room): doors, a few things per room
    # the first room's window and door and the cup and fern by the sofa: given once, like the house's kit
    "kits": [{"id": "kit.starter", "items": ["window_basic", "door_basic", "cup", "fern"], "styles": []},
             {"id": "kit.house", "items": HOUSE_KIT, "styles": ["floor.grass", "floor.soil", "wall.glass", "floor.terracotta_tiles", "floor.checker", "floor.slate", "floor.carpet_rose", "floor.path"]}],
    "start_styles": {"floor": "floor.oak", "wall": "wall.plum", "backdrop": "backdrop.sky", "weather": "weather.none"},
    "palettes": PALETTES,
    "items": items,
    "styles": styles,
    "actions": [{"id": a, "name": f"action.{a}", "minutes": m} for a, m in actions],
    "rewards": rewards,
    "materials": [
        {"id": "matte", "name": "material.matte", "kind": "matte"},
        {"id": "gloss", "name": "material.gloss", "kind": "gloss"},
        {"id": "wood_grain", "name": "material.wood_grain", "kind": "pattern", "params": {"pattern": "grain"}},
        {"id": "stripes", "name": "material.stripes", "kind": "pattern", "params": {"pattern": "stripes"}},
        {"id": "checker", "name": "material.checker", "kind": "pattern", "params": {"pattern": "checker"}},
        {"id": "dots", "name": "material.dots", "kind": "pattern", "params": {"pattern": "dots"}},
    ],
    "themes": themes,
    "locations": locations,
    "taxi": TAXI,
    "collections": collections,
    "residents": residents,
    "paper": paper,
    "npcs": npcs,
    "expansions": [
        {"id": "exp.nook", "name": "expansion.nook", "area": 30, "acquire": coins(250)},
        {"id": "exp.room", "name": "expansion.room", "area": 60, "acquire": coins(500)},
        # coins only: nothing grants tokens any more (the home pays nothing), so a token price could never be met
        {"id": "exp.wing", "name": "expansion.wing", "area": 120, "acquire": coins(900)},
        {"id": "exp.floor", "name": "expansion.floor", "area": 240, "acquire": coins(1600)},
        {"id": "exp.house", "name": "expansion.house", "area": 474, "acquire": coins(3000)},
    ],
}

# tokens are no longer earned anywhere (the home pays nothing): a price in tokens becomes coins, 30 a token
def coins_only(acq):
    if isinstance(acq, dict) and "all" in acq:
        total = sum(a.get("coins", 0) + 30 * a.get("token", {}).get("n", 0) for a in acq["all"] if "coins" in a or "token" in a)
        rest = [a for a in acq["all"] if "coins" not in a and "token" not in a]
        return {"all": rest + [coins(total)]} if rest else coins(total)
    if isinstance(acq, dict) and "token" in acq:
        return coins(30 * acq["token"]["n"])
    return acq


for it in items:
    it["acquire"] = coins_only(it["acquire"])
for th in themes:
    th["acquire"] = coins_only(th["acquire"])

# the world economy (docs/world-economy.md)
pack["pocket"] = POCKET
# the inventory took the pocket's place: up to 64 kinds, as many of a kind as one likes (the pocket's room stays for
# re-deriving what was done before it)
pack["inventory"] = 64
pack["stations"] = stations
pack["helps"] = helps
pack["interviews"] = interviews
# living at home (docs/world-economy.md §8)
pack["recipes"] = recipes
pack["bills"] = BILLS
# the year of Lypove: its people's requests through the year, and the day's small needs (docs/world-economy.md §9)
pack["quests"] = QUESTS
pack["jobs"] = JOBS
# work, the garden and skills (docs/world-economy.md §10)
pack["work"] = WORK
pack["plants"] = PLANTS
# how one looks and where one lives (docs/world-economy.md §11)
pack["fashion"] = FASHION
pack["homes"] = STYLE_HOMES
pack["stations"] = stations + PLOT_STATIONS
# a town that lives on: its projects, the shops that open, names for its babies (crates/teul-core/src/town.rs)
pack["projects"] = PROJECTS
pack["openings"] = OPENINGS
pack["births"] = BIRTHS
# things grow old, things are made with tools (crates/teul-core/src/wear.rs, craft.rs)
pack["wear"] = WEAR
pack["crafts"] = CRAFTS
pack["tools"] = TOOLS
# music one can play (crates/teul-core/src/media.rs; the scores are scripts/scores.py)
pack["pieces"] = PIECES
# the road: the driving school, the service station, fines (crates/teul-core/src/drive.rs)
pack["driving"] = DRIVING
# how the town grows and wears: building sites, empty houses, wear and mending, the ice-cream cart (growth.rs)
pack["growth"] = GROWTH
# rooms built on to the house, and the animals one lives with (builds.rs, pets.rs)
pack["builds"] = BUILDS
pack["pets"] = PETS

# wider streets: four lanes on the main street, three on the others (everything beyond them moves along)
exec((pathlib.Path(__file__).resolve().parent / "town_widen.py").read_text(encoding="utf-8"))
# the streets by name, for the maps app (scripts/map_streets.py)
exec((pathlib.Path(__file__).resolve().parent / "map_streets.py").read_text(encoding="utf-8"))
# a few words about every place, for the maps' card (scripts/site_about.py)
exec((pathlib.Path(__file__).resolve().parent / "site_about.py").read_text(encoding="utf-8"))

# the winter rift world is the finished (and widened) town itself, seen from the other side (scripts/rift.py)
make_mirror_town()
if not any(l["id"] == "rift_winter" for l in pack["locations"]):
    pack["locations"].append(locations[-1])

# when the shops and offices let people in (the hours cover their counters' and their jobs'); the hospital, the
# police, the fire station, the hostel and the water tower never close, and a friend's home is by invitation
PLACE_HOURS = {
    "school_in": (8, 18, "weekdays"), "cafe_in": (7, 22), "library_in": (9, 21), "grocery_in": (7, 21),
    "bakery_in": (5, 21), "post_in": (8, 21), "utility_in": (8, 18), "clothes_in": (9, 20), "salon_in": (9, 20),
    "flower_in": (8, 21), "workshop_in": (8, 19), "vet_in": (8, 19), "gym_in": (7, 22), "bar_in": (12, 2),
    "winery_in": (10, 20), "church_in": (7, 21), "factory_in": (6, 22), "creamery_in": (7, 21),
    "newsroom_in": (9, 19), "townhall_in": (8, 19), "radio_in": (8, 22), "hardware_in": (8, 20),
    "driving_in": (7, 20), "sto_in": (8, 20), "donuts_in": (7, 21), "temple_in": (6, 21), "cinema_in": (10, 24),
}
for loc in pack["locations"]:
    h = PLACE_HOURS.get(loc["id"])
    if h:
        loc["hours"] = [h[0], h[1]]
        if len(h) > 2:
            loc["days"] = h[2]

# fronts, sides and backs for the things added since the first pass (scripts/facing.py)
face_items()

import sys
if "--legacy" in sys.argv:
    # for a core that does not know the economy yet: the same pack without its new fields
    for k in ("pocket", "stations", "helps", "interviews", "recipes", "bills", "quests", "jobs", "work", "plants", "fashion", "homes", "projects", "openings", "births", "wear", "crafts", "tools", "pieces", "driving", "growth", "builds", "pets"):
        pack.pop(k)
    for it in items:
        for k in ("carry", "key", "bag"):
            it.pop(k, None)
    for loc in locations:
        loc.pop("requires", None)
        loc.pop("landmarks", None)

out = pathlib.Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else pathlib.Path(__file__).resolve().parent.parent / "content" / "base" / "pack.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(pack, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print(f"wrote {out} with {len(items)} items")

# the same words in English: a text overlay keyed by content id and field (scripts/lang_en.py)
if "--legacy" not in sys.argv and "--out" not in sys.argv:
    import subprocess
    subprocess.run([sys.executable, str(pathlib.Path(__file__).resolve().parent / "lang_en.py")], check=False)
