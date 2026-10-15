# Buildings and street furniture of the village. Run inside gen_base_content.py (it uses item, b, slot).
# They are props of the fixed village map, not sold in the catalogue (category "village").


def facade_windows(W, D, z, front=True, side=True, every=110):
    """Windows with frames and sills on every wall of a box building: it is seen from all sides."""
    out = []
    # the back (-y) and the left (-x) walls
    for x in range(40, W - 60, every):
        out += [b(x - 4, 10, z - 4, 44, 4, 44, "trim"), b(x, 8, z, 36, 4, 36, "glass"), b(x + 16, 7, z, 4, 4, 36, "trim"), b(x - 6, 6, z - 8, 48, 8, 4, "trim")]
    for y in range(40, D - 50, every):
        out += [b(10, y - 4, z - 4, 4, 44, 44, "trim"), b(8, y, z, 4, 36, 36, "glass"), b(7, y + 16, z, 4, 4, 36, "trim")]
    if front:
        for x in range(40, W - 60, every):
            out += [b(x - 4, D - 14, z - 4, 44, 4, 44, "trim"), b(x, D - 12, z, 36, 4, 36, "glass"), b(x + 16, D - 11, z, 4, 4, 36, "trim"),
                    b(x - 6, D - 14, z - 8, 48, 8, 4, "trim"), b(x - 2, D - 8, z - 6, 40, 8, 8, "flower", "round")]
    if side:
        for y in range(40, D - 50, every):
            out += [b(W - 14, y - 4, z - 4, 4, 44, 44, "trim"), b(W - 12, y, z, 4, 36, 36, "glass"), b(W - 11, y + 16, z, 4, 4, 36, "trim")]
    return out


def building(id, name, w, d, wall_h, slots_, roof_h=70, door_x=None, chimney=True, extra=None, windows=True):
    W, D = w * 100, d * 100
    dx = door_x if door_x is not None else W // 2 - 26
    model = [
        b(0, 0, 0, W, D, 8, "stone"),
        b(10, 10, 8, W - 20, D - 20, wall_h, "wall"),
        b(10, D - 12, 8, W - 20, 4, 10, "stone"),
        b(0, 0, 8 + wall_h, W, D, roof_h, "roof", "gable"),
        b(4, 4, 8 + wall_h - 6, W - 8, D - 8, 8, "trim"),
        # door with frame, step and knob
        b(dx - 6, D - 13, 8, 64, 4, 98, "trim"), b(dx, D - 11, 8, 52, 4, 90, "door"), b(dx + 40, D - 8, 50, 6, 4, 6, "knob", "ball"),
        b(dx - 10, D - 10, 0, 72, 12, 8, "stone"),
        # a back door with its step, and drainpipes at the corners
        b(W - dx - 52, 8, 8, 44, 4, 84, "door"), b(W - dx - 58, 6, 8, 56, 4, 92, "trim"), b(W - dx - 62, 2, 0, 64, 10, 8, "stone"),
        b(12, D - 16, 8, 6, 6, wall_h, "trim", "cyl"), b(W - 18, 12, 8, 6, 6, wall_h, "trim", "cyl"),
    ]
    if windows:
        model += facade_windows(W, D, 52)
    if chimney:
        model += [b(W - 90, 40, 8 + wall_h + roof_h // 3, 26, 26, roof_h, "stone"), b(W - 94, 36, 8 + wall_h + roof_h + roof_h // 3, 34, 34, 6, "stone")]
    model += extra or []
    item(id, "village", w, d, "floor", model, slots_, "free", ["enter"] if id == "home_house" else None, name=name)


# little houses of the villagers, each with its own colours
for id, name, wall, roof in [
    ("cottage_cream", "Кремовий будиночок", ("ceramic", 1), ("autumn", 2)),
    ("cottage_blue", "Блакитний будиночок", ("glass", 1), ("earth", 2)),
    ("cottage_rose", "Рожевий будиночок", ("fabric_pink", 0), ("wood", 5)),
    ("cottage_sage", "Шавлієвий будиночок", ("leaf", 3), ("pot", 0)),
    ("cottage_honey", "Медовий будиночок", ("wood", 3), ("fabric", 6)),
]:
    building(id, name, 4, 3, 100, {
        "stone": slot("ceramic", 1), "wall": slot(*wall), "roof": slot(*roof), "trim": slot("wood", 4), "door": slot("wood", 0),
        "knob": slot("metal", 1), "glass": slot("glass", 1), "flower": slot("fabric", 7)})

# the player's own house, seen from the village
building("home_house", "Твій дім", 5, 3, 110, {
    "stone": slot("ceramic", 1), "wall": slot("ceramic", 0), "roof": slot("fabric", 0), "trim": slot("wood", 4), "door": slot("fabric", 3),
    "knob": slot("metal", 1), "glass": slot("pastel", 3), "flower": slot("fabric", 1), "heart": slot("fabric", 7)},
    extra=[b(220, 288, 112, 40, 4, 30, "heart", "round")])

# (the shops' buildings are in shop_fronts.py)

# the library: stone, columns at the entrance, a deep roof
cols = [b(x, 352, 8, 22, 22, 118, "column", "cyl") for x in (120, 200, 300, 380)]
building("library_house", "Бібліотека", 5, 4, 120, {
    "stone": slot("ceramic", 1), "wall": slot("ceramic", 2), "roof": slot("earth", 2), "trim": slot("ceramic", 0), "door": slot("wood", 2),
    "knob": slot("metal", 1), "glass": slot("glass", 0), "flower": slot("leaf", 1), "column": slot("ceramic", 0), "book": slot("fabric", 6)},
    roof_h=80, chimney=False, extra=cols + [b(100, 340, 126, 300, 40, 10, "trim"), b(110, 360, 0, 280, 40, 6, "stone"), b(226, 312, 120, 48, 4, 20, "book", "round")])

# market stalls with a striped canopy and goods on the counter
for id, name, goods, canopy in [
    ("stall_veg", "Овочева ятка", [("fabric", 1), ("fabric", 4), ("fabric", 2)], ("fabric", 4)),
    ("stall_flowers", "Квіткова ятка", [("fabric", 7), ("fabric", 2), ("pastel", 4)], ("fabric", 7)),
    ("stall_bread", "Хлібна ятка", [("wood", 3), ("wood", 1), ("autumn", 1)], ("fabric", 2)),
]:
    model = [b(10, 30, 0, 180, 60, 46, "counter", "round"), b(6, 26, 46, 188, 68, 6, "top")]
    for x in (10, 182):
        model += [b(x, 30, 0, 8, 8, 124, "pole"), b(x, 84, 0, 8, 8, 110, "pole")]
    for i, x in enumerate(range(0, 200, 40)):
        model += [b(x, 18, 120, 40, 84, 8, "can_a" if i % 2 == 0 else "can_b")]
    for i, (gx, gy) in enumerate([(30, 40), (60, 50), (90, 38), (120, 52), (150, 42)]):
        model += [b(gx, gy, 52, 22, 22, 14, f"g{i % 3}", "ball")]
    item(id, "village", 2, 1, "floor", model, {
        "counter": slot("wood", 1), "top": slot("wood", 3), "pole": slot("wood", 2), "can_a": slot(*canopy), "can_b": slot("ceramic", 0),
        "g0": slot(*goods[0]), "g1": slot(*goods[1]), "g2": slot(*goods[2])}, "free", name=name)

item("notice_board", "village", 1, 1, "floor",
     [b(16, 44, 0, 8, 8, 120, "post"), b(76, 44, 0, 8, 8, 120, "post"), b(10, 40, 50, 80, 8, 64, "board"), b(6, 36, 112, 88, 16, 8, "post", "round"),
      b(18, 48, 64, 22, 2, 24, "paper"), b(46, 48, 80, 28, 2, 20, "paper2"), b(56, 48, 56, 18, 2, 18, "paper")],
     {"post": slot("wood", 2), "board": slot("wood", 3), "paper": slot("ceramic", 0), "paper2": slot("pastel", 3)}, "free", name="Дошка оголошень")
item("signpost", "village", 1, 1, "floor",
     [b(46, 46, 0, 8, 8, 150, "post"), b(20, 44, 110, 70, 4, 18, "sign_a"), b(14, 44, 84, 66, 4, 18, "sign_b"), b(44, 44, 150, 12, 12, 8, "post", "ball")],
     {"post": slot("wood", 2), "sign_a": slot("wood", 3), "sign_b": slot("wood", 1)}, "free", name="Дороговказ")
item("home_gate", "village", 2, 1, "floor",
     [b(14, 40, 0, 20, 20, 150, "post", "round"), b(166, 40, 0, 20, 20, 150, "post", "round"), b(6, 36, 146, 188, 28, 16, "arch", "round"),
      b(60, 46, 120, 80, 4, 22, "sign"), b(92, 40, 162, 16, 16, 16, "heart", "ball"), b(34, 48, 0, 132, 4, 4, "post")],
     {"post": slot("wood", 2), "arch": slot("leaf", 1), "sign": slot("wood", 3), "heart": slot("fabric", 7)}, "free", name="Хвіртка додому")
item("telescope", "village", 1, 1, "floor",
     [b(30, 30, 0, 8, 8, 70, "leg"), b(62, 30, 0, 8, 8, 70, "leg"), b(46, 62, 0, 8, 8, 70, "leg"), b(30, 40, 70, 40, 16, 16, "tube", "cyl"), b(20, 40, 82, 60, 18, 18, "tube", "round"), b(72, 42, 92, 10, 14, 14, "lens", "ball")],
     {"leg": slot("wood", 2), "tube": slot("metal", 2), "lens": slot("glass", 1)}, "free", name="Телескоп")
item("easel_outdoor", "village", 1, 1, "floor",
     [b(30, 40, 0, 6, 6, 110, "wood"), b(64, 40, 0, 6, 6, 110, "wood"), b(48, 60, 0, 6, 6, 100, "wood"), b(24, 36, 50, 54, 4, 50, "canvas"), b(30, 34, 60, 20, 2, 18, "paint_a"), b(52, 34, 72, 20, 2, 16, "paint_b")],
     {"wood": slot("wood", 1), "canvas": slot("ceramic", 0), "paint_a": slot("fabric", 6), "paint_b": slot("fabric", 2)}, "free", name="Мольберт просто неба")
item("fishing_spot", "village", 1, 1, "floor",
     [b(20, 30, 0, 60, 50, 22, "box", "round"), b(30, 40, 22, 40, 30, 4, "lid"), b(70, 20, 22, 4, 4, 110, "rod", "cyl"), b(70, 20, 128, 24, 4, 3, "rod"), b(84, 64, 0, 18, 18, 20, "bucket", "cyl")],
     {"box": slot("wood", 2), "lid": slot("wood", 3), "rod": slot("wood", 0), "bucket": slot("metal", 0)}, "free", name="Місце для риболовлі")

# the forest
item("campfire", "village", 1, 1, "floor",
     [b(14, 14, 0, 72, 72, 8, "stone", "round")] + [b(20 + i * 14, 30 + (i % 2) * 20, 6, 50, 10, 10, "log", "cyl") for i in range(3)]
     + [b(34, 34, 12, 32, 32, 30, "fire", "cone"), b(42, 42, 20, 16, 16, 28, "flame", "cone")],
     {"stone": slot("ceramic", 5), "log": slot("wood", 2), "fire": slot("autumn", 0), "flame": slot("autumn", 3)}, "free", name="Вогнище")
item("tree_ancient", "village", 3, 3, "floor",
     [b(110, 110, 0, 80, 80, 150, "trunk", "cyl"), b(70, 120, 0, 50, 30, 30, "trunk", "round"), b(180, 100, 0, 40, 40, 24, "trunk", "round"),
      b(20, 20, 130, 260, 260, 120, "crown", "ball"), b(60, 40, 210, 180, 180, 100, "crown2", "ball"), b(30, 150, 160, 120, 120, 80, "crown2", "ball")],
     {"trunk": slot("earth", 2), "crown": slot("leaf", 0), "crown2": slot("leaf", 2)}, "free", name="Древній дуб")
item("log_pile", "village", 2, 1, "floor",
     [b(10, 20, 0, 180, 30, 30, "log", "cyl"), b(10, 52, 0, 180, 30, 30, "log", "cyl"), b(20, 36, 26, 160, 30, 30, "log", "cyl")] + [b(4, 20 + i * 32, 0, 8, 30, 30, "cut", "cyl") for i in range(2)],
     {"log": slot("wood", 0), "cut": slot("wood", 3)}, "free", name="Купа колод")
item("boat", "village", 2, 1, "rug",
     [b(10, 20, 0, 180, 60, 16, "hull", "round"), b(20, 28, 14, 160, 44, 4, "inside"), b(90, 22, 14, 10, 56, 10, "seat"), b(40, 90, 4, 100, 6, 4, "oar")],
     {"hull": slot("wood", 1), "inside": slot("wood", 3), "seat": slot("wood", 2), "oar": slot("wood", 0)}, "free", name="Човник")
item("mushroom_ring", "village", 2, 2, "rug",
     [b(20 + int(70 + 60 * __import__("math").cos(a / 8 * 6.283)), 20 + int(70 + 60 * __import__("math").sin(a / 8 * 6.283)), 0, 14, 14, 14, "cap" if a % 2 else "cap2", "ball") for a in range(8)],
     {"cap": slot("fabric", 1), "cap2": slot("ceramic", 0)}, "free", name="Відьмине коло")
item("forest_sign", "village", 1, 1, "floor",
     [b(46, 46, 0, 8, 8, 130, "post"), b(16, 44, 92, 72, 4, 26, "sign"), b(22, 42, 100, 10, 4, 10, "leaf", "ball")],
     {"post": slot("wood", 2), "sign": slot("wood", 3), "leaf": slot("leaf", 1)}, "free", name="Вказівник «Ліс»")

# flowers sold only in the flower shop
def bouquet(id, name, price, heads, vase=("ceramic", 2), vase_h=40, stems=("leaf", 0), layer="surface", big=False):
    model = [b(30, 30, 0, 40, 40, vase_h, "vase", "cyl")]
    for i, (x, y, z, s) in enumerate(heads):
        model += [b(48 + x // 2, 48 + y // 2, vase_h - 6, 4, 4, z - vase_h + 10, "stem", "cyl"), b(x + 30, y + 30, z, s, s, s, "h0" if i % 3 == 0 else "h1" if i % 3 == 1 else "h2", "ball")]
    item(id, "flowers", 1, 1, layer, model, {"vase": slot(*vase), "stem": slot(*stems), "h0": slot("fabric", 7), "h1": slot("fabric_pink", 0), "h2": slot("fabric", 5)},
         coins(price), ["water_plant"], name=name)

bouquet("peony_vase", "Півонії у вазі", 60, [(0, 4, 60, 22), (16, 0, 66, 20), (8, 18, 58, 20), (22, 16, 62, 18)])
bouquet("rose_bouquet", "Букет троянд", 75, [(2, 2, 62, 16), (16, 4, 66, 16), (6, 16, 64, 16), (20, 18, 60, 14), (12, 10, 72, 14)], vase=("glass", 1))
bouquet("tulip_jar", "Тюльпани в глечику", 45, [(4, 6, 62, 12), (18, 4, 66, 12), (10, 18, 60, 12), (24, 16, 64, 12)], vase=("pot", 2))
bouquet("wildflower_jar", "Польові квіти в банці", 30, [(2, 4, 56, 10), (14, 0, 62, 10), (22, 12, 58, 10), (8, 20, 60, 10), (18, 22, 54, 10)], vase=("glass", 0), vase_h=34)
bouquet("lily_vase", "Лілії", 70, [(4, 4, 70, 20), (20, 10, 64, 18), (8, 20, 62, 18)], vase=("ceramic", 0), vase_h=46)
bouquet("sunflower_vase", "Соняшники у вазі", 55, [(0, 6, 74, 24), (20, 2, 68, 22)], vase=("autumn", 3), vase_h=44, layer="floor")
item("lavender_pot", "flowers", 1, 1, "floor",
     [b(25, 25, 0, 50, 50, 34, "pot", "cyl")] + [b(28 + (i % 4) * 12, 28 + (i // 4) * 14, 30, 8, 8, 40 + (i % 3) * 6, "lav", "cone") for i in range(12)],
     {"pot": slot("pot", 2), "lav": slot("fabric", 3)}, coins(50), ["water_plant"], name="Лаванда в горщику")
item("hydrangea_pot", "flowers", 1, 1, "floor",
     [b(22, 22, 0, 56, 56, 30, "pot", "cyl"), b(14, 14, 26, 72, 72, 30, "leafy", "ball")] + [b(14 + (i % 2) * 36, 14 + (i // 2) * 36, 46, 36, 36, 30, "bloom" if i % 2 else "bloom2", "ball") for i in range(4)],
     {"pot": slot("ceramic", 2), "leafy": slot("leaf", 0), "bloom": slot("glass", 1), "bloom2": slot("pastel", 4)}, coins(80), ["water_plant"], name="Гортензія")
item("flower_cart", "flowers", 2, 1, "floor",
     [b(20, 20, 30, 160, 60, 40, "cart", "round"), b(10, 30, 0, 30, 30, 30, "wheel", "cyl"), b(160, 30, 0, 30, 30, 30, "wheel", "cyl"), b(180, 40, 30, 20, 10, 50, "cart")]
     + [b(26 + (i % 6) * 26, 26 + (i // 6) * 26, 66, 24, 24, 22, ("h0", "h1", "h2")[i % 3], "ball") for i in range(12)],
     {"cart": slot("wood", 3), "wheel": slot("wood", 2), "h0": slot("fabric", 7), "h1": slot("fabric", 2), "h2": slot("pastel", 4)}, coins(140), ["water_plant"], name="Візок із квітами")
item("orchid_pink", "flowers", 1, 1, "surface",
     [b(32, 32, 0, 36, 36, 26, "pot", "cyl"), b(48, 48, 24, 4, 4, 50, "stem", "cyl")] + [b(30 + i * 10, 40 + (i % 2) * 6, 56 + i * 4, 14, 8, 12, "bloom", "ball") for i in range(4)],
     {"pot": slot("ceramic", 0), "stem": slot("leaf", 0), "bloom": slot("fabric_pink", 0)}, coins(65), ["water_plant"], name="Рожева орхідея")

# =============================================================================================================
# The settlement's public buildings (worked on every side), vehicles and animals
# =============================================================================================================
def civic(id, name, w, d, wall_h, colors, extra, roof_h=70, chimney=False, door_w=None):
    building(id, name, w, d, wall_h, {
        "stone": slot("ceramic", 1), "wall": slot(*colors[0]), "roof": slot(*colors[1]), "trim": slot(*colors[2]), "door": slot(*colors[3]),
        "knob": slot("metal", 1), "glass": slot("glass", 1), "flower": slot("fabric", 7), **colors[4]}, roof_h=roof_h, chimney=chimney, extra=extra)


# the school: two wings of windows, a bell tower with a clock, a flag
civic("school", "Школа", 6, 4, 130, [("autumn", 3), ("earth", 2), ("ceramic", 0), ("wood", 1), {"bell": slot("metal", 1), "clock": slot("ceramic", 0), "hand": slot("metal", 2), "flag": slot("fabric", 6), "flag2": slot("fabric", 2), "pole": slot("metal", 0)}],
      [b(260, 150, 210, 80, 80, 70, "wall"), b(250, 140, 280, 100, 100, 50, "roof", "gable"), b(282, 228, 230, 36, 4, 36, "clock", "cyl"), b(298, 232, 246, 4, 2, 14, "hand"),
       b(286, 176, 262, 28, 28, 16, "bell", "ball"), b(560, 360, 0, 6, 6, 260, "pole", "cyl"), b(566, 360, 220, 50, 4, 20, "flag"), b(566, 360, 240, 50, 4, 20, "flag2")],
      roof_h=80)
# the hospital: white, a red cross on the front and on the roof's gable, a covered entrance
civic("hospital", "Лікарня", 6, 4, 130, [("ceramic", 0), ("ceramic", 2), ("ceramic", 1), ("glass", 1), {"cross": slot("fabric", 1), "canopy": slot("ceramic", 2), "post": slot("metal", 0)}],
      [b(270, 386, 150, 60, 4, 20, "cross"), b(290, 386, 130, 20, 4, 60, "cross"), b(220, 380, 112, 160, 60, 8, "canopy"), b(224, 430, 0, 6, 6, 112, "post", "cyl"),
       b(370, 430, 0, 6, 6, 112, "post", "cyl"), b(280, 6, 150, 40, 4, 14, "cross"), b(294, 6, 136, 12, 4, 42, "cross")], roof_h=60)
# the police: blue, a sign and a blue lamp over the door
civic("police_station", "Поліція", 5, 3, 110, [("glass", 1), ("earth", 2), ("ceramic", 0), ("fabric", 6), {"sign": slot("fabric", 6), "lamp": slot("glass", 1), "star": slot("metal", 1)}],
      [b(170, 286, 120, 160, 6, 24, "sign", "round"), b(238, 290, 152, 24, 8, 16, "lamp", "ball"), b(240, 284, 126, 20, 4, 14, "star", "ball")], roof_h=60)
# the fire station: red, two big doors, a hose tower
civic("fire_station", "Пожежна частина", 5, 4, 120, [("fabric", 1), ("earth", 2), ("ceramic", 0), ("ceramic", 1), {"bay": slot("ceramic", 0), "bay_line": slot("fabric", 1), "tower": slot("fabric", 1), "bell": slot("metal", 1)}],
      [b(40, 386, 8, 180, 4, 100, "bay"), b(280, 386, 8, 180, 4, 100, "bay")] + [b(40, 387, 18 + i * 22, 180, 4, 3, "bay_line") for i in range(4)] + [b(280, 387, 18 + i * 22, 180, 4, 3, "bay_line") for i in range(4)]
      + [b(400, 20, 0, 80, 80, 240, "tower"), b(392, 12, 240, 96, 96, 40, "roof", "gable"), b(424, 60, 210, 30, 30, 24, "bell", "ball")], roof_h=70)
# a two-storey house
for id, name, wall, roof in [("house_tall_a", "Двоповерховий дім", ("ceramic", 1), ("autumn", 2)), ("house_tall_b", "Двоповерховий дім", ("glass", 3), ("wood", 5)), ("house_tall_c", "Двоповерховий дім", ("fabric_pink", 1), ("leaf", 0))]:
    W, D, H = 400, 400, 190
    extra = []
    for x in range(40, W - 60, 110):
        extra += [b(x - 4, D - 14, 128, 44, 4, 44, "trim"), b(x, D - 12, 132, 36, 4, 36, "glass"), b(x - 4, 10, 128, 44, 4, 44, "trim"), b(x, 8, 132, 36, 4, 36, "glass")]
    for y in range(40, D - 50, 110):
        extra += [b(W - 14, y - 4, 128, 4, 44, 44, "trim"), b(W - 12, y, 132, 4, 36, 36, "glass"), b(10, y - 4, 128, 4, 44, 44, "trim"), b(8, y, 132, 4, 36, 36, "glass")]
    extra += [b(10, D - 12, 112, W - 20, 6, 6, "trim"), b(120, D - 40, 0, 160, 30, 8, "stone"), b(140, D - 30, 104, 120, 40, 6, "trim")]
    building(id, name, 4, 4, H, {"stone": slot("ceramic", 1), "wall": slot(*wall), "roof": slot(*roof), "trim": slot("wood", 4), "door": slot("wood", 0),
                                 "knob": slot("metal", 1), "glass": slot("glass", 1), "flower": slot("fabric", 7)}, roof_h=90, extra=extra)
# a barn for the farm
civic("barn", "Хлів", 5, 4, 110, [("fabric", 1), ("earth", 0), ("ceramic", 0), ("wood", 2), {"hay": slot("autumn", 3), "x": slot("ceramic", 0)}],
      [b(180, 386, 8, 140, 4, 100, "door"), b(186, 388, 14, 128, 2, 4, "x"), b(186, 388, 100, 128, 2, 4, "x"), b(20, 330, 0, 60, 60, 50, "hay", "round")], roof_h=90)
# the sawmill: an open shed on posts over a saw bench, logs and planks around
saw = [b(x, y, 0, 12, 12, 150, "post", "cyl") for x in (20, 280, 560) for y in (20, 360)] + [b(0, 0, 150, 600, 400, 70, "roof", "gable")]
saw += [b(150, 160, 0, 300, 80, 50, "bench"), b(290, 150, 40, 8, 100, 60, "blade", "cyl"), b(160, 170, 50, 280, 60, 26, "log", "cyl")]
for i in range(4):
    saw += [b(30, 230 + i * 34, 0, 220, 30, 30, "log", "cyl")]
for i in range(5):
    saw += [b(360, 230 + i * 26, 0, 200, 24, 10, "plank")]
item("sawmill", "village", 6, 4, "floor", saw, {"post": slot("wood", 2), "roof": slot("earth", 2), "bench": slot("wood", 1), "blade": slot("metal", 0), "log": slot("wood", 0), "plank": slot("wood", 3)}, "free", name="Пилорама")
item("lamp_street", "village", 1, 1, "floor", [b(44, 44, 0, 12, 12, 170, "pole", "cyl"), b(40, 40, 160, 20, 20, 16, "bulb", "ball"), b(36, 36, 172, 28, 28, 8, "pole", "round")],
     {"pole": slot("metal", 2), "bulb": slot("pastel", 3)}, "free", name="Ліхтар вулиці")
items[-1]["tags"] = ["light"]

# vehicles (drawn moving; facing +x)
def vehicle(id, name, w, d, model, slots):
    item(id, "vehicle", w, d, "floor", model, slots, "free", name=name)
    items[-1]["hidden"] = True

def car_body(body, top, extra=(), tall=56):
    """A small car seen from every side, its front (+x) unmistakable: the cabin set well back, a long low bonnet
    in front of a windscreen that slopes forward in steps, a short boot; big pale headlights and a dark grille in
    front, small red tail lights behind; wheels with hubcaps, number plates at both ends, mirrors by the
    windscreen."""
    m = [b(8, 12, 12, 184, 76, 28, "body", "round"), b(2, 16, 10, 8, 68, 14, "bumper", "round"), b(190, 14, 10, 8, 72, 16, "bumper", "round"),
         # the cabin, back from the middle: rear window, side windows, roof
         b(28, 16, 40, 92, 68, tall - 18, "top", "round"), b(30, 14, 46, 86, 72, 16, "glass"), b(24, 20, 42, 6, 60, tall - 28, "glass"),
         b(72, 13, 46, 3, 74, 16, "top"),
         # the windscreen leaning forward over the bonnet
         b(118, 18, 40, 8, 64, tall - 22, "glass"), b(126, 18, 40, 8, 64, tall - 30, "glass"), b(134, 18, 40, 6, 64, tall - 38, "glass"),
         # the bonnet: lower than the cabin, with its seam and a bulge
         b(140, 30, 40, 46, 40, 3, "seam"), b(146, 36, 42, 30, 28, 2, "body"),
         b(50, 11, 18, 2, 2, 24, "seam"), b(96, 11, 18, 2, 2, 24, "seam"), b(50, 87, 18, 2, 2, 24, "seam"), b(96, 87, 18, 2, 2, 24, "seam"),
         b(116, 6, 40, 8, 8, 8, "body"), b(116, 86, 40, 8, 8, 8, "body")]
    for x in (30, 142):
        for y in (6, 86):
            m += [b(x, y, 0, 28, 8, 28, "wheel", "cyl"), b(x + 9, y + (-1 if y < 50 else 7), 9, 10, 2, 10, "hub", "cyl")]
    m += [b(188, 32, 14, 6, 36, 18, "grille"), b(184, 12, 22, 10, 20, 14, "light"), b(184, 68, 22, 10, 20, 14, "light"),
          b(4, 14, 26, 6, 12, 8, "tail"), b(4, 74, 26, 6, 12, 8, "tail"), b(2, 40, 14, 4, 20, 8, "plate"), b(194, 40, 8, 4, 20, 6, "plate")]
    return m + list(extra)


CAR_SLOTS = {"glass": slot("glass", 1), "grille": slot("ceramic", 5), "wheel": slot("ceramic", 5), "hub": slot("metal", 0), "light": slot("pastel", 3), "tail": slot("fabric", 1),
             "bumper": slot("metal", 0), "seam": slot("ceramic", 5), "plate": slot("ceramic", 0)}

vehicle("car_red", "Автомобіль", 2, 1, car_body("body", "top"), {**CAR_SLOTS, "body": slot("fabric", 1), "top": slot("fabric", 1)})
vehicle("car_blue", "Автомобіль", 2, 1, car_body("body", "top"), {**CAR_SLOTS, "body": slot("fabric", 6), "top": slot("fabric", 6)})
vehicle("police_car", "Поліцейське авто", 2, 1, car_body("body", "top", [b(80, 26, 72, 40, 14, 8, "siren", "round"), b(80, 52, 72, 40, 14, 8, "siren2", "round"),
        b(20, 10, 22, 160, 2, 10, "stripe"), b(20, 88, 22, 160, 2, 10, "stripe"), b(60, 10, 34, 50, 2, 6, "word"), b(60, 88, 34, 50, 2, 6, "word"), b(150, 10, 26, 30, 2, 4, "stripe2"), b(150, 88, 26, 30, 2, 4, "stripe2")]),
        {**CAR_SLOTS, "body": slot("ceramic", 0), "top": slot("fabric", 6), "siren": slot("fabric", 6), "siren2": slot("fabric", 1), "stripe": slot("fabric", 6), "stripe2": slot("autumn", 3), "word": slot("ceramic", 5)})
def wheels(xs, ys=(4, 86), r=28):
    out = []
    for x in xs:
        for y in ys:
            out += [b(x, y, 0, r, 10, r, "wheel", "cyl"), b(x + r // 2 - 6, y + (-1 if y < 50 else 9), r // 2 - 6, 12, 2, 12, "hub", "cyl")]
    return out


SERVICE = {"glass": slot("glass", 1), "wheel": slot("ceramic", 5), "hub": slot("metal", 0), "light": slot("pastel", 3), "tail": slot("fabric", 1),
           "bumper": slot("metal", 0), "seam": slot("ceramic", 5), "beacon": slot("fabric", 6), "beacon2": slot("fabric", 1), "grille": slot("ceramic", 5)}

# the ambulance: a long white van with a cab, red stripes and crosses on every side, beacons, rear doors
amb = [b(12, 12, 16, 196, 76, 104, "body", "round"), b(206, 12, 16, 74, 76, 66, "body", "round"), b(220, 14, 66, 48, 72, 30, "glass"),
       b(208, 13, 74, 4, 74, 26, "body"), b(276, 18, 20, 8, 64, 22, "grille"), b(280, 16, 12, 8, 68, 10, "bumper"), b(4, 16, 12, 10, 68, 10, "bumper"),
       b(12, 11, 50, 268, 2, 12, "stripe"), b(12, 89, 50, 268, 2, 12, "stripe"), b(12, 12, 120, 196, 76, 4, "body"),
       b(90, 10, 72, 36, 2, 12, "cross"), b(102, 10, 60, 12, 2, 36, "cross"), b(90, 90, 72, 36, 2, 12, "cross"), b(102, 90, 60, 12, 2, 36, "cross"),
       b(8, 30, 64, 2, 32, 12, "cross"), b(8, 41, 52, 2, 10, 36, "cross"), b(10, 49, 22, 2, 2, 90, "seam"), b(150, 10, 24, 2, 2, 80, "seam"),
       b(40, 22, 124, 120, 50, 6, "body", "round"), b(190, 22, 124, 16, 18, 10, "siren", "round"), b(190, 52, 124, 16, 18, 10, "siren2", "round"),
       b(282, 20, 30, 6, 12, 8, "light"), b(282, 68, 30, 6, 12, 8, "light"), b(8, 18, 34, 6, 10, 8, "tail"), b(8, 72, 34, 6, 10, 8, "tail")] + wheels((34, 150, 226))
# a van, not a sports car: the whole of it a third taller (it read as squashed)
for _bx in amb:
    _bx["box"][2] = round(_bx["box"][2] * 1.35)
    if _bx["slot"] not in ("wheel", "hub"):
        _bx["box"][5] = round(_bx["box"][5] * 1.35)
vehicle("ambulance", "Швидка", 3, 1, amb, {**SERVICE, "body": slot("ceramic", 0), "stripe": slot("fabric", 1), "cross": slot("fabric", 1), "siren": slot("glass", 1), "siren2": slot("fabric", 1)})

# the garbage truck: a cab and a ribbed green body with a lifting hopper at the back
gt = [b(222, 12, 14, 68, 76, 62, "body", "round"), b(232, 14, 54, 46, 72, 22, "glass"), b(286, 18, 18, 8, 64, 24, "grille"), b(290, 14, 10, 10, 72, 12, "bumper"),
      b(16, 10, 14, 204, 80, 86, "bin", "round")] + [b(30 + n * 30, 9, 20, 6, 2, 76, "rib") for n in range(6)] + [b(30 + n * 30, 89, 20, 6, 2, 76, "rib") for n in range(6)]
gt += [b(4, 14, 30, 16, 72, 60, "hopper", "round"), b(240, 30, 76, 20, 40, 8, "siren", "round"), b(4, 18, 30, 6, 10, 8, "tail")] + wheels((34, 150, 240))
vehicle("garbage_truck", "Сміттєвоз", 3, 1, gt, {**SERVICE, "body": slot("leaf", 0), "bin": slot("leaf", 2), "rib": slot("leaf", 0), "hopper": slot("ceramic", 5), "siren": slot("autumn", 3)})

# the fire truck: a cab with windows all round, a body of shuttered lockers, a ladder on the roof, a hose reel at the back
ft = [b(222, 12, 14, 68, 76, 66, "body", "round"), b(232, 14, 56, 46, 72, 24, "glass"), b(226, 13, 64, 2, 74, 16, "body"), b(286, 18, 18, 8, 64, 24, "grille"),
      b(290, 14, 10, 10, 72, 12, "bumper"), b(10, 12, 14, 214, 76, 70, "body", "round"), b(4, 16, 10, 8, 68, 12, "bumper")]
for k, x in enumerate(range(20, 210, 48)):
    ft += [b(x, 10, 24, 40, 2, 44, "shutter"), b(x, 88, 24, 40, 2, 44, "shutter")] + [b(x, 9, 30 + n * 10, 40, 2, 2, "seam") for n in range(4)] + [b(x, 89, 30 + n * 10, 40, 2, 2, "seam") for n in range(4)]
ft += [b(30, 26, 86, 190, 8, 6, "ladder"), b(30, 66, 86, 190, 8, 6, "ladder")] + [b(36 + n * 18, 26, 86, 4, 48, 4, "ladder") for n in range(11)]
ft += [b(10, 30, 40, 4, 40, 40, "reel", "cyl"), b(232, 22, 82, 16, 18, 10, "siren", "round"), b(232, 54, 82, 16, 18, 10, "siren2", "round"),
       b(292, 20, 32, 6, 12, 8, "light"), b(292, 68, 32, 6, 12, 8, "light"), b(4, 18, 30, 6, 10, 8, "tail"), b(4, 72, 30, 6, 10, 8, "tail"), b(10, 11, 18, 280, 2, 4, "stripe"), b(10, 89, 18, 280, 2, 4, "stripe")]
ft += wheels((30, 150, 240))
vehicle("fire_truck", "Пожежна машина", 3, 1, ft, {**SERVICE, "body": slot("fabric", 1), "shutter": slot("metal", 0), "ladder": slot("metal", 0), "reel": slot("wood", 3),
                                                   "stripe": slot("autumn", 3), "siren": slot("glass", 1), "siren2": slot("fabric", 1)})

vehicle("horse_cart", "Підвода", 3, 1, [b(10, 14, 22, 150, 72, 24, "cart"), b(10, 14, 46, 150, 6, 16, "cart"), b(10, 80, 46, 150, 6, 16, "cart"), b(40, 4, 0, 36, 8, 36, "wheel", "cyl"), b(40, 88, 0, 36, 8, 36, "wheel", "cyl"),
        b(20, 20, 46, 130, 60, 22, "load", "round"), b(160, 40, 30, 50, 6, 6, "shaft"), b(160, 54, 30, 50, 6, 6, "shaft"),
        b(200, 34, 34, 80, 32, 34, "horse", "round"), b(206, 38, 0, 10, 10, 36, "horse"), b(262, 38, 0, 10, 10, 36, "horse"), b(206, 54, 0, 10, 10, 36, "horse"), b(262, 54, 0, 10, 10, 36, "horse"),
        b(270, 40, 58, 22, 20, 36, "horse", "round"), b(280, 42, 82, 20, 16, 16, "horse", "round"), b(270, 44, 70, 8, 12, 24, "mane"), b(196, 46, 44, 8, 8, 24, "mane")],
        {"cart": slot("wood", 1), "wheel": slot("wood", 2), "load": slot("autumn", 3), "shaft": slot("wood", 0), "horse": slot("wood", 0), "mane": slot("earth", 2)})

# animals (drawn moving; facing +x), small models in the same style as everything else
def animal(id, name, model, slots):
    item(id, "animal", 1, 1, "floor", model, slots, "free", name=name)
    items[-1]["hidden"] = True

animal("duck", "Качка", [b(28, 34, 0, 44, 30, 22, "body", "ball"), b(20, 40, 12, 14, 18, 8, "tail", "cone"), b(36, 34, 14, 26, 6, 8, "wing", "round"), b(36, 58, 14, 26, 6, 8, "wing", "round"),
       b(60, 40, 18, 18, 18, 18, "head", "ball"), b(64, 39, 24, 4, 3, 4, "eye", "ball"), b(64, 55, 24, 4, 3, 4, "eye", "ball"), b(76, 46, 22, 12, 6, 4, "beak")],
       {"body": slot("wood", 3), "tail": slot("wood", 2), "wing": slot("wood", 2), "head": slot("leaf", 0), "eye": slot("ceramic", 5), "beak": slot("autumn", 1)})
animal("swan", "Лебідь", [b(24, 34, 0, 52, 32, 24, "body", "ball"), b(64, 44, 18, 8, 8, 34, "body", "cyl"), b(62, 42, 48, 14, 12, 12, "body", "ball"), b(74, 46, 50, 10, 4, 4, "beak")], {"body": slot("ceramic", 0), "beak": slot("autumn", 1)})
animal("chicken", "Курка", [b(34, 36, 6, 32, 26, 24, "body", "ball"), b(58, 42, 24, 14, 14, 14, "body", "ball"), b(62, 46, 36, 6, 4, 6, "comb"), b(70, 46, 28, 6, 4, 3, "beak"), b(42, 46, 0, 4, 4, 8, "leg"), b(52, 46, 0, 4, 4, 8, "leg")],
       {"body": slot("ceramic", 0), "comb": slot("fabric", 1), "beak": slot("autumn", 1), "leg": slot("autumn", 1)})
animal("goat", "Коза", [b(20, 36, 22, 54, 28, 26, "body", "round"), b(70, 40, 36, 20, 20, 22, "body", "round"), b(80, 44, 58, 4, 4, 12, "horn"), b(76, 44, 58, 4, 4, 12, "horn")] + [b(x, y, 0, 6, 6, 24, "leg") for x in (24, 66) for y in (38, 54)],
       {"body": slot("ceramic", 1), "horn": slot("wood", 2), "leg": slot("ceramic", 1)})
animal("dog_street", "Пес", [b(24, 38, 14, 46, 24, 20, "body", "round"), b(64, 40, 24, 22, 20, 20, "body", "round"), b(84, 46, 26, 8, 8, 8, "nose", "ball"), b(66, 40, 40, 6, 4, 12, "ear"), b(66, 56, 40, 6, 4, 12, "ear"),
       b(80, 41, 34, 4, 3, 4, "eye", "ball"), b(80, 56, 34, 4, 3, 4, "eye", "ball"), b(12, 46, 26, 16, 6, 6, "body", "round"), b(40, 37, 30, 14, 2, 6, "collar")] + [b(x, y, 0, 6, 6, 14, "body") for x in (28, 60) for y in (40, 56)],
       {"body": slot("wood", 1), "nose": slot("ceramic", 5), "ear": slot("wood", 0), "eye": slot("ceramic", 5), "collar": slot("fabric", 1)})
animal("squirrel", "Білка", [b(40, 44, 0, 20, 14, 18, "body", "ball"), b(54, 46, 14, 12, 10, 12, "body", "ball"), b(24, 44, 4, 18, 12, 28, "tail", "ball")], {"body": slot("autumn", 0), "tail": slot("autumn", 0)})
animal("rabbit", "Заєць", [b(36, 40, 0, 30, 20, 20, "body", "ball"), b(60, 44, 14, 14, 14, 14, "body", "ball"), b(64, 46, 26, 4, 4, 16, "body"), b(68, 50, 26, 4, 4, 16, "body"), b(30, 46, 8, 8, 8, 8, "tail", "ball")],
       {"body": slot("wood", 3), "tail": slot("ceramic", 0)})
animal("deer", "Олень", [b(20, 38, 40, 60, 26, 30, "body", "round"), b(74, 42, 60, 18, 18, 30, "body", "round"), b(80, 44, 90, 4, 4, 22, "antler"), b(86, 50, 90, 4, 4, 22, "antler"), b(78, 40, 104, 14, 4, 4, "antler"), b(84, 54, 104, 14, 4, 4, "antler")]
       + [b(x, y, 0, 6, 6, 42, "leg") for x in (24, 70) for y in (40, 56)], {"body": slot("wood", 1), "antler": slot("wood", 3), "leg": slot("wood", 0)})
animal("fox", "Лисиця", [b(26, 40, 10, 44, 20, 18, "body", "round"), b(66, 42, 18, 18, 16, 16, "body", "round"), b(82, 46, 20, 8, 8, 6, "nose"), b(10, 42, 14, 22, 12, 12, "tail", "round"), b(8, 44, 16, 8, 8, 8, "tip", "ball")]
       + [b(x, y, 0, 5, 5, 12, "leg") for x in (30, 60) for y in (42, 54)], {"body": slot("autumn", 0), "nose": slot("ceramic", 5), "tail": slot("autumn", 0), "tip": slot("ceramic", 0), "leg": slot("earth", 2)})
animal("cow", "Корова", [b(10, 30, 30, 70, 40, 36, "body", "round"), b(76, 36, 46, 22, 28, 26, "body", "round"), b(30, 34, 50, 20, 4, 14, "spot"), b(50, 66, 40, 16, 4, 14, "spot")]
       + [b(x, y, 0, 8, 8, 32, "leg") for x in (14, 70) for y in (34, 60)], {"body": slot("ceramic", 0), "spot": slot("ceramic", 5), "leg": slot("ceramic", 1)})
animal("sheep", "Вівця", [b(20, 32, 16, 56, 36, 30, "wool", "round"), b(70, 40, 24, 18, 18, 18, "face", "round")] + [b(x, y, 0, 6, 6, 18, "face") for x in (26, 64) for y in (36, 60)],
       {"wool": slot("ceramic", 0), "face": slot("ceramic", 5)})
animal("butterfly", "Метелик", [b(44, 46, 30, 12, 4, 4, "body"), b(36, 34, 30, 14, 12, 4, "wing", "round"), b(36, 52, 30, 14, 12, 4, "wing", "round")], {"body": slot("ceramic", 5), "wing": slot("fabric", 2)})
animal("bird", "Пташка", [b(36, 42, 0, 26, 16, 16, "body", "ball"), b(58, 44, 10, 12, 12, 12, "body", "ball"), b(68, 48, 14, 6, 4, 3, "beak"), b(24, 46, 6, 14, 8, 4, "body")], {"body": slot("glass", 1), "beak": slot("autumn", 1)})


# street furniture: bins, hydrants, a bus stop, a bike rack, a post box; a playground; the water tower; the dump
item("trash_bin", "village", 1, 1, "floor", [b(34, 34, 0, 32, 32, 44, "bin", "cyl"), b(30, 30, 44, 40, 40, 6, "lid", "cyl"), b(46, 46, 50, 8, 8, 4, "lid")]
     + [b(34, 33, 10 + n * 10, 32, 1, 2, "rib") for n in range(3)], {"bin": slot("leaf", 0), "lid": slot("leaf", 2), "rib": slot("leaf", 2)}, "free", name="Смітник")
item("hydrant", "village", 1, 1, "floor", [b(40, 40, 0, 20, 20, 40, "body", "cyl"), b(36, 36, 36, 28, 28, 8, "body", "cyl"), b(44, 44, 44, 12, 12, 8, "body", "ball"),
     b(30, 46, 22, 10, 8, 8, "cap", "cyl"), b(60, 46, 22, 10, 8, 8, "cap", "cyl")], {"body": slot("fabric", 1), "cap": slot("metal", 0)}, "free", name="Гідрант")
item("bus_stop", "village", 2, 1, "floor", [b(8, 10, 0, 8, 8, 120, "pole"), b(184, 10, 0, 8, 8, 120, "pole"), b(0, 0, 118, 200, 70, 8, "roof"), b(10, 4, 20, 180, 4, 96, "glass"),
     b(30, 30, 0, 140, 30, 34, "bench"), b(176, 60, 0, 8, 8, 150, "pole"), b(160, 58, 128, 40, 4, 28, "sign", "round")],
     {"pole": slot("metal", 2), "roof": slot("fabric", 6), "glass": slot("glass", 0), "bench": slot("wood", 1), "sign": slot("fabric", 6)}, "free", name="Зупинка")
item("bike_rack", "village", 2, 1, "floor", [b(10, 40, 0, 180, 8, 6, "rail")] + [b(20 + n * 40, 38, 0, 6, 14, 40, "loop", "round") for n in range(5)] + [b(36, 30, 10, 60, 30, 30, "bike", "round")],
     {"rail": slot("metal", 2), "loop": slot("metal", 0), "bike": slot("fabric", 6)}, "free", name="Велопарковка")
item("post_box", "village", 1, 1, "floor", [b(36, 36, 0, 8, 8, 60, "pole"), b(26, 30, 54, 48, 40, 50, "box", "round"), b(30, 70, 86, 40, 2, 6, "slot")],
     {"pole": slot("metal", 2), "box": slot("autumn", 3), "slot": slot("ceramic", 5)}, "free", name="Поштова скриня")
item("slide", "village", 2, 1, "floor", [b(10, 30, 0, 40, 40, 110, "tower"), b(4, 24, 110, 52, 52, 30, "roof", "gable"), b(50, 36, 10, 140, 28, 12, "chute"), b(40, 36, 30, 24, 28, 80, "chute"),
     b(20, 34, 0, 4, 4, 110, "rail"), b(40, 34, 0, 4, 4, 110, "rail")], {"tower": slot("wood", 3), "roof": slot("fabric", 1), "chute": slot("fabric", 2), "rail": slot("metal", 0)}, "free", name="Гірка")
item("seesaw", "village", 2, 1, "floor", [b(90, 40, 0, 20, 20, 30, "base", "cyl"), b(10, 44, 24, 180, 12, 8, "plank"), b(14, 40, 32, 10, 20, 16, "grip"), b(176, 40, 32, 10, 20, 16, "grip")],
     {"base": slot("fabric", 6), "plank": slot("fabric", 2), "grip": slot("fabric", 1)}, "free", name="Гойдалка-балансир")
item("climbing_frame", "village", 2, 2, "floor", [b(x, y, 0, 6, 6, 100, "bar") for x in (20, 100, 180) for y in (20, 100, 180)]
     + [b(20, y, z, 166, 6, 6, "bar") for y in (20, 100, 180) for z in (30, 64, 98)] + [b(x, 20, 98, 6, 166, 6, "bar") for x in (20, 100, 180)],
     {"bar": slot("fabric", 4)}, "free", name="Драбинки")
item("carousel", "village", 2, 2, "floor", [b(20, 20, 0, 160, 160, 14, "disc", "cyl"), b(94, 94, 14, 12, 12, 60, "pole", "cyl"), b(40, 40, 60, 120, 120, 6, "bar", "cyl")]
     + [b(96 + int(60 * __import__("math").cos(a * 1.57)), 96 + int(60 * __import__("math").sin(a * 1.57)), 14, 8, 8, 50, "pole") for a in range(4)],
     {"disc": slot("fabric", 2), "pole": slot("metal", 0), "bar": slot("fabric", 1)}, "free", name="Карусель")
# the water tower: four legs, cross braces, a ladder, a tank with a conical roof and a gallery round it
wt = [b(x, y, 0, 14, 14, 300, "leg") for x in (20, 166) for y in (20, 166)]
wt += [b(20, 20, z, 160, 6, 8, "brace") for z in (90, 190)] + [b(20, 172, z, 160, 6, 8, "brace") for z in (90, 190)] + [b(20, 20, z, 6, 160, 8, "brace") for z in (90, 190)] + [b(174, 20, z, 6, 160, 8, "brace") for z in (90, 190)]
wt += [b(96, 180, 0, 4, 4, 300, "ladder"), b(110, 180, 0, 4, 4, 300, "ladder")] + [b(96, 180, z, 18, 4, 3, "ladder") for z in range(10, 300, 16)]
wt += [b(10, 10, 300, 180, 180, 8, "gallery", "cyl"), b(30, 30, 308, 140, 140, 110, "tank", "cyl"), b(24, 24, 418, 152, 152, 50, "roof", "cone"), b(10, 10, 308, 180, 180, 24, "rail_ring", "cyl")]
item("water_tower", "village", 2, 2, "floor", wt, {"leg": slot("metal", 2), "brace": slot("metal", 2), "ladder": slot("metal", 0), "gallery": slot("wood", 2),
     "tank": slot("glass", 1), "roof": slot("fabric", 1), "rail_ring": slot("metal", 0)}, "free", ["enter"], name="Водонапірна вежа")
# the dump: heaps, a skip, old tyres, a fence of boards
item("trash_heap", "village", 2, 2, "floor", [b(10, 10, 0, 180, 180, 40, "heap", "cone"), b(40, 40, 30, 50, 40, 26, "bag", "ball"), b(110, 70, 26, 40, 40, 24, "bag2", "ball"),
     b(60, 120, 20, 50, 20, 30, "plank"), b(130, 30, 16, 30, 30, 20, "can", "cyl")], {"heap": slot("earth", 3), "bag": slot("ceramic", 5), "bag2": slot("leaf", 0), "plank": slot("wood", 2), "can": slot("metal", 0)}, "free", name="Купа сміття")
item("skip", "village", 2, 1, "floor", [b(10, 10, 0, 180, 80, 50, "body", "round"), b(16, 16, 46, 168, 68, 10, "junk", "round"), b(20, 8, 10, 160, 2, 30, "rib")],
     {"body": slot("autumn", 3), "junk": slot("earth", 2), "rib": slot("autumn", 1)}, "free", name="Контейнер")
item("tyres", "village", 1, 1, "floor", [b(20, 20, z, 60, 60, 16, "tyre", "cyl") for z in (0, 16, 32)], {"tyre": slot("ceramic", 5)}, "free", name="Старі шини")
item("board_fence", "village", 1, 1, "floor", [b(0, 44, 0, 100, 12, 90, "board")] + [b(n * 25, 42, 0, 2, 16, 90, "gap") for n in range(4)], {"board": slot("wood", 2), "gap": slot("wood", 0)}, "free", name="Паркан із дощок")
