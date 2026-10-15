# The furniture of the village's public rooms (a classroom, a ward, a shop floor...), the workshop and its
# building, and the worn things people throw away. Run inside gen_base_content.py after the catalogue.
# Public furniture belongs to the village (category "village": never sold); worn things are found by the bins
# and mended at the workshop into the things they once were.

import copy
import re

# ---- public furniture: every side worked, like the rest
item("school_desk", "village", 1, 1, "floor",
     [b(10, 8, 0, 6, 6, 50, "frame"), b(84, 8, 0, 6, 6, 50, "frame"), b(10, 40, 0, 6, 6, 50, "frame"), b(84, 40, 0, 6, 6, 50, "frame"),
      b(6, 4, 50, 88, 48, 5, "top", "round"), b(12, 10, 40, 76, 36, 4, "frame"), b(20, 14, 55, 30, 22, 2, "book"), b(60, 16, 55, 18, 4, 2, "pencil"),
      # the chair behind it
      b(22, 62, 0, 5, 5, 28, "frame"), b(72, 62, 0, 5, 5, 28, "frame"), b(22, 90, 0, 5, 5, 58, "frame"), b(72, 90, 0, 5, 5, 58, "frame"),
      b(18, 58, 28, 64, 38, 4, "seat", "round"), b(18, 92, 40, 64, 4, 22, "seat", "round")],
     {"frame": slot("metal", 2), "top": slot("wood", 3), "seat": slot("wood", 1), "book": slot("fabric", 6), "pencil": slot("fabric", 2)}, "free", name="Шкільна парта")
item("blackboard", "village", 3, 1, "wall",
     [b(6, 0, 60, 288, 4, 100, "frame"), b(12, 4, 66, 276, 1, 88, "board"), b(30, 5, 130, 90, 1, 3, "chalk"), b(30, 5, 118, 120, 1, 3, "chalk"), b(150, 5, 100, 70, 1, 3, "chalk"),
      b(30, 5, 90, 50, 1, 3, "chalk"), b(10, 4, 58, 280, 10, 4, "frame"), b(200, 6, 62, 20, 6, 4, "chalk")],
     {"frame": slot("wood", 1), "board": slot("leaf", 0), "chalk": slot("ceramic", 0)}, "free", name="Шкільна дошка")
item("hospital_bed", "village", 1, 2, "floor",
     [b(8, 8, 0, 6, 6, 40, "frame", "cyl"), b(86, 8, 0, 6, 6, 40, "frame", "cyl"), b(8, 186, 0, 6, 6, 40, "frame", "cyl"), b(86, 186, 0, 6, 6, 40, "frame", "cyl"),
      b(6, 6, 30, 88, 188, 8, "frame"), b(10, 10, 38, 80, 180, 14, "sheet", "round"), b(14, 14, 50, 72, 36, 12, "pillow", "round"), b(10, 80, 50, 80, 110, 6, "blanket", "round"),
      b(6, 4, 30, 88, 4, 60, "frame"), b(6, 192, 30, 88, 4, 40, "frame"), b(2, 60, 50, 4, 80, 20, "frame"), b(94, 60, 50, 4, 80, 20, "frame")],
     {"frame": slot("metal", 0), "sheet": slot("ceramic", 0), "pillow": slot("ceramic", 0), "blanket": slot("glass", 1)}, "free", ["rest"], name="Лікарняне ліжко")
item("medical_cabinet", "village", 1, 1, "floor",
     [b(10, 20, 0, 80, 60, 130, "body", "round"), b(14, 80, 10, 34, 2, 110, "glass"), b(52, 80, 10, 34, 2, 110, "glass"), b(36, 81, 104, 28, 2, 8, "cross"), b(46, 81, 94, 8, 2, 28, "cross"),
      b(16, 30, 40, 68, 46, 3, "body"), b(16, 30, 76, 68, 46, 3, "body"), b(20, 50, 44, 12, 12, 16, "bottle", "cyl"), b(40, 50, 44, 12, 12, 20, "bottle2", "cyl"), b(60, 50, 80, 16, 16, 14, "bottle", "cyl")],
     {"body": slot("ceramic", 0), "glass": slot("glass", 0), "cross": slot("fabric", 1), "bottle": slot("glass", 1), "bottle2": slot("fabric", 4)}, "free", name="Шафа з ліками")
item("screen_folding", "village", 2, 1, "floor",
     [b(10 + i * 62, 44, 0, 4, 4, 120, "frame", "cyl") for i in range(4)] + [b(14 + i * 62, 44, 14, 58, 4, 100, "cloth") for i in range(3)],
     {"frame": slot("metal", 0), "cloth": slot("glass", 3)}, "free", name="Ширма")
item("reception_desk", "village", 3, 1, "floor",
     [b(0, 30, 0, 300, 70, 70, "body"), b(0, 30, 70, 300, 70, 6, "top", "round"), b(0, 20, 76, 300, 10, 30, "top"), b(10, 100, 10, 280, 2, 50, "panel"),
      b(40, 50, 76, 40, 30, 30, "screen"), b(200, 46, 76, 30, 20, 8, "book")],
     {"body": slot("ceramic", 1), "top": slot("wood", 3), "panel": slot("glass", 1), "screen": slot("metal", 2), "book": slot("fabric", 6)}, "free", name="Стійка")
item("parcel_shelf", "village", 2, 1, "floor",
     [b(0, 0, 0, 8, 100, 160, "frame"), b(192, 0, 0, 8, 100, 160, "frame"), b(8, 0, 0, 184, 8, 160, "frame")]
     + [b(8, 8, z, 184, 92, 4, "frame") for z in (10, 60, 110, 156)]
     + [b(14 + i * 44, 16 + (i % 2) * 16, 14 + row * 50, 38 - (i + row) % 3 * 6, 60, 30 + (i % 2) * 10, ("p1", "p2", "p1")[(i + row) % 3]) for row in range(3) for i in range(4)]
     + [b(20 + i * 44, 60, 30 + row * 50, 24, 2, 4, "tape") for row in range(3) for i in range(4)],
     {"frame": slot("metal", 0), "p1": slot("wood", 1), "p2": slot("wood", 3), "tape": slot("fabric", 6)}, "free", name="Полиця з посилками")
item("po_boxes", "village", 2, 1, "floor",
     [b(0, 40, 0, 200, 60, 170, "body")]
     + [b(8 + c * 38, 98, 14 + r * 38, 32, 2, 32, "door") for r in range(4) for c in range(5)]
     + [b(20 + c * 38, 99, 26 + r * 38, 8, 2, 4, "lock") for r in range(4) for c in range(5)],
     {"body": slot("wood", 1), "door": slot("metal", 1), "lock": slot("metal", 2)}, "free", name="Абонентські скриньки")
item("parcel_scale", "village", 1, 1, "floor",
     [b(20, 20, 0, 60, 60, 60, "body"), b(14, 14, 60, 72, 72, 6, "plate"), b(30, 70, 30, 40, 4, 20, "dial", "round"), b(36, 26, 66, 30, 26, 22, "parcel")],
     {"body": slot("ceramic", 5), "plate": slot("metal", 0), "dial": slot("ceramic", 0), "parcel": slot("wood", 3)}, "free", name="Поштові ваги")
item("shop_shelf", "village", 2, 1, "floor",
     [b(0, 0, 0, 8, 100, 150, "frame"), b(192, 0, 0, 8, 100, 150, "frame"), b(8, 0, 0, 184, 8, 150, "frame")]
     + [b(8, 8, z, 184, 92, 4, "frame") for z in (10, 55, 100, 145)]
     + [b(12 + i * 30, 20 + (i % 2) * 20, 14, 24, 30, 30, ("g1", "g2", "g3")[i % 3], "round") for i in range(6)]
     + [b(12 + i * 36, 20, 59, 30, 50, 32, ("g2", "g3", "g1")[i % 3]) for i in range(5)]
     + [b(16 + i * 30, 30, 104, 18, 18, 34, ("g3", "g1", "g2")[i % 3], "cyl") for i in range(6)],
     {"frame": slot("metal", 0), "g1": slot("fabric", 1), "g2": slot("fabric", 2), "g3": slot("fabric", 4)}, "free", name="Полиця з товаром")
item("display_fridge", "village", 2, 1, "floor",
     [b(0, 10, 0, 200, 90, 170, "body", "round"), b(8, 96, 10, 90, 2, 150, "glass"), b(102, 96, 10, 90, 2, 150, "glass"), b(94, 98, 60, 4, 4, 40, "body")]
     + [b(14 + i * 22, 40, 20 + z * 48, 16, 16, 34, ("b1", "b2", "b3")[(i + z) % 3], "cyl") for i in range(8) for z in range(3)]
     + [b(0, 10, 170, 200, 90, 12, "sign")],
     {"body": slot("ceramic", 0), "glass": slot("glass", 0), "b1": slot("fabric", 4), "b2": slot("fabric", 2), "b3": slot("fabric", 1), "sign": slot("fabric", 6)}, "free", name="Холодильна вітрина")
item("cash_counter", "village", 2, 1, "floor",
     [b(0, 20, 0, 200, 80, 80, "body"), b(0, 18, 80, 200, 84, 6, "top", "round"), b(120, 30, 86, 50, 40, 26, "till"), b(126, 34, 112, 38, 10, 14, "screen"),
      b(20, 30, 86, 40, 40, 4, "mat"), b(6, 98, 10, 188, 2, 60, "front")],
     {"body": slot("wood", 1), "top": slot("wood", 3), "till": slot("metal", 2), "screen": slot("glass", 1), "mat": slot("leaf", 0), "front": slot("wood", 4)}, "free", name="Каса")
item("bread_shelf", "village", 2, 1, "floor",
     [b(0, 0, 0, 8, 90, 140, "frame"), b(192, 0, 0, 8, 90, 140, "frame"), b(8, 0, 0, 184, 6, 140, "frame")]
     + [b(8, 6, z, 184, 84, 4, "frame") for z in (10, 52, 94, 136)]
     + [b(14 + i * 44, 22, 14, 38, 50, 22, "loaf", "round") for i in range(4)]
     + [b(14 + i * 30, 26, 56, 26, 40, 16, "bun", "ball") for i in range(6)]
     + [b(16 + i * 60, 18, 98, 52, 60, 16, "basket", "round") for i in range(3)] + [b(22 + i * 60, 26, 108, 38, 40, 12, "loaf", "round") for i in range(3)],
     {"frame": slot("wood", 1), "loaf": slot("wood", 3), "bun": slot("autumn", 3), "basket": slot("wood", 4)}, "free", name="Полиця з хлібом")
item("bread_oven", "village", 2, 1, "floor",
     [b(0, 0, 0, 200, 100, 110, "brick", "round"), b(40, 98, 20, 120, 4, 60, "door", "round"), b(60, 100, 40, 80, 2, 24, "fire"), b(30, 20, 110, 140, 60, 20, "brick", "round"),
      b(140, 30, 130, 30, 30, 70, "brick"), b(30, 100, 86, 140, 6, 6, "door")],
     {"brick": slot("pot", 0), "door": slot("metal", 2), "fire": slot("autumn", 0)}, "free", name="Хлібна піч")
items[-1]["tags"] = ["light"]
item("cell_bars", "village", 1, 1, "floor",
     [b(4 + i * 18, 46, 0, 6, 6, 160, "bar", "cyl") for i in range(6)] + [b(0, 44, 0, 100, 10, 8, "bar"), b(0, 44, 70, 100, 10, 6, "bar"), b(0, 44, 152, 100, 10, 8, "bar")],
     {"bar": slot("metal", 2)}, "free", name="Ґрати")
item("locker", "village", 1, 1, "floor",
     [b(6, 20, 0, 88, 76, 170, "body")] + [b(10 + i * 42, 94, 8, 38, 2, 154, "door") for i in range(2)] + [b(40 + i * 42, 96, 80, 4, 2, 12, "knob") for i in range(2)]
     + [b(16 + i * 42, 95, 140 - k * 6, 26, 1, 2, "vent") for i in range(2) for k in range(3)],
     {"body": slot("metal", 0), "door": slot("glass", 1), "knob": slot("metal", 2), "vent": slot("metal", 2)}, "free", name="Шафка")
item("hose_rack", "village", 1, 1, "wall",
     [b(20, 0, 70, 60, 6, 70, "board"), b(24, 6, 80, 52, 26, 52, "hose", "cyl"), b(38, 30, 96, 24, 6, 20, "board", "cyl"), b(42, 6, 40, 16, 20, 30, "nozzle")],
     {"board": slot("metal", 2), "hose": slot("fabric", 1), "nozzle": slot("metal", 1)}, "free", name="Пожежний рукав")
item("helmet_shelf", "village", 2, 1, "wall",
     [b(10, 0, 110, 180, 30, 4, "board")] + [b(20 + i * 56, 6, 114, 40, 22, 22, "helmet", "ball") for i in range(3)] + [b(20 + i * 56, 0, 70, 40, 10, 40, "coat") for i in range(3)],
     {"board": slot("wood", 1), "helmet": slot("autumn", 3), "coat": slot("fabric", 1)}, "free", name="Шоломи й куртки")
item("workbench", "village", 2, 1, "floor",
     legs4(200, 100, 70, 12, 8, "frame", "box") + [b(0, 0, 70, 200, 100, 10, "top"), b(10, 10, 20, 180, 80, 4, "frame"), b(150, 60, 80, 30, 26, 22, "vise"),
      b(20, 20, 80, 60, 8, 4, "tool"), b(30, 40, 80, 8, 40, 6, "tool2"), b(90, 30, 80, 40, 30, 10, "plank"), b(20, 0, 90, 160, 4, 60, "board")]
     + [b(30 + i * 30, 4, 110, 8, 4, 30, ("tool", "tool2")[i % 2]) for i in range(5)],
     {"frame": slot("wood", 2), "top": slot("wood", 3), "vise": slot("metal", 2), "tool": slot("metal", 0), "tool2": slot("fabric", 1), "plank": slot("wood", 4), "board": slot("wood", 1)}, "free", name="Верстак")
item("tool_wall", "village", 2, 1, "wall",
     [b(6, 0, 60, 188, 4, 110, "board")] + [b(20 + i * 30, 4, 90 + (i % 2) * 30, 10, 6, 40, ("tool", "handle")[i % 2]) for i in range(6)]
     + [b(30, 4, 150, 50, 6, 10, "tool"), b(110, 4, 150, 60, 6, 8, "handle")],
     {"board": slot("wood", 4), "tool": slot("metal", 0), "handle": slot("fabric", 1)}, "free", name="Інструменти на стіні")
item("lathe", "village", 2, 1, "floor",
     [b(10, 20, 0, 30, 60, 70, "frame"), b(160, 20, 0, 30, 60, 70, "frame"), b(0, 20, 70, 200, 60, 12, "frame"), b(20, 30, 82, 40, 40, 40, "motor"),
      b(60, 44, 96, 100, 12, 12, "wood", "cyl"), b(160, 36, 82, 24, 28, 30, "motor")],
     {"frame": slot("metal", 2), "motor": slot("fabric", 6), "wood": slot("wood", 3)}, "free", name="Токарний верстат")
item("paint_cans", "village", 1, 1, "floor",
     [b(10 + (i % 2) * 44, 10 + (i // 2) * 44, 0, 34, 34, 36, ("p1", "p2", "p3", "p4")[i], "cyl") for i in range(4)] + [b(54, 54, 36, 34, 34, 30, "p2", "cyl")],
     {"p1": slot("fabric", 1), "p2": slot("fabric", 4), "p3": slot("fabric", 2), "p4": slot("fabric", 6)}, "free", name="Фарби")
item("pc_desk", "village", 2, 1, "floor",
     legs4(200, 100, 70, 10, 8, "frame") + [b(0, 0, 70, 200, 100, 6, "top", "round"), b(60, 20, 76, 80, 10, 6, "body"), b(96, 24, 82, 8, 8, 14, "body"),
      b(50, 18, 96, 100, 8, 60, "body", "round"), b(54, 26, 100, 92, 1, 52, "screen"), b(56, 50, 76, 70, 24, 3, "keys"), b(150, 54, 76, 14, 20, 4, "keys", "round"), b(160, 10, 0, 34, 70, 60, "body")],
     {"frame": slot("metal", 2), "top": slot("wood", 4), "body": slot("metal", 2), "screen": slot("glass", 1), "keys": slot("ceramic", 5)}, "free", name="Комп'ютер")
items[-1]["tags"] = ["switch"]
item("waiting_bench", "village", 2, 1, "floor",
     [b(10, 20, 0, 8, 60, 40, "frame"), b(182, 20, 0, 8, 60, 40, "frame"), b(4, 14, 40, 192, 72, 8, "seat", "round"), b(4, 80, 48, 192, 8, 40, "seat", "round")]
     + [b(66 + i * 64, 14, 40, 4, 72, 10, "frame") for i in range(2)],
     {"frame": slot("metal", 2), "seat": slot("fabric", 6)}, "free", ["sit"], name="Лава для очікування")
item("flower_bucket", "village", 1, 1, "floor",
     [b(10 + (i % 2) * 44, 10 + (i // 2) * 44, 0, 36, 36, 34, "bucket", "cyl") for i in range(4)]
     + [b(14 + (i % 2) * 44, 14 + (i // 2) * 44, 30, 28, 28, 30, ("f1", "f2", "f3", "f4")[i], "ball") for i in range(4)]
     + [b(24 + (i % 2) * 44, 24 + (i // 2) * 44, 30, 8, 8, 20, "stem") for i in range(4)],
     {"bucket": slot("metal", 0), "f1": slot("fabric_pink", 0), "f2": slot("fabric", 2), "f3": slot("pastel", 4), "f4": slot("fabric", 1), "stem": slot("leaf", 0)}, "free", name="Відра з квітами")

# rubbish that piles up: bags, a broken crate, bottles; and heaps of it once the dump is overfull
item("trash_bags", "village", 1, 1, "floor",
     [b(10, 14, 0, 44, 40, 38, "bag", "ball"), b(46, 40, 0, 44, 44, 34, "bag2", "ball"), b(26, 50, 26, 36, 34, 30, "bag", "ball"), b(28, 16, 36, 8, 8, 8, "tie", "ball"), b(64, 44, 32, 8, 8, 8, "tie", "ball")],
     {"bag": slot("ceramic", 5), "bag2": slot("leaf", 0), "tie": slot("autumn", 3)}, "free", name="Мішки зі сміттям")
item("litter", "village", 1, 1, "floor",
     [b(14, 20, 0, 30, 20, 16, "crate"), b(18, 24, 16, 22, 12, 2, "crate"), b(56, 50, 0, 10, 10, 26, "bottle", "cyl"), b(70, 30, 0, 10, 26, 8, "bottle", "cyl"),
      b(30, 66, 0, 24, 18, 4, "paper"), b(62, 72, 0, 18, 14, 3, "paper2"), b(10, 60, 0, 12, 12, 10, "can", "cyl")],
     {"crate": slot("wood", 1), "bottle": slot("leaf", 1), "paper": slot("ceramic", 1), "paper2": slot("glass", 1), "can": slot("metal", 0)}, "free", name="Розкидане сміття")

# ---- worn things: the same pieces of furniture, faded, scratched and dusty; the workshop mends them
UK_NAMES = dict(re.findall(r"'item\.([a-z0-9_]+)': \['((?:[^'\\]|\\.)+)'", (pathlib.Path(__file__).resolve().parent.parent / "app" / "src" / "lang" / "names.ts").read_text(encoding="utf-8")))
WORN = ["chair", "armchair", "stool", "side_table", "bookshelf", "dresser", "floor_lamp", "radio", "record_player", "wardrobe", "sofa2",
        "coffee_table", "nightstand", "chest", "desk", "dining_chair_wood", "wingback", "rocking_chair"]


def faded(color):
    """A colour gone dull: towards a dusty grey-brown, a little darker."""
    r, g, bl = (int(color[i:i + 2], 16) for i in (1, 3, 5))
    dust = (128, 116, 100)
    mix = [round(c * 0.4 + d * 0.6) * 85 // 100 for c, d in zip((r, g, bl), dust)]
    return "#" + "".join(f"{max(0, min(255, c)):02x}" for c in mix)


BY_ID = {i["id"]: i for i in items}
# the faded colours of worn things make a palette of their own (one cannot paint a worn thing new: mend it)
WORN_PALETTE = ["#9a9282"]
PALETTES["worn"] = WORN_PALETTE
for what in WORN:
    src = BY_ID[what]
    worn = copy.deepcopy(src)
    worn["id"] = f"worn_{what}"
    base = src["name"] if not src["name"].startswith("item.") else UK_NAMES.get(what, what)
    worn["name"] = f"{base} (зношене)"
    worn["category"] = "worn"
    worn["acquire"] = "free"
    worn["hidden"] = True
    worn["restores"] = what
    # only "worn": a worn bookshelf should not be taken for a request for books
    worn["tags"] = ["worn"]
    worn.pop("actions", None)
    if src.get("actions") and "sit" in src["actions"]:
        worn["actions"] = ["sit"]
    for s in worn["slots"].values():
        s["default"] = faded(s["default"])
        s["palette"] = "worn"
        if s["default"] not in WORN_PALETTE:
            WORN_PALETTE.append(s["default"])
    # a crack, a scuff, a patch of dust on top: worn things show it from every side
    top = max(m["box"][2] + m["box"][5] for m in worn["model"])
    fw, fd = src["footprint"]["w"] * 100, src["footprint"]["d"] * 100
    worn["model"] = worn["model"] + [{"box": [fw // 4, fd // 3, top - 1, fw // 5, fd // 6, 2], "slot": "dust"},
                                     {"box": [fw // 2, fd // 2, top - 1, fw // 8, fd // 4, 2], "slot": "dust"}]
    worn["slots"]["dust"] = {"default": "#9a9282", "palette": "worn"}
    items.append(worn)

# =============================================================================================================
# Energy: wind turbines on the wheat field, power lines on wooden poles, the fenced substation; the village's gas
# pipes (mostly underground, yellow where they come up); the wheat itself
# =============================================================================================================
tower = [b(20, 20, 0, 160, 160, 10, "base", "round"), b(70, 70, 10, 60, 60, 6, "base", "cyl")]
for i in range(6):
    r = 36 - i * 4
    tower.append(b(100 - r, 100 - r, 16 + i * 84, 2 * r, 2 * r, 86, "tower", "cyl"))
tower += [b(88, 132, 16, 24, 4, 42, "door"), b(118, 140, 10, 34, 22, 34, "box"), b(124, 162, 34, 22, 2, 8, "sign"),
          # the nacelle on top, facing +y, and the hub the blades turn on (the blades are drawn turning)
          b(76, 64, 516, 48, 96, 46, "tower", "round"), b(84, 70, 560, 32, 60, 6, "trim"), b(88, 156, 522, 24, 20, 32, "hub", "ball"),
          b(96, 60, 562, 6, 6, 20, "trim", "cyl")]
item("wind_turbine", "village", 2, 2, "floor", tower,
     {"base": slot("ceramic", 1), "tower": slot("ceramic", 0), "door": slot("metal", 0), "box": slot("metal", 0), "sign": slot("autumn", 3),
      "hub": slot("ceramic", 0), "trim": slot("fabric", 1)}, "free", name="Вітряк")
items[-1]["tags"] = ["turbine"]

pole = [b(44, 44, 0, 12, 12, 262, "wood", "cyl"), b(46, 10, 232, 8, 80, 8, "wood"), b(46, 14, 240, 8, 8, 12, "ins", "cyl"), b(46, 78, 240, 8, 8, 12, "ins", "cyl"),
        b(46, 46, 248, 8, 8, 14, "ins", "cyl"), b(40, 40, 0, 20, 20, 30, "foot", "cyl"), b(56, 46, 140, 2, 14, 20, "sign")]
item("power_pole", "village", 1, 1, "floor", pole, {"wood": slot("wood", 2), "ins": slot("glass", 1), "foot": slot("ceramic", 1), "sign": slot("autumn", 3)}, "free", name="Опора лінії")
item("pole_transformer", "village", 1, 1, "floor",
     pole + [b(58, 34, 160, 34, 32, 50, "tank", "cyl"), b(62, 38, 210, 6, 6, 14, "ins", "cyl"), b(80, 38, 210, 6, 6, 14, "ins", "cyl"), b(56, 46, 176, 4, 8, 4, "wood")],
     {"wood": slot("wood", 2), "ins": slot("glass", 1), "foot": slot("ceramic", 1), "sign": slot("autumn", 3), "tank": slot("metal", 0)}, "free", name="Опора з трансформатором")

sub = [b(0, 0, 0, 400, 300, 8, "pad")]
for tx in (30, 200):
    sub += [b(tx, 50, 8, 130, 90, 112, "tank", "round"), b(tx + 10, 60, 120, 110, 70, 8, "tank")]
    sub += [b(tx - 8, 58 + k * 18, 20, 8, 10, 86, "fin") for k in range(4)] + [b(tx + 130, 58 + k * 18, 20, 8, 10, 86, "fin") for k in range(4)]
    sub += [b(tx + 20 + k * 36, 90, 128, 10, 10, 34, "ins", "cyl") for k in range(3)] + [b(tx + 40, 140, 30, 50, 4, 30, "sign")]
sub += [b(20, 220, 8, 12, 12, 262, "steel"), b(368, 220, 8, 12, 12, 262, "steel"), b(190, 220, 8, 12, 12, 262, "steel"), b(20, 220, 262, 360, 12, 12, "steel")]
sub += [b(60 + k * 110, 222, 226, 8, 8, 36, "ins", "cyl") for k in range(3)] + [b(60 + k * 110, 160, 160, 8, 62, 6, "bus") for k in range(3)]
sub += [b(300, 250, 8, 80, 44, 96, "cab", "round"), b(316, 294, 56, 30, 2, 26, "sign"), b(328, 295, 62, 6, 1, 14, "bolt"), b(340, 296, 30, 4, 2, 10, "bolt")]
item("substation", "village", 4, 3, "floor", sub,
     {"pad": slot("ceramic", 1), "tank": slot("metal", 0), "fin": slot("metal", 2), "ins": slot("wood", 1), "steel": slot("metal", 0), "bus": slot("metal", 1),
      "cab": slot("ceramic", 2), "sign": slot("autumn", 3), "bolt": slot("ceramic", 5)}, "free", name="Підстанція")
item("field_transformer", "village", 2, 1, "floor",
     [b(10, 10, 0, 180, 80, 8, "pad"), b(30, 20, 8, 140, 60, 90, "tank", "round"), b(20, 26, 20, 10, 48, 70, "fin"), b(170, 26, 20, 10, 48, 70, "fin")]
     + [b(60 + k * 40, 44, 98, 10, 10, 30, "ins", "cyl") for k in range(3)] + [b(80, 80, 40, 40, 2, 30, "sign"), b(96, 81, 46, 6, 1, 16, "bolt")],
     {"pad": slot("ceramic", 1), "tank": slot("leaf", 0), "fin": slot("metal", 2), "ins": slot("wood", 1), "sign": slot("autumn", 3), "bolt": slot("ceramic", 5)}, "free", name="Трансформатор поля")
fence = [b(0, 46, 0, 6, 6, 134, "post", "cyl")] + [b(0, 48, z, 100, 2, 2, "wire") for z in range(14, 130, 16)] + [b(x, 48, 6, 2, 2, 120, "wire") for x in range(10, 100, 14)]
fence += [b(0, 44, 130, 100, 6, 3, "barb"), b(96, 46, 0, 4, 6, 134, "post")]
item("mesh_fence", "village", 1, 1, "floor", fence, {"post": slot("metal", 2), "wire": slot("metal", 0), "barb": slot("metal", 2)}, "free", name="Сітчаста огорожа")
item("mesh_gate", "village", 2, 1, "floor",
     [b(0, 44, 0, 8, 8, 140, "post"), b(192, 44, 0, 8, 8, 140, "post"), b(8, 47, 10, 184, 4, 4, "frame"), b(8, 47, 120, 184, 4, 4, "frame"), b(98, 47, 10, 4, 4, 114, "frame")]
     + [b(x, 48, 14, 2, 2, 106, "wire") for x in range(16, 190, 14)] + [b(60, 46, 60, 40, 3, 34, "sign"), b(76, 45, 66, 8, 1, 20, "bolt"), b(72, 45, 64, 16, 1, 4, "bolt")],
     {"post": slot("metal", 2), "frame": slot("metal", 2), "wire": slot("metal", 0), "sign": slot("autumn", 3), "bolt": slot("ceramic", 5)}, "free", name="Ворота підстанції")

# gas: a yellow pipe on low supports, where it comes up out of the ground and goes back down, a regulator cabinet
item("gas_pipe", "village", 1, 1, "floor",
     [b(44, 40, 0, 12, 20, 44, "support"), b(36, 38, 0, 28, 24, 4, "support"), b(0, 43, 44, 100, 14, 14, "pipe", "round"), b(46, 41, 42, 8, 18, 18, "band", "round")],
     {"support": slot("metal", 2), "pipe": slot("autumn", 3), "band": slot("fabric", 1)}, "free", name="Газова труба")
item("gas_riser", "village", 1, 1, "floor",
     [b(38, 38, 0, 24, 24, 6, "support", "cyl"), b(43, 43, 0, 14, 14, 58, "pipe", "cyl"), b(43, 43, 44, 57, 14, 14, "pipe", "round"), b(40, 40, 18, 20, 20, 4, "flange", "cyl"),
      b(34, 34, 28, 32, 32, 4, "valve", "cyl"), b(48, 48, 28, 4, 4, 10, "valve")],
     {"support": slot("ceramic", 1), "pipe": slot("autumn", 3), "flange": slot("metal", 2), "valve": slot("fabric", 1)}, "free", name="Вихід газової труби")
item("gas_cabinet", "village", 1, 1, "floor",
     [b(14, 30, 0, 8, 8, 30, "leg"), b(78, 30, 0, 8, 8, 30, "leg"), b(10, 20, 30, 80, 60, 80, "box", "round"), b(16, 80, 40, 68, 2, 60, "door"),
      b(30, 81, 70, 40, 2, 18, "label"), b(44, 50, 0, 12, 12, 30, "pipe", "cyl"), b(70, 82, 64, 6, 4, 8, "leg")],
     {"leg": slot("metal", 2), "box": slot("autumn", 3), "door": slot("autumn", 3), "label": slot("fabric", 1), "pipe": slot("autumn", 3)}, "free", name="Газорегуляторна шафа")

# wheat: tufts of stalks with heavy ears; green in spring, gold in summer, stubble after the harvest
for wid, seed in (("wheat_a", 3), ("wheat_b", 11)):
    model = []
    k = seed
    for gx in range(6):
        for gy in range(6):
            k = (k * 1103515245 + 12345) % 2147483648
            jx, jy, hh = k % 14, (k >> 8) % 14, 52 + (k >> 16) % 24
            x, y = 6 + gx * 32 + jx, 6 + gy * 32 + jy
            model += [b(x, y, 0, 6, 6, hh, "stalk"), b(x - 2, y - 2, hh - 4, 10, 10, 20, "ear", "round")]
    item(wid, "village", 2, 2, "floor", model, {"stalk": slot("wood", 3), "ear": slot("autumn", 3)}, "free", name="Пшениця")
item("wheat_ear", "nature", 1, 1, "surface", [b(46, 46, 0, 6, 6, 60, "stalk"), b(42, 42, 50, 14, 14, 30, "ear", "round"), b(54, 50, 30, 14, 4, 4, "stalk")],
     {"stalk": slot("wood", 3), "ear": slot("autumn", 3)}, "free", name="Колосок")
items[-1]["hidden"] = True
