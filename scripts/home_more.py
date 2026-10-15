# Building on to the house and the animals one lives with (crates/teul-core/src/builds.rs, pets.rs).
# Run inside gen_base_content.py after growth_life.py: it adds items, stations, a fox's den in the forest, a dragon's
# egg among the finds of the summer rift, and gives the pack its `builds` and `pets`.

# ---- things -----------------------------------------------------------------------------------------------------

good("dragon_egg", "Яйце, тепле на дотик",
     [b(34, 34, 0, 32, 32, 40, "shell", "ball"), b(40, 40, 18, 8, 8, 8, "spot", "ball"), b(54, 46, 26, 6, 6, 6, "spot", "ball")],
     {"shell": slot("rift_salt", 2), "spot": slot("rift", 0)}, ("rift", "rare", "egg"))
good("pet_food", "Корм для тварин",
     [b(30, 32, 0, 40, 30, 40, "bag"), b(30, 32, 40, 40, 30, 6, "fold"), b(36, 30, 14, 28, 2, 16, "label")],
     {"bag": slot("fabric", 3), "fold": slot("fabric", 2), "label": slot("pastel", 0)}, ("pet",))

item("pet_bowl", "pets", 1, 1, "floor",
     [b(30, 30, 0, 40, 40, 12, "bowl", "cyl"), b(34, 34, 10, 32, 32, 3, "food", "cyl")],
     {"bowl": slot("pastel", 1), "food": slot("earth", 1)}, coins(15), name="Миска для улюбленця")
item("robot_dock", "pets", 1, 1, "floor",
     [b(20, 20, 0, 60, 60, 6, "base", "round"), b(40, 70, 6, 20, 10, 30, "post"), b(44, 72, 30, 12, 6, 6, "led", "cyl")],
     {"base": slot("metal", 3), "post": slot("metal", 2), "led": slot("pastel", 3)}, coins(60), name="Зарядна станція")
items[-1]["tags"] = ["power"]
item("dragon_nest", "pets", 1, 1, "floor",
     [b(16, 16, 0, 68, 68, 14, "straw", "round"), b(26, 26, 10, 48, 48, 6, "coins", "round"), b(40, 40, 12, 8, 8, 4, "glint", "cyl")],
     {"straw": slot("wood", 5), "coins": slot("metal", 1), "glint": slot("pastel", 3)}, coins(45), name="Гніздо на теплій соломі")
# stairs: a doorway with steps going up (upstairs, the attic) or down (the cellar)
_stairs = [b(24, 0, 0, 14, 14, 176, "frame"), b(162, 0, 0, 14, 14, 176, "frame"), b(20, 0, 164, 160, 16, 18, "frame")]
for _k in range(6):
    _stairs.append(b(40, 4 + _k * 2, _k * 26, 120, 10, 12, "step"))
item("stairs_up", "openings", 2, 1, "wall", _stairs, {"frame": slot("wood", 4), "step": slot("wood", 1)}, coins(90), ["enter"], name="Сходи")
items[-1]["tags"] = ["door"]

# what a building site has standing about (only to look at)
item("brick_stack", "village", 1, 1, "floor",
     [b(14, 20, 0, 72, 60, 14, "brick"), b(18, 24, 14, 64, 52, 14, "brick2"), b(22, 28, 28, 56, 44, 14, "brick")],
     {"brick": slot("earth", 1), "brick2": slot("earth", 3)}, "free", name="Стос цегли")
item("fox_den", "village", 1, 1, "floor",
     [b(10, 20, 0, 80, 70, 30, "earth", "round"), b(34, 64, 4, 32, 14, 20, "hole", "round"), b(18, 26, 26, 30, 24, 10, "moss", "round")],
     {"earth": slot("earth", 1), "hole": slot("earth", 2), "moss": slot("leaf", 2)}, "free", name="Лисяча нора")

for _it in items:
    ITEM.setdefault(_it["id"], _it)

# ---- stations ---------------------------------------------------------------------------------------------------
stations.append({"id": "st.vet.pet_food", "location": "vet_in", "prop": "reception_desk", "label": "Купити корм для тварин",
                 "text": "Ветеринарка насипає корм у паперовий пакет: «Цього вистачить надовго».", "kind": "buy", "needs": [], "cost": 6,
                 "gives": [["pet_food", 1]], "earn": 0, "per_day": 3, "seasons": [], "spent": "Корму на сьогодні більше немає.", "hours": [8, 18]})

# ---- the fox's den in the forest (somewhere quiet, on grass, away from everything) ------------------------------
_forest = next(l for l in locations if l["id"] == "forest")
_taken = set()
for _p in _forest["props"]:
    _it = ITEM.get(_p["item"])
    _fw, _fd = (_it["footprint"]["w"], _it["footprint"]["d"]) if _it else (1, 1)
    if _p.get("rot", 0) % 2:
        _fw, _fd = _fd, _fw
    if _it and _it.get("layer") == "wall":
        _fw, _fd = 1, 1
    for _i in range(_fw):
        for _j in range(_fd):
            _taken.add((_p["x"] + _i, _p["y"] + _j))
for _st in _forest.get("sites", []):
    for _i in range(_st.get("w", 1)):
        for _j in range(_st.get("h", 1)):
            _taken.add((_st["x"] + _i, _st["y"] + _j))
_grassy = {k for k, v in _forest["legend"].items() if v in ("floor.grass", "floor.meadow", "floor.moss")}
_den = None
for _r in range(0, 60):
    for _dx in range(-_r, _r + 1):
        for _dy in (-_r, _r):
            for (_x, _y) in ((_forest["w"] // 2 + _dx, _forest["h"] // 2 + _dy), (_forest["w"] // 2 + _dy, _forest["h"] // 2 + _dx)):
                if _den or not (2 <= _x < _forest["w"] - 2 and 2 <= _y < _forest["h"] - 2):
                    continue
                if _forest["tiles"][_y][_x] not in _grassy:
                    continue
                if any((_x + i, _y + j) in _taken for i in range(-2, 3) for j in range(-2, 3)):
                    continue
                if any(_forest["tiles"][_y + j][_x + i] not in _grassy for i in range(-1, 2) for j in range(-1, 2)):
                    continue
                _den = (_x, _y)
    if _den:
        break
assert _den, "no quiet spot for the fox's den"
_forest["props"].append({"item": "fox_den", "x": _den[0], "y": _den[1]})

# ---- a dragon's egg among the bones of the salt sea (the summer rift) ---------------------------------------------
_summer = next(l for l in locations if l["id"] == "rift_summer")
for _s in _summer["spots"]:
    if _s["id"] == "rift_summer.bones.0":
        _s["gives"].append({"item": "dragon_egg", "weight": 3})

# ---- the animals ---------------------------------------------------------------------------------------------------
PETS = [
    {"id": "turtle", "name": "Черепаха", "kind": 4, "source": "shelter", "location": "vet_in", "price": 80,
     "food": ["pet_food", "#veg", "#fruit", "#berry"],
     "text": "Стара спокійна черепаха шукає дім. Любить воду, тепло й неспішність."},
    {"id": "fox", "name": "Лисиця", "kind": 5, "source": "fox", "location": "forest", "price": 0,
     "food": ["pet_food", "#fish", "#food"],
     "text": "Руда лисиця з нори в лісі. Довіряє не одразу — треба кілька разів залишити їй поїсти."},
    {"id": "robot", "name": "Робот-помічник", "kind": 6, "source": "tech", "location": "post_in", "price": 340, "from_day": 45,
     "food": [],
     "text": "Маленький домашній робот. Заряджається від розетки, пищить, коли радий, і часом потребує викрутки."},
    {"id": "dragon", "name": "Маленький дракон", "kind": 7, "source": "egg", "price": 0,
     "food": ["pet_food", "#fish", "#food"],
     "text": "Із теплого яйця, знайденого за розломом. Спить на монетках і гріє кімнату."},
]

# ---- rooms the builders build on ---------------------------------------------------------------------------------
_DOOR = ["door_basic"]
BUILDS = [
    {"id": "build.kitchen", "name": "Кухня", "kind": "room", "w": 6, "d": 6, "price": 650, "days": 3, "floor": "floor.checker", "wall": "wall.cream", "plan": "kitchen",
     "items": _DOOR + ["fridge", "counter", "stove", "counter_sink", "counter_drawers", "kettle", "round_dining", "dining_chair_wood", "dining_chair_wood", "wall_cabinet", "window_basic"],
     "text": "Плита, холодильник, робоча стіна з шафками й круглий стіл біля вікна."},
    {"id": "build.bedroom", "name": "Спальня", "kind": "room", "w": 6, "d": 5, "price": 600, "days": 3, "floor": "floor.carpet_rose", "wall": "wall.stripe_rose", "plan": "bedroom",
     "items": _DOOR + ["bed", "nightstand", "nightstand", "table_lamp", "table_lamp", "rug_small", "wardrobe", "window_basic"],
     "text": "Ліжко з тумбочками й лампами, шафа, килимок."},
    {"id": "build.bath", "name": "Ванна кімната", "kind": "room", "w": 5, "d": 5, "price": 550, "days": 3, "floor": "floor.slate", "wall": "wall.dots", "plan": "bath",
     "items": _DOOR + ["bathtub", "toilet", "bath_mat", "washbasin", "mirror", "towel_rail"],
     "text": "Ванна, умивальник із дзеркалом, рушник на гарячій трубі."},
    {"id": "build.workshop", "name": "Майстерня", "kind": "room", "w": 6, "d": 5, "price": 700, "days": 4, "floor": "floor.pine", "wall": "wall.brick", "plan": "workshop",
     "items": _DOOR + ["home_workbench", "chest", "bookshelf", "floor_lamp", "window_basic"],
     "text": "Верстак під вікном, скриня для матеріалів, полиці для інструментів."},
    {"id": "build.music", "name": "Музична кімната", "kind": "room", "w": 6, "d": 6, "price": 900, "days": 4, "floor": "floor.herring", "wall": "wall.panel_oak", "plan": "music",
     "items": _DOOR + ["piano", "gramophone", "armchair", "rug_round", "floor_lamp", "window_round"],
     "text": "Дубові панелі для доброго звуку, місце для піаніно й крісло, щоб слухати."},
    {"id": "build.attic", "name": "Горище", "kind": "attic", "w": 7, "d": 5, "price": 550, "days": 3, "floor": "floor.ash", "wall": "wall.panel_oak", "plan": "attic",
     "items": ["stairs_up", "rocking_chair", "chest", "futon", "string_lights", "window_round"],
     "text": "Під самим дахом: гойдалка, стара скриня, розкладний матрац і гірлянда."},
    {"id": "build.cellar", "name": "Льох", "kind": "cellar", "w": 5, "d": 5, "price": 450, "days": 3, "floor": "floor.slate", "wall": "wall.brick", "plan": "cellar",
     "items": ["stairs_up", "chest", "chest", "bookshelf", "lantern"],
     "text": "Прохолодний кам'яний льох для припасів і старих речей."},
    {"id": "build.upstairs", "name": "Другий поверх", "kind": "upstairs", "w": 8, "d": 6, "price": 1400, "days": 6, "floor": "floor.oak", "wall": "wall.sage", "plan": "upstairs",
     "items": ["stairs_up", "desk", "office_chair", "bed_single", "bookshelf", "toy_box", "rug_round", "floor_lamp", "window_basic", "window_basic"],
     "text": "Сходи нагору, світлий кабінет і ще одна спальня — для гостей чи дитячої."},
    {"id": "build.terrace", "name": "Тераса", "kind": "terrace", "w": 6, "d": 4, "price": 400, "days": 2, "floor": "floor.deck", "plan": "terrace",
     "items": ["door_garden", "sun_lounger", "picnic_table", "string_lights", "bbq_grill"],
     "text": "Дерев'яний настил під небом: лежак, стіл для вечері надворі, гриль."},
    {"id": "build.yard", "name": "Подвір'я", "kind": "garden", "w": 8, "d": 8, "price": 500, "days": 2, "floor": "floor.grass", "plan": "yard",
     "items": ["door_garden", "tree_apple", "swing", "sandbox", "garden_bench", "bush_round", "hammock"],
     "text": "Своє подвір'я з яблунею, гойдалкою й пісочницею."},
]
