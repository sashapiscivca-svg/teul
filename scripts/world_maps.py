# The world outside the home: the village (the front door opens onto it) and the forest beyond it.
# Run inside gen_base_content.py after the items exist. Maps are painted cell by cell; props are placed with a
# check that nothing overlaps; trees and bushes are scattered last into whatever ground is left.

import math
import random

ITEM = {i["id"]: i for i in items}


class Map:
    def __init__(self, id, name, w, h, ground, legend):
        self.id, self.name, self.w, self.h = id, name, w, h
        self.grid = [[ground] * w for _ in range(h)]
        self.legend = legend
        self.props = []
        self.taken = {}
        self.reserved = set()
        self.places = []
        self.exits = []
        self.entry = None
        self.sites = []
        self.wires = []
        # still water (lakes, ponds) that freezes in winter; rivers and streams are painted with line() and flow
        self.still = set()

    def inside(self, x, y):
        return 0 <= x < self.w and 0 <= y < self.h

    def at(self, x, y):
        return self.grid[y][x] if self.inside(x, y) else None

    def paint(self, x0, y0, x1, y1, ch, only=None):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if self.inside(x, y) and (only is None or self.grid[y][x] in only):
                    self.grid[y][x] = ch

    def ellipse(self, cx, cy, rx, ry, ch, only=None):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1 and self.inside(x, y) and (only is None or self.grid[y][x] in only):
                    self.grid[y][x] = ch

    def lake(self, cx, cy, rx, ry):
        """Still water: a lake or a pond, iced over in a frosty winter (a river, drawn with line(), never is)."""
        self.ellipse(cx, cy, rx, ry, "w")
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                if self.at(x, y) == "w" and ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1:
                    self.still.add((x, y))

    def ice_runs(self):
        out = []
        for y in range(self.h):
            x = 0
            while x < self.w:
                if (x, y) in self.still and self.grid[y][x] == "w":
                    x0 = x
                    while x + 1 < self.w and (x + 1, y) in self.still and self.grid[y][x + 1] == "w":
                        x += 1
                    out.append([y, x0, x])
                x += 1
        return out

    def line(self, pts, width, ch, only=None):
        """A thick polyline through the points (a road, a path, a river)."""
        for (ax, ay), (bx, by) in zip(pts, pts[1:]):
            n = max(abs(bx - ax), abs(by - ay)) * 2 + 1
            for i in range(n + 1):
                t = i / n
                x, y = ax + (bx - ax) * t, ay + (by - ay) * t
                r = (width - 1) / 2
                self.paint(int(round(x - r)), int(round(y - r)), int(round(x + r)), int(round(y + r)), ch, only)

    def footprint(self, item, x, y, rot=0):
        d = ITEM[item]
        w, h = d["footprint"]["w"], d["footprint"]["d"]
        if rot % 2:
            w, h = h, w
        return [(x + i, y + j) for j in range(h) for i in range(w)]

    def fits(self, item, x, y, rot=0, grounds=None):
        layer = ITEM[item]["layer"]
        for cx, cy in self.footprint(item, x, y, rot):
            if not self.inside(cx, cy) or (cx, cy) in self.reserved:
                return False
            if layer != "rug" and (cx, cy) in self.taken:
                return False
            if grounds is not None and self.grid[cy][cx] not in grounds:
                return False
        return True

    def prop(self, item, x, y, rot=0, colors=None, must=True, grounds=None, wall=None, min_fill=0, min_day=0):
        if wall:
            # a thing on a wall (a board, a door, a window): it takes no floor
            p = {"item": item, "x": x, "y": y, "wall": wall}
            if colors:
                p["colors"] = colors
            self.props.append(p)
            return True
        # buildings never stand on a road or a path
        fp = ITEM[item]["footprint"]
        if ITEM[item]["category"] == "village" and ITEM[item]["layer"] == "floor" and fp["w"] * fp["d"] >= 6 and grounds is None and not getattr(self, "indoor", False):
            grounds = {"g", "m", "f", "s", "o"}
        if not self.fits(item, x, y, rot, grounds):
            if must:
                raise SystemExit(f"{self.id}: {item} at {x},{y} does not fit")
            return False
        p = {"item": item, "x": x, "y": y}
        if min_fill:
            p["min_fill"] = min_fill
        if min_day:
            p["min_day"] = min_day
        if rot:
            p["rot"] = rot
        if colors:
            p["colors"] = colors
        self.props.append(p)
        if ITEM[item]["layer"] != "rug":
            for c in self.footprint(item, x, y, rot):
                self.taken[c] = item
        return True

    def reserve(self, x0, y0, x1, y1):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.reserved.add((x, y))

    def place(self, id, name, x, y, w, h, activity, reserve=True):
        self.places.append({"id": id, "name": name, "x": x, "y": y, "w": w, "h": h, "activity": activity})
        if reserve:
            self.reserve(x, y, x + w - 1, y + h - 1)

    def door_of(self, item, x, y, rot=0):
        """The cell in front of a building's door (buildings face +y; turned twice they face -y)."""
        d = ITEM[item]
        w, h = d["footprint"]["w"], d["footprint"]["d"]
        dx = int((w * 100 // 2 - 26 + 26) // 100)
        if rot == 2:
            return (x + w - 1 - dx, y - 1)
        return (x + dx, y + h)

    def scatter(self, rng, choices, count, grounds, margin_from=None):
        placed = 0
        for _ in range(count * 6):
            if placed >= count:
                break
            item = rng.choice(choices)
            x, y = rng.randrange(self.w), rng.randrange(self.h)
            if self.fits(item, x, y, 0, grounds) and self.prop(item, x, y, must=False, grounds=grounds):
                placed += 1
        return placed

    def build(self):
        return {"id": self.id, "name": self.name, "w": self.w, "h": self.h, "tiles": ["".join(r) for r in self.grid], "legend": self.legend,
                "props": self.props, "places": self.places, "exits": self.exits, "sites": self.sites, **({"wires": self.wires} if self.wires else {}), **({"ice": self.ice_runs()} if self.still else {}), **({"entry": list(self.entry)} if self.entry else {})}

    def site(self, id, name, kind, door, area=None, building=None, jobs=(), price=0, stock=0):
        out = {"id": id, "name": name, "kind": kind, "x": door[0], "y": door[1]}
        if area:
            out["area"] = list(area)
        if building:
            out["building"] = list(building)
        if jobs:
            out["jobs"] = [{"role": r, "from": f, "to": t, "wage": w, **({"days": d} if d else {})} for r, f, t, w, d in jobs]
        if price:
            out["price"] = price
        if stock:
            out["stock"] = stock
        self.sites.append(out)

    def building_at(self, item, x, y, colors=None, path_to=("c", "p"), reach=10, rot=0):
        """Places a building facing its street (rot 0: south, 1: west, 2: north, 3: east), a path from its door to
        the street, and returns its door and footprint."""
        self.prop(item, x, y, rot=rot, colors=colors)
        d = ITEM[item]
        w, h = d["footprint"]["w"], d["footprint"]["d"]
        fw, fh = (h, w) if rot % 2 else (w, h)
        door, step = {
            0: ((x + w // 2, y + h), (0, 1)),
            2: ((x + w - 1 - w // 2, y - 1), (0, -1)),
            3: ((x + h, y + w - 1 - w // 2), (1, 0)),
            1: ((x - 1, y + w // 2), (-1, 0)),
        }[rot % 4]
        cx, cy = door
        n = 0
        painted = []
        while self.inside(cx, cy) and self.grid[cy][cx] not in path_to and n < reach and (cx, cy) not in self.taken:
            if self.grid[cy][cx] in GREEN:
                # a footpath of stones from the door to the street: no car comes up it
                painted.append((cx, cy, self.grid[cy][cx]))
                self.grid[cy][cx] = "h"
            cx += step[0]
            cy += step[1]
            n += 1
        if not (self.inside(cx, cy) and self.grid[cy][cx] in path_to):
            # straight out of the door leads nowhere: no dead-end stub, the shortest way round instead
            for px, py, ch in painted:
                self.grid[py][px] = ch
            self.connect(door, to=path_to)
        self.reserve(door[0], door[1], door[0], door[1])
        return door, (x, y, fw, fh)

    def connect(self, start, to=("c", "p", "t", "r", "h"), limit=60):
        """A footpath from a door along the shortest way over open ground (round buildings and water) to the
        nearest street or path. Returns whether it got there."""
        from collections import deque
        prev = {start: None}
        q = deque([start])
        end = None
        while q:
            c = q.popleft()
            x, y = c
            if c != start and self.grid[y][x] in to:
                end = c
                break
            if abs(x - start[0]) + abs(y - start[1]) > limit:
                continue
            for dx, dy in ((0, 1), (0, -1), (1, 0), (-1, 0)):
                nb = (x + dx, y + dy)
                if nb in prev or not self.inside(*nb) or nb in self.taken:
                    continue
                ch = self.grid[nb[1]][nb[0]]
                if ch not in GREEN and ch not in to and ch != "h":
                    continue
                prev[nb] = c
                q.append(nb)
        if end is None:
            return False
        c = prev[end]
        while c is not None:
            if self.grid[c[1]][c[0]] in GREEN:
                self.grid[c[1]][c[0]] = "h"
            self.reserved.add(c)
            c = prev[c]
        return True


POLE_TOP = 250


def wire(m, a, b_):
    """A wire between two points: (x, y) in tiles, z in hundredths of a tile; stored in hundredths."""
    m.wires.append({"a": [round(a[0] * 100), round(a[1] * 100), a[2]], "b": [round(b_[0] * 100), round(b_[1] * 100), b_[2]]})


def pole_near(m, x, y, grounds=("p", "g", "m", "o", "t", "r", "s", "d", "f"), item="power_pole", rot=0):
    """A pole at the free cell nearest to (x, y); returns its cell, or None."""
    for r in range(0, 3):
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                if max(abs(dx), abs(dy)) != r:
                    continue
                cx, cy = x + dx, y + dy
                if m.inside(cx, cy) and m.grid[cy][cx] in grounds and m.prop(item, cx, cy, rot=rot, must=False):
                    return (cx, cy)
    return None


def span(m, a, b_):
    """Two wires from pole top to pole top, at the ends of the cross-arms (across the line's direction)."""
    ax, ay = a[0] + 0.5, a[1] + 0.5
    bx, by = b_[0] + 0.5, b_[1] + 0.5
    dx, dy = bx - ax, by - ay
    n = max(1e-6, (dx * dx + dy * dy) ** 0.5)
    ox, oy = -dy / n * 0.3, dx / n * 0.3
    for k in (-1, 1):
        wire(m, (ax + ox * k, ay + oy * k, POLE_TOP), (bx + ox * k, by + oy * k, POLE_TOP))


def power_line(m, targets, start=None, every_transformer=0):
    """Poles near each target cell along a line, wired one to the next (and to `start`, a pole or a point)."""
    poles = []
    prev = start
    for i, (x, y) in enumerate(targets):
        nx, ny = targets[i + 1] if i + 1 < len(targets) else (x + (x - targets[i - 1][0] if i else 1), y + (y - targets[i - 1][1] if i else 0))
        rot = 1 if abs(nx - x) < abs(ny - y) else 0
        item = "pole_transformer" if every_transformer and i % every_transformer == every_transformer - 1 else "power_pole"
        c = pole_near(m, x, y, item=item, rot=rot)
        if c is None:
            continue
        if prev is not None:
            if len(prev) == 3:
                # a point (a gantry, the map's edge): both wires come to it
                for k in (-0.3, 0.3):
                    wire(m, (prev[0] + (k if rot == 1 else 0), prev[1] + (k if rot == 0 else 0), prev[2]), (c[0] + 0.5 + (k if rot == 1 else 0), c[1] + 0.5 + (k if rot == 0 else 0), POLE_TOP))
            else:
                span(m, prev, c)
        prev = c
        poles.append(c)
    return poles


LEGEND = {"h": "floor.path", "g": "floor.grass", "m": "floor.meadow", "c": "floor.cobble", "p": "floor.plaza", "r": "floor.gravel", "d": "floor.deck",
          "s": "floor.sand", "w": "floor.water", "o": "floor.soil", "f": "floor.moss", "t": "floor.dirt"}
GREEN = {"g", "m", "f"}

# =============================================================================================================
# The village: a grid of streets with sidewalks, the shops' street, the square, the school, the hospital, the
# police and fire stations, rows of houses with front gardens, the sawmill by the forest road, a farm and a hill
# across the river, a park by the lake
# =============================================================================================================
V = Map("village", "Містечко Липове", 72, 70, "g", LEGEND)
rng = random.Random(11)


def street_h(y, x0, x1):
    V.paint(x0, y - 1, x1, y - 1, "p", only={"g", "m"})
    V.paint(x0, y + 2, x1, y + 2, "p", only={"g", "m"})
    V.paint(x0, y, x1, y + 1, "c")


def street_v(x, y0, y1):
    V.paint(x - 1, y0, x - 1, y1, "p", only={"g", "m"})
    V.paint(x + 2, y0, x + 2, y1, "p", only={"g", "m"})
    V.paint(x, y0, x + 1, y1, "c")


# the river and the lake first, so streets cross them on bridges
V.line([(58, 0), (57, 12), (59, 24), (57, 36), (60, 44)], 3, "w")
V.lake(62, 48, 8.5, 6.5)
V.ellipse(62, 48, 10.5, 8.5, "s", only={"g"})
# meadows: the hill across the river, the park by the lake
V.ellipse(66, 33, 6, 5, "m")
V.ellipse(46, 48, 8, 6, "m")
street_h(12, 2, 71)
street_h(26, 0, 71)
street_h(40, 2, 53)
street_h(52, 2, 33)
street_v(14, 0, 67)
street_v(34, 2, 67)
# the new street in the south: the vet, the gym, the bar and more houses
street_h(66, 2, 71)
street_v(51, 8, 43)
for y in range(56):
    for x in range(72):
        if V.grid[y][x] == "w" and any(V.at(x + dx, y + dy) in ("c", "p") for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))) and (y in (11, 12, 13, 14, 25, 26, 27, 28)):
            V.grid[y][x] = "d"
for y in (12, 13, 26, 27):
    for x in range(52, 64):
        if V.grid[y][x] == "w":
            V.grid[y][x] = "d"
# the square
V.paint(37, 15, 49, 24, "p")
# the pier into the lake
V.paint(51, 48, 57, 48, "d")

homes = []
npc_homes = {}


def home(item, x, y, colors=None, npc=None, name=None, rot=0):
    door, fp = V.building_at(item, x, y, colors, rot=rot)
    hid = npc or f"home_{len(homes) + 1}"
    V.site(hid, name or f"Дім на {('Липовій', 'Садовій', 'Шкільній', 'Річковій')[len(homes) % 4]}, {len(homes) + 1}", "home", door, building=fp)
    if npc:
        npc_homes[npc] = door
    else:
        homes.append(hid)
    # a front garden: flowers either side of the path
    for fx in (fp[0], fp[0] + fp[2] - 1) if rot == 0 else ():
        if V.at(fx, fp[1] + fp[3]) in GREEN:
            V.prop(rng.choice(["flower_bed", "tulips", "rose_bush", "bush_flowering"]), fx, fp[1] + fp[3], must=False)
    return door


# row A: houses north of the first street
home("cottage_cream", 3, 8, npc="home_marta", name="Дім Марти")
home("house_tall_a", 8, 7, rot=3)
home("house_tall_b", 18, 7, npc="home_myron", name="Дім Мирона")
home("house_tall_b", 23, 7)
home("cottage_rose", 28, 7, npc="home_olena", name="Дім Олени", rot=3)
home("house_tall_c", 37, 7)
home("cottage_sage", 41, 8, npc="home_panas", name="Дім Панаса і Яринки")
home("cottage_honey", 45, 8, npc="home_taras", name="Дім Тараса")

# a lane behind the shops, and a row of houses on it
V.paint(2, 19, 12, 19, "c", only={"g", "m"})
V.paint(17, 19, 32, 19, "c", only={"g", "m"})
home("cottage_honey", 3, 15, colors={"wall": "#cfd8e8"})
home("cottage_cream", 8, 15, colors={"roof": "#6a4528"})
home("cottage_blue", 17, 15)
home("cottage_rose", 22, 15, colors={"wall": "#e8e0c8", "roof": "#3a5a8a"})
home("cottage_sage", 27, 15, rot=3)
# the farmhouse across the river, by the barn
home("cottage_honey", 67, 22, colors={"wall": "#e8d4b8", "roof": "#8a5a2e"}, name="Фермерська хата")

# a picnic place where the forest road leaves the village
V.prop("picnic_table", 4, 2)
V.prop("picnic_table", 8, 3)
V.prop("log_bench", 4, 5)
V.prop("forest_sign", 17, 3)
V.prop("lamp_street", 12, 5, must=False)

# row B: the shops' street (north side of the main street)
door, fp = V.building_at("flower_shop", 3, 22)
V.site("flower_shop_site", "Квітковий магазин «Півонія»", "flowers", door, area=(2, 25, 5, 1), building=fp, jobs=[("florist", 540, 1080, 28, [])])
door, fp = V.building_at("cafe_house", 8, 22)
V.site("cafe_site", "Кав'ярня «Липа»", "cafe", door, area=(8, 25, 5, 1), building=fp, jobs=[("waiter", 420, 1260, 28, [])], price=12)
door, fp = V.building_at("bakery", 17, 22)
V.site("bakery", "Пекарня «Паляниця»", "bakery", door, building=fp, jobs=[("baker", 240, 720, 30, [])], price=4, stock=60)
door, fp = V.building_at("grocery", 22, 22)
V.site("grocery", "Крамниця «Колосок»", "grocery", door, building=fp, jobs=[("seller", 480, 1200, 28, [])], price=5, stock=80)
door, fp = V.building_at("library_house", 27, 21)
V.site("library_site", "Бібліотека", "library", door, building=fp, jobs=[("librarian", 540, 1080, 26, [0, 1, 2, 3, 4, 5])])

# the square: the town hall at its head, the fountain before it, market stalls, lamps, benches, trees
V.paint(40, 15, 46, 18, "g")
door, fp = V.building_at("town_hall", 40, 15, path_to=("p",))
V.site("townhall_site", "Ратуша", "townhall", door, building=fp, jobs=[("mayor", 540, 1080, 40, [0, 1, 2, 3, 4]), ("clerk", 480, 1020, 30, [0, 1, 2, 3, 4])])
# the fountain on the square's axis, a step before the town hall's door; from the main street a wide open way
# leads straight up to it and to the door (kept clear: nothing the town adds later stands there)
_fi = len(V.props)
V.prop("fountain", 42, 21)
V.props[_fi]["unflag"] = "fountain_off"
# in winter the fountain is drained and covered; a fir in a tub with lights stands in its place
V.props.append({"item": "square_winter_fir", "x": 42, "y": 21, "flag": "fountain_off"})
for x, y in [(37, 15), (49, 15), (37, 24), (49, 24)]:
    V.prop("lamp_street", x, y)
V.reserve(41, 19, 45, 20)
V.reserve(41, 23, 45, 24)
V.reserve(40, 21, 41, 22)
V.reserve(44, 21, 45, 22)
V.prop("garden_bench", 39, 20, rot=3)
V.prop("garden_bench", 46, 20, rot=1)
# the square is kept open: the fountain, two benches by it, the lamps at its corners — nothing else stands on it
V.reserve(37, 15, 49, 24)
V.prop("signpost", 36, 25)
V.prop("post_box", 32, 25, must=False)
V.prop("bike_rack", 27, 28, must=False)
# the household shop «Господарчий» by the main street, its door onto the lane to the square (the water tower that
# stood here went to the factories' edge of the town, across the river)
door, fp = V.building_at("hardware_store", 29, 30, rot=3, path_to=("p",))
V.site("hardware_site", "Господарчий «Майстер»", "hardware", door, building=fp)
for x in range(6, 70, 11):
    for y in (11, 25, 28, 39, 42):
        if not (37 <= x <= 49 and 15 <= y <= 24):
            V.prop("trash_bin", x, y, must=False, grounds={"p"})
for x in range(3, 70, 17):
    for y in (14, 28):
        V.prop("hydrant", x, y, must=False, grounds={"p"})
V.site("square_site", "Площа", "square", (43, 20), area=(37, 15, 13, 6))
V.site("market_site", "Ринок", "market", (37, 31), area=(37, 31, 11, 2), jobs=[("vendor", 420, 1080, 24, [])], price=4, stock=50)

# row C: the school, the hospital, the police and the fire station (south of the main street)
door, fp = V.building_at("school", 17, 35, rot=2)
V.site("school_site", "Школа", "school", door, area=(17, 29, 6, 5), building=fp, jobs=[("teacher", 480, 900, 35, [0, 1, 2, 3, 4])])
V.prop("swing", 21, 30)
V.prop("sandbox", 21, 32)
V.prop("slide", 17, 30, must=False)
V.prop("tree_oak", 17, 32, must=False)
V.prop("garden_bench", 17, 34, rot=2, must=False)
V.prop("lamp_street", 22, 29, must=False)
door, fp = V.building_at("hospital", 25, 35, rot=2)
V.site("hospital_site", "Лікарня", "hospital", door, area=(24, 39, 8, 1), building=fp, jobs=[("doctor", 480, 1200, 40, []), ("nurse", 1200, 1920, 34, [])])
V.prop("garden_bench", 25, 31, rot=3)
V.prop("birdbath", 28, 31, must=False)
V.prop("flower_bed", 26, 33, must=False)
V.prop("flower_bed", 29, 33, must=False)
V.prop("tree_birch", 30, 30, must=False)
V.prop("ambulance", 28, 29, must=False)
V.prop("car_blue", 24, 29, must=False)
# the market across the main street from the square: two tidy rows of stalls facing each other over an aisle,
# lamps at its ends, a bench and a bin (the radio studio that stood here went out to the factories' edge)
_stalls = ["stall_veg", "stall_bread", "stall_flowers", "stall_veg", "stall_bread"]
_tints = [None, None, None, {"can_a": "#e8a23a"}, {"can_a": "#5aa469"}]
for k, x in enumerate(range(38, 48, 2)):
    V.prop(_stalls[k], x, 30, colors=_tints[k], must=False, grounds=GREEN | {"p", "h", "o"})
    V.prop(_stalls[(k + 2) % 5], x, 33, rot=2, colors=_tints[(k + 3) % 5], must=False, grounds=GREEN | {"p", "h", "o"})
V.paint(37, 30, 48, 33, "p", only=GREEN | {"o", "h"})
V.prop("lamp_street", 37, 31, must=False)
V.prop("lamp_street", 48, 32, must=False)
V.prop("trash_bin", 48, 31, must=False)
V.prop("notice_board", 37, 32, must=False)
V.reserve(37, 31, 47, 32)
door, fp = V.building_at("police_station", 38, 36)
V.site("police_site", "Поліція", "police", door, area=(37, 39, 6, 1), building=fp, jobs=[("officer", 480, 1320, 35, []), ("night_officer", 1320, 2040, 35, [])])
V.prop("police_car", 38, 34, must=False)
V.prop("hydrant", 43, 34, must=False)
door, fp = V.building_at("fire_station", 44, 35)
V.site("fire_site", "Пожежна частина", "fire", door, area=(43, 39, 7, 1), building=fp, jobs=[("firefighter", 480, 1200, 35, []), ("firefighter_night", 1200, 1920, 35, [])])
V.prop("fire_truck", 44, 32, must=False)
V.prop("hydrant", 49, 34, must=False)
V.prop("board_fence", 49, 30, must=False)
# west of the school: the community garden and the orchard
V.paint(3, 30, 11, 34, "o")
for i, bed in enumerate(["bed_tomatoes", "bed_carrots", "bed_cabbage", "bed_strawberries", "bed_potatoes", "bed_peppers"]):
    V.prop(bed, 3 + (i % 3) * 3, 30 + (i // 3) * 3, must=False)
V.prop("scarecrow", 10, 32, must=False)
# the post office on the main street: the clerk at the counter, the postman out on his round in the morning
door, fp = V.building_at("post_office", 8, 43, rot=2)
V.site("post_site", "Пошта «Липове»", "post", door, building=fp, jobs=[("postal_clerk", 480, 1080, 26, [0, 1, 2, 3, 4, 5]), ("postman", 420, 900, 26, [0, 1, 2, 3, 4, 5])])
# the utility office on the same street: bills for garbage, water, electricity and gas are paid at its counter;
# its inspector goes round the houses reading the meters late in the morning
door, fp = V.building_at("utility_office", 27, 43, rot=2)
V.site("utility_site", "Комунальна контора", "utility", door, building=fp, jobs=[("utility_clerk", 480, 1020, 28, [0, 1, 2, 3, 4]), ("utility_inspector", 540, 960, 30, [0, 1, 2, 3, 4])])

home("cottage_sage", 3, 36, colors={"wall": "#e9d9ff", "roof": "#3a5a8a"}, npc="home_solomiia", name="Дім Соломії")
home("house_tall_c", 8, 35, colors={"wall": "#f4d6d6"})

# the workshop "Друге життя", by the player's house: worn things found by the bins are mended here
door, fp = V.building_at("workshop", 3, 43, rot=2)
V.site("workshop_site", "Майстерня «Друге життя»", "workshop", door, building=fp, jobs=[("craftsman", 540, 1080, 30, [0, 1, 2, 3, 4, 5])])

# row E: the new street in the south. North of it, facing the fourth street: the vet, the gym and the bar;
# south of them houses facing the new street, and the bicycle hire
door, fp = V.building_at("vet_clinic", 3, 56, rot=2)
V.site("vet_site", "Ветклініка «Лапка»", "vet", door, building=fp, jobs=[("vet", 540, 1080, 34, [0, 1, 2, 3, 4, 5]), ("vet_nurse", 540, 1080, 28, [0, 1, 2, 3, 4])])
door, fp = V.building_at("gym", 18, 56, rot=2)
V.site("gym_site", "Спортзал «Сила»", "gym", door, building=fp, jobs=[("coach", 480, 1260, 30, [])])
door, fp = V.building_at("bar_house", 26, 56, rot=2)
V.site("bar_site", "Бар «Жабка»", "cafe", door, building=fp, jobs=[("bartender", 1020, 1500, 30, [])], price=10)
V.prop("bike_stand", 10, 57, must=False)
V.prop("bike_stand", 47, 62, must=False)
V.prop("bike_stand", 31, 24, must=False)
for x in (8, 24, 40):
    V.prop("lamp_street", x, 65, must=False, grounds={"p"})
    V.prop("trash_bin", x + 3, 65, must=False, grounds={"p"})

# row D: houses south of the third street, the player's own house among them
V.prop("home_house", 3, 48)
V.entry = (5, 51)
V.reserve(4, 51, 6, 51)
home("cottage_honey", 9, 47, rot=3)
home("house_tall_a", 17, 47, colors={"wall": "#d6ecdc"}, rot=1)
home("cottage_cream", 22, 48, colors={"roof": "#3f7f4a"})
home("house_tall_b", 27, 47)
# the orchard between the third street and the houses
for i in range(8):
    V.prop("tree_apple", 17 + (i % 4) * 3, 43 + (i // 4) * 2, must=False)
V.prop("mailbox", 8, 51, must=False)

# the park by the lake: trees, benches, the beach, the pier
V.prop("tree_willow", 40, 44, must=False)
V.prop("picnic_table", 38, 50, must=False)
# the playground in the park
V.prop("swing", 41, 52, must=False)
V.prop("carousel", 43, 50, must=False)
V.prop("seesaw", 46, 50, must=False)
V.prop("climbing_frame", 38, 52, must=False)
V.prop("sandbox", 46, 52, must=False)
V.prop("trash_bin", 45, 49, must=False)
V.site("playground", "Дитячий майданчик", "playground", (44, 49), area=(38, 49, 11, 5))
V.prop("birdbath", 46, 52, must=False)
V.prop("flower_bed", 43, 44, must=False)
V.prop("lamp_street", 38, 47, must=False)
V.prop("lamp_street", 50, 46, must=False)
V.prop("tulips", 48, 53, must=False)
V.prop("garden_bench", 43, 47, rot=3)
V.prop("garden_bench", 47, 45, rot=3)
V.prop("rose_arch", 44, 50, must=False)
V.prop("garden_lights", 49, 49, must=False)
V.prop("boat", 60, 52, must=False)
V.site("park_site", "Парк біля озера", "park", (45, 48), area=(39, 45, 12, 6))
# across the river in the north: the bread factory, where the field's wheat is milled and baked for the village,
# with its grain silos and the yard where the vans load; the old barn by the farmhouse
door, fp = V.building_at("bread_factory", 61, 2)
V.site("bread_factory_site", "Хлібзавод «Колос»", "factory", door, area=(61, 8, 8, 2), building=fp,
       jobs=[("miller", 360, 900, 30, [0, 1, 2, 3, 4, 5]), ("factory_baker", 240, 780, 30, []), ("driver", 420, 1020, 28, [0, 1, 2, 3, 4, 5])])
V.prop("silo", 69, 2)
V.prop("silo", 69, 5)
V.prop("bread_van", 62, 8, must=False)
V.prop("flour_sacks", 68, 8, must=False)
door, fp = V.building_at("barn", 63, 15)
# the water tower on the factories' edge of the town, by the silos: to climb and look over the whole town
_tower = None
for _ty in range(9, 24):
    for _tx in range(61, 70):
        if _tower is None and V.fits("water_tower", _tx, _ty, grounds=GREEN) and all(V.at(_tx, _ty + 2 + k) in GREEN | {"h", "p", "c"} for k in range(1)) and (_tx, _ty + 2) not in V.taken:
            _tower = (_tx, _ty)
assert _tower, "no room for the water tower by the factories"
V.prop("water_tower", *_tower)
# its door is at the foot of the ladder: inside, the tank and the way up to the gallery
V.site("water_tower_site", "Водонапірна вежа", "tower", (_tower[0], _tower[1] + 2), building=(_tower[0], _tower[1], 2, 2), jobs=[("tower_keeper", 480, 960, 24, [0, 1, 2, 3, 4])])
V.reserve(_tower[0], _tower[1] + 2, _tower[0], _tower[1] + 2)
V.connect((_tower[0], _tower[1] + 2))
# (the farm's work is on the farm east of the village, see world_more.py)
# the church on the hill across the river, facing the main street; behind it the way to the cemetery
door, fp = V.building_at("church", 61, 30, rot=2)
V.site("church_site", "Костел святого Миколая", "church", door, area=(60, 34, 7, 2), building=fp, jobs=[("priest", 420, 1140, 24, [])])
# the way to the cemetery: off the pavement, down the church's east side, round behind it and on to the gate
V.paint(66, 29, 67, 35, "h", only={"g", "m"})
V.paint(61, 34, 71, 35, "h", only={"g", "m"})
V.reserve(66, 29, 67, 35)
V.exits.append({"x": 71, "y": 34, "w": 1, "h": 2, "to": "cemetery", "at": [2, 13], "name": "До кладовища"})
V.reserve(68, 33, 71, 36)
V.prop("telescope", 68, 30, must=False)
V.prop("log_bench", 67, 38, must=False)
V.prop("tree_birch", 60, 35, must=False)
V.prop("tree_birch", 66, 31, must=False)

V.exits.append({"x": 14, "y": 0, "w": 2, "h": 1, "to": "forest", "at": [44, 92], "name": "До лісу"})
V.exits.append({"x": 71, "y": 12, "w": 1, "h": 2, "to": "farm", "at": [1, 22], "name": "До ферми"})
V.exits.append({"x": 0, "y": 26, "w": 1, "h": 2, "to": "fields", "at": [61, 22], "name": "До поля"})

# ---- the substation on the edge of the village, in the north behind the houses, fenced, with a gate
V.prop("substation", 41, 2)
for x in (40, 41, 44, 45):
    V.prop("mesh_fence", x, 5)
V.prop("mesh_gate", 42, 5)
for x in range(40, 46):
    V.prop("mesh_fence", x, 1)
for y in (2, 3, 4):
    V.prop("mesh_fence", 40, y, rot=1)
    V.prop("mesh_fence", 45, y, rot=1)
V.site("substation_site", "Підстанція", "power", (42, 6), area=(41, 2, 4, 3))
V.connect((42, 6))
GANTRY = [(41.6, 4.25, 268), (42.7, 4.25, 268), (43.8, 4.25, 268)]

# ---- power: the line from the wind turbines comes in from the fields at the west, up the first street and
# along behind the houses to the substation; from there poles carry it down and along the streets, a
# transformer every few poles for the houses
feed = power_line(V, [(1, 28), (7, 28), (13, 23), (13, 17), (13, 9), (13, 4), (19, 4), (25, 4), (31, 4), (37, 4)], start=(0, 28.2, POLE_TOP))
if feed:
    for g_ in GANTRY:
        wire(V, (feed[-1][0] + 0.5, feed[-1][1] + 0.5, POLE_TOP), g_)
main = power_line(V, [(36, 8), (36, 14), (36, 20), (36, 27)], start=GANTRY[2], every_transformer=2)
if main:
    power_line(V, [(30, 11), (24, 11), (18, 11), (12, 11), (6, 11)], start=main[0], every_transformer=2)
    power_line(V, [(42, 11), (48, 11), (54, 11), (62, 11), (68, 11)], start=main[0], every_transformer=2)
    power_line(V, [(46, 28), (50, 28), (55, 28), (61, 28), (67, 28)], start=main[-1], every_transformer=2)
    west = power_line(V, [(30, 28), (24, 28), (19, 28)], start=main[-1], every_transformer=2)
    if west:
        south = power_line(V, [(16, 34), (16, 39), (16, 45), (16, 51)], start=west[-1], every_transformer=2)
        if len(south) > 1:
            power_line(V, [(19, 42), (25, 42), (31, 42), (37, 42), (43, 42)], start=south[1], every_transformer=2)

# ---- gas: underground mostly; here and there the yellow pipe comes up and runs on supports beside a street
def gas_runs(m, rng, count):
    runs = []
    cands = []
    for y in range(1, m.h - 1):
        x = 0
        while x < m.w:
            n = 0
            while x + n < m.w and m.grid[y][x + n] in GREEN and (x + n, y) not in m.taken and (x + n, y) not in m.reserved:
                n += 1
            if n >= 6 and any(m.at(x + i, y - 1) == "p" or m.at(x + i, y + 1) == "p" for i in range(n)):
                cands.append(("h", x, y, min(n, 9)))
            x += max(1, n)
    for x in range(1, m.w - 1):
        y = 0
        while y < m.h:
            n = 0
            while y + n < m.h and m.grid[y + n][x] in GREEN and (x, y + n) not in m.taken and (x, y + n) not in m.reserved:
                n += 1
            if n >= 6 and any(m.at(x - 1, y + i) == "p" or m.at(x + 1, y + i) == "p" for i in range(n)):
                cands.append(("v", x, y, min(n, 9)))
            y += max(1, n)
    rng.shuffle(cands)
    for kind, x, y, n in cands:
        if len(runs) >= count or any(abs(x - rx) + abs(y - ry) < 16 for _, rx, ry, _ in runs):
            continue
        cells = [(x + i, y) if kind == "h" else (x, y + i) for i in range(n)]
        doors = [(s_["x"], s_["y"]) for s_ in m.sites]
        if any((c in m.taken) for c in cells) or any(abs(cx - dx) <= 2 and abs(cy - dy) <= 2 for cx, cy in cells for dx, dy in doors):
            continue
        # nor next to a path (a door's path to the street runs along cobbles)
        if any(m.at(cx + ex, cy + ey) in ("c", "h") for cx, cy in cells for ex, ey in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            continue
        for i, (cx, cy) in enumerate(cells):
            if i == 0:
                m.prop("gas_riser", cx, cy, rot=0 if kind == "h" else 1)
            elif i == n - 1:
                m.prop("gas_riser", cx, cy, rot=2 if kind == "h" else 3)
            else:
                m.prop("gas_pipe", cx, cy, rot=0 if kind == "h" else 1)
        runs.append((kind, x, y, n))
    return runs



V.exits.append({"x": 71, "y": 26, "w": 1, "h": 2, "to": "dump", "at": [2, 10], "name": "До звалища"})
V.reserve(12, 0, 17, 2)

V.place("square", "Площа з фонтаном", 37, 16, 13, 4, "chat")
V.place("market", "Ринок", 38, 23, 11, 1, "shop", reserve=False)
V.place("cafe", "Кав'ярня «Липа»", 8, 25, 5, 1, "cafe")
V.place("flower_shop", "Квітковий магазин «Півонія»", 2, 25, 5, 1, "flowers")
V.place("library", "Бібліотека", 27, 25, 5, 1, "read")
V.place("park", "Парк біля озера", 39, 45, 12, 6, "walk")
V.place("pond", "Пірс", 51, 48, 4, 1, "fish")
V.place("beach", "Пляж", 52, 44, 3, 3, "swim")
V.place("hill", "Зоряний пагорб", 63, 29, 6, 4, "stars")
V.place("garden", "Спільний город", 3, 29, 9, 1, "garden")
V.place("orchard", "Сад", 16, 43, 13, 3, "walk", reserve=False)
names = {"home_marta": "Дім Марти", "home_myron": "Дім Мирона", "home_panas": "Дім Панаса і Яринки", "home_olena": "Дім Олени",
         "home_taras": "Дім Тараса", "home_solomiia": "Дім Соломії"}
for hid, (x, y) in npc_homes.items():
    V.place(hid, names[hid], x, y, 1, 1, "home")
V.place("home_ostap", "Кімнатка над бібліотекою", 29, 25, 1, 1, "home", reserve=False)
V.site("forest_edge", "Узлісся", "forest", (14, 2), area=(16, 1, 6, 4))

# lamps along the streets, then trees and bushes on whatever grass is left
for x in range(4, 70, 8):
    for y in (11, 25, 39):
        V.prop("lamp_street", x, y - 1, must=False, grounds={"g", "m"})
# the hostel «Лелека» at the east end of the new street, for those passing through
door, fp = V.building_at("hostel", 52, 59)
V.site("hostel_site", "Хостел «Лелека»", "hostel", door, building=fp, jobs=[("receptionist", 420, 1380, 26, [])])
V.prop("bike_stand", 59, 62, must=False)
V.prop("bench", 50, 63, must=False)
for args in [("cottage_blue", 3, 61), ("cottage_rose", 8, 61), ("house_tall_b", 18, 60), ("cottage_sage", 23, 61), ("cottage_cream", 28, 61), ("house_tall_c", 38, 60), ("cottage_honey", 43, 61)]:
    home(*args, colors={"wall": rng.choice(["#e8e0c8", "#d6ecdc", "#cfd8e8", "#f4d6d6", "#fff2c0"])})
# the newsroom of «Липовий вісник» at the east end of the new street: the village's journalists work from here
door, fp = V.building_at("newsroom", 61, 60)
V.site("newsroom_site", "Редакція «Липовий вісник»", "newsroom", door, building=fp,
       jobs=[("editor", 540, 1140, 34, [0, 1, 2, 3, 4]), ("journalist", 540, 1140, 30, [0, 1, 2, 3, 4, 5]), ("photographer", 600, 1140, 28, [0, 1, 2, 3, 4, 5])])
# the new street gets its line too (its poles go up once its houses stand)
if west and south:
    power_line(V, [(16, 58), (16, 64), (22, 65), (30, 65), (40, 65), (50, 64)], start=south[-1], every_transformer=2)
# gas pipes come up only once every building stands, and never in front of a door or across its path
GAS = gas_runs(V, random.Random(77), 5)
# the gas regulator cabinet stands by where a run comes up (the first that has room for it away from every door)
doors_here = [(st["x"], st["y"]) for st in V.sites]
placed_cabinet = False
for kind, gx, gy, gn in GAS:
    near = sorted(((gx + dx, gy + dy) for dx in range(-2, 3) for dy in range(-2, 3) if (dx, dy) != (0, 0)), key=lambda c: (abs(c[0] - gx) + abs(c[1] - gy), c))
    for cx, cy in near:
        if any(abs(cx - dx) <= 2 and abs(cy - dy) <= 2 for dx, dy in doors_here):
            continue
        if V.inside(cx, cy) and V.grid[cy][cx] in GREEN and V.prop("gas_cabinet", cx, cy, must=False):
            placed_cabinet = True
            break
    if placed_cabinet:
        break
V.scatter(rng, ["tree_birch", "tree_maple", "tree_oak", "tree_pine", "bush_round", "bush_flowering", "tree_birch"], 90, GREEN)
V.scatter(rng, ["tulips", "rocks", "mushrooms", "sunflowers", "rose_bush"], 40, GREEN)

# =============================================================================================================
# The forest: pines to the north, a birch grove to the east, a lake with a stream, glades, the ancient oak,
# a logging clearing on the road from the village, berry patches and mushroom rings
# =============================================================================================================
def light_streets(m, item="lamp_street", step=8, road=("c",), walk=("p",)):
    """Street lamps along every pavement by a road, about every `step` cells: never at a door or on the path to
    one, never right next to another lamp. Put in last, after every building and path is there."""
    doors = {(s["x"], s["y"]) for s in m.sites}
    lamps = [(p["x"], p["y"]) for p in m.props if p["item"] == item]
    for y in range(m.h):
        for x in range(m.w):
            if m.grid[y][x] not in walk or (x + 2 * y) % step != 0:
                continue
            if not any(m.at(x + dx, y + dy) in road for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                continue
            near_door = any(abs(x - dx) <= 1 and abs(y - dy) <= 1 for dx, dy in doors)
            near_path = any(m.at(x + dx, y + dy) == "h" for dx in (-1, 0, 1) for dy in (-1, 0, 1))
            near_lamp = any(abs(x - lx) <= 3 and abs(y - ly) <= 3 for lx, ly in lamps)
            if near_door or near_path or near_lamp:
                continue
            if m.prop(item, x, y, must=False, grounds=set(walk)):
                lamps.append((x, y))


# ---- clothes, hair and homes to rent or buy (docs/world-economy.md §11)
exec((pathlib.Path(__file__).resolve().parent / "style_world.py").read_text(encoding="utf-8"))
style_village(V)
# ---- the road: zebra crossings and signs, the service station and the driving school (docs/world-economy.md §15)
exec((pathlib.Path(__file__).resolve().parent / "driving_world.py").read_text(encoding="utf-8"))
driving_village(V)

# ---- the town grows: the outskirts street, its building sites, the donut shop, the car service, the driving
# school; parking along the main street, crossings by the school (crates/teul-core/src/growth.rs)
exec((pathlib.Path(__file__).resolve().parent / "town_growth.py").read_text(encoding="utf-8"))

# ---- the quieter places: the small temple by the park, the old circle in the forest (faiths_world.py)
exec((pathlib.Path(__file__).resolve().parent / "faiths_world.py").read_text(encoding="utf-8"))
faith_village(V)
# ---- the tables where the town plays chess and dominoes (games_world.py)
exec((pathlib.Path(__file__).resolve().parent / "games_world.py").read_text(encoding="utf-8"))
games_village(V)

# the radio «Липове FM» out on the town's edge: the studio by a lane, its mast with red lights beside it
_studio = None
for _sy in range(V.h - 4, V.h - 40, -1):
    for _sx in range(V.w - 7, 24, -1):
        for _rot in (0, 2):
            if _studio is None:
                try:
                    _studio = (free_spot(V, "radio_station", _rot, [_sx], [_sy], path_to=("p", "c", "h", "t"), reach=4), _rot)
                except RuntimeError:
                    pass
assert _studio, "no room for the radio studio on the edge of the town"
door, fp = V.building_at("radio_station", *_studio[0], rot=_studio[1], path_to=("p", "c", "h", "t"))
V.site("radio_site", "Радіо «Липове FM»", "radio", door, building=fp, jobs=[("radio_host", 420, 1260, 30, []), ("technician", 480, 1080, 28, [0, 1, 2, 3, 4])])
_mast = next(((mx, my) for r in range(1, 9) for my in range(fp[1] - r, fp[1] + fp[3] + r) for mx in range(fp[0] - r, fp[0] + fp[2] + r) if V.fits("radio_mast", mx, my, grounds=GREEN)), None)
assert _mast, "no room for the radio mast by the studio"
V.prop("radio_mast", *_mast)
landmark("radio", "Радіо «Липове FM»", fp[0], fp[1], fp[2], fp[3])

# the cinema «Зоря» by the main street, on its east side (a marquee of lights over its doors)
_cin = None
for _cy in list(range(30, 50)) + list(range(2, 30)) + list(range(50, V.h - 6)):
    for _cx in range(50, V.w - 6):
        for _rot in (0, 2):
            if _cin is None:
                try:
                    _cin = (free_spot(V, "cinema_house", _rot, [_cx], [_cy], path_to=("p", "c"), reach=3), _rot)
                except RuntimeError:
                    pass
assert _cin, "no room for the cinema"
door, fp = V.building_at("cinema_house", *_cin[0], rot=_cin[1], path_to=("p", "c"))
V.site("cinema_site", "Кінотеатр «Зоря»", "cinema", door, building=fp)
landmark("cinema", "Кінотеатр «Зоря»", fp[0], fp[1], fp[2], fp[3])

# the village's streets lit at night, all of them
light_streets(V)

F = Map("forest", "Шепітливий ліс", 140, 96, "f", LEGEND)
rng = random.Random(23)
F.ellipse(18, 20, 11, 8, "s", only={"f"})
F.lake(18, 20, 9, 6.5)
F.line([(24, 26), (30, 36), (26, 48), (14, 67), (18, 78)], 2, "w")
# the deep forest, grown out to the east and the south: a rocky hill with a cave, a second lake in the pines,
# a bog with pools and reeds, a clearing of wildflowers with a hunters' tower
F.ellipse(112, 26, 15, 11, "h")
F.ellipse(118, 70, 9, 7, "s")
F.lake(118, 70, 7.5, 5.5)
F.ellipse(22, 84, 12, 8, "m")
for cx, cy, rx, ry in [(18, 82, 3, 2), (25, 86, 2.5, 1.6), (14, 87, 2, 1.4), (27, 80, 1.8, 1.2)]:
    F.lake(cx, cy, rx, ry)
F.ellipse(88, 80, 8, 6, "m")
F.line([(44, 95), (44, 67)], 2, "t")
F.line([(46, 32), (78, 30), (100, 29), (111, 28)], 2, "t", only={"f", "m", "g", "h"})
F.line([(46, 66), (70, 72), (88, 78), (108, 72)], 2, "t", only={"f", "m"})
F.line([(42, 74), (30, 80), (24, 84)], 2, "t", only={"f", "m"})
F.ellipse(44, 34, 7, 6, "m")
F.ellipse(70, 16, 6, 5, "g")
F.ellipse(68, 50, 9, 7, "t")
F.ellipse(60, 30, 6, 5, "m")
F.line([(44, 67), (44, 40)], 2, "t")
F.line([(44, 34), (32, 26), (27, 21)], 2, "t", only={"f", "m"})
F.line([(46, 32), (60, 22), (68, 16)], 2, "t", only={"f", "g", "m"})
F.line([(46, 40), (60, 46), (66, 50)], 2, "t", only={"f", "m"})
for y in range(96):
    for x in range(140):
        if F.grid[y][x] == "w" and any(F.at(x + dx, y + dy) == "t" for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))) and y > 26:
            F.grid[y][x] = "d"
F.exits.append({"x": 43, "y": 95, "w": 3, "h": 1, "to": "village", "at": [14, 3], "name": "До містечка"})
F.reserve(41, 91, 47, 95)
# the mountain «Велика Липа» with the cave inside it: its mouth opens at the foot of the south face, onto the
# path; a trail winds up to the top, where the whole forest can be seen
F.prop("mountain", 104, 14, grounds={"h", "f", "g", "m"})
F.prop("cave_mouth", 110, 24, grounds={"h", "f", "g"})
F.exits.append({"x": 111, "y": 26, "w": 1, "h": 1, "to": "cave", "at": [22, 29], "name": "До печери"})
F.reserve(110, 26, 112, 28)
for x, y in [(104, 20), (106, 18), (116, 19), (119, 23), (121, 28), (102, 30), (106, 32), (118, 33), (114, 17), (100, 24), (123, 25)]:
    F.prop("rock_big", x, y, must=False)
for x, y in [(108, 22), (114, 22), (103, 27), (120, 30), (110, 34), (117, 27)]:
    F.prop("rocks", x, y, must=False)
F.prop("forest_sign", 113, 28, must=False)
# the fire lookout on a clearing in the middle of the forest
F.ellipse(80, 52, 4, 3, "m")
F.prop("fire_lookout", 79, 51, grounds={"m", "f", "g"})
F.line([(80, 54), (78, 66), (70, 72)], 1, "t", only={"f", "m"})
F.prop("judges_tower", 90, 76, colors={"cab": "#8a5a2e", "leg": "#6a4528", "roof": "#3f7f4a", "glass": "#a8d8ea", "flag": "#d9534f"})
F.prop("boat", 112, 69, must=False)
F.prop("log_bench", 86, 82, must=False)
F.prop("picnic_table", 92, 82, must=False)
F.prop("tool_shed", 22, 72, must=False)

F.prop("campfire", 44, 34)
for x, y in [(41, 33), (46, 35), (42, 36)]:
    F.prop("log_bench", x, y)
F.prop("log_pile", 47, 31)
F.prop("tree_ancient", 69, 12)
F.prop("mushroom_ring", 74, 16)
F.prop("boat", 14, 18)
F.prop("fishing_spot", 26, 17, must=False)
F.prop("cottage_sage", 54, 38, colors={"wall": "#a8743c", "roof": "#3e2a1c"})
F.site("forest_hut", "Хатина лісника", "home", (56, 41), building=(54, 38, 4, 3))
F.connect((56, 41), to=("t", "h"))
homes.append("forest_hut")
for x, y in [(57, 28), (60, 27), (62, 31), (58, 32), (63, 29)]:
    F.prop("berry_bush", x, y, must=False)
# the sawmill stands in the clearing, its yard of logs and planks around it
F.ellipse(66, 43, 5, 3.5, "m", only={"t", "f"})
saw_door, saw_fp = F.building_at("sawmill", 63, 41, path_to=("t",), reach=6)
for i in range(6):
    F.prop("log_pile", (60, 63, 69)[i % 3], 50 + (i // 3) * 2, must=False)
F.prop("horse_cart", 70, 50, must=False)
F.site("sawmill", "Пилорама", "sawmill", saw_door, area=(60, 46, 12, 3), building=saw_fp,
       jobs=[("sawyer", 420, 1080, 32, [0, 1, 2, 3, 4, 5])])
F.prop("forest_sign", 48, 90)

F.place("forest_glade", "Галявина з вогнищем", 40, 30, 9, 8, "chat")
F.place("forest_lake", "Лісове озеро", 26, 19, 2, 4, "fish")
F.place("old_oak", "Древній дуб", 66, 16, 7, 3, "walk")
F.place("berry_patch", "Ягідник", 56, 29, 8, 2, "gather")
F.place("rock_hill", "Біля гори", 104, 28, 12, 3, "walk")
F.place("east_lake", "Озеро в бору", 108, 76, 6, 1, "fish")
F.place("flower_clearing", "Квіткова галявина", 84, 77, 8, 6, "walk")
F.site("forest_glade_site", "Галявина", "forest", (44, 37), area=(40, 30, 9, 8), jobs=[("forester", 420, 1080, 28, [])])
F.site("logging", "Вирубка", "forest", (66, 50), area=(61, 46, 12, 8))

faith_forest(F)
style_forest(F)
F.scatter(rng, ["tree_pine", "tree_pine", "tree_pine", "tree_oak", "tree_birch", "tree_maple", "tree_pine", "bush_round", "tree_willow"], 1250, {"f"})
F.scatter(rng, ["tree_birch", "tree_birch", "bush_flowering"], 140, {"f"})
F.scatter(rng, ["mushrooms", "rocks", "reeds", "berry_bush", "rock_big", "mushrooms", "hedge_block"], 280, {"f", "m", "g"})
F.scatter(rng, ["reeds", "reeds", "rocks"], 40, {"m"})

# =============================================================================================================
# The dump: where the village's rubbish goes, behind a fence of boards, out along the east road
# =============================================================================================================
D = Map("dump", "Звалище", 28, 22, "r", LEGEND)
rng = random.Random(31)
D.ellipse(14, 11, 14, 11, "t")
D.line([(0, 10), (12, 10)], 2, "c")
D.exits.append({"x": 0, "y": 10, "w": 1, "h": 2, "to": "village", "at": [69, 26], "name": "До містечка"})
D.reserve(0, 9, 3, 12)
for x in range(4, 26, 1):
    D.prop("board_fence", x, 1, must=False)
    D.prop("board_fence", x, 20, must=False)
for (x, y) in [(6, 4), (12, 3), (18, 5), (22, 9), (16, 14), (9, 15), (21, 15)]:
    D.prop("trash_heap", x, y, must=False)
for (x, y) in [(5, 13), (14, 8), (24, 4)]:
    D.prop("skip", x, y, must=False)
D.scatter(rng, ["tyres", "rocks", "tyres", "skip"], 14, {"t", "r"})
D.prop("garbage_truck", 4, 7, must=False)
# the dump fills over the days: more heaps and bags as it fills, and at the end rubbish over the fence and along
# the road, until the big clean-up (see life::dump_fill)
for fill, spots in [
    (15, [("trash_bags", 9, 9), ("trash_heap", 19, 11)]),
    (30, [("trash_heap", 12, 13), ("trash_bags", 23, 13), ("tyres", 8, 5)]),
    (45, [("trash_heap", 15, 5), ("skip", 20, 17), ("trash_bags", 6, 16)]),
    (60, [("trash_heap", 9, 4), ("trash_heap", 23, 6), ("litter", 13, 10), ("trash_bags", 17, 9)]),
    (75, [("trash_heap", 5, 18), ("trash_heap", 18, 17), ("litter", 21, 13), ("trash_bags", 11, 17), ("tyres", 25, 11)]),
    (90, [("trash_heap", 14, 16), ("litter", 7, 13), ("trash_bags", 16, 12), ("litter", 24, 16)]),
    (100, [("litter", x, 0) for x in (6, 9, 13, 17, 21, 24)] + [("litter", x, 21) for x in (5, 10, 15, 20, 25)]
          + [("trash_bags", 7, 21), ("trash_bags", 19, 0), ("litter", 5, 8), ("litter", 9, 12), ("trash_bags", 11, 8)]),
]:
    for what, x, y in spots:
        D.prop(what, x, y, must=False, min_fill=fill)
D.site("dump_site", "Звалище", "dump", (6, 11), area=(4, 6, 18, 10), jobs=[("collector", 360, 900, 28, [0, 1, 2, 3, 4, 5])])

# =============================================================================================================
# The wheat field west of the village: a big field of wheat with dirt tracks across it, wind turbines making the
# village's electricity, and all round it a belt of trees (лісосмуга) that keeps the wind off the field
# =============================================================================================================
P = Map("fields", "Пшеничне поле", 64, 48, "g", LEGEND)
rng = random.Random(41)
P.paint(4, 4, 59, 43, "m")
P.paint(6, 6, 57, 41, "o")
# the tracks: one from the village road in the east across the field, one north to south
P.paint(6, 22, 63, 23, "t")
P.paint(31, 6, 32, 41, "t")
P.exits.append({"x": 63, "y": 22, "w": 1, "h": 2, "to": "village", "at": [1, 26], "name": "До містечка"})
P.paint(31, 41, 32, 47, "t")
P.exits.append({"x": 31, "y": 47, "w": 2, "h": 1, "to": "hippodrome", "at": [29, 2], "name": "До іподрому"})
P.reserve(30, 42, 33, 47)
P.reserve(60, 21, 63, 24)
# the turbines on gravel pads beside the tracks
TURBINES = [(11, 17), (21, 17), (40, 17), (50, 17), (16, 26), (45, 26)]
for tx, ty in TURBINES:
    P.paint(tx - 1, ty - 1, tx + 2, ty + 2, "r")
    if ty < 22:
        P.paint(tx, ty + 3, tx + 1, 21, "r")
    else:
        P.paint(tx, 24, tx + 1, ty - 2, "r")
    P.prop("wind_turbine", tx, ty)
P.paint(54, 18, 57, 20, "r")
# the field's workers along the track (the harvest itself follows the season)
P.site("fields_site", "Пшеничне поле", "fields", (33, 22), area=(34, 22, 24, 2), jobs=[("harvester", 360, 1140, 26, [0, 1, 2, 3, 4, 5])])
P.prop("field_transformer", 55, 19)
# the line: each turbine's cable to a pole by the track, the poles along the track to the field's transformer,
# and from there out to the village
main = power_line(P, [(13, 21), (23, 21), (33, 21), (42, 21), (52, 21)])
for tx, ty in TURBINES:
    box = (tx + 1.35, ty + 1.55, 60)
    if ty < 22:
        target = min(main, key=lambda c: abs(c[0] - tx))
        wire(P, box, (target[0] + 0.5, target[1] + 0.5, POLE_TOP - 30))
    else:
        c = pole_near(P, tx + 3, 24)
        if c:
            wire(P, box, (c[0] + 0.5, c[1] + 0.5, POLE_TOP - 30))
            target = min(main, key=lambda q: abs(q[0] - c[0]))
            span(P, c, target)
wire(P, (main[-1][0] + 0.5, main[-1][1] + 0.5, POLE_TOP), (55.6, 19.5, 128))
out = power_line(P, [(58, 20), (62, 21)], start=(56.6, 19.5, 128))
if out:
    for k in (-0.3, 0.3):
        wire(P, (out[-1][0] + 0.5, out[-1][1] + 0.5 + k, POLE_TOP), (64, 21.5 + k, POLE_TOP))
style_fields(P)
# wheat on every free patch of soil
for y in range(6, 42, 2):
    for x in range(6, 58, 2):
        if all(P.at(x + dx, y + dy) == "o" and (x + dx, y + dy) not in P.taken for dx in (0, 1) for dy in (0, 1)):
            P.prop("wheat_a" if (x * 7 + y * 3) % 5 < 3 else "wheat_b", x, y)
# the shelter belt: rows of trees all round, thickest in the west where the wind comes from; a gap for the road
for y in range(48):
    for x in range(64):
        edge = min(x, y, 63 - x, 47 - y)
        if edge > 3 or (x >= 58 and 20 <= y <= 25) or (29 <= x <= 34 and y >= 40):
            continue
        thick = 4 if x < 4 else 3
        if edge >= thick or (x, y) in P.taken:
            continue
        r = rng.random()
        if r < 0.12:
            P.prop("tree_oak", x, y, must=False)
        elif r < 0.55:
            P.prop(rng.choice(["tree_birch", "tree_birch", "tree_pine", "tree_apple"]), x, y, must=False)
        elif r < 0.7:
            P.prop(rng.choice(["bush_round", "berry_bush", "hedge_block"]), x, y, must=False)
P.prop("forest_sign", 60, 25, must=False)
P.prop("notice_board", 58, 25, must=False)

exec((pathlib.Path(__file__).resolve().parent / "world_more.py").read_text(encoding="utf-8"))

exec((pathlib.Path(__file__).resolve().parent / "town_village.py").read_text(encoding="utf-8"))
locations = [V.build(), F.build(), D.build(), P.build(), FARM.build(), H.build(), CAVE.build(), VY.build(), CEM.build()]
for loc in locations:
    if loc["id"] == "cave":
        loc["underground"] = True
        loc["wall"] = "wall.rock"

# where the fishing is (used by the daily content)
PIER = (51, 48, 6, 1)

# the animals of the village and the forest: herds and flocks in their places, about at their hours
DAY = ["morning", "day", "evening"]
for loc in locations:
    if loc["id"] == "village":
        loc["animals"] = [
            {"kind": "duck", "x": 56, "y": 44, "w": 12, "h": 9, "count": 6, "swims": True},
            {"kind": "swan", "x": 58, "y": 46, "w": 8, "h": 5, "count": 2, "swims": True},
            {"kind": "chicken", "x": 61, "y": 19, "w": 9, "h": 3, "count": 6, "when": DAY},

            {"kind": "dog_street", "x": 2, "y": 25, "w": 50, "h": 4, "count": 2, "speed": 2},
            {"kind": "bird", "x": 37, "y": 15, "w": 13, "h": 6, "count": 5, "when": DAY},
            {"kind": "butterfly", "x": 39, "y": 44, "w": 12, "h": 7, "count": 5, "when": ["day"]},
            {"kind": "butterfly", "x": 3, "y": 29, "w": 9, "h": 6, "count": 3, "when": ["day"]},
            {"kind": "squirrel", "x": 15, "y": 42, "w": 14, "h": 5, "count": 2, "when": DAY},
        ]
    elif loc["id"] == "farm":
        loc["animals"] = [
            {"kind": "cow", "x": 51, "y": 13, "w": 11, "h": 17, "count": 5, "when": DAY},
            {"kind": "pig", "x": 25, "y": 33, "w": 8, "h": 6, "count": 4},
            {"kind": "sheep", "x": 37, "y": 33, "w": 10, "h": 9, "count": 5, "when": DAY},
            {"kind": "goat", "x": 37, "y": 33, "w": 10, "h": 9, "count": 2, "when": DAY},
            {"kind": "chicken", "x": 14, "y": 14, "w": 6, "h": 6, "count": 7, "when": DAY},
            {"kind": "horse", "x": 5, "y": 29, "w": 11, "h": 11, "count": 3, "when": DAY},
            {"kind": "goose", "x": 51, "y": 38, "w": 8, "h": 5, "count": 5, "swims": True},
            {"kind": "dog_street", "x": 22, "y": 14, "w": 20, "h": 16, "count": 1},
            {"kind": "bird", "x": 44, "y": 1, "w": 16, "h": 9, "count": 4, "when": DAY},
        ]
    elif loc["id"] == "hippodrome":
        loc["animals"] = [
            {"kind": "horse", "x": 2, "y": 7, "w": 7, "h": 5, "count": 5, "when": DAY},
            {"kind": "horse", "x": 51, "y": 7, "w": 7, "h": 5, "count": 4, "when": DAY},
            # horses out to graze on the infield between the races
            {"kind": "horse", "x": 21, "y": 17, "w": 18, "h": 8, "count": 4, "when": DAY},
            {"kind": "bird", "x": 20, "y": 14, "w": 20, "h": 12, "count": 4, "when": DAY},
        ]
    elif loc["id"] == "cave":
        loc["animals"] = [{"kind": "bat", "x": 4, "y": 4, "w": 36, "h": 10, "count": 5}]
    elif loc["id"] == "cemetery":
        loc["animals"] = [{"kind": "bird", "x": 2, "y": 2, "w": 32, "h": 24, "count": 4, "when": DAY}, {"kind": "squirrel", "x": 2, "y": 2, "w": 32, "h": 24, "count": 1, "when": DAY}]
    elif loc["id"] == "vineyard":
        loc["animals"] = [
            {"kind": "bird", "x": 3, "y": 3, "w": 50, "h": 30, "count": 7, "when": DAY},
            {"kind": "butterfly", "x": 36, "y": 33, "w": 16, "h": 6, "count": 3, "when": ["day"]},
            {"kind": "hedgehog", "x": 2, "y": 2, "w": 50, "h": 36, "count": 1, "when": ["evening", "night"]},
        ]
    elif loc["id"] == "fields":
        loc["animals"] = [
            {"kind": "bird", "x": 6, "y": 6, "w": 50, "h": 34, "count": 8, "when": DAY},
            {"kind": "rabbit", "x": 4, "y": 4, "w": 56, "h": 3, "count": 3},
            {"kind": "deer", "x": 4, "y": 40, "w": 50, "h": 3, "count": 2, "when": ["morning", "evening"]},
            {"kind": "fox", "x": 4, "y": 4, "w": 3, "h": 38, "count": 1, "when": ["evening", "night"]},
            {"kind": "butterfly", "x": 4, "y": 4, "w": 56, "h": 2, "count": 4, "when": ["day"]},
        ]
    elif loc["id"] == "dump":
        loc["animals"] = [
            {"kind": "bird", "x": 4, "y": 3, "w": 20, "h": 16, "count": 6, "when": DAY},
            {"kind": "dog_street", "x": 4, "y": 4, "w": 20, "h": 14, "count": 2},
        ]
    else:
        loc["animals"] = [
            {"kind": "deer", "x": 55, "y": 8, "w": 25, "h": 18, "count": 3, "when": ["morning", "evening", "night"]},
            {"kind": "deer", "x": 85, "y": 40, "w": 45, "h": 25, "count": 4, "when": ["morning", "evening", "night"]},
            {"kind": "boar", "x": 60, "y": 60, "w": 60, "h": 25, "count": 3},
            {"kind": "hedgehog", "x": 30, "y": 60, "w": 50, "h": 30, "count": 3, "when": ["evening", "night"]},
            {"kind": "duck", "x": 111, "y": 66, "w": 14, "h": 9, "count": 4, "swims": True},
            {"kind": "squirrel", "x": 80, "y": 50, "w": 50, "h": 30, "count": 4, "when": DAY},
            {"kind": "rabbit", "x": 36, "y": 26, "w": 18, "h": 16, "count": 4},
            {"kind": "squirrel", "x": 30, "y": 2, "w": 50, "h": 20, "count": 5, "when": DAY},
            {"kind": "fox", "x": 5, "y": 40, "w": 30, "h": 20, "count": 1, "when": ["evening", "night", "morning"]},
            {"kind": "bird", "x": 40, "y": 28, "w": 12, "h": 12, "count": 4, "when": DAY},
            {"kind": "duck", "x": 11, "y": 15, "w": 14, "h": 10, "count": 4, "swims": True},
            {"kind": "butterfly", "x": 56, "y": 26, "w": 10, "h": 8, "count": 4, "when": ["day"]},
        ]
