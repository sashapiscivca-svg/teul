# A town that lives on (crates/teul-core/src/town.rs): what Lypove builds together over the years and the shops it
# opens, families who will move in, names for the babies to come. Run inside gen_base_content.py after quests.py
# (it adds to items, stations and residents; the village map's flagged props come from town_village.py).

# ---- ice cream: what the summer kiosk sells
good("ice_cream", "Морозиво в ріжку", [b(40, 40, 0, 20, 20, 40, "cone", "cone"), b(34, 34, 34, 32, 32, 26, "scoop", "ball"), b(42, 40, 52, 16, 16, 14, "scoop2", "ball")],
     {"cone": slot("earth", 3), "scoop": slot("fabric_pink", 1), "scoop2": slot("pastel", 3)}, ("sweet", "food"))

# ---- the town's projects: what it takes, what the town brings by itself, the stages of building
PROJECTS = [
    {"id": "proj.bandstand", "name": "Альтанка-естрада в парку", "location": "village",
     "text": "Парку бракує музики: збираємо на альтанку-естраду біля озера, щоб у ній грав оркестр і танцювали на свята.",
     "coins": 900, "items": [["planks", 6]], "town_coins": 18, "town_items_every": 9,
     "stages": [{"name": "Огорожа й фундамент", "days": 3}, {"name": "Риштування й дах", "days": 5}], "opens": 0,
     "done": "У парку відкрили альтанку-естраду! У вихідні ввечері в ній гратиме духовий оркестр — приходьте всі."},
    {"id": "proj.library_roof", "name": "Новий дах бібліотеки", "location": "village",
     "text": "Дах бібліотеки протікає: під краплями стоять відра, книжки ховають під плівку. Перекриймо його разом.",
     "coins": 700, "items": [["planks", 4]], "town_coins": 15, "town_items_every": 10,
     "stages": [{"name": "Риштування", "days": 2}, {"name": "Перекривання даху", "days": 4}], "opens": 7,
     "done": "Дах бібліотеки перекрито — більше жодної краплі на книжки! Бібліотекарка дякує всім, хто допоміг."},
    {"id": "proj.farm_lights", "name": "Ліхтарі на дорозі до ферми", "location": "farm",
     "text": "Узимку фермери вертаються додому затемна: поставимо ліхтарі вздовж дороги до ферми.",
     "coins": 800, "town_coins": 20,
     "stages": [{"name": "Стовпи", "days": 2}, {"name": "Дроти й ліхтарі", "days": 2}], "opens": 30,
     "done": "Дорога до ферми тепер освітлена. Фермери кажуть, що навіть корови спокійніше йдуть увечері до хліва."},
    {"id": "proj.playground", "name": "Дитячий майданчик на Новій", "location": "village",
     "text": "На Новій вулиці підростає малеча, а гратися ніде. Гойдалки, гірка, пісочниця — і лава для мам.",
     "coins": 600, "items": [["planks", 5]], "town_coins": 12, "town_items_every": 8,
     "stages": [{"name": "Огорожа", "days": 2}, {"name": "Гойдалки й пісочниця", "days": 3}], "opens": 40,
     "done": "На Новій вулиці відкрили дитячий майданчик — дитячий сміх чути аж до площі."},
    {"id": "proj.riverside", "name": "Сквер над струмком", "location": "village", "after": ["proj.bandstand"],
     "text": "Берег струмка заріс бур'яном. Зробімо там сквер: лавки, клумби, ліхтарі — місце для вечірніх прогулянок.",
     "coins": 500, "items": [["bouquet", 3]], "town_coins": 10, "town_items_every": 12,
     "stages": [{"name": "Доріжки, лавки й клумби", "days": 3}], "opens": 60,
     "done": "Над струмком — новий сквер: лавки, клумби й ліхтарі. Кажуть, там уже освідчився перший хлопець."},
]

# ---- shops and stalls that open
OPENINGS = [
    {"id": "open.icecream", "name": "Кіоск з морозивом", "months": [5, 6, 7, 8, 9],
     "text": "Біля парку відкрився кіоск з морозивом: пломбір, вишневе й фісташкове. Літо офіційно почалося!"},
    {"id": "open.coffee_cart", "name": "Кавовий візок", "months": [10, 11, 12, 1, 2, 3],
     "text": "На площі з'явився кавовий візок — гаряча кава й чай навинос на холодні ранки."},
    {"id": "open.flower_cart", "name": "Квітковий візок", "months": [3, 4, 5],
     "text": "Весна! На площу повернувся квітковий візок: тюльпани, нарциси й перші проліски."},
    {"id": "open.book_stall", "name": "Книжкова ятка", "after": "proj.library_roof",
     "text": "Біля бібліотеки відкрилася книжкова ятка: старі й нові книжки за кілька монет."},
]

BIRTHS = []

# ---- stations of the new things (they work only while their flag holds)
def town_st(id, location, prop, label, text, kind, flag=None, cost=0, gives=(), per_day=1, hours=None, days=None, spent=""):
    s = {"id": id, "location": location, "prop": prop, "label": label, "text": text, "kind": kind, "needs": [], "cost": cost,
         "gives": [list(g) for g in gives], "earn": 0, "per_day": per_day, "seasons": [], "spent": spent}
    if hours:
        s["hours"] = list(hours)
    if days:
        s["days"] = days
    if flag:
        s["flag"] = flag
    stations.append(s)


town_st("st.icecream.buy", "village", "ice_cream_kiosk", "Купити морозиво", "Продавчиня накладає кульку пломбіру й поливає вишневим сиропом.", "buy",
        flag="open:open.icecream", cost=3, gives=[("ice_cream", 1)], per_day=4, hours=(10, 20), spent="Морозиво на сьогодні скінчилося — продавчиня вже миє ложечки.")
town_st("st.coffee_cart.coffee", "village", "coffee_cart", "Кава навинос", "Гаряча, з корицею. Пара здіймається над стаканчиком.", "buy",
        flag="open:open.coffee_cart", cost=4, gives=[("coffee", 1)], per_day=3, hours=(7, 13), spent="Кавник уже зібрав візок і поїхав грітися.")
town_st("st.flower_cart.bouquet", "village", "flower_cart", "Купити букетик", "Тюльпани, загорнуті в газету «Липовий вісник».", "buy",
        flag="open:open.flower_cart", cost=8, gives=[("bouquet", 1)], per_day=2, hours=(9, 17), spent="Квіти на сьогодні розібрали.")
town_st("st.book_stall.book", "village", "book_stall", "Купити книжку", "Стара книжка з чиїмсь підписом на форзаці — найкраща.", "buy",
        flag="open:open.book_stall", cost=6, gives=[("book", 1)], per_day=2, hours=(10, 18), spent="Цікаві книжки на сьогодні розібрали.")
town_st("st.bandstand.concert", "village", "bandstand", "Послухати оркестр", "Труби, барабан і старий вальс. Пари кружляють біля альтанки.", "play",
        flag="project:proj.bandstand:done", per_day=1, hours=(17, 21), days="weekends", spent="Оркестр уже склав інструменти.")
town_st("st.forest.planks", "forest", "sawmill", "Купити дошки", "Пилярі відміряють і в'яжуть дошки шпагатом.", "buy",
        cost=5, gives=[("planks", 1)], per_day=6, hours=(8, 17), spent="Дошок на сьогодні більше нема — пилорама відпочиває.")

# ---- families who will move in (a few weeks and a few months after the world began)
def newcomer(id, name, gender, age, home, arrives, look, partner=None, young=False, school=None):
    r = {"id": id, "name": name, "gender": gender, "age": age, "home": home, "honesty": 70, "temper": 25, "social": 65, "look": look, "arrives": arrives}
    if partner:
        r["partner"] = partner
    if young:
        r["young"] = True
    if school:
        r["school"] = school
    residents.append(r)


LOOK = {"skin_color": "#f1c9a5", "hair_color": "#4a2f27", "hair": "1", "eye_color": "#2a2035", "face": "0", "top_color": "#5aa469", "top2_color": "#e8e0c8",
        "top": "2", "bottom_color": "#2f3a5a", "bottom": "0", "shoes_color": "#e8e0c8", "acc": "0", "acc_color": "#d9534f"}
newcomer("res_new_andrii", "Андрій Остапенко", "m", "adult", "home_new1", 35, {**LOOK, "hair": "3", "top_color": "#4a8fd0", "acc": "1"}, partner="res_new_viktoriia", young=True)
newcomer("res_new_viktoriia", "Вікторія Остапенко", "f", "adult", "home_new1", 35, {**LOOK, "hair": "6", "hair_color": "#c9a050", "top_color": "#d86aa0", "top": "4"}, partner="res_new_andrii", young=True)
newcomer("res_new_myroslava", "Мирослава Остапенко", "f", "child", "home_new1", 35, {**LOOK, "hair": "7", "hair_color": "#c9a050", "top_color": "#f4d35e", "top": "1"}, school="school_site")
newcomer("res_new_luka", "Лука Гнатюк", "m", "elder", "home_new2", 120, {**LOOK, "hair": "5", "hair_color": "#f0f0f8", "top_color": "#8a5a2e", "top": "0", "acc": "5"})
newcomer("res_new_iryna", "Ірина Гнатюк", "f", "elder", "home_new2", 120, {**LOOK, "hair": "8", "hair_color": "#9aa0b0", "top_color": "#8a63c9", "top": "3"})
residents[-2]["partner"] = "res_new_iryna"
residents[-1]["partner"] = "res_new_luka"
