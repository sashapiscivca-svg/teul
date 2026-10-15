# The rifts (teul): on the equinoxes and the solstices the world cracks open for a day. Glowing cracks stand on the
# town square, in the forest by the lakes, in the field, in the cave, at the cemetery (and one in the player's
# garden, placed by the client); each rift day they open into a different world, its own place with its own light,
# beings, finds and story (crates/teul-core/src/sky.rs: RIFT_WORLDS):
#   spring equinox  — the Sunken Glasshouse: a drowned conservatory of giant flowers and drifting seeds;
#   summer solstice — the Salt Sea: white flats, dunes of glass, a mirage town that is not there;
#   autumn equinox  — the Clockwork Orchard: amber light, trees of books, pendulums in the branches;
#   winter solstice — the Town Inside Out: this very town (copied at the end of gen_base_content.py by
#                     `make_mirror_town`), seen from the other side, where other beings live the people's days.
# At midnight the rifts close (the core: Requires.days = ["rift_spring"] and so on).
# Run inside gen_base_content.py after quests.py (it uses `item`, `good`, `b`, `slot`, `style`, the maps, `quest`).

import copy as _copy
import math as _m
import random as _random

PALETTES["rift"] = ["#fff3c4", "#f6b347", "#8fa0ff", "#2a2455", "#c9cdf0", "#e86aa0", "#5ad8c8"]
PALETTES["rift_green"] = ["#c8f7dc", "#5fcf9f", "#2f8f7a", "#f7d2ec", "#ff8ab8", "#fff6b0", "#9ad8ff", "#3d6f6a"]
PALETTES["rift_salt"] = ["#fbfaf4", "#e9e3d4", "#cfe9ec", "#9fd3da", "#f2c38b", "#d98c5f", "#b9b2c9", "#fff2c8"]
PALETTES["rift_amber"] = ["#ffcf7a", "#e89a3c", "#a8582a", "#5a3322", "#f4e6c8", "#c9a24a", "#7a4b8c", "#3a2a4a"]

# ---- the floors of the other worlds ------------------------------------------------------------------------
style("floor.stardust", "floor", {"color": "#3a3070", "alt": "#2e2660", "pattern": "stones"}, acquire="free")
style("floor.otherlight", "floor", {"color": "#8a7ad0", "alt": "#a898e8", "pattern": "flat"}, acquire="free")
style("floor.glassmoss", "floor", {"color": "#5fae86", "alt": "#4d9574", "pattern": "meadow", "outdoor": "1"}, acquire="free")
style("floor.lily", "floor", {"color": "#3f9c7c", "alt": "#8fd8aa", "pattern": "stones", "outdoor": "1"}, acquire="free")
style("floor.greenwater", "floor", {"color": "#3fa3a0", "alt": "#a8eadf", "pattern": "water", "outdoor": "1"}, acquire="free")
style("floor.salt", "floor", {"color": "#f4f1e8", "alt": "#e3dccb", "pattern": "sand", "outdoor": "1"}, acquire="free")
style("floor.glassdune", "floor", {"color": "#cfe9ec", "alt": "#a6d4da", "pattern": "sand", "outdoor": "1"}, acquire="free")
style("floor.mirage", "floor", {"color": "#e8e4f2", "alt": "#d4cde6", "pattern": "flat", "outdoor": "1"}, acquire="free")
style("floor.amberleaf", "floor", {"color": "#d8913c", "alt": "#b86a2a", "pattern": "meadow", "outdoor": "1"}, acquire="free")
style("floor.pagepath", "floor", {"color": "#efe2c4", "alt": "#d6c49c", "pattern": "planks", "outdoor": "1"}, acquire="free")
style("floor.brass", "floor", {"color": "#b98a3e", "alt": "#8f6a2c", "pattern": "checker", "outdoor": "1"}, acquire="free")


def _prop_item(id, name, w, d, model, slots, glow=False):
    item(id, "village", w, d, "floor", model, slots, "free", name=name)
    items[-1]["hidden"] = True
    if glow:
        items[-1]["tags"] = ["light", "self_glow"]


# ---- the crack itself: a jagged seam of the other light standing in the air, motes around it ------------------
crack = [b(22, 30, 0, 56, 40, 2, "pool", "round")]
xs = [42, 37, 45, 39, 47, 41, 44, 38, 43]
for k, x in enumerate(xs):
    z = 6 + k * 24
    crack += [b(x, 44, z, 16, 12, 26, "light"), b(x + 4, 46, z, 8, 8, 26, "core"), b(x - 5, 45, z, 5, 10, 26, "edge"), b(x + 16, 45, z, 5, 10, 26, "edge")]
for x, y, z in [(18, 40, 60), (74, 52, 110), (26, 62, 160), (70, 34, 30), (60, 64, 200), (30, 30, 130), (80, 44, 180), (14, 56, 90)]:
    crack.append(b(x, y, z, 6, 6, 6, "mote", "ball"))
item("rift_crack", "village", 1, 1, "floor", crack,
     {"light": slot("rift", 0), "core": slot("ceramic", 0), "edge": slot("rift", 1), "mote": slot("rift", 4), "pool": slot("rift", 2)}, "free", name="Розлом")
items[-1]["hidden"] = True
items[-1]["tags"] = ["light", "self_glow", "rift"]

# the old Other Side's things stay known (saves may hold them)
_prop_item("tree_inverted", "Перевернуте дерево", 1, 1,
           [b(10, 10, 0, 80, 80, 70, "crown", "ball"), b(24, 24, 40, 52, 52, 50, "crown2", "ball"), b(44, 44, 80, 12, 12, 90, "trunk", "cyl"),
            b(30, 46, 160, 16, 6, 6, "root"), b(54, 46, 164, 18, 6, 6, "root"), b(46, 30, 168, 6, 16, 6, "root"), b(46, 54, 162, 6, 18, 6, "root")],
           {"crown": slot("rift", 2), "crown2": slot("rift", 4), "trunk": slot("wood", 5), "root": slot("wood", 5)}, glow=True)
_prop_item("isle_rock", "Летючий камінь", 1, 1,
           [b(20, 20, 0, 60, 60, 30, "rock", "round"), b(30, 30, 30, 40, 40, 20, "rock2", "round"), b(40, 40, 50, 16, 16, 10, "glow", "ball")],
           {"rock": slot("stone", 2), "rock2": slot("stone", 0), "glow": slot("rift", 6)}, glow=True)

# ---- the Sunken Glasshouse's things -------------------------------------------------------------------------
_prop_item("giant_flower", "Велетенська квітка", 1, 1,
           [b(46, 46, 0, 8, 8, 150, "stem", "cyl"), b(30, 54, 50, 22, 10, 6, "leaf", "round"), b(50, 30, 90, 10, 22, 6, "leaf", "round"),
            b(4, 4, 150, 92, 92, 18, "petal", "cyl"), b(14, 14, 162, 72, 72, 14, "petal2", "cyl"), b(36, 36, 172, 28, 28, 12, "heart", "ball")],
           {"stem": slot("rift_green", 2), "leaf": slot("rift_green", 1), "petal": slot("rift_green", 4), "petal2": slot("rift_green", 3), "heart": slot("rift_green", 5)}, glow=True)
_prop_item("giant_bud", "Бутон, більший за людину", 1, 1,
           [b(46, 46, 0, 8, 8, 90, "stem", "cyl"), b(28, 28, 80, 44, 44, 70, "bud", "ball"), b(38, 38, 140, 24, 24, 30, "tip", "cone")],
           {"stem": slot("rift_green", 2), "bud": slot("rift_green", 6), "tip": slot("rift_green", 3)}, glow=True)
_prop_item("glass_arch", "Залізна арка оранжереї", 1, 1,
           [b(4, 40, 0, 8, 20, 190, "iron"), b(88, 40, 0, 8, 20, 190, "iron"), b(4, 40, 186, 92, 20, 10, "iron"),
            b(12, 46, 20, 76, 4, 160, "glass"), b(30, 44, 190, 40, 24, 16, "iron", "round")],
           {"iron": slot("rift_green", 7), "glass": slot("rift_green", 6)})
_prop_item("broken_pane", "Розбита шибка", 1, 1,
           [b(20, 40, 0, 50, 6, 40, "glass"), b(54, 30, 0, 26, 6, 22, "glass"), b(16, 36, 0, 6, 16, 50, "iron")],
           {"glass": slot("rift_green", 6), "iron": slot("rift_green", 7)})
_prop_item("seed_puff", "Насінина, що летить", 1, 1,
           [b(42, 42, 120, 16, 16, 16, "seed", "ball"), b(30, 49, 128, 40, 2, 2, "hair"), b(49, 30, 128, 2, 40, 2, "hair"),
            b(36, 36, 132, 28, 28, 2, "hair", "cyl"), b(47, 47, 96, 6, 6, 24, "hair", "cyl")],
           {"seed": slot("rift_green", 5), "hair": slot("rift_green", 0)}, glow=True)
_prop_item("lily_pad", "Лілієвий лист", 1, 1,
           [b(4, 4, 0, 92, 92, 4, "pad", "cyl"), b(44, 44, 4, 14, 14, 10, "flower", "ball")],
           {"pad": slot("rift_green", 1), "flower": slot("rift_green", 3)})
_prop_item("fountain_vine", "Фонтан, заплетений лозою", 2, 2,
           [b(10, 10, 0, 180, 180, 30, "stone", "cyl"), b(40, 40, 30, 120, 120, 6, "water", "cyl"), b(86, 86, 30, 28, 28, 90, "stone", "cyl"),
            b(70, 70, 116, 60, 60, 20, "vine", "ball"), b(20, 80, 26, 40, 30, 12, "vine", "round"), b(140, 60, 26, 30, 50, 12, "vine", "round")],
           {"stone": slot("rift_green", 0), "water": slot("rift_green", 6), "vine": slot("rift_green", 1)}, glow=True)

# ---- the Salt Sea's things ---------------------------------------------------------------------------------
_prop_item("salt_pillar", "Соляний стовп", 1, 1,
           [b(26, 26, 0, 48, 48, 60, "salt"), b(32, 30, 60, 36, 40, 50, "salt2"), b(38, 38, 110, 24, 24, 40, "salt"), b(44, 42, 150, 12, 14, 20, "salt2", "cone")],
           {"salt": slot("rift_salt", 0), "salt2": slot("rift_salt", 1)})
_prop_item("giant_rib", "Ребро велетня", 1, 1,
           [b(40, 44, 0, 14, 14, 70, "bone", "cyl"), b(46, 44, 64, 14, 14, 50, "bone", "cyl"), b(56, 44, 108, 14, 14, 40, "bone", "cyl"), b(68, 44, 140, 14, 14, 24, "bone", "cyl")],
           {"bone": slot("rift_salt", 1)})
_prop_item("glass_cactus", "Скляний кактус", 1, 1,
           [b(40, 40, 0, 20, 20, 80, "glass", "cyl"), b(22, 44, 30, 18, 12, 10, "glass"), b(22, 44, 30, 10, 12, 34, "glass", "cyl"), b(60, 44, 44, 16, 12, 10, "glass"), b(68, 44, 44, 10, 12, 30, "glass", "cyl"),
            b(46, 46, 78, 8, 8, 8, "bloom", "ball")],
           {"glass": slot("rift_salt", 3), "bloom": slot("rift_salt", 4)}, glow=True)
_prop_item("sundial", "Сонячний годинник", 2, 2,
           [b(20, 20, 0, 160, 160, 12, "stone", "cyl"), b(96, 60, 12, 8, 80, 90, "gnomon"), b(30, 96, 12, 140, 4, 2, "mark"), b(96, 30, 12, 4, 140, 2, "mark")],
           {"stone": slot("rift_salt", 1), "gnomon": slot("rift_salt", 5), "mark": slot("rift_salt", 6)})
_prop_item("mirage_well", "Колодязь, повний неба", 1, 1,
           [b(16, 16, 0, 68, 68, 34, "stone", "cyl"), b(24, 24, 30, 52, 52, 4, "sky", "cyl"), b(16, 46, 34, 6, 8, 70, "wood"), b(78, 46, 34, 6, 8, 70, "wood"), b(16, 44, 104, 68, 12, 8, "wood")],
           {"stone": slot("rift_salt", 1), "sky": slot("rift_salt", 3), "wood": slot("rift_salt", 5)}, glow=True)

# ---- the Clockwork Orchard's things -------------------------------------------------------------------------
_prop_item("book_tree", "Дерево з книжок", 1, 1,
           [b(38, 38, 0, 24, 24, 20, "b1"), b(36, 40, 20, 28, 20, 16, "b2"), b(40, 36, 36, 20, 28, 18, "b3"), b(38, 38, 54, 24, 24, 16, "b1"),
            b(36, 40, 70, 28, 20, 18, "b2"), b(40, 38, 88, 20, 24, 14, "b3"), b(4, 4, 96, 92, 92, 70, "crown", "ball"), b(20, 20, 140, 60, 60, 40, "crown2", "ball")],
           {"b1": slot("rift_amber", 2), "b2": slot("rift_amber", 6), "b3": slot("rift_amber", 4), "crown": slot("rift_amber", 1), "crown2": slot("rift_amber", 0)})
_prop_item("pendulum_tree", "Дерево з маятником", 1, 1,
           [b(44, 44, 0, 12, 12, 150, "trunk", "cyl"), b(44, 20, 140, 12, 60, 8, "trunk"), b(48, 24, 70, 4, 4, 72, "rod"), b(36, 14, 52, 28, 28, 20, "bob", "cyl"),
            b(10, 10, 150, 80, 80, 40, "crown", "ball")],
           {"trunk": slot("rift_amber", 3), "rod": slot("rift_amber", 5), "bob": slot("rift_amber", 0), "crown": slot("rift_amber", 2)}, glow=True)
_prop_item("gear_big", "Латунна шестерня в траві", 1, 1,
           [b(10, 10, 0, 80, 80, 14, "brass", "cyl"), b(36, 36, 14, 28, 28, 6, "hub", "cyl"),
            b(44, 0, 0, 12, 10, 14, "brass"), b(44, 90, 0, 12, 10, 14, "brass"), b(0, 44, 0, 10, 12, 14, "brass"), b(90, 44, 0, 10, 12, 14, "brass")],
           {"brass": slot("rift_amber", 5), "hub": slot("rift_amber", 3)})
_prop_item("clock_tower", "Годинникова вежа без стрілок", 2, 2,
           [b(30, 30, 0, 140, 140, 220, "stone"), b(24, 24, 220, 152, 152, 20, "trim"), b(40, 40, 240, 120, 120, 60, "roof", "cone"),
            b(60, 168, 120, 80, 4, 80, "face", "round"), b(98, 170, 150, 4, 2, 30, "hand")],
           {"stone": slot("rift_amber", 3), "trim": slot("rift_amber", 5), "roof": slot("rift_amber", 6), "face": slot("rift_amber", 4), "hand": slot("rift_amber", 7)}, glow=True)
_prop_item("page_drift", "Сторінки, що падають", 1, 1,
           [b(20, 30, 110, 22, 16, 2, "page"), b(56, 50, 150, 20, 14, 2, "page"), b(36, 66, 80, 18, 14, 2, "page"), b(64, 20, 190, 16, 12, 2, "page")],
           {"page": slot("rift_amber", 4)})

# ---- what the sky leaves behind (crates/teul-core/src/sky.rs): the circle pressed into the wheat after the visitors
item("crop_circle", "village", 7, 7, "rug",
     [b(10, 10, 0, 680, 680, 3, "flat", "cyl"), b(110, 110, 0, 480, 480, 4, "ring", "cyl"), b(150, 150, 0, 400, 400, 5, "flat", "cyl"),
      b(270, 270, 0, 160, 160, 6, "ring", "cyl"), b(310, 310, 0, 80, 80, 7, "flat", "cyl"),
      b(330, 20, 0, 40, 100, 4, "flat"), b(330, 580, 0, 40, 100, 4, "flat"), b(20, 330, 0, 100, 40, 4, "flat"), b(580, 330, 0, 100, 40, 4, "flat")],
     {"flat": slot("rift_salt", 7), "ring": slot("rift_amber", 5)}, "free", name="Коло в пшениці")
items[-1]["hidden"] = True

# the map builder keeps its own index of things: make the new ones known to it
for _it in items:
    ITEM.setdefault(_it["id"], _it)

# ---- what can be found there ------------------------------------------------------------------------------------
good("rift_shard", "Уламок іншого світла",
     [b(40, 40, 0, 18, 18, 40, "shard", "cone"), b(30, 44, 0, 12, 12, 26, "shard2", "cone"), b(56, 46, 0, 10, 10, 20, "shard", "cone")],
     {"shard": slot("rift", 0), "shard2": slot("rift", 2)}, ("rift", "rare"))
good("star_flower", "Зоряна квітка, засушена",
     [b(46, 46, 0, 6, 6, 30, "stem", "cyl"), b(34, 34, 28, 30, 30, 6, "petal", "cyl"), b(44, 44, 32, 10, 10, 4, "heart", "cyl")],
     {"stem": slot("leaf", 0), "petal": slot("rift", 4), "heart": slot("rift", 0)}, ("rift", "flower"))
good("echo_note", "Записка-відлуння",
     [b(28, 34, 0, 44, 32, 3, "paper"), b(32, 38, 3, 36, 4, 1, "ink"), b(32, 46, 3, 30, 4, 1, "ink"), b(60, 56, 3, 8, 8, 2, "glow", "cyl")],
     {"paper": slot("pastel", 4), "ink": slot("rift", 3), "glow": slot("rift", 0)}, ("rift", "paper"))
good("other_lantern", "Ліхтар іншого світла",
     [b(40, 40, 0, 20, 20, 6, "frame"), b(42, 42, 6, 16, 16, 24, "light", "cyl"), b(40, 40, 30, 20, 20, 6, "frame"), b(46, 46, 36, 8, 8, 10, "ring", "cyl")],
     {"frame": slot("metal", 2), "light": slot("rift", 0), "ring": slot("metal", 0)}, ("rift", "light"))
good("glow_seed", "Насінина, що світиться",
     [b(40, 40, 0, 20, 26, 20, "seed", "ball"), b(46, 50, 18, 6, 6, 14, "sprout", "cyl"), b(38, 44, 30, 10, 6, 4, "sprout", "round")],
     {"seed": slot("rift_green", 5), "sprout": slot("rift_green", 1)}, ("rift", "flower"))
good("mirage_glass", "Скельце з міражем",
     [b(30, 30, 0, 40, 40, 6, "glass", "round"), b(38, 38, 6, 24, 24, 2, "sky", "round")],
     {"glass": slot("rift_salt", 2), "sky": slot("rift_salt", 3)}, ("rift", "rare"))
good("brass_gear", "Латунна шестерня",
     [b(28, 28, 0, 44, 44, 8, "brass", "cyl"), b(42, 42, 8, 16, 16, 4, "hub", "cyl"), b(46, 20, 0, 8, 8, 8, "brass"), b(46, 72, 0, 8, 8, 8, "brass")],
     {"brass": slot("rift_amber", 5), "hub": slot("rift_amber", 3)}, ("rift", "metal"))
good("future_page", "Сторінка з майбутнього",
     [b(26, 30, 0, 48, 38, 2, "page"), b(30, 36, 2, 38, 3, 1, "ink"), b(30, 44, 2, 30, 3, 1, "ink"), b(30, 52, 2, 34, 3, 1, "ink")],
     {"page": slot("rift_amber", 4), "ink": slot("rift_amber", 7)}, ("rift", "paper"))
good("upward_snow", "Сніжинка, що падає вгору (у банці)",
     [b(34, 34, 0, 32, 32, 40, "jar", "cyl"), b(32, 32, 40, 36, 36, 6, "lid", "cyl"), b(46, 46, 22, 8, 8, 8, "flake", "ball")],
     {"jar": slot("rift", 4), "lid": slot("metal", 2), "flake": slot("rift", 0)}, ("rift", "rare"))

for _it in items:
    ITEM.setdefault(_it["id"], _it)


def _world(m, hint):
    loc = m.build()
    loc["requires"] = {"days": [m.id], "hint": hint}
    locations.append(loc)
    return loc


# ---- spring: the Sunken Glasshouse -----------------------------------------------------------------------------
SG = Map("rift_spring", "Затонула оранжерея", 56, 44, ".", {".": "void", "f": "floor.glassmoss", "l": "floor.lily", "w": "floor.greenwater", "p": "floor.otherlight"})
rng_sg = _random.Random(2031)
SG.ellipse(28, 22, 26, 20, "f")
for cx, cy, rx, ry in [(14, 13, 7, 5), (41, 13, 7, 5), (13, 31, 6, 4), (42, 31, 7, 5)]:
    SG.ellipse(cx, cy, rx, ry, "w")
for pts in [[(28, 22), (14, 13)], [(28, 22), (41, 13)], [(28, 22), (13, 31)], [(28, 22), (42, 31)], [(28, 22), (28, 39)]]:
    SG.line(pts, 2, "l")
SG.ellipse(28, 22, 5, 4, "l")
SG.prop("fountain_vine", 27, 21)
SG.reserve(26, 36, 30, 40)
SG.reserved.discard((28, 38))
SG.prop("rift_crack", 28, 38)
for x, y in [(21, 15), (35, 15), (21, 29), (35, 29), (17, 22), (39, 22), (28, 12)]:
    SG.prop("glass_arch", x, y, must=False)
for x, y in [(8, 20), (47, 20), (22, 6), (34, 6), (20, 37), (37, 37), (5, 26), (50, 26), (11, 8), (45, 8)]:
    SG.prop("giant_flower", x, y, must=False)
for x, y in [(24, 25), (32, 19), (6, 16), (49, 15)]:
    SG.prop("giant_bud", x, y, must=False)
for x, y in [(14, 13), (11, 12), (16, 15), (41, 13), (44, 12), (39, 15), (13, 31), (42, 31), (45, 30)]:
    SG.prop("lily_pad", x, y, must=False, grounds={"w"})
SG.scatter(rng_sg, ["seed_puff", "broken_pane", "monstera", "fern", "giant_bud", "seed_puff"], 30, {"f"})
rift_spring = _world(SG, "Скляні двері зачинені. Кажуть, на весняне рівнодення вода відступає й видно оранжерею по той бік.")
rift_spring["spots"] = [
    {"id": "rift_spring.seeds.0", "x": 22, "y": 22, "gives": [{"item": "glow_seed", "weight": 6}, {"item": "rift_shard", "weight": 2}]},
    {"id": "rift_spring.seeds.1", "x": 34, "y": 23, "gives": [{"item": "glow_seed", "weight": 5}, {"item": "star_flower", "weight": 3}]},
    {"id": "rift_spring.flowers.0", "x": 28, "y": 9, "gives": [{"item": "star_flower", "weight": 6}, {"item": "glow_seed", "weight": 2}]},
    {"id": "rift_spring.shards.0", "x": 28, "y": 33, "gives": [{"item": "rift_shard", "weight": 6}, {"item": "glow_seed", "weight": 1}]},
]

# ---- summer: the Salt Sea and the mirage town ----------------------------------------------------------------
SS = Map("rift_summer", "Соляне море", 60, 46, ".", {".": "void", "s": "floor.salt", "d": "floor.glassdune", "m": "floor.mirage", "w": "floor.greenwater"})
rng_ss = _random.Random(2032)
SS.ellipse(30, 24, 29, 22, "s")
for cx, cy, rx, ry in [(10, 30, 7, 4), (50, 30, 8, 5), (16, 40, 6, 3), (46, 41, 6, 3), (8, 18, 4, 3), (52, 16, 4, 3)]:
    SS.ellipse(cx, cy, rx, ry, "d")
SS.ellipse(30, 10, 14, 7, "m")
SS.ellipse(30, 32, 3, 2, "w")
# the mirage town: pale houses that are not there, round a square with a well full of sky
PALE = {"wall": "#efeaf8", "roof": "#d7cde9", "trim": "#fbfaff", "stone": "#e2dcef", "door": "#c9bfe0", "glass": "#cfe9ec", "flower": "#f2c38b"}
for x, y, it in [(16, 5, "cottage_cream"), (21, 4, "house_tall_a"), (35, 4, "house_tall_b"), (40, 5, "cottage_sage")]:
    SS.prop(it, x, y, must=False, grounds={"m", "s"}, colors=PALE)
SS.prop("mirage_well", 30, 11)
SS.prop("sundial", 29, 22)
SS.reserve(28, 39, 32, 44)
SS.reserved.discard((30, 43))
SS.prop("rift_crack", 30, 43)
for x, y in [(12, 22), (14, 23), (16, 24), (18, 25)]:
    SS.prop("giant_rib", x, y, must=False)
for x, y in [(44, 22), (46, 23), (48, 24)]:
    SS.prop("giant_rib", x, y, rot=2, must=False)
SS.scatter(rng_ss, ["salt_pillar", "glass_cactus", "salt_pillar", "rocks"], 30, {"s", "d"})
rift_summer = _world(SS, "Тут лише спека. На літнє сонцестояння, кажуть, за тріщиною біліє соляне море.")
rift_summer["spots"] = [
    {"id": "rift_summer.mirage.0", "x": 30, "y": 13, "gives": [{"item": "mirage_glass", "weight": 6}, {"item": "rift_shard", "weight": 2}]},
    {"id": "rift_summer.dunes.0", "x": 50, "y": 30, "gives": [{"item": "mirage_glass", "weight": 4}, {"item": "rift_shard", "weight": 3}]},
    {"id": "rift_summer.bones.0", "x": 15, "y": 26, "gives": [{"item": "rift_shard", "weight": 6}, {"item": "mirage_glass", "weight": 1}]},
    {"id": "rift_summer.dial.0", "x": 31, "y": 25, "gives": [{"item": "rift_shard", "weight": 4}, {"item": "mirage_glass", "weight": 3}]},
]

# ---- autumn: the Clockwork Orchard -----------------------------------------------------------------------------
CO = Map("rift_autumn", "Годинниковий сад", 56, 44, ".", {".": "void", "a": "floor.amberleaf", "p": "floor.pagepath", "b": "floor.brass"})
rng_co = _random.Random(2033)
CO.ellipse(28, 22, 26, 20, "a")
for ang in range(12):
    ex = 28 + round(22 * _m.cos(ang * _m.pi / 6))
    ey = 22 + round(17 * _m.sin(ang * _m.pi / 6))
    CO.line([(28, 22), (ex, ey)], 1, "p", only={"a"})
CO.ellipse(28, 22, 13, 10, "p", only={"a"})
CO.ellipse(28, 22, 12, 9, "a", only={"p"})
for ang in range(12):
    ex = 28 + round(12 * _m.cos(ang * _m.pi / 6))
    ey = 22 + round(9 * _m.sin(ang * _m.pi / 6))
    CO.line([(28, 22), (ex, ey)], 1, "p", only={"a"})
CO.ellipse(28, 22, 4, 3, "b")
CO.prop("clock_tower", 27, 21)
CO.reserve(26, 36, 30, 40)
CO.reserved.discard((28, 38))
CO.prop("rift_crack", 28, 38)
for k in range(12):
    ang = k * _m.pi / 6 + _m.pi / 12
    CO.prop("book_tree" if k % 2 else "pendulum_tree", 28 + round(17 * _m.cos(ang)), 22 + round(13 * _m.sin(ang)), must=False)
for x, y in [(24, 18), (32, 18), (24, 26), (32, 26)]:
    CO.prop("lamp_post", x, y, must=False, colors={"bulb": "#ffcf7a"})
CO.scatter(rng_co, ["gear_big", "page_drift", "book_tree", "bookcase_tall", "pendulum_tree", "gear_big"], 36, {"a"})
rift_autumn = _world(CO, "Чути, як десь цокає годинник. На осіннє рівнодення, кажуть, за тріщиною видно сад, де з дерев падають сторінки.")
rift_autumn["spots"] = [
    {"id": "rift_autumn.pages.0", "x": 20, "y": 12, "gives": [{"item": "future_page", "weight": 6}, {"item": "brass_gear", "weight": 2}]},
    {"id": "rift_autumn.pages.1", "x": 38, "y": 32, "gives": [{"item": "future_page", "weight": 4}, {"item": "rift_shard", "weight": 2}]},
    {"id": "rift_autumn.gears.0", "x": 36, "y": 12, "gives": [{"item": "brass_gear", "weight": 6}, {"item": "rift_shard", "weight": 2}]},
    {"id": "rift_autumn.gears.1", "x": 18, "y": 30, "gives": [{"item": "brass_gear", "weight": 4}, {"item": "future_page", "weight": 2}]},
]


# ---- winter: the Town Inside Out (the town map itself, copied when it is finished) -----------------------------
def make_mirror_town():
    """The winter world: a copy of the finished town map. No doors (the houses are dark and shut), no sites, no
    animals, no fishing; its places renamed; one crack by the square as the way back. The client paints it through
    the mirror shader and fills it with other beings that keep the residents' hours."""
    village = next(l for l in locations if l["id"] == "village")
    m = _copy.deepcopy(village)
    m["id"] = "rift_winter"
    m["name"] = "Липове навиворіт"
    for k in ("animals", "fishing", "spots"):
        m.pop(k, None)
    m["exits"] = []
    m["sites"] = []
    m["places"] = [{**p, "id": f"mirror_{p['id']}", "name": f"{p['name']} (навиворіт)"} for p in village.get("places", [])]
    # no crack of this world leads further: the one by the square leads back
    m["props"] = [p for p in m["props"] if not p.get("rift")]
    sq = next((p for p in village.get("places", []) if p["id"] == "square"), None)
    taken = set()
    for p in m["props"]:
        fp = ITEM.get(p["item"], {}).get("footprint", {"w": 1, "d": 1})
        w, d = (fp["d"], fp["w"]) if p.get("rot", 0) % 2 else (fp["w"], fp["d"])
        for j in range(d):
            for i in range(w):
                taken.add((p["x"] + i, p["y"] + j))
    cx, cy = (sq["x"] + sq["w"] // 2, sq["y"] + sq["h"] + 1) if sq else tuple(village.get("entry", (5, 5)))
    spot = None
    for r in range(14):
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                x, y = cx + dx, cy + dy
                if spot or not (0 <= x < m["w"] and 0 <= y + 1 < m["h"]) or (x, y) in taken or (x, y + 1) in taken:
                    continue
                if all(m["legend"].get(m["tiles"][yy][x], "void") not in ("void", "floor.water") for yy in (y, y + 1)):
                    spot = (x, y)
    if spot:
        m["props"].append({"item": "rift_crack", "x": spot[0], "y": spot[1]})
    # the front door opens onto the town only (the client arrives by the crack)
    m.pop("entry", None)
    m["requires"] = {"days": ["rift_winter"], "hint": "У найдовшу ніч, кажуть, крізь тріщину видно наше ж Липове — тільки навиворіт."}
    # what can be found on the other side of the town
    xs = [p for p in m["places"] if p["activity"] in ("chat", "walk", "stars", "shop")][:4]
    m["spots"] = [{"id": f"rift_winter.snow.{i}", "x": p["x"] + p["w"] // 2, "y": p["y"] + p["h"] // 2,
                   "gives": [{"item": "upward_snow", "weight": 5}, {"item": "rift_shard", "weight": 3}, {"item": "echo_note", "weight": 2}]} for i, p in enumerate(xs)]
    locations.append(m)


# ---- the cracks in this world (shown only on the rift days), by the town's named places where it has them -------
def rift_at(m, x, y, place=None):
    for pl in m.places:
        if place and pl["id"] == place:
            x, y = pl["x"] + pl["w"] // 2, pl["y"] + pl["h"] + 1
    for r in range(9):
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                cx_, cy_ = x + dx, y + dy
                if m.inside(cx_, cy_) and m.grid[cy_][cx_] not in ("w", ".") and m.prop("rift_crack", cx_, cy_, must=False):
                    m.props[-1]["rift"] = True
                    return
    raise SystemExit(f"no room for a rift in {m.id} near {x},{y}")


rift_at(V, 40, 23, "square")          # the square, by the fountain
rift_at(F, 29, 21, "forest_lake")     # the forest, by the lake
rift_at(F, 108, 74, "east_lake")      # by the east lake
rift_at(P, 32, 30)                    # the middle of the field
rift_at(CAVE, 33, 11, "crystal_grotto")
rift_at(CEM, 18, 18, "cemetery")

# ---- the stories of the rifts: one for each world, on its day --------------------------------------------------
ZLATA = "res_1"
RADIO_OLEH = "res_10"
LIBRARIAN = "res_66"
VIKTORIA = "res_72"
quest("rift.ch1", "Насіння, що світиться", ZLATA, "village",
      "Баба Злата стоїть біля тріщини з порожнім вазоном. «Я все життя бачила уві сні скляний дах і квіти, вищі за дерева. Якщо це правда — принеси мені звідти щось живе».",
      [go("Ступити в розлом — в Затонулу оранжерею", "rift_spring", None, None, "Вода по кісточки, тепла. Під скляним дахом гуде, наче вулик, і пахне дощем."),
       gather("Знайти насінину, що світиться", "rift_spring", "glow_seed", "Насінина пульсує в долоні, як маленьке серце."),
       bring("Віднести насінину бабі Златі", "village", [("glow_seed", 1)], ZLATA, "Баба Злата саджає її у вазон і довго не відводить очей.")],
      "«Значить, я не вигадала. Побачимо, що з неї виросте — у мене, у цьому світі».",
      holiday("spring_equinox"), thanks(rep=3, hearts=[(ZLATA, 80)], title="Той, хто бачив тріщину"), kind="rift")
quest("rift.ch2", "Сигнал із пустелі", RADIO_OLEH, "radio_in",
      "Олег із радіо не спав усю ніч: «На порожній частоті хтось говорить. Твоїм голосом. Каже: „Я в білому місті, приходь“. Сьогодні сонцестояння — тріщини відкриті. Перевір, га?»",
      [go("Пройти в розлом — до Соляного моря", "rift_summer", None, None, "Біле до самого обрію. Під ногами хрумтить сіль, а над дюнами тремтить місто."),
       choose("Місто-міраж наближається. Що робити?", [opt("Зайти на його площу", "Будинки прозорі, як мильна бульбашка. Хтось щойно вийшов — на піску ще теплі сліди. Твої."),
                                                   opt("Стояти й дивитися здалеку", "Місто зітхає, як живе, і відпливає на крок далі.")], "rift_summer"),
       gather("Підняти скельце з міражем", "rift_summer", "mirage_glass", "У скельці видно площу, якої нема. І когось, хто махає рукою."),
       bring("Принести скельце Олегові", "radio_in", [("mirage_glass", 1)], RADIO_OLEH, "Олег прикладає скельце до приймача — і шум стихає.")],
      "«Тиша… Ти забрав(-ла) його з собою, цей голос. Може, воно й на краще».",
      holiday("summer_solstice"), thanks(rep=3, hearts=[(RADIO_OLEH, 80)]), kind="rift")
quest("rift.ch3", "Сторінка з майбутнього", LIBRARIAN, "library_in",
      "Бібліотекарка Наталія показує картку з каталогу: «Цієї книжки в нас ніколи не було. Але картка є — і підписана завтрашнім числом. Сьогодні рівнодення. Подивись там, по той бік, де ростуть книжки».",
      [go("Ступити в розлом — у Годинниковий сад", "rift_autumn", None, None, "Бурштинове світло. Кожне дерево цокає, а з гілок падають сторінки замість листя."),
       gather("Зловити сторінку з майбутнього", "rift_autumn", "future_page", "Чорнило ще вологе. Текст пишеться сам, поки ти дивишся."),
       bring("Віднести сторінку Наталії", "library_in", [("future_page", 1)], LIBRARIAN, "Наталія читає вголос — і замовкає на півслові.")],
      "«Тут про завтра. Нічого страшного — просто дощ, і хтось нарешті поверне книжку. Залишу її в каталозі під „Ще не написане“».",
      holiday("autumn_equinox"), thanks(rep=4, hearts=[(LIBRARIAN, 80)], items=["brass_gear"]), kind="rift")
quest("rift.ch4", "Липове навиворіт", VIKTORIA, "workshop_in",
      "Майстриня Вікторія крутить у пальцях уламок: «У найдовшу ніч тріщина веде в наше ж місто — тільки там живуть не люди. Без світла туди не ходять. Принеси два уламки й мед на віск — зроблю ліхтар».",
      [bring("Принести Вікторії два уламки й мед на віск", "workshop_in", [("rift_shard", 2), ("honey", 1)], VIKTORIA, "Вікторія працює мовчки. Майстерня наповнюється світлом, якого тут ніколи не було.",
             gives=[("other_lantern", 1)]),
       go("Пройти з ліхтарем у Липове навиворіт у сутінки", "rift_winter", (16, 24), None, "Сніг падає вгору. З твоїх вікон хтось визирає — з ліхтарем замість голови."),
       choose("Істота з ліхтарем замість голови зупиняється поруч і чекає.", [opt("Підняти свій ліхтар у відповідь", "Вона схиляє голову — ліхтар до ліхтаря — і йде далі твоєю вулицею, твоїм кроком."),
                                                                          opt("Стояти тихо, поки вона пройде", "Вона проходить так близько, що чутно, як у ній потріскує вогонь.")], "rift_winter"),
       gather("Зібрати сніжинку, що падає вгору", "rift_winter", "upward_snow", "Сніжинка в банці ніяк не хоче лягти на дно.")],
      "«Тепер ти знаєш, хто живе в нашому місті, коли ми не дивимося. Бережи ліхтар — і бережи Липове, з якого б боку воно не було».",
      holiday("winter_solstice"), thanks(rep=5, hearts=[(VIKTORIA, 120)], title="Хранитель розлому"), kind="rift")
