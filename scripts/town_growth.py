# The town grows (crates/teul-core/src/growth.rs): south of the Садова a new street, «Новобудовна», with plots where
# houses go up stage by stage (each stage a prop under its flag, sharing the plot's cells), two old houses that may
# be left empty and mended, the donut shop «Пончикова» on the far west end (built like the houses, then opened),
# the car service «СТО» with its forecourt and the driving school with its training ground on the east end; parking
# bays along the main street, zebra crossings by the school and the square; the ice-cream cart's stops; named
# landmarks for everything else to stand by. Run by world_maps.py right after style_village(V), before the streets
# are lit (so the new street gets its lamps) and before the interiors (they need the doors).

GROW_SITES = []      # (site def for the core, plot) — finished into GROWTH by growth_life.py
GROW_OLD = []        # old houses that may be left empty: (site id, name, its prop, footprint)
GROW_SPOTS = {}      # named cells for the cart and the people of the new places
LANDMARKS = {}


def landmark(id, name, x, y, w=1, h=1):
    LANDMARKS[id] = {"name": name, "x": x, "y": y, "w": w, "h": h}


def _ghost(m, item, x, y, flag, rot=0, colors=None):
    p = {"item": item, "x": x, "y": y, "flag": flag}
    if rot:
        p["rot"] = rot
    if colors:
        p["colors"] = colors
    m.props.append(p)
    return p


def _free(m, x, y, grounds=None):
    return m.inside(x, y) and (x, y) not in m.taken and (x, y) not in m.reserved and m.grid[y][x] in (grounds or GREEN)


def _clear_lane(m, cells):
    """Small things a street now runs through (a tree, a bike stand) are taken away."""
    cells = set(cells)
    keep = []
    for p in m.props:
        if p.get("wall") or "flag" in p:
            keep.append(p)
            continue
        d = ITEM[p["item"]]
        fp = set(m.footprint(p["item"], p["x"], p["y"], p.get("rot", 0)))
        if fp & cells and d["footprint"]["w"] * d["footprint"]["d"] <= 2:
            for c in fp:
                m.taken.pop(c, None)
            continue
        keep.append(p)
    m.props[:] = keep


# ---- the new street ---------------------------------------------------------------------------------------
_grow_rows = 22
_top = V.h
V.h += _grow_rows
V.grid += [["g"] * V.w for _ in range(_grow_rows)]
NY = _top + 12             # «Новобудовна»: lanes NY and NY + 1, pavements NY - 1 and NY + 2
_lanes = []
for _x in (14, 34):
    # the two cross streets come down from the Садова to the new street
    for _y in range(_top - 6, NY):
        for _dx, _ch in ((-1, "p"), (0, "c"), (1, "c"), (2, "p")):
            if V.grid[_y][_x + _dx] in GREEN | {"p", "h"} or _ch == "c":
                if V.grid[_y][_x + _dx] != "c":
                    V.grid[_y][_x + _dx] = _ch
            _lanes.append((_x + _dx, _y))
V.paint(1, NY - 1, V.w - 2, NY - 1, "p", only=GREEN)
V.paint(1, NY + 2, V.w - 2, NY + 2, "p", only=GREEN)
V.paint(1, NY, V.w - 2, NY + 1, "c")
_lanes += [(x, y) for x in range(1, V.w - 1) for y in range(NY - 1, NY + 3)]
_clear_lane(V, _lanes)
landmark("outskirts_street", "Вулиця Новобудовна", 1, NY, V.w - 2, 2)


# ---- building sites along the north side of the new street (doors south), and two on the south side ---------
def plot(id, name, final, x, y, rot, start, jitter, stages, stall, kind="house", done="", colors=None):
    """A plot where `final` will stand: the stages as props under their flags (sharing its cells), the finished
    building taking its cells under `grow:<id>:built`; builders' spot by its door."""
    d = ITEM[final]
    w, h = d["footprint"]["w"], d["footprint"]["d"]
    fw, fh = (h, w) if rot % 2 else (w, h)
    tag = f"{w}x{h}"
    for cx, cy in V.footprint(final, x, y, rot):
        assert _free(V, cx, cy, GREEN), f"plot {id} is not free at {cx},{cy}"
    door = (x + w // 2, y + h) if rot == 0 else (x + w - 1 - w // 2, y - 1)
    step = 1 if rot == 0 else -1
    # the finished building takes its cells and has its path to the street
    n = len(V.props)
    V.prop(final, x, y, rot=rot, colors=colors)
    V.props[n]["flag"] = f"grow:{id}:built"
    cx, cy = door
    while V.grid[cy][cx] in GREEN:
        V.grid[cy][cx] = "h"
        cy += step
    V.reserve(door[0], door[1], door[0], door[1])
    # the stages before it, on the same cells
    _ghost(V, f"site_pit_{tag}", x, y, f"grow:{id}:pit", rot=rot)
    _ghost(V, f"site_slab_{tag}", x, y, f"grow:{id}:foundation", rot=rot)
    _ghost(V, f"site_frame_{tag}", x, y, f"grow:{id}:walls", rot=rot)
    _ghost(V, final, x, y, f"grow:{id}:roof", rot=rot, colors=colors)
    _ghost(V, f"site_stalled_{tag}", x, y, f"grow:{id}:stalled", rot=rot)
    # by the front corners: the fence while it is a pit, the mixer and the bricks, then the scaffolding
    front = y + fh if rot == 0 else y - 1
    corners = [(x - 1, front), (x + fw, front)] if rot == 0 else [(x + fw, front), (x - 1, front)]
    left, right = corners
    for (sx, sy) in corners:
        if not _free(V, sx, sy):
            continue
        V.reserve(sx, sy, sx, sy)
        _ghost(V, "work_fence", sx, sy, f"grow:{id}:pit")
        _ghost(V, "cement_mixer", sx, sy, f"grow:{id}:foundation")
        _ghost(V, "scaffold", sx, sy, f"grow:{id}:walls")
        _ghost(V, "scaffold", sx, sy, f"grow:{id}:roof")
        _ghost(V, "fence_broken", sx, sy, f"grow:{id}:stalled")
    for (sx, sy) in ((x + fw, y), (x - 1, y)):
        if _free(V, sx, sy):
            V.reserve(sx, sy, sx, sy)
            _ghost(V, "brick_pallet", sx, sy, f"grow:{id}:foundation")
            _ghost(V, "brick_pallet", sx, sy, f"grow:{id}:walls")
            _ghost(V, "weeds", sx, sy, f"grow:{id}:stalled")
            break
    # the moving van for the first days, along the front beside the path
    if rot == 0 and _free(V, x, front) and _free(V, x + 1, front) and door[0] not in (x, x + 1):
        V.reserve(x, front, x + 1, front)
        _ghost(V, "moving_van", x, front, f"grow:{id}:moving")
    V.site(id, name, "home" if kind == "house" else kind, door, building=(x, y, fw, fh))
    spot = (left[0], left[1]) if _free(V, *left) or True else door
    GROW_SITES.append({"id": id, "name": name, "location": "village", "start": start, "jitter": jitter, "stages": stages, "stall": stall, "kind": kind, "done": done,
                       "x": door[0] + (1 if rot == 0 else -1), "y": door[1]})
    return door, (x, y, fw, fh)


_north = NY - 1 - 3        # 4x3 houses stand on these rows, their doors on the row above the pavement
PLOTS = [
    # id, name, house, x, start, jitter, stages (pit, foundation, walls, roof working days), stall ‰
    ("grow.nova1", "Дім на Новобудовній, 1", "cottage_cream", 3, 6, 10, [6, 12, 26, 16], 0),
    ("grow.nova3", "Дім на Новобудовній, 3", "cottage_sage", 8, 40, 30, [7, 14, 28, 18], 250),
    ("grow.nova5", "Двоповерховий дім на Новобудовній, 5", "house_tall_a", 18, 90, 60, [8, 16, 40, 22], 300),
    ("grow.nova7", "Дім на Новобудовній, 7", "cottage_rose", 23, 0, 0, [5, 10, 20, 18], 1000),
    ("grow.nova9", "Двоповерховий дім на Новобудовній, 9", "house_tall_c", 28, 160, 90, [8, 16, 40, 22], 300),
    ("grow.nova11", "Дім на Новобудовній, 11", "cottage_honey", 38, 230, 120, [7, 14, 28, 18], 250),
    ("grow.nova13", "Дім на Новобудовній, 13", "cottage_blue", 43, 320, 150, [7, 14, 28, 18], 250),
]
for pid, name, house, px, start, jitter, stages, stall in PLOTS:
    hh = ITEM[house]["footprint"]["d"]
    plot(pid, name, house, px, NY - 1 - 1 - hh, 0, start, jitter, stages, stall)

# the donut shop «Пончикова» on the far west end of the south side, facing the street: built like a house, then
# it opens (its door leads in only once it stands: the location requires its flag)
_south = NY + 3
door, fp = plot("donut_site", "Пончикова", "donut_shop", 2, _south, 2, 2, 0, [4, 8, 18, 12], 0, kind="donuts",
                done="На околиці відкрилася «Пончикова»! Пончики з глазур'ю, з посипкою, з вишневим джемом — і кава до них. Перші покупці стояли в черзі ще до відкриття.")
landmark("door:donut_site", "Пончикова", *door)
for (tx, ty) in ((fp[0] + fp[2] + 1, _south + 1), (fp[0] + fp[2] + 1, _south + 3)):
    if _free(V, tx, ty) and _free(V, tx + 1, ty):
        n = len(V.props)
        if V.prop("picnic_table", tx, ty, must=False):
            V.props[n]["flag"] = "grow:donut_site:built"
GROW_SPOTS["donut_tables"] = (fp[0] + fp[2] + 1, _south + 1)

# two more plots on the south side
for pid, name, house, px, start, jitter, stages, stall in (
        ("grow.nova2", "Дім на Новобудовній, 2", "cottage_cream", 12, 120, 80, [6, 12, 26, 16], 200),
        ("grow.nova4", "Дім на Новобудовній, 4", "cottage_rose", 21, 260, 120, [6, 12, 26, 16], 200)):
    plot(pid, name, house, px, _south, 2, start, jitter, stages, stall, colors={"wall": "#fff2c0"})


# ---- the car service «СТО»: its two bays open onto a forecourt, a couple of cars waiting, tyres stacked ------
door, fp = V.building_at("car_service", 58, _south + 1, rot=2, path_to=("p", "c"))
V.site("sto_site", "СТО «Гайка»", "garage", door, building=fp)
for _y in range(_south, fp[1]):
    for _x in range(fp[0] - 6, fp[0] + fp[2]):
        if V.grid[_y][_x] in GREEN | {"h"}:
            V.grid[_y][_x] = "c"
V.paint(fp[0] - 6, fp[1], fp[0] - 1, fp[1] + 3, "c", only=GREEN)
for (cx, cy, car) in ((fp[0] - 5, fp[1] + 1, "car_red"), (fp[0] - 5, fp[1] + 3, "car_blue")):
    V.prop(car, cx, cy, must=False, grounds={"c"})
V.prop("tyres", fp[0] - 6, fp[1], must=False, grounds={"c"})
V.prop("fuel_pump", fp[0] - 2, fp[1] - 1, must=False, grounds={"c"}) or V.prop("fuel_pump", fp[0] - 3, fp[1], must=False, grounds={"c"})
landmark("door:sto_site", "СТО", *door)
# where a car bought at the service waits for its owner (driving.py)
DRIVE_WORLD["sto_park"] = (fp[0] - 3, fp[1] + 2, 0)
landmark("sto_forecourt", "Майданчик перед СТО", fp[0] - 6, _south, 6 + fp[2], fp[1] + fp[3] - _south)

# ---- the driving school, and its training ground behind it (cones on a little square of asphalt) ----------
door, fp = V.building_at("driving_school", 52, _north, rot=0, path_to=("p", "c"))
V.site("driving_site", "Автошкола «Зелене світло»", "school", door, building=fp)
landmark("door:driving_site", "Автошкола", *door)
_gx0, _gy0, _gx1, _gy1 = 57, _top + 1, V.w - 2, _north + 2
V.paint(_gx0, _gy0, _gx1, _gy1, "c", only=GREEN)
# a slalom of cones down the middle, a row of bays to park in, a crossing to stop at, and the signs of the road
for k in range(6):
    V.prop("traffic_cone", _gx0 + 2 + k * 2, _gy0 + 2 + (k % 2), must=False, grounds={"c"})
for x in range(_gx0 + 2, _gx0 + 8):
    V.prop("parking_bay", x, _gy1 - 1, must=False, grounds={"c"})
V.prop("road_zebra", _gx1 - 3, _gy0 + 4, rot=1, must=False)
V.prop("road_sign_crossing", _gx1 - 4, _gy0 + 3, must=False, grounds={"c"})
V.prop("road_sign_speed", _gx0 + 1, _gy0 + 5, must=False, grounds={"c"})
for (cx, cy) in ((_gx1 - 1, _gy0 + 1), (_gx1 - 1, _gy1 - 3), (_gx0 + 14, _gy1 - 2)):
    V.prop("traffic_cone", cx, cy, must=False, grounds={"c"})
V.prop("learner_car", _gx0 + 3, _gy1 - 1, must=False, grounds={"c"})
V.prop("learner_car", _gx0 + 10, _gy0 + 6, rot=2, must=False, grounds={"c"})
# the ground opens onto the new street by a short drive
V.paint(_gx1 - 1, _gy1, _gx1, NY - 1, "c")
landmark("training_ground", "Автодром автошколи", _gx0, _gy0, _gx1 - _gx0 + 1, _gy1 - _gy0 + 1)


# ---- old houses on the south side of the Садова: lived in for years; one day maybe left empty ------------------
for k, (house, x, name) in enumerate((("cottage_honey", 3, "Старий дім на Садовій"), ("cottage_blue", 20, "Хата діда Остапа на Садовій"))):
    y = _top - 5
    fits = all(_free(V, cx, cy) for cx, cy in V.footprint(house, x, y, 2))
    if not fits:
        continue
    n = len(V.props)
    door, fp = V.building_at(house, x, y, colors={"wall": "#e8d8c0", "roof": "#6a4528"}, rot=2, path_to=("p", "c"))
    sid = f"home_old{k + 1}"
    V.site(sid, name, "home", door, building=fp)
    GROW_OLD.append((sid, name, V.props[n], fp))


# ---- parking along the main street and the new one; zebra crossings by the school and the square -----------
def parking(row, x0, x1, side_row):
    """Bays on the grass along a pavement: paved, lined, now and then a car in one."""
    run = [x for x in range(x0, x1 + 1) if _free(V, x, row) and V.at(x, side_row) == "p"]
    placed = 0
    for x in run:
        V.grid[row][x] = "c"
        V.prop("parking_bay", x, row, must=False, grounds={"c"})
        placed += 1
    return run


# on the main street: the grass strip east of the radio station (its little trees and bins make room)
_doors = {(s["x"], s["y"]) for s in V.sites}
_strip = [(x, 29) for x in range(44, 50) if (x, 29) not in _doors and V.at(x, 29) in GREEN and (x, 29) not in V.reserved]
_clear_lane(V, _strip)
_bays = parking(29, 44, 49, 28)
for x in _bays[::3]:
    if x + 1 in _bays:
        V.prop("car_red" if x % 2 else "car_blue", x, 29, must=False, grounds={"c"})
_bays2 = parking(NY + 3, 30, 50, NY + 2)
for x in _bays2[2::5]:
    if x + 1 in _bays2:
        V.prop("car_blue" if x % 2 else "car_red", x, NY + 3, must=False, grounds={"c"})
landmark("parking_main", "Паркування на Головній", _bays[0] if _bays else 44, 29, len(_bays) or 1, 1)
landmark("parking_outskirts", "Паркування на Новобудовній", 30, NY + 3, 21, 1)

# zebra crossings: where the children cross to the school, at the square, on the new street
school = next(s for s in V.sites if s["id"] == "school_site")
for (zx, zy, item_) in ((school["x"], 26, "zebra"), (school["x"], 27, "zebra"), (school["x"] + 1, 26, "zebra"), (school["x"] + 1, 27, "zebra"),
                        (36, 12, "zebra"), (36, 13, "zebra"), (37, 26, "zebra"), (37, 27, "zebra"),
                        (14, 31, "zebra_v"), (15, 31, "zebra_v"), (16, NY, "zebra"), (16, NY + 1, "zebra")):
    if V.at(zx, zy) == "c":
        V.prop(item_, zx, zy, must=False, grounds={"c"})
landmark("crossing_school", "Перехід біля школи", school["x"], 26, 2, 2)


# ---- the ice-cream cart's stops: the park, the pier, the square --------------------------------------------
def _cart_spot(area, near, grounds):
    x0, y0, x1, y1 = area
    best = None
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if all(_free(V, x + i, y, grounds) for i in (0, 1)) and all(V.inside(x + i, y + 1) and (x + i, y + 1) not in V.taken for i in (0, 1)):
                dd = abs(x - near[0]) + abs(y - near[1])
                if best is None or dd < best[0]:
                    best = (dd, x, y)
    assert best, f"no stop for the ice-cream cart near {near}"
    return best[1], best[2]


CART_STOPS = []
park = next(s for s in V.sites if s["id"] == "park_site")
sq = next(s for s in V.sites if s["id"] == "square_site")
for name, area, near, grounds in (("Парк біля озера", (36, 42, 52, 54), (park["x"] - 3, park["y"] - 1), GREEN | {"h", "p"}),
                                  ("Пляж біля пірса", (46, 42, 56, 56), (51, 47), GREEN | {"s", "h", "p"}),
                                  ("Ринок", (36, 29, 52, 36), (49, 31), {"p", "g", "h"})):
    x, y = _cart_spot(area, near, grounds)
    V.reserve(x, y, x + 1, y)
    CART_STOPS.append({"name": name, "x": x, "y": y})
    _ghost(V, "ice_cream_cart", x, y, f"cart:{len(CART_STOPS) - 1}")


# ---- the names of the town's places ------------------------------------------------------------------------
def _site(id):
    return next((s for s in V.sites if s["id"] == id), None)


_sq = _site("square_site")
landmark("square", "Площа з фонтаном", *_sq["area"])
landmark("square_centre", "Центр площі, біля фонтану", 42, 20)
landmark("main_street", "Вулиця Головна", 0, 26, V.w, 2)
landmark("sadova_street", "Вулиця Садова", 1, _top - 8, V.w - 2, 2)
landmark("park", "Парк біля озера", 39, 45, 12, 6)
landmark("lake", "Озеро", 54, 42, 17, 13)
landmark("pier", "Пірс", 51, 48, 7, 1)
landmark("beach", "Пляж", 52, 44, 3, 3)
landmark("river", "Річка", 56, 0, 4, 40)
landmark("hill", "Зоряний пагорб", 63, 29, 6, 4)
landmark("forest_edge", "Узлісся (дорога до лісу)", 14, 0, 2, 3)
landmark("to_fields", "Дорога до поля", 0, 26, 1, 2)
landmark("to_farm", "Дорога до ферми", 71, 12, 1, 2)
landmark("to_cemetery", "Дорога до кладовища", 71, 34, 1, 2)
landmark("to_dump", "Дорога до звалища", 71, 26, 1, 2)
landmark("factories", "Заводський край: хлібзавод, силоси, водонапірна вежа", 60, 0, 12, 12)
for i, s in enumerate(CART_STOPS):
    landmark(f"cart_stop_{i}", f"Зупинка візка з морозивом: {s['name']}", s["x"], s["y"], 2, 1)


# ---- the new street's greenery: trees and bushes on the grass that is left (never on a plot or a path)
import random as _r
_gr = _r.Random(84)
for _ in range(240):
    x, y = _gr.randrange(1, V.w - 1), _gr.randrange(_top, V.h)
    if all(_free(V, x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
        V.prop(_gr.choice(["tree_birch", "tree_maple", "tree_oak", "bush_round", "bush_flowering", "tree_apple"]), x, y, must=False, grounds=GREEN)


# ---- curb cuts: every paved bit a car may stand on joins the streets (the lanes behind the shops, the parking
# bays, the forecourt of the car service) — one road network for whatever drives on it
def _curb_cut(x, y):
    doors = {(s["x"], s["y"]) for s in V.sites}
    if V.at(x, y) == "p" and (x, y) not in doors:
        _clear_lane(V, [(x, y)])
        V.grid[y][x] = "c"
        return True
    return False


for (cx, cy) in ((13, 19), (16, 19), (33, 19)):
    _curb_cut(cx, cy)
if _bays:
    _curb_cut(_bays[0], 28)
    _curb_cut(_bays[-1], 28)
if _bays2:
    _curb_cut(_bays2[0], NY + 2)
    _curb_cut(_bays2[-1], NY + 2)
for _x in range(52, 58):
    if _curb_cut(_x, NY + 2):
        break
landmark("lane_behind_shops", "Провулок за крамницями", 2, 19, 31, 1)
