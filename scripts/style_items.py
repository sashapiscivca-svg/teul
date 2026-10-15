# How one looks and where one lives (docs/world-economy.md §11): the clothes shop and the salon (the buildings and
# what stands inside), a block of flats to rent, a sign on a house for sale, the allotments' sign, and the garments
# themselves. Run inside gen_base_content.py after home_items.py (it needs `civic`, `item`, `b`, `slot`).

# ---- the buildings -------------------------------------------------------------------------------------------

# (the shops' buildings are in shop_fronts.py)

# a two-storey block of flats: four windows a floor, a balcony with flowers, two bells by the door
flats_extra = []
for x in range(30, 480, 110):
    flats_extra += [b(x - 4, 286, 118, 54, 4, 54, "trim"), b(x, 288, 122, 46, 4, 46, "glass"), b(x - 4, 286, 30, 54, 4, 54, "trim"), b(x, 288, 34, 46, 4, 46, "glass")]
flats_extra += [b(300, 290, 110, 140, 40, 6, "balcony"), b(300, 326, 116, 140, 4, 26, "rail"), b(310, 320, 116, 120, 10, 14, "flower"),
                b(230, 284, 50, 8, 4, 8, "bell", "round"), b(230, 284, 62, 8, 4, 8, "bell", "round")]
building("flat_block", "Будинок з квартирами", 5, 3, 200, {"stone": slot("ceramic", 1), "wall": slot("pastel", 3), "roof": slot("earth", 2), "trim": slot("ceramic", 0), "door": slot("wood", 2),
                                                         "knob": slot("metal", 1), "glass": slot("glass", 1), "flower": slot("fabric", 7), "balcony": slot("ceramic", 0), "rail": slot("metal", 2),
                                                         "bell": slot("metal", 1)}, roof_h=70, extra=flats_extra)

# signs: a home to let, a home for sale, the allotments
item("sign_to_let", "village", 1, 1, "floor",
     [b(46, 46, 0, 8, 8, 80, "post", "cyl"), b(14, 44, 70, 72, 6, 40, "board"), b(22, 41, 80, 56, 2, 8, "line"), b(22, 41, 94, 40, 2, 8, "line")],
     {"post": slot("wood", 2), "board": slot("ceramic", 0), "line": slot("fabric", 6)}, "free", name="Табличка «Здається»")
item("sign_for_sale", "village", 1, 1, "floor",
     [b(46, 46, 0, 8, 8, 80, "post", "cyl"), b(14, 44, 70, 72, 6, 40, "board"), b(22, 41, 80, 56, 2, 8, "line"), b(22, 41, 94, 40, 2, 8, "line")],
     {"post": slot("wood", 2), "board": slot("fabric", 1), "line": slot("ceramic", 0)}, "free", name="Табличка «Продається»")
item("allotment_sign", "village", 1, 1, "floor",
     [b(30, 46, 0, 8, 8, 70, "post", "cyl"), b(62, 46, 0, 8, 8, 70, "post", "cyl"), b(18, 44, 60, 64, 6, 34, "board"), b(26, 41, 70, 20, 2, 14, "leaf"), b(50, 41, 70, 22, 2, 14, "carrot")],
     {"post": slot("wood", 2), "board": slot("wood", 3), "leaf": slot("leaf", 1), "carrot": slot("autumn", 0)}, "free", name="Ділянки під город")

# ---- inside the shop and the salon ---------------------------------------------------------------------------

def hanging(colors):
    out = [b(10, 40, 0, 6, 6, 120, "frame", "cyl"), b(184, 40, 0, 6, 6, 120, "frame", "cyl"), b(10, 40, 118, 180, 6, 6, "frame", "cyl")]
    for i, c in enumerate(colors):
        out.append(b(18 + i * 34, 30, 50, 28, 26, 64, c))
    return out

item("clothes_rack", "village", 2, 1, "floor", hanging(["c1", "c2", "c3", "c4", "c5"]),
     {"frame": slot("metal", 2), "c1": slot("fabric", 1), "c2": slot("fabric", 6), "c3": slot("fabric", 4), "c4": slot("fabric", 2), "c5": slot("fabric_pink", 0)}, "free", name="Вішак з одягом")
item("coat_rack_shop", "village", 2, 1, "floor", hanging(["c1", "c2", "c3", "c4"]),
     {"frame": slot("metal", 2), "c1": slot("earth", 1), "c2": slot("ceramic", 5), "c3": slot("autumn", 3), "c4": slot("fabric", 0)}, "free", name="Вішак з пальтами")
item("fitting_booth", "village", 1, 1, "floor",
     [b(4, 4, 0, 92, 92, 6, "floor"), b(4, 4, 0, 6, 92, 170, "wall"), b(90, 4, 0, 6, 92, 170, "wall"), b(4, 4, 0, 92, 6, 170, "wall"), b(4, 4, 164, 92, 92, 6, "wall"),
      b(10, 88, 20, 80, 4, 144, "curtain"), b(40, 10, 60, 20, 4, 70, "mirror")],
     {"floor": slot("wood", 1), "wall": slot("wood", 4), "curtain": slot("fabric", 3), "mirror": slot("glass", 2)}, "free", name="Примірочна")
item("tall_mirror", "village", 1, 1, "floor",
     [b(30, 40, 0, 40, 20, 8, "foot"), b(30, 44, 8, 40, 8, 160, "frame", "round"), b(34, 42, 14, 32, 4, 148, "glass")],
     {"foot": slot("wood", 2), "frame": slot("wood", 3), "glass": slot("glass", 2)}, "free", name="Велике дзеркало")
item("hat_stand", "village", 1, 1, "floor",
     [b(40, 40, 0, 20, 20, 6, "foot", "cyl"), b(46, 46, 6, 8, 8, 130, "post", "cyl"), b(24, 34, 120, 26, 26, 14, "hat1", "ball"), b(52, 40, 100, 26, 26, 14, "hat2", "ball"), b(36, 58, 80, 26, 26, 14, "hat3", "ball")],
     {"foot": slot("wood", 2), "post": slot("wood", 2), "hat1": slot("fabric", 1), "hat2": slot("autumn", 3), "hat3": slot("fabric", 6)}, "free", name="Стійка з капелюхами")
item("shoe_shelf", "village", 1, 1, "floor",
     [b(10, 30, 0, 80, 40, 100, "body"), b(14, 34, 30, 72, 34, 4, "shelf"), b(14, 34, 64, 72, 34, 4, "shelf"),
      b(16, 36, 34, 30, 24, 12, "s1"), b(52, 36, 34, 30, 24, 12, "s2"), b(16, 36, 68, 30, 24, 12, "s3"), b(52, 36, 68, 30, 24, 12, "s1")],
     {"body": slot("wood", 1), "shelf": slot("wood", 3), "s1": slot("earth", 1), "s2": slot("fabric", 2), "s3": slot("ceramic", 0)}, "free", name="Полиця з взуттям")
item("salon_chair", "village", 1, 1, "floor",
     [b(40, 40, 0, 20, 20, 30, "base", "cyl"), b(18, 22, 30, 64, 60, 14, "seat", "round"), b(18, 72, 44, 64, 12, 60, "back", "round"), b(14, 22, 44, 8, 50, 16, "arm"), b(78, 22, 44, 8, 50, 16, "arm")],
     {"base": slot("metal", 0), "seat": slot("fabric", 7), "back": slot("fabric", 7), "arm": slot("metal", 2)}, "free", ["sit"], name="Перукарське крісло")
item("salon_mirror", "village", 2, 1, "wall",
     [b(20, 0, 70, 160, 8, 110, "frame", "round"), b(28, 6, 76, 144, 2, 98, "glass"), b(20, 0, 60, 160, 14, 8, "shelf"), b(40, 4, 68, 14, 8, 20, "bottle", "cyl"), b(70, 4, 68, 10, 8, 14, "comb")],
     {"frame": slot("ceramic", 0), "glass": slot("glass", 2), "shelf": slot("ceramic", 1), "bottle": slot("fabric", 0), "comb": slot("metal", 2)}, "free", name="Дзеркало перукаря")
item("salon_sink", "village", 1, 1, "floor",
     [b(20, 40, 0, 60, 40, 60, "base"), b(16, 30, 60, 68, 60, 22, "bowl", "round"), b(46, 80, 70, 8, 8, 40, "tap", "cyl")],
     {"base": slot("ceramic", 5), "bowl": slot("ceramic", 0), "tap": slot("metal", 0)}, "free", name="Мийка для волосся")
item("hair_dryer_hood", "village", 1, 1, "floor",
     [b(40, 40, 0, 20, 20, 6, "foot", "cyl"), b(46, 46, 6, 8, 8, 110, "post", "cyl"), b(24, 30, 110, 52, 50, 40, "hood", "ball")],
     {"foot": slot("metal", 2), "post": slot("metal", 0), "hood": slot("pastel", 1)}, "free", name="Сушарка-ковпак")

# the wardrobe at home is where one changes clothes
for it in items:
    if it["id"] in ("wardrobe", "wardrobe_tall"):
        it["tags"] = sorted(set(it.get("tags", []) + ["wardrobe"]))

# ---- the garments (sold at «Льон», worn by the hero) ---------------------------------------------------------
# slot keys: top (style, colour, accent), bottom (style, colour), shoes (style, colour), acc (kind, colour)
# top styles: 0 футболка, 1 сорочка, 2 худі, 3 сукня, 4 смугаста кофта, 5 безрукавка, 6 комбінезон, 7 светр з
# візерунком, 8 піджак, 9 пальто, 10 дощовик; bottoms: 0 штани, 1 шорти, 2 спідничка, 3 широкі штани, 4 довга спідниця;
# shoes: 0 кеди, 1 черевики/чоботи, 2 сандалі; acc: 1 окуляри, 2 шарф, 3 капелюх, 4 кепка, 5 навушники, 6 бантик,
# 7 рюкзачок, 8 шапка, 9 квітка, 10 сережки
# the seasons' clothes (warmth.rs counts how warm each is): tops 11 пуховик, 12 кожух, 13 тренч, 14 вітровка,
# 15 сарафан, 16 купальник; bottoms 5 плавки; shoes 3 валянки; acc 11 сонцезахисні окуляри, 12 парасолька,
# 13 панамка, 14 вушанка; hands (a slot of its own): 1 рукавиці, 2 рукавички

GARMENTS = [
    # tops
    ("tee_white", "Біла футболка", "top", 25, [("look.top", "0"), ("look.top_color", "#e8e0c8"), ("look.top2_color", "#3a3a44")]),
    ("tee_sun", "Жовта футболка", "top", 25, [("look.top", "0"), ("look.top_color", "#f4d35e"), ("look.top2_color", "#e8e0c8")]),
    ("shirt_linen", "Лляна сорочка", "top", 40, [("look.top", "1"), ("look.top_color", "#e8e0c8"), ("look.top2_color", "#8a5a2e")]),
    ("hoodie_green", "Худі «Липове»", "top", 60, [("look.top", "2"), ("look.top_color", "#5aa469"), ("look.top2_color", "#e8e0c8")]),
    ("hoodie_plum", "Сливове худі", "top", 60, [("look.top", "2"), ("look.top_color", "#8a63c9"), ("look.top2_color", "#f4d35e")]),
    ("dress_dots", "Сукня в горошок", "top", 65, [("look.top", "3"), ("look.top_color", "#d86aa0"), ("look.top2_color", "#e8e0c8")]),
    ("dress_sky", "Блакитна сукня", "top", 65, [("look.top", "3"), ("look.top_color", "#4a8fd0"), ("look.top2_color", "#e8e0c8")]),
    ("stripes_sea", "Смугаста кофта", "top", 45, [("look.top", "4"), ("look.top_color", "#e8e0c8"), ("look.top2_color", "#4a8fd0")]),
    ("vest_brown", "Безрукавка", "top", 40, [("look.top", "5"), ("look.top_color", "#8a5a2e"), ("look.top2_color", "#e8e0c8")]),
    ("overalls_denim", "Джинсовий комбінезон", "top", 60, [("look.top", "6"), ("look.top_color", "#e8e0c8"), ("look.top2_color", "#f4d35e")]),
    ("sweater_deer", "Светр з оленями", "top", 70, [("look.top", "7"), ("look.top_color", "#d9534f"), ("look.top2_color", "#e8e0c8")]),
    ("sweater_moss", "Моховий светр", "top", 70, [("look.top", "7"), ("look.top_color", "#3f7f4a"), ("look.top2_color", "#f4d35e")]),
    ("jacket_denim", "Джинсова куртка", "top", 80, [("look.top", "8"), ("look.top_color", "#4a8fd0"), ("look.top2_color", "#e8e0c8")]),
    ("coat_winter", "Зимове пальто", "top", 120, [("look.top", "9"), ("look.top_color", "#2f3a5a"), ("look.top2_color", "#e8a23a")]),
    ("coat_wool", "Вовняне пальто", "top", 110, [("look.top", "9"), ("look.top_color", "#8a5a2e"), ("look.top2_color", "#e8e0c8")]),
    ("coat_camel", "Пальто кольору карамелі", "top", 115, [("look.top", "9"), ("look.top_color", "#c9a050"), ("look.top2_color", "#3a3a44")]),
    ("raincoat_yellow", "Жовтий дощовик", "top", 70, [("look.top", "10"), ("look.top_color", "#f4d35e"), ("look.top2_color", "#2f3a5a")]),
    ("raincoat_red", "Червоний дощовик", "top", 70, [("look.top", "10"), ("look.top_color", "#d9534f"), ("look.top2_color", "#e8e0c8")]),
    # bottoms
    ("jeans", "Джинси", "bottom", 45, [("look.bottom", "0"), ("look.bottom_color", "#2f3a5a")]),
    ("trousers_grey", "Сірі штани", "bottom", 45, [("look.bottom", "0"), ("look.bottom_color", "#3a3a44")]),
    ("shorts_khaki", "Шорти", "bottom", 30, [("look.bottom", "1"), ("look.bottom_color", "#8a5a2e")]),
    ("skirt_rose", "Рожева спідничка", "bottom", 40, [("look.bottom", "2"), ("look.bottom_color", "#d86aa0")]),
    ("wide_trousers", "Широкі штани", "bottom", 55, [("look.bottom", "3"), ("look.bottom_color", "#e8e0c8")]),
    ("long_skirt", "Довга спідниця", "bottom", 55, [("look.bottom", "4"), ("look.bottom_color", "#5aa469")]),
    # shoes
    ("sneakers_white", "Білі кеди", "shoes", 35, [("look.shoe", "0"), ("look.shoes_color", "#e8e0c8")]),
    ("sneakers_red", "Червоні кеди", "shoes", 35, [("look.shoe", "0"), ("look.shoes_color", "#d9534f")]),
    ("rubber_boots", "Гумові чоботи", "shoes", 45, [("look.shoe", "1"), ("look.shoes_color", "#f4d35e")]),
    ("leather_boots", "Шкіряні черевики", "shoes", 60, [("look.shoe", "1"), ("look.shoes_color", "#5a3a28")]),
    ("sandals", "Сандалі", "shoes", 30, [("look.shoe", "2"), ("look.shoes_color", "#8a5a2e")]),
    # accessories
    ("scarf_red", "Червоний шарф", "acc", 20, [("look.acc", "2"), ("look.acc_color", "#d9534f")]),
    ("scarf_mustard", "Гірчичний шарф", "acc", 20, [("look.acc", "2"), ("look.acc_color", "#e8a23a")]),
    ("beanie_blue", "Синя шапка з помпоном", "acc", 25, [("look.acc", "8"), ("look.acc_color", "#4a8fd0")]),
    ("beanie_red", "Червона шапка з помпоном", "acc", 25, [("look.acc", "8"), ("look.acc_color", "#d9534f")]),
    ("straw_hat", "Солом'яний капелюх", "acc", 35, [("look.acc", "3"), ("look.acc_color", "#d9534f")]),
    ("cap_navy", "Кепка", "acc", 20, [("look.acc", "4"), ("look.acc_color", "#2f3a5a")]),
    ("glasses_round", "Круглі окуляри", "acc", 40, [("look.acc", "1"), ("look.acc_color", "#3a3a44")]),
    ("headphones", "Навушники", "acc", 50, [("look.acc", "5"), ("look.acc_color", "#8a63c9")]),
    ("bow_pink", "Бантик", "acc", 15, [("look.acc", "6"), ("look.acc_color", "#d86aa0")]),
    ("earrings_gold", "Сережки", "acc", 30, [("look.acc", "10"), ("look.acc_color", "#f4d35e")]),
    # ---- spring: light jackets and trenches, rubber boots, an umbrella
    ("windbreaker_mint", "М'ятна вітровка", "top", 60, [("look.top", "14"), ("look.top_color", "#7ac9a8"), ("look.top2_color", "#e8e0c8")]),
    ("windbreaker_lemon", "Лимонна вітровка", "top", 60, [("look.top", "14"), ("look.top_color", "#f4d35e"), ("look.top2_color", "#2f3a5a")]),
    ("trench_beige", "Бежевий тренч", "top", 110, [("look.top", "13"), ("look.top_color", "#c9a878"), ("look.top2_color", "#5a3a28")]),
    ("trench_navy", "Темно-синій тренч", "top", 110, [("look.top", "13"), ("look.top_color", "#2f3a5a"), ("look.top2_color", "#c9a050")]),
    ("rubber_boots_blue", "Сині гумові чоботи", "shoes", 45, [("look.shoe", "1"), ("look.shoes_color", "#4a8fd0")]),
    ("umbrella_red", "Червона парасолька", "acc", 40, [("look.acc", "12"), ("look.acc_color", "#d9534f")]),
    ("umbrella_dots", "Парасолька в горошок", "acc", 40, [("look.acc", "12"), ("look.acc_color", "#4a8fd0")]),
    # ---- summer: sundresses, shorts, swimwear, panamas, dark glasses
    ("sundress_lemon", "Сарафан з лимонами", "top", 55, [("look.top", "15"), ("look.top_color", "#f4d35e"), ("look.top2_color", "#5aa469")]),
    ("sundress_mint", "М'ятний сарафан", "top", 55, [("look.top", "15"), ("look.top_color", "#7ac9a8"), ("look.top2_color", "#e8e0c8")]),
    ("tee_linden", "Футболка з липою", "top", 30, [("look.top", "0"), ("look.top_color", "#5aa469"), ("look.top2_color", "#f4d35e")]),
    ("swimsuit_dots", "Купальник у горошок", "top", 45, [("look.top", "16"), ("look.top_color", "#d9534f"), ("look.top2_color", "#e8e0c8")]),
    ("swimsuit_sea", "Морський купальник", "top", 45, [("look.top", "16"), ("look.top_color", "#4a8fd0"), ("look.top2_color", "#e8e0c8")]),
    ("swim_shorts", "Плавки-шорти", "bottom", 30, [("look.bottom", "5"), ("look.bottom_color", "#4a8fd0")]),
    ("swim_shorts_palm", "Плавки з пальмами", "bottom", 30, [("look.bottom", "5"), ("look.bottom_color", "#e8a23a")]),
    ("denim_shorts", "Джинсові шорти", "bottom", 35, [("look.bottom", "1"), ("look.bottom_color", "#4a8fd0")]),
    ("flipflops", "В'єтнамки", "shoes", 15, [("look.shoe", "2"), ("look.shoes_color", "#4a8fd0")]),
    ("panama_white", "Біла панамка", "acc", 25, [("look.acc", "13"), ("look.acc_color", "#e8e0c8")]),
    ("panama_khaki", "Панамка кольору хакі", "acc", 25, [("look.acc", "13"), ("look.acc_color", "#8a8a5a")]),
    ("sunglasses", "Сонцезахисні окуляри", "acc", 45, [("look.acc", "11"), ("look.acc_color", "#2a2438")]),
    # ---- autumn: a jumper with a collar, a checked scarf, warm boots
    ("sweater_grey", "Сірий светр з горлом", "top", 70, [("look.top", "7"), ("look.top_color", "#8a8a96"), ("look.top2_color", "#e8e0c8")]),
    ("scarf_check", "Картатий шарф", "acc", 25, [("look.acc", "2"), ("look.acc_color", "#8a5a2e")]),
    ("boots_autumn", "Осінні черевики", "shoes", 55, [("look.shoe", "1"), ("look.shoes_color", "#8a5a2e")]),
    # ---- winter: down coats, a sheepskin, felt boots, an ear-flap hat, mittens and gloves
    ("puffer_red", "Червоний пуховик", "top", 150, [("look.top", "11"), ("look.top_color", "#d9534f"), ("look.top2_color", "#e8e0c8")]),
    ("puffer_black", "Чорний пуховик", "top", 150, [("look.top", "11"), ("look.top_color", "#2e2a36"), ("look.top2_color", "#c9a050")]),
    ("puffer_lilac", "Бузковий пуховик", "top", 150, [("look.top", "11"), ("look.top_color", "#a888d0"), ("look.top2_color", "#e8e0c8")]),
    ("sheepskin", "Кожух", "top", 180, [("look.top", "12"), ("look.top_color", "#8a5a2e"), ("look.top2_color", "#f2ead8")]),
    ("felt_boots", "Валянки", "shoes", 60, [("look.shoe", "3"), ("look.shoes_color", "#8a8a96")]),
    ("felt_boots_red", "Червоні валянки", "shoes", 65, [("look.shoe", "3"), ("look.shoes_color", "#b0443f")]),
    ("earflap_hat", "Шапка-вушанка", "acc", 40, [("look.acc", "14"), ("look.acc_color", "#5a3a28")]),
    ("mittens_deer", "Рукавиці з оленями", "hands", 25, [("look.mitt", "1"), ("look.mitt_color", "#d9534f")]),
    ("mittens_grey", "Сірі рукавиці", "hands", 20, [("look.mitt", "1"), ("look.mitt_color", "#8a8a96")]),
    ("gloves_leather", "Шкіряні рукавички", "hands", 35, [("look.mitt", "2"), ("look.mitt_color", "#3a2a20")]),
]

# the colours of cloth: every colour a garment comes in
PALETTES["cloth"] = sorted({v for _, _, _, _, sets in GARMENTS for k, v in sets if k.endswith("_color")} | {"#e8e0c8"})

for gid, name, slot_name, price, sets in GARMENTS:
    colour = dict(sets).get(f"look.{'top' if slot_name == 'top' else 'bottom' if slot_name == 'bottom' else 'shoes' if slot_name == 'shoes' else 'mitt' if slot_name == 'hands' else 'acc'}_color", "#e8e0c8")
    items.append({
        "id": f"wear.{gid}",
        "name": name,
        "category": "clothes",
        "tags": ["clothes", slot_name],
        "footprint": {"w": 1, "d": 1},
        "layer": "surface",
        # folded on a shelf: a little stack of cloth
        "model": [{"box": [20, 30, 0, 60, 40, 10], "slot": "cloth"}, {"box": [24, 34, 10, 52, 32, 8], "slot": "cloth"}],
        "slots": {"cloth": {"default": colour, "palette": "cloth"}},
        "acquire": {"coins": price},
        "hidden": True,
        "unique": True,
        "wear": {"slot": slot_name, "set": [list(kv) for kv in sets]},
    })
