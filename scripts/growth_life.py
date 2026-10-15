# The growing town's life (crates/teul-core/src/growth.rs): which buildings wear and how they look worn and mended,
# the old houses that may be left empty, the building sites for the core, the ice-cream cart's day, the rooms of
# the donut shop, the car service, the driving school and the household shop, their stations and their people,
# and the named landmarks of the town. Run inside gen_base_content.py after town_life.py (it needs V, locations,
# rooms' Inside, stations, residents, items, GROW_* and LANDMARKS from town_growth.py).

import random as _random

_grng = _random.Random(2026)
_V = next(l for l in locations if l["id"] == "village")
_ITEM = {it["id"]: it for it in items}


def _bprop(site):
    """The building prop of a site (the one standing on its footprint's corner)."""
    x, y, w, h = site["building"]
    for p in _V["props"]:
        if p.get("wall") or p["x"] != x or p["y"] != y:
            continue
        d = _ITEM[p["item"]]
        fw, fh = (d["footprint"]["d"], d["footprint"]["w"]) if p.get("rot", 0) % 2 else (d["footprint"]["w"], d["footprint"]["d"])
        if (fw, fh) == (w, h):
            return p
    return None


def _free_cell(x, y):
    return V.inside(x, y) and (x, y) not in V.taken and (x, y) not in V.reserved and V.grid[y][x] in GREEN | {"p"}


def _front_cells(site):
    """Cells along a building's front (by its door), nearest the door first, the door and its path left clear."""
    x, y, w, h = site["building"]
    dx, dy = site["x"], site["y"]
    if dy >= y + h:
        cells = [(cx, y + h) for cx in range(x - 1, x + w + 1)]
    elif dy < y:
        cells = [(cx, y - 1) for cx in range(x - 1, x + w + 1)]
    elif dx >= x + w:
        cells = [(x + w, cy) for cy in range(y - 1, y + h + 1)]
    else:
        cells = [(x - 1, cy) for cy in range(y - 1, y + h + 1)]
    cells = [c for c in cells if c != (dx, dy) and abs(c[0] - dx) + abs(c[1] - dy) >= 2]
    return sorted(cells, key=lambda c: (abs(c[0] - dx) + abs(c[1] - dy), c))


def _ghost_at(item, x, y, flag):
    p = {"item": item, "x": x, "y": y, "flag": flag}
    _V["props"].append(p)
    return p


# ---- wear: the town's buildings, worn by turns and mended by its workers --------------------------------------
TOWN_WEAR = []
for sid in ("bakery", "grocery", "cafe_site", "post_site", "flower_shop_site", "school_site", "utility_site", "gym_site", "bar_site", "hostel_site", "vet_site",
            "hospital_site", "police_site", "newsroom_site", "clothes_site", "salon_site", "hardware_site"):
    site = next((s for s in _V["sites"] if s["id"] == sid), None)
    if not site or not site.get("building"):
        continue
    base = _bprop(site)
    if not base or "flag" in base or "unflag" in base:
        continue
    kinds = [k for k in ("crack", "window", "paint", "roof") if f"worn_{base['item']}_{k}" in _ITEM]
    if not kinds:
        continue
    base["unflag"] = f"worn:{sid}"
    for k in kinds:
        v = {kk: vv for kk, vv in base.items() if kk != "unflag"}
        v["item"] = f"worn_{base['item']}_{k}"
        v["flag"] = f"wear:{sid}:{k}"
        _V["props"].append(v)
    # the lamp by its door may go out too
    lamp = next((p for p in _V["props"] if p["item"] == "lamp_street" and "flag" not in p and "unflag" not in p and abs(p["x"] - site["x"]) <= 3 and abs(p["y"] - site["y"]) <= 3), None)
    if lamp:
        lamp["unflag"] = f"wear:{sid}:lamp"
        _ghost_at("lamp_street_dead", lamp["x"], lamp["y"], f"wear:{sid}:lamp")
        kinds.append("lamp")
    # where the ladder stands while it is mended, and the worker by it
    cell = next((c for c in _front_cells(site) if _free_cell(*c)), None)
    if cell:
        V.reserve(cell[0], cell[1], cell[0], cell[1])
        _ghost_at("ladder_wall", cell[0], cell[1], f"fix:{sid}")
    wx, wy = cell or (site["x"], site["y"])
    TOWN_WEAR.append({"id": sid, "name": site["name"], "location": "village", "kinds": kinds, "x": wx, "y": wy})


# ---- the old houses that may be left empty, years apart -------------------------------------------------------
ABANDON = []
_WHY = [("господарі поїхали до доньки в Польщу, а хату поки зачинили.", "у дім заселилася молода родина з Житомира — вже садять квіти під вікнами."),
        ("дід Остап переїхав до сина в обласний центр. Сусіди доглядають за садком.", "хату купили учителька з чоловіком — кажуть, буде найгарніший ґанок на вулиці.")]
for k, (sid, name, base, fp) in enumerate(GROW_OLD):
    base["unflag"] = f"abandon:{sid}"
    v = {kk: vv for kk, vv in base.items() if kk not in ("unflag", "colors")}
    v["item"] = f"abandoned_{base['item']}"
    v["flag"] = f"abandon:{sid}"
    _V["props"].append(v)
    x, y, w, h = fp
    site = next(s for s in _V["sites"] if s["id"] == sid)
    cells = [c for c in _front_cells(site) if _free_cell(*c)]
    for c in cells[:2]:
        V.reserve(c[0], c[1], c[0], c[1])
        _ghost_at("fence_broken", c[0], c[1], f"abandon:{sid}")
    for c in [(x - 1, y + 1), (x + w, y + 1)]:
        if _free_cell(*c):
            _ghost_at("weeds", c[0], c[1], f"abandon:{sid}")
    for c in [(x - 1, y), (x + w, y)]:
        if _free_cell(*c):
            V.reserve(c[0], c[1], c[0], c[1])
            _ghost_at("scaffold", c[0], c[1], f"mend:{sid}")
    wx, wy = cells[0] if cells else (site["x"], site["y"])
    why, back = _WHY[k % len(_WHY)]
    ABANDON.append({"id": sid, "name": name, "location": "village", "from": 25 + k * 200, "jitter": 40 + k * 60, "empty": [240, 260], "mend": 21, "why": why, "back": back, "x": wx, "y": wy})


# ---- the core's picture of it all -------------------------------------------------------------------------
GROWTH = {"sites": GROW_SITES, "abandon": ABANDON, "wear": TOWN_WEAR,
          "cart": {"location": "village", "months": [5, 6, 7, 8, 9], "hours": [11, 20], "spots": CART_STOPS}}


# ---- the rooms: the donut shop, and the doors the car service, the driving school and the household shop open --
R = Inside("donuts_in", "Пончикова", "donut_site", 13, 10, "floor.checker", "wall.cream", 5)
# the kitchen along the back wall: two fryers, a counter, the sink, the fridge, boxes
R.prop("donut_fryer", 0, 0)
R.prop("donut_fryer", 1, 0)
R.prop("counter", 2, 0)
R.prop("counter_sink", 3, 0)
R.prop("fridge", 4, 0)
R.prop("stock_boxes", 5, 0)
R.prop("menu_board_donut", 1, 0, wall="north")
R.prop("wall_clock", 7, 0, wall="north")
# the counter turned to the guests: the donuts behind glass, the till, the coffee
R.prop("donut_display", 1, 3)
R.prop("counter", 3, 3)
R.prop("cash_counter", 4, 3)
R.prop("coffee_bar", 6, 3)
for (tx, ty, a, c) in ((9, 1, (8, 1), (11, 2)), (9, 5, (8, 5), (11, 6)), (1, 6, (0, 6), (3, 7))):
    R.prop("round_table", tx, ty)
    R.prop("dining_chair_wood", a[0], a[1], rot=3)
    R.prop("dining_chair_wood", c[0], c[1], rot=1)
R.prop("string_lights", 0, 8, wall="west")
R.prop("window_wide", 12, 3, wall="east")
R.prop("window_wide", 12, 7, wall="east")
R.prop("monstera", 12, 9)
R.post((2, 2), (5, 2), (8, 4), (11, 5), (0, 5), (8, 0))
rooms.append(R)
_donuts = R.build()
_donuts["requires"] = {"flags": ["grow:donut_site:built"], "hint": "«Пончикова» ще будується: за парканом пахне цементом, а не пончиками. Зазирни, як відкриється."}
locations.append(_donuts)

# the donuts: what the shop sells (sweet things a child will love as a gift)
for did, dname, icing, sprinkle in (("donut_glazed", "Пончик у глазурі", ("fabric_pink", 3), ("autumn", 3)), ("donut_pink", "Рожевий пончик з посипкою", ("fabric_pink", 0), ("fabric", 6)),
                                    ("donut_choco", "Шоколадний пончик", ("earth", 0), ("fabric_pink", 3)), ("donut_berry", "Пончик з вишневим джемом", ("autumn", 3), ("fabric", 1))):
    good(did, dname, [b(28, 28, 0, 44, 44, 18, "dough", "cyl"), b(30, 30, 14, 40, 40, 6, "icing", "cyl"), b(44, 44, 0, 12, 12, 22, "hole", "cyl"),
                      b(36, 34, 20, 4, 4, 2, "sprinkle"), b(56, 40, 20, 4, 4, 2, "sprinkle"), b(40, 58, 20, 4, 4, 2, "sprinkle")],
         {"dough": slot("autumn", 1), "icing": slot(*icing), "hole": slot("ceramic", 5), "sprinkle": slot(*sprinkle)}, ("sweet", "food"))

# ice creams of the cart (the kiosk's cone stays as it was)
for iid, iname, scoop, top in (("ice_cream_plombir", "Пломбір у вафельному стаканчику", ("ceramic", 0), ("ceramic", 1)), ("ice_cream_choco", "Шоколадне морозиво", ("earth", 3), ("earth", 0)),
                               ("ice_cream_berry", "Полуничне морозиво", ("fabric_pink", 0), ("fabric", 1)), ("ice_cream_pistachio", "Фісташкове морозиво", ("leaf", 3), ("leaf", 1))):
    good(iid, iname, [b(40, 40, 0, 20, 20, 40, "cone", "cone"), b(34, 34, 34, 32, 32, 26, "scoop", "ball"), b(44, 44, 54, 12, 12, 10, "top", "ball")],
         {"cone": slot("autumn", 1), "scoop": slot(*scoop), "top": slot(*top)}, ("sweet", "food", "icecream"))



# ---- stations: donuts, the cart's ice cream, eating it on a bench -----------------------------------------------
def _gst(id, location, prop, label, text, kind, cost=0, gives=(), needs=(), per_day=1, hours=None, flag=None, spent="", seasons=(), days=None):
    s = {"id": id, "location": location, "prop": prop, "label": label, "text": text, "kind": kind, "needs": [list(n) for n in needs], "cost": cost,
         "gives": [list(g) for g in gives], "earn": 0, "per_day": per_day, "seasons": list(seasons), "spent": spent}
    if hours:
        s["hours"] = list(hours)
    if flag:
        s["flag"] = flag
    if days:
        s["days"] = days
    stations.append(s)


_DONUT = "grow:donut_site:built"
for did, label, text, cost in (("donut_glazed", "Пончик у глазурі", "Ще теплий, глазур тріскається під пальцями.", 4),
                               ("donut_pink", "Рожевий пончик з посипкою", "Посипка сиплеться на сорочку — і це нормально.", 5),
                               ("donut_choco", "Шоколадний пончик", "Шоколад ще не застиг. Серветка не допоможе.", 5),
                               ("donut_berry", "Пончик з вишневим джемом", "Джем, звісно, бризкає з першого ж укусу.", 6)):
    _gst(f"st.donuts.{did}", "donuts_in", "donut_display", f"Купити: {label.lower()}", text, "buy", cost=cost, gives=[(did, 1)], per_day=3, hours=(8, 20), flag=_DONUT,
         spent="Цих пончиків на сьогодні вже немає — нова партія завтра зранку.")
_gst("st.donuts.coffee", "donuts_in", "cash_counter", "Кава до пончика", "Велика кава з молоком у паперовому стаканчику з пончиком на ньому.", "buy", cost=4, gives=[("coffee", 1)],
     per_day=2, hours=(8, 20), flag=_DONUT, spent="Кавоварка відпочиває: кава на сьогодні скінчилася.")
for iid, label, text, cost in (("ice_cream_plombir", "Пломбір", "Справжній пломбір у вафельному стаканчику — холодний, аж зуби ломить.", 3),
                               ("ice_cream_choco", "Шоколадне", "Дві кульки шоколадного, ще й тертий шоколад зверху.", 4),
                               ("ice_cream_berry", "Полуничне", "Рожеве, з шматочками полуниці. Тане швидше, ніж їси.", 4),
                               ("ice_cream_pistachio", "Фісташкове", "Зелене, як травень, і трохи солоне — для тих, хто знає.", 5)):
    _gst(f"st.cart.{iid}", "village", "ice_cream_cart", f"Морозиво: {label.lower()}", text, "buy", cost=cost, gives=[(iid, 1)], per_day=2, hours=tuple(GROWTH["cart"]["hours"]),
         flag="icecream", days="daily", spent="Цього морозива в ящику вже не лишилося — продавець розводить руками.")
for prop in ("garden_bench", "bench"):
    _gst(f"st.eat_icecream.{prop}", "village", prop, "З'їсти морозиво", "Сідаєш, лижеш морозиво й дивишся, як живе вулиця. Найкращі десять хвилин дня.", "rest",
         needs=[("#icecream", 1)], per_day=6)


# ---- the people who work in the new places ------------------------------------------------------------------
_JOBS = {"donut_site": [("donut_baker", 360, 900, 26, [0, 1, 2, 3, 4, 5]), ("donut_seller", 480, 1200, 24, [])],
}
_village_homes = [h for h in homes if h.startswith("home_")]
_first_f = ["Олена", "Ярина", "Надія", "Людмила", "Аліна"]
_first_m = ["Віталій", "Сергій", "Ігор", "Максим", "Олексій"]
_surn = ["Пончак", "Гайовий", "Кравчук", "Литвин", "Савчук", "Рудько"]
_n = 0
for sid, jobs in _JOBS.items():
    site = next(s for s in _V["sites"] if s["id"] == sid)
    site["jobs"] = [{"role": r, "from": f, "to": t, "wage": w, **({"days": d} if d else {})} for r, f, t, w, d in jobs]
    for r, *_ in jobs:
        gender = "m" if r in ("mechanic", "driving_instructor") or _grng.random() < 0.4 else "f"
        first = _grng.choice(_first_m if gender == "m" else _first_f)
        look_ = {"skin_color": _grng.choice(["#f1c9a5", "#e0ac83", "#c68c62", "#f5d6bd"]), "hair_color": _grng.choice(["#1f1a26", "#4a2f27", "#7a4a2a", "#c9a050"]),
                 "hair": str(_grng.randrange(9)), "eye_color": "#2a2035", "face": str(_grng.randrange(4)), "top_color": _grng.choice(["#d86aa0", "#4a8fd0", "#5aa469", "#3a3a44"]),
                 "top2_color": "#e8e0c8", "top": str(_grng.randrange(6)), "bottom_color": "#2f3a5a", "bottom": str(_grng.randrange(3)), "shoes_color": "#3a3a44", "acc": "0", "acc_color": "#d9534f"}
        _n += 1
        residents.append({"id": f"res_grow_{_n}", "name": f"{first} {_grng.choice(_surn)}", "gender": gender, "age": "adult", "home": _village_homes[(_n * 7 + 2) % len(_village_homes)],
                          "honesty": 80, "temper": 25, "social": 70, "look": look_, "job": [sid, r]})


# ---- named landmarks: what the town's features stand by --------------------------------------------------------
for s in _V["sites"]:
    LANDMARKS.setdefault(f"door:{s['id']}", {"name": s["name"], "x": s["x"], "y": s["y"], "w": 1, "h": 1})
_V["landmarks"] = dict(sorted(LANDMARKS.items()))
