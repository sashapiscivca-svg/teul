# The temple's inside, its keeper and what one does there (sit on a cushion, light incense, leave an offering for a
# lighter heart, strike the gong, turn the wheels), and the forest circle (bow to the idol, tie a ribbon, and on the
# full moon stand in the circle round the fire). Run inside gen_base_content.py after growth_life.py (it needs
# `Inside`, `rooms`, `locations`, `residents`, `homes`, `stations`, `good`, `b`, `slot`).

# ---- things carried there ---------------------------------------------------------------------------------------
good("incense", "Пахощі", [b(20, 44, 0, 60, 12, 4, "box"), b(30, 48, 4, 3, 3, 40, "stick", "cyl"), b(40, 48, 4, 3, 3, 44, "stick", "cyl"), b(50, 48, 4, 3, 3, 38, "stick", "cyl")],
     {"box": slot("fabric", 1), "stick": slot("earth", 1)}, ("offering",))
good("ribbon", "Стрічка", [b(10, 40, 0, 80, 12, 2, "rib"), b(70, 40, 0, 12, 30, 2, "rib")], {"rib": slot("fabric", 1)}, ("offering",))

# ---- the hall: the low altar under the wheel, the incense before it, cushions on straw mats in two rows, the
# offerings on the days they are brought (everyone sits facing the altar), a gong, lotus lanterns, a row of prayer wheels by the door
R = Inside("temple_in", "Храм Тихого Лотоса", "temple_site", 13, 12, "floor.oak", "wall.cream", 5)
R.prop("dharma_wheel", 5, 0, wall="north")
R.prop("lotus_scroll", 1, 0, wall="north")
R.prop("lotus_scroll", 11, 0, wall="north")
for y in (3, 8):
    R.prop("lotus_scroll", 0, y, wall="west")
    R.prop("lotus_scroll", 12, y, wall="east")
R.prop("temple_altar", 5, 1)
R.prop("lotus_lantern", 0, 1)
R.prop("lotus_lantern", 12, 1)
R.prop("lotus_lantern", 0, 10)
R.prop("offering_table", 3, 1)
R.prop("offering_table", 8, 1)
R.prop("incense_burner", 5, 2)
for ox in (4, 7):
    n = len(R.props)
    R.prop("offering_bowls", ox, 2)
    R.props[n]["flag"] = "offerings"
R.prop("temple_gong", 10, 2)
for rx, ry in ((1, 4), (8, 4)):
    R.prop("straw_rug", rx, ry)
    for dx in (0, 1):
        for dy in (0, 1):
            R.prop("zafu", rx + dx, ry + dy, rot=2)
R.prop("bookshelf", 12, 5, rot=1)
R.prop("prayer_wheels", 10, 10)
R.prop("meditation_mat", 1, 10, rot=2)
R.prop("meditation_mat", 1, 7, rot=2)
R.prop("meditation_mat", 8, 7, rot=2)
R.keep((5, 7), (4, 6))
R.post((5, 3), (3, 3), (10, 3), (1, 3), (7, 9), (11, 8))
rooms.append(R)
locations.append(R.build())

# ---- its keeper (a newcomer added last, so nobody else's job or home moves) --------------------------------------
for _loc in locations:
    for _site in _loc.get("sites", []):
        if _site["id"] == "temple_site":
            _site["jobs"] = [{"role": "temple_keeper", "from": 360, "to": 1200, "wage": 22}]
residents.append({"id": f"res_{len(residents) + 1}", "name": "Ліна Тао", "gender": "f", "age": "adult", "home": [h for h in homes if h.startswith("home_")][11],
                  "honesty": 95, "temper": 5, "social": 60, "job": ["temple_site", "temple_keeper"],
                  "look": {"skin_color": "#f1c9a5", "hair_color": "#1f1a26", "hair": "7", "eye_color": "#2a2035", "face": "2", "top_color": "#e8a23a", "top2_color": "#d9534f",
                           "top": "4", "bottom_color": "#d9534f", "bottom": "4", "shoes_color": "#3a2a40", "acc": "0", "acc_color": "#e8a23a"}})


def _fst(id, location, prop, label, text, kind, cost=0, gives=(), needs=(), per_day=1, hours=None, days=None, spent=""):
    s = {"id": id, "location": location, "prop": prop, "label": label, "text": text, "kind": kind, "needs": [list(n) for n in needs], "cost": cost,
         "gives": [list(g) for g in gives], "earn": 0, "per_day": per_day, "seasons": [], "spent": spent}
    if hours:
        s["hours"] = list(hours)
    if days:
        s["days"] = days
    stations.append(s)


# ---- the temple: quiet things, nothing paid back -----------------------------------------------------------------
_fst("st.temple.buy_incense", "temple_in", "offering_table", "Взяти пахощі", "Хранителька загортає пучечок паличок у тонкий папір: «Сандал. Пахне, як тиша після дощу».",
     "buy", cost=3, gives=[("incense", 1)], per_day=2, hours=(6, 20), spent="Пахощі на сьогодні роздано — нові привезуть завтра.")
_fst("st.temple.incense", "temple_in", "incense_burner", "Запалити пахощі", "Димок тягнеться вгору тонкою ниткою, і думки потроху вкладаються, як листя на воді.",
     "wish", needs=[("incense", 1)], per_day=2, spent="Пахощі ще тліють — хай догорять.")
_fst("st.temple.offer_fruit", "temple_in", "offering_table", "Залишити підношення", "Кладеш плід поміж інших дарів. Хранителька тихо дзвонить у дзвоник: «Хай важке відпливає, а добре повертається». На серці легшає, наче змили стару пляму.",
     "wish", needs=[("#fruit", 1)], spent="Сьогодні ти вже приносив(-ла) дар. Хранителька всміхається: «Одного досить»." )
_fst("st.temple.offer_flowers", "temple_in", "offering_table", "Покласти квіти", "Квіти лягають біля лампадки. За тиждень вони зів'януть — і в цьому теж є свій урок, каже хранителька.",
     "wish", needs=[("#flower", 1)], spent="Квіти вже лежать — завтра принесеш нові.")
_fst("st.temple.gong", "temple_in", "temple_gong", "Вдарити в гонг", "Бом-м-м… Звук ходить по залі колами й довго не хоче вщухати.", "play", per_day=2,
     spent="Гонг ще гуде — хай відпочине.")
_fst("st.temple.wheels", "temple_in", "prayer_wheels", "Покрутити барабани", "Барабани рипнули й покотилися по колу. Кажуть, кожен оберт — це добре побажання для когось далекого.", "play", per_day=3)

# ---- the forest circle -----------------------------------------------------------------------------------------
_fst("st.grove.bow", "forest", "forest_idol", "Вклонитися ідолу", "Старий дуб дивиться чотирма обличчями на чотири боки. Вітер шумить у соснах, і здається — хтось кивнув у відповідь.",
     "wish", per_day=1, spent="Ідол уже бачив тебе сьогодні.")
_fst("st.grove.ribbon", "forest", "ribbon_post", "Зав'язати стрічку на бажання", "Стрічка лягає поряд із сотнею інших — вилинялих, свіжих, різнобарвних. Кожна чиясь надія.",
     "wish", needs=[("ribbon", 1)], spent="Одна стрічка на день — так тут заведено.")
_fst("st.grove.circle", "forest", "ritual_hearth_lit", "Стати в коло", "Повня. Вогонь тріщить, смолоскипи кидають тіні на камені. Люди беруться за руки й співають без слів — і ти теж. Коли пісня стихає, місяць стоїть просто над ідолом.",
     "play", per_day=1, hours=(20, 24), days="full_moon", spent="Коло вже прийняло тебе цієї ночі.")
# ribbons from the hardware shop's haberdashery corner
_fst("st.hardware.ribbon", "hardware_in", "cash_counter", "Купити стрічку", "Продавець відміряє метр стрічки: «Для подарунка чи на бажання?»", "buy", cost=1, gives=[("ribbon", 1)], per_day=3, hours=(8, 19))
