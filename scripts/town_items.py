# The last of the settlement's places: the church and its cemetery, the hostel, the bread factory that mills
# the field's wheat for the village, and the farm's little wool-and-cheese factory with its shop.
# Run inside gen_base_content.py after cute_animals.py.

# ---- the church: a Catholic church (костел) in stone, Gothic: a steep slate roof, buttresses along the nave,
# tall pointed windows of coloured glass, a rose window over the door, the bell tower with its spire and cross
church = [b(0, 0, 0, 500, 400, 10, "base"), b(60, 20, 10, 380, 300, 170, "wall"), b(50, 10, 180, 400, 320, 150, "roof", "gable")]
# the tower over the door (the front faces +y), its belfry openings, the spire and the cross
church += [b(180, 270, 10, 140, 130, 300, "wall"), b(172, 262, 310, 156, 146, 14, "trim"), b(196, 286, 324, 108, 98, 60, "wall"),
           b(196, 284, 400, 108, 102, 160, "roof", "cone"), b(244, 330, 560, 12, 12, 46, "gold"), b(226, 330, 586, 48, 12, 10, "gold"),
           b(216, 396, 340, 22, 4, 36, "dark", "round"), b(262, 396, 340, 22, 4, 36, "dark", "round"), b(176, 300, 340, 4, 22, 36, "dark", "round"),
           b(320, 300, 340, 4, 22, 36, "dark", "round"), b(236, 396, 210, 28, 4, 28, "clock", "cyl")]
# the door: pointed, in a deep stone frame; the rose window over it
church += [b(214, 396, 10, 72, 8, 130, "trim", "round"), b(224, 400, 10, 52, 4, 110, "door", "round"), b(220, 398, 150, 60, 4, 60, "rose", "cyl"),
           b(234, 401, 164, 32, 2, 32, "rose2", "cyl"), b(246, 402, 176, 8, 2, 8, "gold", "cyl")]
# small towers at the front corners
for x in (150, 320):
    church += [b(x, 300, 10, 30, 30, 220, "wall"), b(x - 2, 298, 230, 34, 34, 50, "roof", "cone")]
# buttresses and the pointed windows down both sides of the nave and at the back
for y in (40, 120, 200):
    for x in (40, 440):
        church += [b(x, y, 10, 20, 26, 150, "trim"), b(x + (6 if x < 100 else -6), y, 150, 20, 26, 20, "roof", "gable")]
    church += [b(56, y + 30, 50, 6, 26, 100, "glass", "round"), b(438, y + 30, 50, 6, 26, 100, "glass", "round")]
    church += [b(55, y + 36, 80, 4, 14, 20, "glass2"), b(441, y + 36, 80, 4, 14, 20, "glass2")]
church += [b(180 + k * 60, 16, 50, 26, 6, 110, "glass", "round") for k in range(3)]
item("church", "village", 5, 4, "floor", church,
     {"base": slot("stone", 2), "wall": slot("stone", 1), "trim": slot("stone", 0), "roof": slot("ceramic", 5), "gold": slot("autumn", 3), "dark": slot("ceramic", 5),
      "door": slot("wood", 0), "rose": slot("fabric", 6), "rose2": slot("fabric", 1), "glass": slot("fabric", 6), "glass2": slot("fabric", 2), "clock": slot("ceramic", 0)},
     "free", name="Костел святого Миколая")
items[-1]["tags"] = []
# its inside: pews, the altar with candles and a crucifix, an organ, coloured windows, the Stations on the walls
# a pew faces -y (towards the altar when the rows stand with the altar to the north): the seat, the back behind it,
# the low kneeler in front, solid carved ends
item("pew", "village", 2, 1, "floor",
     [b(0, 6, 0, 10, 88, 96, "wood", "round"), b(190, 6, 0, 10, 88, 96, "wood", "round"), b(10, 34, 38, 180, 44, 8, "seat"), b(10, 34, 20, 180, 6, 18, "wood"),
      b(10, 78, 38, 180, 10, 58, "wood"), b(10, 84, 88, 180, 8, 8, "wood"), b(10, 8, 8, 180, 16, 8, "kneeler"), b(10, 10, 0, 6, 12, 8, "wood"), b(184, 10, 0, 6, 12, 8, "wood")],
     {"wood": slot("wood", 0), "seat": slot("wood", 1), "kneeler": slot("fabric", 1)}, "free", ["sit"], name="Лава")
item("altar", "village", 2, 1, "floor",
     [b(10, 20, 0, 180, 60, 90, "stone"), b(4, 14, 90, 192, 72, 8, "cloth"), b(4, 74, 40, 192, 4, 50, "cloth2"), b(30, 40, 98, 6, 6, 30, "candle", "cyl"), b(164, 40, 98, 6, 6, 30, "candle", "cyl"),
      b(30, 40, 128, 6, 6, 6, "flame"), b(164, 40, 128, 6, 6, 6, "flame"), b(96, 30, 98, 8, 8, 60, "gold"), b(84, 30, 136, 32, 8, 6, "gold"), b(80, 50, 98, 40, 20, 10, "book")],
     {"stone": slot("ceramic", 0), "cloth": slot("ceramic", 0), "cloth2": slot("autumn", 3), "candle": slot("ceramic", 0), "flame": slot("autumn", 1), "gold": slot("autumn", 3), "book": slot("fabric", 1)},
     "free", name="Вівтар")
items[-1]["tags"] = ["light"]
item("crucifix", "village", 1, 1, "wall", [b(46, 0, 70, 8, 6, 120, "wood"), b(20, 0, 150, 60, 6, 8, "wood"), b(44, 6, 120, 12, 3, 40, "figure"), b(28, 6, 150, 44, 3, 5, "figure")],
     {"wood": slot("wood", 0), "figure": slot("ceramic", 1)}, "free", name="Розп'яття")
item("stained_glass", "village", 1, 1, "wall",
     [b(24, 0, 60, 52, 4, 120, "stone", "round"), b(30, 2, 66, 40, 3, 30, "g1"), b(30, 2, 96, 40, 3, 30, "g2"), b(30, 2, 126, 40, 3, 30, "g3"), b(42, 2, 156, 16, 3, 16, "g1", "ball"),
      b(48, 3, 66, 4, 2, 106, "stone")],
     {"stone": slot("stone", 0), "g1": slot("fabric", 6), "g2": slot("fabric", 1), "g3": slot("autumn", 3)}, "free", name="Вітраж")
item("organ", "village", 2, 1, "floor",
     [b(10, 50, 0, 180, 50, 70, "wood"), b(30, 30, 60, 140, 20, 12, "keys")] + [b(14 + k * 16, 70, 70, 10, 10, 60 + (k % 4) * 30 + (5 - abs(k - 5)) * 10, "pipe", "cyl") for k in range(11)],
     {"wood": slot("wood", 0), "keys": slot("ceramic", 0), "pipe": slot("metal", 1)}, "free", ["play_music"], name="Орган")
item("madonna", "village", 1, 1, "floor", [b(30, 30, 0, 40, 40, 30, "stone"), b(38, 38, 30, 24, 24, 60, "robe", "cone"), b(42, 42, 86, 16, 16, 16, "skin", "ball"), b(36, 36, 84, 28, 28, 10, "robe2", "round")],
     {"stone": slot("stone", 0), "robe": slot("glass", 1), "robe2": slot("ceramic", 0), "skin": slot("pastel", 3)}, "free", name="Статуя Діви Марії")

# ---- the cemetery: graves of several kinds, a wrought fence, a small chapel, candles
item("grave_cross", "village", 1, 1, "floor",
     [b(20, 30, 0, 60, 60, 10, "mound", "round"), b(46, 20, 0, 8, 8, 90, "cross"), b(30, 20, 60, 40, 8, 8, "cross"), b(36, 40, 10, 10, 10, 10, "flower", "ball"), b(56, 50, 10, 8, 8, 8, "flower2", "ball")],
     {"mound": slot("earth", 1), "cross": slot("wood", 2), "flower": slot("fabric", 1), "flower2": slot("fabric", 2)}, "free", name="Могила з хрестом")
item("grave_stone", "village", 1, 1, "floor",
     [b(20, 36, 0, 60, 56, 8, "mound", "round"), b(26, 20, 0, 48, 14, 70, "stone", "round"), b(22, 18, 0, 56, 18, 8, "stone"), b(34, 33, 40, 32, 2, 4, "carve"), b(40, 33, 48, 20, 2, 3, "carve"),
      b(40, 60, 8, 20, 14, 8, "candle_box"), b(46, 64, 16, 8, 6, 10, "glow", "cyl")],
     {"mound": slot("leaf", 0), "stone": slot("stone", 0), "carve": slot("stone", 3), "candle_box": slot("fabric", 1), "glow": slot("autumn", 1)}, "free", name="Надгробок")
items[-1]["tags"] = ["light"]
item("grave_old", "village", 1, 1, "floor",
     [b(16, 30, 0, 66, 60, 8, "mound", "round"), b(30, 16, 0, 40, 12, 56, "stone", "round"), b(34, 18, 40, 30, 10, 20, "moss", "round"), b(60, 60, 0, 14, 14, 14, "moss", "ball")],
     {"mound": slot("leaf", 0), "stone": slot("stone", 2), "moss": slot("leaf", 0)}, "free", name="Старий надгробок")
item("iron_fence", "village", 1, 1, "floor",
     [b(0, 46, 0, 100, 8, 10, "base")] + [b(6 + k * 16, 48, 10, 4, 4, 80, "bar") for k in range(6)] + [b(0, 47, 50, 100, 6, 4, "bar"), b(0, 47, 86, 100, 6, 4, "bar")]
     + [b(6 + k * 16, 47, 90, 4, 6, 8, "bar", "cone") for k in range(6)],
     {"base": slot("stone", 0), "bar": slot("ceramic", 5)}, "free", name="Кована огорожа")
item("cemetery_gate", "village", 2, 1, "floor",
     [b(0, 40, 0, 20, 20, 150, "pillar"), b(180, 40, 0, 20, 20, 150, "pillar"), b(20, 47, 10, 160, 4, 4, "bar"), b(20, 47, 100, 160, 4, 4, "bar")]
     + [b(30 + k * 16, 48, 14, 4, 4, 86, "bar") for k in range(10)] + [b(20, 46, 104, 160, 6, 30, "bar", "gable"), b(96, 46, 130, 8, 6, 30, "bar")],
     {"pillar": slot("stone", 0), "bar": slot("ceramic", 5)}, "free", name="Ворота кладовища")
# the chapel: a small Catholic one in the same stone as the костел: a steep slate roof, a little bell tower with
# a pointed spire and a cross over the front gable, a pointed door, a rose window, pointed windows down the sides
chapel = [b(4, 4, 0, 192, 192, 8, "base"), b(30, 20, 8, 140, 170, 150, "wall"), b(22, 12, 158, 156, 186, 110, "roof", "gable")]
chapel += [b(68, 146, 8, 64, 50, 250, "wall"), b(64, 142, 258, 72, 58, 8, "trim"), b(74, 152, 266, 52, 38, 34, "wall"),
           b(84, 188, 272, 12, 4, 20, "dark", "round"), b(104, 188, 272, 12, 4, 20, "dark", "round"),
           b(72, 150, 300, 56, 42, 130, "roof", "cone"), b(97, 168, 430, 6, 6, 40, "gold"), b(86, 168, 452, 28, 6, 6, "gold")]
chapel += [b(78, 194, 8, 44, 4, 100, "trim", "round"), b(84, 196, 8, 32, 2, 86, "door", "round"), b(84, 195, 140, 32, 2, 32, "rose", "cyl"), b(94, 196, 148, 12, 2, 12, "rose2", "cyl")]
for y in (40, 100):
    chapel += [b(26, y, 40, 6, 22, 80, "glass", "round"), b(168, y, 40, 6, 22, 80, "glass", "round"), b(16, y - 6, 8, 14, 34, 120, "trim"), b(170, y - 6, 8, 14, 34, 120, "trim")]
item("chapel", "village", 2, 2, "floor", chapel,
     {"base": slot("stone", 2), "wall": slot("stone", 1), "trim": slot("stone", 0), "roof": slot("ceramic", 5), "gold": slot("autumn", 3), "dark": slot("ceramic", 5),
      "door": slot("wood", 0), "rose": slot("fabric", 6), "rose2": slot("fabric", 1), "glass": slot("fabric", 6)}, "free", name="Каплиця")

# ---- the hostel: a long two-storey house with many windows, a sign with a stork
hostel = [b(0, 0, 0, 600, 400, 8, "stone"), b(10, 10, 8, 580, 380, 200, "wall"), b(0, 0, 208, 600, 400, 80, "roof", "gable"), b(10, 386, 104, 580, 6, 6, "trim")]
for x in range(40, 560, 90):
    for z in (40, 136):
        hostel += [b(x, 388, z, 40, 4, 44, "glass"), b(x - 4, 386, z - 4, 48, 4, 4, "trim"), b(x, 8, z, 40, 4, 44, "glass")]
for y in range(60, 360, 100):
    for z in (40, 136):
        hostel += [b(8, y, z, 4, 40, 44, "glass"), b(588, y, z, 4, 40, 44, "glass")]
hostel += [b(270, 386, 8, 60, 6, 96, "door"), b(220, 392, 112, 160, 6, 22, "sign", "round"), b(320, 390, 116, 24, 4, 14, "bird", "ball")]
item("hostel", "village", 6, 4, "floor", hostel,
     {"stone": slot("ceramic", 1), "wall": slot("pastel", 1), "roof": slot("fabric", 6), "trim": slot("ceramic", 0), "glass": slot("glass", 1), "door": slot("wood", 2), "sign": slot("ceramic", 0),
      "bird": slot("fabric", 1)}, "free", name="Хостел «Лелека»")

# ---- the bread factory: a long brick hall, grain silos, a mill tower, a chimney, the loading bay
factory = [b(0, 0, 0, 800, 500, 8, "stone"), b(10, 10, 8, 600, 480, 160, "wall"), b(0, 0, 168, 620, 500, 50, "roof", "gable"), b(620, 120, 8, 170, 300, 260, "wall2"),
           b(610, 110, 268, 190, 320, 20, "roof"), b(80, 60, 168, 50, 50, 200, "chimney", "cyl"), b(74, 54, 368, 62, 62, 14, "chimney", "cyl")]
for x in range(40, 600, 80):
    factory += [b(x, 488, 60, 50, 4, 60, "glass"), b(x, 8, 60, 50, 4, 60, "glass")]
factory += [b(200, 488, 8, 160, 6, 120, "shutter"), b(390, 488, 8, 160, 6, 120, "shutter")] + [b(200, 489, 16 + k * 18, 160, 6, 3, "seam") for k in range(6)]
factory += [b(640, 140, 220, 120, 4, 30, "sign", "round"), b(700, 300, 268, 80, 80, 40, "wall2")]
item("bread_factory", "village", 8, 5, "floor", factory,
     {"stone": slot("ceramic", 1), "wall": slot("pot", 0), "wall2": slot("ceramic", 0), "roof": slot("ceramic", 5), "chimney": slot("pot", 0), "glass": slot("glass", 1),
      "shutter": slot("metal", 0), "seam": slot("metal", 2), "sign": slot("autumn", 3)}, "free", name="Хлібзавод «Колос»")
items[-1]["tags"] = []
# its machines inside
item("flour_mill", "village", 2, 2, "floor",
     [b(20, 20, 0, 160, 160, 60, "body"), b(40, 40, 60, 120, 120, 80, "hopper", "cone"), b(80, 80, 140, 40, 40, 40, "body", "cyl"), b(150, 60, 20, 40, 30, 30, "chute"), b(150, 100, 0, 40, 40, 40, "sack", "round")],
     {"body": slot("metal", 0), "hopper": slot("metal", 2), "chute": slot("metal", 1), "sack": slot("ceramic", 1)}, "free", name="Млин")
item("dough_mixer", "village", 1, 1, "floor", [b(20, 20, 0, 60, 60, 40, "body"), b(16, 16, 40, 68, 68, 30, "bowl", "cyl"), b(24, 24, 60, 52, 52, 8, "dough", "ball"), b(40, 70, 40, 20, 20, 70, "body")],
     {"body": slot("ceramic", 0), "bowl": slot("metal", 0), "dough": slot("ceramic", 1)}, "free", name="Тістоміс")
item("tunnel_oven", "village", 3, 1, "floor",
     [b(0, 10, 0, 300, 80, 30, "frame"), b(40, 10, 30, 220, 80, 70, "oven", "round"), b(60, 88, 40, 180, 2, 30, "fire"), b(0, 30, 30, 300, 40, 4, "belt")]
     + [b(10 + k * 40, 34, 34, 26, 30, 14, "loaf", "round") for k in range(7)],
     {"frame": slot("metal", 2), "oven": slot("metal", 0), "fire": slot("autumn", 1), "belt": slot("ceramic", 5), "loaf": slot("wood", 3)}, "free", name="Конвеєрна піч")
item("flour_sacks", "village", 1, 1, "floor", [b(8 + (k % 2) * 44, 10 + (k // 2) * 40, 0, 40, 36, 30, "sack", "round") for k in range(4)] + [b(28, 30, 30, 40, 36, 28, "sack", "round")],
     {"sack": slot("ceramic", 1)}, "free", name="Мішки з борошном")
# the grain truck: a cab in front, an open bed of grain behind it, three axles
_gr = [b(214, 12, 14, 76, 76, 70, "body", "round"), b(222, 14, 58, 52, 72, 22, "glass"), b(272, 18, 40, 10, 64, 34, "glass"), b(286, 20, 16, 8, 60, 26, "grille"),
       b(288, 12, 10, 10, 76, 12, "bumper"), b(286, 12, 26, 6, 16, 12, "light"), b(286, 72, 26, 6, 16, 12, "light"), b(222, 6, 52, 8, 8, 8, "body"), b(222, 86, 52, 8, 8, 8, "body"),
       b(10, 10, 20, 200, 80, 12, "frame"), b(10, 10, 32, 200, 4, 40, "side"), b(10, 86, 32, 200, 4, 40, "side"), b(10, 10, 32, 4, 80, 40, "side"), b(206, 10, 32, 4, 80, 46, "side"),
       b(14, 14, 32, 192, 72, 34, "load", "round"), b(40, 26, 62, 130, 48, 10, "load", "round"), b(4, 16, 10, 8, 68, 12, "bumper"), b(4, 16, 26, 6, 10, 8, "tail"), b(4, 74, 26, 6, 10, 8, "tail")]
_gr += [b(x, y, 0, 30, 10, 30, "wheel", "cyl") for x in (30, 150, 236) for y in (2, 88)] + [b(x + 9, y, 9, 12, 2, 12, "hub", "cyl") for x in (30, 150, 236) for y in (1, 97)]
vehicle("grain_truck", "Зерновоз", 3, 1, _gr, {**CAR_SLOTS, "body": slot("leaf", 0), "frame": slot("ceramic", 5), "side": slot("wood", 1), "load": slot("autumn", 3)})
# the bread van: a tall box behind a short cab with a sloping windscreen, a loaf painted on its sides
_bv = [b(10, 12, 12, 130, 76, 92, "body", "round"), b(138, 12, 12, 54, 76, 44, "body", "round"), b(138, 14, 52, 22, 72, 30, "glass"), b(158, 18, 52, 8, 64, 22, "glass"),
       b(166, 18, 52, 6, 64, 12, "glass"), b(10, 12, 102, 130, 76, 4, "top"), b(186, 30, 16, 6, 40, 18, "grille"), b(184, 12, 22, 10, 18, 14, "light"), b(184, 70, 22, 10, 18, 14, "light"),
       b(188, 14, 10, 8, 72, 14, "bumper"), b(2, 16, 10, 8, 68, 14, "bumper"), b(4, 16, 30, 6, 12, 10, "tail"), b(4, 72, 30, 6, 12, 10, "tail"), b(6, 48, 20, 2, 2, 76, "seam"),
       b(30, 10, 44, 90, 2, 34, "sign", "round"), b(30, 88, 44, 90, 2, 34, "sign", "round"), b(150, 6, 54, 6, 8, 8, "body"), b(150, 86, 54, 6, 8, 8, "body")]
_bv += [b(x, y, 0, 28, 8, 28, "wheel", "cyl") for x in (26, 140) for y in (6, 86)] + [b(x + 9, y, 9, 10, 2, 10, "hub", "cyl") for x in (26, 140) for y in (5, 93)]
vehicle("bread_van", "Хлібний фургон", 2, 1, _bv, {**CAR_SLOTS, "body": slot("ceramic", 0), "top": slot("ceramic", 1), "sign": slot("autumn", 3)})

# ---- the wool-and-cheese factory at the farm: carding, spinning, weaving; vats, presses and cheese ripening
civic("creamery", "Міні-фабрика «Овечка»", 6, 4, 110, [("ceramic", 0), ("fabric", 6), ("wood", 3), ("wood", 2), {"sign": slot("ceramic", 0), "wool": slot("ceramic", 0)}],
      [b(200, 386, 136, 200, 6, 28, "sign", "round"), b(290, 384, 140, 30, 4, 20, "wool", "ball")], roof_h=70, chimney=True)
item("spinning_wheel", "village", 1, 1, "floor",
     [b(20, 30, 0, 60, 30, 40, "wood"), b(20, 44, 40, 70, 4, 70, "wheel", "cyl"), b(46, 44, 70, 8, 8, 8, "wood", "ball"), b(70, 40, 40, 10, 14, 40, "wood"), b(72, 42, 76, 8, 10, 14, "wool", "ball")],
     {"wood": slot("wood", 1), "wheel": slot("wood", 3), "wool": slot("ceramic", 0)}, "free", name="Прядка")
item("loom", "village", 2, 1, "floor",
     [b(0, 10, 0, 10, 80, 130, "wood"), b(190, 10, 0, 10, 80, 130, "wood"), b(0, 10, 130, 200, 80, 8, "wood"), b(10, 20, 60, 180, 60, 4, "cloth"), b(10, 46, 64, 180, 6, 60, "thread"),
      b(20, 20, 40, 160, 10, 10, "wood")], {"wood": slot("wood", 2), "cloth": slot("fabric", 1), "thread": slot("ceramic", 0)}, "free", name="Ткацький верстат")
item("wool_bale", "village", 1, 1, "floor", [b(10, 10, 0, 80, 80, 50, "wool", "round"), b(20, 20, 40, 60, 60, 30, "wool", "ball"), b(10, 48, 20, 80, 4, 4, "string")],
     {"wool": slot("ceramic", 0), "string": slot("wood", 1)}, "free", name="Тюк вовни")
item("yarn_shelf", "village", 2, 1, "floor", [b(0, 0, 0, 200, 40, 160, "wood")] + [b(4, 4, z, 192, 36, 4, "wood") for z in (40, 90, 140)]
     + [b(12 + k * 30, 12, z + 4, 22, 22, 22, ("y1", "y2", "y3")[(k + z) % 3], "ball") for k in range(6) for z in (40, 90)],
     {"wood": slot("wood", 1), "y1": slot("fabric", 1), "y2": slot("fabric", 6), "y3": slot("autumn", 3)}, "free", name="Полиця з пряжею")
item("cheese_vat", "village", 2, 1, "floor", [b(10, 10, 0, 180, 80, 70, "vat", "round"), b(16, 16, 60, 168, 68, 8, "milk"), b(90, 10, 70, 8, 80, 50, "frame")],
     {"vat": slot("metal", 0), "milk": slot("ceramic", 0), "frame": slot("metal", 2)}, "free", name="Сироварня")
item("cheese_rack", "village", 2, 1, "floor", [b(0, 10, 0, 200, 60, 160, "wood")] + [b(4, 14, z, 192, 52, 4, "wood") for z in (30, 80, 130)]
     + [b(10 + k * 46, 20, z + 4, 40, 40, 20, "cheese", "cyl") for k in range(4) for z in (30, 80, 130)],
     {"wood": slot("wood", 2), "cheese": slot("autumn", 3)}, "free", name="Полиці з сирами")
item("milk_can", "village", 1, 1, "floor", [b(30, 30, 0, 40, 40, 50, "can", "cyl"), b(36, 36, 50, 28, 28, 14, "can", "cyl"), b(32, 32, 64, 36, 36, 6, "lid", "cyl")],
     {"can": slot("metal", 0), "lid": slot("metal", 2)}, "free", name="Бідон")
# what the factory's shop sells (for the house)
item("cheese_board", "dairy", 1, 1, "surface", [b(10, 20, 0, 80, 60, 6, "board", "round"), b(20, 26, 6, 40, 40, 24, "cheese", "cyl"), b(56, 34, 6, 24, 20, 14, "cheese2"), b(26, 30, 30, 10, 10, 2, "hole", "cyl")],
     {"board": slot("wood", 3), "cheese": slot("autumn", 3), "cheese2": slot("ceramic", 1), "hole": slot("wood", 3)}, coins(35), name="Дошка з сирами")
item("yarn_basket", "dairy", 1, 1, "floor", [b(16, 16, 0, 68, 68, 34, "basket", "cyl")] + [b(20 + (k % 2) * 30, 20 + (k // 2) * 30, 30, 28, 28, 28, ("y1", "y2", "y3", "y1")[k], "ball") for k in range(4)],
     {"basket": slot("wood", 3), "y1": slot("fabric", 1), "y2": slot("fabric", 4), "y3": slot("autumn", 3)}, coins(40), name="Кошик з пряжею")
item("wool_blanket", "dairy", 2, 2, "rug", [b(6, 6, 0, 188, 188, 4, "wool", "round")] + [b(6, 20 + k * 40, 4, 188, 10, 1, "stripe") for k in range(4)],
     {"wool": slot("ceramic", 1), "stripe": slot("fabric", 1)}, coins(90), name="Вовняний килим")
item("sheepskin", "dairy", 1, 1, "rug", [b(10, 14, 0, 80, 72, 6, "wool", "round"), b(18, 20, 6, 64, 60, 4, "wool", "ball")], {"wool": slot("ceramic", 0)}, coins(55), name="Овеча шкура")
item("milk_jug", "dairy", 1, 1, "surface", [b(34, 34, 0, 32, 32, 40, "jug", "cyl"), b(38, 38, 40, 24, 24, 12, "jug", "cyl"), b(62, 44, 18, 10, 6, 18, "jug")],
     {"jug": slot("ceramic", 0)}, coins(20), name="Глечик молока")
item("candle_stand", "village", 1, 1, "floor",
     [b(40, 40, 0, 20, 20, 8, "brass", "cyl"), b(46, 46, 8, 8, 8, 70, "brass", "cyl"), b(20, 20, 78, 60, 60, 6, "brass", "cyl")]
     + [b(26 + (k % 3) * 18, 28 + (k // 3) * 22, 84, 4, 4, 14, "wax") for k in range(6)] + [b(26 + (k % 3) * 18, 28 + (k // 3) * 22, 98, 4, 4, 5, "flame") for k in range(6)],
     {"brass": slot("autumn", 3), "wax": slot("ceramic", 0), "flame": slot("autumn", 1)}, "free", name="Свічник")
items[-1]["tags"] = ["light"]

# ---- the newsroom of «Липовий вісник»: a brick house with a big sign, a printing press inside
civic("newsroom", "Редакція «Липовий вісник»", 5, 3, 120, [("pot", 1), ("ceramic", 5), ("ceramic", 0), ("wood", 2), {"sign": slot("ceramic", 0), "ink": slot("ceramic", 5), "paper": slot("ceramic", 0)}],
      [b(130, 286, 132, 240, 6, 28, "sign", "round"), b(150, 284, 140, 200, 4, 4, "ink"), b(150, 284, 150, 140, 4, 3, "ink"), b(30, 296, 0, 40, 30, 50, "paper", "round"), b(420, 296, 0, 50, 30, 30, "paper")],
      roof_h=60, chimney=True)
item("news_desk", "village", 2, 1, "floor",
     legs4(200, 100, 70, 10, 8, "wood") + [b(0, 0, 70, 200, 100, 6, "top", "round"), b(20, 30, 76, 60, 44, 20, "machine", "round"), b(26, 34, 96, 48, 8, 14, "paper"), b(30, 66, 80, 40, 10, 4, "keys"),
      b(110, 20, 76, 70, 50, 8, "paper"), b(120, 30, 84, 50, 30, 6, "paper2"), b(170, 70, 76, 14, 14, 24, "cup", "cyl")],
     {"wood": slot("wood", 2), "top": slot("wood", 3), "machine": slot("ceramic", 5), "paper": slot("ceramic", 0), "paper2": slot("pastel", 3), "keys": slot("ceramic", 1), "cup": slot("fabric", 1)},
     "free", name="Стіл журналіста")
item("printing_press", "village", 2, 2, "floor",
     [b(10, 10, 0, 180, 180, 30, "frame"), b(30, 30, 30, 140, 140, 60, "body", "round"), b(20, 60, 90, 160, 80, 40, "roller", "cyl"), b(40, 40, 130, 120, 120, 10, "frame"), b(70, 160, 30, 60, 40, 50, "paper"),
      b(90, 90, 140, 20, 20, 60, "frame", "cyl"), b(60, 96, 196, 80, 8, 8, "frame")],
     {"frame": slot("metal", 2), "body": slot("metal", 0), "roller": slot("ceramic", 5), "paper": slot("ceramic", 0)}, "free", name="Друкарський верстат")
item("newspaper_stack", "village", 1, 1, "floor", [b(14 + (k % 2) * 40, 14 + (k // 2) * 36, 0, 36, 32, 30 + k * 6, "paper") for k in range(4)] + [b(14, 14, 30, 36, 32, 2, "ink")],
     {"paper": slot("ceramic", 0), "ink": slot("ceramic", 5)}, "free", name="Стоси газет")
item("photo_board", "village", 2, 1, "wall",
     [b(10, 0, 70, 180, 4, 100, "cork")] + [b(20 + (k % 4) * 42, 4, 80 + (k // 4) * 46, 30, 2, 36, ("p1", "p2", "p3")[k % 3]) for k in range(8)] + [b(30, 5, 120, 140, 1, 2, "string")],
     {"cork": slot("wood", 3), "p1": slot("ceramic", 0), "p2": slot("pastel", 1), "p3": slot("pastel", 3), "string": slot("fabric", 1)}, "free", name="Дошка з фото")
item("camera_tripod", "village", 1, 1, "floor", [b(30, 30, 0, 4, 4, 110, "leg"), b(66, 30, 0, 4, 4, 110, "leg"), b(48, 66, 0, 4, 4, 110, "leg"), b(34, 34, 110, 32, 32, 6, "leg"), b(30, 36, 116, 40, 28, 26, "body", "round"),
     b(66, 42, 120, 16, 16, 16, "lens", "cyl")], {"leg": slot("metal", 2), "body": slot("ceramic", 5), "lens": slot("glass", 1)}, "free", name="Фотоапарат")

# ---- the town hall in the middle of the square: columns and a pediment, a clock tower, the flag
hall = [b(0, 0, 0, 700, 400, 12, "stone"), b(10, 10, 12, 680, 360, 200, "wall"), b(0, 0, 212, 700, 380, 16, "trim"), b(10, 10, 228, 680, 360, 70, "roof", "gable"),
        b(250, 340, 12, 200, 70, 230, "trim"), b(240, 400, 228, 220, 14, 60, "trim", "gable")]
hall += [b(262 + k * 48, 396, 12, 16, 16, 210, "column", "cyl") for k in range(4)]
hall += [b(310, 376, 12, 80, 6, 130, "door", "round"), b(316, 382, 150, 68, 4, 40, "glass", "round")]
for x in list(range(40, 230, 70)) + list(range(480, 660, 70)):
    for z in (50, 130):
        hall += [b(x, 368, z, 40, 4, 56, "glass"), b(x - 4, 366, z - 6, 48, 6, 6, "trim"), b(x, 8, z, 40, 4, 56, "glass")]
for y in (60, 160, 260):
    for z in (50, 130):
        hall += [b(8, y, z, 4, 40, 56, "glass"), b(688, y, z, 4, 40, 56, "glass")]
# the clock tower over the middle, its dial on every side, a little spire, the flag
hall += [b(290, 140, 228, 120, 120, 150, "wall"), b(282, 132, 378, 136, 136, 14, "trim"), b(296, 146, 392, 108, 108, 80, "roof", "cone")]
hall += [b(320, 258, 300, 60, 4, 60, "clock", "cyl"), b(320, 138, 300, 60, 4, 60, "clock", "cyl"), b(288, 170, 300, 4, 60, 60, "clock", "cyl"), b(408, 170, 300, 4, 60, 60, "clock", "cyl")]
hall += [b(348, 260, 326, 4, 2, 26, "hand"), b(348, 260, 326, 22, 2, 4, "hand")]
hall += [b(346, 196, 472, 8, 8, 120, "hand", "cyl"), b(354, 196, 560, 60, 4, 16, "flag"), b(354, 196, 544, 60, 4, 16, "flag2"), b(330, 330, 250, 40, 6, 40, "arms", "round")]
item("town_hall", "village", 7, 4, "floor", hall,
     {"stone": slot("stone", 0), "wall": slot("ceramic", 1), "trim": slot("ceramic", 0), "roof": slot("leaf", 0), "column": slot("ceramic", 0), "door": slot("wood", 0),
      "glass": slot("glass", 1), "clock": slot("ceramic", 0), "hand": slot("ceramic", 5), "flag": slot("fabric", 6), "flag2": slot("autumn", 3), "arms": slot("autumn", 3)},
     "free", name="Ратуша")
items[-1]["tags"] = []
item("council_table", "village", 3, 2, "floor", legs4(300, 200, 66, 14, 16, "wood") + [b(0, 0, 66, 300, 200, 8, "top", "round"), b(40, 60, 74, 220, 80, 2, "cloth"), b(140, 90, 74, 20, 20, 16, "bell", "cyl")],
     {"wood": slot("wood", 0), "top": slot("wood", 2), "cloth": slot("leaf", 0), "bell": slot("autumn", 3)}, "free", name="Стіл ради")
item("flag_stand", "village", 1, 1, "floor", [b(40, 40, 0, 20, 20, 8, "base", "cyl"), b(47, 47, 8, 6, 6, 170, "pole", "cyl"), b(52, 48, 120, 40, 4, 25, "flag"), b(52, 48, 95, 40, 4, 25, "flag2"), b(44, 44, 176, 12, 12, 10, "pole", "ball")],
     {"base": slot("metal", 1), "pole": slot("metal", 1), "flag": slot("fabric", 6), "flag2": slot("autumn", 3)}, "free", name="Прапор")

# ---- the radio station «Радіо Липове»: a small studio house and its lattice mast with red lights
civic("radio_station", "Радіо «Липове FM»", 5, 3, 110, [("ceramic", 0), ("ceramic", 5), ("glass", 1), ("metal", 2), {"sign": slot("fabric", 1), "dish": slot("ceramic", 0)}],
      [b(170, 286, 124, 160, 6, 26, "sign", "round"), b(380, 120, 190, 70, 20, 70, "dish", "cyl"), b(410, 120, 170, 10, 10, 20, "dish")], roof_h=50)
mast = []
for z in range(0, 1000, 100):
    k = 1 - z / 1300
    o = int(30 * (1 - k))
    mast += [b(20 + o, 20 + o, z, 8, 8, 100, "steel"), b(172 - o, 20 + o, z, 8, 8, 100, "steel"), b(20 + o, 172 - o, z, 8, 8, 100, "steel"), b(172 - o, 172 - o, z, 8, 8, 100, "steel"),
             b(20 + o, 20 + o, z + 96, 160 - 2 * o, 8, 6, "steel"), b(20 + o, 172 - o, z + 96, 160 - 2 * o, 8, 6, "steel"), b(20 + o, 20 + o, z + 96, 8, 160 - 2 * o, 6, "steel"), b(172 - o, 20 + o, z + 96, 8, 160 - 2 * o, 6, "steel")]
    if z % 300 == 0 and z:
        mast.append(b(92, 92, z + 96, 16, 16, 12, "glow", "ball"))
mast += [b(94, 94, 1000, 12, 12, 140, "steel", "cyl"), b(90, 90, 1140, 20, 20, 16, "glow", "ball"), b(0, 0, 0, 200, 200, 8, "base")]
item("radio_mast", "village", 2, 2, "floor", mast, {"steel": slot("fabric", 1), "glow": slot("fabric", 1), "base": slot("stone", 0)}, "free", name="Радіощогла")
items[-1]["tags"] = ["light", "self_glow"]
# the studio inside: the mixing desk, microphones, the ON AIR lamp, shelves of records
item("mixing_desk", "village", 2, 1, "floor", legs4(200, 100, 60, 10, 8, "frame") + [b(0, 10, 60, 200, 80, 20, "body", "round"), b(10, 20, 80, 180, 60, 4, "panel")]
     + [b(20 + k * 22, 30, 84, 6, 30, 6, ("knob", "knob2")[k % 2]) for k in range(8)] + [b(70, 0, 80, 60, 12, 40, "screen")],
     {"frame": slot("metal", 2), "body": slot("ceramic", 5), "panel": slot("metal", 0), "knob": slot("fabric", 1), "knob2": slot("fabric", 4), "screen": slot("glass", 1)}, "free", name="Мікшерний пульт")
items[-1]["tags"] = ["switch"]
item("mic_stand", "village", 1, 1, "floor", [b(36, 36, 0, 28, 28, 4, "base", "cyl"), b(48, 48, 4, 4, 4, 120, "pole", "cyl"), b(46, 40, 120, 8, 20, 4, "pole"), b(44, 54, 116, 12, 16, 20, "mic", "round")],
     {"base": slot("ceramic", 5), "pole": slot("metal", 0), "mic": slot("ceramic", 5)}, "free", name="Мікрофон")
item("on_air", "village", 1, 1, "wall", [b(10, 0, 150, 80, 4, 30, "box", "round"), b(16, 4, 156, 68, 2, 18, "glow")], {"box": slot("ceramic", 5), "glow": slot("fabric", 1)}, "free", name="«В ефірі»")
items[-1]["tags"] = ["light", "self_glow"]
item("record_shelf", "village", 2, 1, "floor", [b(0, 0, 0, 200, 40, 160, "wood")] + [b(4, 4, z, 192, 36, 4, "wood") for z in (40, 90, 140)]
     + [b(8 + k * 7, 8, z + 4, 4, 30, 34, ("r1", "r2", "r3")[k % 3]) for k in range(26) for z in (40, 90)],
     {"wood": slot("wood", 1), "r1": slot("ceramic", 5), "r2": slot("fabric", 1), "r3": slot("fabric", 6)}, "free", name="Полиця з платівками")

# ---- for the house: an old wooden radio that plays «Липове FM», a gramophone, and a music box that really plays
item("radio_vintage", "decor", 1, 1, "floor",
     [b(16, 20, 0, 68, 50, 10, "wood", "round"), b(14, 18, 10, 72, 54, 70, "wood", "round"), b(20, 70, 20, 60, 3, 36, "cloth", "round"), b(22, 70, 60, 34, 3, 12, "screen", "round"),
      b(62, 70, 62, 8, 4, 8, "knob", "cyl"), b(72, 70, 62, 8, 4, 8, "knob", "cyl"), b(20, 16, 80, 60, 50, 6, "wood", "round")],
     {"wood": slot("wood", 1), "cloth": slot("earth", 3), "screen": slot("autumn", 3), "knob": slot("metal", 1)}, coins(85), ["listen"], name="Старий радіоприймач")
tag("radio_vintage", "music", "switch")
item("gramophone", "decor", 1, 1, "floor",
     [b(16, 20, 0, 68, 60, 40, "wood", "round"), b(20, 24, 40, 60, 52, 4, "disc", "cyl"), b(46, 46, 44, 8, 8, 6, "metal", "cyl"), b(66, 30, 44, 6, 6, 40, "metal"),
      b(50, 20, 80, 26, 20, 26, "horn", "cone"), b(30, 6, 96, 54, 40, 50, "horn", "ball")],
     {"wood": slot("wood", 0), "disc": slot("ceramic", 5), "metal": slot("metal", 1), "horn": slot("autumn", 3)}, coins(140), ["listen"], name="Грамофон")
tag("gramophone", "music", "switch")
for it in items:
    if it["id"] == "music_box":
        # the lid open, a little dancer turning on the cylinder
        it["model"] = [b(15, 20, 0, 70, 60, 24, "wood", "round"), b(13, 18, 24, 74, 64, 4, "trim", "round"), b(15, 18, 28, 70, 6, 46, "wood"), b(18, 22, 30, 64, 4, 40, "glass"),
                       b(30, 40, 28, 40, 30, 4, "trim", "cyl"), b(47, 52, 32, 6, 6, 14, "dancer", "cyl"), b(44, 49, 44, 12, 12, 10, "dancer2", "cone"), b(85, 46, 8, 10, 6, 6, "trim", "round")]
        it["slots"] = {"wood": slot("wood", 3), "trim": slot("metal", 1), "glass": slot("glass", 0), "dancer": slot("pastel", 3), "dancer2": slot("fabric_pink", 0)}
        it["actions"] = ["listen"]
        it["acquire"] = coins(60)
tag("music_box", "music", "switch")

# ---- the cellar under the bar and what lies behind its broken wall ------------------------------------------
# the trapdoor in the bar's floor: boards, iron straps and a ring to lift it by
item("cellar_hatch", "village", 1, 1, "rug",
     [b(8, 8, 0, 84, 84, 3, "frame"), b(14, 14, 3, 72, 72, 2, "board")] + [b(14, 14 + k * 18, 5, 72, 2, 1, "seam") for k in range(1, 4)]
     + [b(14, 24, 5, 72, 6, 2, "strap"), b(14, 70, 5, 72, 6, 2, "strap"), b(44, 44, 5, 12, 12, 2, "ring", "cyl")],
     {"frame": slot("wood", 2), "board": slot("wood", 0), "seam": slot("wood", 5), "strap": slot("metal", 2), "ring": slot("metal", 0)}, "free", name="Люк у льох")
# a ladder up through the hatch, a square of light at its top
item("cellar_ladder", "village", 1, 1, "floor",
     [b(30, 40, 0, 6, 6, 260, "rail"), b(64, 40, 0, 6, 6, 260, "rail")] + [b(30, 40, z, 40, 6, 5, "rung") for z in range(20, 260, 30)]
     + [b(20, 20, 258, 60, 60, 4, "light")],
     {"rail": slot("wood", 2), "rung": slot("wood", 1), "light": slot("metal", 1)}, "free", name="Драбина нагору")
# broken bricks where the old wall gave way
item("brick_rubble", "village", 1, 1, "floor",
     [b(10, 30, 0, 40, 26, 14, "brick"), b(46, 50, 0, 36, 22, 12, "brick2"), b(26, 44, 12, 30, 20, 12, "brick"), b(60, 20, 0, 22, 18, 8, "dust", "round")],
     {"brick": slot("pot", 0), "brick2": slot("pot", 1), "dust": slot("stone", 1)}, "free", name="Уламки цегли")
# the computer someone hid down here long ago: a beige box and a fat monitor glowing green, floppies, a mug
item("secret_pc", "village", 2, 1, "floor",
     [b(6, 20, 0, 188, 70, 70, "desk"), b(12, 26, 0, 8, 8, 70, "leg"), b(180, 26, 0, 8, 8, 70, "leg"),
      b(60, 30, 70, 70, 56, 56, "case"), b(66, 84, 78, 58, 4, 42, "glow"), b(140, 40, 70, 40, 40, 22, "box"), b(146, 74, 80, 18, 2, 3, "slot_"),
      b(64, 76, 70, 64, 12, 4, "keys"), b(20, 60, 70, 22, 20, 4, "floppy"), b(24, 62, 74, 22, 20, 4, "floppy2"), b(170, 70, 70, 12, 12, 16, "mug", "cyl")],
     {"desk": slot("wood", 2), "leg": slot("wood", 2), "case": slot("ceramic", 1), "glow": slot("fabric", 4), "box": slot("ceramic", 1),
      "slot_": slot("ceramic", 5), "keys": slot("ceramic", 5), "floppy": slot("fabric", 6), "floppy2": slot("fabric", 1), "mug": slot("pot", 0)}, "free", name="Старий комп'ютер")
items[-1]["tags"] = ["light", "self_glow"]
item("cobweb", "village", 1, 1, "floor",
     [b(10, 10, 0, 4, 4, 120, "thread"), b(10, 10, 118, 80, 4, 2, "thread"), b(10, 10, 118, 4, 80, 2, "thread"), b(10, 10, 100, 56, 56, 2, "web", "round")],
     {"thread": slot("ceramic", 0), "web": slot("glass", 2)}, "free", name="Павутина")
item("old_armchair", "village", 1, 1, "floor",
     [b(10, 16, 0, 80, 74, 34, "seat"), b(10, 76, 30, 80, 14, 54, "back"), b(4, 16, 20, 12, 70, 30, "arm"), b(84, 16, 20, 12, 70, 30, "arm"), b(30, 30, 34, 30, 24, 4, "patch")],
     {"seat": slot("fabric", 1), "back": slot("fabric", 1), "arm": slot("fabric", 1), "patch": slot("fabric", 2)}, "free", ["sit"], name="Старе крісло")
item("floppy_crate", "village", 1, 1, "floor",
     [b(16, 20, 0, 68, 60, 40, "crate")] + [b(22 + k * 10, 26, 40, 8, 48, 12, f"disk{k % 3}") for k in range(6)],
     {"crate": slot("wood", 1), "disk0": slot("fabric", 6), "disk1": slot("fabric", 1), "disk2": slot("ceramic", 5)}, "free", name="Ящик дискет")

# ---- inside the water tower: the riveted tank, a pipe with its valve, an iron ladder up to the gallery ---------
tank = [b(10, 10, 0, 280, 280, 20, "base", "cyl"), b(20, 20, 20, 260, 260, 220, "tank", "cyl"), b(14, 14, 230, 272, 272, 14, "band", "cyl")]
tank += [b(14, 14, z, 272, 272, 6, "band", "cyl") for z in (70, 150)]
tank += [b(140, 276, 110, 22, 6, 22, "gauge", "cyl"), b(148, 280, 118, 6, 2, 8, "needle")]
item("tower_tank", "village", 3, 3, "floor", tank,
     {"base": slot("stone", 2), "tank": slot("metal", 0), "band": slot("metal", 2), "gauge": slot("ceramic", 0), "needle": slot("metal", 3)}, "free", name="Бак з водою")
item("pipe_valve", "village", 1, 1, "floor",
     [b(40, 40, 0, 20, 20, 260, "pipe", "cyl"), b(36, 36, 90, 28, 28, 14, "flange", "cyl"), b(36, 36, 200, 28, 28, 14, "flange", "cyl"),
      b(30, 62, 120, 40, 6, 40, "wheel", "cyl"), b(48, 60, 136, 4, 6, 8, "wheel")],
     {"pipe": slot("metal", 0), "flange": slot("metal", 2), "wheel": slot("metal", 3)}, "free", name="Труба з вентилем")
item("iron_ladder", "village", 1, 1, "floor",
     [b(30, 50, 0, 6, 6, 300, "rail"), b(64, 50, 0, 6, 6, 300, "rail")] + [b(30, 50, z, 40, 6, 4, "rung") for z in range(16, 300, 22)]
     + [b(16, 30, 296, 68, 50, 6, "hatch")],
     {"rail": slot("metal", 2), "rung": slot("metal", 0), "hatch": slot("metal", 1)}, "free", name="Драбина на оглядовий майданчик")
