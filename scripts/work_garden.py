# Work, the garden and what the hands learn (docs/world-economy.md §10). Run inside gen_base_content.py after
# quests.py (it needs `items`, `stations`, `recipes`, `residents`, `locations`).
#
# Shifts at six places of the town (one is taken on first; the shifts run into the evening, a task a minute),
# paid by the town; plots at home where bought seeds grow over real days into
# food; the stage models drawn on the plots; seeds at the grocery and saplings at the flower shop; an easel's
# canvas to hang; instruments to play. Nothing at home earns: growing turns a bought seed and care into food.

WORK = []


def work(id, location, prop, name, boss, employer, hours, steps, gap, pay, ask, options, start, thanks, who=(), days=None):
    w = {"id": id, "location": location, "prop": prop, "name": name, "boss": boss, "employer": employer,
         "hours": list(hours), "steps": steps, "gap": gap, "pay": pay, "ask": ask, "options": list(options),
         "start": start, "thanks": thanks, "who": list(who)}
    if days:
        w["days"] = days
    WORK.append(w)


GUESTS = ["Бабуся Злата", "Пан Остап", "Студентка Оля", "Хлопчик Марко", "Листоноша Ліна", "Вчителька", "Отець Павло", "Дідусь Панас", "Пані Мирослава"]

work("work.cafe", "cafe_in", "counter", "Зміна в кав'ярні «Липа»", "пані Оксана", "res_85", (8, 22), 6, 1, 6,
     "{who} просить: {what}", ["каву з молоком", "еспресо", "какао з пінкою", "чай з м'ятою", "лимонад", "шматок пирога"],
     "Фартух висить на гачку біля дверей. Гості вже займають столики — до стійки!",
     "Дякую — сьогодні з тобою було легко. Приходь ще, гостям ти до вподоби.", GUESTS, "daily")
work("work.bakery", "bakery_in", "bread_oven", "Зміна в пекарні", "пан Остап", "res_48", (5, 21), 5, 1, 7,
     "У замовленні: {what}", ["паляниця", "булочки з маком", "яблучний пиріг", "калач", "рогалики з повидлом"],
     "Тісто підійшло ще вдосвіта. Руки в борошно — і до печі!",
     "Пахне на всю вулицю. Дякую за руки — без тебе я б до відкриття не встиг.", (), "daily")
work("work.post", "post_in", "parcel_shelf", "Сортування на пошті", "пан Григорій", "res_92", (8, 21), 6, 1, 6,
     "Посилка для: {what}", ["вул. Липова", "вул. Садова", "вул. Церковна", "вул. Польова", "ферма «Липовий гай»", "виноградник «Лоза»"],
     "Сьогодні посилок — гора. Розклади по полицях за адресами, а Ліна рознесе.",
     "Усе на своїх полицях. Ліна вже пішла по будинках — дякуємо за допомогу!", (), "weekdays")
work("work.farm", "farm", "cowshed", "День на фермі", "пан Остап Петренко", "res_40", (5, 21), 5, 1, 7,
     "Треба: {what}", ["подоїти корову Зірку", "нагодувати курей", "наносити сіна коням", "вичистити стайню", "зібрати яйця", "напоїти овець"],
     "Чоботи біля дверей корівника. На фермі день починається рано!",
     "Ну от, і худоба доглянута. Гарна з тебе помічна сила — заходь іще.", (), "daily")
work("work.library", "library_in", "bookcase_tall", "Година в бібліотеці", "пані Наталія", "res_66", (10, 21), 6, 1, 5,
     "{who} повертає книжку — на полицю «{what}»", ["Казки", "Історія", "Природа", "Поезія", "Кулінарія", "Детективи"],
     "Повернених книжок назбиралося цілий візок. Розстав, будь ласка, по полицях.",
     "Як рівненько стоять! Дякую — тепер кожен знайде, що шукає.", GUESTS, "weekdays")
work("work.flowers", "flower_in", "potting_bench", "Зміна в «Півонії»", "пан Петро", "res_86", (9, 21), 5, 1, 6,
     "{who} хоче букет: {what}", ["півонії", "троянди", "ромашки", "тюльпани", "соняшники", "лаванда"],
     "Квіти вже у відрах, стрічки на котушках. Хто першим зайде — тому найкращий букет.",
     "Кожен пішов зі своїм букетом. Дякую — у тебе легка рука на квіти.", GUESTS)

# the shops and offices beyond the first six: a counter, a reception, a bench to work at in each
SHOPPERS = ["Бабуся Злата", "Пан Остап", "Студентка Оля", "Хлопчик Марко", "Пані Мирослава", "Дідусь Панас", "Вчителька", "Сусідка Ганна"]
work("work.grocery", "grocery_in", "cash_counter", "Зміна за касою «Колоска»", "пані Людмила", "res_12", (7, 21), 6, 1, 6,
     "{who} просить: {what}", ["хліб і молоко", "пачку гречки", "кілограм яблук", "шоколадку", "сметану", "сірники"],
     "Каса відкрита, решта в шухляді. Перший покупець уже з кошиком!",
     "Каса зійшлася до копійки. Дякую — з тобою черга тане швидко.", SHOPPERS, "daily")
work("work.clothes", "clothes_in", "cash_counter", "Зміна в «Льоні»", "пані Тетяна", "res_15", (9, 20), 5, 1, 6,
     "{who} шукає: {what}", ["теплий светр", "лляну сорочку", "шарф", "черевики", "капелюх", "вишиванку"],
     "Вішаки рівненько, дзеркало протерте. Хтось уже міряє куртку!",
     "Кожен пішов у своєму. Дякую — у тебе око на те, що личить.", SHOPPERS, "daily")
work("work.salon", "salon_in", "cash_counter", "Зміна в «Локоні»", "пані Вікторія", "res_18", (9, 20), 5, 1, 6,
     "{who} хоче: {what}", ["коротку стрижку", "підрівняти кінчики", "косу", "укладку", "чубчик", "помити голову"],
     "Ножиці гострі, рушники теплі. Заходьте, сідайте!",
     "Усі пішли красивими. Дякую — з тобою день летить.", SHOPPERS, "daily")
work("work.hardware", "hardware_in", "cash_counter", "Зміна в «Майстрі»", "пан Богдан", "res_19", (8, 20), 6, 1, 6,
     "{who} питає: {what}", ["цвяхи", "молоток", "фарбу", "лампочку", "клей", "мотузку"],
     "Полиці повні, ключі на гачку. Хто перший по цвяхи?",
     "Усе знайшлося, хоч і в найдальшому кутку. Дякую за руки!", SHOPPERS, "daily")
work("work.donuts", "donuts_in", "cash_counter", "Зміна в Пончиковій", "пані Ніна", "res_30", (7, 21), 6, 1, 6,
     "{who} просить: {what}", ["пончик з малиною", "пончик з шоколадом", "какао", "пончик з пудрою", "чай", "два пончики з собою"],
     "Пончики ще гарячі, пудра в сито. Запах уже кличе людей!",
     "Тацю спорожнили до крихти. Дякую — пончики з тобою смачніші.", SHOPPERS, "daily")
work("work.creamery", "creamery_in", "cash_counter", "Зміна в «Овечці»", "пан Іван", "res_23", (7, 21), 5, 1, 7,
     "{who} бере: {what}", ["бринзу", "вовняні шкарпетки", "сир кругом", "клубок пряжі", "молоко", "вурду"],
     "Сир на полицях, пряжа в кошиках. Відчиняємо!",
     "Розійшлося все, навіть шкарпетки. Дякую — заходь іще.", SHOPPERS, "daily")
work("work.vet", "vet_in", "reception_desk", "Зміна в «Лапці»", "лікарка Лідія", "res_33", (8, 19), 5, 1, 7,
     "{who} привів(ла): {what}", ["кота на щеплення", "собаку з лапою", "папугу", "кролика", "цуценя на огляд", "їжака з лісу"],
     "Халат на гачку, журнал на столі. У черзі вже хтось гавкає!",
     "Усі хвостики оглянуті. Дякую — тварини тебе люблять.", SHOPPERS, "daily")
work("work.bar", "bar_in", "bar_counter", "Вечір за стійкою «Жабки»", "пан Тарас", "res_4", (16, 23), 6, 1, 6,
     "{who} замовляє: {what}", ["узвар", "лимонад", "чай з липою", "квас", "морс", "какао"],
     "Склянки сяють, музика тихенько. Перші гості вже біля стійки!",
     "Добрий був вечір. Дякую — з тобою за стійкою весело.", SHOPPERS, "daily")
work("work.hostel", "hostel_in", "reception_desk", "Зміна на рецепції «Лелеки»", "пані Олександра", "res_47", (7, 22), 5, 1, 6,
     "{who} просить: {what}", ["ключ від кімнати", "карту містечка", "рушник", "розбудити о сьомій", "чай", "квиток на автобус"],
     "Ключі на дошці, книга гостей розгорнута. Хтось уже з валізою!",
     "Гості влаштовані й задоволені. Дякую за добре серце.", ["Турист з рюкзаком", "Пані з валізою", "Студентка Оля", "Пан з собакою", "Подружжя з Києва", "Велосипедист"], "daily")
work("work.sto", "sto_in", "workbench", "Зміна на СТО «Гайка»", "пан Дмитро", "res_31", (8, 20), 5, 1, 7,
     "{who} просить: {what}", ["підкачати колесо", "замінити лампочку фари", "долити масла", "помити скло", "підтягнути гайку", "перевірити гальма"],
     "Ключі розкладені, руки в рукавицях. Під'їжджає перша машина!",
     "Усі поїхали на справних. Дякую — руки в тебе золоті.", SHOPPERS, "daily")
work("work.newsroom", "newsroom_in", "news_desk", "Зміна в «Липовому віснику»", "пан Орест", "res_27", (9, 19), 5, 1, 6,
     "Нова замітка до рубрики «{what}»", ["Події", "Погода", "Спорт", "Культура", "Оголошення", "Сад і город"],
     "Новини назбиралися купою. Розклади по рубриках — завтра друкуємо!",
     "Газета складена. Дякую — завтра читатиме все містечко.", (), "weekdays")
work("work.radio", "radio_in", "record_shelf", "Зміна на «Липове FM»", "пані Катерина", "res_51", (8, 22), 6, 1, 6,
     "{who} замовляє пісню: {what}", ["щось веселе", "колискову", "народну", "щось про кохання", "марш", "щось спокійне"],
     "Мікрофон теплий, платівки на полиці. Ефір починається!",
     "Слухачі дзвонять і дякують. І я дякую — гарний був ефір.", SHOPPERS, "daily")

# ---- the garden ------------------------------------------------------------------------------------------------
PLANTS = []

# plots: a raised bed out of doors, a tub for the orangery (indoors: grows all year, rain does not reach it)
item("garden_plot", "farm", 1, 1, "floor", [b(4, 4, 0, 92, 92, 16, "wood", "round"), b(10, 10, 12, 80, 80, 6, "soil")],
     {"wood": slot("wood", 2), "soil": slot("earth", 0)}, coins(20), name="Грядка під посадку")
items[-1]["tags"] = ["plot", "garden"]
item("garden_tub", "plants", 1, 1, "floor", [b(16, 16, 0, 68, 68, 34, "tub", "cyl"), b(14, 14, 30, 72, 72, 6, "rim", "cyl"), b(20, 20, 32, 60, 60, 4, "soil", "cyl")],
     {"tub": slot("wood", 1), "rim": slot("wood", 2), "soil": slot("earth", 0)}, coins(25), name="Кадка для оранжереї")
items[-1]["tags"] = ["plot", "indoor", "garden"]


def packet(id, name, color, tags=("seed",)):
    good(id, name, [b(30, 26, 0, 40, 48, 6, "paper", "round"), b(34, 30, 6, 32, 20, 1, "picture"), b(36, 56, 6, 28, 10, 1, "seedrow")],
         {"paper": slot("pastel", 3), "picture": slot(*color), "seedrow": slot("wood", 2)}, tags)


def sapling_item(id, name):
    good(id, name, [b(38, 38, 0, 24, 24, 20, "pot", "cyl"), b(48, 48, 18, 4, 4, 34, "stem", "cyl"), b(36, 36, 44, 28, 28, 18, "leaf", "ball")],
         {"pot": slot("pot", 0), "stem": slot("wood", 2), "leaf": slot("leaf", 1)}, ("seed", "sapling"))


# produce the town did not have yet
good("tomato", "Помідори з грядки", [b(30, 34, 0, 24, 24, 22, "fruit", "ball"), b(50, 38, 0, 22, 22, 20, "fruit", "ball"), b(40, 48, 0, 20, 20, 18, "fruit", "ball"), b(40, 38, 20, 10, 10, 4, "stem", "round")],
     {"fruit": slot("fabric", 1), "stem": slot("leaf", 0)}, ("veg", "food"))
good("cucumber", "Огірки", [b(26, 34, 0, 48, 14, 14, "skin", "round"), b(30, 50, 0, 44, 14, 14, "skin", "round")],
     {"skin": slot("leaf", 0)}, ("veg", "food"))
good("cabbage", "Качан капусти", [b(28, 28, 0, 44, 44, 38, "leaf", "ball"), b(34, 34, 8, 32, 32, 32, "heart", "ball")],
     {"leaf": slot("leaf", 3), "heart": slot("pastel", 2)}, ("veg", "food"))
good("pumpkin_veg", "Гарбуз", [b(22, 26, 0, 56, 48, 36, "skin", "ball"), b(46, 46, 34, 8, 8, 10, "stem", "cyl")],
     {"skin": slot("autumn", 0), "stem": slot("leaf", 0)}, ("veg", "food"))
good("strawberry", "Полуниця", [b(26, 30, 0, 48, 40, 10, "basket", "round")] + [b(30 + (i % 3) * 13, 34 + (i // 3) * 12, 8, 12, 12, 12, "berry", "ball") for i in range(6)],
     {"basket": slot("wood", 3), "berry": slot("fabric", 1)}, ("fruit", "berry", "food"))
good("dill", "Пучок кропу", [b(44, 40, 0, 12, 12, 20, "stems", "cone"), b(30, 30, 18, 40, 40, 20, "fronds", "ball")],
     {"stems": slot("leaf", 0), "fronds": slot("leaf", 3)}, ("veg", "herb", "food"))
ball_thing("plum", "Сливи", ("fabric", 3), 22, ("wood", 2), ("leaf", 1), ("fruit", "food"))
items[-1]["carry"] = True

packet("seed_tomato", "Насіння помідорів", ("fabric", 1))
packet("seed_cucumber", "Насіння огірків", ("leaf", 1))
packet("seed_carrot", "Насіння моркви", ("autumn", 0))
packet("seed_potato", "Насіннєва картопля", ("wood", 3))
packet("seed_cabbage", "Насіння капусти", ("leaf", 3))
packet("seed_pumpkin", "Насіння гарбуза", ("autumn", 1))
packet("seed_strawberry", "Розсада полуниці", ("fabric_pink", 0))
packet("seed_dill", "Насіння кропу", ("leaf", 2))
packet("seed_sunflower", "Насіння соняшника на посів", ("autumn", 3))
sapling_item("sapling_apple", "Саджанець яблуні")
sapling_item("sapling_cherry", "Саджанець вишні")
sapling_item("sapling_pear", "Саджанець груші")
sapling_item("sapling_plum", "Саджанець сливи")

SOIL = 18  # plants stand on the plot's soil


def stage_item(id, model, slots):
    item(id, "plantstage", 1, 1, "surface", model, slots, "free")
    items[-1]["hidden"] = True


def sprouts(n, h):
    return [b(22 + (i % 3) * 22, 26 + (i // 3) * 28, SOIL, 8, 8, h, "leaf", "cone") for i in range(n)]


def bed_stages(pid, leaf, fruit, shape):
    """Four looks of a bed plant: sown, sprouts, young plants, ripe (with what it gives)."""
    seeds = [b(26 + i * 18, 46, SOIL, 6, 6, 3, "seed", "ball") for i in range(4)]
    stage_item(f"plant_{pid}_0", seeds, {"seed": slot("earth", 3)})
    stage_item(f"plant_{pid}_1", sprouts(5, 10), {"leaf": slot("leaf", 3)})
    if shape == "bush":
        young = [b(18, 24, SOIL, 30, 30, 26, "leaf", "ball"), b(52, 44, SOIL, 30, 30, 30, "leaf", "ball")]
        ripe = [b(14, 20, SOIL, 36, 36, 40, "leaf", "ball"), b(48, 42, SOIL, 36, 36, 44, "leaf", "ball"), b(30, 30, SOIL + 16, 12, 12, 12, "fruit", "ball"), b(58, 50, SOIL + 22, 12, 12, 12, "fruit", "ball"), b(22, 52, SOIL + 10, 11, 11, 11, "fruit", "ball")]
    elif shape == "vine":
        young = [b(20, 40, SOIL, 60, 30, 14, "leaf", "round")]
        ripe = [b(14, 34, SOIL, 72, 40, 18, "leaf", "round"), b(26, 44, SOIL + 6, 26, 12, 12, "fruit", "round"), b(54, 40, SOIL + 6, 24, 12, 12, "fruit", "round")]
    elif shape == "root":
        young = [b(20 + i * 20, 40, SOIL, 10, 10, 18, "leaf", "cone") for i in range(4)]
        ripe = [b(18 + i * 20, 40, SOIL, 12, 12, 26, "leaf", "cone") for i in range(4)] + [b(20 + i * 20, 46, SOIL - 2, 8, 8, 6, "fruit", "ball") for i in range(4)]
    elif shape == "head":
        young = [b(26, 26, SOIL, 48, 48, 18, "leaf", "round")]
        ripe = [b(18, 18, SOIL, 64, 64, 22, "leaf", "round"), b(30, 30, SOIL + 8, 40, 40, 34, "fruit", "ball")]
    elif shape == "big":
        young = [b(14, 20, SOIL, 70, 50, 16, "leaf", "round")]
        ripe = [b(8, 12, SOIL, 84, 70, 18, "leaf", "round"), b(28, 30, SOIL + 6, 44, 40, 32, "fruit", "ball")]
    elif shape == "tall":
        young = [b(44, 44, SOIL, 10, 10, 40, "stem", "cyl"), b(34, 34, SOIL + 30, 30, 30, 16, "leaf", "round")]
        ripe = [b(44, 44, SOIL, 10, 10, 90, "stem", "cyl"), b(28, 40, SOIL + 40, 44, 14, 16, "leaf", "round"), b(32, 30, SOIL + 86, 36, 36, 10, "fruit", "cyl"), b(40, 38, SOIL + 92, 20, 20, 6, "seed", "cyl")]
    else:  # low leaves with berries
        young = [b(20, 24, SOIL, 26, 26, 12, "leaf", "round"), b(52, 46, SOIL, 26, 26, 12, "leaf", "round")]
        ripe = [b(16, 20, SOIL, 32, 32, 14, "leaf", "round"), b(50, 44, SOIL, 32, 32, 14, "leaf", "round"), b(26, 44, SOIL + 8, 10, 10, 10, "fruit", "ball"), b(58, 30, SOIL + 8, 10, 10, 10, "fruit", "ball"), b(40, 60, SOIL + 6, 10, 10, 10, "fruit", "ball")]
    s = {"leaf": slot(*leaf), "fruit": slot(*fruit), "stem": slot("leaf", 0), "seed": slot("wood", 2)}
    stage_item(f"plant_{pid}_2", young, s)
    stage_item(f"plant_{pid}_3", ripe, s)


def tree_stages(pid, fruit):
    """A sapling, a young tree, a grown tree, the tree with fruit."""
    s = {"trunk": slot("wood", 2), "leaf": slot("leaf", 1), "crown": slot("leaf", 0), "fruit": slot(*fruit)}
    stage_item(f"plant_{pid}_0", [b(47, 47, SOIL, 6, 6, 30, "trunk", "cyl"), b(38, 38, SOIL + 26, 24, 24, 14, "leaf", "ball")], s)
    stage_item(f"plant_{pid}_1", [b(46, 46, SOIL, 8, 8, 60, "trunk", "cyl"), b(28, 28, SOIL + 46, 44, 44, 34, "leaf", "ball")], s)
    stage_item(f"plant_{pid}_2", [b(44, 44, SOIL, 12, 12, 80, "trunk", "cyl"), b(14, 14, SOIL + 62, 72, 72, 56, "crown", "ball"), b(24, 30, SOIL + 92, 40, 40, 36, "leaf", "ball")], s)
    stage_item(f"plant_{pid}_3", [b(44, 44, SOIL, 12, 12, 80, "trunk", "cyl"), b(14, 14, SOIL + 62, 72, 72, 56, "crown", "ball"), b(24, 30, SOIL + 92, 40, 40, 36, "leaf", "ball")]
               + [b(x, y, z, 10, 10, 10, "fruit", "ball") for x, y, z in [(18, 40, 90), (64, 30, 100), (40, 70, 84), (70, 64, 96), (30, 22, 112), (52, 50, 128)]], s)


stage_item("plant_withered", [b(30 + i * 14, 44, SOIL, 4, 4, 18 + (i % 2) * 8, "stalk", "cyl") for i in range(4)] + [b(26, 40, SOIL, 50, 20, 4, "litter", "round")],
           {"stalk": slot("wood", 2), "litter": slot("autumn", 3)})

SP, SU, AU = "Spring", "Summer", "Autumn"


def plant(pid, name, seed, stages, harvest, n, thirst=2, die=5, seasons=(SP, SU, AU), tree=False, fruit_every=0, fruit_seasons=()):
    p = {"id": pid, "name": name, "seed": seed, "stages": list(stages), "models": [f"plant_{pid}_{i}" for i in range(4)],
         "dead_model": "plant_withered", "harvest": [harvest, n], "seasons": list(seasons), "thirst": thirst, "die": die}
    if tree:
        p.update({"tree": True, "fruit_every": fruit_every, "fruit_seasons": list(fruit_seasons)})
    PLANTS.append(p)


bed_stages("tomato", ("leaf", 1), ("fabric", 1), "bush")
plant("tomato", "Помідори", "seed_tomato", (0, 3, 8, 14), "tomato", 4)
bed_stages("cucumber", ("leaf", 2), ("leaf", 0), "vine")
plant("cucumber", "Огірки", "seed_cucumber", (0, 2, 6, 11), "cucumber", 4)
bed_stages("carrot", ("leaf", 3), ("autumn", 0), "root")
plant("carrot", "Морква", "seed_carrot", (0, 4, 10, 16), "carrot", 4, thirst=3, die=6)
bed_stages("potato", ("leaf", 1), ("wood", 3), "root")
plant("potato", "Картопля", "seed_potato", (0, 4, 12, 20), "potato", 6, thirst=3, die=7)
bed_stages("cabbage", ("leaf", 3), ("pastel", 2), "head")
plant("cabbage", "Капуста", "seed_cabbage", (0, 4, 12, 22), "cabbage", 2, thirst=2, die=5)
bed_stages("pumpkin", ("leaf", 1), ("autumn", 0), "big")
plant("pumpkin", "Гарбуз", "seed_pumpkin", (0, 4, 14, 26), "pumpkin_veg", 2, thirst=3, die=6, seasons=(SP, SU, AU))
bed_stages("strawberry", ("leaf", 2), ("fabric", 1), "low")
plant("strawberry", "Полуниця", "seed_strawberry", (0, 3, 8, 13), "strawberry", 5)
bed_stages("dill", ("leaf", 3), ("leaf", 3), "root")
plant("dill", "Кріп", "seed_dill", (0, 2, 5, 8), "dill", 3)
bed_stages("sunflower", ("leaf", 1), ("autumn", 3), "tall")
plant("sunflower", "Соняшник", "seed_sunflower", (0, 3, 10, 18), "sunflower_seeds", 3, thirst=3, die=7)
for tid, fruit_item, color, stages, fs, n in [
    ("apple", "apple", ("fabric", 1), (0, 7, 20, 40), (SU, AU), 5),
    ("cherry", "cherry", ("fabric", 1), (0, 7, 18, 35), (SU,), 6),
    ("pear", "pear", ("fabric", 2), (0, 8, 22, 45), (SU, AU), 4),
    ("plum", "plum", ("fabric", 3), (0, 7, 20, 40), (SU, AU), 5),
]:
    tree_stages(tid, color)
    plant(tid, {"apple": "Яблуня", "cherry": "Вишня", "pear": "Груша", "plum": "Слива"}[tid], f"sapling_{tid}", stages, fruit_item, n,
          thirst=6, die=14, tree=True, fruit_every=7, fruit_seasons=fs)

# where seeds and saplings are bought (the grocery's shelf, the flower shop's potting bench)
for sid, label, cost in [("seed_tomato", "помідорів", 3), ("seed_cucumber", "огірків", 3), ("seed_carrot", "моркви", 2), ("seed_potato", "картоплі на посів", 3),
                         ("seed_cabbage", "капусти", 2), ("seed_pumpkin", "гарбуза", 3), ("seed_strawberry", "полуниці (розсада)", 5), ("seed_dill", "кропу", 2),
                         ("seed_sunflower", "соняшника", 2)]:
    st(f"st.grocery.{sid}", "grocery_in", "shop_shelf", f"Насіння {label}", "Пакетик із картинкою на обгортці. Продавчиня радить сіяти, поки тепло.", "buy",
       cost=cost, gives=[(sid, 1)], per_day=6, hours=(8, 19))
for tid, name, cost in [("apple", "яблуні", 18), ("cherry", "вишні", 16), ("pear", "груші", 20), ("plum", "сливи", 16)]:
    st(f"st.flowers.sapling_{tid}", "flower_in", "potting_bench", f"Саджанець {name}", "Пан Петро загортає корінці у вологу мішковину: «Посадиш — і через рік будеш з плодами».", "buy",
       cost=cost, gives=[(f"sapling_{tid}", 1)], per_day=2, hours=(9, 18))
st("st.grocery.sell_veg", "grocery_in", "cash_counter", "Здати овочі з городу", "Продавчиня зважує, хвалить і відраховує монети: «Свої — завжди смачніші за привезені».", "sell",
   needs=[("#veg", 3)], earn=10, per_day=3, hours=(8, 19))

# what the garden gives goes to the stove too
recipes.append({"id": "rc.salad", "name": "Літній салат", "needs": [["tomato", 2], ["cucumber", 1], ["dill", 1]], "gives": ["salad", 1],
                "text": "Помідори, огірок, кріп і дрібка солі — смак літа з власної грядки."})
recipes.append({"id": "rc.strawberry_jam", "name": "Полуничне варення", "needs": [["strawberry", 4]], "gives": ["jam", 1],
                "text": "Ягоди з цукром, тихий вогонь і пінка, яку так хочеться злизати з ложки."})
recipes.append({"id": "rc.pumpkin_porridge", "name": "Гарбузова каша", "needs": [["pumpkin_veg", 1], ["milk", 1]], "gives": ["pumpkin_porridge", 1],
                "text": "Солодка, помаранчева, з маслом — як у бабусі восени."})
good("salad", "Літній салат", [b(22, 22, 0, 56, 56, 14, "bowl", "cyl"), b(28, 28, 10, 18, 18, 10, "tomato", "ball"), b(50, 40, 10, 22, 12, 8, "cucumber", "round"), b(36, 50, 12, 20, 16, 6, "dill", "round")],
     {"bowl": slot("ceramic", 0), "tomato": slot("fabric", 1), "cucumber": slot("leaf", 0), "dill": slot("leaf", 3)}, ("food", "dish"))
good("pumpkin_porridge", "Гарбузова каша", [b(24, 24, 0, 52, 52, 16, "bowl", "cyl"), b(28, 28, 12, 44, 44, 6, "porridge", "cyl")],
     {"bowl": slot("ceramic", 2), "porridge": slot("autumn", 1)}, ("food", "dish"))

# ---- music and painting at home ----------------------------------------------------------------------------------
for it in items:
    if it["id"] in ("piano", "guitar"):
        it["tags"] = sorted(set(it.get("tags", [])) | {"instrument"})
    if it["id"] in ("easel", "easel_outdoor"):
        it["tags"] = sorted(set(it.get("tags", [])) | {"easel"})
item("canvas_art", "decor", 1, 1, "wall", [b(6, 0, 30, 88, 6, 70, "frame", "round"), b(12, 6, 36, 76, 2, 58, "canvas")],
     {"frame": slot("wood", 3), "canvas": slot("ceramic", 0)}, "free", name="Картина власної роботи")
items[-1]["hidden"] = True
items[-1]["tags"] = ["canvas", "art"]
