# Decorations of the year's feasts: put out in town and at home on their days (the client places them from the
# calendar; they are not sold or carried). Run inside gen_base_content.py after the catalogue.

# a decorated fir for the square: tiers of needles, baubles, a star on top, gifts under it; lit at night
item("festive_tree", "village", 2, 2, "floor",
     [b(92, 92, 0, 16, 16, 22, "trunk", "cyl"),
      b(28, 28, 20, 144, 144, 40, "needles", "round"), b(42, 42, 58, 116, 116, 40, "needles", "round"),
      b(58, 58, 96, 84, 84, 38, "needles", "round"), b(72, 72, 132, 56, 56, 34, "needles", "round"),
      b(86, 86, 164, 28, 28, 26, "needles", "round"), b(93, 93, 190, 14, 14, 14, "star", "ball"),
      b(30, 96, 44, 12, 12, 12, "bauble", "ball"), b(160, 90, 48, 12, 12, 12, "bauble2", "ball"), b(96, 160, 40, 12, 12, 12, "bauble3", "ball"),
      b(48, 70, 84, 10, 10, 10, "bauble2", "ball"), b(140, 120, 80, 10, 10, 10, "bauble", "ball"), b(70, 140, 120, 10, 10, 10, "bauble3", "ball"),
      b(120, 66, 118, 10, 10, 10, "bauble", "ball"), b(80, 120, 150, 8, 8, 8, "bauble2", "ball"),
      b(20, 150, 0, 30, 30, 24, "gift"), b(150, 26, 0, 30, 26, 20, "gift2"), b(156, 156, 0, 24, 24, 18, "gift")],
     {"trunk": slot("wood", 2), "needles": slot("leaf", 0), "star": slot("metal", 1), "bauble": slot("fabric", 1),
      "bauble2": slot("metal", 1), "bauble3": slot("fabric", 6), "gift": slot("fabric", 7), "gift2": slot("fabric", 4)},
     "free", name="Святкова ялинка")
items[-1]["tags"] = ["light", "festive"]

# an arch of coloured lights over a path (New Year, Christmas)
item("garland_arch", "village", 2, 1, "floor",
     [b(10, 46, 0, 8, 8, 150, "post", "cyl"), b(182, 46, 0, 8, 8, 150, "post", "cyl"), b(10, 48, 146, 180, 4, 4, "wire"),
      b(24, 46, 136, 7, 7, 7, "bulb", "ball"), b(48, 46, 132, 7, 7, 7, "bulb2", "ball"), b(72, 46, 130, 7, 7, 7, "bulb3", "ball"),
      b(96, 46, 129, 7, 7, 7, "bulb", "ball"), b(120, 46, 130, 7, 7, 7, "bulb2", "ball"), b(144, 46, 132, 7, 7, 7, "bulb3", "ball"),
      b(168, 46, 136, 7, 7, 7, "bulb", "ball"), b(94, 44, 150, 12, 10, 12, "star", "ball")],
     {"post": slot("wood", 2), "wire": slot("metal", 2), "bulb": slot("fabric", 1), "bulb2": slot("metal", 1), "bulb3": slot("fabric", 6), "star": slot("metal", 1)},
     "free", name="Гірлянда-арка")
items[-1]["tags"] = ["light", "festive"]

# carved pumpkins with a candle inside (Halloween)
item("pumpkin_lantern", "village", 1, 1, "floor",
     [b(12, 26, 0, 42, 40, 32, "pumpkin", "ball"), b(56, 46, 0, 32, 30, 24, "pumpkin2", "ball"),
      b(31, 44, 31, 4, 4, 8, "stem"), b(70, 59, 23, 4, 4, 6, "stem"),
      b(22, 65, 14, 6, 2, 6, "glow"), b(38, 65, 14, 6, 2, 6, "glow"), b(26, 65, 6, 14, 2, 4, "glow"),
      b(64, 75, 10, 5, 2, 5, "glow"), b(76, 75, 10, 5, 2, 5, "glow")],
     {"pumpkin": slot("autumn", 0), "pumpkin2": slot("autumn", 1), "stem": slot("leaf", 0), "glow": slot("metal", 1)},
     "free", name="Гарбузи-ліхтарі")
items[-1]["tags"] = ["light", "self_glow", "festive"]

# the national flag on a pole (Independence Day, Constitution, Statehood, Defenders)
item("flag_pole", "village", 1, 1, "floor",
     [b(40, 40, 0, 20, 20, 6, "base"), b(48, 48, 0, 4, 4, 196, "pole", "cyl"), b(47, 47, 196, 6, 6, 6, "base", "ball"),
      b(52, 49, 172, 52, 2, 16, "blue"), b(52, 49, 156, 52, 2, 16, "yellow")],
     {"base": slot("stone", 0), "pole": slot("metal", 0), "blue": slot("fabric", 6), "yellow": slot("autumn", 3)},
     "free", name="Прапор")
items[-1]["tags"] = ["festive"]

# a basket of pysanky and pussy-willow branches (Easter, Palm Sunday)
item("easter_basket", "village", 1, 1, "floor",
     [b(18, 28, 0, 52, 40, 20, "basket", "round"), b(42, 28, 20, 4, 40, 20, "basket"), b(24, 34, 16, 40, 28, 4, "cloth"),
      b(24, 36, 18, 13, 10, 13, "egg", "ball"), b(39, 42, 18, 13, 10, 13, "egg2", "ball"), b(54, 36, 18, 13, 10, 13, "egg3", "ball"),
      b(70, 62, 0, 20, 20, 20, "pot", "cyl"), b(76, 68, 20, 2, 2, 52, "twig"), b(82, 66, 20, 2, 2, 46, "twig"), b(78, 72, 20, 2, 2, 40, "twig"),
      b(75, 67, 56, 4, 4, 4, "catkin", "ball"), b(81, 65, 50, 4, 4, 4, "catkin", "ball"), b(77, 71, 44, 4, 4, 4, "catkin", "ball")],
     {"basket": slot("wood", 1), "cloth": slot("ceramic", 0), "egg": slot("fabric", 1), "egg2": slot("fabric", 2), "egg3": slot("fabric", 6),
      "pot": slot("pot", 0), "twig": slot("wood", 2), "catkin": slot("ceramic", 0)},
     "free", name="Великодній кошик")
items[-1]["tags"] = ["festive"]

# a midsummer bonfire with a flower wreath by it (Kupala)
item("kupala_fire", "village", 1, 1, "floor",
     [b(26, 46, 0, 48, 8, 8, "log", "cyl"), b(46, 26, 0, 8, 48, 8, "log", "cyl"), b(30, 30, 0, 40, 40, 4, "ash", "round"),
      b(38, 38, 8, 24, 24, 22, "flame", "round"), b(44, 44, 28, 12, 12, 14, "flame2", "round"),
      b(4, 70, 0, 26, 26, 5, "wreath", "round"), b(6, 72, 5, 6, 6, 5, "flower", "ball"), b(18, 74, 5, 6, 6, 5, "flower2", "ball"), b(12, 86, 5, 6, 6, 5, "flower", "ball")],
     {"log": slot("wood", 2), "ash": slot("earth", 2), "flame": slot("autumn", 1), "flame2": slot("autumn", 3),
      "wreath": slot("leaf", 1), "flower": slot("fabric", 1), "flower2": slot("autumn", 3)},
     "free", name="Купальське вогнище")
items[-1]["tags"] = ["light", "festive"]

# ---- the town's big celebrations (festival.rs): put up over the days of getting ready, out on the day ----------

# a stage being built: bare scaffolding and planks (the days before)
item("stage_frame", "village", 3, 2, "floor",
     [b(10, 10, 0, 8, 8, 120, "pipe", "cyl"), b(282, 10, 0, 8, 8, 120, "pipe", "cyl"), b(10, 182, 0, 8, 8, 120, "pipe", "cyl"), b(282, 182, 0, 8, 8, 120, "pipe", "cyl"),
      b(10, 10, 116, 280, 6, 6, "pipe"), b(10, 186, 116, 280, 6, 6, "pipe"), b(10, 10, 40, 280, 180, 10, "plank"),
      b(40, 60, 50, 60, 40, 30, "crate"), b(200, 120, 50, 50, 50, 26, "crate")],
     {"pipe": slot("metal", 0), "plank": slot("wood", 1), "crate": slot("wood", 3)},
     "free", name="Риштування сцени")
items[-1]["tags"] = ["festive"]

# the stage: boards, a backdrop with a banner, speakers and lights
item("town_stage", "village", 3, 2, "floor",
     [b(0, 0, 0, 300, 200, 40, "boards"), b(0, 0, 0, 300, 200, 6, "skirt"), b(0, 170, 40, 300, 12, 150, "backdrop"),
      b(30, 172, 140, 240, 4, 36, "banner"), b(20, 30, 40, 36, 30, 60, "speaker"), b(244, 30, 40, 36, 30, 60, "speaker"),
      b(10, 176, 190, 280, 6, 6, "truss"), b(60, 172, 184, 10, 10, 10, "lamp", "ball"), b(150, 172, 184, 10, 10, 10, "lamp", "ball"), b(240, 172, 184, 10, 10, 10, "lamp", "ball"),
      b(140, 80, 40, 4, 4, 70, "mic", "cyl")],
     {"boards": slot("wood", 1), "skirt": slot("fabric", 1), "backdrop": slot("fabric", 6), "banner": slot("autumn", 3),
      "speaker": slot("metal", 2), "truss": slot("metal", 0), "lamp": slot("metal", 1), "mic": slot("metal", 2)},
     "free", name="Сцена")
items[-1]["tags"] = ["light", "festive"]

# pennants on a line between two poles
item("bunting", "village", 2, 1, "floor",
     [b(8, 46, 0, 8, 8, 140, "pole", "cyl"), b(184, 46, 0, 8, 8, 140, "pole", "cyl"), b(10, 49, 134, 180, 2, 2, "line")]
     + [b(20 + i * 20, 48, 118 - (4 if 2 <= i <= 5 else 0), 12, 2, 14, ["f1", "f2", "f3", "f4"][i % 4], "cone") for i in range(8)],
     {"pole": slot("wood", 2), "line": slot("metal", 0), "f1": slot("fabric", 1), "f2": slot("autumn", 3), "f3": slot("fabric", 6), "f4": slot("fabric", 4)},
     "free", name="Прапорці")
items[-1]["tags"] = ["festive"]

# a bunch of balloons tied to a weight
item("balloons", "village", 1, 1, "floor",
     [b(44, 44, 0, 12, 12, 8, "weight"), b(49, 49, 8, 2, 2, 90, "string")]
     + [b(30 + dx, 30 + dy, 92 + dz, 22, 22, 26, s, "ball") for dx, dy, dz, s in [(0, 0, 10, "a"), (18, 6, 0, "b"), (8, 20, 16, "c"), (-6, 14, 2, "d"), (14, -8, 20, "e")]],
     {"weight": slot("metal", 2), "string": slot("ceramic", 0), "a": slot("fabric", 1), "b": slot("autumn", 3), "c": slot("fabric", 6), "d": slot("fabric", 4), "e": slot("fabric_pink", 0)},
     "free", name="Повітряні кульки")
items[-1]["tags"] = ["festive"]

# a stand of buckets with flowers (women's day, mother's day, the flower festival)
item("flower_stand", "village", 1, 1, "floor",
     [b(10, 20, 0, 80, 60, 40, "table"), b(10, 20, 40, 80, 60, 4, "cloth")]
     + [b(16 + i * 24, 30, 44, 20, 20, 22, "bucket", "cyl") for i in range(3)]
     + [b(14 + i * 24, 28, 64, 24, 24, 18, ["fl1", "fl2", "fl3"][i], "ball") for i in range(3)],
     {"table": slot("wood", 1), "cloth": slot("ceramic", 0), "bucket": slot("metal", 0), "fl1": slot("fabric", 1), "fl2": slot("autumn", 3), "fl3": slot("fabric_pink", 0)},
     "free", name="Квіткова ятка")
items[-1]["tags"] = ["festive"]

# an arch of flowers (the flower festival)
item("flower_arch", "village", 2, 1, "floor",
     [b(10, 44, 0, 12, 12, 150, "post", "cyl"), b(178, 44, 0, 12, 12, 150, "post", "cyl"), b(10, 44, 146, 180, 12, 12, "post")]
     + [b(4 + i * 24, 40, 140 + (6 if 2 <= i <= 5 else 0), 20, 20, 20, ["a", "b", "c"][i % 3], "ball") for i in range(8)]
     + [b(6, 40, 30 + i * 30, 18, 18, 18, ["c", "a", "b"][i % 3], "ball") for i in range(4)] + [b(176, 40, 30 + i * 30, 18, 18, 18, ["b", "c", "a"][i % 3], "ball") for i in range(4)],
     {"post": slot("leaf", 0), "a": slot("fabric", 1), "b": slot("fabric_pink", 0), "c": slot("autumn", 3)},
     "free", name="Квіткова арка")
items[-1]["tags"] = ["festive"]

# an arch of red hearts (Valentine's)
item("heart_arch", "village", 2, 1, "floor",
     [b(10, 46, 0, 8, 8, 150, "post", "cyl"), b(182, 46, 0, 8, 8, 150, "post", "cyl"), b(10, 48, 146, 180, 4, 4, "wire")]
     + [b(16 + i * 22, 46, int(124 - abs(3.5 - i) * 4), 8, 6, 8, "heart", "ball") for i in range(8)]
     + [b(20 + i * 22, 46, int(124 - abs(3.5 - i) * 4), 8, 6, 8, "heart", "ball") for i in range(8)]
     + [b(18 + i * 22, 46, int(118 - abs(3.5 - i) * 4), 8, 6, 8, "heart", "cone") for i in range(8)],
     {"post": slot("metal", 0), "wire": slot("metal", 0), "heart": slot("fabric", 1)},
     "free", name="Арка з сердець")
items[-1]["tags"] = ["festive"]

# a market stall with a striped awning (any fair)
item("festival_stall", "village", 2, 1, "floor",
     [b(6, 20, 0, 188, 60, 50, "counter"), b(6, 20, 0, 6, 6, 130, "post"), b(188, 20, 0, 6, 6, 130, "post"), b(6, 74, 0, 6, 6, 130, "post"), b(188, 74, 0, 6, 6, 130, "post")]
     + [b(6 + i * 47, 14, 128, 47, 72, 10, "s1" if i % 2 == 0 else "s2") for i in range(4)]
     + [b(20 + i * 40, 30, 50, 26, 26, 16, ["g1", "g2", "g3"][i % 3], "ball") for i in range(4)],
     {"counter": slot("wood", 1), "post": slot("wood", 2), "s1": slot("fabric", 1), "s2": slot("ceramic", 0),
      "g1": slot("autumn", 3), "g2": slot("autumn", 0), "g3": slot("leaf", 1)},
     "free", name="Ятка")
items[-1]["tags"] = ["festive"]

# the harvest fair's stall: pumpkins, apples, jars of honey
item("harvest_stall", "village", 2, 1, "floor",
     [b(6, 20, 0, 188, 60, 46, "counter"), b(6, 20, 0, 6, 6, 120, "post"), b(188, 20, 0, 6, 6, 120, "post"), b(0, 14, 118, 200, 72, 8, "roof"),
      b(14, 26, 46, 40, 40, 30, "pumpkin", "ball"), b(64, 30, 46, 30, 30, 22, "apples", "round"), b(104, 32, 46, 18, 18, 22, "jar", "cyl"),
      b(126, 32, 46, 18, 18, 22, "jar", "cyl"), b(150, 26, 46, 36, 36, 26, "pumpkin2", "ball"), b(70, 84, 0, 50, 14, 30, "sign")],
     {"counter": slot("wood", 3), "post": slot("wood", 2), "roof": slot("wood", 1), "pumpkin": slot("autumn", 0), "pumpkin2": slot("autumn", 3),
      "apples": slot("fabric", 1), "jar": slot("autumn", 1), "sign": slot("ceramic", 1)},
     "free", name="Ятка врожаю")
items[-1]["tags"] = ["festive"]

# paper lanterns on a post (the lantern night)
item("lantern_post", "village", 1, 1, "floor",
     [b(46, 46, 0, 8, 8, 150, "post", "cyl"), b(20, 48, 146, 60, 4, 4, "post"),
      b(14, 42, 112, 16, 16, 22, "l1", "ball"), b(42, 30, 96, 16, 16, 22, "l2", "ball"), b(70, 42, 112, 16, 16, 22, "l3", "ball"),
      b(19, 47, 104, 6, 6, 8, "glow", "cyl"), b(75, 47, 104, 6, 6, 8, "glow", "cyl")],
     {"post": slot("wood", 2), "l1": slot("autumn", 1), "l2": slot("fabric", 1), "l3": slot("autumn", 3), "glow": slot("metal", 1)},
     "free", name="Паперові ліхтарики")
items[-1]["tags"] = ["light", "self_glow", "festive"]

# red lanterns strung between posts (the Lunar New Year)
item("red_lanterns", "village", 2, 1, "floor",
     [b(8, 46, 0, 8, 8, 150, "post", "cyl"), b(184, 46, 0, 8, 8, 150, "post", "cyl"), b(10, 49, 146, 180, 2, 2, "line")]
     + [b(22 + i * 34, 40, 108 + (6 if i in (0, 4) else 0), 22, 20, 26, "lantern", "ball") for i in range(5)]
     + [b(30 + i * 34, 48, 100 + (6 if i in (0, 4) else 0), 6, 4, 10, "tassel") for i in range(5)],
     {"post": slot("fabric", 1), "line": slot("metal", 1), "lantern": slot("fabric", 1), "tassel": slot("autumn", 3)},
     "free", name="Червоні ліхтарі")
items[-1]["tags"] = ["light", "self_glow", "festive"]

# the dragon of the Lunar New Year's dance: a head and body segments, each held up on poles
item("dragon_head", "village", 1, 1, "floor",
     [b(46, 46, 0, 6, 6, 70, "pole", "cyl"), b(18, 24, 66, 64, 56, 44, "head", "round"), b(18, 14, 70, 64, 18, 20, "jaw"),
      b(24, 40, 108, 10, 10, 20, "horn", "cone"), b(66, 40, 108, 10, 10, 20, "horn", "cone"), b(28, 22, 96, 12, 4, 10, "eye", "ball"), b(60, 22, 96, 12, 4, 10, "eye", "ball"),
      b(12, 30, 60, 76, 50, 10, "beard")],
     {"pole": slot("wood", 2), "head": slot("fabric", 1), "jaw": slot("autumn", 3), "horn": slot("autumn", 1), "eye": slot("ceramic", 0), "beard": slot("autumn", 3)},
     "free", name="Голова дракона")
items[-1]["tags"] = ["festive"]
item("dragon_body", "village", 1, 1, "floor",
     [b(46, 46, 0, 6, 6, 70, "pole", "cyl"), b(14, 26, 66, 72, 48, 30, "body", "round"), b(40, 30, 92, 20, 40, 10, "fin", "cone"), b(14, 26, 62, 72, 48, 8, "belly", "round")],
     {"pole": slot("wood", 2), "body": slot("fabric", 1), "fin": slot("autumn", 1), "belly": slot("autumn", 3)},
     "free", name="Тіло дракона")
items[-1]["tags"] = ["festive"]

# Earth Day: rakes, sacks and young lindens waiting to be planted
item("toloka_heap", "village", 1, 1, "floor",
     [b(16, 20, 0, 30, 30, 34, "sack", "round"), b(50, 26, 0, 30, 30, 30, "sack", "round"), b(20, 66, 0, 4, 4, 90, "rake", "cyl"), b(10, 64, 86, 26, 6, 4, "rake"),
      b(36, 70, 0, 4, 4, 86, "rake", "cyl"), b(66, 62, 0, 16, 16, 14, "pot", "cyl"), b(72, 68, 14, 4, 4, 30, "stem", "cyl"), b(62, 58, 40, 26, 26, 22, "leaves", "ball")],
     {"sack": slot("ceramic", 1), "rake": slot("wood", 1), "pot": slot("pot", 0), "stem": slot("wood", 2), "leaves": slot("leaf", 1)},
     "free", name="Граблі й саджанці")
items[-1]["tags"] = ["festive"]
item("sapling", "village", 1, 1, "floor",
     [b(40, 40, 0, 20, 20, 4, "soil", "round"), b(48, 48, 0, 4, 4, 70, "stem", "cyl"), b(44, 44, 0, 3, 3, 60, "stake", "cyl"),
      b(30, 30, 56, 40, 40, 34, "leaves", "ball")],
     {"soil": slot("earth", 0), "stem": slot("wood", 2), "stake": slot("wood", 3), "leaves": slot("leaf", 1)},
     "free", name="Молода липа")
items[-1]["tags"] = ["festive"]

# the end of summer: a film on the square
item("cinema_screen", "village", 3, 1, "floor",
     [b(20, 46, 0, 8, 8, 200, "frame", "cyl"), b(272, 46, 0, 8, 8, 200, "frame", "cyl"), b(14, 48, 70, 272, 4, 130, "screen"),
      b(14, 46, 196, 272, 8, 8, "frame"), b(14, 46, 66, 272, 8, 6, "frame")],
     {"frame": slot("metal", 2), "screen": slot("ceramic", 0)},
     "free", name="Екран кіно під зорями")
items[-1]["tags"] = ["festive"]

# a poster pillar: the coming celebration announced
item("poster_board", "village", 1, 1, "floor",
     [b(30, 30, 0, 40, 40, 120, "pillar", "cyl"), b(26, 26, 120, 48, 48, 8, "cap", "cyl"), b(29, 28, 60, 42, 8, 40, "poster"), b(28, 40, 20, 8, 30, 34, "poster2")],
     {"pillar": slot("ceramic", 1), "cap": slot("metal", 2), "poster": slot("fabric", 1), "poster2": slot("autumn", 3)},
     "free", name="Афіша")
items[-1]["tags"] = ["festive"]

# the morning after: bags of rubbish and a broom
item("rubbish_bags", "village", 1, 1, "floor",
     [b(14, 20, 0, 34, 34, 36, "bag", "round"), b(46, 34, 0, 30, 30, 30, "bag", "round"), b(26, 56, 0, 28, 28, 26, "bag2", "round"),
      b(76, 20, 0, 4, 4, 90, "broom", "cyl"), b(70, 14, 0, 16, 16, 14, "bristle", "cone")],
     {"bag": slot("stone", 3), "bag2": slot("leaf", 0), "broom": slot("wood", 1), "bristle": slot("wood", 3)},
     "free", name="Мішки зі сміттям")
items[-1]["tags"] = ["festive"]

# the plant story: placards on the day of the protest, the geologists' drilling rig in the fields
item("protest_placards", "village", 2, 1, "floor",
     [b(30, 46, 0, 4, 4, 140, "stick", "cyl"), b(10, 44, 110, 50, 4, 36, "board"), b(120, 46, 0, 4, 4, 130, "stick", "cyl"), b(96, 44, 100, 54, 4, 36, "board2"),
      b(170, 46, 0, 4, 4, 120, "stick", "cyl"), b(150, 44, 90, 44, 4, 36, "board")],
     {"stick": slot("wood", 2), "board": slot("ceramic", 0), "board2": slot("autumn", 3)},
     "free", name="Плакати")
items[-1]["tags"] = ["festive"]
item("drill_rig", "village", 1, 1, "floor",
     [b(10, 10, 0, 80, 80, 20, "base"), b(40, 40, 20, 20, 20, 160, "mast"), b(36, 36, 176, 28, 28, 10, "mast"), b(20, 20, 20, 30, 30, 30, "engine")],
     {"base": slot("metal", 2), "mast": slot("autumn", 1), "engine": slot("metal", 0)},
     "free", name="Бурова установка")
items[-1]["tags"] = ["festive"]
