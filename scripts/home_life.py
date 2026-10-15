# Living at home (docs/world-economy.md §8): dishes cooked at the stove from what one carries or keeps in the
# fridge, the monthly bills for garbage, water, electricity and gas (paid at the utility office), which things at
# home need which utility, and a fuller, cosier house kit. Run inside gen_base_content.py after economy.py
# (it needs `good`, `b`, `slot`, `items`).
#
# Rules kept: cooking only turns food into food (nothing from nothing, nothing earns at home); texts Ukrainian.


def plate(id, name, food, food_slots, tags=("food", "dish"), dish=("ceramic", 0)):
    """A dish on a plate: the plate and what is on it."""
    good(id, name, [b(20, 20, 0, 60, 60, 6, "plate", "cyl"), b(24, 24, 6, 52, 52, 2, "rim", "cyl")] + food,
         {"plate": slot(*dish), "rim": slot("ceramic", 1), **food_slots}, tags)


def bowl(id, name, soup, extra=(), extra_slots=None, tags=("food", "dish")):
    """A soup in a bowl, steaming."""
    good(id, name, [b(24, 24, 0, 52, 52, 24, "bowl", "cyl"), b(28, 28, 20, 44, 44, 4, "soup", "cyl"), b(46, 30, 26, 8, 22, 4, "spoon")] + list(extra),
         {"bowl": slot("ceramic", 0), "soup": slot(*soup), "spoon": slot("metal", 0), **(extra_slots or {})}, tags)


# ---- dishes -----------------------------------------------------------------------------------------------------
plate("omelette", "Омлет", [b(28, 30, 6, 44, 38, 8, "egg", "round"), b(40, 40, 12, 10, 10, 3, "yolk", "round"), b(54, 36, 12, 6, 6, 2, "herb", "round")],
      {"egg": slot("fabric", 2), "yolk": slot("autumn", 1), "herb": slot("leaf", 1)})
plate("pancakes", "Млинці зі сметаною", [b(28, 30, 6, 44, 40, 4, "pancake", "round"), b(30, 32, 10, 40, 36, 4, "pancake", "round"), b(32, 34, 14, 36, 32, 4, "pancake", "round"), b(42, 42, 18, 14, 12, 6, "cream", "ball")],
      {"pancake": slot("autumn", 3), "cream": slot("ceramic", 0)})
plate("baked_potato", "Печена картопля", [b(26, 34, 6, 20, 16, 14, "potato", "ball"), b(48, 30, 6, 22, 18, 15, "potato", "ball"), b(38, 50, 6, 18, 15, 13, "potato", "ball"), b(40, 36, 20, 8, 6, 3, "butter")],
      {"potato": slot("autumn", 3), "butter": slot("fabric", 2)})
plate("syrnyky", "Сирники", [b(26 + i * 16, 32 + (i % 2) * 14, 6, 16, 16, 8, "cake", "cyl") for i in range(3)] + [b(34, 54, 6, 16, 10, 4, "jam", "round")],
      {"cake": slot("autumn", 1), "jam": slot("fabric", 1)})
plate("varenyky", "Вареники з картоплею", [b(24 + (i % 3) * 17, 30 + (i // 3) * 18, 6, 16, 12, 8, "dumpling", "round") for i in range(5)] + [b(40, 40, 14, 12, 10, 4, "onion", "round")],
      {"dumpling": slot("ceramic", 1), "onion": slot("autumn", 0)})
plate("honey_cake", "Медовик", [b(30, 30, 6, 40, 40, 30, "cake", "box"), b(30, 30, 14, 40, 40, 2, "cream"), b(30, 30, 24, 40, 40, 2, "cream"), b(30, 30, 36, 40, 40, 3, "top")],
      {"cake": slot("autumn", 3), "cream": slot("ceramic", 0), "top": slot("autumn", 1)})
bowl("borshch", "Борщ", ("fabric", 1), [b(40, 40, 24, 12, 10, 4, "cream", "round"), b(54, 36, 24, 6, 6, 2, "herb", "round")], {"cream": slot("ceramic", 0), "herb": slot("leaf", 1)})
bowl("fish_soup", "Юшка", ("autumn", 1), [b(36, 40, 24, 14, 8, 4, "fish", "round"), b(54, 36, 24, 6, 6, 2, "herb", "round")], {"fish": slot("ceramic", 5), "herb": slot("leaf", 1)})
bowl("mushroom_soup", "Грибна юшка", ("earth", 1), [b(36, 36, 24, 10, 10, 6, "cap", "ball"), b(50, 42, 24, 8, 8, 5, "cap", "ball")], {"cap": slot("wood", 3)})
bowl("corn_porridge", "Кукурудзяна каша", ("fabric", 2), [b(42, 42, 24, 10, 10, 3, "butter")], {"butter": slot("pastel", 3)})
good("compote", "Глечик компоту", [b(34, 34, 0, 32, 32, 40, "glass", "cyl"), b(36, 36, 36, 28, 28, 4, "drink", "cyl"), b(40, 40, 14, 10, 10, 10, "berry", "ball"), b(50, 46, 20, 8, 8, 8, "berry", "ball"), b(64, 44, 14, 8, 10, 18, "glass", "round")],
     {"glass": slot("glass", 0), "drink": slot("fabric", 1), "berry": slot("fabric", 7)}, ("food", "drink", "dish"))
good("herbal_tea", "Чай з ромашки", [b(36, 36, 0, 28, 28, 30, "cup", "cyl"), b(39, 39, 26, 22, 22, 4, "tea", "cyl"), b(62, 44, 8, 8, 10, 14, "cup", "round"), b(44, 44, 30, 8, 8, 3, "flower", "round")],
     {"cup": slot("ceramic", 0), "tea": slot("autumn", 1), "flower": slot("fabric", 2)}, ("food", "drink", "dish"))

RECIPES = [
    ("rc.omelette", "Омлет", [("eggs", 1), ("milk", 1)], ("omelette", 1), "Яйця збиті з молоком, трохи зелені — і сніданок готовий."),
    ("rc.pancakes", "Млинці зі сметаною", [("flour", 1), ("eggs", 1), ("milk", 1)], ("pancakes", 2), "Тоненькі, з мереживом по краях: перший, звісно, грудкою."),
    ("rc.baked_potato", "Печена картопля", [("potato", 2)], ("baked_potato", 1), "У духовці до золотавої шкірки, з шматочком масла."),
    ("rc.syrnyky", "Сирники", [("cheese", 1), ("eggs", 1), ("flour", 1)], ("syrnyky", 2), "Рум'яні, м'які всередині, з ложкою варення."),
    ("rc.varenyky", "Вареники з картоплею", [("flour", 1), ("potato", 1)], ("varenyky", 2), "Ліпиш, поки варяться попередні: так минає вечір."),
    ("rc.borshch", "Борщ", [("potato", 1), ("carrot", 1), ("water_jar", 1)], ("borshch", 2), "Червоний, густий, із часником — за рецептом бабусі."),
    ("rc.fish_soup", "Юшка", [("#fish", 1), ("potato", 1), ("carrot", 1)], ("fish_soup", 2), "Рибна юшка, як на березі ставка, тільки вдома."),
    ("rc.mushroom_soup", "Грибна юшка", [("porcini", 1), ("chanterelle", 1), ("potato", 1)], ("mushroom_soup", 2), "Запах лісу на всю кухню."),
    ("rc.corn_porridge", "Кукурудзяна каша", [("corn", 1), ("milk", 1)], ("corn_porridge", 1), "Мамалига з молоком і маслом — тепло зсередини."),
    ("rc.honey_cake", "Медовик", [("honey", 1), ("flour", 1), ("eggs", 1)], ("honey_cake", 1), "Коржі з медом і сметанний крем: до чаю — саме те."),
    ("rc.compote", "Компот", [("#berry", 2), ("water_jar", 1)], ("compote", 1), "Ягоди, вода і трохи цукру: літо в глечику."),
    ("rc.herbal_tea", "Чай з ромашки", [("chamomile", 1), ("water_jar", 1)], ("herbal_tea", 2), "Заварена ромашка з криниці — і можна відпочити."),
]
recipes = [{"id": rid, "name": name, "needs": [list(n) for n in needs], "gives": list(gives), "text": text} for rid, name, needs, gives, text in RECIPES]

# ---- the bills ---------------------------------------------------------------------------------------------------
# modest next to what helping the town brings (a request pays 30–60): about 70 a month, 110 in winter
BILLS = {
    "office": "utility_in", "hours": [8, 17], "due_day": 10,
    "utilities": [
        {"id": "garbage", "name": "Вивіз сміття", "monthly": 12},
        {"id": "water", "name": "Вода", "monthly": 18},
        {"id": "power", "name": "Електрика", "monthly": 24, "winter": 12},
        {"id": "gas", "name": "Газ", "monthly": 16, "winter": 28},
    ],
}

# which things at home need which utility (the core reads these tags; lights and switches need electricity)
UTILITY_TAGS = {
    "fridge": ["fridge", "power"], "stove": ["stove", "gas"],
    "counter_sink": ["water"], "washbasin": ["water"], "bathtub": ["water"], "shower": ["water"], "toilet": ["water"], "washing_machine": ["water"],
    "tv": ["power"], "wall_tv": ["power"], "radio": ["power"], "radio_vintage": ["power"], "computer": ["power"], "microwave": ["power"],
    "coffee_machine": ["power"], "kettle": ["power"], "toaster": ["power"], "record_player": ["power"], "aquarium": ["power"],
}
for it in items:
    if it["id"] in UTILITY_TAGS:
        it["tags"] = sorted(set(it.get("tags", [])) | set(UTILITY_TAGS[it["id"]]))

# ---- a fuller house: what the gift of the house brings for every room ---------------------------------------------
HOUSE_MORE = (
    # the living room: a sofa and an armchair round a low table, the television, books, a lamp, plants, pictures
    ["sofa3", "armchair", "coffee_table", "rug_big", "tv_stand", "tv", "bookshelf", "floor_lamp", "monstera", "ficus", "painting_wide", "wall_lamp", "book_stack", "vase", "window_basic"]
    # the kitchen: more counter, cupboards on the wall, the kettle, fruit on the table, herbs, a clock
    + ["counter_drawers", "wall_cabinet", "wall_cabinet", "kettle", "fruit_bowl", "herb_pots", "wall_clock", "window_basic", "plate_stack"]
    # the bedroom: a second bedside table, two lamps, a picture over the bed, a mirror, a plant, a window
    + ["nightstand", "table_lamp", "table_lamp", "painting_wide", "mirror", "fern", "window_basic", "dresser"]
    # the bathroom: a towel rail, the washing machine, a mirror, a basket, a plant
    + ["towel_rail", "washing_machine", "mirror", "laundry_basket", "snake_plant"]
    # the garden: lights along it, a second bench
    + ["lantern"]
)
