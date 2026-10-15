# The village as it may become: houses for the families who will move in, and the things the town builds and
# opens over time. Each of these props carries a flag of the town (crates/teul-core/src/town.rs: town_flags):
# shown only while it holds (a stage of a project, the project done, a stall open in its months). Run inside
# world_maps.py just before the maps are built (it uses V, FARM, home, GREEN).

TOWN_SPOTS = {}


def ghost(m, item, x, y, flag=None, unflag=None, rot=0, colors=None):
    """A prop that shares cells with another one shown at another time (a scaffold where the bandstand will stand):
    placed without taking the cells."""
    p = {"item": item, "x": x, "y": y}
    if rot:
        p["rot"] = rot
    if colors:
        p["colors"] = colors
    if flag:
        p["flag"] = flag
    if unflag:
        p["unflag"] = unflag
    m.props.append(p)
    return p


def flagged(m, item, x, y, flag, rot=0, grounds=None, must=False, colors=None):
    """A prop that takes its cells, shown only under its flag."""
    n = len(m.props)
    if not m.prop(item, x, y, rot=rot, grounds=grounds, must=must, colors=colors):
        return False
    m.props[n]["flag"] = flag
    return True


def find_spot(m, item, area, grounds, rot=0, near=None):
    """The free spot for an item in an area (x0, y0, x1, y1), the one nearest `near` if given."""
    x0, y0, x1, y1 = area
    best = None
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if m.fits(item, x, y, rot, grounds):
                d = 0 if near is None else abs(x - near[0]) + abs(y - near[1])
                if best is None or d < best[0]:
                    best = (d, x, y)
    return None if best is None else (best[1], best[2])


# ---- houses for newcomers: two cottages on the green south-east of the park
NEW_HOMES = []
for house, name, colors in (("cottage_blue", "Дім на Новій, 1", {"roof": "#7a4a2e"}), ("cottage_cream", "Дім на Новій, 2", {"wall": "#e8d8c0"})):
    spot = None
    for area in ((38, 55, 68, 60), (60, 29, 70, 38), (2, 66, 70, 69)):
        spot = find_spot(V, house, area, {"g", "m"})
        if spot:
            break
    assert spot, f"no room for {house}"
    door, fp = V.building_at(house, spot[0], spot[1], colors=colors)
    hid = f"home_new{len(NEW_HOMES) + 1}"
    V.site(hid, name, "home", door, building=fp)
    NEW_HOMES.append((hid, door, fp))

# ---- the bandstand on the square: a site fence, then scaffolding, then the bandstand itself
sq = next(s for s in V.sites if s["id"] == "square_site")
# in the park by the lake (the square stays open from the main street to the fountain and the town hall)
park0 = next(s_ for s_ in V.sites if s_["id"] == "park_site")
spot = find_spot(V, "bandstand", (34, 40, 54, 56), {"p", "g", "m"}, near=(park0["x"] + 2, park0["y"] - 1))
assert spot, "no room for the bandstand in the park"
bx, by = spot
flagged(V, "bandstand", bx, by, "project:proj.bandstand:done", grounds={"p", "g", "m"}, must=True)
for dx in range(3):
    for dy in range(3):
        if (dx, dy) != (1, 1):
            ghost(V, "work_fence", bx + dx, by + dy, flag="project:proj.bandstand:stage1")
ghost(V, "brick_pallet", bx + 1, by + 1, flag="project:proj.bandstand:stage1")
for (dx, dy) in ((0, 0), (2, 0), (0, 2), (2, 2)):
    ghost(V, "scaffold", bx + dx, by + dy, flag="project:proj.bandstand:stage2")
TOWN_SPOTS["bandstand"] = (bx, by)

# ---- the library's roof: scaffolding by its walls while it is mended; the roof in fresh tiles once it is done
lib = next(s for s in V.sites if s["id"] == "library_site")
lx, ly, lw, lh = lib["building"]
old = next(p for p in V.props if p["x"] == lx and p["y"] == ly and ITEM[p["item"]]["footprint"]["w"] * ITEM[p["item"]]["footprint"]["d"] >= 6)
old["unflag"] = "project:proj.library_roof:done"
new = dict(old)
new.pop("unflag")
new["flag"] = "project:proj.library_roof:done"
new["colors"] = {**old.get("colors", {}), "roof": "#b84a32"}
V.props.append(new)
placed = 0
for x in range(lx - 1, lx + lw + 1):
    for y in (ly - 1,):
        if placed < 4 and V.at(x, y) in GREEN | {"h", "p"} and flagged(V, "scaffold", x, y, "project:proj.library_roof:building"):
            placed += 1
for y in range(ly, ly + lh):
    for x in (lx - 1, lx + lw):
        if placed < 6 and V.at(x, y) in GREEN and flagged(V, "scaffold", x, y, "project:proj.library_roof:building"):
            placed += 1

# ---- a playground by the new houses
hx, hy = NEW_HOMES[0][2][0], NEW_HOMES[0][2][1]
pg = find_spot(V, "sandbox", (hx - 10, hy - 6, hx + 14, hy + 8), GREEN, near=(hx + 6, hy))
assert pg, "no room for the playground"
px, py = pg
for toy, dx, dy in (("sandbox", 0, 0), ("swing", 3, 0), ("slide", 3, 1), ("seesaw", 0, 3), ("bench", 3, 3)):
    if not flagged(V, toy, px + dx, py + dy, "project:proj.playground:done", grounds=GREEN):
        s = find_spot(V, toy, (px - 4, py - 4, px + 8, py + 8), GREEN, near=(px + dx, py + dy))
        if s:
            flagged(V, toy, s[0], s[1], "project:proj.playground:done", grounds=GREEN)
for (dx, dy) in ((0, 0), (1, 0), (3, 0), (4, 0)):
    ghost(V, "work_fence", px + dx, py + dy, flag="project:proj.playground:stage1")
ghost(V, "brick_pallet", px + 2, py + 1, flag="project:proj.playground:stage1")
TOWN_SPOTS["playground"] = (px, py)

# ---- the riverside walk: benches, flower beds and lamps along the stream's west bank
placed = 0
for y in range(14, 25):
    for x in range(50, 58):
        if V.at(x, y) in GREEN and V.at(x + 1, y) == "w":
            thing = ("bench" if placed % 3 == 0 else "flower_bed" if placed % 3 == 1 else "lamp_street")
            rot = 1 if thing == "bench" else 0
            if flagged(V, thing, x - (1 if thing == "bench" else 0), y, "project:proj.riverside:done", rot=rot, grounds=GREEN):
                placed += 1
            elif thing != "lamp_street" and flagged(V, "lamp_street", x, y, "project:proj.riverside:done", grounds=GREEN):
                placed += 1
            break
assert placed >= 3, f"the riverside walk found room for only {placed}"

# ---- lamps along the farm's lane
lamps = 0
last = None
for y in range(FARM.h):
    for x in range(FARM.w):
        if FARM.at(x, y) in ("t", "r", "c") and lamps < 9:
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if FARM.at(nx, ny) in GREEN and (last is None or abs(nx - last[0]) + abs(ny - last[1]) >= 7):
                    if flagged(FARM, "lamp_street", nx, ny, "project:proj.farm_lights:done", grounds=GREEN):
                        lamps += 1
                        last = (nx, ny)
                        break
assert lamps >= 4, f"the farm lane got only {lamps} lamps"

# ---- stalls that open by the season or after a project
park = next(s for s in V.sites if s["id"] == "park_site")
for stall, flag, area, near in (
    ("ice_cream_kiosk", "open:open.icecream", (36, 42, 52, 54), (park["x"], park["y"])),
    ("coffee_cart", "open:open.coffee_cart", (34, 28, 52, 36), (36, 31)),
    ("flower_cart", "open:open.flower_cart", (34, 28, 52, 36), (49, 33)),
    ("book_stall", "open:open.book_stall", (lx - 4, ly + lh, lx + lw + 4, ly + lh + 3), (lib["x"] + 2, lib["y"])),
):
    s = find_spot(V, stall, area, {"p", "g", "m", "h"}, near=near)
    assert s, f"no room for {stall}"
    flagged(V, stall, s[0], s[1], flag, grounds={"p", "g", "m", "h"}, must=True)
    TOWN_SPOTS[stall] = s
