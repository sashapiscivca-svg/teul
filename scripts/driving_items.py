# The road (docs/world-economy.md §15): the car service station and the driving school (the buildings and what
# stands inside), the cars the station sells and the school's own, the zebra crossings, road signs. Run inside
# gen_base_content.py after town_things.py (it needs `item`, `b`, `slot`, `civic`, `vehicle`, `car_body`, `CAR_SLOTS`).

# ---- the buildings -------------------------------------------------------------------------------------------

# the service station «СТО»: a wide garage of corrugated grey with two roller doors (one up: a car on the lift
# inside), a red sign, tyres stacked by the wall
sto = []
for k, x in enumerate((40, 270)):
    sto += [b(x, 288, 8, 190, 6, 96, "bay")] + [b(x, 289, 14 + i * 12, 190, 6, 2, "rib") for i in range(8)]
sto[0:1] = [b(40, 288, 8, 190, 6, 96, "dark")]
sto += [b(80, 250, 8, 110, 40, 36, "car", "round"), b(100, 254, 44, 70, 32, 20, "glass")]
sto += [b(170, 296, 116, 160, 6, 26, "sign", "round"), b(190, 299, 124, 120, 2, 10, "letters")]
sto += [b(470, 40 + i * 70, 0, 40, 40, 14, "tyre", "cyl") for i in range(3)] + [b(470, 40, 14, 40, 40, 14, "tyre", "cyl")]
civic("sto_garage", "СТО «Гайка»", 5, 3, 120,
      [("stone", 1), ("stone", 3), ("ceramic", 1), ("metal", 2),
       {"bay": slot("stone", 0), "rib": slot("stone", 2), "dark": slot("ceramic", 5), "car": slot("fabric", 6), "sign": slot("fabric", 1),
        "letters": slot("ceramic", 0), "tyre": slot("ceramic", 5)}],
      sto, roof_h=40)

# the driving school: a small yellow office with a big «У» triangle on the roof and a sign over the door
ds = [b(170, 286, 124, 160, 6, 26, "sign", "round"), b(190, 289, 132, 120, 2, 10, "letters"),
      b(176, 140, 200, 48, 8, 44, "tri"), b(184, 138, 208, 32, 8, 28, "tri_in"), b(194, 136, 214, 12, 8, 12, "u"),
      b(250, 288, 20, 120, 4, 80, "window"), b(40, 288, 20, 100, 4, 80, "window")]
# (the driving school's building is the town's own: growth_items.py)

# ---- the street: zebra crossings, signs, the pump, cones -------------------------------------------------------

# a zebra crossing: white bars across one cell of the road (two make a crossing of a two-lane street)
item("road_zebra", "village", 1, 1, "rug", [b(4, 8 + k * 22, 0, 92, 12, 1, "paint") for k in range(4)], {"paint": slot("ceramic", 0)}, "free", name="Пішохідний перехід")
items[-1]["tags"] = ["zebra"]
# signs: children (a red-edged triangle), the town's speed (a red ring), the crossing (a blue square)
item("road_sign_children", "village", 1, 1, "floor",
     [b(46, 46, 0, 8, 8, 150, "post", "cyl"), b(24, 44, 120, 52, 4, 46, "edge"), b(30, 43, 126, 40, 2, 34, "plate"), b(42, 42, 130, 6, 1, 18, "kid"), b(52, 42, 130, 6, 1, 14, "kid")],
     {"post": slot("metal", 0), "edge": slot("fabric", 1), "plate": slot("ceramic", 0), "kid": slot("ceramic", 5)}, "free", name="Знак «Діти»")
item("road_sign_speed", "village", 1, 1, "floor",
     [b(46, 46, 0, 8, 8, 150, "post", "cyl"), b(26, 44, 116, 48, 4, 48, "ring", "cyl"), b(32, 43, 122, 36, 2, 36, "plate", "cyl"), b(40, 42, 132, 8, 1, 14, "digit"), b(52, 42, 132, 8, 1, 14, "digit")],
     {"post": slot("metal", 0), "ring": slot("fabric", 1), "plate": slot("ceramic", 0), "digit": slot("ceramic", 5)}, "free", name="Знак «Обмеження швидкості»")
item("road_sign_crossing", "village", 1, 1, "floor",
     [b(46, 46, 0, 8, 8, 150, "post", "cyl"), b(26, 44, 116, 48, 4, 48, "plate"), b(34, 43, 124, 32, 2, 4, "white"), b(44, 42, 128, 8, 1, 24, "white")],
     {"post": slot("metal", 0), "plate": slot("fabric", 6), "white": slot("ceramic", 0)}, "free", name="Знак «Пішохідний перехід»")
# the fuel pump: a tall red box with a little window, a nozzle on a hose
item("fuel_pump", "village", 1, 1, "floor",
     [b(20, 20, 0, 60, 60, 10, "base"), b(26, 30, 10, 48, 40, 110, "body", "round"), b(32, 28, 80, 36, 2, 20, "screen"), b(30, 26, 124, 40, 46, 10, "body"),
      b(74, 44, 40, 10, 6, 30, "hose", "cyl"), b(76, 40, 66, 8, 14, 6, "nozzle")],
     {"base": slot("stone", 0), "body": slot("fabric", 1), "screen": slot("glass", 1), "hose": slot("ceramic", 5), "nozzle": slot("metal", 0)}, "free", name="Бензоколонка")
item("traffic_cone", "village", 1, 1, "floor", [b(30, 30, 0, 40, 40, 4, "base"), b(38, 38, 4, 24, 24, 40, "cone", "cone"), b(40, 40, 18, 20, 20, 6, "band", "cyl")],
     {"base": slot("autumn", 0), "cone": slot("autumn", 0), "band": slot("ceramic", 0)}, "free", name="Конус")
item("tyre_stack", "village", 1, 1, "floor", [b(16, 16, k * 18, 68, 68, 18, "tyre", "cyl") for k in range(4)] + [b(36, 36, 72, 28, 28, 1, "hole", "cyl")],
     {"tyre": slot("ceramic", 5), "hole": slot("stone", 3)}, "free", name="Шини")
item("oil_drum", "village", 1, 1, "floor", [b(22, 22, 0, 56, 56, 80, "drum", "cyl"), b(22, 22, 26, 56, 56, 4, "ring", "cyl"), b(22, 22, 54, 56, 56, 4, "ring", "cyl"), b(56, 34, 80, 10, 10, 4, "cap", "cyl")],
     {"drum": slot("fabric", 6), "ring": slot("metal", 2), "cap": slot("metal", 0)}, "free", name="Бочка оливи")

# ---- inside: the garage and the classroom ------------------------------------------------------------------------

# a car lift: two posts with arms, a red control box
item("car_lift", "village", 2, 1, "floor",
     [b(10, 10, 0, 16, 16, 150, "post"), b(174, 10, 0, 16, 16, 150, "post"), b(10, 10, 60, 180, 10, 6, "arm"), b(10, 80, 60, 180, 10, 6, "arm"),
      b(10, 74, 0, 16, 16, 150, "post"), b(174, 74, 0, 16, 16, 150, "post"), b(30, 30, 0, 140, 40, 2, "pad"), b(176, 32, 90, 12, 14, 20, "box")],
     {"post": slot("fabric", 6), "arm": slot("metal", 2), "pad": slot("stone", 2), "box": slot("fabric", 1)}, "free", name="Підйомник")
item("tool_chest", "village", 1, 1, "floor",
     [b(14, 24, 0, 72, 52, 70, "body"), b(16, 22, 14, 68, 2, 12, "drawer"), b(16, 22, 30, 68, 2, 12, "drawer"), b(16, 22, 46, 68, 2, 12, "drawer"),
      b(40, 21, 18, 20, 2, 3, "handle"), b(40, 21, 34, 20, 2, 3, "handle"), b(40, 21, 50, 20, 2, 3, "handle"), b(20, 30, 70, 30, 10, 6, "wrench")],
     {"body": slot("fabric", 1), "drawer": slot("fabric", 1), "handle": slot("metal", 0), "wrench": slot("metal", 0)}, "free", name="Шафа з інструментами")
item("engine_stand", "village", 1, 1, "floor",
     [b(30, 30, 0, 8, 8, 40, "leg", "cyl"), b(62, 62, 0, 8, 8, 40, "leg", "cyl"), b(18, 22, 40, 64, 56, 36, "block", "round"), b(26, 30, 76, 48, 40, 10, "head"), b(10, 40, 50, 10, 20, 10, "pulley", "cyl")],
     {"leg": slot("metal", 2), "block": slot("stone", 0), "head": slot("metal", 0), "pulley": slot("ceramic", 5)}, "free", name="Двигун на стенді")
# the classroom: a poster of road signs, a little trainer with a wheel and a screen
item("road_rules_poster", "village", 2, 1, "wall",
     [b(10, 0, 60, 180, 2, 110, "paper"), b(24, 1, 130, 30, 2, 30, "red", "cyl"), b(70, 1, 130, 30, 2, 30, "blue"), b(116, 1, 128, 34, 2, 30, "tri", "cone"),
      b(24, 1, 80, 30, 2, 30, "blue", "cyl"), b(70, 1, 80, 30, 2, 30, "red"), b(116, 1, 80, 30, 2, 30, "yellow")],
     {"paper": slot("ceramic", 0), "red": slot("fabric", 1), "blue": slot("fabric", 6), "tri": slot("autumn", 3), "yellow": slot("autumn", 3)}, "free", name="Плакат з дорожніми знаками")
item("drive_trainer", "village", 1, 1, "floor",
     [b(20, 56, 0, 60, 40, 30, "seat"), b(20, 88, 30, 60, 8, 40, "seat"), b(30, 10, 0, 40, 30, 60, "stand"), b(36, 34, 54, 28, 6, 28, "wheel", "cyl"),
      b(20, 6, 70, 60, 8, 40, "screen"), b(24, 4, 74, 52, 2, 32, "glass")],
     {"seat": slot("ceramic", 5), "stand": slot("stone", 2), "wheel": slot("ceramic", 5), "screen": slot("stone", 3), "glass": slot("glass", 1)}, "free", name="Тренажер")

# ---- the cars --------------------------------------------------------------------------------------------------

# the three the station sells: a little old hatchback, a sedan, an estate with a roof rack
vehicle("car_hatch", "Малолітражка «Ластівка»", 2, 1, car_body("body", "top", tall=52), {**CAR_SLOTS, "body": slot("leaf", 1), "top": slot("leaf", 1)})
vehicle("car_sedan", "Седан «Дніпро»", 2, 1, car_body("body", "top", [b(8, 18, 40, 22, 64, 6, "body", "round")]), {**CAR_SLOTS, "body": slot("ceramic", 1), "top": slot("ceramic", 1)})
vehicle("car_wagon", "Універсал «Полтава»", 2, 1, car_body("body", "top", [b(32, 20, 82, 84, 4, 4, "rack"), b(32, 76, 82, 84, 4, 4, "rack")] + [b(38 + k * 24, 20, 82, 4, 60, 4, "rack") for k in range(4)], tall=60),
        {**CAR_SLOTS, "body": slot("fabric", 6), "top": slot("fabric", 6), "rack": slot("metal", 2)})
# the school's own: white, a red-edged «У» on the roof
vehicle("school_car", "Навчальне авто", 2, 1, car_body("body", "top", [b(84, 34, 74, 30, 30, 4, "base"), b(90, 46, 78, 20, 4, 20, "tri"), b(94, 45, 82, 12, 2, 12, "tri_in")]),
        {**CAR_SLOTS, "body": slot("ceramic", 0), "top": slot("ceramic", 0), "base": slot("ceramic", 5), "tri": slot("fabric", 1), "tri_in": slot("ceramic", 0)})
for car in ("car_hatch", "car_sedan", "car_wagon", "school_car"):
    for it in items:
        if it["id"] == car:
            it["tags"] = ["player_car"]
