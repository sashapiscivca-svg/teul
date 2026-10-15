# The road (docs/world-economy.md §15): inside the driving school and the service station, their people (the
# instructor, the mechanic), the licence and the car's keys, the canister, the rules taught and asked, the cars
# for sale, the fines. Run inside gen_base_content.py after town_life.py (it uses Inside, rooms, key, good, st,
# residents, locations, V and DRIVE_WORLD from driving_world.py).

# ---- inside ----------------------------------------------------------------------------------------------------

R = Inside("driving_in", "Автошкола «Зелене світло»", "driving_site", 13, 10, "floor.oak", "wall.cream", 5)
R.prop("blackboard", 4, 0, wall="north")
R.prop("road_rules_poster", 8, 0, wall="north")
R.prop("road_rules_poster", 0, 3, wall="west")
R.prop("window_wide", 12, 2, wall="east")
R.prop("window_wide", 12, 6, wall="east")
R.prop("wall_clock", 1, 0, wall="north")
R.prop("desk", 5, 1, rot=2)
R.prop("office_chair", 5, 0)
R.prop("filing_cabinet", 8, 0)
for y in (4, 6):
    for x in (1, 3, 5, 7):
        R.prop("school_desk", x, y)
for y in (4, 6, 8):
    R.prop("drive_trainer", 10, y)
R.prop("bookshelf", 0, 7, rot=3)
R.prop("water_cooler", 12, 9)
R.prop("fern", 12, 0)
R.post((7, 1), (1, 5), (3, 5), (5, 5), (7, 5), (9, 4), (9, 6))
driving_room = R.build()
locations.append(driving_room)

R = Inside("sto_in", "СТО «Гайка»", "sto_site", 15, 11, "floor.slate", "wall.brick", 6)
R.prop("car_lift", 1, 1)
R.prop("car_sedan", 1, 2, must=False)
R.prop("car_lift", 4, 1)
R.prop("tool_chest", 7, 0)
R.prop("tool_chest", 8, 0)
R.prop("tool_board_garage", 7, 0, wall="north")
R.prop("engine_stand", 10, 1)
R.prop("tyre_stack", 13, 0)
R.prop("tyre_stack", 14, 0)
R.prop("tyre_stack", 14, 1)
R.prop("oil_drum", 0, 6)
R.prop("oil_drum", 0, 7)
R.prop("workbench", 10, 4, must=False)
R.prop("stock_boxes", 14, 4)
R.prop("cash_counter", 11, 8)
R.prop("waiting_bench", 1, 9)
R.prop("water_cooler", 4, 10)
R.prop("newspaper_rack", 3, 9)
R.prop("wall_clock", 5, 0, wall="north")
R.prop("poster", 11, 0, wall="north")
R.prop("window_wide", 14, 6, wall="east")
R.post((12, 7), (6, 2), (3, 3), (2, 8), (9, 6))
sto_room = R.build()
locations.append(sto_room)

# ---- their people ------------------------------------------------------------------------------------------------

# the sites take on their staff only now (after residents.py, so the town's first households keep their jobs)
_sites = {s["id"]: s for loc in locations for s in loc.get("sites", [])}
_sites["driving_site"]["jobs"] = [{"role": "instructor", "from": 540, "to": 1080, "wage": 30, "days": [0, 1, 2, 3, 4, 5]}]
_sites["sto_site"]["jobs"] = [{"role": "mechanic", "from": 480, "to": 1140, "wage": 32, "days": [0, 1, 2, 3, 4, 5]},
                              {"role": "mechanic_apprentice", "from": 540, "to": 1080, "wage": 18, "days": [0, 1, 2, 3, 4]}]
_village_homes = [h for h in homes if h.startswith("home_")]
_drive_people = [
    ("res_instructor", "Валентина Гудзь", "f", "instructor", "driving_site", {"hair": "6", "hair_color": "#7a4a2a", "top": "3", "top_color": "#5aa469", "top2_color": "#e8e0c8"}),
    ("res_mechanic", "Богдан Гайовий", "m", "mechanic", "sto_site", {"hair": "1", "hair_color": "#1f1a26", "top": "1", "top_color": "#2f3a5a", "top2_color": "#e8a23a"}),
    ("res_apprentice", "Назар Гайовий", "m", "mechanic_apprentice", "sto_site", {"hair": "2", "hair_color": "#4a2f27", "top": "0", "top_color": "#4a8fd0", "top2_color": "#3a3a44"}),
]
for k, (rid, name, gender, role, site, lk) in enumerate(_drive_people):
    look = {"skin_color": ["#f1c9a5", "#e0a97c", "#fbe0c8"][k], "eye_color": "#4a2f27", "face": str(k % 4), "bottom": "1", "bottom_color": "#2f3a5a",
            "shoes_color": "#3a3a44", "acc": "0", "acc_color": "#3a3a44", **lk}
    r = {"id": rid, "name": name, "gender": gender, "age": "adult", "home": _village_homes[(7 + k * 5) % len(_village_homes)],
         "honesty": 85, "temper": [30, 45, 25][k], "social": [75, 55, 85][k], "look": look, "job": [site, role]}
    if role == "mechanic_apprentice":
        r["young"] = True
    residents.append(r)

# ---- the things: the licence and the keys (on the ring), the canister (in the pocket) ---------------------------

key("driver_licence", "Посвідчення водія", [b(22, 32, 0, 56, 36, 3, "card"), b(26, 36, 3, 14, 18, 1, "photo"), b(44, 38, 3, 28, 3, 1, "line"), b(44, 44, 3, 22, 3, 1, "line"),
                                             b(26, 58, 3, 46, 4, 1, "stripe")],
    {"card": slot("pastel", 1), "photo": slot("ceramic", 2), "line": slot("ceramic", 5), "stripe": slot("fabric", 6)})
key("car_keys", "Ключі від машини", [b(28, 40, 0, 26, 18, 8, "fob", "round"), b(52, 46, 2, 30, 6, 4, "blade"), b(20, 44, 2, 10, 10, 4, "ring", "cyl")],
    {"fob": slot("ceramic", 5), "blade": slot("metal", 0), "ring": slot("metal", 1)})
good("fuel_can", "Каністра бензину", [b(26, 30, 0, 48, 40, 52, "can"), b(30, 34, 52, 16, 10, 8, "spout", "cyl"), b(52, 36, 52, 18, 6, 10, "handle")],
     {"can": slot("fabric", 1), "spout": slot("metal", 2), "handle": slot("fabric", 1)}, ("fuel",))

st("st.sto.can", "sto_in", "oil_drum", "Купити каністру бензину", "Механік наливає по вінця й закручує кришку: «Тільки не в салоні тримай».", "buy",
   cost=22, gives=[("fuel_can", 1)], per_day=2, hours=(8, 19))
st("st.sto.coffee", "sto_in", "waiting_bench", "Почекати з кавою з автомата", "Кава з автомата пахне бензином і дитинством. Механік щось насвистує під машиною.", "buy",
   cost=2, gives=[("coffee", 1)], per_day=2, hours=(8, 19))

# ---- what the instructor teaches, and asks -------------------------------------------------------------------------

LESSONS = [
    {"title": "Знаки й розмітка", "lines": [
        "Сідай. Перш ніж кермо — очі. Знаки кажуть усе, що треба знати, якщо їх читати.",
        "Червоне коло — заборона або обмеження. Синій квадрат — підказка: перехід, стоянка, лікарня.",
        "Трикутник з червоною облямівкою — увага. «Діти» біля школи означає: нога вже над гальмом.",
        "Суцільна лінія — не перетинати. Переривчаста — можна, якщо видно далеко.",
    ]},
    {"title": "Швидкість у місті", "lines": [
        "У місті — п'ятдесят. Не тому, що так написано, а тому, що з-за кожної машини може вибігти дитина.",
        "Біля школи — двадцять. Діти не дивляться на дорогу, вони дивляться одне на одного.",
        "Мокра дорога — довше гальмуєш. Сніг — ще довше. Поспішати в Липовому нікуди: усе одно все зачинено на обід.",
    ]},
    {"title": "Зебра й перевага", "lines": [
        "Біла зебра — це земля пішохода. Якщо на ній хтось стоїть або підходить — стоїш і ти.",
        "Не сигналь бабусі, що переходить. Вона йшла цим шляхом, ще коли тут возили сіно.",
        "На перехресті без світлофора поступаєшся тому, хто праворуч. Головна дорога — головна, але не для зухвалих.",
    ]},
    {"title": "Тротуар і стоянка", "lines": [
        "Тротуар — для ніг, не для коліс. Навіть «на хвилинку» — штраф і сором.",
        "Ставиш машину на дорозі вздовж узбіччя або на гравії біля СТО. Не перед брамою, не на зебрі.",
        "Вийшов — подивися назад. Велосипедист теж хоче доїхати додому.",
        "От і все. Тепер — теорія. Я питатиму так, як питатиме життя.",
    ]},
]
QUESTIONS = [
    {"q": "З якою швидкістю можна їхати містом?", "answers": ["50", "70", "Як дозволяє дорога"], "right": 0},
    {"q": "Біля школи стоїть знак «Діти». Що робиш?", "answers": ["Сигналю, щоб розступилися", "Скидаю швидкість до двадцяти", "Проїжджаю швидше, поки нікого нема"], "right": 1},
    {"q": "На зебрі стоїть пішохід. Хто їде першим?", "answers": ["Я, бо я на машині", "Пішохід", "Хто сміливіший"], "right": 1},
    {"q": "Чи можна поставити машину на тротуарі «на хвилинку»?", "answers": ["Так, якщо ввімкнути аварійку", "Ні", "Так, якщо ніхто не бачить"], "right": 1},
    {"q": "Що означає знак у червоному колі?", "answers": ["Заборону або обмеження", "Підказку", "Ремонт дороги"], "right": 0},
    {"q": "На перехресті без знаків і світлофора поступаєшся…", "answers": ["тому, хто ліворуч", "тому, хто праворуч", "нікому"], "right": 1},
    {"q": "Дорога мокра. Що змінюється?", "answers": ["Нічого", "Гальмівний шлях довшає", "Машина їде швидше"], "right": 1},
    {"q": "Чи можна сідати за кермо без посвідчення?", "answers": ["Ні", "Так, якщо недалеко", "Так, уночі"], "right": 0},
    {"q": "Що робиш, вийшовши з машини на вулицю?", "answers": ["Озираюся на велосипедистів", "Одразу відчиняю двері навстіж", "Нічого особливого"], "right": 0},
]

CARS = [
    {"id": "lastivka", "name": "Ластівка", "item": "car_hatch", "price": 650,
     "text": "Маленька зелена малолітражка, двадцять років на ходу. Двері зачиняються з другого разу, зате заводиться в мороз."},
    {"id": "dnipro", "name": "Дніпро", "item": "car_sedan", "price": 1150,
     "text": "Кремовий седан після одного власника — вчителя. Пахне книжками й м'ятними льодяниками."},
    {"id": "poltava", "name": "Полтава", "item": "car_wagon", "price": 1700,
     "text": "Синій універсал з багажником на даху: влазить і ялинка, і мішок картоплі, і вся родина."},
    {"id": "khvylia", "name": "Хвиля", "item": "car_blue", "price": 900,
     "text": "Невелика блакитна міська машинка: паркується де завгодно, а бак наповнюється на одну каву."},
    {"id": "kalyna", "name": "Калина", "item": "car_red", "price": 1400,
     "text": "Червоний седан з м'якими сидіннями і старим радіо, яке ловить лише «Липове FM»."},
    {"id": "buran", "name": "Буран", "item": "car_red", "price": 2400,
     "text": "Майже нова, з гаражу лікаря: тиха, тепла взимку й надійна в будь-яку погоду."},
]

FINES = [
    {"kind": "speeding", "name": "перевищення швидкості", "coins": 40, "holes": 1, "seen": 45},
    {"kind": "school_zone", "name": "швидкість біля школи", "coins": 80, "holes": 2, "seen": 75},
    {"kind": "zebra", "name": "непропуск пішохода на зебрі", "coins": 60, "holes": 2, "seen": 65},
    {"kind": "sidewalk", "name": "їзду тротуаром", "coins": 30, "holes": 1, "seen": 40},
    {"kind": "crash", "name": "наїзд на перешкоду", "coins": 50, "holes": 1, "seen": 90},
    {"kind": "pedestrian", "name": "небезпечну їзду біля людей", "coins": 120, "holes": 3, "seen": 95},
    {"kind": "no_licence", "name": "керування без посвідчення", "coins": 150, "holes": 0, "seen": 100, "arrest": True},
]

CELLMATE = [
    "Сусід по нарах перевертається: «Ти теж за швидкість? Я за курку. Вона перебігала, я гальмував… довга історія».",
    "«Тут найкраще спиться о п'ятій ранку. Саме тоді, коли вже відпускають».",
    "«Чергового звати Степан. Якщо попросити чаю чемно — дасть, ще й з цукром».",
    "У темряві хтось шкрябає на стіні: «Тут був Петро. Більше не буду». Нижче інша рука: «І я».",
    "«Знаєш, що найгірше? Не нари. А те, що завтра про тебе напише газета».",
    "Сусід зітхає: «Моя дружина каже, що я їжджу, як на пожежу. А я ж просто люблю музику гучно».",
    "За ґратами в коридорі цокає годинник. Його чути, як серце — повільно, рівно.",
]

DRIVING = {
    "school": "driving_in", "school_site": "driving_site", "school_hours": [9, 18],
    "sto": "sto_in", "sto_site": "sto_site", "sto_hours": [8, 19],
    "sto_park": list(DRIVE_WORLD["sto_park"]),
    "police": "police_in", "police_site": "police_site", "town": "village",
    "lesson_price": 25, "theory_price": 30, "exam_price": 50,
    "lessons": LESSONS, "questions": QUESTIONS, "theory_asked": 5, "theory_pass": 4,
    "cars": CARS, "fuel_price": 3, "can_item": "fuel_can", "can_fuel": 40,
    "oil_price": 40, "tyres_price": 120, "repair_price": 180,
    "fines": FINES, "licence_item": "driver_licence", "keys_item": "car_keys",
    "cellmate": CELLMATE, "coin_places": ["village", "fields", "forest", "farm"],
}
