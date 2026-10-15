# The cinema «Зоря» inside: the screen on the far wall, four rows of plush seats facing it, the ticket window and
# the popcorn cart by the door; its cashier and projectionist; a ticket, popcorn, and the film of the day (a
# different one at the weekend). Run inside gen_base_content.py after faiths.py.

R = Inside("cinema_in", "Кінотеатр «Зоря»", "cinema_site", 15, 14, "floor.carpet_moss", "wall.panel_oak", 6)
R.prop("cinema_big_screen", 5, 0, wall="north")
for y in (3, 6, 9):
    R.prop("film_poster", 0, y, wall="west")
    R.prop("film_poster", 14, y, wall="east")
for y in (3, 5, 7):
    for x in (2, 4, 8, 10):
        R.prop("cinema_seat", x, y)
# the lobby: the ticket window, the popcorn cart, a bench and a cooler for those early
R.prop("cinema_ticket_booth", 1, 11)
R.prop("popcorn_cart", 11, 11)
R.prop("waiting_bench", 12, 12, rot=2)
R.prop("water_cooler", 14, 10)
R.prop("newspaper_rack", 0, 13)
R.keep((6, 9))
R.post((3, 11), (12, 10), (1, 2), (13, 2), (6, 4), (12, 8))
rooms.append(R)
locations.append(R.build())

for _loc in locations:
    for _site in _loc.get("sites", []):
        if _site["id"] == "cinema_site":
            _site["jobs"] = [{"role": "cashier", "from": 720, "to": 1410, "wage": 24}, {"role": "projectionist", "from": 780, "to": 1440, "wage": 26}]
_home = [h for h in homes if h.startswith("home_")]
for _k, (_name, _gender, _role, _look) in enumerate((
        ("Віра Кіношна", "f", "cashier", {"top_color": "#d9534f", "top": "4", "hair": "5", "hair_color": "#c9a050"}),
        ("Ілля Проектор", "m", "projectionist", {"top_color": "#2f3a5a", "top": "2", "hair": "1", "hair_color": "#1f1a26"}))):
    residents.append({"id": f"res_{len(residents) + 1}", "name": _name, "gender": _gender, "age": "adult", "home": _home[(13 + _k * 5) % len(_home)],
                      "honesty": 85, "temper": 20, "social": 75, "job": ["cinema_site", _role],
                      "look": {"skin_color": "#f1c9a5", "eye_color": "#2a2035", "face": "1", "top2_color": "#e8e0c8", "bottom_color": "#2f3a5a", "bottom": "0",
                               "shoes_color": "#3a3a44", "acc": "0", "acc_color": "#d9534f", **_look}})

good("cinema_ticket", "Квиток у кіно", [b(20, 36, 0, 60, 28, 2, "paper"), b(60, 36, 2, 2, 28, 1, "tear")], {"paper": slot("autumn", 3), "tear": slot("ceramic", 5)}, ("ticket",))
good("popcorn", "Попкорн", [b(32, 32, 0, 36, 36, 40, "cup", "cyl"), b(30, 30, 36, 40, 40, 20, "corn", "ball")], {"cup": slot("fabric", 1), "corn": slot("ceramic", 0)}, ("food", "sweet"))

_fst("st.cinema.ticket", "cinema_in", "cinema_ticket_booth", "Купити квиток", "Касирка відриває квиток: «Сеанс уже скоро, сідайте де подобається».", "buy",
     cost=6, gives=[("cinema_ticket", 1)], per_day=2, hours=(12, 23), spent="«Квитки на сьогодні скінчилися — зал повний».")
_fst("st.cinema.popcorn", "cinema_in", "popcorn_cart", "Купити попкорн", "Теплий, солоний, у паперовому стаканчику — половина розсипається ще до залу.", "buy",
     cost=3, gives=[("popcorn", 1)], per_day=2, hours=(12, 23), spent="Попкорну на сьогодні більше нема.")
_fst("st.cinema.film", "cinema_in", "cinema_seat", "Дивитися фільм", "Світло гасне, проектор застрекотів. Сьогодні «Сміливі серця Липового» — про пожежників, що врятували міст. Зал сміється, плаче й аплодує.", "rest",
     needs=[("cinema_ticket", 1)], hours=(13, 24), days="weekdays", spent="Сеанс уже був — завтра новий.")
_fst("st.cinema.film_weekend", "cinema_in", "cinema_seat", "Дивитися фільм", "Вихідний сеанс: стара добра казка «Зоряний лис». Діти в першому ряду шепочуть репліки разом з героями.", "rest",
     needs=[("cinema_ticket", 1)], hours=(11, 24), days="weekends", spent="Сеанс уже був — завтра новий.")
