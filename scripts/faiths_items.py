# What the town's quieter places are made of: a small temple in the spirit of Buddhism (no images of the Buddha or
# of saints: a lotus, a wheel, a stupa's finial, lamps, incense, cushions on the floor, bowls of offerings), and the
# old circle in the forest (a carved wooden idol, standing stones, a fire ring that burns on the full moon, posts
# tied with ribbons). Run inside gen_base_content.py after town_things.py (it needs `item`, `b`, `slot`, `civic`).

# ---- the temple: a small hall on a stone plinth, red pillars along its porch, a roof in two tiers with turned-up
# eaves, a golden finial on top, strings of coloured flags across the front, a bell by the steps
_flags = [b(24 + k * 34, 304, 150 - abs(k - 5) * 4, 24, 2, 18, f"flag{k % 5}") for k in range(11)]
_tier = [b(110, 70, 196, 180, 150, 46, "wall"), b(90, 50, 242, 220, 190, 26, "roof", "gable"),
         b(80, 40, 248, 20, 20, 12, "gold", "ball"), b(300, 40, 248, 20, 20, 12, "gold", "ball"),
         b(80, 230, 248, 20, 20, 12, "gold", "ball"), b(300, 230, 248, 20, 20, 12, "gold", "ball")]
_finial = [b(182, 128, 268, 36, 36, 18, "gold", "cyl"), b(188, 134, 286, 24, 24, 20, "gold", "ball"), b(194, 140, 306, 12, 12, 40, "gold", "cone")]
_porch = [b(x, 282, 0, 20, 20, 120, "pillar", "cyl") for x in (24, 112, 268, 356)] + [b(10, 270, 120, 380, 46, 10, "roof"),
          b(0, 262, 126, 26, 26, 12, "gold", "ball"), b(374, 262, 126, 26, 26, 12, "gold", "ball")]
civic("temple", "Храм Тихого Лотоса", 4, 3, 120,
      [("pastel", 0), ("leaf", 3), ("autumn", 3), ("fabric", 1),
       {"pillar": slot("fabric", 1), "gold": slot("autumn", 3), "bell": slot("autumn", 3),
        "flag0": slot("fabric", 6), "flag1": slot("ceramic", 0), "flag2": slot("fabric", 1), "flag3": slot("leaf", 1), "flag4": slot("autumn", 3)}],
      _porch + _tier + _finial + _flags + [b(360, 312, 0, 8, 8, 70, "pillar", "cyl"), b(350, 304, 56, 28, 28, 26, "bell", "ball")],
      roof_h=56)
items[-1]["tags"] = []

# ---- inside the temple ----------------------------------------------------------------------------------------
# a round meditation cushion: one sits on it on the floor, cross-legged
item("zafu", "village", 1, 1, "floor",
     [b(22, 22, 0, 56, 56, 10, "cushion", "cyl"), b(24, 24, 10, 52, 52, 6, "top", "cyl"), b(46, 46, 14, 8, 8, 2, "button", "cyl")],
     {"cushion": slot("fabric", 1), "top": slot("autumn", 3), "button": slot("ceramic", 5)}, "free", ["sit"], name="Подушка для медитації")
# a woven mat to sit on, two cushions in a row
item("meditation_mat", "village", 2, 1, "floor",
     [b(4, 10, 0, 192, 80, 4, "mat"), b(10, 16, 4, 180, 68, 1, "weave"), b(28, 22, 4, 52, 52, 10, "cushion", "cyl"), b(120, 22, 4, 52, 52, 10, "cushion", "cyl")],
     {"mat": slot("wood", 3), "weave": slot("autumn", 2), "cushion": slot("leaf", 3)}, "free", ["sit"], name="Мата з подушками")
# a tatami-like straw rug for the floor of the hall
item("straw_rug", "village", 2, 2, "rug", [b(6, 6, 0, 188, 188, 2, "straw"), b(6, 6, 2, 188, 6, 1, "edge"), b(6, 188, 2, 188, 6, 1, "edge"), b(96, 6, 2, 6, 188, 1, "edge")],
     {"straw": slot("autumn", 2), "edge": slot("leaf", 3)}, "free", name="Солом'яний килимок")
# the low altar: a long lacquered table with lamps, a lotus in a bowl, a wheel standing in the middle, incense
item("temple_altar", "village", 2, 1, "floor",
     [b(10, 30, 0, 180, 60, 44, "lacquer"), b(4, 24, 44, 192, 72, 6, "top"), b(20, 40, 50, 20, 20, 16, "lamp", "cyl"), b(160, 40, 50, 20, 20, 16, "lamp", "cyl"),
      b(26, 46, 66, 8, 8, 8, "flame"), b(166, 46, 66, 8, 8, 8, "flame"), b(84, 50, 50, 32, 4, 50, "gold", "cyl"), b(92, 50, 58, 16, 4, 34, "inner", "cyl"),
      b(96, 48, 50, 8, 8, 60, "gold"), b(56, 40, 50, 22, 22, 10, "bowl", "cyl"), b(58, 42, 60, 18, 18, 10, "lotus", "ball"),
      b(126, 42, 50, 20, 20, 12, "bowl", "cyl"), b(134, 50, 62, 3, 3, 26, "stick", "cyl")],
     {"lacquer": slot("fabric", 1), "top": slot("earth", 0), "lamp": slot("autumn", 3), "flame": slot("autumn", 1), "gold": slot("autumn", 3), "inner": slot("fabric", 1),
      "bowl": slot("ceramic", 0), "lotus": slot("fabric_pink", 0), "stick": slot("earth", 1)}, "free", name="Низький вівтар")
items[-1]["tags"] = ["light"]
# the table of offerings: bowls of fruit and rice, a little cup of water, flowers (fuller on the days they are
# brought: see the town's «offerings» flag)
item("offering_table", "village", 1, 1, "floor",
     [b(14, 20, 0, 72, 60, 36, "wood"), b(10, 16, 36, 80, 68, 5, "top"), b(20, 26, 41, 24, 24, 8, "bowl", "cyl"), b(56, 26, 41, 24, 24, 8, "bowl", "cyl"),
      b(36, 50, 41, 14, 14, 10, "cup", "cyl")],
     {"wood": slot("fabric", 1), "top": slot("autumn", 3), "bowl": slot("ceramic", 0), "cup": slot("autumn", 3)}, "free", name="Столик для підношень")
item("offering_bowls", "village", 1, 1, "floor",
     [b(12, 16, 0, 76, 68, 6, "tray"), b(20, 26, 6, 24, 24, 14, "fruit", "ball"), b(24, 22, 16, 14, 14, 12, "fruit2", "ball"), b(56, 26, 6, 22, 22, 12, "rice", "ball"),
      b(40, 54, 6, 16, 16, 18, "flower", "ball"), b(62, 54, 6, 12, 12, 14, "flower2", "ball")],
     {"tray": slot("autumn", 3), "fruit": slot("autumn", 1), "fruit2": slot("leaf", 1), "rice": slot("ceramic", 0), "flower": slot("fabric_pink", 0), "flower2": slot("autumn", 3)}, "free", name="Підношення")
# a bronze urn of incense on three feet, a thread of smoke going up
item("incense_burner", "village", 1, 1, "floor",
     [b(30, 30, 0, 8, 8, 16, "bronze", "cyl"), b(62, 30, 0, 8, 8, 16, "bronze", "cyl"), b(46, 62, 0, 8, 8, 16, "bronze", "cyl"), b(24, 24, 14, 52, 52, 30, "bronze", "ball"),
      b(28, 28, 40, 44, 44, 6, "ash", "cyl"), b(44, 44, 46, 3, 3, 26, "stick", "cyl"), b(52, 48, 46, 3, 3, 22, "stick", "cyl"), b(42, 40, 72, 10, 10, 40, "smoke", "cone")],
     {"bronze": slot("autumn", 2), "ash": slot("stone", 0), "stick": slot("earth", 1), "smoke": slot("stone", 1)}, "free", name="Курильниця")
# the gong in its wooden frame, and its mallet
item("temple_gong", "village", 1, 1, "floor",
     [b(10, 40, 0, 10, 20, 130, "wood"), b(80, 40, 0, 10, 20, 130, "wood"), b(6, 40, 126, 88, 20, 10, "wood"), b(20, 46, 40, 60, 6, 70, "gong", "cyl"),
      b(44, 44, 64, 12, 3, 14, "boss", "cyl"), b(86, 60, 30, 4, 4, 40, "stick", "cyl")],
     {"wood": slot("fabric", 1), "gong": slot("autumn", 3), "boss": slot("autumn", 2), "stick": slot("wood", 3)}, "free", ["play_music"], name="Гонг")
# a row of prayer wheels on a rail: one turns them clockwise as one walks by
item("prayer_wheels", "village", 2, 1, "floor",
     [b(4, 40, 0, 192, 12, 10, "rail"), b(4, 40, 100, 192, 12, 8, "rail")] + [b(14 + k * 46, 34, 14, 34, 24, 80, "wheel", "cyl") for k in range(4)]
     + [b(14 + k * 46, 34, 40, 34, 24, 8, "band", "cyl") for k in range(4)],
     {"rail": slot("fabric", 1), "wheel": slot("autumn", 3), "band": slot("fabric", 6)}, "free", name="Молитовні барабани")
# a stone lantern in the yard and a paper lantern shaped like a lotus inside
item("lotus_lantern", "village", 1, 1, "floor",
     [b(40, 40, 0, 20, 20, 30, "stem", "cyl"), b(24, 24, 30, 52, 52, 20, "petal", "ball"), b(34, 34, 40, 32, 32, 16, "glow", "ball")],
     {"stem": slot("leaf", 3), "petal": slot("fabric_pink", 0), "glow": slot("autumn", 1)}, "free", name="Ліхтар-лотос")
items[-1]["tags"] = ["light"]
# on the walls: a wheel of eight spokes and a painted lotus on silk
item("dharma_wheel", "village", 1, 1, "wall",
     [b(20, 0, 90, 60, 4, 60, "gold", "cyl"), b(28, 2, 98, 44, 4, 44, "inner", "cyl"), b(46, 3, 98, 8, 4, 44, "gold"), b(28, 3, 116, 44, 4, 8, "gold"),
      b(44, 4, 114, 12, 4, 12, "gold", "cyl")],
     {"gold": slot("autumn", 3), "inner": slot("fabric", 1)}, "free", name="Колесо з вісьмома спицями")
item("lotus_scroll", "village", 1, 1, "wall",
     [b(30, 0, 60, 40, 3, 110, "silk"), b(26, 0, 168, 48, 5, 6, "rod", "cyl"), b(26, 0, 56, 48, 5, 6, "rod", "cyl"), b(40, 3, 100, 20, 2, 16, "lotus", "ball"),
      b(48, 3, 80, 4, 2, 22, "stem")],
     {"silk": slot("ceramic", 0), "rod": slot("fabric", 1), "lotus": slot("fabric_pink", 0), "stem": slot("leaf", 1)}, "free", name="Сувій з лотосом")

# ---- the old circle in the forest -----------------------------------------------------------------------------
# the idol: a tall pillar of oak, its four faces carved under a round cap, bands of carving down the trunk
item("forest_idol", "village", 1, 1, "floor",
     [b(34, 34, 0, 32, 32, 200, "oak"), b(30, 30, 200, 40, 40, 30, "cap", "cyl"), b(38, 38, 228, 24, 24, 14, "cap", "ball"),
      b(32, 32, 30, 36, 36, 6, "band"), b(32, 32, 90, 36, 36, 6, "band"), b(32, 32, 140, 36, 36, 6, "band"),
      b(40, 66, 160, 6, 2, 6, "eye"), b(54, 66, 160, 6, 2, 6, "eye"), b(44, 66, 146, 12, 2, 4, "eye"),
      b(66, 40, 160, 2, 6, 6, "eye"), b(66, 54, 160, 2, 6, 6, "eye"), b(36, 36, 0, 28, 28, 4, "moss")],
     {"oak": slot("wood", 2), "cap": slot("wood", 3), "band": slot("earth", 0), "eye": slot("ceramic", 5), "moss": slot("leaf", 2)}, "free", name="Дерев'яний ідол")
item("standing_stone", "village", 1, 1, "floor",
     [b(30, 36, 0, 40, 30, 110, "stone", "round"), b(34, 40, 104, 32, 22, 26, "stone", "ball"), b(30, 36, 0, 40, 30, 12, "moss")],
     {"stone": slot("stone", 2), "moss": slot("leaf", 2)}, "free", name="Камінь кола")
# the fire ring: stones round a hearth of ash and laid logs; the flames are their own thing (lit on the full moon)
item("ritual_hearth", "village", 1, 1, "floor",
     [b(8 + 84 * (k % 2), 8 + 84 * (k // 2), 0, 14, 14, 12, "stone", "ball") for k in range(4)]
     + [b(46, 6, 0, 14, 14, 12, "stone", "ball"), b(46, 84, 0, 14, 14, 12, "stone", "ball"), b(6, 46, 0, 14, 14, 12, "stone", "ball"), b(84, 46, 0, 14, 14, 12, "stone", "ball"),
        b(22, 22, 0, 56, 56, 4, "ash", "cyl"), b(28, 44, 4, 44, 10, 10, "log", "cyl"), b(44, 28, 8, 10, 44, 10, "log", "cyl")],
     {"stone": slot("stone", 1), "ash": slot("stone", 0), "log": slot("wood", 2)}, "free", name="Вогнище кола")
# the same ring with the fire burning in it: laid in its place on the full-moon nights
_hearth = next(it for it in items if it["id"] == "ritual_hearth")
item("ritual_hearth_lit", "village", 1, 1, "floor",
     _hearth["model"] + [b(30, 30, 10, 40, 40, 40, "flame", "cone"), b(38, 38, 30, 24, 24, 44, "flame2", "cone"), b(44, 44, 56, 12, 12, 26, "core", "cone")],
     {**_hearth["slots"], "flame": slot("autumn", 1), "flame2": slot("autumn", 3), "core": slot("ceramic", 0)}, "free", name="Вогонь повні")
items[-1]["tags"] = ["light"]
# a post tied with ribbons and a wreath of dried flowers: people leave one for a wish
item("ribbon_post", "village", 1, 1, "floor",
     [b(44, 44, 0, 12, 12, 140, "post", "cyl"), b(30, 30, 120, 40, 40, 10, "wreath", "cyl")]
     + [b(40 + (k % 3) * 8, 56, 70 + k * 10, 4, 2, 40, f"rib{k % 4}") for k in range(5)],
     {"post": slot("wood", 3), "wreath": slot("autumn", 2), "rib0": slot("fabric", 1), "rib1": slot("ceramic", 0), "rib2": slot("leaf", 1), "rib3": slot("autumn", 3)},
     "free", name="Стовп зі стрічками")
item("torch_stake", "village", 1, 1, "floor",
     [b(46, 46, 0, 8, 8, 120, "stake", "cyl"), b(40, 40, 120, 20, 20, 14, "head", "cyl"), b(42, 42, 134, 16, 16, 24, "flame", "cone")],
     {"stake": slot("wood", 2), "head": slot("earth", 0), "flame": slot("autumn", 1)}, "free", name="Смолоскип")
items[-1]["tags"] = ["light"]
