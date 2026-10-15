# The farm east of the village, the racecourse south of the wheat field, the cave in the forest's rocky hill,
# and the taxi that goes between them. Run inside world_maps.py (uses Map, LEGEND, V, F, P).


def fence_rect(m, x0, y0, x1, y1, gates=()):
    """A wooden fence round a pen, leaving gaps at the gate cells."""
    for x in range(x0, x1 + 1):
        for y in (y0, y1):
            if (x, y) not in gates:
                m.prop("farm_fence", x, y, must=False)
    for y in range(y0 + 1, y1):
        for x in (x0, x1):
            if (x, y) not in gates:
                m.prop("farm_fence", x, y, rot=1, must=False)


# =============================================================================================================
# The farm «Липовий гай»: the farmhouse, a barn and silos round a gravel yard, a cowshed and its pasture, pens for
# pigs, sheep and goats, a chicken run, a horse paddock, vegetable beds, an orchard with hives, a pond with geese
# =============================================================================================================
FARM = Map("farm", "Ферма «Липовий гай»", 64, 48, "g", LEGEND)
rng = random.Random(53)
FARM.paint(0, 22, 24, 23, "t")
FARM.paint(22, 14, 42, 30, "r")
FARM.exits.append({"x": 0, "y": 22, "w": 1, "h": 2, "to": "village", "at": [70, 12], "name": "До містечка"})
FARM.reserve(0, 21, 3, 24)
door, fp = FARM.building_at("cottage_honey", 26, 9, colors={"wall": "#e8d4b8", "roof": "#8a5a2e"}, path_to=("r",))
FARM.site("farmhouse", "Хата фермера", "home", door, building=fp)
homes.append("farmhouse")
door, fp = FARM.building_at("barn", 33, 9, path_to=("r",))
FARM.site("farm", "Ферма «Липовий гай»", "farm", door, area=(23, 15, 18, 14), building=fp, jobs=[("farmer", 300, 1140, 26, [])])
FARM.prop("silo", 39, 8)
FARM.prop("silo", 42, 8)
FARM.prop("tractor", 25, 16)
FARM.prop("haystack", 36, 16)
for x, y in [(39, 14), (40, 15), (39, 16), (23, 27), (24, 28)]:
    FARM.prop("hay_bale", x, y, must=False)
FARM.prop("well", 30, 26)
FARM.prop("wheelbarrow", 28, 19, must=False)
FARM.prop("doghouse", 24, 12, must=False)
FARM.prop("rain_barrel", 31, 12, must=False)
FARM.prop("log_pile", 22, 30, must=False)
# the little wool-and-cheese factory «Овечка» by the yard: wool from the sheep, milk from the cows; its shop
door, fp = FARM.building_at("creamery", 43, 11, rot=1, path_to=("r",))
FARM.site("creamery_site", "Міні-фабрика «Овечка»", "factory", door, building=fp, jobs=[("weaver", 480, 1080, 28, [0, 1, 2, 3, 4]), ("cheesemaker", 420, 1020, 30, [0, 1, 2, 3, 4, 5])])
# a lamp by every door of the farm, for the dark mornings of milking
for _s in list(FARM.sites):
    for _x, _y in ((_s["x"] - 2, _s["y"] + 1), (_s["x"] + 2, _s["y"] + 1)):
        if FARM.prop("lamp_street", _x, _y, must=False):
            break
FARM.prop("milk_can", 42, 17, must=False)
FARM.prop("milk_can", 41, 18, must=False)
FARM.prop("wool_bale", 42, 10, must=False)
# the cowshed and its pasture
FARM.building_at("cowshed", 43, 18, path_to=("r",))
fence_rect(FARM, 50, 12, 62, 30, gates={(50, 20), (50, 21)})
FARM.prop("trough", 55, 14)
FARM.prop("trough", 58, 27)
# the chicken run
FARM.prop("chicken_coop", 15, 15)
fence_rect(FARM, 13, 13, 20, 20, gates={(20, 17)})
# pigs, then sheep and goats, south of the yard
fence_rect(FARM, 24, 32, 33, 39, gates={(28, 32)})
FARM.prop("trough", 26, 37)
fence_rect(FARM, 36, 32, 47, 42, gates={(40, 32)})
FARM.prop("trough", 42, 40)
FARM.prop("hay_bale", 45, 34)
# the horse paddock by the road
fence_rect(FARM, 4, 28, 16, 40, gates={(10, 28)})
FARM.prop("trough", 6, 38)
# vegetable beds and corn in the north-west, a scarecrow; the orchard with hives in the north-east
FARM.paint(3, 2, 20, 10, "o")
for i, bed in enumerate(["bed_tomatoes", "bed_carrots", "bed_cabbage", "bed_potatoes", "bed_peppers", "bed_cucumbers", "corn_row", "corn_row", "pumpkin_patch"]):
    FARM.prop(bed, 4 + (i % 3) * 5, 3 + (i // 3) * 3, must=False)
FARM.prop("scarecrow", 18, 6)
FARM.prop("greenhouse", 18, 8, must=False)
for i in range(10):
    FARM.prop("tree_apple", 46 + (i % 5) * 3, 2 + (i // 5) * 4, must=False)
for x in (47, 52, 57):
    FARM.prop("beehive", x, 4, must=False)
# the pond with geese
FARM.lake(55, 40, 5, 3.5)
FARM.ellipse(55, 40, 6.5, 5, "s", only={"g"})
FARM.prop("reeds", 49, 39, must=False)
FARM.scatter(rng, ["bush_round", "tree_birch", "tree_oak", "bush_flowering", "sunflowers"], 40, {"g"})
# the lane south between the pens, to the vineyard
FARM.paint(34, 30, 35, 47, "t")
FARM.exits.append({"x": 34, "y": 47, "w": 2, "h": 1, "to": "vineyard", "at": [27, 2], "name": "До виноградника"})
FARM.reserve(33, 43, 36, 47)
FARM.place("farm_yard", "Двір ферми", 27, 21, 8, 4, "walk")
FARM.place("pasture", "Пасовище", 51, 13, 11, 17, "walk")

# =============================================================================================================
# The vineyard «Лоза» south of the farm: rows of vines on trellises down the slope, the winery with its barrels,
# a terrace to taste the wine on
# =============================================================================================================
VY = Map("vineyard", "Виноградник «Лоза»", 56, 44, "g", LEGEND)
rng = random.Random(83)
VY.paint(27, 0, 28, 41, "t")
VY.paint(2, 40, 54, 41, "t")
VY.exits.append({"x": 27, "y": 0, "w": 2, "h": 1, "to": "farm", "at": [34, 45], "name": "До ферми"})
VY.reserve(26, 0, 29, 3)
for y in range(4, 32, 2):
    for x in list(range(3, 26)) + list(range(30, 53)):
        VY.prop("grapevine", x, y)
door, fp = VY.building_at("winery", 31, 34, path_to=("t",))
VY.site("winery_site", "Виноробня «Лоза»", "winery", door, area=(38, 34, 14, 5), building=fp, jobs=[("winemaker", 480, 1080, 32, [0, 1, 2, 3, 4, 5]), ("vintner", 360, 1020, 28, [])])
for _x, _y in ((s_x, s_y) for s_x, s_y in [(VY.sites[-1]["x"] - 2, VY.sites[-1]["y"] + 1), (VY.sites[-1]["x"] + 2, VY.sites[-1]["y"] + 1)]):
    VY.prop("lamp_street", _x, _y, must=False)
for x in (24, 25):
    for y in (35, 36):
        VY.prop("wine_barrel", x, y, must=False)
VY.prop("wine_press", 22, 35, must=False)
VY.prop("haystack" if False else "wheelbarrow", 21, 37, must=False)
for x, y in [(40, 35), (44, 35), (48, 35)]:
    VY.prop("parasol_table", x, y, must=False)
    VY.prop("chair", x - 1, y, rot=3, must=False)
    VY.prop("chair", x + 1, y, rot=1, must=False)
VY.prop("string_lights" if ITEM["string_lights"]["layer"] == "floor" else "lamp_street", 46, 37, must=False)
for x in (38, 50):
    VY.prop("lamp_street", x, 38, must=False)
VY.scatter(rng, ["tree_maple", "tree_oak", "bush_flowering", "tree_birch"], 25, {"g"})
VY.place("terrace", "Тераса дегустацій", 39, 36, 11, 2, "chat")

# =============================================================================================================
# The cemetery behind the church: a wrought fence, a gate from the village, a chapel, rows of graves under
# birches and willows. Graves are added as the world grows older (min_day): the cemetery fills over the years.
# =============================================================================================================
CEM = Map("cemetery", "Кладовище", 36, 28, "g", LEGEND)
rng = random.Random(97)
# the main walk from the gate east to the far fence, the cross walk up to the chapel's door and down to a
# quiet end by the willows; a short path round the chapel
CEM.paint(1, 13, 32, 14, "h")
CEM.paint(17, 4, 18, 24, "h")
CEM.paint(15, 4, 20, 4, "h")
CEM.exits.append({"x": 0, "y": 13, "w": 1, "h": 2, "to": "village", "at": [70, 34], "name": "До церкви"})
CEM.reserve(0, 12, 3, 15)
CEM.prop("chapel", 17, 2)
for x in range(2, 34):
    for y in (1, 26):
        CEM.prop("iron_fence", x, y, must=False)
for y in range(2, 26):
    for x in (1, 34):
        if not (x == 1 and y in (13, 14)):
            CEM.prop("iron_fence", x, y, rot=1, must=False)
CEM.prop("bench", 14, 5, must=False)
CEM.prop("bench", 20, 11, must=False)
CEM.prop("bench", 16, 24, rot=2, must=False)
for x, y in [(3, 3), (9, 2), (31, 4), (3, 22), (31, 23), (12, 24), (25, 24), (31, 10)]:
    CEM.prop(rng.choice(["tree_birch", "tree_willow", "tree_birch"]), x, y, must=False)
# the graves: the old ones first (there from the start), then a new one every few days of the world's life
slots_ = [(x, y) for y in (4, 6, 8, 10, 16, 18, 20, 22) for x in list(range(4, 16, 2)) + list(range(21, 33, 2))]
rng.shuffle(slots_)
slots_.sort(key=lambda c: (abs(c[0] - 17.5) + abs(c[1] - 13.5)))
for i, (x, y) in enumerate(slots_):
    if (x, y) in CEM.taken:
        continue
    if i < 26:
        CEM.prop(rng.choice(["grave_old", "grave_old", "grave_cross", "grave_stone"]), x, y, must=False)
    else:
        CEM.prop(rng.choice(["grave_cross", "grave_stone", "grave_stone"]), x, y, must=False, min_day=(i - 25) * 6)
# a caretaker keeps the paths and the graves; people come to visit their own
CEM.site("cemetery_site", "Кладовище", "cemetery", (2, 13), area=(4, 3, 28, 22), jobs=[("caretaker", 480, 1020, 26, [0, 1, 2, 3, 4, 5])])
CEM.place("cemetery", "Кладовище", 4, 12, 28, 4, "walk")
# two lamps at the gate and one by the chapel: a quiet light at night
for x, y in [(0, 11), (0, 16), (20, 11)]:
    CEM.prop("lamp_street", x, y, must=False)

# =============================================================================================================
# The racecourse: an oval track with white rails, the grandstand, the judges' tower and the finishing post,
# stables and a paddock; races run through the day (see the app's races)
# =============================================================================================================
H = Map("hippodrome", "Іподром «Буревій»", 60, 44, "g", LEGEND)
rng = random.Random(61)
TRACK = (30, 21, 25, 16, 19, 10.5)  # centre, outer radii, inner radii
cx, cy, ox, oy, ix, iy = TRACK


def ring(x, y):
    u = ((x + 0.5 - cx) / ox) ** 2 + ((y + 0.5 - cy) / oy) ** 2
    v = ((x + 0.5 - cx) / ix) ** 2 + ((y + 0.5 - cy) / iy) ** 2
    return u <= 1 and v > 1


for y in range(H.h):
    for x in range(H.w):
        if ring(x, y):
            H.grid[y][x] = "t"
# the entrance from the field, a walk down to the stands
H.paint(29, 0, 30, 4, "c")
H.exits.append({"x": 29, "y": 0, "w": 2, "h": 1, "to": "fields", "at": [31, 45], "name": "До поля"})
H.reserve(28, 0, 31, 3)
H.paint(22, 42, 39, 43, "p")
# the rails along both edges of the track, with gaps where people cross
crossings = {(29, y) for y in range(H.h)} | {(30, y) for y in range(H.h)}
for y in range(H.h):
    for x in range(H.w):
        if H.grid[y][x] == "t" or (x, y) in crossings:
            continue
        ns = H.at(x, y - 1) == "t" or H.at(x, y + 1) == "t"
        we = H.at(x - 1, y) == "t" or H.at(x + 1, y) == "t"
        if ns or we:
            H.prop("rail_fence", x, y, rot=0 if ns else 1, must=False)
H.prop("grandstand", 27, 39)
H.prop("judges_tower", 33, 33)
H.prop("finish_post", 31, 31, must=False)
H.prop("ticket_booth", 32, 2)
# the stable yard: a row of stables along the north side, each with its paddock, hay and water
H.building_at("stable", 2, 1, path_to=("c", "t", "p"))
_walls = ["#8a5a2e", None, "#a8743c"]
_put = 0
for _sx in list(range(9, 26)) + list(range(33, 50)):
    if _put < 3 and H.fits("stable", _sx, 1, grounds={"g", "m", "f"}) and H.fits("stable", _sx, 0, grounds={"g", "m", "f", "c", "p", "t", "h"}) is not None:
        _c = _walls[_put]
        H.building_at("stable", _sx, 1, path_to=("c", "t", "p", "h"), colors={"wall": _c} if _c else None)
        _put += 1
fence_rect(H, 1, 6, 9, 12, gates={(5, 6)})
H.prop("trough", 3, 10)
fence_rect(H, 50, 6, 58, 12, gates={(54, 6)})
H.prop("trough", 56, 10, must=False)
H.prop("hay_bale", 52, 11, must=False)
for x, y in [(25, 3), (26, 3), (45, 3)]:
    H.prop("hay_bale", x, y, must=False)
H.prop("horse_cart", 9, 5, must=False)
H.prop("trough", 16, 5, must=False)
# lamps along the spectators' square and by the stables, for the evening races
for x in (22, 28, 34, 40):
    H.prop("lamp_street", x, 41, must=False)
H.prop("lamp_street", 7, 3, must=False)
# grooms and jockeys work the horses; on days off the town comes to watch from the stand
H.site("hippodrome_site", "Іподром «Буревій»", "hippodrome", (30, 41), area=(22, 42, 18, 2), jobs=[("groom", 360, 1080, 26, []), ("jockey", 480, 1020, 30, [1, 2, 3, 4, 5, 6])])
for x, y in [(50, 2), (53, 3), (56, 2)]:
    H.prop("hay_bale", x, y, must=False)
for x in (25, 35):
    H.prop("lamp_street", x, 38, must=False)
for x in (23, 38):
    H.prop("trash_bin", x, 40, must=False)
H.prop("fountain", 29, 20)
for x, y in [(22, 18), (37, 22), (26, 24), (34, 16)]:
    H.prop("flower_bed", x, y, must=False)
H.scatter(rng, ["tree_birch", "tree_oak", "bush_round", "tree_maple"], 30, {"g"})
H.place("stands", "Трибуна", 27, 42, 6, 1, "chat")

# =============================================================================================================
# The cave under the rocky hill: a tunnel from the mouth, a hall with an underground lake, a grotto of crystals;
# no sky, its own dark; the light is the torches', the crystals' and the glowing mushrooms'
# =============================================================================================================
CAVE = Map("cave", "Печера під Скелястим пагорбом", 44, 32, ".", {".": "void", "k": "floor.cave", "w": "floor.water"})
rng = random.Random(71)
CAVE.ellipse(22, 21, 7, 5, "k")
CAVE.paint(21, 25, 23, 31, "k")
CAVE.line([(20, 17), (16, 13)], 3, "k")
CAVE.ellipse(13, 9, 10, 6, "k")
CAVE.ellipse(12, 9, 5, 2.6, "w")
CAVE.line([(22, 9), (29, 10)], 3, "k")
CAVE.ellipse(34, 10, 7, 5.5, "k")
CAVE.line([(27, 21), (33, 24)], 2, "k")
CAVE.ellipse(36, 25, 4, 3, "k")
CAVE.exits.append({"x": 21, "y": 31, "w": 3, "h": 1, "to": "forest", "at": [111, 28], "name": "Назовні"})
CAVE.reserve(20, 27, 24, 31)
for x, y in [(21, 26), (23, 26)]:
    CAVE.prop("cave_torch", x, y, must=False)
for x, y in [(30, 7), (32, 13), (36, 6), (38, 12), (35, 9), (31, 10)]:
    CAVE.prop("crystal", x, y, must=False)
for x, y in [(6, 6), (19, 6), (5, 12), (17, 23), (26, 18), (37, 26), (34, 23)]:
    CAVE.prop("glow_mushroom", x, y, must=False)
# the old mine along the passage to the grotto: rails, timber props, a cart of ore, lanterns
for x in range(23, 30):
    CAVE.prop("rails", x, 10, rot=0, must=False)
for x in (24, 27):
    CAVE.prop("mine_support", x, 9, must=False)
CAVE.prop("minecart", 29, 11, must=False)
# an old miner still comes down by day, out of habit, to look at the seams he once worked
CAVE.site("cave_site", "Печера", "cave", (22, 27), area=(17, 18, 10, 3), jobs=[("old_miner", 540, 960, 10, [0, 1, 2, 3, 4])])
CAVE.prop("mine_lantern", 22, 8, must=False)
CAVE.prop("mine_lantern", 30, 14, must=False)
for x, y in [(10, 4), (18, 12), (24, 19), (38, 9), (35, 27)]:
    CAVE.prop("rock_column", x, y, must=False)
CAVE.scatter(rng, ["stalagmite", "stalagmite", "rock_wall", "rocks"], 40, {"k"})
CAVE.place("underground_lake", "Підземне озеро", 9, 12, 6, 2, "walk")
CAVE.place("crystal_grotto", "Кришталевий грот", 31, 8, 6, 4, "walk")

# =============================================================================================================
# The taxi: stands in the village and out at every place it goes to; a ride costs by how far it is
# =============================================================================================================
TAXI = []


def stand(m, sid, name, x, y, fare):
    """A taxi stand: its sign on a free cell near (x, y) and the stop next to it."""
    for r in range(4):
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                cx_, cy_ = x + dx, y + dy
                if m.inside(cx_, cy_) and m.grid[cy_][cx_] not in ("w", "c") and m.prop("taxi_sign", cx_, cy_, must=False):
                    stop = next(((cx_ + ex, cy_ + ey) for ex, ey in ((0, 1), (1, 0), (-1, 0), (0, -1))
                                 if m.inside(cx_ + ex, cy_ + ey) and (cx_ + ex, cy_ + ey) not in m.taken and m.grid[cy_ + ey][cx_ + ex] != "w"), None)
                    if stop:
                        TAXI.append({"id": sid, "name": name, "location": m.id, "x": stop[0], "y": stop[1], "fare": fare})
                        m.reserve(*stop, *stop)
                        return
    raise SystemExit(f"no room for the taxi stand {sid}")


stand(V, "taxi.square", "Площа й ратуша", 50, 24, 10)
stand(V, "taxi.radio", "Радіо «Липове FM»", 37, 27, 12)
stand(V, "taxi.home", "Біля твого дому", 9, 49, 10)
stand(P, "taxi.fields", "Пшеничне поле", 59, 25, 15)
stand(H, "taxi.hippodrome", "Іподром", 33, 4, 20)
stand(FARM, "taxi.farm", "Ферма", 4, 25, 15)
stand(F, "taxi.forest", "Ліс, біля дороги", 47, 88, 15)
stand(F, "taxi.cave", "Гора й печера", 114, 30, 25)
stand(D, "taxi.dump", "Звалище", 6, 13, 12)
stand(VY, "taxi.vineyard", "Виноградник «Лоза»", 30, 42, 20)
stand(V, "taxi.church", "Костел", 62, 27, 12)
stand(V, "taxi.hostel", "Хостел «Лелека»", 56, 64, 12)
stand(V, "taxi.factory", "Хлібзавод", 60, 10, 12)
stand(V, "taxi.newsroom", "Редакція «Вісника»", 66, 64, 12)
