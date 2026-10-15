# Things grow old, things are made, new things come (crates/teul-core/src/wear.rs, craft.rs, tech.rs).
# Run inside gen_base_content.py after town_life.py: it adds to items, stations and the town's openings, and gives
# the pack its `wear` and `crafts`.

# ---- materials: what goes into making (carried; found, gathered or bought in town)
good("nails", "Цвяхи", [b(30, 40, 0, 40, 20, 4, "head"), b(34, 44, 0, 4, 4, 26, "nail"), b(46, 44, 0, 4, 4, 26, "nail"), b(58, 44, 0, 4, 4, 26, "nail")],
     {"head": slot("wood", 3), "nail": slot("metal", 0)}, ("material", "metal"))
good("clay", "Грудка глини", [b(28, 30, 0, 44, 40, 22, "clay", "round"), b(36, 36, 16, 28, 26, 12, "clay2", "round")],
     {"clay": slot("earth", 1), "clay2": slot("earth", 2)}, ("material",))
good("cloth", "Клапті тканини", [b(22, 30, 0, 50, 36, 4, "a"), b(34, 22, 4, 44, 40, 4, "b"), b(28, 40, 8, 36, 30, 4, "c")],
     {"a": slot("fabric", 1), "b": slot("fabric", 6), "c": slot("fabric", 2)}, ("material", "cloth"))
good("metal_scrap", "Залізяка", [b(26, 40, 0, 48, 14, 8, "iron"), b(40, 30, 6, 10, 34, 8, "iron2", "cyl")],
     {"iron": slot("metal", 2), "iron2": slot("metal", 0)}, ("material", "metal"))

# ---- what is made of them (carried; the furniture made goes home as any other)
good("repair_kit", "Ремонтний набір", [b(24, 34, 0, 52, 32, 18, "box"), b(26, 36, 18, 48, 28, 3, "lid"), b(44, 46, 21, 12, 6, 4, "latch")],
     {"box": slot("metal", 3), "lid": slot("metal", 3), "latch": slot("metal", 0)}, ("repair", "crafted"))
good("clay_mug", "Глиняне горнятко", [b(34, 34, 0, 32, 32, 34, "mug", "cyl"), b(64, 44, 10, 10, 12, 16, "handle", "round"), b(36, 36, 30, 28, 28, 3, "glaze", "cyl")],
     {"mug": slot("earth", 1), "handle": slot("earth", 1), "glaze": slot("pastel", 2)}, ("gift", "crafted"))
good("fishing_lure", "Блешня з пером", [b(40, 44, 0, 20, 10, 6, "spoon", "round"), b(58, 46, 2, 14, 6, 3, "feather"), b(36, 47, 2, 6, 4, 4, "hook")],
     {"spoon": slot("metal", 0), "feather": slot("fabric", 1), "hook": slot("metal", 2)}, ("crafted", "fishing"))
good("wooden_toy", "Дерев'яний коник", [b(30, 40, 10, 40, 14, 16, "body"), b(62, 42, 22, 12, 10, 20, "head"), b(32, 42, 0, 6, 10, 10, "leg"), b(62, 42, 0, 6, 10, 10, "leg"), b(26, 44, 20, 6, 6, 4, "tail")],
     {"body": slot("wood", 1), "head": slot("wood", 1), "leg": slot("wood", 2), "tail": slot("fabric", 1)}, ("toy", "gift", "crafted"))
good("rag_doll", "Лялька-мотанка", [b(38, 40, 0, 24, 20, 30, "dress", "cone"), b(42, 44, 28, 16, 12, 14, "head", "round"), b(36, 42, 36, 28, 16, 8, "scarf", "round")],
     {"dress": slot("fabric", 1), "head": slot("cloth", 0) if "cloth" in PALETTES else slot("fabric", 5), "scarf": slot("fabric", 3)}, ("toy", "gift", "crafted"))

# ---- tools: they serve a while and wear out (how long: TOOLS below); one's own at home, the master's at the workshop
def tool(id, name, model, slots, extra=()):
    good(id, name, model, slots, ("tool",) + tuple(extra), category="gear")


W, M, D = ("wood", 1), ("metal", 0), ("metal", 2)
tool("hammer", "Молоток", [b(46, 20, 0, 8, 60, 8, "handle"), b(36, 70, 0, 28, 12, 12, "head")], {"handle": slot(*W), "head": slot(*D)})
tool("saw", "Ножівка", [b(20, 40, 0, 60, 20, 2, "blade"), b(70, 38, 0, 16, 24, 8, "handle", "round")], {"blade": slot(*M), "handle": slot("fabric", 1)})
tool("screwdrivers", "Набір викруток", [b(26, 34, 0, 48, 32, 8, "case"), b(32, 40, 8, 6, 20, 4, "tip"), b(44, 40, 8, 6, 20, 4, "tip"), b(56, 40, 8, 6, 20, 4, "tip")],
     {"case": slot("fabric", 6), "tip": slot(*M)})
tool("pliers", "Плоскогубці", [b(40, 20, 0, 6, 40, 6, "jaw"), b(50, 20, 0, 6, 40, 6, "jaw"), b(38, 58, 0, 8, 26, 8, "grip"), b(50, 58, 0, 8, 26, 8, "grip")],
     {"jaw": slot(*D), "grip": slot("fabric", 1)})
tool("wrench", "Розвідний ключ", [b(44, 20, 0, 10, 60, 6, "bar"), b(38, 14, 0, 22, 12, 8, "jaw")], {"bar": slot(*M), "jaw": slot(*M)})
tool("shovel", "Лопата", [b(46, 10, 0, 6, 64, 6, "handle"), b(36, 72, 0, 26, 22, 4, "blade")], {"handle": slot(*W), "blade": slot(*D)}, ("garden",))
tool("rake", "Граблі", [b(46, 10, 0, 6, 64, 6, "handle"), b(26, 72, 0, 46, 6, 4, "head"), b(28, 76, 0, 42, 8, 2, "teeth")], {"handle": slot(*W), "head": slot(*D), "teeth": slot(*D)}, ("garden",))
tool("hoe", "Сапка", [b(46, 10, 0, 6, 64, 6, "handle"), b(38, 72, 0, 22, 10, 10, "blade")], {"handle": slot(*W), "blade": slot(*D)}, ("garden",))
tool("hand_watering_can", "Лійка", [b(30, 34, 0, 34, 30, 28, "can", "cyl"), b(62, 44, 16, 22, 6, 6, "spout"), b(38, 44, 28, 18, 8, 10, "handle", "round")],
     {"can": slot("leaf", 2), "spout": slot("leaf", 2), "handle": slot("leaf", 0)}, ("garden",))
tool("bucket", "Відро", [b(32, 32, 0, 36, 36, 32, "pail", "cyl"), b(34, 48, 30, 32, 4, 12, "handle", "round")], {"pail": slot(*M), "handle": slot(*D)})
tool("axe", "Сокира", [b(46, 14, 0, 8, 64, 8, "handle"), b(34, 64, 0, 24, 18, 6, "head")], {"handle": slot(*W), "head": slot(*D)})
tool("ladder", "Драбина", [b(36, 4, 0, 6, 92, 6, "rail"), b(58, 4, 0, 6, 92, 6, "rail")] + [b(42, 12 + 18 * i, 0, 16, 4, 4, "rung") for i in range(5)],
     {"rail": slot(*W), "rung": slot(*W)})
tool("fishing_rod_good", "Добра вудка з котушкою", [b(48, 4, 0, 4, 92, 4, "rod", "cyl"), b(44, 70, 0, 12, 12, 10, "reel", "cyl")], {"rod": slot("fabric", 4), "reel": slot(*D)}, ("fishing",))
tool("knitting_needles", "Спиці", [b(40, 20, 0, 4, 60, 4, "needle", "cyl"), b(54, 20, 0, 4, 60, 4, "needle", "cyl"), b(36, 60, 0, 30, 20, 14, "ball", "ball")],
     {"needle": slot(*M), "ball": slot("fabric", 7)})
tool("paintbrushes", "Пензлі", [b(36, 20, 0, 6, 56, 6, "brush"), b(48, 20, 0, 6, 56, 6, "brush"), b(60, 20, 0, 6, 56, 6, "brush"), b(34, 72, 0, 36, 8, 6, "tips")],
     {"brush": slot(*W), "tips": slot("fabric", 1)})
found("barrow", "Тачка", "gear", [b(20, 30, 10, 60, 40, 24, "tub"), b(42, 70, 0, 14, 14, 14, "wheel", "cyl"), b(24, 20, 10, 4, 20, 4, "handle"), b(70, 20, 10, 4, 20, 4, "handle")],
      {"tub": slot("leaf", 2), "wheel": slot(*D), "handle": slot(*W)}, ("bag",))
items[-1]["bag"] = 24

# ---- the hardware store's other goods: materials and things for the house
good("paint", "Банка фарби", [b(34, 34, 0, 32, 32, 30, "can", "cyl"), b(34, 34, 30, 32, 32, 3, "lid", "cyl"), b(36, 33, 12, 28, 2, 12, "label")],
     {"can": slot(*M), "lid": slot("fabric", 6), "label": slot("fabric", 2)}, ("material",))
good("glue", "Тюбик клею", [b(40, 30, 0, 18, 40, 10, "tube", "round"), b(46, 66, 0, 6, 8, 6, "cap")], {"tube": slot("ceramic", 0), "cap": slot("fabric", 1)}, ("material",))
good("fertilizer", "Мішечок добрива", [b(30, 34, 0, 40, 30, 32, "sack", "round"), b(36, 33, 12, 28, 2, 12, "label")], {"sack": slot("earth", 2), "label": slot("leaf", 0)}, ("garden",))
good("light_bulb", "Лампочка", [b(40, 40, 10, 20, 20, 22, "glass", "ball"), b(44, 44, 0, 12, 12, 12, "base", "cyl")], {"glass": slot("glass", 0), "base": slot(*M)}, ("household",))
good("batteries", "Батарейки", [b(34, 40, 0, 12, 12, 26, "cell", "cyl"), b(50, 40, 0, 12, 12, 26, "cell", "cyl")], {"cell": slot("fabric", 2)}, ("household",))
good("detergent", "Миючий засіб", [b(38, 38, 0, 24, 18, 40, "bottle", "round"), b(44, 42, 40, 10, 10, 8, "cap")], {"bottle": slot("leaf", 0), "cap": slot("fabric", 6)}, ("household",))
good("candles", "Свічки", [b(36, 44, 0, 8, 8, 34, "wax", "cyl"), b(50, 44, 0, 8, 8, 30, "wax", "cyl"), b(38, 46, 34, 4, 4, 4, "wick")], {"wax": slot("ceramic", 0), "wick": slot("fabric", 2)}, ("household", "gift"))
good("painted_plate", "Розписна тарілка", [b(26, 26, 0, 48, 48, 4, "plate", "cyl"), b(36, 36, 4, 28, 28, 1, "flower", "cyl")], {"plate": slot("ceramic", 0), "flower": slot("fabric", 1)}, ("gift", "crafted"))

for it in items:
    if it["id"] in ("planks", "yarn", "wool", "feather", "firewood"):
        it["tags"] = sorted(set(it.get("tags", [])) | {"material"})
    if it["id"] in ("scarf", "mittens", "wreath"):
        it["tags"] = sorted(set(it.get("tags", [])) | {"crafted"})

# ---- a workbench of one's own (crafting at home), the book of crafts, a phone and a laptop
item("home_workbench", "storage", 2, 1, "floor",
     [b(8, 8, 0, 12, 12, 62, "frame"), b(8, 80, 0, 12, 12, 62, "frame"), b(180, 8, 0, 12, 12, 62, "frame"), b(180, 80, 0, 12, 12, 62, "frame"),
      b(0, 0, 62, 200, 100, 10, "top"), b(10, 10, 18, 180, 80, 4, "frame"), b(150, 60, 72, 30, 26, 20, "vise"),
      b(24, 24, 72, 60, 8, 4, "tool"), b(96, 30, 72, 40, 30, 8, "plank"), b(20, 0, 82, 160, 4, 56, "board"),
      b(34, 4, 104, 8, 4, 26, "tool"), b(64, 4, 104, 8, 4, 26, "tool"), b(94, 4, 104, 8, 4, 26, "tool")],
     {"frame": slot("wood", 2), "top": slot("wood", 1), "vise": slot("metal", 2), "tool": slot("metal", 0), "plank": slot("wood", 3), "board": slot("wood", 0)},
     coins(140), name="Верстак")
items[-1]["tags"] = ["workbench"]

key("craft_book", "Книжка «Майструємо вдома»", [b(28, 34, 0, 44, 32, 10, "cover"), b(30, 36, 10, 40, 28, 2, "pages"), b(40, 44, 12, 20, 4, 1, "title")],
    {"cover": slot("fabric", 3), "pages": slot("ceramic", 5) if "ceramic" in PALETTES else slot("fabric", 5), "title": slot("metal", 1)})
key("smartphone", "Смартфон", [b(38, 30, 0, 24, 42, 4, "body", "round"), b(40, 33, 4, 20, 34, 1, "screen"), b(47, 68, 4, 6, 2, 1, "button")],
    {"body": slot("metal", 2), "screen": slot("glass", 0), "button": slot("metal", 0)})
found("laptop", "Ноутбук", "office",
      [b(12, 40, 0, 76, 44, 4, "body", "round"), b(18, 46, 4, 64, 30, 1, "keys"), b(12, 36, 4, 76, 4, 46, "body", "round"), b(16, 39, 8, 68, 1, 38, "screen")],
      {"body": slot("metal", 0), "keys": slot("metal", 2), "screen": slot("glass", 0)}, ("power", "switch", "computer"))
items[-1]["actions"] = ["read"]

# ---- where the materials come from, where crafts go
st("st.workshop.nails", "workshop_in", "tool_wall", "Купити цвяхи", "Майстер насипає жменю цвяхів у паперовий кульок.", "buy", cost=3, gives=[("nails", 4)], per_day=3, hours=(8, 18))
st("st.workshop.kit", "workshop_in", "paint_cans", "Купити ремонтний набір", "Клей, шурупи, наждачка, пара латок — усе в бляшаній коробці.", "buy", cost=16, gives=[("repair_kit", 1)], per_day=2, hours=(8, 18))
st("st.workshop.planks", "workshop_in", "log_pile", "Купити дошку", "Суха, рівна, пахне сосною.", "buy", cost=5, gives=[("planks", 1)], per_day=3, hours=(8, 18))
st("st.workshop.sell", "workshop_in", "lathe", "Показати майстрові виріб", "Майстер крутить виріб у руках, хмикає — і платить, як за добру річ.", "sell", needs=[("#crafted", 1)], earn=12, per_day=3, hours=(8, 18))
st("st.clothes.cloth", "clothes_in", "cash_counter", "Взяти клапті тканини", "Продавчиня віддає обрізки за копійки: «Шийте на здоров'я».", "buy", cost=2, gives=[("cloth", 2)], per_day=2, hours=(9, 19))
st("st.forest.clay", "forest", "reeds", "Накопати глини", "Біля очерету глина жирна й сиза — якраз на горнятко.", "gather", gives=[("clay", 2)], per_day=2, seasons=(SP, SU, AU),
   requires={"items": ["shovel"], "hint": "Голими руками глини не накопаєш — потрібна лопата."})
st("st.forest.firewood", "forest", "log_pile", "Нарубати дров", "Сокира дзвенить, поліна розлітаються навсібіч. Пахне смолою.", "gather", gives=[("firewood", 2)], per_day=2, hours=(7, 19),
   requires={"items": ["axe"], "hint": "Дрова рубають сокирою."})
st("st.village.leaves", "village", "tree_maple", "Згребти листя в сквері", "Шурх-шурх граблями — і жовта купа до неба. Двірник дякує й платить від громади.", "gather", earn=6, per_day=1, seasons=(AU,), hours=(8, 17),
   requires={"items": ["rake"], "hint": "Листя гребуть граблями."})
st("st.dump.scrap", "dump", "trash_heap", "Пошукати залізяк", "Серед мотлоху — пружина, скоба й шматок бляхи. Знадобиться.", "gather", gives=[("metal_scrap", 1)], per_day=2, hours=(7, 20))
st("st.dump.flea", "dump", "skip", "Барахолка: продати виріб", "На вихідних тут розкладають ковдри з усяким добром. Твій виріб забирають першим.", "sell", needs=[("#crafted", 1)], earn=10, per_day=3, hours=(9, 14))
stations[-1]["days"] = "weekends"
st("st.library.craft_book", "library_in", "bookshelf", "Взяти «Майструємо вдома»", "Стара книжка з кресленнями: полиця, рамка, горнятко з глини. На полях хтось дописав олівцем поради.", "read",
   gives=[("craft_book", 1)], per_day=1, hours=(9, 18))

# ---- the counter «Техніка» at the post office: a few weeks after the world began, then laptops
OPENINGS.append({"id": "open.tech", "name": "Прилавок «Техніка»", "from_day": 21,
                 "text": "На пошті відкрили прилавок «Техніка»: смартфони з камерою, мапою й прогнозом погоди."})
OPENINGS.append({"id": "open.tech_laptops", "name": "Ноутбуки на пошті", "from_day": 45,
                 "text": "На прилавку «Техніка» з'явилися ноутбуки. У кав'ярні вже питають, чи можна сидіти з ними до обіду."})
town_st("st.post.phone", "post_in", "parcel_shelf", "Купити смартфон", "Новенький, у коробці. Листоноша вмикає його й показує, де камера.", "buy",
        flag="open:open.tech", cost=120, gives=[("smartphone", 1)], per_day=1, hours=(9, 18), spent="На сьогодні смартфони розібрали — завтра привезуть ще.")
town_st("st.post.laptop", "post_in", "parcel_shelf", "Купити ноутбук", "Тонкий, легкий, з наліпкою «Липове» на кришці.", "buy",
        flag="open:open.tech_laptops", cost=260, gives=[("laptop", 1)], per_day=1, hours=(9, 18), spent="Ноутбуки на сьогодні скінчилися.")

# ---- how things at home age: by id first, then by tag, then by category
# what one's own hands need to mend each kind (any of the tools; the kit goes into it)
WEAR_HANDS = {"bed": (["hammer"], None), "fridge": (["screwdrivers"], None), "stove": (["screwdrivers", "wrench"], None), "water": (["wrench", "pliers"], None),
              "devices": (["screwdrivers"], None), "lights": (["ladder"], "light_bulb"), "music": (["pliers"], None), "seats": (["hammer"], None),
              "furniture": (["hammer", "screwdrivers"], None)}


def wear(id, stages, per_use, looks, broken, fix, items=(), tags=(), categories=()):
    tools, kit = WEAR_HANDS.get(id, ([], None))
    w = {"id": id, "items": list(items), "tags": list(tags), "categories": list(categories), "stages": list(stages), "per_use": per_use,
         "looks": list(looks), "broken": broken, "fix": fix, "tools": tools}
    if kit:
        w["kit"] = kit
    return w


WEAR = [
    wear("bed", (60, 160, 300), 2, ("як нове", "трохи прим'яте", "рипить, коли лягаєш", "ламела тріснула"),
         "Ламела тріснула — на такому ліжку не виспишся", 60, items=("bed", "bed_single", "bunk_bed", "canopy_bed")),
    wear("fridge", (90, 210, 360), 0, ("тихо гуде", "гуде голосніше", "торохтить і ледь холодить", "не холодить"),
         "Холодильник не холодить — їжа в ньому не втримається", 120, tags=("fridge",)),
    wear("stove", (80, 200, 340), 1, ("чиста", "в нагарі", "одна конфорка ледь горить", "не запалюється"),
         "Плита не запалюється — газ шипить, а вогню нема", 90, tags=("stove",)),
    wear("water", (70, 170, 300), 1, ("кран блищить", "кран потемнів", "кран капає", "кран зірвало"),
         "Кран зірвало — вода не йде, поки не полагодиш", 70, tags=("water",)),
    wear("devices", (80, 190, 330), 2, ("як новий", "трохи затертий", "сніг на екрані й хрипіння", "не вмикається"),
         "Не вмикається — тільки клацає й тріщить", 100, tags=("switch",)),
    wear("lights", (70, 170, 300), 1, ("світить рівно", "трохи тьмяніє", "блимає", "лампочка перегоріла"),
         "Лампочка перегоріла — треба нову", 30, tags=("light",)),
    wear("music", (100, 240, 420), 1, ("налаштований", "трохи розлаштований", "фальшивить", "порвалася струна"),
         "Порвалася струна — грати не вийде", 80, tags=("instrument",)),
    wear("seats", (50, 130, 250), 2, ("як новий", "потертий", "розхитаний, тканина вицвіла", "зламаний"),
         "Сісти страшно — ніжка ледь тримається", 45, categories=("seating",)),
    wear("furniture", (120, 300, 560), 1, ("як новий", "трохи подряпаний", "обдертий, дверцята рипять", "розвалюється"),
         "Тут уже все розвалюється — треба лагодити", 60, categories=("tables", "storage", "office", "kids")),
]

# ---- what one can make at a workbench
CRAFT_TOOLS = {"craft.repair_kit": ["hammer"], "craft.stool": ["hammer", "saw"], "craft.birdhouse": ["hammer", "saw"], "craft.toy": ["saw"],
               "craft.scarf": ["knitting_needles"], "craft.mittens": ["knitting_needles"], "craft.shelf": ["hammer", "saw", "screwdrivers"],
               "craft.frame": ["saw"], "craft.lure": ["pliers"], "craft.plate": ["paintbrushes"]}


def craft(id, name, needs, gives, text, known=False, learn=None, frm=""):
    c = {"id": id, "name": name, "needs": [list(n) for n in needs], "gives": list(gives), "text": text, "from": frm, "tools": CRAFT_TOOLS.get(id, [])}
    if known:
        c["known"] = True
    if learn:
        c["learn"] = learn
    return c


CRAFTS = [
    craft("craft.repair_kit", "Ремонтний набір", [("nails", 2), ("planks", 1)], ("repair_kit", 1),
          "Цвяхи в коробку, дощечку на латки — і є з чим лагодити.", known=True, frm="Це вміє кожен у Липовому"),
    craft("craft.stool", "Табурет", [("planks", 2), ("nails", 2)], ("stool", 1),
          "Чотири ніжки, сидіння — і табурет стоїть рівно, не хитається.", known=True, frm="Це вміє кожен у Липовому"),
    craft("craft.birdhouse", "Шпаківня", [("planks", 1), ("nails", 1), ("pine_cone", 1)], ("birdhouse", 1),
          "Круглий вхід, дашок зі шишкою — шпаки прилетять навесні.", learn={"hearts": [["panas", 2]], "hint": ""}, frm="Дід Панас показав, як"),
    craft("craft.toy", "Дерев'яний коник", [("planks", 1), ("cloth", 1)], ("wooden_toy", 1),
          "Вистругати коника, з клаптика — гриву. Малеча буде щаслива.", learn={"hearts": [["panas", 3]], "hint": ""}, frm="Дід Панас навчив стругати"),
    craft("craft.scarf", "Шарф", [("yarn", 3)], ("scarf", 1), "Петля за петлею — і довгий теплий шарф.",
          learn={"hearts": [["marta", 2]], "hint": ""}, frm="Марта навчила в'язати"),
    craft("craft.mittens", "Рукавички", [("yarn", 2)], ("mittens", 1), "Дві рукавички, з візерунком на манжеті.",
          learn={"hearts": [["marta", 3]], "hint": ""}, frm="Марта показала візерунок"),
    craft("craft.doll", "Лялька-мотанка", [("cloth", 2), ("yarn", 1)], ("rag_doll", 1), "Без голки й без обличчя — на щастя, як робили бабусі.",
          learn={"hearts": [["solomiia", 2]], "hint": ""}, frm="Соломія навчила мотати"),
    craft("craft.shelf", "Настінна полиця", [("planks", 2), ("nails", 2), ("metal_scrap", 1)], ("wall_shelf", 1), "Дві дошки й залізні кутики — тримає навіть важкі книжки.",
          learn={"items": ["craft_book"], "hint": ""}, frm="З книжки «Майструємо вдома»"),
    craft("craft.frame", "Рамка", [("planks", 1), ("cloth", 1)], ("photo_frame", 1), "Дерев'яна рамка з полотняним паспарту — для фото чи власної картини.",
          learn={"items": ["craft_book"], "hint": ""}, frm="З книжки «Майструємо вдома»"),
    craft("craft.mug", "Глиняне горнятко", [("clay", 2)], ("clay_mug", 1), "Виліпити, висушити, покрити поливою — горнятко на чай.",
          learn={"items": ["craft_book"], "hint": ""}, frm="З книжки «Майструємо вдома»"),
    # these nobody teaches: they come of trying
    craft("craft.lure", "Блешня з пером", [("metal_scrap", 1), ("feather", 1)], ("fishing_lure", 1), "Бляшка, гачок і перо — риба не встоїть.",
          frm="Сам додумався"),
    craft("craft.plate", "Розписна тарілка", [("clay", 2), ("paint", 1)], ("painted_plate", 1), "Виліпити тарілку, а пензлем — калину по краю.",
          learn={"items": ["craft_book"], "hint": ""}, frm="З книжки «Майструємо вдома»"),
    craft("craft.wreath", "Вінок", [("#flower", 3)], ("wreath", 1), "Сплести три квітки в коло — і на голову.", frm="Сам додумався"),
]


# ---- how long tools serve (and what is used up at once)
TOOLS = [{"item": i, "uses": n, "gone": g} for i, n, g in [
    ("hammer", 60, "Молоток зламався — ручка тріснула навпіл."),
    ("saw", 45, "Ножівка затупилася так, що вже не пиляє."),
    ("screwdrivers", 50, "Викрутки стерлися — шліци вже не тримають."),
    ("pliers", 50, "Плоскогубці розхиталися й більше не стискають."),
    ("wrench", 60, "Ключ розболтався — гайку вже не візьме."),
    ("shovel", 50, "Лопата погнулася — копати нею вже годі."),
    ("rake", 40, "У граблів повипадали зубці."),
    ("hoe", 45, "Сапка затупилася й розхиталася на держаку."),
    ("hand_watering_can", 70, "Лійка протекла — вода біжить по руках."),
    ("bucket", 60, "Відро протекло на дні."),
    ("axe", 50, "Сокира затупилася й вищербилася."),
    ("ladder", 60, "Щабель драбини тріснув — лізти небезпечно."),
    ("fishing_rod_good", 80, "Котушка заїла, а вудилище тріснуло."),
    ("fishing_lure", 15, "Блешня зачепилася за корч і лишилася в річці."),
    ("knitting_needles", 60, "Спиця зігнулася й більше не тримає петлі."),
    ("paintbrushes", 40, "Пензлі облізли — малюють самі патлі."),
    ("fertilizer", 1, "Добриво розсипано по грядці — урожай буде щедріший."),
]]

# ---- the hardware store «Господарчий»: its goods (inside: crates/teul-core content `hardware_in`)
def shop(id, prop, label, text, cost, gives, per_day=3):
    st(id, "hardware_in", prop, label, text, "buy", cost=cost, gives=gives, per_day=per_day, hours=(8, 19))


HW_TOOLS = [("hammer", 25), ("saw", 30), ("screwdrivers", 22), ("pliers", 18), ("wrench", 20), ("axe", 35), ("ladder", 45), ("knitting_needles", 10), ("paintbrushes", 12)]
HW_GARDEN = [("shovel", 28), ("rake", 20), ("hoe", 22), ("hand_watering_can", 18), ("bucket", 10), ("fishing_rod_good", 60), ("fertilizer", 6), ("barrow", 80)]
NAME = {it["id"]: it["name"] for it in items}
for i, c in HW_TOOLS:
    shop(f"st.hardware.{i}", "tool_wall", f"Купити: {NAME[i].lower()}", "Продавець знімає з гачка, перевіряє — і загортає в папір.", c, [(i, 1)], 1)
for i, c in HW_GARDEN:
    shop(f"st.hardware.{i}", "garden_tools", f"Купити: {NAME[i].lower()}", "Усе для городу й саду, з запахом нової фарби на держаках.", c, [(i, 1)], 1 if i != "fertilizer" else 3)
for i, n, c, prop in [("planks", 1, 5, "log_pile"), ("nails", 4, 3, "shop_shelf"), ("paint", 1, 8, "paint_cans"), ("yarn", 2, 6, "shop_shelf"), ("cloth", 2, 3, "shop_shelf"),
                      ("glue", 1, 4, "shop_shelf"), ("seed_sunflower", 2, 3, "shop_shelf"), ("light_bulb", 1, 4, "shelf_low"), ("batteries", 1, 5, "shelf_low"),
                      ("detergent", 1, 6, "shelf_low"), ("candles", 2, 4, "shelf_low"), ("repair_kit", 1, 16, "cash_counter")]:
    shop(f"st.hardware.{i}", prop, f"Купити: {NAME[i].lower()}", "Продавець рахує на калькуляторі й відраховує решту дрібними.", c, [(i, n)])
shop("st.hardware.plates", "cash_counter", "Купити набір тарілок", "Шість тарілок у газеті — привезуть додому разом з покупками.", 20, [("plate_stack", 1)], 1)

# ---- armour, at the back of «Майстер»: leather and iron, for the head, the body, the legs, the feet (worn on the
# hero; it wears too, iron lasting longer)
ARMOR_LOOK = {"leather": (slot("wood", 1), slot("wood", 3)), "iron": (slot("metal", 1), slot("metal", 3))}
ARMOR_MODEL = {
    "head": lambda: [b(26, 26, 0, 48, 48, 30, "main", "ball"), b(22, 22, 0, 56, 56, 6, "trim", "cyl")],
    "body": lambda: [b(24, 30, 0, 52, 40, 54, "main", "round"), b(20, 34, 40, 60, 32, 12, "trim", "round")],
    "legs": lambda: [b(26, 32, 0, 20, 36, 50, "main", "round"), b(54, 32, 0, 20, 36, 50, "main", "round"), b(24, 30, 44, 52, 40, 8, "trim")],
    "feet": lambda: [b(24, 30, 0, 22, 40, 22, "main", "round"), b(54, 30, 0, 22, 40, 22, "main", "round"), b(22, 28, 0, 26, 44, 5, "trim")],
}
ARMOR = [
    ("leather", "head", "Шкіряний шолом", 1, 18), ("leather", "body", "Шкіряна куртка", 2, 30), ("leather", "legs", "Шкіряні штани", 1, 24), ("leather", "feet", "Шкіряні чоботи", 1, 16),
    ("iron", "head", "Залізний шолом", 2, 45), ("iron", "body", "Залізний нагрудник", 4, 80), ("iron", "legs", "Залізні наголінники", 3, 60), ("iron", "feet", "Залізні чоботи", 2, 40),
]
for _mat, _slot, _name, _def, _cost in ARMOR:
    _id = f"armor_{_mat}_{_slot}"
    good(_id, _name, ARMOR_MODEL[_slot](), {"main": ARMOR_LOOK[_mat][0], "trim": ARMOR_LOOK[_mat][1]}, ("armor", _mat))
    items[-1]["armor"] = {"slot": _slot, "defense": _def, "durability": 160 if _mat == "iron" else 80}
    shop(f"st.hardware.{_id}", "shelf_low", f"Купити: {_name.lower()}", "Продавець приміряє на око, підтягує ремінець — сидить як влите.", _cost, [(_id, 1)], 1)

R = Inside("hardware_in", "Господарчий «Майстер»", "hardware_site", 14, 11, "floor.pine", "wall.panel_oak", 5)
R.prop("tool_wall", 1, 0, wall="north")
R.prop("tool_wall", 4, 0, wall="north")
R.prop("garden_tools", 0, 3, wall="west")
R.prop("paint_cans", 1, 0)
R.prop("paint_cans", 2, 0)
R.prop("log_pile", 4, 0)
R.prop("shop_shelf", 7, 0)
R.prop("shop_shelf", 9, 0)
R.prop("shop_shelf", 3, 3, rot=2)
R.prop("shop_shelf", 3, 4)
R.prop("shelf_low", 0, 6, rot=3)
R.prop("cash_counter", 8, 6)
R.prop("basket_stack", 4, 9)
# the stockroom behind glass
R.partition(11, 0, 11, 4, gaps={(11, 2)})
R.prop("stock_boxes", 12, 0)
R.prop("stock_boxes", 13, 0)
R.prop("stock_boxes", 13, 1)
R.prop("safe", 12, 4)
R.prop("window_wide", 13, 7, wall="east")
R.prop("wall_clock", 8, 0, wall="north")
R.prop("track_lights", 1, 0, wall="north")
R.keep((5, 6))
R.post((9, 5), (12, 2), (3, 2), (6, 3), (2, 6), (6, 8))
rooms.append(R)
locations.append(R.build())

# its hours: the seller's shift (the job is given here, after residents.py, so nobody else's job moves)
for _loc in locations:
    for _site in _loc.get("sites", []):
        if _site["id"] == "hardware_site":
            _site["jobs"] = [{"role": "hardware_clerk", "from": 480, "to": 1140, "wage": 26, "days": [0, 1, 2, 3, 4, 5]}]
# its seller, a newcomer of their own (added last, so the town's other people stay as they were)
residents.append({"id": f"res_{len(residents) + 1}", "name": "Степан Гончар", "gender": "m", "age": "adult", "home": [h for h in homes if h.startswith("home_")][7],
                  "honesty": 85, "temper": 20, "social": 65, "job": ["hardware_site", "hardware_clerk"],
                  "look": {"skin_color": "#e0a97c", "hair_color": "#4a2f27", "hair": "2", "eye_color": "#2a2035", "face": "1", "top_color": "#8a5a2e", "top2_color": "#e8a23a",
                           "top": "2", "bottom_color": "#2f3a5a", "bottom": "0", "shoes_color": "#3a3a44", "acc": "0", "acc_color": "#3fb8b0"}})
