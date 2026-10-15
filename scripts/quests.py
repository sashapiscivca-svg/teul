# The year of Lypove (docs/world-economy.md §9): what the town's people ask of you through the year — around its
# holidays and its seasons — and the small needs that come up on a day because something happened (someone fell
# ill, a kitten got lost, the post is heavy). Run inside gen_base_content.py after economy.py and home_life.py
# (it uses `good`, `b`, `slot`, `stations`, `st`, `recipes`, `residents`).
#
# This is a world, not a game: no quotas, no "tasks", no prizes announced. People ask; you promise or not; they
# thank you. The words are theirs. A station that has given all it has today says why, the way the world would.

QUESTS = []
JOBS = []

# ---- things that pass through your hands ------------------------------------------------------------------------
good("parcel", "Посилка", [b(26, 30, 0, 48, 40, 30, "box"), b(26, 48, 30, 48, 4, 1, "tape"), b(48, 30, 30, 4, 40, 1, "tape"), b(32, 34, 30, 14, 10, 1, "label")],
     {"box": slot("wood", 1), "tape": slot("wood", 3), "label": slot("pastel", 3)}, ("post",))
good("medicine", "Пакуночок із ліками", [b(30, 32, 0, 40, 34, 22, "bag", "round"), b(44, 44, 22, 12, 8, 6, "cross"), b(46, 40, 22, 8, 16, 6, "cross")],
     {"bag": slot("pastel", 3), "cross": slot("fabric", 0)}, ("medicine",))
good("firewood", "В'язанка дров", [b(20, 34, 0, 60, 10, 10, "log", "cyl"), b(20, 44, 0, 60, 10, 10, "log", "cyl"), b(20, 39, 9, 60, 10, 10, "log", "cyl"), b(46, 30, 0, 6, 32, 20, "rope")],
     {"log": slot("wood", 3), "rope": slot("wood", 1)}, ("wood",))
good("planks", "Дошки", [b(14, 36, 0, 72, 14, 4, "board"), b(14, 36, 4, 72, 14, 4, "board"), b(14, 36, 8, 72, 14, 4, "board")],
     {"board": slot("wood", 1)}, ("wood",))
good("photo", "Свіжий знімок", [b(28, 32, 0, 44, 36, 2, "paper"), b(32, 36, 2, 36, 26, 1, "picture")],
     {"paper": slot("pastel", 3), "picture": slot("glass", 1)}, ("paper",))
good("ball", "М'ячик", [b(36, 36, 0, 28, 28, 28, "ball", "ball"), b(36, 46, 10, 28, 8, 8, "stripe", "round")],
     {"ball": slot("fabric", 0), "stripe": slot("ceramic", 0)}, ("toy",))
good("lost_kitten", "Знайдене кошеня", [b(32, 34, 0, 34, 26, 20, "fur", "round"), b(54, 36, 14, 18, 18, 18, "fur", "ball"), b(56, 36, 30, 5, 5, 6, "ear", "cone"), b(64, 36, 30, 5, 5, 6, "ear", "cone"), b(20, 40, 8, 14, 4, 4, "tail", "round")],
     {"fur": slot("autumn", 0), "ear": slot("autumn", 0), "tail": slot("autumn", 0)}, ("pet",))
good("lost_puppy", "Знайдене цуценя", [b(28, 34, 0, 40, 26, 22, "fur", "round"), b(58, 36, 14, 20, 20, 18, "fur", "ball"), b(58, 34, 22, 6, 10, 10, "ear", "round"), b(72, 34, 22, 6, 10, 10, "ear", "round")],
     {"fur": slot("wood", 1), "ear": slot("wood", 3)}, ("pet",))
good("letter_sealed", "Лист із сургучем", [b(26, 34, 0, 48, 32, 3, "paper"), b(44, 46, 3, 10, 10, 2, "seal", "cyl")],
     {"paper": slot("pastel", 3), "seal": slot("fabric", 0)}, ("paper",))
good("overdue_book", "Забута бібліотечна книжка", [b(26, 30, 0, 48, 36, 10, "cover"), b(28, 30, 2, 44, 34, 6, "pages"), b(60, 30, 10, 6, 20, 1, "tag")],
     {"cover": slot("fabric", 4), "pages": slot("pastel", 3), "tag": slot("fabric", 2)}, ("book",))
good("umbrella", "Позичена парасолька", [b(46, 46, 0, 6, 6, 40, "handle", "cyl"), b(24, 24, 36, 52, 52, 12, "canopy", "cone")],
     {"handle": slot("wood", 3), "canopy": slot("fabric", 6)}, ("loan",))
good("pysanka", "Писанка", [b(38, 36, 0, 24, 28, 34, "egg", "ball"), b(38, 36, 14, 24, 28, 4, "band", "ball")],
     {"egg": slot("fabric", 0), "band": slot("fabric", 2)}, ("easter", "gift"))
good("wreath", "Вінок", [b(24, 24, 0, 52, 52, 10, "green", "cyl"), b(28, 26, 8, 10, 10, 8, "bloom", "ball"), b(56, 40, 8, 10, 10, 8, "bloom", "ball"), b(36, 56, 8, 10, 10, 8, "bloom2", "ball")],
     {"green": slot("leaf", 1), "bloom": slot("fabric_pink", 0), "bloom2": slot("fabric", 2)}, ("flower", "gift"))
good("herbs", "Пучок трав і гілок", [b(42, 42, 0, 10, 10, 30, "stems", "cone"), b(30, 30, 24, 40, 40, 16, "leaves", "ball")],
     {"stems": slot("leaf", 2), "leaves": slot("leaf", 0)}, ("green",))
good("verba", "Вербова гілочка", [b(46, 30, 0, 6, 40, 4, "twig"), b(44, 34, 4, 8, 6, 6, "bud", "ball"), b(44, 46, 4, 8, 6, 6, "bud", "ball"), b(44, 58, 4, 8, 6, 6, "bud", "ball")],
     {"twig": slot("wood", 3), "bud": slot("ceramic", 1)}, ("green",))
good("water_blessed", "Свячена вода", [b(38, 38, 0, 24, 24, 34, "glass", "cyl"), b(42, 42, 34, 16, 16, 8, "glass", "cyl"), b(43, 43, 42, 14, 14, 4, "cap", "cyl"), b(44, 44, 14, 12, 12, 8, "cross")],
     {"glass": slot("glass", 1), "cap": slot("fabric", 6), "cross": slot("fabric", 2)}, ("water",))
good("gift_box", "Подарунок від Миколая", [b(28, 28, 0, 44, 44, 34, "box"), b(46, 28, 0, 8, 44, 36, "ribbon"), b(28, 46, 0, 44, 8, 36, "ribbon"), b(40, 40, 34, 20, 20, 8, "bow", "ball")],
     {"box": slot("fabric", 6), "ribbon": slot("fabric", 0), "bow": slot("fabric", 0)}, ("gift",))
good("star_lantern", "Різдвяна зірка", [b(48, 48, 0, 4, 4, 40, "stick", "cyl"), b(30, 30, 36, 40, 40, 30, "star", "ball"), b(40, 40, 46, 20, 20, 10, "glow", "ball")],
     {"stick": slot("wood", 3), "star": slot("fabric", 2), "glow": slot("fabric", 0)}, ("christmas",))
good("flag", "Прапорець", [b(30, 46, 0, 4, 4, 50, "stick", "cyl"), b(34, 46, 34, 30, 2, 8, "blue"), b(34, 46, 26, 30, 2, 8, "yellow")],
     {"stick": slot("wood", 3), "blue": slot("fabric", 5), "yellow": slot("fabric", 2)}, ("flag",))
good("blessed_apples", "Освячені яблука", [b(22, 30, 0, 56, 40, 10, "basket", "round"), b(28, 34, 8, 16, 16, 16, "apple", "ball"), b(46, 36, 8, 16, 16, 16, "apple", "ball"), b(38, 46, 12, 16, 16, 16, "apple2", "ball")],
     {"basket": slot("wood", 3), "apple": slot("fabric", 0), "apple2": slot("leaf", 1)}, ("fruit", "gift"))
good("poppy_seed", "Мак на кутю", [b(30, 30, 0, 40, 40, 16, "bag", "round"), b(40, 40, 14, 20, 20, 6, "seeds", "ball")],
     {"bag": slot("pastel", 3), "seeds": slot("ceramic", 5)}, ("seeds",))
good("dried_fruit", "Сушня на узвар", [b(26, 30, 0, 48, 40, 14, "bag", "round"), b(32, 36, 12, 12, 10, 6, "fruit", "round"), b(48, 40, 12, 12, 10, 6, "fruit2", "round")],
     {"bag": slot("pastel", 3), "fruit": slot("wood", 3), "fruit2": slot("autumn", 3)}, ("fruit",))
good("gingerbread", "Медовий пряник", [b(28, 28, 0, 44, 44, 8, "dough", "cyl"), b(36, 36, 8, 28, 28, 2, "icing", "cyl")],
     {"dough": slot("wood", 3), "icing": slot("pastel", 3)}, ("food", "sweet"))
# dishes one learns from people
good("kutia", "Кутя", [b(28, 28, 0, 44, 44, 18, "bowl", "cyl"), b(30, 30, 16, 40, 40, 6, "grain", "cyl"), b(40, 40, 22, 6, 6, 2, "poppy", "ball")],
     {"bowl": slot("ceramic", 0), "grain": slot("autumn", 1), "poppy": slot("ceramic", 5)}, ("food", "dish"))
good("uzvar", "Узвар", [b(34, 34, 0, 32, 32, 36, "jug", "cyl"), b(38, 38, 34, 24, 24, 2, "drink", "cyl")],
     {"jug": slot("glass", 1), "drink": slot("wood", 3)}, ("food", "drink", "dish"))
good("paska", "Паска", [b(30, 30, 0, 40, 40, 36, "bread", "cyl"), b(30, 30, 34, 40, 40, 10, "glaze", "ball"), b(42, 42, 42, 4, 4, 3, "sprinkle")],
     {"bread": slot("wood", 3), "glaze": slot("pastel", 3), "sprinkle": slot("fabric", 0)}, ("food", "dish", "easter"))
good("kalach", "Калач", [b(22, 22, 0, 56, 56, 16, "crust", "cyl"), b(32, 32, 14, 36, 36, 6, "braid", "cyl")],
     {"crust": slot("wood", 3), "braid": slot("wood", 1)}, ("food", "dish"))
good("cherry_varenyky", "Вареники з вишнями", [b(24, 28, 0, 52, 44, 8, "plate", "cyl")] + [b(30 + (i % 3) * 13, 34 + (i // 3) * 14, 6, 14, 10, 8, "dumpling", "round") for i in range(6)] + [b(44, 44, 12, 6, 6, 3, "cherry", "ball")],
     {"plate": slot("ceramic", 0), "dumpling": slot("pastel", 3), "cherry": slot("fabric", 0)}, ("food", "dish"))

LEARNED = [
    ("rc.kutia", "Кутя", [("wheat_ear", 2), ("honey", 1), ("poppy_seed", 1)], ("kutia", 1), "Пшениця, мак і мед — головна страва Святвечора, як учила баба Злата."),
    ("rc.uzvar", "Узвар", [("dried_fruit", 1), ("water_jar", 1), ("honey", 1)], ("uzvar", 1), "Сушня, вода і ложка меду: запах Святвечора."),
    ("rc.paska", "Паска", [("flour", 1), ("eggs", 1), ("milk", 1), ("honey", 1)], ("paska", 1), "Висока, з глазур'ю і посипкою — Остап показав, як не дати їй осісти."),
    ("rc.kalach", "Калач", [("flour", 1), ("eggs", 1), ("honey", 1)], ("kalach", 1), "Плетений, як на вечорниці: Софія вміє заплітати тісто, як коси."),
    ("rc.cherry_varenyky", "Вареники з вишнями", [("flour", 1), ("cherry", 2)], ("cherry_varenyky", 2), "Вишня з кісточкою чи без — у кожної родини своя правда."),
]
for rid, name, needs, gives, text in LEARNED:
    recipes.append({"id": rid, "name": name, "needs": [list(n) for n in needs], "gives": list(gives), "text": text, "learn": True})

# ---- fairs on the holidays, and what the market sells all year --------------------------------------------------
def fair(id, prop, label, text, gives, cost, days, per_day=2):
    st(id, "village", prop, label, text, "buy", cost=cost, gives=gives, per_day=per_day, hours=(8, 20))
    stations[-1]["days"] = days


fair("st.fair.kutia_wheat", "stall_veg", "Пшениця на кутю", "Дядько з ярмарку відсипає дві жмені пшениці: «На кутю — без торгу».", [("wheat_ear", 2)], 3, "christmas_eve")
fair("st.fair.poppy", "stall_veg", "Мак на кутю", "Сизий мак, уже перемитий. «Терти не забудь», — каже продавчиня.", [("poppy_seed", 1)], 3, "christmas_eve")
fair("st.fair.dried", "stall_bread", "Сушня на узвар", "Яблука, груші й сливи, сушені ще влітку.", [("dried_fruit", 1)], 4, "christmas_eve")
fair("st.fair.pancakes", "stall_bread", "Млинці з ятки", "Масляна! Млинці зі сметаною просто з пательні.", [("pancakes", 1)], 5, "maslyana", 3)
fair("st.fair.pysanka", "stall_flowers", "Писанка від майстрині", "Червоні, з вісьмиконечною зіркою — майстриня розписувала їх цілий тиждень.", [("pysanka", 1)], 8, "easter")
fair("st.fair.gingerbread", "stall_bread", "Медовий пряник", "Пряник із глазур'ю на мотузочці: на Медовий Спас — святе діло.", [("gingerbread", 1)], 4, "honey_spas", 3)
fair("st.fair.apples", "stall_veg", "Яблука на Спаса", "Кошик яблук, щоб нести святити.", [("apple", 3)], 4, "apple_spas")
fair("st.fair.flags", "stall_flowers", "Прапорець", "Синьо-жовтий, на паличці. На День Незалежності вся площа такими.", [("flag", 1)], 2, "independence", 3)
fair("st.fair.wreath", "stall_flowers", "Вінок на Купала", "Плетений з польових квітів і полину.", [("wreath", 1)], 6, "kupala")
fair("st.fair.nicholas", "stall_bread", "Миколайчик", "Пряничок у формі святого Миколая — для слухняних і не дуже.", [("gingerbread", 1)], 3, "st_nicholas", 3)
st("st.grocery.flour", "grocery_in", "cash_counter", "Купити борошно", "Пакунок борошна вищого ґатунку з хлібзаводу «Колос».", "buy", cost=8, gives=[("flour", 1)], per_day=2, hours=(7, 21))

# ---- what the world says when it has given all it has today ---------------------------------------------------
SPENT = {
    "st.fountain.wish": "Досить бажань на сьогодні — хай ці встигнуть збутися.",
    "st.fountain.charm": "На дні лише монетки. Обереги знаходять не щодня.",
    "st.notice_board.read": "Ти вже прочитав(ла) кожен клаптик на дошці.",
    "st.telescope.stars": "Небо затягнуло — зорі сховалися.",
    "st.stall_bread.bun": "Булочки розібрали, на ятці лишилися крихти.",
    "st.stall_veg.carrot": "Моркву вже розкупили.",
    "st.stall_veg.potato": "Картопля скінчилася — продавчиня згортає мішки.",
    "st.stall_veg.seeds": "Насіння вже все розійшлося.",
    "st.stall_flowers.bouquet": "Букети розібрали ще зранку.",
    "st.carousel.ride": "Карусельник змащує механізм — на сьогодні годі.",
    "st.swing.swing": "На гойдалці вже дітлахи — їхня черга.",
    "st.birdbath.feed": "Пташки вже наїлися й дрімають на гілках.",
    "st.bakery.bread": "Пекарня вже розпродала паляниці.",
    "st.bakery.pie": "Останній пиріг щойно забрали.",
    "st.bakery.flour": "Пекар уже має борошна досхочу.",
    "st.bakery.bake_pie": "Піч уже вистигає — пекар зачиняє заслінку.",
    "st.cafe.coffee": "Кавоварка перегрілася — офіціантка махає рукою: «Досить кави на сьогодні!»",
    "st.cafe.cocoa": "Какао скінчилося.",
    "st.cafe.lemonade": "Лимонад випили до краплі.",
    "st.cafe.fish": "Кухар каже, що риби на сьогодні досить — холодильник повний.",
    "st.grocery.fruit": "Крамниця вже набрала фруктів, більше не візьмуть.",
    "st.grocery.berries": "Ягід уже вистачає — продавчиня розводить руками.",
    "st.grocery.mushrooms": "Грибів сьогодні вже принесли повний кошик.",
    "st.grocery.milk": "Молоко розібрали.",
    "st.grocery.honey": "Мед закінчився, нова партія — з пасіки.",
    "st.grocery.flour": "Борошно розкупили.",
    "st.flowers.make_bouquet": "Петро вже склав усі букети, які мав на сьогодні.",
    "st.flowers.buy": "Букетів не лишилося — тільки зелень на вітрині.",
    "st.library.borrow": "Бібліотекарка м'яко нагадує: спершу прочитай ту, що вдома.",
    "st.library.return": "Ти вже все повернув(ла).",
    "st.church.candle": "Свічка вже горить.",
    "st.church.organ": "Органіст пішов додому.",
    "st.cemetery.flowers": "Квіти вже лежать.",
    "st.radio.song": "Ефір розписаний до вечора.",
    "st.radio.record": "Платівок більше немає.",
    "st.newsroom.ad": "Оголошення вже в номері — більше не вміститься.",
    "st.newsroom.paper": "Ти прочитав(ла) свіжий номер від першої до останньої сторінки.",
    "st.townhall.postcard": "Листівки розібрали.",
    "st.gym.train": "Тренерка каже: «На сьогодні досить, м'язам треба відпочити».",
    "st.gym.box": "Груша ще гойдається — руки гудуть.",
    "st.vet.stray": "Котик уже ситий і спить.",
    "st.hostel.rest": "Вільних ліжок немає.",
    "st.bar.lemonade": "Барменка розводить руками: лимонад скінчився.",
    "st.bar.wine": "Бар уже має вина досхочу.",
    "st.bar.jukebox": "Автомат зажував монетку і замовк.",
    "st.bar.darts": "Дротики хтось уже забрав.",
    "st.tower.lookout": "Доглядач зачиняє майданчик.",
    "st.tower.water": "Кран сичить — воду перекрили до ранку.",
    "st.forest.campfire": "Вогнище догоріло.",
    "st.forest.bake_potato": "Жар уже прогорів.",
    "st.forest.lookout": "Лісничка зачинила вишку.",
    "st.forest.sawmill": "Пилорама вже стала — робітники п'ють чай.",
    "st.farm.milk": "Корову вже подоїли зранку.",
    "st.farm.eggs": "Кури вже знеслися — гнізда порожні.",
    "st.farm.well": "Відро вже на дні — нехай вода набереться.",
    "st.farm.honey": "Бджоли сердяться — нехай відпочинуть.",
    "st.farm.shear": "Вівці вже стрижені.",
    "st.farm.corn": "Кукурудзу вже наламали.",
    "st.farm.hay": "Сіно вже згребли.",
    "st.farm.feed": "Худоба вже нагодована.",
    "st.creamery.cheese": "Сироварня вже повна — сири дозрівають.",
    "st.creamery.spin": "Прядка стоїть: Уляна каже, що на сьогодні напрялися.",
    "st.creamery.scarf": "Верстат зайнятий.",
    "st.creamery.mittens": "Спиці відпочивають.",
    "st.creamery.pouch": "Кравчиня вже шиє іншу торбинку.",
    "st.creamery.sell_cheese": "Сиру вже досить на полицях.",
    "st.fields.wheat": "Тут уже нажали — нехай колоски підростуть.",
    "st.fields.pass": "Каса іподрому зачинилася.",
    "st.factory.mill": "Млин стоїть — мірошник змітає борошно.",
    "st.vineyard.grapes": "Ці лози вже обібрані.",
    "st.vineyard.juice": "Прес уже вимили.",
    "st.winery.wine": "Бочки повні.",
    "st.winery.buy": "Пляшки на сьогодні розпродали.",
    "st.hippodrome.race": "Забіги скінчилися.",
    "st.hippodrome.horse": "Буревій уже наївся морквою.",
    "st.cave.minecart": "Вагонетка застрягла — завтра підмажуть.",
}
KIND_SPENT = {
    "buy": "Сьогодні вже все розібрали.",
    "sell": "Більше сьогодні не візьмуть — уже досить.",
    "make": "Майстерня на сьогодні відпочиває.",
    "gather": "Тут уже все зібрано.",
    "play": "На сьогодні досить — завтра знову.",
    "wish": "Досить на сьогодні.",
    "read": "Ти вже все прочитав(ла).",
    "ride": "Покатаєшся іншим разом.",
    "rest": "Уже відпочив(ла).",
}
for s in stations:
    s["spent"] = SPENT.get(s["id"]) or s.get("spent") or KIND_SPENT.get(s["kind"], "На сьогодні вже все.")

# ---- the people ---------------------------------------------------------------------------------------------------
_names = {r["id"]: r["name"] for r in residents}


def who(id):
    return _names.get(id) or {"marta": "Марта", "ostap": "Остап", "solomiia": "Соломія", "panas": "Дід Панас", "yarynka": "Яринка",
                              "taras": "Тарас", "olena": "Олена", "myron": "Мирон"}[id]


PRIEST, POSTMAN, CLERK_POST = "res_81", "res_93", "res_92"
BAKER, BAKER2 = "res_48", "res_55"
LIBRARIAN, TEACHER, TEACHER2, TEACHER3 = "res_66", "res_27", "res_35", "res_36"
DOCTOR, DOCTOR2, NURSE, NURSE2 = "res_4", "res_12", "res_31", "res_33"
VET = "res_87"
FARMER, FARMER2, FARMER3 = "res_40", "res_47", "res_56"
CHEESE, WEAVER = "res_67", "res_89"
FORESTER = "res_96"
HARVESTER, HARVESTER2 = "res_97", "res_98"
CARETAKER = "res_105"
MAYOR = "res_16"
EDITOR, PHOTOGRAPHER = "res_30", "res_39"
RADIO = "res_10"
POLICE = "res_6"
VENDOR = "res_76"
FLORIST = "res_86"
COLLECTOR, CRAFTSMAN = "res_78", "res_72"
GRANNY_ZLATA, GRANDPA_VASYL = "res_1", "res_2"
GRANNY_LUDA, GRANNY_ZLATA_M = "res_53", "res_54"
OLD_OLEH, OLD_PETRO = "res_32", "res_41"
SOFIA, OREST = "res_106", "res_107"
UTILITY_INSPECTOR = "res_95"
FIREFIGHTER = "res_19"


def go(text, location, hours=None, who=None, done="", gives=()):
    a = {"do": "go", "location": location}
    if hours:
        a["hours"] = list(hours)
    return _stage(text, a, who, done, gives)


def bring(text, location, items, who=None, done="", gives=()):
    return _stage(text, {"do": "bring", "location": location, "items": [list(i) for i in items]}, who, done, gives)


def use(text, station, done="", gives=()):
    return _stage(text, {"do": "use", "station": station}, None, done, gives)


def cook(text, recipe, done=""):
    return _stage(text, {"do": "cook", "recipe": recipe}, None, done, ())


def gather(text, location, item=None, done="", gives=()):
    a = {"do": "gather", "location": location}
    if item:
        a["item"] = item
    return _stage(text, a, None, done, gives)


def wait(text, days, done=""):
    return _stage(text, {"do": "wait", "days": days}, None, done, ())


def choose(text, options, location=None, who=None):
    a = {"do": "choose", "options": options}
    if location:
        a["location"] = location
    return _stage(text, a, who, "", ())


def opt(label, text="", reward=None, goto=None):
    o = {"label": label, "text": text}
    if reward:
        o["reward"] = reward
    if goto is not None:
        o["goto"] = goto
    return o


def _stage(text, act, who, done, gives):
    s = {"text": text, "act": act}
    if who:
        s["who"] = who
    if done:
        s["done"] = done
    if gives:
        s["gives"] = [list(g) for g in gives]
    return s


def thanks(coins=0, items=(), recipes=(), title=None, rep=0, hearts=()):
    r = {"coins": coins, "items": list(items), "recipes": list(recipes), "rep": rep, "hearts": [list(h) for h in hearts]}
    if title:
        r["title"] = title
    return r


def holiday(h, before=0, after=0, days=0):
    return {"holiday": h, "before": before, "after": after, "days": days}


def dates(fm, fd, tm, td, days=0):
    return {"from": [fm, fd], "to": [tm, td], "days": days}


def quest(id, title, giver, offer, intro, stages, bye, when=None, reward=None, after=(), start_gives=(), requires=None, kind=None):
    q = {"id": id, "title": title, "giver": giver, "giver_name": who(giver) if giver != "board" else "Дошка оголошень на площі",
         "offer": offer, "intro": intro, "stages": stages, "bye": bye, "reward": reward or thanks()}
    if when:
        q["when"] = when
    if kind:
        q["kind"] = kind
    if after:
        q["after"] = list(after)
    if start_gives:
        q["start_gives"] = [list(g) for g in start_gives]
    if requires:
        q["requires"] = requires
    QUESTS.append(q)


# ================================================================================================================
# The year
# ================================================================================================================

# ---- січень -----------------------------------------------------------------------------------------------------
quest("cal.new_year_visit", "Новорічні гостинці для баби Злати", GRANNY_ZLATA, "village",
      "Баба Злата Коваль цього року не змогла спекти нічого солодкого — руки болять. «Хоч би медовичок до чаю, як колись…»",
      [cook("Спекти медовик удома", "rc.honey_cake", "Коржі вийшли рівні, крем — як у баби Злати колись."),
       bring("Занести медовик бабі Златі", "village", [("honey_cake", 1)], GRANNY_ZLATA, "Баба Злата сплеснула руками й одразу поставила чайник.")],
      "«Дитино, та ти ж мені свято зробила. Ось, візьми рукавички — я їх ще восени плела».",
      holiday("new_year", 0, 6), thanks(items=["mittens"], rep=2, hearts=[(GRANNY_ZLATA, 60)]))
quest("cal.vodokhreshche", "Свячена вода для Людмили", PRIEST, "church_in",
      "Отець Павло просить: баба Людмила Мельник не дійде до храму на Водохреще, а дуже хоче свяченої води.",
      [go("Прийти на водосвяття до костелу зранку", "church_in", (7, 13), PRIEST, "Вода холодна, як лід, а в храмі тепло від свічок.", [("water_blessed", 1)]),
       bring("Віднести свячену воду бабі Людмилі", "village", [("water_blessed", 1)], GRANNY_LUDA, "Людмила перехрестилася й заплакала від радості.")],
      "Отець Павло потис руку: «Добре серце — найкраща молитва».",
      holiday("epiphany", 1, 1), thanks(rep=3, hearts=[(PRIEST, 40), (GRANNY_LUDA, 60)]))
quest("cal.winter_firewood", "Дрова для Олега Олійника", OLD_OLEH, "village",
      "Дідові Олегу забракло дров — морози, а сили вже не ті. Пилорама в лісі віддає обрізки задарма.",
      [go("Попросити обрізків на пилорамі в лісі", "forest", (8, 17), None, "Пилярі зв'язали тобі дві в'язанки.", [("firewood", 2)]),
       bring("Занести дрова дідові Олегу", "village", [("firewood", 2)], OLD_OLEH, "У хаті одразу запахло смолою.")],
      "«Тепер дотягну до весни. Спасибі, що не забули старого».",
      dates(1, 2, 2, 28), thanks(coins=10, rep=2, hearts=[(OLD_OLEH, 60)]))
quest("cal.ice_fishing", "Зимова юшка для діда Петра", OLD_PETRO, "village",
      "Дід Петро Петренко сорок зим ходив на ополонку, а тепер ноги не пускають. «Хоч би юшки з нашої риби…»",
      [gather("Наловити риби на ставку в селі", "village"),
       cook("Зварити юшку вдома", "rc.fish_soup"),
       bring("Віднести юшку дідові Петру", "village", [("fish_soup", 1)], OLD_PETRO, "Дід скуштував і замовк — тільки кивав.")],
      "«Як на ставку з дідом моїм. Візьми підкову — вона мені колись щастила».",
      dates(1, 8, 2, 20), thanks(items=["horseshoe"], rep=2, hearts=[(OLD_PETRO, 80)]))
quest("cal.winter_reading", "Зимові читання в бібліотеці", LIBRARIAN, "library_in",
      "Наталія Гончар збирає людей на зимові читання: хто прочитає книжку, розкаже про неї на вечорі.",
      [use("Взяти книжку в бібліотеці", "st.library.borrow"),
       wait("Почитати вдома кілька вечорів", 2),
       choose("Що сказати про книжку на читаннях?", [
           opt("«Плакав(ла) над останніми сторінками»", "Наталія тихо всміхнулася: «Значить, вона жива».", thanks(hearts=[(LIBRARIAN, 40)])),
           opt("«Сміявся(лася) на весь дім»", "Зала засміялася разом із тобою.", thanks(rep=1))], "library_in", LIBRARIAN),
       use("Повернути книжку", "st.library.return")],
      "«Приходьте ще. Книжки сумують на полицях».",
      dates(1, 10, 2, 10), thanks(title="Читач Липового", rep=2))

# ---- лютий ------------------------------------------------------------------------------------------------------
quest("cal.valentine_letter", "Лист для Ореста", SOFIA, "village",
      "Софія Кравець червоніє і простягає конверт: «Передай Орестові Сидоренку… тільки не кажи, від кого. Хоча… ну, як хочеш».",
      [choose("Що зробити з листом?", [
           opt("Передати Орестові, як просили", "Орест довго крутив конверт у руках і всміхався."),
           opt("Сказати Софії: «Скажи йому сама»", "Софія зітхнула… і пішла до нього сама. Через годину їх бачили разом біля фонтану.", thanks(rep=1), goto=2)],
           "village", SOFIA),
       bring("Передати лист Орестові Сидоренку", "village", [("letter_sealed", 1)], OREST, "Орест прочитав і пішов купувати квіти."),
       go("Глянути ввечері на площу", "village", (18, 23), None, "Біля фонтану двоє тримаються за руки. Здається, ти щось бачив(ла) правильно.")],
      "Софія підморгує тобі з-за плеча Ореста.",
      holiday("valentine", 2, 0), thanks(hearts=[(SOFIA, 80), (OREST, 40)]), start_gives=[("letter_sealed", 1)])
quest("cal.maslyana", "Млинці на Масляну", GRANNY_ZLATA_M, "village",
      "Баба Злата Мельник каже: Масляна без млинців — як весна без сонця. А в неї скінчилося борошно.",
      [cook("Напекти млинців удома", "rc.pancakes"),
       bring("Пригостити бабу Злату млинцями", "village", [("pancakes", 2)], GRANNY_ZLATA_M, "«Тонесенькі! А перший грудкою був? То й добре — так і треба».")],
      "«Прощай, зимо. Візьми баночку варення — до млинців».",
      holiday("maslyana", 0, 6), thanks(items=["jam"], rep=2, hearts=[(GRANNY_ZLATA_M, 60)]))
quest("cal.frozen_pipe", "Вода, поки чинять трубу", UTILITY_INSPECTOR, "utility_in",
      "Злата Руденко з комунальної: на вулиці замерзла труба, поки лагодять — людям треба води.",
      [use("Набрати води в криниці на фермі", "st.farm.well"),
       bring("Віднести воду в контору", "utility_in", [("water_jar", 1)], UTILITY_INSPECTOR, "Злата записала тебе в зошит «Хто допомагав». Щоправда, такого зошита ніхто не бачив.")],
      "«Трубу відігріли. Липове тримається, коли люди тримаються разом».",
      dates(1, 15, 2, 28), thanks(coins=12, rep=2))
quest("cal.winter_cats", "Голодні коти взимку", VET, "vet_in",
      "Ветеринар Святослав Лисенко хвилюється: у мороз безпритульні коти не знаходять їжі.",
      [gather("Впіймати рибу", "village"),
       use("Нагодувати котика біля ветклініки", "st.vet.stray")],
      "«Рудий навіть дозволив себе погладити. Це перемога».",
      dates(1, 15, 2, 28), thanks(rep=2, hearts=[(VET, 50)]))
quest("cal.snowman", "Снігова баба біля школи", TEACHER, "school_in",
      "Орест Савчук вийшов з класом на подвір'я: «Хто покаже, як ліпити справжню снігову бабу?»",
      [go("Прийти на шкільне подвір'я після уроків", "school_in", (12, 16), TEACHER),
       choose("Якою буде снігова баба?", [
           opt("З морквою і відром, як годиться", "Діти несуть морквину з дому й відро з підсобки.", thanks(hearts=[(TEACHER, 30)])),
           opt("Снігова баба-космонавт", "Відро стає шоломом, а гілки — антенами. Учитель фотографує для газети.", thanks(rep=1))], "school_in")],
      "Діти махають тобі з вікна класу ще тиждень.",
      dates(1, 12, 2, 28), thanks(rep=1))

# ---- березень ---------------------------------------------------------------------------------------------------
quest("cal.march_eighth", "Квіти для баби Злати від діда Василя", GRANDPA_VASYL, "village",
      "Дід Василь Коваль шепоче: «П'ятдесят років я дарую їй квіти. А цього разу ноги не несуть до квіткової…»",
      [use("Купити букет у квітковій «Півонія»", "st.flowers.buy"),
       bring("Віддати букет дідові Василю", "village", [("bouquet", 1)], GRANDPA_VASYL, "Дід сховав букет за спину й рушив додому, ніби на побачення.")],
      "Ввечері баба Злата розповідає всій вулиці, який у неї чоловік.",
      holiday("womens_day", 1, 0), thanks(rep=2, hearts=[(GRANDPA_VASYL, 60), (GRANNY_ZLATA, 30)]))
quest("cal.spring_cleanup", "Весняне прибирання на звалищі", COLLECTOR, "dump",
      "Микола Шевченко зі звалища: під снігом знайшлося багато доброго мотлоху. Може, щось ще послужить?",
      [gather("Пошукати щось путнє на звалищі", "dump"),
       bring("Віднести знахідку в майстерню «Друге життя»", "workshop_in", [("#worn", 1)], CRAFTSMAN, "Вікторія Руденко оглянула річ: «Ще поживе!»")],
      "«Ось бачиш — не все те сміття, що лежить на звалищі».",
      dates(3, 5, 4, 10), thanks(coins=10, rep=2))
quest("cal.birdhouses", "Шпаківні для школи", FORESTER, "forest",
      "Лісничка Зоряна Литвин: шпаки вже летять, а шпаківень обмаль. Школярі змайструють, якщо будуть дошки.",
      [go("Попросити дощок на пилорамі", "forest", (8, 17), None, "Пилярі відібрали рівні дошки.", [("planks", 2)]),
       bring("Віднести дошки до школи", "school_in", [("planks", 2)], TEACHER, "За тиждень на кожній липі біля школи висить шпаківня.")],
      "Зоряна каже, що цієї весни шпаки співають голосніше. Може, й справді.",
      dates(3, 10, 4, 20), thanks(rep=3, hearts=[(FORESTER, 40)]))
quest("cal.palm_sunday", "Вербова гілочка для баби Людмили", PRIEST, "church_in",
      "Вербна неділя. Баба Людмила Мельник сумує, що не дійде святити вербу.",
      [go("Прийти до костелу на святе", "church_in", (7, 13), PRIEST, "Отець кропить вербу, діти сміються від холодних крапель.", [("verba", 1)]),
       bring("Віднести вербу бабі Людмилі", "village", [("verba", 1)], GRANNY_LUDA, "«Не я б'ю — верба б'є!» — сміється баба й легенько торкає тебе гілочкою.")],
      "За тиждень Великдень — баба Людмила вже рахує дні.",
      holiday("palm_sunday", 1, 0), thanks(rep=2, hearts=[(GRANNY_LUDA, 50)]))
quest("cal.sowing_seeds", "Насіння для городу", FARMER, "farm",
      "Остап Петренко з ферми збирається сіяти соняшник по краю поля. Насіння на ринку, а в нього — трактор.",
      [use("Купити насіння соняшника на ринку", "st.stall_veg.seeds"),
       bring("Занести насіння на ферму", "farm", [("sunflower_seeds", 1)], FARMER, "Остап висипав насіння в сівалку.")],
      "«Восени буде золото на півполя. Приходь подивитися».",
      dates(3, 15, 4, 30), thanks(coins=8, rep=1, hearts=[(FARMER, 30)]))

# ---- квітень ----------------------------------------------------------------------------------------------------
quest("cal.pysanky", "Писанки до Великодня", GRANNY_ZLATA, "village",
      "Баба Злата Коваль щороку розписує писанки для всієї вулиці. Цього року в неї обмаль яєць.",
      [use("Зібрати яйця на фермі", "st.farm.eggs"),
       bring("Віднести яйця бабі Златі", "village", [("eggs", 1)], GRANNY_ZLATA, "Баба вже розтоплює віск.", [("pysanka", 1)]),
       choose("Що зробити з писанкою?", [
           opt("Залишити собі", "Писанка лягає на полицю — до наступного Великодня."),
           opt("Віднести в костел до кошика для самотніх", "Отець Павло поклав її в кошик з написом «Від сусідів».", thanks(rep=2, hearts=[(PRIEST, 30)]))], "village")],
      "«А паску я тебе навчу пекти. Ні, не я — Остап із пекарні. Скажи, що від мене».",
      holiday("easter", 7, 0), thanks(hearts=[(GRANNY_ZLATA, 50)], rep=1))
quest("cal.paska", "Паска з Остапом", BAKER, "bakery_in",
      "Пекар Остап Сидоренко: «Баба Злата казала — навчити? Навчу. Тільки тісто не любить поспіху й протягів».",
      [choose("Слухати Остапа", [opt("Слухати уважно й записувати", "Ти записуєш: «не відчиняти духовку, не грюкати дверима».", thanks(recipes=["rc.paska"]))], "bakery_in", BAKER),
       cook("Спекти паску вдома", "rc.paska"),
       bring("Показати паску Остапові", "bakery_in", [("paska", 1)], BAKER, "Остап постукав по скоринці й кивнув: «Наша людина»."),],
      "«Христос воскрес! Тепер і ти пекар, трохи».",
      holiday("easter", 6, 0), thanks(rep=2, hearts=[(BAKER, 60)]), after=["cal.pysanky"])
quest("cal.first_garden", "Перша грядка", FARMER2, "farm",
      "Олександра Сидоренко копає город і кличе на поміч: «Руки до землі — і весна твоя».",
      [go("Прийти на ферму зранку", "farm", (6, 12), FARMER2, "Земля пахне так, що хочеться її їсти. Майже."),
       use("Нагодувати худобу, поки Олександра сапає", "st.farm.feed")],
      "«Восени принесу тобі моркви. Це обіцянка, не подяка».",
      dates(4, 1, 5, 10), thanks(coins=10, rep=1, hearts=[(FARMER2, 40)]))
quest("cal.chamomile_tea", "Ромашковий чай для лікарні", NURSE2, "hospital_in",
      "Медсестра Лідія Дячук: «Хворим найкраще ромашковий чай, а аптечний якийсь не такий».",
      [gather("Нарвати ромашки в полі", "fields", "chamomile"),
       use("Набрати води в криниці", "st.farm.well"),
       cook("Заварити чай удома", "rc.herbal_tea"),
       bring("Занести чай у лікарню", "hospital_in", [("herbal_tea", 2)], NURSE2, "У палаті запахло полем.")],
      "«От бачите — і ліки пити не хочеться, коли є чай».",
      dates(4, 15, 6, 15), thanks(coins=12, rep=2, hearts=[(NURSE2, 50)]))
quest("cal.provody", "Проводи на кладовищі", CARETAKER, "cemetery",
      "Тиждень після Великодня. Доглядач Роман Сидоренко прибирає кладовище — на Проводи прийде все Липове.",
      [use("Купити букет", "st.stall_flowers.bouquet"),
       use("Покласти квіти на старі занедбані могили", "st.cemetery.flowers")],
      "«Тут лежать ті, кого вже ніхто не провідує. Дякую, що згадав(ла)».",
      holiday("easter", 0, 9), thanks(rep=3, hearts=[(CARETAKER, 40)]))

# ---- травень ----------------------------------------------------------------------------------------------------
quest("cal.toloka", "Толока в парку", MAYOR, "townhall_in",
      "Голова громади Матвій Гончар скликає толоку: полагодити лавки в парку до літа.",
      [go("Взяти дошки на пилорамі", "forest", (8, 17), None, "Пилярі знають про толоку.", [("planks", 2)]),
       bring("Принести дошки на площу", "village", [("planks", 2)], MAYOR, "Лавки скриплять уже по-новому — бадьоро.")],
      "Матвій вивішує на дошці: «Дякуємо всім, хто прийшов». Твоє ім'я там теж є.",
      holiday("labour_day", 0, 3), thanks(coins=15, rep=3))
quest("cal.remembrance", "Свічка пам'яті", PRIEST, "church_in",
      "Восьме травня. Отець Павло просить запалити свічку за тих, хто не повернувся.",
      [use("Запалити свічку в костелі", "st.church.candle"),
       use("Купити квіти", "st.stall_flowers.bouquet"),
       use("Покласти квіти на кладовищі", "st.cemetery.flowers")],
      "Тиша на кладовищі сьогодні особлива.",
      holiday("remembrance", 0, 0), thanks(rep=3, hearts=[(PRIEST, 30)]))
quest("cal.swarm", "Рій на яблуні", FARMER3, "farm",
      "Богдан Шевченко біжить через поле: «Рій вилетів! Сів на стару яблуню — допоможи, поки не полетів далі!»",
      [go("Прибігти до яблуні на фермі", "farm", (7, 19), FARMER3),
       choose("Що робити з роєм?", [
           opt("Тримати драбину, поки Богдан струшує рій у ройовню", "Рій гуде, але слухняно сиплеться у ройовню.", thanks(items=["honey"], hearts=[(FARMER3, 60)])),
           opt("Покликати сусіда-пасічника", "Сусід прибіг із димарем і спокійно все зробив. Богдан пригостив обох медом.", thanks(items=["honey"]))], "farm")],
      "«Тепер у мене на один вулик більше. Медом поділюся — тільки нагадай».",
      dates(5, 5, 6, 10), thanks(rep=1))
quest("cal.exam_books", "Книжки до іспитів", TEACHER2, "school_in",
      "Іван Руденко: «Іспити на носі, а в класі не вистачає підручників. У бібліотеці є, але хто ж принесе…»",
      [use("Взяти книжку в бібліотеці", "st.library.borrow"),
       bring("Занести книжку в клас", "school_in", [("book", 1)], TEACHER2, "Учні передають книжку з рук у руки, як скарб.")],
      "«Здадуть — подякують і тобі. Принаймні я подякую точно».",
      dates(5, 10, 6, 5), thanks(rep=2, hearts=[(TEACHER2, 40)]))
quest("cal.lilac", "Польові квіти для вітрини", FLORIST, "flower_in",
      "Флорист Петро Дячук хоче зробити вітрину з польових квітів: «Щоб люди йшли і всміхалися».",
      [gather("Нарвати квітів у полі", "fields"),
       bring("Принести квіти в «Півонію»", "flower_in", [("#flower", 3)], FLORIST, "Петро ставить квіти в старий глечик посеред вітрини.")],
      "Перехожі справді зупиняються біля вітрини.",
      dates(5, 1, 6, 30), thanks(coins=12, rep=1, hearts=[(FLORIST, 40)]))

# ---- червень ----------------------------------------------------------------------------------------------------
quest("cal.childrens_day", "Солодощі на дитяче свято", TEACHER, "village",
      "Перше червня. На площі дитяче свято, а булочок для малечі не вистачає.",
      [use("Купити булочку на ятці", "st.stall_bread.bun"),
       bring("Віднести солодке на площу дітям", "village", [("#sweet", 1)], TEACHER, "Діти ділять булочку на шістьох — і всім вистачає.")],
      "Хтось із малюків малює тебе крейдою на бруківці. Схоже.",
      holiday("childrens_day", 0, 0), thanks(rep=2, hearts=[(TEACHER, 30)]))
quest("cal.trinity", "Клечання на Трійцю", GRANNY_ZLATA_M, "village",
      "Баба Злата Мельник: «На Зелені свята хату прикрашають гілками й травами, а я до лісу не дійду».",
      [go("Нарвати трав і гілок у лісі", "forest", None, None, "Липа, клен, чебрець, любисток — пахне, як у дитинстві.", [("herbs", 1)]),
       bring("Віднести зелень бабі Златі", "village", [("herbs", 1)], GRANNY_ZLATA_M, "Баба розкладає траву на підвіконні й під порогом.")],
      "«Тепер і хата свята. І ти теж — трохи».",
      holiday("trinity", 2, 0), thanks(rep=2, hearts=[(GRANNY_ZLATA_M, 50)]))
quest("cal.kupala", "Вінок на Купала", SOFIA, "village",
      "Софія Кравець: «Сплетемо вінки й пустимо на ставок? Чий далі попливе — та й щаслива!»",
      [gather("Нарвати польових квітів", "fields"),
       bring("Сплести вінок із Софією на площі", "village", [("#flower", 3)], SOFIA, "Пальці не слухаються, але Софія допомагає.", [("wreath", 1)]),
       choose("Що зробити з вінком?", [
           opt("Пустити на ставок", "Вінок пливе далеко-далеко, повз очерет. Софія плескає в долоні.", thanks(rep=1)),
           opt("Подарувати Софії", "Софія чомусь червоніє й одягає вінок.", thanks(hearts=[(SOFIA, 60)]))], "village", SOFIA)],
      "Над ставком співають до самого ранку.",
      holiday("kupala", 1, 0), thanks(rep=1))
quest("cal.haymaking", "Сінокіс", HARVESTER, "fields",
      "Тетяна Шевченко з поля: «Сіно сохне, а дощ обіцяли. Кожні руки на вагу золота».",
      [use("Набрати сіна на фермі", "st.farm.hay"),
       go("Допомогти скласти копицю в полі", "fields", (6, 19), HARVESTER, "Копиця виходить кривувата, але міцна.")],
      "«Встигли! Тепер хай собі ллє».",
      dates(6, 10, 7, 10), thanks(coins=15, rep=2, hearts=[(HARVESTER, 40)]))
quest("cal.constitution_concert", "Концерт на радіо", RADIO, "radio_in",
      "Олег Бондар із «Липове FM» робить святковий ефір і шукає, хто замовить пісню для всього Липового.",
      [go("Прийти на радіо ввечері", "radio_in", (17, 21), RADIO),
       use("Замовити пісню для всіх", "st.radio.song")],
      "Твою пісню чути з кожного вікна.",
      holiday("constitution", 0, 0), thanks(items=["record"], rep=2, hearts=[(RADIO, 40)]))

# ---- липень -----------------------------------------------------------------------------------------------------
quest("cal.statehood_flags", "Прапорці на площі", MAYOR, "townhall_in",
      "Матвій Гончар готує площу до Дня Державності: прапорці є, рук нема.",
      [go("Взяти прапорці в ратуші", "townhall_in", (9, 17), MAYOR, "Цілий оберемок синьо-жовтих прапорців.", [("flag", 2)]),
       bring("Розвісити прапорці на площі", "village", [("flag", 2)], None, "Площа одразу стала святковою.")],
      "Матвій фотографує площу: «Для історії».",
      holiday("statehood", 1, 0), thanks(coins=10, rep=3))
quest("cal.cherry_varenyky", "Вареники з вишнями", GRANNY_ZLATA, "village",
      "Вишні в саду Злати Коваль осипаються, а внуки далеко. «Хочеш, навчу ліпити? Тільки вишень назбирай».",
      [gather("Назбирати вишень у саду", "village", "cherry"),
       choose("Учитися в баби Злати", [opt("Ліпити разом із бабою", "Перші вареники розлазяться, сьомий виходить як у неї.", thanks(recipes=["rc.cherry_varenyky"]))], "village", GRANNY_ZLATA),
       cook("Наліпити вареників удома", "rc.cherry_varenyky"),
       bring("Пригостити бабу Злату", "village", [("cherry_varenyky", 1)], GRANNY_ZLATA, "«Як у мене. Ні — краще!»")],
      "Баба Злата всім розповідає, що в неї тепер є учень.",
      dates(6, 20, 7, 31), thanks(rep=1, hearts=[(GRANNY_ZLATA, 60)]))
quest("cal.dawn_fishing", "Риболовля на світанку", "myron", "village",
      "Мирон: «Найкраще клює на зорі. Ходімо? Хто більше впіймає — той сміливіший».",
      [go("Прийти до ставка на світанку", "village", (4, 7), "myron", "Туман над водою. Мирон мовчить — тут не говорять."),
       gather("Впіймати рибу", "village")],
      "Мирон впіймав більше. Але твоя — більша. Так він каже.",
      dates(7, 1, 8, 31), thanks(rep=1, hearts=[("myron", 60)]))
quest("cal.starfall", "Зорепад", PHOTOGRAPHER, "newsroom_in",
      "Фотограф Юрій Петренко: «Персеїди! Хочу в газету карту неба — хто намалює, поки я налаштовую камеру?»",
      [use("Перемалювати зорі біля телескопа на площі", "st.telescope.stars"),
       bring("Віднести зоряну карту в редакцію", "newsroom_in", [("star_chart", 1)], PHOTOGRAPHER, "Юрій ставить твою карту поруч зі своїм знімком.")],
      "У четверговому номері — розворот «Зорепад над Липовим». Твоє ім'я дрібним шрифтом унизу.",
      dates(7, 20, 8, 20), thanks(coins=15, title="Зоряний кореспондент", rep=2))
quest("cal.harvest_flour", "Перше борошно нового врожаю", HARVESTER2, "fields",
      "Ірина Коваль: «Нова пшениця! Хто перший змолоть — тому пекар спече першу паляницю».",
      [use("Нажати пшениці", "st.fields.wheat"),
       gather("Зібрати ще колосків на узбіччі поля", "fields", "wheat_ear"),
       use("Змолоти борошно на хлібзаводі", "st.factory.mill"),
       bring("Віднести борошно в пекарню", "bakery_in", [("flour", 1)], BAKER, "Остап пахне свіжим хлібом навіть здалеку.")],
      "Перша паляниця нового врожаю — твоя. Остап так сказав, і сперечатися з ним марно.",
      dates(7, 15, 8, 20), thanks(items=["bread"], coins=10, rep=2, hearts=[(HARVESTER2, 30), (BAKER, 30)]))

# ---- серпень ----------------------------------------------------------------------------------------------------
quest("cal.honey_spas", "Медовий Спас", FARMER3, "farm",
      "Богдан Шевченко: «Перший мед — святити. Принеси й ти свій».",
      [use("Зібрати мед на фермі", "st.farm.honey"),
       bring("Віднести мед святити в костел", "church_in", [("honey", 1)], PRIEST, "Отець кропить мед, і бджоли кружляють над кошиками.")],
      "Мед після свята смачніший. Чи так здається?",
      holiday("honey_spas", 1, 1), thanks(items=["gingerbread"], rep=2, hearts=[(FARMER3, 30)]))
quest("cal.apple_spas", "Яблучний Спас", PRIEST, "church_in",
      "Отець Павло: «До Спаса яблук не їдять. А після — освячені несемо тим, хто не прийшов».",
      [gather("Нарвати яблук у саду", "village", "apple"),
       bring("Принести яблука святити", "church_in", [("apple", 2)], PRIEST, "Яблука в кошику сяють, як ліхтарики.", [("blessed_apples", 1)]),
       bring("Віднести освячені яблука бабі Людмилі", "village", [("blessed_apples", 1)], GRANNY_LUDA, "«Перше яблуко — за тих, кого нема».")],
      "Отець Павло всміхається: «Ось тепер і свято».",
      holiday("apple_spas", 1, 1), thanks(rep=3, hearts=[(PRIEST, 30), (GRANNY_LUDA, 40)]))
quest("cal.independence_issue", "Святковий номер газети", EDITOR, "newsroom_in",
      "Редакторка Ніна Олійник: «Нам потрібен знімок площі в День Незалежності. Фотограф захворів — виручай!»",
      [go("Сфотографувати площу вдень", "village", (10, 17), None, "Прапори, вишиванки, діти на плечах у батьків — клац!", [("photo", 1)]),
       bring("Віднести знімок у редакцію", "newsroom_in", [("photo", 1)], EDITOR, "Ніна дивиться на знімок довго-довго.")],
      "Твій знімок — на першій шпальті. Підпис: «Фото: друг редакції».",
      holiday("independence", 0, 1), thanks(coins=20, title="Друг редакції", rep=3))
quest("cal.school_ready", "Школа до Першого вересня", TEACHER3, "school_in",
      "Петро Руденко: «Парти розхиталися, а грошей на нові нема. Дошки б, і я полагоджу».",
      [go("Попросити дощок на пилорамі", "forest", (8, 17), None, "Пилярі вже знають, навіщо.", [("planks", 2)]),
       bring("Принести дошки до школи", "school_in", [("planks", 2)], TEACHER3, "Петро вже з молотком і цвяхами в зубах.")],
      "Першого вересня діти сідають за парти, які не хитаються.",
      dates(8, 10, 8, 31), thanks(coins=12, rep=2, hearts=[(TEACHER3, 40)]))
quest("cal.corn_market", "Кукурудза на ярмарок", VENDOR, "village",
      "Дарина Руденко з ринку: «Варена кукурудза — хіт серпня. Принеси кілька качанів з ферми!»",
      [use("Наламати кукурудзи на фермі", "st.farm.corn"),
       bring("Принести кукурудзу на ринок", "village", [("corn", 1)], VENDOR, "Дарина ставить казан на вогонь.")],
      "До вечора на ринку пахне вареною кукурудзою і сіллю.",
      dates(8, 1, 9, 15), thanks(coins=10, rep=1, hearts=[(VENDOR, 40)]))

# ---- вересень ---------------------------------------------------------------------------------------------------
quest("cal.first_september", "Букет на Перше вересня", TEACHER, "school_in",
      "Остапчик Савчук іде в перший клас, а мама на зміні в пожежній. Учитель просить: «Нехай у хлопця теж буде букет».",
      [use("Купити букет у «Півонії»", "st.flowers.buy"),
       bring("Віддати букет Остапчикові біля школи", "school_in", [("bouquet", 1)], TEACHER, "Остапчик тримає букет обома руками, як найважливіше в житті.")],
      "Першокласник махає тобі з лінійки. Букет більший за нього.",
      holiday("knowledge_day", 1, 0), thanks(rep=3, hearts=[(TEACHER, 40)]))
quest("cal.first_porcini", "Перші білі", FORESTER, "forest",
      "Лісничка Зоряна: «Пішли білі! Тільки з корінням не рви, і мухоморів не чіпай».",
      [gather("Знайти білий гриб у лісі", "forest", "porcini"),
       bring("Здати гриби в крамницю", "grocery_in", [("#mushroom", 1)], None, "Продавчиня зважує гриб і показує сусідці: «Оце красень!»")],
      "Зоряна каже, що це добрий знак: буде грибна осінь.",
      dates(9, 1, 10, 31), thanks(coins=10, rep=1, hearts=[(FORESTER, 30)]))
quest("cal.harvest_fair", "Осінній ярмарок", VENDOR, "village",
      "Дарина Руденко збирає овочі на осінній ярмарок: «Найкращий урожай — на перший ряд!»",
      [use("Наламати кукурудзи", "st.farm.corn"),
       use("Купити моркви на ятці, щоб не з порожніми руками", "st.stall_veg.carrot"),
       bring("Принести овочі на ринок", "village", [("#veg", 3)], VENDOR, "Ряд овочів на прилавку схожий на виставку.")],
      "Ярмарок шумить до вечора. Хтось уже питає, чия кукурудза.",
      dates(9, 12, 9, 30), thanks(coins=18, rep=2, hearts=[(VENDOR, 30)]))
quest("cal.warm_socks", "Теплі рукавички на зиму", WEAVER, "creamery_in",
      "Ткаля Уляна Коваль: «Хочу до зими зв'язати рукавички для дитсадка. Вовни б…»",
      [use("Постригти вівцю на фермі", "st.farm.shear"),
       use("Спрясти пряжу в «Овечці»", "st.creamery.spin"),
       bring("Віддати пряжу Уляні", "creamery_in", [("yarn", 1)], WEAVER, "Уляна вже пробує спиці.")],
      "Через тиждень малеча в саду ходить у однакових рукавичках.",
      dates(9, 15, 11, 15), thanks(items=["mittens"], rep=2, hearts=[(WEAVER, 40)]))
quest("cal.class_shelf", "Книжкова полиця для класу", LIBRARIAN, "library_in",
      "Наталія Гончар: «У першому класі нема ні однієї книжки. Відніси їм цю — від бібліотеки».",
      [use("Взяти книжку в бібліотеці", "st.library.borrow"),
       bring("Віднести книжку в клас", "school_in", [("book", 1)], TEACHER, "Діти ставлять книжку на порожню полицю урочисто, як ялинку.")],
      "Полиця вже не порожня. Початок покладено.",
      dates(9, 5, 9, 30), thanks(rep=2, hearts=[(LIBRARIAN, 40)]))

# ---- жовтень ----------------------------------------------------------------------------------------------------
quest("cal.defenders", "Листівки захисникам", POLICE, "police_in",
      "Оксана Шевченко з відділку збирає листівки для хлопців і дівчат на фронті: «Кілька теплих слів — це багато».",
      [use("Купити листівку з видом Липового в ратуші", "st.townhall.postcard"),
       bring("Віднести листівку на пошту", "post_in", [("postcard", 1)], CLERK_POST, "Григорій ставить штемпель обережно, як на документ.")],
      "Через місяць у газеті друкують відповідь: «Дякуємо, Липове. Чекайте нас».",
      holiday("defenders", 0, 2), thanks(rep=3))
quest("cal.pokrova_fair", "Покровський ярмарок", MAYOR, "townhall_in",
      "Матвій Гончар: на Покрову ярмарок, і кожен двір щось приносить. «Яблук би або груш — щоб було чим пригощати».",
      [gather("Нарвати яблук чи груш у саду", "village"),
       bring("Принести фрукти на площу", "village", [("#fruit", 2)], MAYOR, "Твої груші лежать на столі поруч із пирогами.")],
      "Ярмарок вдався. Матвій навіть станцював — уперше за десять років.",
      dates(10, 8, 10, 20), thanks(coins=12, rep=3))
quest("cal.scary_stories", "Страшилки в бібліотеці", LIBRARIAN, "library_in",
      "Перед Гелловіном Наталія Гончар влаштовує вечір страшних історій при свічках.",
      [go("Прийти до бібліотеки ввечері", "library_in", (17, 22), LIBRARIAN),
       choose("Яку історію розповісти?", [
           opt("Про шахтаря, що досі ходить печерою", "Діти тулилися одне до одного, а дід Панас бурчав: «Брехня! Він не ходить. Він сидить».", thanks(rep=1)),
           opt("Про кота, який читає газети", "Сміялися всі, навіть ті, хто збирався боятися.", thanks(hearts=[(LIBRARIAN, 40)]))], "library_in")],
      "Наталія задуває свічки: «До наступного року. Якщо доживемо, ха-ха».",
      holiday("halloween", 3, 0), thanks(items=["book"], rep=1))
quest("cal.autumn_firewood", "Дрова до холодів", OLD_OLEH, "village",
      "Дід Олег Олійник рахує поліна і хитає головою: «Не вистачить до весни».",
      [go("Попросити дров на пилорамі", "forest", (8, 17), None, "Дві в'язанки, зв'язані дротом.", [("firewood", 2)]),
       bring("Скласти дрова в діда Олега", "village", [("firewood", 2)], OLD_OLEH, "Дід складає поліна рівненько, як цеглини.")],
      "«Тепер і зима не страшна».",
      dates(10, 15, 11, 30), thanks(coins=10, rep=2, hearts=[(OLD_OLEH, 40)]))
quest("cal.class_hike", "Похід у ліс із класом", TEACHER2, "school_in",
      "Осінні канікули. Іван Руденко веде клас у ліс і кличе ще одного дорослого.",
      [go("Прийти до лісу зранку", "forest", (8, 13), TEACHER2, "Діти розбігаються, як горобці."),
       gather("Показати дітям, де ростуть гриби й ягоди", "forest")],
      "Увечері діти розповідають батькам, що бачили справжнього дятла. І тебе.",
      dates(10, 26, 11, 2), thanks(rep=2, hearts=[(TEACHER2, 30)]))

# ---- листопад ---------------------------------------------------------------------------------------------------
quest("cal.andrew_eve", "Андріївські вечорниці", SOFIA, "village",
      "Софія Кравець кличе на вечорниці: «Калита, ворожіння, пісні! Тільки калач на калиту хтось має спекти…»",
      [choose("Софія показує, як плести калач", [opt("Плести разом", "Тісто тягнеться, як коса. Виходить!", thanks(recipes=["rc.kalach"]))], "village", SOFIA),
       cook("Спекти калач удома", "rc.kalach"),
       bring("Принести калач на вечорниці", "village", [("kalach", 1)], SOFIA, "Калач підвішують на червону стрічку. Кусати без рук — і не сміятися!"),
       choose("Ворожіння", [
           opt("Лити віск у воду", "Віск застигає у формі… човна? Подорож, кажуть дівчата."),
           opt("Рахувати кілки в паркані", "Парна кількість! Софія підморгує.")], "village")],
      "Вечорниці закінчуються під ранок. Пісні ще довго чути з вулиці.",
      holiday("st_andrew_eve", 0, 0), thanks(rep=2, hearts=[(SOFIA, 50)]))
quest("cal.scarves_for_kids", "Шарфи для садочка", WEAVER, "creamery_in",
      "Уляна Коваль: «Рукавички є, а шарфів нема. Пряжі б на один — ще встигну до морозів».",
      [use("Постригти вівцю", "st.farm.shear"),
       use("Спрясти пряжу", "st.creamery.spin"),
       use("Виткати шарф", "st.creamery.scarf"),
       bring("Віддати шарф Уляні", "creamery_in", [("scarf", 1)], WEAVER, "Уляна прикладає шарф до щоки: «М'який»."), ],
      "Шарф у садочку дістався найменшому. Він його не знімає навіть у групі.",
      dates(11, 1, 12, 10), thanks(rep=2, hearts=[(WEAVER, 50)]))
quest("cal.window_wool", "Утеплити вікна баби Злати", GRANNY_ZLATA, "village",
      "Баба Злата Коваль: «Дме з вікон, хоч свічку не став. Вовною б щілини закласти, як колись робили».",
      [use("Постригти вівцю на фермі", "st.farm.shear"),
       bring("Віднести вовну бабі Златі", "village", [("wool", 2)], GRANNY_ZLATA, "Удвох закладаєте щілини, баба розповідає про молодість.")],
      "«Тепер тепло. А розповідати я тобі ще багато маю».",
      dates(11, 1, 11, 30), thanks(rep=2, hearts=[(GRANNY_ZLATA, 40)]))
quest("cal.hospital_soup", "Гаряче для лікарні", DOCTOR, "hospital_in",
      "Лікар Тарас Мельник: «Листопад — грипи. Хворим би домашнього гарячого, а не з їдальні».",
      [cook("Зварити борщ удома", "rc.borshch"),
       bring("Занести гаряче в лікарню", "hospital_in", [("#dish", 2)], DOCTOR, "У палаті хтось уперше за тиждень попросив добавки.")],
      "«От і ліки, яких нема в аптеці».",
      dates(11, 1, 11, 30), thanks(coins=15, rep=3, hearts=[(DOCTOR, 50)]))
quest("cal.bird_feeder", "Годівничка на зиму", FORESTER, "village",
      "Лісничка Зоряна: «Синиці вже прилетіли до хат. Насип їм насіння — і будуть співати до весни».",
      [use("Купити насіння соняшника", "st.stall_veg.seeds"),
       use("Насипати пташкам у годівничку на площі", "st.birdbath.feed")],
      "На підвіконні вранці — синичка. Чекає.",
      dates(11, 10, 12, 31), thanks(rep=1, hearts=[(FORESTER, 30)]))

# ---- грудень ----------------------------------------------------------------------------------------------------
quest("cal.st_nicholas", "Помічник святого Миколая", PRIEST, "church_in",
      "Отець Павло: «Миколай не встигає до всіх. Рознеси подарунки дітям — тихенько, щоб не бачили».",
      [bring("Покласти подарунок біля дверей Петрика Мельника", "village", [("gift_box", 1)], None, "Тихо, як сніг."),
       bring("Залишити подарунок у школі для класу", "school_in", [("gift_box", 1)], None, "Учитель ховає подарунок у шафу до ранку."),
       bring("Покласти подарунок біля дверей Ганнусі Лисенко", "village", [("gift_box", 1)], None, "Десь гавкнув собака — швидше звідси!")],
      "Зранку все Липове пише в газету, що Миколай цього року був особливо щедрий.",
      holiday("st_nicholas", 3, 0), thanks(title="Помічник Миколая", rep=4, hearts=[(PRIEST, 50)]), start_gives=[("gift_box", 3)])
quest("cal.kutia", "Кутя на Святвечір", GRANNY_ZLATA_M, "village",
      "Баба Злата Мельник: «Без куті й вечеря не свята. Навчу тебе — запиши, бо такого вже ніхто не вміє».",
      [choose("Слухати бабу Злату", [opt("Записувати кожне слово", "«Пшеницю — на ніч у воду. Мак — терти, поки біле молочко. Мед — наостанок».", thanks(recipes=["rc.kutia"]))], "village", GRANNY_ZLATA_M),
       use("Купити пшеницю на святковому ярмарку", "st.fair.kutia_wheat"),
       use("Купити мак", "st.fair.poppy"),
       use("Купити мед у крамниці", "st.grocery.honey"),
       cook("Зварити кутю вдома", "rc.kutia"),
       bring("Принести кутю бабі Златі", "village", [("kutia", 1)], GRANNY_ZLATA_M, "Баба куштує й мовчки витирає очі.")],
      "«Тепер є кому передати. Христос народився!»",
      holiday("christmas_eve", 0, 0), thanks(rep=3, hearts=[(GRANNY_ZLATA_M, 80)]))
quest("cal.uzvar", "Узвар для діда Василя", GRANDPA_VASYL, "village",
      "Дід Василь Коваль: «Злата варить кутю, а узвар завжди був мій. Цього року руки трусяться… Покажу, як, а ти звариш?»",
      [choose("Слухати діда Василя", [opt("Слухати й кивати", "«Сушня, вода, мед — і нікуди не поспішай».", thanks(recipes=["rc.uzvar"]))], "village", GRANDPA_VASYL),
       use("Купити сушню на ярмарку", "st.fair.dried"),
       use("Набрати води в криниці", "st.farm.well"),
       use("Купити мед", "st.grocery.honey"),
       cook("Зварити узвар удома", "rc.uzvar"),
       bring("Принести узвар дідові Василю", "village", [("uzvar", 1)], GRANDPA_VASYL, "Дід наливає дві кружки — тобі й собі.")],
      "«Ну от. Тепер і в мене свято».",
      holiday("christmas_eve", 0, 0), thanks(rep=2, hearts=[(GRANDPA_VASYL, 80)]))
quest("cal.carols", "Колядники", RADIO, "radio_in",
      "Олег Бондар збирає колядників: «Пройдемо селом, а потім заспіваємо в ефірі! Зірку понесеш?»",
      [go("Прийти ввечері на площу з зіркою", "village", (17, 23), RADIO, "Зірка світиться, сніг рипить, хтось фальшивить — і це чудово."),
       choose("Яку колядку заспівати біля ратуші?", [
           opt("«Добрий вечір тобі, пане господарю»", "Матвій Гончар виходить на ґанок і пригощає всіх калачем.", thanks(items=["kalach"])),
           opt("«Щедрик»", "Навіть дід Панас підспівує. Тихо, але підспівує.", thanks(rep=2))], "village"),
       go("Заспівати в ефірі радіо", "radio_in", (19, 24), RADIO, "Тепер вас чує все Липове.")],
      "Зірку тобі лишили на згадку.",
      holiday("christmas", 0, 6), thanks(items=["star_lantern"], rep=2, hearts=[(RADIO, 40)]), start_gives=[("star_lantern", 1)])
quest("cal.square_tree", "Ялинка на площі", MAYOR, "townhall_in",
      "Матвій Гончар: «Лісничка дозволила взяти одну ялинку з прочистки. Яку — вирішуй ти, я тобі довіряю».",
      [go("Вибрати ялинку в лісі разом із лісничкою", "forest", (9, 15), FORESTER),
       choose("Яку ялинку взяти?", [
           opt("Високу й струнку", "Вона ледве влазить на причеп."),
           opt("Пухнасту, хоч і кривеньку", "«Зате душевна», — каже Зоряна.", thanks(hearts=[(FORESTER, 30)]))], "forest"),
       go("Прикрасити ялинку на площі", "village", (10, 18), MAYOR, "Іграшки зі шкільних уроків праці, гірлянда з ратуші. Найкраща ялинка за сто років.")],
      "Увечері вмикають гірлянду. Все Липове рахує: «Три, два, один!»",
      dates(12, 12, 12, 30), thanks(coins=15, rep=4))
quest("cal.new_year_eve", "Пряники на Новорічну ніч", BAKER2, "bakery_in",
      "Пекар Дмитро Шевченко: «Новорічна ніч — а пряників на площу мало. Розібрали ще до обіду!»",
      [use("Купити пиріг у пекарні", "st.bakery.pie"),
       bring("Принести солодке на площу до опівночі", "village", [("#sweet", 1)], BAKER2, "Пиріг ріжуть на тридцять шматочків. Вистачає всім. Диво.")],
      "Опівночі над площею — феєрверк, і хтось кричить твоє ім'я разом із «З Новим роком!»",
      holiday("new_year_eve", 0, 0), thanks(rep=3, hearts=[(BAKER2, 40)]))


# ================================================================================================================
# The day's small needs (they come up because something happened, or just because it's a day)
# ================================================================================================================
def job(id, title, text, location, stages, reward, giver=None, giver_job=(), weight=10, days=1, seasons=(), weather=(), on="",
        needs_ill=False, needs_fire=False, places=(), start_gives=()):
    j = {"id": id, "title": title, "text": text, "location": location, "stages": stages, "reward": reward, "weight": weight, "days": days,
         "seasons": list(seasons), "weather": list(weather), "on": on, "needs_ill": needs_ill, "needs_fire": needs_fire,
         "places": list(places), "start_gives": [list(g) for g in start_gives], "giver_job": list(giver_job)}
    if giver:
        j["giver"] = giver
    JOBS.append(j)


ME = "{giver}"
job("job.parcels", "Посилки від пошти", "{giver} з пошти не встигає з посилками: одна для {t1}, друга для {t2}.", "post_in",
    [bring("Віднести посилку: {t1}", "village", [("parcel", 1)], done="Розписались — і подякували."),
     bring("Віднести посилку: {t2}", "village", [("parcel", 1)], done="«Ой, це ж від сестри!»")],
    thanks(coins=8, rep=1, hearts=[(ME, 20)]), giver_job=("postman", "postal_clerk"), weight=30, on="workday", start_gives=[("parcel", 2)])
job("job.medicine", "Ліки для {who}", "{who} захворів(ла). {giver} з лікарні просить занести ліки додому — самому(самій) не вийти.", "hospital_in",
    [bring("Занести ліки: {who}", "village", [("medicine", 1)], done="«Дякую… одразу полегшало, ще й не випивши»."), ],
    thanks(coins=6, rep=2, hearts=[(ME, 20)]), giver_job=("doctor", "nurse"), weight=70, needs_ill=True, start_gives=[("medicine", 1)])
job("job.sick_soup", "Гаряче для {who}", "{who} лежить хворий(а), а вдома нікому зварити. {giver} каже: «Тарілка домашнього — найкращі ліки».", "hospital_in",
    [bring("Занести щось гаряче: {who}", "village", [("#dish", 1)], done="Ложка за ложкою — і щоки рожевіють.")],
    thanks(rep=3, hearts=[(ME, 30)]), giver_job=("nurse",), weight=35, needs_ill=True, days=2)
job("job.lost_kitten", "Загубилося кошеня", "{giver} шукає кошеня: вибігло ще вчора. Бачили його десь у {place}.", "village",
    [go("Пошукати кошеня: {place}", "{place}", (7, 21), done="Нявкає з-під кущів! Тремтить, але ціле.", gives=[("lost_kitten", 1)]),
     bring("Повернути кошеня господарям", "village", [("lost_kitten", 1)], done="Кошеня одразу забирається на руки й мурчить.")],
    thanks(rep=2, hearts=[(ME, 40)]), giver_job=("elder", "child"), weight=14, days=2, places=("forest", "fields", "farm", "cemetery", "dump"))
job("job.lost_puppy", "Втекло цуценя", "{giver} у сльозах: цуценя прослизнуло у хвіртку. Сусіди бачили його біля {place}.", "village",
    [go("Пошукати цуценя: {place}", "{place}", (7, 21), done="Цуценя радісно стрибає тобі на коліна.", gives=[("lost_puppy", 1)]),
     bring("Повернути цуценя", "village", [("lost_puppy", 1)], done="Хвостик крутиться, як пропелер.")],
    thanks(rep=2, hearts=[(ME, 40)]), giver_job=("child", "adult"), weight=8, days=2, places=("forest", "fields", "farm", "dump"))
job("job.firewood", "Дрова для {giver}", "У {giver} закінчуються дрова, а на пилорамі обрізки віддають задарма.", "village",
    [go("Взяти обрізків на пилорамі", "forest", (8, 17), done="Дві в'язанки.", gives=[("firewood", 2)]),
     bring("Занести дрова", "village", [("firewood", 2)], done="У хаті затріщало в печі.")],
    thanks(coins=8, rep=1, hearts=[(ME, 30)]), giver_job=("elder",), weight=30, days=2, seasons=("Autumn", "Winter"))
job("job.fire_planks", "Дошки після пожежі", "Учора горіло: {place}. {giver} з пожежної шукає, хто привезе дощок полатати дах.", "fire_in",
    [go("Попросити дощок на пилорамі", "forest", (8, 17), done="Пилярі вже чули про пожежу — дали найкращі.", gives=[("planks", 2)]),
     bring("Привезти дошки на згарище", "village", [("planks", 2)], done="Дах полатали до вечора.")],
    thanks(coins=15, rep=3, hearts=[(ME, 30)]), giver_job=("firefighter", "firefighter_night"), weight=90, days=2, needs_fire=True)
job("job.harvest_hands", "Руки на жнивах", "{giver} з поля: «Дощ насувається, а снопів не перев'язано!»", "fields",
    [use("Нажати пшениці", "st.fields.wheat"),
     go("Допомогти перев'язати снопи", "fields", (6, 19), done="Снопи стоять рядком, як солдатики.")],
    thanks(coins=12, rep=1, hearts=[(ME, 20)]), giver_job=("harvester",), weight=30, seasons=("Summer", "Autumn"), on="workday")
job("job.library_return", "Забута книжка", "{giver} з бібліотеки: {t1} тримає книжку вже третій місяць. Може, нагадаєш по-сусідськи?", "library_in",
    [go("Зайти до сусіда: {t1}", "village", (9, 20), done="«Ой, та я ж її двічі перечитав(ла)! Віднесіть, будь ласка».", gives=[("overdue_book", 1)]),
     bring("Повернути книжку в бібліотеку", "library_in", [("overdue_book", 1)], done="Книжка повертається на свою полицю.")],
    thanks(rep=1, hearts=[(ME, 30)]), giver_job=("librarian",), weight=12, days=3)
job("job.flour", "Борошно для пекарні", "{giver} з пекарні: «Борошно скінчилося, а хліборізка ще має працювати!»", "bakery_in",
    [bring("Принести борошно в пекарню", "bakery_in", [("flour", 1)], done="Пекар одразу замішує тісто.")],
    thanks(coins=10, items=["bun"], hearts=[(ME, 20)]), giver_job=("baker",), weight=12, days=2)
job("job.ball_on_roof", "М'ячик на даху", "{giver} закинув м'ячик на дах сараю. Без драбини не дістати.", "village",
    [go("Попросити пожежників дістати м'ячик", "fire_in", (8, 20), done="Пожежник сміється: «Найлегша справа за тиждень»", gives=[("ball", 1)]),
     bring("Віддати м'ячик малому", "village", [("ball", 1)], done="М'ячик знову летить — цього разу подалі від даху.")],
    thanks(rep=1, hearts=[(ME, 40)]), giver_job=("child",), weight=12, seasons=("Spring", "Summer", "Autumn"))
job("job.photo", "Знімок для газети", "{giver} з редакції: у номер потрібен знімок — {place}. Фотограф на іншому кінці села.", "newsroom_in",
    [go("Сфотографувати: {place}", "{place}", (8, 19), done="Клац! Світло вдале.", gives=[("photo", 1)]),
     bring("Віднести знімок у редакцію", "newsroom_in", [("photo", 1)], done="Знімок іде в номер.")],
    thanks(coins=10, rep=1, hearts=[(ME, 20)]), giver_job=("editor", "journalist", "photographer"), weight=14, days=2,
    places=("forest", "fields", "farm", "cemetery", "village"))
job("job.umbrella", "Парасолька під дощем", "Злива! {giver} застряг(ла) на зупинці без парасольки.", "village",
    [go("Позичити парасольку в крамниці", "grocery_in", (7, 21), done="Продавчиня дає свою, стару, але цілу.", gives=[("umbrella", 1)]),
     bring("Віднести парасольку на площу", "village", [("umbrella", 1)], done="Під парасолькою вдвох тісно, але сухо.")],
    thanks(rep=2, hearts=[(ME, 30)]), giver_job=("elder",), weight=35, weather=("rain", "storm"))
job("job.snow_path", "Розчистити стежку", "Намело! {giver} не може вийти з хвіртки.", "village",
    [go("Розчистити стежку до хвіртки", "village", (7, 14), done="Лопата, сніг, рум'яні щоки. Стежка є!")],
    thanks(rep=2, hearts=[(ME, 40)]), giver_job=("elder",), weight=45, weather=("snow",))
job("job.milk", "Молоко для сироварні", "{giver} з «Овечки»: сирні форми чекають, а молока бракує.", "creamery_in",
    [use("Подоїти корову на фермі", "st.farm.milk"),
     bring("Принести молоко в «Овечку»", "creamery_in", [("milk", 1)], done="Молоко ще тепле — сир вийде добрий.")],
    thanks(coins=8, hearts=[(ME, 20)]), giver_job=("cheesemaker", "weaver"), weight=15, on="workday")
job("job.stray", "Котик біля ветклініки", "{giver} з ветклініки: під ґанком знову голодний котик.", "vet_in",
    [gather("Впіймати рибу", "village"),
     use("Нагодувати котика", "st.vet.stray")],
    thanks(rep=1, hearts=[(ME, 30)]), giver_job=("vet", "vet_nurse"), weight=12)
job("job.water", "Вода для {giver}", "Спека. {giver} не має сил нести воду з криниці.", "village",
    [use("Набрати води в криниці на фермі", "st.farm.well"),
     bring("Занести воду", "village", [("water_jar", 1)], done="Холодна, аж зуби ломить.")],
    thanks(rep=1, hearts=[(ME, 30)]), giver_job=("elder",), weight=18, seasons=("Summer",), weather=("clear", "cloudy"))
job("job.letter", "Лист на пошту", "{giver} написав(ла) лист онукам, а до пошти не дійти.", "village",
    [bring("Відправити лист на пошті", "post_in", [("letter_sealed", 1)], done="Штемпель, марка — і лист полетів.")],
    thanks(rep=1, hearts=[(ME, 30)]), giver_job=("elder",), weight=15, start_gives=[("letter_sealed", 1)])
job("job.groceries", "Хліб для {giver}", "{giver} просить купити хліба — ноги сьогодні не слухаються.", "village",
    [use("Купити паляницю в пекарні", "st.bakery.bread"),
     bring("Занести хліб", "village", [("bread", 1)], done="«Ще тепла! Сідай, чаю наллю»")],
    thanks(rep=1, hearts=[(ME, 30)]), giver_job=("elder",), weight=20, on="workday")

