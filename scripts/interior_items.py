# The furniture of bigger shop and office interiors: glass partitions and half walls that make a back room or
# a staff corner, stock in boxes, baskets by the door, a fruit stand, a chest freezer, a coffee bar and a pastry
# case, a safe, jars on a shelf, a rack of papers, track lights, a mop and bucket, a water cooler. Village
# furniture (never sold). Each has its front at +y like everything else: price cards and doors to the customer,
# the plain or working side to the back. Run inside gen_base_content.py before the maps.

# a partition: a low panel with a glass pane above it, posts at both ends so segments join up into a wall
item("partition_glass", "village", 1, 1, "floor",
     [b(0, 42, 0, 100, 16, 6, "base"), b(0, 44, 6, 100, 12, 84, "panel"), b(0, 42, 90, 100, 16, 6, "rail"), b(0, 42, 190, 100, 16, 8, "rail"),
      b(0, 42, 6, 4, 16, 184, "rail"), b(96, 42, 6, 4, 16, 184, "rail"), b(4, 47, 96, 92, 6, 94, "pane")],
     {"base": slot("wood", 5), "panel": slot("ceramic", 1), "rail": slot("wood", 2), "pane": slot("glass", 0)}, "free", name="Скляна перегородка")
item("partition_low", "village", 1, 1, "floor",
     [b(0, 40, 0, 100, 20, 8, "base"), b(0, 41, 8, 100, 18, 96, "plaster"), b(0, 36, 104, 100, 28, 6, "cap", "round")],
     {"base": slot("wood", 5), "plaster": slot("ceramic", 1), "cap": slot("wood", 1)}, "free", name="Низька перегородка")

# stock in the back room: cardboard boxes stacked, taped, labelled on the side that faces out
item("stock_boxes", "village", 1, 1, "floor",
     [b(6, 8, 0, 46, 44, 34, "box"), b(54, 6, 0, 40, 48, 30, "box2"), b(8, 56, 0, 42, 38, 28, "box2"), b(56, 58, 0, 36, 34, 24, "box"),
      b(10, 12, 34, 38, 36, 28, "box2"), b(56, 10, 30, 34, 40, 26, "box"), b(16, 18, 62, 28, 26, 20, "box"),
      b(27, 8, 34, 4, 44, 1, "tape"), b(72, 6, 30, 4, 48, 1, "tape"), b(27, 12, 62, 4, 36, 1, "tape"),
      b(16, 93, 8, 16, 1, 10, "label"), b(64, 91, 6, 14, 1, 8, "label"), b(22, 71, 40, 12, 1, 8, "label")],
     {"box": slot("wood", 3), "box2": slot("earth", 3), "tape": slot("ceramic", 1), "label": slot("ceramic", 0)}, "free", name="Коробки з товаром")
item("basket_stack", "village", 1, 1, "floor",
     [b(20, 24, z, 60, 44, 8, "basket") for z in (0, 7, 14, 21, 28)] + [b(22, 44, 36, 4, 4, 18, "handle"), b(74, 44, 36, 4, 4, 18, "handle"), b(22, 44, 52, 56, 4, 4, "handle"),
      b(40, 68, 10, 20, 1, 8, "label")],
     {"basket": slot("fabric", 1), "handle": slot("metal", 2), "label": slot("ceramic", 0)}, "free", name="Кошики для покупок")

# a stand of fruit and vegetables: the back tier higher than the front, a price card on every crate
_produce = []
for tier, (y, z) in enumerate(((4, 62), (52, 32))):
    for k in range(4):
        x = 2 + k * 49
        _produce.append(b(x, y, z, 47, 44, 10, "crate"))
        _produce += [b(x + 4 + (j % 3) * 14, y + 6 + (j // 3) * 18, z + 8, 14, 14, 12, ("p1", "p2", "p3", "p4")[(k + tier * 2) % 4], "ball") for j in range(6)]
        _produce.append(b(x + 16, 96 if tier else 47, z, 16, 2, 10, "price"))
item("produce_stand", "village", 2, 1, "floor",
     [b(0, 0, 0, 200, 50, 62, "wood"), b(0, 50, 0, 200, 48, 32, "wood"), b(6, 0, 8, 188, 1, 46, "back")] + _produce,
     {"wood": slot("wood", 1), "back": slot("earth", 3), "crate": slot("wood", 3), "p1": slot("fabric", 1), "p2": slot("fabric", 2), "p3": slot("leaf", 1),
      "p4": slot("autumn", 3), "price": slot("ceramic", 0)}, "free", name="Прилавок з овочами й фруктами")

# a chest freezer: ice cream in boxes under a glass lid; a stripe and a vent at the front, the cable at the back
item("freezer_chest", "village", 2, 1, "floor",
     [b(0, 10, 0, 200, 84, 44, "body", "round"), b(0, 86, 44, 200, 8, 26, "body"), b(0, 10, 44, 200, 8, 26, "body"), b(0, 18, 44, 8, 68, 26, "body"), b(192, 18, 44, 8, 68, 26, "body")]
     + [b(12 + k * 30, 22 + (k % 2) * 30, 44, 26, 28, 16, ("c1", "c2", "c3")[k % 3]) for k in range(6)]
     + [b(10, 93, 34, 180, 1, 6, "stripe"), b(20, 93, 4, 60, 1, 10, "vent"), b(8, 18, 68, 184, 68, 2, "pane"),
        b(160, 10, 2, 3, 1, 30, "cable"), b(160, 4, 0, 3, 8, 2, "cable")],
     {"body": slot("ceramic", 0), "c1": slot("fabric_pink", 0), "c2": slot("pastel", 3), "c3": slot("fabric", 6), "stripe": slot("fabric", 6),
      "vent": slot("metal", 2), "pane": slot("glass", 0), "cable": slot("metal", 2)}, "free", name="Морозильна скриня")

# the coffee bar: the barista works from the back (y=0) side, the guests see the panelled front and the cups
item("coffee_bar", "village", 2, 1, "floor",
     [b(0, 30, 0, 200, 68, 92, "body"), b(0, 24, 92, 200, 76, 6, "top", "round"), b(8, 98, 8, 184, 2, 80, "front"),
      b(20, 30, 98, 70, 36, 44, "machine", "round"), b(28, 64, 112, 10, 8, 10, "steel"), b(68, 64, 112, 10, 8, 10, "steel"), b(24, 64, 98, 62, 14, 4, "steel"),
      b(46, 66, 140, 18, 1, 4, "glow"), b(116, 36, 98, 24, 24, 42, "machine2", "round"), b(118, 38, 140, 20, 20, 12, "beans", "cyl")]
     + [b(150 + (k % 2) * 16, 40 + (k // 2) * 16, 98, 12, 12, 10, "cup", "cyl") for k in range(4)]
     + [b(10, 26, 50, 180, 4, 4, "shelfw")] + [b(16 + k * 22, 25, 54, 14, 5, 14, "cup", "cyl") for k in range(8)]
     + [b(30, 26, 8, 60, 4, 40, "shelfw"), b(110, 27, 10, 70, 3, 30, "beans")],
     {"body": slot("wood", 2), "top": slot("wood", 3), "front": slot("wood", 0), "machine": slot("metal", 0), "steel": slot("metal", 2), "glow": slot("leaf", 1),
      "machine2": slot("metal", 2), "beans": slot("earth", 2), "cup": slot("ceramic", 0), "shelfw": slot("wood", 5)}, "free", name="Кавова стійка")
items[-1]["tags"] = ["switch"]

# a pastry case: cakes on two levels behind the glass; price cards at the front, the sliding doors at the back
item("pastry_case", "village", 2, 1, "floor",
     [b(0, 20, 0, 200, 80, 70, "base"), b(6, 98, 8, 188, 2, 56, "front"), b(4, 24, 94, 192, 72, 3, "shelfw"), b(0, 20, 118, 200, 80, 4, "top")]
     + [b(10 + k * 46, 40, 70, 34, 34, 16, ("k1", "k2", "k3", "k4")[k], "cyl") for k in range(4)]
     + [b(14 + k * 46, 44, 97, 26, 26, 12, ("k3", "k4", "k1", "k2")[k], "cyl") for k in range(4)]
     + [b(18 + k * 46, 96, 72, 16, 2, 6, "price") for k in range(4)]
     + [b(4, 20, 70, 92, 2, 48, "door2"), b(104, 20, 70, 92, 2, 48, "door2"), b(4, 24, 70, 192, 74, 48, "pane")],
     {"base": slot("ceramic", 0), "front": slot("pastel", 0), "shelfw": slot("glass", 2), "top": slot("ceramic", 0), "k1": slot("fabric_pink", 0), "k2": slot("wood", 3),
      "k3": slot("pastel", 3), "k4": slot("earth", 0), "price": slot("ceramic", 0), "door2": slot("metal", 0), "pane": slot("glass", 0)}, "free", name="Вітрина з тістечками")

item("menu_board", "village", 2, 1, "wall",
     [b(10, 0, 110, 180, 4, 70, "frame"), b(14, 4, 114, 172, 1, 62, "board")] + [b(24, 5, 164 - k * 10, 70 + (k * 23) % 60, 1, 3, "chalk") for k in range(5)]
     + [b(150, 5, 164 - k * 10, 20, 1, 3, "chalk2") for k in range(5)],
     {"frame": slot("wood", 2), "board": slot("ceramic", 5), "chalk": slot("ceramic", 0), "chalk2": slot("autumn", 3)}, "free", name="Дошка-меню")
item("safe", "village", 1, 1, "floor",
     [b(14, 20, 0, 72, 62, 74, "body"), b(18, 82, 6, 64, 4, 62, "door"), b(44, 86, 44, 12, 2, 12, "dial", "cyl"), b(28, 86, 30, 4, 3, 16, "dial"),
      b(18, 76, 8, 2, 6, 10, "dial"), b(18, 76, 56, 2, 6, 10, "dial")],
     {"body": slot("stone", 2), "door": slot("stone", 3), "dial": slot("metal", 1)}, "free", name="Сейф")
item("wall_shelf_jars", "village", 2, 1, "wall",
     [b(6, 0, 110, 188, 26, 4, "board"), b(6, 0, 150, 188, 26, 4, "board"), b(10, 0, 96, 8, 20, 14, "board"), b(182, 0, 96, 8, 20, 14, "board")]
     + [b(14 + k * 22, 6, 114, 16, 16, 20, ("j1", "j2", "j3")[k % 3], "cyl") for k in range(8)]
     + [b(14 + k * 22, 6, 154, 16, 16, 16, ("j2", "j3", "j1")[k % 3], "cyl") for k in range(8)],
     {"board": slot("wood", 1), "j1": slot("autumn", 0), "j2": slot("leaf", 1), "j3": slot("autumn", 3)}, "free", name="Полиця з банками")
item("newspaper_rack", "village", 1, 1, "floor",
     [b(20, 20, 0, 6, 6, 110, "metal"), b(74, 20, 0, 6, 6, 110, "metal"), b(20, 20, 104, 60, 6, 6, "metal"), b(26, 22, 14, 48, 56, 4, "metal"),
      b(26, 26, 40, 48, 34, 3, "metal"), b(26, 30, 70, 48, 30, 3, "metal")]
     + [b(28, 30 + k * 2, 18 + k * 30, 44, 34 - k * 4, 18, ("paper", "paper2", "paper")[k]) for k in range(3)],
     {"metal": slot("metal", 2), "paper": slot("ceramic", 0), "paper2": slot("pastel", 3)}, "free", name="Стійка з газетами")
item("track_lights", "village", 2, 1, "wall",
     [b(10, 0, 186, 180, 8, 4, "rail")] + [b(28 + k * 60, 4, 168, 16, 16, 18, "spot", "cone") for k in range(3)] + [b(32 + k * 60, 8, 164, 8, 8, 4, "bulb") for k in range(3)],
     {"rail": slot("metal", 2), "spot": slot("metal", 2), "bulb": slot("pastel", 3)}, "free", name="Світильники на шині")
items[-1]["tags"] = ["light"]
item("mop_bucket", "village", 1, 1, "floor",
     [b(30, 36, 0, 34, 30, 26, "bucket", "cyl"), b(26, 44, 24, 42, 4, 4, "bucket"), b(46, 50, 10, 4, 4, 110, "handle", "cyl"), b(38, 42, 26, 22, 22, 8, "mop", "ball")],
     {"bucket": slot("fabric", 3), "handle": slot("wood", 3), "mop": slot("ceramic", 1)}, "free", name="Відро зі шваброю")
item("water_cooler", "village", 1, 1, "floor",
     [b(30, 30, 0, 40, 40, 90, "body", "round"), b(34, 34, 90, 32, 32, 44, "bottle", "cyl"), b(44, 68, 50, 6, 4, 8, "tap"), b(54, 68, 50, 6, 4, 8, "tap2"),
      b(38, 66, 30, 24, 6, 4, "body"), b(40, 30, 70, 20, 1, 12, "vent")],
     {"body": slot("ceramic", 0), "bottle": slot("glass", 1), "tap": slot("fabric", 6), "tap2": slot("fabric", 1), "vent": slot("metal", 2)}, "free", name="Кулер з водою")
