# Where the clothes shop, the salon and the homes to rent or buy stand (docs/world-economy.md §11), and the data
# the core needs about them. Run by world_maps.py: `style_village(V)` among the village's buildings (before its
# power and gas lines and lamps), `style_forest(F)` and `style_fields(P)` in their sections.

STYLE_HOMES = []
FASHION = None


def free_spot(m, item, rot, xs, ys, path_to=("c", "p"), reach=4):
    """The first place along the given rows and columns where the building fits on open ground and its door
    is near a street (within `reach`), or None."""
    d = ITEM[item]
    w, h = d["footprint"]["w"], d["footprint"]["d"]
    for y in ys:
        for x in xs:
            if not m.fits(item, x, y, rot, grounds=GREEN):
                continue
            door = {0: (x + w // 2, y + h), 2: (x + w - 1 - w // 2, y - 1), 3: (x + h, y + w - 1 - w // 2), 1: (x - 1, y + w // 2)}[rot % 4]
            if not m.inside(*door) or door in m.taken or door in m.reserved:
                continue
            step = {0: (0, 1), 2: (0, -1), 3: (1, 0), 1: (-1, 0)}[rot % 4]
            cx, cy = door
            ok = False
            for _ in range(reach):
                if not m.inside(cx, cy) or (cx, cy) in m.taken:
                    break
                if m.grid[cy][cx] in path_to:
                    ok = True
                    break
                cx, cy = cx + step[0], cy + step[1]
            if ok:
                return x, y
    raise RuntimeError(f"no room for {item} in {m.id}")


def style_village(V):
    global FASHION
    # a new street south of the last one: the village grows by fourteen rows of meadow (added after the trees
    # were scattered, so nothing already standing moves), two lanes come down to it from the street above
    grow = 14
    top = V.h
    V.h += grow
    V.grid += [["g"] * V.w for _ in range(grow)]
    for x in (14, 34):
        V.paint(x - 1, top - 2, x - 1, top + 9, "p", only={"g", "m"})
        V.paint(x + 2, top - 2, x + 2, top + 9, "p", only={"g", "m"})
        V.paint(x, top - 2, x + 1, top + 7, "c")
    sy = top + 6  # the new street's lanes: sy and sy + 1
    V.paint(1, sy - 1, V.w - 2, sy - 1, "p", only={"g", "m"})
    V.paint(1, sy + 2, V.w - 2, sy + 2, "p", only={"g", "m"})
    V.paint(1, sy, V.w - 2, sy + 1, "c")
    north = sy - 1 - 3  # buildings on the north side stand on these rows, their doors on the pavement
    south = sy + 3      # and on the south side, facing north
    # the clothes shop and the salon side by side, their people
    door, fp = V.building_at("clothes_shop", 3, north, rot=0, path_to=("p", "c"))
    V.site("clothes_site", "Крамниця одягу «Льон»", "clothes", door, building=fp, jobs=[("shop_assistant", 540, 1140, 26, [0, 1, 2, 3, 4, 5])])
    door, fp = V.building_at("hair_salon", 9, north, rot=0, path_to=("p", "c"))
    V.site("salon_site", "Перукарня «Локон»", "salon", door, building=fp, jobs=[("hairdresser", 540, 1080, 26, [1, 2, 3, 4, 5])])
    FASHION = {"shop": "clothes_in", "shop_hours": [9, 19], "fitting": ["clothes_in"], "salon": "salon_in", "salon_hours": [9, 18],
               "price_style": 40, "price_color": 25, "price_beard": 15}
    # the player's first house
    STYLE_HOMES.append({"id": "home.lypova", "name": "Твій дім на Липовій", "location": "village", "prop": "home_house", "x": 5, "y": 51, "kind": "house", "start": True,
                        "text": "Дім, у якому все почалося."})
    # a block of flats to let
    door, fp = V.building_at("flat_block", 20, north, rot=0, path_to=("p", "c"))
    V.prop("sign_to_let", fp[0] + fp[2], fp[1] + fp[3] - 1, must=False)
    STYLE_HOMES.append({"id": "flat.sadova.1", "name": "Квартира на першому поверсі", "location": "village", "prop": "flat_block", "x": door[0], "y": door[1], "kind": "flat", "rent": 45,
                        "text": "Дві кімнати, вікна на вулицю; зранку чути, як прокидається вулиця."})
    STYLE_HOMES.append({"id": "flat.sadova.2", "name": "Квартира з балконом", "location": "village", "prop": "flat_block", "x": door[0], "y": door[1], "kind": "flat", "rent": 60,
                        "text": "Другий поверх, балкон з квітами, видно дахи аж до костелу."})
    # a house for sale on the south side
    door, fp = V.building_at("house_tall_b", 40, south, colors={"wall": "#e9d9ff"}, rot=2, path_to=("p", "c"))
    V.prop("sign_for_sale", fp[0] - 1, fp[1], must=False)
    STYLE_HOMES.append({"id": "house.prodayetsya", "name": "Двоповерховий дім на продаж", "location": "village", "prop": "house_tall_b", "x": door[0], "y": door[1], "kind": "house",
                        "price": 1800, "rent": 90, "text": "Просторий, з горищем і садком. Власники переїхали до доньки в місто."})
    # the new street's greenery: trees in a row on the south side, flowers by the shop and the salon
    for x in range(26, 68, 5):
        V.prop("tree_maple" if x % 2 else "tree_birch", x, south + 4, must=False)
    for x in (2, 8, 14):
        V.prop("flower_bed", x, north - 1, must=False)
    V.prop("garden_bench", 30, north + 1, must=False)
    V.prop("bike_stand", 16, sy + 3, must=False)


def style_forest(F):
    # a small cottage at the edge of the forest, to rent or to buy
    x, y = free_spot(F, "cottage_sage", 0, range(30, 70), range(70, 90), path_to=("t", "p", "h", "r"), reach=6)
    door, fp = F.building_at("cottage_sage", x, y, colors={"wall": "#e8d4b8", "roof": "#3f7f4a"}, path_to=("t", "p", "h", "r"))
    F.prop("sign_to_let", fp[0] + fp[2], fp[1] + fp[3] - 1, must=False)
    STYLE_HOMES.append({"id": "cottage.lis", "name": "Хатинка на узліссі", "location": "forest", "prop": "cottage_sage", "x": door[0], "y": door[1], "kind": "cottage",
                        "rent": 35, "price": 900, "text": "Тиша, сосни, вранці під вікном ходять зайці."})


PLOT_STATIONS = []


def style_fields(P):
    # two allotments by the village road, each with its beds and a sign
    for n, (x0, y0) in enumerate([(59, 26), (59, 33)], start=1):
        P.paint(x0, y0, x0 + 3, y0 + 4, "o")
        for i, bed in enumerate(["bed_carrots", "bed_potatoes"]):
            P.prop(bed, x0 + 1, y0 + i * 2, must=False)
        P.prop("allotment_sign", x0, y0 + 4)
        pid = f"plot.pole.{n}"
        STYLE_HOMES.append({"id": pid, "name": f"Ділянка під город №{n}", "location": "fields", "prop": "allotment_sign", "x": x0, "y": y0 + 5, "kind": "plot", "rent": 12,
                            "text": "Кілька грядок біля дороги: морква, картопля, а влітку й зелень."})
        PLOT_STATIONS.append({"id": f"st.plot{n}.harvest", "location": "fields", "prop": "allotment_sign", "label": f"Зібрати з грядок №{n}",
                              "text": "Своє, з власної ділянки — смакує інакше.", "needs": [], "gives": [["carrot", 1], ["potato", 1]], "per_day": 1,
                              "seasons": ["Summer", "Autumn"], "kind": "gather", "spent": "Сьогодні з грядок уже все зібрано.",
                              "requires": {"leased": [pid], "hint": "Це чужі грядки: ділянку спершу треба взяти в оренду."}})
