# The daily rhythm in content: things found in the world, fish, collections, where to gather and fish, what
# people ask for, their letters, the village paper and Yarynka's story. Run inside gen_base_content.py after
# world_maps.py and village_people.py (it adds spots and fishing to the maps and fields to the people).

import random

SP, SU, AU, WI = "Spring", "Summer", "Autumn", "Winter"


def found(id, name, category, model, slots, tags=()):
    item(id, category, 1, 1, "surface", model, slots, "free", name=name)
    items[-1]["hidden"] = True
    if tags:
        items[-1]["tags"] = list(tags)


def ball_thing(id, name, color, size=26, stem=None, leaf=None, tags=(), category="nature"):
    m = [b(50 - size // 2, 50 - size // 2, 0, size, size, size, "body", "ball")]
    s = {"body": slot(*color)}
    if stem:
        m.append(b(48, 48, size - 4, 4, 4, 10, "stem", "cyl"))
        s["stem"] = slot(*stem)
    if leaf:
        m.append(b(52, 46, size + 2, 12, 6, 4, "leaf", "round"))
        s["leaf"] = slot(*leaf)
    found(id, name, category, m, s, tags)


# ---- things found -------------------------------------------------------------------------------------------
ball_thing("apple", "Яблуко", ("fabric", 1), 26, ("wood", 2), ("leaf", 1), ("fruit",))
ball_thing("pear", "Груша", ("autumn", 3), 24, ("wood", 2), ("leaf", 1), ("fruit",))
found("cherry", "Вишні", "nature", [b(34, 44, 0, 16, 16, 16, "body", "ball"), b(52, 46, 0, 16, 16, 16, "body", "ball"), b(44, 46, 14, 12, 4, 18, "stem", "round")],
      {"body": slot("fabric", 1), "stem": slot("leaf", 0)}, ("fruit",))
found("blueberry", "Чорниці", "nature", [b(24 + (i % 3) * 16, 30 + (i // 3) * 16, 0, 14, 14, 14, "body", "ball") for i in range(6)], {"body": slot("fabric", 6)}, ("berry",))
found("raspberry", "Малина", "nature", [b(28 + (i % 3) * 14, 32 + (i // 3) * 14, 0, 14, 14, 14, "body", "ball") for i in range(6)], {"body": slot("fabric", 7)}, ("berry",))
found("wild_strawberry", "Суниці", "nature", [b(26 + (i % 3) * 16, 34 + (i // 3) * 14, 0, 12, 12, 14, "body", "ball") for i in range(5)] + [b(30, 30, 0, 40, 30, 3, "leaf", "round")],
      {"body": slot("fabric", 1), "leaf": slot("leaf", 1)}, ("berry",))
found("porcini", "Білий гриб", "nature", [b(42, 42, 0, 16, 16, 22, "stem", "cyl"), b(30, 30, 18, 40, 40, 18, "cap", "ball")], {"stem": slot("ceramic", 1), "cap": slot("wood", 0)}, ("mushroom",))
found("chanterelle", "Лисички", "nature", [b(30 + i * 14, 40, 0, 10, 10, 14, "cap", "cone") for i in range(3)], {"cap": slot("autumn", 1)}, ("mushroom",))
found("fly_agaric", "Мухомор", "nature", [b(44, 44, 0, 12, 12, 24, "stem", "cyl"), b(30, 30, 20, 40, 40, 16, "cap", "ball"), b(40, 36, 32, 6, 6, 4, "dot", "ball"), b(56, 46, 32, 6, 6, 4, "dot", "ball")],
      {"stem": slot("ceramic", 0), "cap": slot("fabric", 1), "dot": slot("ceramic", 0)}, ("mushroom",))
found("morel", "Зморшок", "nature", [b(44, 44, 0, 12, 12, 14, "stem", "cyl"), b(38, 38, 12, 24, 24, 26, "cap", "cone")], {"stem": slot("ceramic", 1), "cap": slot("earth", 3)}, ("mushroom",))
for id, name, color in [("chamomile", "Ромашка", ("ceramic", 0)), ("cornflower", "Волошка", ("fabric", 6)), ("poppy", "Мак", ("fabric", 1))]:
    found(id, name, "nature", [b(48, 48, 0, 4, 4, 40, "stem", "cyl"), b(38, 38, 38, 24, 24, 8, "petal", "ball"), b(46, 46, 42, 8, 8, 6, "eye", "ball")],
          {"stem": slot("leaf", 0), "petal": slot(*color), "eye": slot("fabric", 2)}, ("flower",))
found("clover4", "Чотирилисна конюшина", "nature", [b(48, 48, 0, 4, 4, 30, "stem", "cyl")] + [b(36 + (i % 2) * 14, 36 + (i // 2) * 14, 28, 14, 14, 4, "leaf", "ball") for i in range(4)],
      {"stem": slot("leaf", 0), "leaf": slot("leaf", 1)}, ("flower", "rare"))
found("shell", "Мушля", "nature", [b(30, 34, 0, 40, 30, 16, "body", "round"), b(40, 38, 12, 20, 20, 8, "body", "ball")], {"body": slot("fabric_pink", 1)}, ("beach",))
found("pebble", "Камінчик-жабка", "nature", [b(30, 36, 0, 40, 28, 10, "body", "round")], {"body": slot("ceramic", 5)}, ("beach",))
found("amber", "Бурштин", "nature", [b(38, 38, 0, 24, 22, 18, "body", "ball")], {"body": slot("autumn", 1)}, ("beach", "rare"))
found("feather", "Пір'їна", "nature", [b(46, 20, 0, 6, 60, 4, "stem"), b(36, 26, 2, 26, 46, 3, "vane", "round")], {"stem": slot("ceramic", 1), "vane": slot("pastel", 1)}, ("beach",))
found("pine_cone", "Соснова шишка", "nature", [b(36, 36, 0, 28, 28, 34, "body", "cone")], {"body": slot("wood", 0)}, ("forest",))
found("acorn", "Жолудь", "nature", [b(40, 40, 0, 20, 20, 22, "body", "ball"), b(38, 38, 16, 24, 24, 10, "cap", "ball")], {"body": slot("wood", 3), "cap": slot("wood", 2)}, ("forest",))

FISH = [("crucian", "Карась", ("autumn", 3)), ("perch", "Окунь", ("leaf", 3)), ("roach", "Плітка", ("ceramic", 2)), ("pike", "Щука", ("leaf", 0)),
        ("carp", "Короп", ("autumn", 1)), ("trout", "Форель", ("fabric_pink", 0)), ("catfish", "Сом", ("earth", 2)), ("eel", "Вугор", ("earth", 0)),
        ("bream", "Лящ", ("ceramic", 1)), ("golden_fish", "Золота рибка", ("metal", 1))]
for id, name, color in FISH:
    found(id, name, "fish", [b(20, 40, 0, 56, 22, 18, "body", "round"), b(70, 42, 2, 16, 18, 14, "tail", "cone"), b(30, 46, 12, 6, 6, 4, "eye", "ball")],
          {"body": slot(*color), "tail": slot(*color), "eye": slot("ceramic", 5)}, ("fish",) + (("rare",) if id in ("golden_fish", "catfish") else ()))
found("crayfish", "Рак", "fish", [b(30, 40, 0, 40, 18, 14, "body", "round"), b(18, 34, 0, 16, 10, 10, "claw", "ball"), b(18, 52, 0, 16, 10, 10, "claw", "ball")],
      {"body": slot("earth", 1), "claw": slot("earth", 1)}, ("fish",))
found("old_boot", "Старий чобіт", "fish", [b(30, 36, 0, 40, 22, 14, "body", "round"), b(30, 36, 12, 16, 22, 30, "body", "round")], {"body": slot("earth", 0)}, ("junk",))
found("bottle_letter", "Лист у пляшці", "fish", [b(24, 42, 0, 48, 16, 16, "glass", "round"), b(70, 46, 4, 10, 8, 8, "cork", "cyl"), b(34, 46, 4, 26, 8, 6, "paper", "round")],
      {"glass": slot("glass", 3), "cork": slot("wood", 3), "paper": slot("pastel", 3)}, ("rare",))

COLLECTIONS = [
    ("col.orchard", "Плоди саду", ["apple", "pear", "cherry"], "fruit_bowl"),
    ("col.berries", "Лісові ягоди", ["blueberry", "raspberry", "wild_strawberry"], "herb_pots"),
    ("col.mushrooms", "Гриби", ["porcini", "chanterelle", "fly_agaric", "morel"], "terrarium"),
    ("col.meadow", "Польові квіти", ["chamomile", "cornflower", "poppy", "clover4"], "flower_box"),
    ("col.beach", "Скарби берега", ["shell", "pebble", "amber", "feather"], "globe"),
    ("col.forest", "Дари лісу", ["pine_cone", "acorn"], "lantern"),
    ("col.lake", "Риби озера", ["crucian", "perch", "roach", "pike", "carp"], "aquarium"),
    ("col.night", "Нічна рибалка", ["catfish", "eel", "crayfish", "golden_fish"], "floor_orb"),
    ("col.forest_lake", "Лісове озеро", ["trout", "bream"], "fish_bowl"),
    ("col.odd", "Дивні знахідки", ["old_boot", "bottle_letter"], "bust"),
]
collections = [{"id": i, "name": n, "items": its, "reward": r} for i, n, its, r in COLLECTIONS]


def g(item, weight=1, seasons=None, when=None):
    out = {"item": item, "weight": weight}
    if seasons:
        out["seasons"] = seasons
    if when:
        out["when"] = when
    return out


GIVES = {
    "orchard": [g("apple", 6, [SU, AU]), g("pear", 4, [AU]), g("cherry", 5, [SP, SU]), g("feather", 1)],
    "berries": [g("blueberry", 5, [SU]), g("raspberry", 4, [SU]), g("wild_strawberry", 4, [SP, SU]), g("pine_cone", 1)],
    "mushrooms": [g("porcini", 3, [SU, AU]), g("chanterelle", 5, [SU, AU]), g("fly_agaric", 2, [AU]), g("morel", 3, [SP]), g("pine_cone", 1)],
    "meadow": [g("chamomile", 5, [SP, SU]), g("cornflower", 4, [SU]), g("poppy", 4, [SP, SU]), g("clover4", 1, [SP, SU, AU]), g("feather", 1)],
    "beach": [g("shell", 6), g("pebble", 6), g("feather", 3), g("amber", 1)],
    "oak": [g("acorn", 6, [AU, WI]), g("feather", 2), g("pine_cone", 1, [SP, SU])],
    "pine": [g("pine_cone", 6), g("feather", 1)],
    "ancient": [g("acorn", 4), g("clover4", 1), g("porcini", 2, [SU, AU])],
}

WATERS = {
    "lake": [g("crucian", 6), g("perch", 6), g("roach", 5), g("carp", 3, [SU, AU]), g("pike", 2), g("catfish", 1, None, ["night"]), g("crayfish", 2, None, ["evening", "night"]),
             g("golden_fish", 1, None, ["night"]), g("old_boot", 1), g("bottle_letter", 1)],
    "river": [g("roach", 6), g("perch", 5), g("pike", 2), g("eel", 2, None, ["night", "evening"]), g("crayfish", 2, None, ["evening", "night"]), g("old_boot", 1)],
    "forest_lake": [g("trout", 5), g("bream", 4), g("crucian", 3), g("crayfish", 2), g("golden_fish", 1, None, ["night"]), g("bottle_letter", 1)],
}


def spots_for(m, rng, groups):
    """A free, walkable cell beside each chosen prop (or of each chosen ground) becomes a spot."""
    out = []
    used = set()
    def free(x, y):
        return m.inside(x, y) and (x, y) not in m.taken and m.grid[y][x] not in ("w",) and (x, y) not in used
    for kind, props, ground, count in groups:
        cands = []
        if props:
            for p in m.props:
                if p["item"] not in props:
                    continue
                fp = m.footprint(p["item"], p["x"], p["y"], p.get("rot", 0))
                for (cx, cy) in fp:
                    for dx, dy in ((0, 1), (1, 0), (-1, 0), (0, -1)):
                        if free(cx + dx, cy + dy) and (cx + dx, cy + dy) not in fp:
                            cands.append((cx + dx, cy + dy))
                            break
        if ground:
            cands += [(x, y) for y in range(m.h) for x in range(m.w) if m.grid[y][x] in ground and free(x, y)]
        rng.shuffle(cands)
        n = 0
        for (x, y) in cands:
            if n >= count or not free(x, y):
                continue
            used.add((x, y))
            out.append({"id": f"{m.id}.{kind}.{n}", "x": x, "y": y, "gives": GIVES[kind]})
            n += 1
    return out


# what people throw out: worn furniture, the cheap things more often; the workshop mends them
WORN_GIVES = [g(f"worn_{w}", n) for w, n in [("chair", 5), ("stool", 5), ("dining_chair_wood", 4), ("side_table", 4), ("nightstand", 3), ("chest", 3),
              ("floor_lamp", 3), ("radio", 3), ("coffee_table", 2), ("armchair", 2), ("bookshelf", 2), ("desk", 2), ("record_player", 1),
              ("dresser", 1), ("rocking_chair", 1), ("sofa2", 1), ("wingback", 1), ("wardrobe", 1)]]
GIVES["bin"] = WORN_GIVES
GIVES["fieldedge"] = [g("wheat_ear", 5, [SU, AU]), g("poppy", 3, [SP, SU]), g("cornflower", 3, [SU]), g("chamomile", 3, [SP, SU]), g("feather", 1)]
GIVES["dump"] = WORN_GIVES

rng = random.Random(5)
village_spots = spots_for(V, rng, [
    ("orchard", {"tree_apple"}, None, 10),
    ("meadow", None, {"m"}, 8),
    ("beach", None, {"s"}, 7),
    ("oak", {"tree_oak", "tree_maple"}, None, 5),
    ("pine", {"tree_pine"}, None, 3),
    ("bin", {"trash_bin"}, None, 40),
])
# a bin holds something only now and then; the dump more often
for sp in village_spots:
    if ".bin." in sp["id"]:
        sp["chance"] = 10
dump_spots = spots_for(D, rng, [("dump", {"trash_heap", "skip"}, None, 8)])
field_spots = spots_for(P, rng, [("fieldedge", None, {"m"}, 10)])
GIVES["crystals"] = [g("crystal_shard", 5), g("amber", 2), g("pebble", 3)]
GIVES["vines"] = [g("grapes", 6, [SU, AU]), g("feather", 1)]
vineyard_spots = spots_for(VY, rng, [("vines", {"grapevine"}, None, 10)])
cave_spots = spots_for(CAVE, rng, [("crystals", {"crystal", "stalagmite"}, None, 6)])
farm_spots = spots_for(FARM, rng, [("orchard", {"tree_apple"}, None, 6), ("meadow", None, {"g"}, 4)])
for sp in dump_spots:
    sp["chance"] = 30
forest_spots = spots_for(F, rng, [
    ("berries", {"berry_bush"}, None, 16),
    ("mushrooms", {"mushrooms", "mushroom_ring"}, None, 18),
    ("pine", {"tree_pine"}, None, 10),
    ("oak", {"tree_oak"}, None, 8),
    ("meadow", None, {"m"}, 6),
    ("ancient", {"tree_ancient"}, None, 2),
])


def shore(m, x0, y0, x1, y1):
    """The walkable cells next to water within a rectangle: where one can stand and fish."""
    cells = [(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)
             if m.inside(x, y) and m.grid[y][x] != "w" and (x, y) not in m.taken
             and any(m.at(x + dx, y + dy) == "w" for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    xs, ys = [c[0] for c in cells], [c[1] for c in cells]
    return cells, (min(xs), min(ys), max(xs) - min(xs) + 1, max(ys) - min(ys) + 1)


# the pier (its deck cells), the river under the main bridge, the forest lake's bank
_, (rx, ry, rw, rh) = shore(V, 52, 14, 62, 24)
_, (fx, fy, fw, fh) = shore(F, 24, 14, 31, 27)
village_fishing = [
    {"id": "fish.pier", "name": "Пірс", "x": PIER[0], "y": PIER[1], "w": PIER[2], "h": PIER[3], "fish": WATERS["lake"]},
    {"id": "fish.river", "name": "Берег річки", "x": rx, "y": ry, "w": rw, "h": rh, "fish": WATERS["river"]},
]
forest_fishing = [{"id": "fish.forest_lake", "name": "Лісове озеро", "x": fx, "y": fy, "w": fw, "h": fh, "fish": WATERS["forest_lake"]}]
_, (ex, ey, ew, eh) = shore(F, 108, 62, 128, 78)
forest_fishing.append({"id": "fish.east_lake", "name": "Озеро в бору", "x": ex, "y": ey, "w": ew, "h": eh, "fish": WATERS["forest_lake"]})
_, (bx, by, bw, bh) = shore(FARM, 47, 34, 63, 46)
farm_fishing = [{"id": "fish.farm_pond", "name": "Ставок на фермі", "x": bx, "y": by, "w": bw, "h": bh, "fish": WATERS["lake"]}]
for loc in locations:
    if loc["id"] == "village":
        loc["spots"], loc["fishing"] = village_spots, village_fishing
    elif loc["id"] == "forest":
        loc["spots"], loc["fishing"] = forest_spots, forest_fishing
    elif loc["id"] == "dump":
        loc["spots"] = dump_spots
    elif loc["id"] == "fields":
        loc["spots"] = field_spots
    elif loc["id"] == "cave":
        loc["spots"] = cave_spots
    elif loc["id"] == "vineyard":
        loc["spots"] = vineyard_spots
    elif loc["id"] == "farm":
        loc["spots"], loc["fishing"] = farm_spots, farm_fishing


# ---- what people ask for, write, and the story ---------------------------------------------------------------
def ask(text, items, coins=30, gift=None, thanks="Дякую! Ти найкраща сусідка… найкращий сусід. Ну, ти зрозумів… зрозуміла."):
    out = {"text": text, "items": items, "coins": coins, "thanks": thanks}
    if gift:
        out["gift"] = gift
    return out


ASKS = {
    "marta": [ask("Мені б три яблука на пиріг. Принесеш із саду?", [["apple", 3]], 45, None, "Ох, які рум'яні! Пиріг буде на всю площу."),
              ask("Хочу зварити варення. Дві жмені будь-яких ягід?", [["#berry", 2]], 40, "teapot", "Варення буде — пальчики оближеш. Тримай чайник, щоб було з чим пити."),
              ask("На юшку бракує риби. Будь-якої!", [["#fish", 1]], 35, None, "Юшка сьогодні буде королівська!")],
    "ostap": [ask("Мені потрібна пір'їна — писати, як колись.", [["feather", 1]], 30, None, "Чудове перо. Перший рядок напишу про тебе."),
              ask("Для гербарію бракує жолудя.", [["acorn", 1]], 30, None, "Жолудь — маленький дуб, що ще не знає, яким він буде."),
              ask("Красиву мушлю на полицю з книжками про море?", [["shell", 1]], 35, "book_stack", "Тепер море буде і в бібліотеці. Тримай — це тобі.")],
    "solomiia": [ask("Мені для натюрморту — три польові квітки.", [["#flower", 3]], 40, None, "Ой, які кольори! Сьогодні ж намалюю."),
                 ask("Принесеш мак? Хочу змішати з нього червоний.", [["poppy", 1]], 35, None, "Цей червоний я назву твоїм ім'ям."),
                 ask("Бурштин — сонце в камені. Знайдеш на пляжі?", [["amber", 1]], 70, "painting_small", "Він світиться! Тримай картину — з цим самим світлом.")],
    "panas": [ask("Шишок на розпал, три штуки. Старі кістки мерзнуть.", [["pine_cone", 3]], 30, None, "От тепер і вечір теплий."),
              ask("Двох окунів би на юшку. Сам щось не клює.", [["perch", 2]], 45, None, "Ото рибалка! Скажу всім, що то я спіймав."),
              ask("Груш на компот, дві.", [["pear", 2]], 35, None, "Компот буде — як у дитинстві.")],
    "yarynka": [ask("Малини! Дві жмені! Будь ласочка!", [["raspberry", 2]], 30, None, "Ммм! Половину віддам дідові. Може."),
                ask("Мені треба два пласкі камінчики — пускати жабки!", [["pebble", 2]], 25, None, "Сім стрибків! Ти бачив… бачила?!"),
                ask("Мушлю для моєї колекції морських скарбів?", [["shell", 1]], 30, None, "Тепер у мене їх дванадцять!")],
    "taras": [ask("Хочу написати пісню про сома. Але спершу треба сома.", [["catfish", 1]], 90, "music_box", "Тепер пісня буде правдива. Тримай скриньку — у ній моя мелодія."),
              ask("Ромашку за вухо — для настрою на концерт.", [["chamomile", 1]], 25, None, "Тепер я готовий співати хоч до ранку."),
              ask("Будь-яку рибу. Для натхнення. Не питай.", [["#fish", 1]], 30, None, "Дякую. Тепер у мене є слухач.")],
    "olena": [ask("Мені на букет три волошки.", [["cornflower", 3]], 45, None, "Блакитні, як небо над ставком. Дякую!"),
              ask("Дві ромашки — для простого літнього букета.", [["chamomile", 2]], 35, None, "Прості квіти — найщиріші."),
              ask("Лисичок би. Я їх смажу з цибулькою.", [["chanterelle", 1]], 35, None, "Запрошую на вечерю. Ну, колись.")],
    "myron": [ask("Дві шишки. Для телескопа. Не питай.", [["pine_cone", 2]], 30, None, "Тепер він стоїть рівно. Зорі подякують."),
              ask("Щось блискуче з пляжу? Бурштин був би дивом.", [["amber", 1]], 80, "fairy_jar", "Він як застигла зоря. Тримай баночку зі світлячками."),
              ask("Нічну рибу — вугра. Кажуть, вони пливуть за зорями.", [["eel", 1]], 50, None, "Тепер я знаю: зорі й риби дивляться одна на одну.")],
}

# the neighbours write as they come to know one (the welcome itself is баба Злата's first letters)
LETTERS = {
    "marta": [{"hearts": 2, "text": "Спекла забагато булочок, одна точно твоя. Знайдеш у кошику біля дверей. Марта", "gift": "fruit_bowl"},
              {"hearts": 4, "text": "Ти вже як рідна людина в цьому селі. Ось тобі мій старий чайник — він бачив багато добрих розмов. Марта", "gift": "kettle"}],
    "ostap": [{"hearts": 3, "text": "Я знайшов книжку, яка нагадала мені про тебе. Тримай. О.", "gift": "book_stack"}],
    "solomiia": [{"hearts": 3, "text": "Ось ескіз твого дому. Повісь, якщо сподобається! Соломія", "gift": "painting_wide"}],
    "panas": [{"hearts": 3, "text": "Тримай діжку — дощова вода для городу найкраща. Панас", "gift": "rain_barrel"}],
    "yarynka": [{"hearts": 2, "text": "Я знайшла дещо дивне на горищі в діда. Розкажу при зустрічі!!! Я."}],
    "taras": [{"hearts": 3, "text": "Написав пісню. Вона про тебе, але ніхто не здогадається. Тримай платівку. Т.", "gift": "record_crate"}],
    "olena": [{"hearts": 2, "text": "Ці тюльпани виросли найкращими цього року. Хай стоять у тебе. Олена", "gift": "tulip_jar"}],
    "myron": [{"hearts": 3, "text": "Тримай ліхтарик-зірку. Щоб у тебе вдома завжди був шматочок неба. М.", "gift": "floor_orb"}],
}

STORY = [
    {"title": "Стара мапа", "hearts": 1, "lines": [
        "Тсс! Дивись, що я знайшла на горищі в діда!",
        "Це мапа! Стара-стара. Тут ліс, озеро… а тут — хрестик біля великого дуба.",
        "Дід каже, що це «дурниці молодості». Але в нього вуха почервоніли!",
        "Допоможеш мені розгадати? Тільки нікому ні слова!"]},
    {"title": "Під старим дубом", "hearts": 2, "after_days": 1, "lines": [
        "Я ходила до Древнього дуба. Під корінням була скринька! А в ній — ключ і записка.",
        "«Хто знайде — хай допливе на той берег на світанку». Почерк діда!",
        "Але мені треба жолудь з того дуба — на щастя. Принесеш?"],
     "ask": {"text": "Жолудь на щастя", "items": [["acorn", 1]], "coins": 0, "thanks": ""}},
    {"title": "Дідів човен", "hearts": 3, "after_days": 2, "lines": [
        "Біля озера лежить дідів човник. Старий, але міцний!",
        "Щілини треба замазати смолою. Смолу роблять із шишок — дід навчив.",
        "Три шишки — і він знову попливе!"],
     "ask": {"text": "Три шишки на смолу", "items": [["pine_cone", 3]], "coins": 0, "thanks": ""}},
    {"title": "На світанку", "hearts": 3, "after_days": 1, "lines": [
        "Ми це зробили! Ми пливли на світанку, і вода була рожева-рожева.",
        "А на тому березі — камінь, а на камені вирізано: «Тут я освідчився твоїй бабусі». Ох, діду!",
        "Тримай компас. Він був у скриньці. Нехай веде тебе, куди захочеш."],
     "gift": "globe"},
    {"title": "Лист із дороги", "hearts": 4, "after_days": 3, "lines": [
        "Я вирішила. Наступного літа я піду в мандри — як дід колись.",
        "Але я завжди повертатимусь. Бо тут дім. І тут ти.",
        "Тримай нашу світлину біля човна. Щоб пам'ятав… пам'ятала… щоб пам'ятати!"],
     "gift": "photo_frame"},
]

for npc in npcs:
    npc["asks"] = ASKS[npc["id"]]
    npc["letters"] = LETTERS[npc["id"]]
    if npc["id"] == "yarynka":
        npc["story"] = STORY

# templates keep names in the nominative and verbs in the present, so they fit anyone: {a} and {b}
paper = [
    "{a} і {b} до ночі сперечаються, чия черга годувати качок на ставку.",
    "У кав'ярні «Липа» новий пиріг — з вишнями. {a} каже, що він найкращий у світі.",
    "{a} розповідає, що на узліссі бачили лисицю. {b} не вірить, але ходить подивитися.",
    "На ринку продають гарбуз — такий, що {a} і {b} несуть його вдвох.",
    "{a} шукає свій капелюх. Капелюх, кажуть, гуляє біля мосту.",
    "Уночі над пагорбом пролетіла зірка. {a} загадує бажання, але не каже яке.",
    "{a} і {b} грають у шашки біля фонтану. Нічия, обоє задоволені.",
    "Біля пірса хтось вудить чобіт. Чобіт пішов на волю.",
    "{a} і {b} пускають камінчики по воді. Рекорд — сім стрибків.",
    "У бібліотеці з'явилася нова полиця. Поки що на ній живе кіт.",
    "{a}: «Соняшники біля ґанку обіцяють вирости вищими за мене».",
    "Тарас співає до півночі. Сусідські собаки підвивають у тон.",
    "У «Півонії» новий букет, від якого навіть {a} розчулюється.",
    "У лісі знайшли коло з мухоморів. {a} радить його оминати. {b} радить загадати бажання.",
    "Дід Панас стверджує, що спіймав сома завбільшки з човен. Свідків немає.",
    "{a} і {b} діляться супом. Просто так. Бо можна.",
    "Над озером ранковий туман. {a} запевняє, що в ньому видно корабель.",
    "Яринка розвозить пошту за рекордні сім хвилин. Поштова скринька в шоці.",
    "{a} і {b} вирішують, що сьогодні — день компоту.",
    "Мирон бачить комету. Або світлячка. Розслідування триває.",
    "Хтось лишає букет польових квітів на лавці в парку. Записки немає.",
    "{a}: «Знайти чотирилисну конюшину — це на щастя. Віддати її — на подвійне».",
    "Погода, кажуть, буде лагідна. {a} все одно бере парасольку.",
    "{a} і {b} рахують зорі з пагорба. Збиваються на сорок другій.",
]
