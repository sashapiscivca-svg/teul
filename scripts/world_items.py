# Things of the wider world: the farm, the racecourse, the taxi, the deep forest and the cave.
# Run inside gen_base_content.py after public_items.py (uses item, b, slot, styles via style()).


def beast(id, name, model, slots):
    item(id, "animal", 1, 1, "floor", model, slots, "free", name=name)
    items[-1]["hidden"] = True


HORSE = [b(14, 36, 40, 66, 28, 30, "coat", "round"), b(72, 38, 56, 16, 22, 32, "coat", "round"), b(80, 40, 80, 22, 18, 16, "coat", "round"),
         b(96, 44, 82, 8, 10, 10, "nose", "round"), b(74, 42, 70, 6, 14, 26, "mane"), b(6, 44, 46, 10, 10, 26, "mane", "round")]
HORSE += [b(x, y, 0, 7, 7, 42, "leg") for x in (18, 70) for y in (38, 56)] + [b(x, y, 0, 8, 8, 6, "hoof") for x in (18, 70) for y in (38, 56)]
beast("horse", "Кінь", HORSE, {"coat": slot("wood", 1), "mane": slot("earth", 2), "nose": slot("earth", 2), "leg": slot("wood", 1), "hoof": slot("ceramic", 5)})
# racehorses with their jockeys, each in silks of their own colours
RIDER = HORSE + [b(40, 38, 70, 14, 24, 8, "saddle"), b(42, 42, 76, 16, 16, 26, "silk", "round"), b(50, 44, 100, 12, 12, 12, "skin", "ball"),
                 b(48, 43, 108, 14, 14, 6, "cap", "round"), b(58, 40, 86, 18, 4, 4, "silk"), b(58, 56, 86, 18, 4, 4, "silk")]
for i, (coat, silk, cap) in enumerate([(("wood", 0), ("fabric", 1), ("ceramic", 0)), (("wood", 1), ("fabric", 4), ("fabric", 2)), (("ceramic", 5), ("fabric", 2), ("fabric", 1)),
                                       (("wood", 3), ("fabric", 5), ("ceramic", 0)), (("earth", 2), ("fabric", 6), ("fabric", 2)), (("ceramic", 1), ("fabric", 3), ("fabric", 4))]):
    beast(f"horse_rider_{i}", "Кінь з вершником", RIDER, {"coat": slot(*coat), "mane": slot("ceramic", 5), "nose": slot("ceramic", 5), "leg": slot(*coat), "hoof": slot("ceramic", 5),
          "saddle": slot("ceramic", 0), "silk": slot(*silk), "skin": slot("pastel", 3), "cap": slot(*cap)})
beast("pig", "Свиня", [b(22, 34, 10, 56, 32, 28, "body", "round"), b(74, 40, 16, 16, 20, 20, "body", "round"), b(88, 44, 20, 6, 12, 10, "snout"), b(76, 38, 34, 6, 4, 8, "body"), b(76, 58, 34, 6, 4, 8, "body"),
      b(16, 46, 26, 8, 6, 6, "tail", "ball")] + [b(x, y, 0, 6, 6, 12, "body") for x in (26, 66) for y in (38, 56)], {"body": slot("fabric_pink", 0), "snout": slot("fabric_pink", 2), "tail": slot("fabric_pink", 2)})
beast("goose", "Гуска", [b(26, 36, 6, 46, 28, 24, "body", "ball"), b(64, 44, 22, 8, 8, 30, "body", "cyl"), b(62, 42, 48, 14, 12, 12, "body", "ball"), b(74, 46, 50, 12, 4, 4, "beak"),
      b(42, 46, 0, 4, 4, 8, "beak"), b(52, 46, 0, 4, 4, 8, "beak")], {"body": slot("ceramic", 0), "beak": slot("autumn", 1)})
beast("boar", "Кабан", [b(18, 34, 14, 60, 34, 34, "body", "round"), b(72, 38, 18, 20, 26, 24, "body", "round"), b(90, 44, 20, 8, 12, 10, "snout"), b(88, 40, 26, 6, 3, 8, "tusk"), b(88, 58, 26, 6, 3, 8, "tusk"),
      b(30, 40, 46, 40, 20, 6, "bristle")] + [b(x, y, 0, 7, 7, 16, "body") for x in (22, 66) for y in (38, 56)], {"body": slot("earth", 0), "snout": slot("earth", 2), "tusk": slot("ceramic", 0), "bristle": slot("earth", 2)})
beast("hedgehog", "Їжак", [b(30, 36, 0, 36, 28, 22, "spines", "ball"), b(62, 42, 4, 14, 16, 12, "face", "ball"), b(76, 48, 8, 4, 4, 4, "nose", "ball")], {"spines": slot("earth", 1), "face": slot("wood", 3), "nose": slot("ceramic", 5)})
beast("bat", "Кажан", [b(42, 44, 60, 16, 12, 16, "body", "ball"), b(20, 40, 66, 24, 20, 4, "wing", "round"), b(56, 40, 66, 24, 20, 4, "wing", "round"), b(46, 46, 76, 4, 4, 6, "body")],
      {"body": slot("earth", 2), "wing": slot("ceramic", 5)})

# the taxi: a yellow car with a chequered roof sign, and the sign of its stand
vehicle("taxi", "Таксі", 2, 1, car_body("body", "top", [b(80, 38, 74, 40, 24, 12, "sign", "round"), b(84, 37, 78, 8, 26, 4, "check"), b(100, 37, 78, 8, 26, 4, "check"), b(14, 11, 30, 172, 2, 6, "check"), b(14, 87, 30, 172, 2, 6, "check")]),
        {**CAR_SLOTS, "body": slot("autumn", 3), "top": slot("autumn", 3), "sign": slot("ceramic", 0), "check": slot("ceramic", 5)})
item("taxi_sign", "village", 1, 1, "floor",
     [b(44, 44, 0, 10, 10, 170, "pole", "cyl"), b(20, 46, 140, 60, 6, 40, "board", "round"), b(26, 45, 146, 12, 2, 12, "check"), b(50, 45, 146, 12, 2, 12, "check"), b(38, 45, 158, 12, 2, 12, "check"),
      b(26, 52, 146, 12, 2, 12, "check"), b(50, 52, 158, 12, 2, 12, "check"), b(36, 36, 0, 28, 28, 6, "pole", "cyl")],
     {"pole": slot("metal", 2), "board": slot("autumn", 3), "check": slot("ceramic", 5)}, "free", name="Стоянка таксі")

# ---- the farm
# the tractor: like every vehicle, its front (the bonnet, the small wheels, the grille and lamps) is +x
_tractor = [b(20, 18, 30, 110, 64, 40, "body", "round"), b(100, 22, 70, 70, 56, 70, "cab", "round"), b(104, 20, 90, 62, 60, 40, "glass"), b(100, 18, 140, 74, 64, 6, "body"),
            b(40, 50, 70, 8, 8, 40, "pipe", "cyl"), b(110, 2, 0, 70, 16, 70, "wheel", "cyl"), b(110, 82, 0, 70, 16, 70, "wheel", "cyl"), b(14, 8, 0, 40, 12, 40, "wheel", "cyl"), b(14, 80, 0, 40, 12, 40, "wheel", "cyl"),
            b(4, 30, 30, 10, 40, 20, "grille"), b(2, 20, 46, 6, 10, 8, "light"), b(2, 70, 46, 6, 10, 8, "light")]
for _m in _tractor:
    _x, _y, _z, _w, _d, _h = _m["box"]
    _m["box"] = [200 - (_x + _w), _y, _z, _w, _d, _h]
vehicle("tractor", "Трактор", 2, 1, _tractor,
        {"body": slot("fabric", 1), "cab": slot("fabric", 1), "glass": slot("glass", 1), "pipe": slot("ceramic", 5), "wheel": slot("ceramic", 5), "grille": slot("fabric", 1), "light": slot("pastel", 3)})
items[-1]["hidden"] = True
item("silo", "village", 2, 2, "floor",
     [b(20, 20, 0, 160, 160, 340, "wall", "cyl"), b(24, 24, 340, 152, 152, 50, "roof", "ball")] + [b(18, 18, 40 + k * 70, 164, 164, 6, "band", "cyl") for k in range(5)]
     + [b(150, 96, 0, 6, 6, 330, "ladder"), b(166, 96, 0, 6, 6, 330, "ladder")] + [b(150, 96, 10 + k * 30, 22, 6, 3, "ladder") for k in range(11)],
     {"wall": slot("metal", 0), "roof": slot("fabric", 1), "band": slot("metal", 2), "ladder": slot("metal", 2)}, "free", name="Силосна вежа")
civic("cowshed", "Корівник", 6, 3, 90, [("ceramic", 1), ("fabric", 1), ("ceramic", 0), ("wood", 2), {"vent": slot("metal", 0)}],
      [b(100 + k * 140, 60, 165, 40, 40, 30, "vent") for k in range(3)], roof_h=60)
item("chicken_coop", "village", 2, 2, "floor",
     [b(20, 20, 30, 160, 120, 90, "wall"), b(10, 10, 120, 180, 140, 50, "roof", "gable")] + [b(x, y, 0, 10, 10, 30, "wall") for x in (24, 166) for y in (24, 126)]
     + [b(80, 140, 30, 40, 4, 50, "door"), b(70, 144, 0, 20, 50, 30, "ramp"), b(30, 140, 70, 30, 4, 24, "glass")],
     {"wall": slot("wood", 1), "roof": slot("earth", 2), "door": slot("wood", 0), "ramp": slot("wood", 4), "glass": slot("glass", 1)}, "free", name="Курник")
item("hay_bale", "village", 1, 1, "floor", [b(10, 20, 0, 80, 60, 60, "hay", "cyl"), b(10, 20, 26, 80, 60, 4, "band"), b(10, 20, 48, 80, 60, 3, "band")],
     {"hay": slot("autumn", 3), "band": slot("wood", 1)}, "free", name="Тюк сіна")
item("haystack", "village", 2, 2, "floor", [b(20, 20, 0, 160, 160, 90, "hay", "ball"), b(40, 40, 70, 120, 120, 70, "hay", "ball"), b(96, 96, 130, 8, 8, 40, "pole")],
     {"hay": slot("autumn", 3), "pole": slot("wood", 2)}, "free", name="Скирта")
item("trough", "village", 2, 1, "floor", [b(10, 26, 0, 180, 50, 30, "wood"), b(16, 32, 26, 168, 38, 4, "water")], {"wood": slot("wood", 2), "water": slot("glass", 1)}, "free", name="Корито")
item("farm_fence", "village", 1, 1, "floor",
     [b(0, 44, 0, 10, 10, 70, "post"), b(90, 44, 0, 10, 10, 70, "post"), b(0, 46, 22, 100, 6, 10, "rail"), b(0, 46, 50, 100, 6, 10, "rail")],
     {"post": slot("wood", 2), "rail": slot("wood", 1)}, "free", name="Огорожа")

# ---- the racecourse
item("rail_fence", "village", 1, 1, "floor", [b(44, 44, 0, 10, 10, 64, "post"), b(0, 46, 52, 100, 8, 10, "rail", "round")], {"post": slot("ceramic", 0), "rail": slot("ceramic", 0)}, "free", name="Огорожа доріжки")
stand = [b(0, 0, 0, 600, 300, 10, "base")]
for k in range(5):
    stand += [b(0, 40 + k * 50, 10, 600, 50, 30 + k * 30, "step")] + [b(20 + i * 60, 46 + k * 50, 40 + k * 30, 40, 30, 10, ("seat", "seat2")[(i + k) % 2], "round") for i in range(10)]
# the front (low seats) faces -y, the track; the back wall and the roof over everyone
stand += [b(x, 10, 10, 10, 10, 250, "post", "cyl") for x in (10, 200, 390, 580)] + [b(0, 280, 10, 600, 20, 250, "wall")] + [b(0, 0, 260, 600, 300, 14, "roof")]
stand += [b(40 + i * 110, 290, 274, 70, 10, 30, ("flag", "flag2")[i % 2]) for i in range(5)]
item("grandstand", "village", 6, 3, "floor", stand,
     {"base": slot("ceramic", 1), "step": slot("ceramic", 0), "seat": slot("fabric", 6), "seat2": slot("fabric", 1), "post": slot("metal", 2), "wall": slot("wood", 1),
      "roof": slot("glass", 1), "flag": slot("fabric", 2), "flag2": slot("fabric", 4)}, "free", name="Трибуна")
item("judges_tower", "village", 1, 1, "floor",
     [b(20, 20, 0, 8, 8, 200, "leg"), b(72, 20, 0, 8, 8, 200, "leg"), b(20, 72, 0, 8, 8, 200, "leg"), b(72, 72, 0, 8, 8, 200, "leg"), b(10, 10, 200, 80, 80, 60, "cab"),
      b(14, 88, 220, 72, 4, 30, "glass"), b(4, 4, 260, 92, 92, 10, "roof"), b(44, 44, 270, 6, 6, 50, "leg"), b(50, 44, 300, 30, 2, 18, "flag")],
     {"leg": slot("ceramic", 0), "cab": slot("ceramic", 0), "glass": slot("glass", 1), "roof": slot("fabric", 6), "flag": slot("fabric", 1)}, "free", name="Суддівська вежа")
item("finish_post", "village", 1, 1, "floor", [b(44, 44, 0, 12, 12, 180, "post", "cyl"), b(36, 36, 170, 28, 28, 28, "ball", "ball")] + [b(46, 46, 20 + k * 30, 14, 14, 15, "band", "cyl") for k in range(5)],
     {"post": slot("ceramic", 0), "ball": slot("fabric", 1), "band": slot("fabric", 1)}, "free", name="Фінішний стовп")
civic("stable", "Стайня", 6, 3, 100, [("wood", 1), ("earth", 2), ("ceramic", 0), ("wood", 0), {"half": slot("wood", 2)}],
      [b(40 + k * 100, 286, 8, 60, 4, 50, "half") for k in range(5)], roof_h=60)
item("ticket_booth", "village", 1, 1, "floor",
     [b(10, 10, 0, 80, 80, 130, "wall"), b(16, 88, 60, 68, 2, 40, "glass"), b(4, 4, 130, 92, 92, 20, "roof", "gable"), b(14, 90, 104, 72, 4, 14, "sign")],
     {"wall": slot("ceramic", 0), "glass": slot("glass", 1), "roof": slot("fabric", 1), "sign": slot("autumn", 3)}, "free", name="Каса")

# ---- the cave: its mouth in a rocky hill, its rock, stalagmites, crystals and mushrooms that glow
item("cave_mouth", "village", 3, 2, "floor",
     [b(0, 0, 0, 300, 200, 70, "rock", "round"), b(0, 10, 60, 100, 180, 110, "rock2", "round"), b(200, 10, 60, 100, 180, 120, "rock2", "round"), b(10, 0, 160, 280, 190, 70, "rock", "round"),
      b(60, 30, 220, 120, 100, 40, "rock3", "round"), b(100, 170, 0, 100, 34, 140, "dark", "round"), b(92, 168, 140, 116, 30, 16, "rock3", "round"),
      b(20, 40, 226, 80, 60, 20, "moss", "round"), b(190, 60, 224, 70, 50, 16, "moss", "round"), b(206, 196, 40, 40, 4, 30, "sign")],
     {"rock": slot("stone", 0), "rock2": slot("stone", 2), "rock3": slot("stone", 1), "dark": slot("earth", 2), "moss": slot("leaf", 0), "sign": slot("wood", 3)}, "free", name="Вхід до печери")
item("rock_wall", "village", 1, 1, "floor", [b(0, 0, 0, 100, 100, 120, "rock", "round"), b(10, 14, 110, 70, 70, 60, "rock", "round"), b(30, 20, 160, 40, 40, 40, "rock2", "round")],
     {"rock": slot("stone", 2), "rock2": slot("stone", 0)}, "free", name="Скеля")
item("stalagmite", "village", 1, 1, "floor", [b(30, 30, 0, 40, 40, 40, "rock", "round"), b(38, 38, 40, 24, 24, 40, "rock", "cone"), b(60, 60, 0, 20, 20, 30, "rock2", "cone")],
     {"rock": slot("stone", 1), "rock2": slot("stone", 0)}, "free", name="Сталагміт")
item("crystal", "village", 1, 1, "floor",
     [b(30, 30, 0, 40, 40, 10, "rock", "round"), b(40, 40, 6, 16, 16, 56, "glow", "cone"), b(26, 50, 6, 12, 12, 34, "glow", "cone"), b(58, 34, 6, 12, 12, 40, "glow", "cone")],
     {"rock": slot("ceramic", 5), "glow": slot("fabric", 4)}, "free", name="Кристали")
items[-1]["tags"] = ["light", "self_glow"]
item("glow_mushroom", "village", 1, 1, "floor",
     [b(30 + (i % 2) * 30, 30 + (i // 2) * 26, 0, 6, 6, 14 + i * 4, "stem") for i in range(4)] + [b(24 + (i % 2) * 30, 24 + (i // 2) * 26, 14 + i * 4, 18, 18, 8, "glow", "round") for i in range(4)],
     {"stem": slot("ceramic", 1), "glow": slot("glass", 3)}, "free", name="Світні гриби")
items[-1]["tags"] = ["light", "self_glow"]
item("cave_torch", "village", 1, 1, "floor", [b(44, 44, 0, 10, 10, 110, "wood", "cyl"), b(40, 40, 110, 18, 18, 20, "glow", "ball")], {"wood": slot("wood", 2), "glow": slot("autumn", 1)}, "free", name="Смолоскип")
items[-1]["tags"] = ["light"]
item("crystal_shard", "nature", 1, 1, "surface", [b(40, 40, 0, 20, 20, 40, "glow", "cone"), b(30, 50, 0, 12, 12, 24, "glow", "cone")], {"glow": slot("fabric", 4)}, "free", name="Уламок кристала")
items[-1]["hidden"] = True

# =============================================================================================================
# The new street's buildings (a vet, a gym, a bar), the winery and its vines, bicycles, the mountain and the
# fire lookout tower
# =============================================================================================================
civic("vet_clinic", "Ветклініка «Лапка»", 5, 3, 110, [("glass", 3), ("leaf", 0), ("ceramic", 0), ("leaf", 1), {"sign": slot("ceramic", 0), "paw": slot("leaf", 0)}],
      [b(170, 286, 124, 160, 6, 26, "sign", "round"), b(236, 284, 128, 18, 4, 18, "paw", "ball"), b(226, 284, 144, 8, 4, 8, "paw", "ball"), b(256, 284, 144, 8, 4, 8, "paw", "ball")], roof_h=60)
civic("gym", "Спортзал «Сила»", 6, 3, 120, [("ceramic", 2), ("ceramic", 5), ("ceramic", 0), ("metal", 2), {"sign": slot("fabric", 1), "bar": slot("metal", 0)}],
      [b(200, 286, 136, 200, 6, 28, "sign", "round"), b(240, 282, 146, 120, 6, 6, "bar"), b(230, 280, 138, 14, 10, 22, "bar", "cyl"), b(356, 280, 138, 14, 10, 22, "bar", "cyl")], roof_h=50)
civic("winery", "Виноробня «Лоза»", 6, 4, 120, [("ceramic", 1), ("pot", 0), ("wood", 3), ("wood", 2), {"sign": slot("wood", 3), "barrel": slot("wood", 1), "grape": slot("fabric", 3)}],
      [b(200, 386, 136, 200, 6, 28, "sign", "round"), b(280, 384, 140, 40, 4, 18, "grape", "ball"), b(20, 396, 0, 60, 40, 60, "barrel", "cyl"), b(90, 396, 0, 60, 40, 60, "barrel", "cyl"),
       b(520, 396, 0, 60, 40, 60, "barrel", "cyl")], roof_h=80, chimney=True)
items[-1]["tags"] = []

# the vet's room: an examination table, cages, a scale
item("exam_table", "village", 2, 1, "floor", [b(20, 20, 0, 12, 12, 70, "leg", "cyl"), b(168, 20, 0, 12, 12, 70, "leg", "cyl"), b(10, 10, 70, 180, 80, 8, "top", "round"), b(14, 14, 78, 172, 72, 4, "mat")],
     {"leg": slot("metal", 0), "top": slot("metal", 0), "mat": slot("glass", 1)}, "free", name="Оглядовий стіл")
item("pet_cage", "village", 1, 1, "floor",
     [b(8, 8, 0, 84, 84, 6, "base"), b(8, 8, 74, 84, 84, 4, "bar")] + [b(8 + k * 14, 8, 6, 3, 3, 68, "bar") for k in range(7)] + [b(8 + k * 14, 89, 6, 3, 3, 68, "bar") for k in range(7)]
     + [b(8, 8 + k * 14, 6, 3, 3, 68, "bar") for k in range(7)] + [b(89, 8 + k * 14, 6, 3, 3, 68, "bar") for k in range(7)] + [b(30, 30, 6, 40, 30, 22, "pet", "ball"), b(56, 40, 18, 16, 14, 14, "pet", "ball")],
     {"base": slot("ceramic", 1), "bar": slot("metal", 0), "pet": slot("wood", 3)}, "free", name="Клітка")
# the gym: a treadmill, a rack of weights, a bench, a punching bag, mats
item("treadmill", "village", 1, 2, "floor", [b(10, 30, 0, 80, 160, 14, "belt", "round"), b(10, 20, 14, 80, 10, 4, "frame"), b(14, 6, 0, 8, 8, 120, "frame"), b(78, 6, 0, 8, 8, 120, "frame"),
     b(10, 4, 110, 80, 14, 20, "screen", "round")], {"belt": slot("ceramic", 5), "frame": slot("metal", 0), "screen": slot("glass", 1)}, "free", name="Бігова доріжка")
item("weight_rack", "village", 2, 1, "floor", [b(10, 30, 0, 8, 40, 110, "frame"), b(182, 30, 0, 8, 40, 110, "frame"), b(10, 30, 40, 180, 40, 4, "frame"), b(10, 30, 90, 180, 40, 4, "frame")]
     + [b(24 + k * 30, 36, 44, 20, 28, 20, "plate", "cyl") for k in range(5)] + [b(24 + k * 30, 36, 94, 16, 24, 14, "plate2", "cyl") for k in range(5)],
     {"frame": slot("metal", 2), "plate": slot("ceramic", 5), "plate2": slot("fabric", 1)}, "free", name="Стійка з гантелями")
item("bench_press", "village", 1, 2, "floor", [b(30, 20, 0, 40, 160, 40, "bench", "round"), b(10, 6, 0, 8, 8, 120, "frame"), b(82, 6, 0, 8, 8, 120, "frame"), b(-10, 8, 110, 120, 6, 6, "bar"),
     b(-14, 2, 96, 10, 18, 36, "plate", "cyl"), b(104, 2, 96, 10, 18, 36, "plate", "cyl")], {"bench": slot("fabric", 6), "frame": slot("metal", 2), "bar": slot("metal", 0), "plate": slot("ceramic", 5)}, "free", name="Жим лежачи")
item("punching_bag", "village", 1, 1, "floor", [b(20, 20, 0, 60, 60, 6, "base", "cyl"), b(46, 46, 6, 8, 8, 200, "frame"), b(46, 20, 196, 8, 40, 8, "frame"), b(30, 4, 70, 40, 40, 110, "bag", "cyl")],
     {"base": slot("metal", 2), "frame": slot("metal", 2), "bag": slot("fabric", 1)}, "free", name="Груша")
# the bar: a counter with taps, shelves of bottles, a pool table, a jukebox, a dartboard
item("bar_counter", "village", 3, 1, "floor", [b(0, 20, 0, 300, 70, 100, "body"), b(0, 14, 100, 300, 82, 8, "top", "round")] + [b(40 + k * 50, 40, 108, 10, 10, 40, "tap", "cyl") for k in range(5)]
     + [b(36 + k * 50, 36, 146, 18, 10, 6, "tap2") for k in range(5)] + [b(6, 92, 10, 288, 2, 80, "front")],
     {"body": slot("wood", 2), "top": slot("wood", 3), "tap": slot("metal", 1), "tap2": slot("fabric", 1), "front": slot("wood", 1)}, "free", name="Барна стійка")
item("bottle_shelf", "village", 2, 1, "floor", [b(0, 0, 0, 200, 40, 180, "frame")] + [b(4, 4, z, 192, 36, 4, "frame") for z in (40, 90, 140)]
     + [b(10 + k * 24, 12, z + 4, 14, 14, 34, ("b1", "b2", "b3")[(k + z) % 3], "cyl") for k in range(8) for z in (40, 90, 140)],
     {"frame": slot("wood", 2), "b1": slot("leaf", 0), "b2": slot("autumn", 1), "b3": slot("glass", 3)}, "free", name="Полиця з пляшками")
item("pool_table", "village", 3, 2, "floor", legs4(300, 200, 60, 16, 16, "wood") + [b(0, 0, 60, 300, 200, 18, "wood", "round"), b(14, 14, 78, 272, 172, 2, "cloth")]
     + [b(60 + k * 30, 80 + (k % 3) * 12, 80, 10, 10, 10, ("ball1", "ball2")[k % 2], "ball") for k in range(6)] + [b(40, 150, 80, 200, 4, 4, "cue")],
     {"wood": slot("wood", 0), "cloth": slot("leaf", 0), "ball1": slot("fabric", 1), "ball2": slot("autumn", 3), "cue": slot("wood", 3)}, "free", name="Більярд")
item("jukebox", "village", 1, 1, "floor", [b(10, 30, 0, 80, 60, 130, "body", "round"), b(16, 88, 70, 68, 2, 50, "glow", "round"), b(20, 88, 20, 60, 2, 40, "grill")],
     {"body": slot("fabric", 1), "glow": slot("autumn", 3), "grill": slot("metal", 1)}, "free", name="Музичний автомат")
items[-1]["tags"] = ["light", "self_glow"]
item("dartboard", "village", 1, 1, "wall", [b(20, 0, 110, 60, 4, 60, "board", "cyl"), b(34, 3, 124, 32, 2, 32, "ring", "cyl"), b(46, 4, 136, 8, 2, 8, "board", "cyl")],
     {"board": slot("ceramic", 5), "ring": slot("fabric", 1)}, "free", name="Дартс")
# the winery: barrels, a rack, the press; vines on trellises in rows
item("wine_barrel", "village", 1, 1, "floor", [b(14, 10, 10, 72, 80, 70, "wood", "round"), b(10, 10, 20, 80, 80, 6, "hoop", "round"), b(10, 10, 64, 80, 80, 6, "hoop", "round"),
     b(20, 20, 0, 12, 60, 12, "stand"), b(68, 20, 0, 12, 60, 12, "stand"), b(44, 88, 40, 12, 4, 12, "tap", "cyl")],
     {"wood": slot("wood", 1), "hoop": slot("metal", 2), "stand": slot("wood", 2), "tap": slot("metal", 1)}, "free", name="Бочка")
item("wine_press", "village", 1, 1, "floor", [b(16, 16, 0, 68, 68, 50, "wood", "cyl"), b(46, 46, 50, 8, 8, 70, "screw", "cyl"), b(20, 46, 112, 60, 8, 8, "screw"), b(24, 24, 40, 52, 52, 10, "grape", "ball")],
     {"wood": slot("wood", 1), "screw": slot("metal", 2), "grape": slot("fabric", 3)}, "free", name="Прес для винограду")
item("grapevine", "village", 1, 1, "floor",
     [b(44, 44, 0, 10, 10, 120, "post"), b(0, 46, 110, 100, 4, 4, "wire"), b(0, 46, 76, 100, 4, 4, "wire"), b(46, 46, 0, 6, 6, 70, "stem")]
     + [b(4 + k * 32, 36, 64, 32, 26, 40, "leaf", "round") for k in range(3)] + [b(12 + k * 34, 44, 54, 12, 12, 18, "grape", "ball") for k in range(3)],
     {"post": slot("wood", 2), "wire": slot("metal", 2), "stem": slot("wood", 0), "leaf": slot("leaf", 1), "grape": slot("fabric", 3)}, "free", name="Виноградна лоза")
item("grapes", "nature", 1, 1, "surface", [b(36, 40, 0, 28, 24, 30, "grape", "ball"), b(42, 44, 26, 16, 14, 16, "grape", "ball"), b(48, 48, 40, 4, 4, 10, "stem")],
     {"grape": slot("fabric", 3), "stem": slot("wood", 0)}, "free", name="Гроно винограду")
items[-1]["hidden"] = True
item("wine_bottle", "nature", 1, 1, "surface", [b(40, 40, 0, 20, 20, 40, "glass", "cyl"), b(46, 46, 40, 8, 8, 20, "glass", "cyl"), b(42, 41, 14, 16, 2, 14, "label")],
     {"glass": slot("leaf", 0), "label": slot("ceramic", 0)}, coins(12), name="Пляшка вина «Лоза»")

# bicycles: one to ride (drawn under the rider), and those the villagers ride about on
vehicle("bicycle", "Велосипед", 1, 1, [b(4, 46, 0, 34, 6, 34, "wheel", "cyl"), b(62, 46, 0, 34, 6, 34, "wheel", "cyl"), b(20, 47, 16, 60, 4, 4, "frame"), b(46, 47, 16, 4, 4, 30, "frame"),
        b(40, 44, 44, 18, 10, 4, "seat"), b(74, 47, 16, 4, 4, 34, "frame"), b(70, 40, 48, 4, 20, 4, "frame"), b(16, 46, 30, 30, 4, 4, "frame"),
        b(80, 46, 40, 6, 8, 8, "light"), b(4, 47, 34, 4, 6, 6, "tail")],
        {"wheel": slot("ceramic", 5), "frame": slot("fabric", 6), "seat": slot("ceramic", 5), "light": slot("pastel", 3), "tail": slot("fabric", 1)})
# a neighbour riding by: sat on the saddle, leaning to the bars, hands on them, feet on the pedals, a helmet
vehicle("cyclist", "Велосипедист", 1, 1, [b(4, 46, 0, 34, 6, 34, "wheel", "cyl"), b(62, 46, 0, 34, 6, 34, "wheel", "cyl"), b(20, 47, 16, 60, 4, 4, "frame"), b(46, 47, 16, 4, 4, 30, "frame"),
        b(74, 47, 16, 4, 4, 34, "frame"), b(66, 38, 50, 6, 24, 4, "frame"), b(38, 44, 44, 18, 12, 4, "saddle"),
        b(36, 40, 46, 20, 20, 12, "pants", "round"), b(40, 40, 56, 20, 20, 16, "shirt", "round"), b(48, 41, 68, 18, 18, 12, "shirt", "round"),
        b(56, 38, 62, 14, 5, 5, "shirt"), b(56, 57, 62, 14, 5, 5, "shirt"), b(68, 38, 52, 5, 5, 10, "skin"), b(68, 57, 52, 5, 5, 10, "skin"),
        b(56, 42, 78, 16, 16, 16, "skin", "round"), b(54, 41, 88, 19, 18, 9, "helmet", "round"), b(54, 43, 80, 4, 14, 8, "hair"),
        b(44, 41, 34, 14, 6, 12, "pants"), b(44, 53, 30, 14, 6, 12, "pants"), b(50, 41, 16, 6, 6, 20, "skin"), b(52, 53, 12, 6, 6, 20, "skin"),
        b(49, 39, 10, 11, 8, 6, "shoe", "round"), b(51, 53, 6, 11, 8, 6, "shoe", "round"),
        b(84, 46, 40, 6, 8, 8, "light"), b(2, 47, 34, 4, 6, 6, "tail")],
        {"light": slot("pastel", 3), "tail": slot("fabric", 1), "wheel": slot("ceramic", 5), "frame": slot("fabric", 4), "saddle": slot("ceramic", 5),
         "shirt": slot("fabric", 6), "pants": slot("wood", 5), "skin": slot("skin", 0), "hair": slot("wood", 2),
         "helmet": slot("ceramic", 0), "shoe": slot("ceramic", 5)})
item("bike_stand", "village", 2, 1, "floor",
     [b(10, 40, 0, 180, 20, 6, "frame")] + [b(20 + k * 60, 46, 0, 6, 6, 40, "frame") for k in range(3)]
     + [b(16 + k * 60, 30, 0, 30, 4, 30, "wheel", "cyl") for k in range(3)] + [b(16 + k * 60, 60, 0, 30, 4, 30, "wheel", "cyl") for k in range(3)]
     + [b(20 + k * 60, 36, 18, 4, 30, 4, ("bike", "bike2", "bike3")[k]) for k in range(3)] + [b(14 + k * 60, 40, 34, 16, 10, 4, "wheel") for k in range(3)]
     + [b(150, 70, 0, 6, 6, 110, "frame"), b(130, 72, 100, 46, 4, 24, "sign")],
     {"frame": slot("metal", 2), "wheel": slot("ceramic", 5), "bike": slot("fabric", 6), "bike2": slot("fabric", 1), "bike3": slot("fabric", 2), "sign": slot("leaf", 1)}, "free", name="Прокат велосипедів")

# the mountain over the cave: masses of rock heaped round a peak, rougher and narrower as it rises, ledges, scree
# at its foot, pines clinging to its shoulders, snow on the top
import random as _random
_r = _random.Random(1871)
mount = [b(40, 40, 0, 1320, 920, 90, "rock2", "round")]
for z in range(60, 700, 50):
    k = 1 - z / 760
    rx, ry = 640 * k, 450 * k
    for n in range(int(6 + 10 * k)):
        a = _r.random() * 6.283
        import math as _m
        cx, cy = 700 + _m.cos(a) * rx * _r.uniform(0.2, 0.9), 500 + _m.sin(a) * ry * _r.uniform(0.2, 0.9)
        w, d = _r.uniform(160, 360) * (0.5 + k), _r.uniform(140, 300) * (0.5 + k)
        mount.append(b(int(cx - w / 2), int(cy - d / 2), z - 40, int(w), int(d), _r.randint(80, 150), _r.choice(["rock", "rock2", "rock3", "rock"]), "round"))
mount += [b(600, 420, 640, 220, 170, 80, "rock", "round"), b(640, 450, 690, 150, 110, 60, "snow", "round"), b(560, 380, 620, 300, 250, 24, "snow", "round"), b(500, 330, 560, 400, 320, 14, "snow", "round")]
for x, y, z in [(80, 120, 60), (1180, 200, 60), (200, 760, 60), (1100, 760, 60), (300, 260, 200), (980, 300, 220), (420, 690, 220), (850, 700, 260), (260, 520, 160)]:
    mount += [b(x, y, z, 40, 40, 30, "trunk", "cyl"), b(x - 30, y - 30, z + 30, 100, 100, 110, "pine", "cone")]
for n in range(14):
    mount.append(b(_r.randint(20, 1300), _r.randint(900, 960), 0, _r.randint(40, 90), _r.randint(30, 60), _r.randint(20, 40), "rock3", "round"))
# the trail up: steps winding round the south face
mount += [b(820 + k * 30, 940 - k * 40, k * 45, 70, 40, 12, "trail") for k in range(8)] + [b(1020 - k * 40, 620 - k * 20, 360 + k * 40, 60, 40, 12, "trail") for k in range(6)]
item("mountain", "village", 14, 10, "floor", mount,
     {"rock": slot("stone", 0), "rock2": slot("stone", 2), "rock3": slot("stone", 1), "snow": slot("ceramic", 0), "trunk": slot("wood", 0), "pine": slot("leaf", 0), "trail": slot("wood", 3)},
     "free", name="Гора Велика Липа")
# the fire lookout: a cabin with windows all round on tall legs, stairs up, a weather vane
look = [b(x, y, 0, 12, 12, 760, "steel") for x in (20, 168) for y in (20, 168)]
look += [b(20, 20, 160 * k + 80, 160, 160, 6, "steel") for k in range(5)] + [b(86, 86, 0, 28, 28, 760, "steel")]
look += [b(-10, -10, 760, 220, 220, 10, "floor"), b(0, 0, 770, 200, 200, 90, "cabin"), b(6, -2, 800, 188, 4, 50, "glass"), b(6, 198, 800, 188, 4, 50, "glass"),
         b(-2, 6, 800, 4, 188, 50, "glass"), b(198, 6, 800, 4, 188, 50, "glass"), b(-20, -20, 860, 240, 240, 60, "roof", "gable"), b(96, 96, 920, 6, 6, 60, "steel"), b(80, 96, 970, 40, 4, 12, "flag")]
item("fire_lookout", "village", 2, 2, "floor", look,
     {"steel": slot("metal", 2), "floor": slot("wood", 2), "cabin": slot("fabric", 1), "glass": slot("glass", 1), "roof": slot("ceramic", 5), "flag": slot("fabric", 1)}, "free", name="Пожежна вишка")

# the old mine in the cave: timber props holding the roof, rails, a cart of ore, lanterns, columns of stone
item("mine_support", "village", 1, 1, "floor", [b(4, 40, 0, 12, 12, 150, "wood"), b(84, 40, 0, 12, 12, 150, "wood"), b(0, 38, 146, 100, 16, 14, "wood"), b(30, 40, 120, 14, 8, 20, "lamp_post")],
     {"wood": slot("wood", 0), "lamp_post": slot("metal", 2)}, "free", name="Кріплення шахти")
item("rails", "village", 1, 1, "rug", [b(0, 22, 0, 100, 6, 4, "rail"), b(0, 72, 0, 100, 6, 4, "rail")] + [b(10 + k * 25, 14, 0, 10, 72, 3, "sleeper") for k in range(4)],
     {"rail": slot("metal", 0), "sleeper": slot("wood", 0)}, "free", name="Рейки")
item("minecart", "village", 1, 1, "floor", [b(14, 22, 10, 72, 56, 40, "body", "round"), b(18, 26, 48, 64, 48, 12, "ore", "ball"), b(20, 18, 0, 16, 6, 16, "wheel", "cyl"), b(64, 18, 0, 16, 6, 16, "wheel", "cyl"),
     b(20, 76, 0, 16, 6, 16, "wheel", "cyl"), b(64, 76, 0, 16, 6, 16, "wheel", "cyl"), b(40, 40, 54, 14, 14, 10, "gleam", "ball")],
     {"body": slot("metal", 2), "ore": slot("stone", 2), "wheel": slot("ceramic", 5), "gleam": slot("autumn", 3)}, "free", name="Вагонетка з рудою")
item("mine_lantern", "village", 1, 1, "floor", [b(46, 46, 0, 8, 8, 110, "post"), b(38, 38, 110, 24, 24, 26, "frame", "round"), b(42, 42, 114, 16, 16, 18, "flame")],
     {"post": slot("wood", 0), "frame": slot("metal", 2), "flame": slot("autumn", 1)}, "free", name="Шахтарський ліхтар")
items[-1]["tags"] = ["light"]
item("rock_column", "village", 1, 1, "floor", [b(20, 20, 0, 60, 60, 60, "rock", "round"), b(30, 30, 50, 40, 40, 120, "rock2", "cyl"), b(24, 24, 160, 52, 52, 80, "rock", "round"), b(36, 36, 230, 28, 28, 40, "rock2", "cone")],
     {"rock": slot("stone", 2), "rock2": slot("stone", 1)}, "free", name="Кам'яна колона")
