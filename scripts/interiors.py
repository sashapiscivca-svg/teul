# The insides of the village's public buildings: a classroom, a ward, the police and fire stations, the café,
# the library, the shops and the workshop. Each is a small location of its own, entered through its building's
# door; its people (the staff at work, the visitors) stand at its posts (the staff's first, behind their counters).
# The rooms are laid out like the real thing: a shop floor and a stockroom or an office behind a glass partition,
# a counter with the till turned to the customers and the staff behind it, the goods on shelves along the walls,
# lights and pictures; every post and every thing can be got to from the door (checked as each room is built).
# Run inside gen_base_content.py after world_maps.py (it uses Map, V and locations).

# every site's door, and the map it is on (most are in the village; the winery is at the vineyard)
SITE_DOOR = {s["id"]: (s["x"], s["y"], m.id) for m in (V, VY, FARM, H, CEM) for s in m.sites}

# small things that may stand tucked into a corner with no way round them
TUCKED = {"plants", "lighting", "decor", "flowers", "orangery"}
TUCKED_ITEMS = {"stock_boxes", "mop_bucket", "flour_sacks", "wool_bale", "milk_can", "tyre_stack"}


class Inside(Map):
    """A room inside a building: walls all round, a wide door in the south wall that leads back out."""

    def __init__(self, id, name, site, w, h, floor, wall, door_x):
        super().__init__(id, name, w, h, "a", {"a": floor})
        self.indoor = True
        self.inside_of = site
        self.wall_style = wall
        self.posts = []
        self.kept = []
        self.door_x = door_x
        self.prop("door_double", door_x, h - 1, wall="south")
        sx, sy, outside = SITE_DOOR[site]
        self.exits.append({"x": door_x, "y": h - 1, "w": 3, "h": 1, "to": outside, "at": [sx, sy], "name": "Назовні"})
        # the doormat and the way in stay clear
        self.prop("rug_round_small", door_x + 1, h - 1)
        self.reserve(door_x, h - 2, door_x + 2, h - 1)

    def post(self, *cells):
        for c in cells:
            assert self.inside(*c) and c not in self.taken, f"{self.id}: post {c} is not free"
            self.posts.append(list(c))

    def keep(self, *cells):
        """Cells that must stay open floor (where the tests and the screenshots put someone)."""
        self.kept += list(cells)

    def partition(self, x0, y0, x1, y1, gaps=(), item="partition_glass"):
        """A straight run of partition along a row (y0 == y1) or a column (x0 == x1), open at the gaps."""
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                if (x, y) not in gaps:
                    self.prop(item, x, y, rot=0 if y0 == y1 else 1)

    def check(self):
        free = {(x, y) for y in range(self.h) for x in range(self.w)} - set(self.taken)
        seen = {(x, self.h - 1) for x in range(self.door_x, self.door_x + 3)} & free
        todo = list(seen)
        while todo:
            x, y = todo.pop()
            for c in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if c in free and c not in seen:
                    seen.add(c)
                    todo.append(c)
        for p in self.posts:
            assert tuple(p) in seen, f"{self.id}: the post {p} cannot be got to from the door"
        for c in self.kept:
            assert c in seen, f"{self.id}: {c} must stay open floor"
        for p in self.props:
            if "wall" in p or ITEM[p["item"]]["layer"] != "floor" or ITEM[p["item"]]["category"] in TUCKED or p["item"].startswith("partition_") or p["item"] in TUCKED_ITEMS:
                continue
            cells = self.footprint(p["item"], p["x"], p["y"], p.get("rot", 0))
            near = {(x + dx, y + dy) for x, y in cells for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))}
            assert near & seen, f"{self.id}: nobody can get to the {p['item']} at {p['x']},{p['y']}"

    def build(self):
        self.check()
        out = super().build()
        out["inside"] = self.inside_of
        out["wall"] = self.wall_style
        out["posts"] = self.posts
        return out


rooms = []

# ---- the classroom: the blackboard and the teacher's desk facing three rows of desks, a book wall, an art corner
# with an easel, a reading corner of bean bags by the toy box, coats by the door
R = Inside("school_in", "Школа: клас", "school_site", 16, 12, "floor.oak", "wall.cream", 7)
R.prop("blackboard", 6, 0, wall="north")
R.prop("wall_clock", 10, 0, wall="north")
R.prop("poster", 2, 0, wall="north")
R.prop("poster", 13, 0, wall="north")
R.prop("track_lights", 3, 0, wall="north")
R.prop("track_lights", 11, 0, wall="north")
R.prop("world_map", 0, 2, wall="west")
R.prop("coat_rack", 0, 8, wall="west")
for y in (2, 6, 9):
    R.prop("window_wide", 15, y, wall="east")
R.prop("desk", 7, 2, rot=2)
R.prop("office_chair", 8, 1)
R.prop("filing_cabinet", 12, 1)
R.prop("bookcase_tall", 13, 1)
R.prop("fern", 15, 1)
R.prop("bookshelf", 0, 4, rot=3)
for y in (4, 6, 8):
    for x in (2, 4, 6, 9, 11, 13):
        R.prop("school_desk", x, y)
R.prop("easel", 15, 4)
R.prop("paint_cans", 15, 6)
R.prop("shelf_low", 0, 9, rot=3)
R.prop("bean_bag", 12, 10)
R.prop("bean_bag", 14, 10)
R.prop("toy_box", 15, 9)
R.prop("globe" if ITEM.get("globe", {}).get("layer") == "floor" else "snake_plant", 4, 10)
R.post((7, 1), (3, 5), (5, 5), (8, 5), (10, 5), (12, 5), (3, 7), (5, 7), (10, 7), (12, 7), (13, 10))
rooms.append(R)

# ---- the hospital: a ward of beds behind glass, a treatment room with the examination couch and the sink, the
# reception facing the door, benches to wait on, a cooler and the pharmacy shelf
R = Inside("hospital_in", "Лікарня", "hospital_site", 16, 12, "floor.marble", "wall.stripe_blue", 7)
for x in (1, 3, 5):
    R.prop("hospital_bed", x, 1)
for x in (2, 4):
    R.prop("nightstand", x, 1)
R.prop("screen_folding", 6, 1)
R.partition(8, 0, 8, 3)
R.partition(0, 4, 8, 4, gaps={(6, 4)})
R.prop("water_cooler", 9, 0)
R.prop("medical_cabinet", 10, 0)
R.partition(11, 0, 11, 3)
R.partition(11, 4, 15, 4, gaps={(13, 4)})
R.prop("counter_sink", 12, 0)
R.prop("exam_table", 13, 1)
R.prop("medical_cabinet", 15, 0)
R.prop("reception_desk", 8, 7)
R.prop("filing_cabinet", 11, 6)
R.prop("shop_shelf", 13, 6)
R.prop("waiting_bench", 1, 7)
R.prop("waiting_bench", 4, 7)
R.prop("waiting_bench", 1, 10)
R.prop("newspaper_rack", 0, 6)
R.prop("fern", 15, 10)
R.prop("monstera", 6, 10)
R.prop("wall_clock", 9, 0, wall="north")
R.prop("calendar", 4, 0, wall="north")
R.prop("poster", 0, 8, wall="west")
R.prop("track_lights", 12, 0, wall="north")
R.prop("window_tall", 15, 2, wall="east")
R.prop("window_tall", 15, 7, wall="east")
R.post((9, 6), (13, 3), (2, 3), (4, 3), (6, 3), (3, 8), (6, 8), (10, 2), (12, 9))
rooms.append(R)

# ---- the police: the front desk facing the door, the officers' desks and the computer, the archive, a cell
# behind bars with a bunk and a toilet, an interview room behind glass, lockers and the safe
R = Inside("police_in", "Відділок поліції", "police_site", 14, 11, "floor.slate", "wall.stripe_blue", 6)
R.prop("desk", 1, 2)
R.prop("office_chair", 1, 1)
R.prop("pc_desk", 4, 1)
R.prop("office_chair", 5, 2, rot=2)
R.prop("filing_cabinet", 0, 4, rot=3)
R.prop("filing_cabinet", 0, 5, rot=3)
R.prop("safe", 3, 0)
R.prop("locker", 7, 0)
R.prop("locker", 8, 0)
for y in range(4):
    R.prop("cell_bars", 10, y, rot=1)
R.prop("bed_single", 13, 0)
R.prop("toilet", 11, 0)
R.prop("reception_desk", 5, 6)
R.partition(9, 5, 13, 5, gaps={(12, 5)})
R.partition(9, 6, 9, 9)
R.prop("round_table", 11, 7)
R.prop("dining_chair_metal", 10, 7, rot=3)
R.prop("dining_chair_metal", 13, 8, rot=1)
R.prop("waiting_bench", 1, 8)
R.prop("water_cooler", 0, 10)
R.prop("snake_plant", 13, 10)
R.prop("world_map", 1, 0, wall="north")
R.prop("wall_clock", 6, 0, wall="north")
R.prop("poster", 13, 7, wall="east")
R.prop("notice_bills", 0, 7, wall="west")
R.post((6, 5), (2, 3), (4, 3), (11, 4), (2, 7), (11, 6), (8, 8))
rooms.append(R)

# ---- the fire station: the engine in its bay, helmets and coats, hoses, the lockers; the crew's room behind
# glass with its kitchen and table; the duty officer's desk
R = Inside("fire_in", "Пожежна частина", "fire_site", 16, 12, "floor.slate", "wall.brick", 7)
R.prop("fire_truck", 1, 3)
R.prop("helmet_shelf", 1, 0, wall="north")
R.prop("helmet_shelf", 4, 0, wall="north")
R.prop("hose_rack", 0, 6, wall="west")
R.prop("hose_rack", 0, 7, wall="west")
for x in (8, 9, 10):
    R.prop("locker", x, 0)
R.partition(11, 0, 11, 5, gaps={(11, 2)})
R.prop("stove", 12, 0)
R.prop("counter", 13, 0)
R.prop("counter_sink", 14, 0)
R.prop("fridge", 15, 0)
R.prop("round_table", 13, 3)
R.prop("dining_chair_metal", 12, 3, rot=3)
R.prop("dining_chair_metal", 15, 4, rot=1)
R.prop("sofa2", 12, 7)
R.prop("desk", 13, 10, rot=2)
R.prop("office_chair", 13, 9)
R.prop("filing_cabinet", 15, 9, rot=1)
R.prop("hydrant", 0, 10)
R.prop("mop_bucket", 5, 10)
R.prop("stock_boxes", 0, 0)
R.prop("wall_clock", 7, 0, wall="north")
R.prop("window_wide", 15, 2, wall="east")
R.prop("window_wide", 15, 6, wall="east")
R.prop("track_lights", 12, 0, wall="north")
R.post((6, 4), (9, 2), (12, 2), (13, 6), (2, 6), (14, 9))
rooms.append(R)

# ---- the café: the coffee bar, the counters and the pastry case turned to the guests, the back bar behind them
# with its menu board; the kitchen behind glass; tables, a window bar with stools, lights on a string
R = Inside("cafe_in", "Кав'ярня «Липа»", "cafe_site", 14, 11, "floor.herring", "wall.panel_oak", 5)
R.prop("shelf_low", 1, 0)
R.prop("counter", 3, 0)
R.prop("counter_sink", 4, 0)
R.prop("fridge", 5, 0)
R.prop("wall_cabinet", 3, 0, wall="north")
R.prop("wall_cabinet", 4, 0, wall="north")
R.prop("menu_board", 6, 0, wall="north")
R.prop("track_lights", 1, 0, wall="north")
R.prop("coffee_bar", 1, 3)
R.prop("counter", 3, 3)
R.prop("counter", 4, 3)
R.prop("pastry_case", 5, 3)
R.partition(9, 0, 9, 3, gaps={(9, 2)})
R.prop("stove", 10, 0)
R.prop("counter_drawers", 11, 0)
R.prop("counter_sink", 12, 0)
R.prop("fridge", 13, 0)
R.prop("counter", 13, 3)
R.prop("stock_boxes", 10, 3)
R.prop("round_table", 2, 6)
R.prop("dining_chair_wood", 1, 6, rot=3)
R.prop("dining_chair_wood", 4, 7, rot=1)
for ty in (5, 8):
    R.prop("round_table", 9, ty)
    R.prop("dining_chair_wood", 8, ty, rot=3)
    R.prop("dining_chair_wood", 11, ty + 1, rot=1)
R.prop("bar_table", 13, 6)
R.prop("bar_stool", 12, 6)
R.prop("bar_stool", 13, 7)
R.prop("bar_table", 1, 9)
R.prop("bar_stool", 2, 9)
R.prop("string_lights", 0, 5, wall="west")
R.prop("painting_small", 0, 8, wall="west")
R.prop("painting_wide", 13, 1, wall="east")
R.prop("window_wide", 13, 5, wall="east")
R.prop("window_wide", 13, 8, wall="east")
R.prop("monstera", 13, 10)
R.keep((5, 7), (4, 6), (5, 6))
R.post((2, 2), (11, 2), (1, 5), (4, 8), (8, 4), (11, 7), (8, 7), (12, 5))
rooms.append(R)

# ---- the library: shelves of books on every wall and back to back in the stacks, a long reading table, the
# librarian's desk, a computer corner, a children's corner, armchairs with a lamp, the papers on a rack
R = Inside("library_in", "Бібліотека", "library_site", 16, 12, "floor.walnut", "wall.wainscot", 7)
for x in (1, 3, 5, 7):
    R.prop("bookshelf", x, 0)
R.prop("bookcase_tall", 9, 0)
R.prop("bookcase_tall", 10, 0)
R.prop("bookshelf", 0, 3, rot=3)
R.prop("bookshelf", 0, 8, rot=3)
R.prop("bookshelf", 11, 3, rot=2)
R.prop("bookshelf", 11, 4)
R.prop("bookshelf", 11, 6, rot=2)
R.prop("dining_table", 3, 3)
for x in (3, 5):
    R.prop("dining_chair_wood", x, 2)
    R.prop("dining_chair_wood", x, 5, rot=2)
R.prop("reception_desk", 8, 8)
R.prop("pc_desk", 13, 1)
R.prop("office_chair", 13, 2, rot=2)
R.prop("armchair", 14, 10, rot=2)
R.prop("armchair", 12, 10, rot=2)
R.prop("side_table", 13, 10)
R.prop("floor_lamp", 15, 10)
R.prop("bean_bag", 1, 10)
R.prop("toy_blocks", 2, 10)
R.prop("toy_box", 3, 10)
R.prop("newspaper_rack", 15, 7)
R.prop("globe" if ITEM.get("globe", {}).get("layer") == "floor" else "fern", 15, 4)
R.prop("window_tall", 15, 2, wall="east")
R.prop("window_tall", 15, 5, wall="east")
R.prop("wall_clock", 12, 0, wall="north")
R.prop("painting_tall", 0, 6, wall="west")
R.prop("track_lights", 1, 0, wall="north")
R.prop("track_lights", 5, 0, wall="north")
R.keep((5, 7), (5, 6))
R.post((9, 7), (4, 2), (4, 5), (14, 2), (14, 9), (2, 7), (8, 4))
rooms.append(R)

# ---- the grocery: fridges and the chest freezer along the back wall, shelves along the side and back to back in
# two aisles, the fruit and vegetable stand by the door, baskets, the till facing the door; the stockroom behind
# glass with boxes of stock
R = Inside("grocery_in", "Крамниця «Колосок»", "grocery", 14, 11, "floor.checker", "wall.cream", 5)
R.prop("display_fridge", 1, 0)
R.prop("display_fridge", 3, 0)
R.prop("freezer_chest", 5, 0)
R.prop("shop_shelf", 7, 0)
R.prop("shop_shelf", 0, 2, rot=3)
R.prop("shop_shelf", 0, 5, rot=3)
for x in (3, 6):
    R.prop("shop_shelf", x, 3, rot=2)
    R.prop("shop_shelf", x, 4)
R.prop("produce_stand", 2, 7)
R.prop("veg_crate", 0, 8)
R.prop("apple_basket", 0, 9)
R.prop("veg_crate", 1, 9)
R.prop("basket_stack", 4, 9)
R.prop("cash_counter", 8, 7)
R.prop("newspaper_rack", 10, 7)
R.partition(10, 0, 10, 5, gaps={(10, 3)})
R.partition(11, 5, 13, 5)
R.prop("stock_boxes", 11, 0)
R.prop("stock_boxes", 12, 0)
R.prop("stock_boxes", 13, 0)
R.prop("stock_boxes", 13, 1)
R.prop("stock_boxes", 11, 4)
R.prop("mop_bucket", 13, 4)
R.prop("calendar", 9, 0, wall="north")
R.prop("track_lights", 1, 0, wall="north")
R.prop("track_lights", 5, 0, wall="north")
R.prop("window_wide", 13, 7, wall="east")
R.prop("wall_clock", 12, 0, wall="north")
R.post((9, 6), (12, 2), (5, 5), (2, 2), (1, 4), (8, 5), (3, 8))
rooms.append(R)

# ---- the bakery: the oven, the mixer and the flour in the bakehouse at the back, the shelves of loaves turned to
# the shop over the counter, the till and the pastry case; two little tables by the window
R = Inside("bakery_in", "Пекарня «Паляниця»", "bakery", 12, 10, "floor.terracotta_tiles", "wall.cream", 5)
R.prop("bread_oven", 0, 0)
R.prop("dough_mixer", 2, 0)
R.prop("flour_sacks", 3, 0)
R.prop("flour_sacks", 4, 0)
R.prop("counter", 6, 0)
R.prop("counter", 7, 0)
R.prop("counter_sink", 8, 0)
R.prop("flour_sacks", 10, 0)
R.prop("stock_boxes", 11, 0)
R.prop("wall_shelf_jars", 6, 0, wall="north")
for x in (1, 3, 6):
    R.prop("bread_shelf", x, 2)
R.prop("counter", 3, 4)
R.prop("counter", 4, 4)
R.prop("cash_counter", 5, 4)
R.prop("pastry_case", 7, 4)
R.prop("side_table", 0, 7)
R.prop("chair", 1, 7, rot=1)
R.prop("side_table", 10, 7)
R.prop("chair", 9, 7, rot=3)
R.prop("chair", 11, 7, rot=1)
R.prop("basket_stack", 9, 9)
R.prop("menu_board", 11, 3, wall="east")
R.prop("window_wide", 11, 7, wall="east")
R.prop("track_lights", 0, 4, wall="west")
R.prop("wall_clock", 0, 7, wall="west")
R.post((1, 1), (6, 3), (3, 1), (4, 6), (1, 8), (8, 7), (10, 8))
rooms.append(R)

# ---- the post office: the counter with its clerk, the sorting room behind it (parcel shelves, the scales, boxes),
# a wall of letter boxes, a rack of papers, a bench and a cooler for those who wait
R = Inside("post_in", "Пошта «Липове»", "post_site", 14, 10, "floor.checker", "wall.cream", 5)
R.prop("parcel_shelf", 0, 0)
R.prop("parcel_shelf", 2, 0)
R.prop("parcel_shelf", 5, 0)
R.prop("stock_boxes", 4, 0)
R.prop("stock_boxes", 7, 0)
R.prop("safe", 8, 0)
R.prop("parcel_scale", 7, 2)
R.prop("partition_low", 2, 4)
R.prop("partition_low", 3, 4)
R.prop("reception_desk", 4, 4)
R.prop("partition_low", 7, 4)
R.partition(9, 0, 9, 3, gaps={(9, 1)})
R.prop("po_boxes", 11, 0)
R.prop("newspaper_rack", 13, 0)
R.prop("waiting_bench", 0, 7)
R.prop("waiting_bench", 10, 7)
R.prop("water_cooler", 13, 6)
R.prop("parcel_scale", 9, 5)
R.prop("fern", 13, 9)
R.prop("wall_clock", 5, 0, wall="north")
R.prop("poster", 13, 3, wall="east")
R.prop("window_wide", 13, 7, wall="east")
R.prop("track_lights", 1, 0, wall="north")
R.keep((4, 6))
R.post((5, 3), (1, 2), (5, 5), (11, 2), (2, 7), (9, 8))
rooms.append(R)

# ---- the utility office: the cash counter behind glass with the clerks' office behind it (files, a desk, the
# safe), the queue's ticket machine, benches to wait on, the meters on the wall
R = Inside("utility_in", "Комунальна контора", "utility_site", 13, 10, "floor.checker", "wall.sage", 5)
R.prop("filing_cabinet", 0, 0)
R.prop("filing_cabinet", 1, 0)
R.prop("desk", 3, 0, rot=2)
R.prop("office_chair", 3, 1, rot=2)
R.prop("safe", 9, 0)
R.prop("stock_boxes", 12, 0)
R.prop("meter_board", 6, 0, wall="north")
R.prop("notice_bills", 1, 0, wall="north")
R.partition(0, 3, 4, 3)
R.prop("bill_counter", 5, 3)
R.partition(7, 3, 12, 3, gaps={(11, 3)})
R.prop("queue_machine", 8, 5)
R.prop("waiting_bench", 0, 5)
R.prop("waiting_bench", 0, 7)
R.prop("waiting_bench", 9, 8)
R.prop("water_cooler", 12, 5)
R.prop("ficus", 12, 9)
R.prop("wall_clock", 0, 4, wall="west")
R.prop("window_wide", 12, 6, wall="east")
R.keep((4, 6))
R.post((5, 2), (9, 5), (2, 1), (2, 5), (8, 8))
rooms.append(R)

# ---- the clothes shop «Льон»: racks of clothes along the walls and in the middle, coats, hats and shoes, a table
# of folded things, mirrors, three fitting booths, the till; boxes of stock in the corner
R = Inside("clothes_in", "Крамниця одягу «Льон»", "clothes_site", 14, 11, "floor.oak", "wall.cream", 6)
for x in (1, 3, 5):
    R.prop("clothes_rack", x, 0)
R.prop("coat_rack_shop", 7, 0)
R.prop("tall_mirror", 10, 0)
for x in (11, 12, 13):
    R.prop("fitting_booth", x, 0)
R.prop("shoe_shelf", 0, 3, rot=3)
R.prop("shoe_shelf", 0, 4, rot=3)
R.prop("hat_stand", 0, 6)
R.prop("clothes_rack", 3, 4)
R.prop("shelf_low", 7, 4)
R.prop("cash_counter", 10, 6)
R.prop("tall_mirror", 13, 4)
R.prop("stock_boxes", 13, 7)
R.prop("ficus", 13, 10)
R.prop("basket_stack", 2, 9)
R.prop("window_wide", 13, 8, wall="east")
R.prop("wall_clock", 9, 0, wall="north")
R.prop("track_lights", 1, 0, wall="north")
R.prop("track_lights", 4, 0, wall="north")
R.keep((5, 6))
R.post((11, 5), (3, 2), (6, 2), (12, 2), (2, 6), (8, 8))
rooms.append(R)

# ---- the salon «Локон»: three chairs before the mirrors, the wash basin and the hood dryer, a shelf of products,
# a bench and the papers for those who wait, the till
R = Inside("salon_in", "Перукарня «Локон»", "salon_site", 12, 10, "floor.checker", "wall.sage", 5)
for x in (1, 4, 7):
    R.prop("salon_chair", x, 1)
    R.prop("salon_mirror", x - 1, 0, wall="north")
R.prop("salon_sink", 10, 0)
R.prop("salon_sink", 11, 0)
R.prop("hair_dryer_hood", 11, 3)
R.prop("waiting_bench", 0, 6)
R.prop("newspaper_rack", 2, 6)
R.prop("cash_counter", 8, 6)
R.prop("shelf_low", 10, 8)
R.prop("wall_shelf_jars", 11, 5, wall="east")
R.prop("ficus", 11, 9)
R.prop("wall_clock", 9, 0, wall="north")
R.prop("track_lights", 0, 3, wall="west")
R.keep((4, 5))
R.post((2, 2), (5, 2), (9, 5), (1, 5), (6, 7), (10, 2))
rooms.append(R)

# ---- the flower shop: buckets and pots of flowers along the walls, the cart of bouquets, the till; the florist's
# workroom behind glass with the potting bench, the sink and boxes
R = Inside("flower_in", "Квітковий магазин «Півонія»", "flower_shop_site", 12, 10, "floor.terracotta", "wall.sage", 5)
for x in (0, 1, 2, 3):
    R.prop("flower_bucket", x, 0)
R.prop("orchid_stand", 6, 0)
R.prop("hydrangea_pot", 0, 3)
R.prop("lavender_pot", 0, 4)
R.prop("sunflower_vase", 0, 5)
R.prop("flower_cart", 3, 4)
R.prop("flower_bucket", 5, 4)
R.prop("cash_counter", 6, 6)
R.partition(8, 0, 8, 3, gaps={(8, 2)})
R.partition(9, 3, 11, 3)
R.prop("potting_bench", 9, 0)
R.prop("counter_sink", 11, 0)
R.prop("stock_boxes", 11, 2)
R.prop("hanging_basket", 1, 0, wall="north")
R.prop("hanging_basket", 4, 0, wall="north")
R.prop("window_wide", 11, 6, wall="east")
R.prop("monstera", 11, 9)
R.post((7, 5), (10, 1), (3, 2), (2, 7), (9, 7))
rooms.append(R)

# ---- the workshop: workbenches under the tool walls, the lathe, paints, the timber, worn furniture waiting its
# turn, a stock of boxes and a broom
R = Inside("workshop_in", "Майстерня «Друге життя»", "workshop_site", 14, 11, "floor.pine", "wall.panel_oak", 5)
R.prop("workbench", 1, 1)
R.prop("workbench", 4, 1)
R.prop("lathe", 8, 1)
R.prop("tool_wall", 1, 0, wall="north")
R.prop("tool_wall", 4, 0, wall="north")
R.prop("garden_tools", 0, 4, wall="west")
R.prop("paint_cans", 12, 0)
R.prop("paint_cans", 13, 0)
R.prop("stock_boxes", 13, 2)
R.prop("log_pile" if "log_pile" in ITEM else "chest", 11, 4)
R.prop("worn_armchair", 0, 7)
R.prop("worn_chair", 1, 7)
R.prop("worn_dresser", 8, 7)
R.prop("worn_radio" if ITEM.get("worn_radio", {}).get("layer") == "floor" else "worn_side_table", 10, 7)
R.prop("mop_bucket", 13, 10)
R.prop("wall_lamp", 13, 2, wall="east")
R.prop("window_wide", 13, 6, wall="east")
R.keep((4, 6))
R.post((2, 2), (5, 2), (8, 2), (11, 2), (2, 6), (11, 6))
rooms.append(R)


# ---- the vet: the examination room behind glass (the table, medicine, a sink), the kennels with patients, the
# reception, a bench for owners and their pets, a shelf of pet food
R = Inside("vet_in", "Ветклініка «Лапка»", "vet_site", 13, 11, "floor.checker", "wall.sage", 5)
R.prop("medical_cabinet", 0, 0)
R.prop("exam_table", 2, 1)
R.prop("counter_sink", 5, 0)
R.partition(0, 4, 5, 4, gaps={(4, 4)})
R.partition(6, 0, 6, 3)
R.partition(8, 0, 8, 3, gaps={(8, 2)})
for x in (9, 10, 11, 12):
    R.prop("pet_cage", x, 0)
R.prop("pet_cage", 12, 2)
R.prop("filing_cabinet", 7, 0)
R.prop("reception_desk", 6, 6)
R.prop("waiting_bench", 0, 7)
R.prop("cat_bed", 2, 9)
R.prop("shop_shelf", 10, 8)
R.prop("water_cooler", 12, 5)
R.prop("poster", 2, 0, wall="north")
R.prop("wall_clock", 9, 0, wall="north")
R.prop("window_tall", 12, 7, wall="east")
R.prop("fern", 0, 10)
R.post((7, 5), (3, 2), (10, 2), (2, 7), (9, 7))
rooms.append(R)

# ---- the gym: treadmills in a row, the weights and the bench press, punching bags, mats, mirrors; the front desk;
# the changing room with its lockers behind glass
R = Inside("gym_in", "Спортзал «Сила»", "gym_site", 16, 12, "floor.slate", "wall.charcoal", 7)
for x in (1, 3, 5, 7):
    R.prop("treadmill", x, 1)
R.prop("weight_rack", 10, 0)
R.prop("bench_press", 11, 3)
R.prop("bench_press", 13, 3)
R.prop("punching_bag", 1, 6)
R.prop("punching_bag", 3, 6)
R.prop("play_mat", 6, 5)
R.prop("mirror", 0, 2, wall="west")
R.prop("mirror", 0, 4, wall="west")
R.prop("poster", 9, 0, wall="north")
R.prop("wall_clock", 14, 0, wall="north")
R.prop("window_wide", 15, 1, wall="east")
R.partition(12, 6, 15, 6)
R.partition(11, 6, 11, 10, gaps={(11, 8)})
for x in (12, 13, 14, 15):
    R.prop("locker", x, 7)
R.prop("waiting_bench", 13, 9, rot=2)
R.prop("reception_desk", 2, 9)
R.prop("water_cooler", 0, 10)
R.prop("mop_bucket", 15, 10)
R.post((3, 8), (2, 3), (4, 3), (6, 3), (12, 2), (2, 7), (9, 8), (12, 8))
rooms.append(R)

# ---- the bar: the long counter with its taps, the bottles behind it, stools, a pool table, a jukebox, darts,
# tables and a sofa; a trapdoor in the corner
R = Inside("bar_in", "Бар «Жабка»", "bar_site", 15, 12, "floor.walnut", "wall.panel_oak", 6)
R.prop("bar_counter", 1, 3)
R.prop("bar_counter", 4, 3)
R.prop("bottle_shelf", 1, 0)
R.prop("bottle_shelf", 3, 0)
R.prop("bottle_shelf", 5, 0)
R.prop("display_fridge", 7, 0)
R.prop("stock_boxes", 9, 0)
for x in range(1, 7):
    R.prop("bar_stool", x, 4)
R.prop("pool_table", 9, 2)
R.prop("jukebox", 14, 1)
R.prop("dartboard", 0, 7, wall="west")
for (tx, ty) in ((1, 7), (9, 7)):
    R.prop("round_table", tx, ty)
    R.prop("dining_chair_wood", tx - 1, ty, rot=3)
    R.prop("dining_chair_wood", tx + 2, ty + 1, rot=1)
R.prop("sofa2", 1, 10, rot=2)
R.prop("neon_sign", 8, 0, wall="north")
R.prop("string_lights", 11, 0, wall="north")
R.prop("painting_wide", 14, 5, wall="east")
R.prop("menu_board", 0, 3, wall="west")
R.post((2, 2), (1, 5), (3, 5), (5, 5), (8, 3), (12, 4), (3, 9), (12, 8))
# in the corner, a trapdoor nobody talks about: down into the cellar
R.prop("cellar_hatch", 13, 10)
R.keep((13, 9))
R.exits.append({"x": 13, "y": 10, "w": 1, "h": 1, "to": "bar_cellar", "at": [2, 2], "name": "Люк у льох"})
rooms.append(R)

# ---- the water tower: the riveted tank, its pipes and valves, an iron ladder up to the gallery, the keeper's
# table with a lantern, tools and a cooler
R = Inside("water_tower_in", "Водонапірна вежа", "water_tower_site", 10, 10, "floor.slate", "wall.brick", 3)
R.prop("tower_tank", 4, 1)
R.prop("pipe_valve", 2, 1)
R.prop("pipe_valve", 8, 1)
R.prop("pipe_valve", 8, 3)
R.prop("iron_ladder", 9, 6)
R.prop("window_tall", 0, 3, wall="west")
R.prop("window_tall", 9, 2, wall="east")
R.prop("wall_clock", 1, 0, wall="north")
R.prop("crate_table", 0, 7)
R.prop("chair", 1, 7, rot=1)
R.prop("mine_lantern", 0, 9)
R.prop("tool_chest", 7, 8)
R.prop("stock_boxes", 0, 0)
R.prop("garden_tools", 0, 5, wall="west")
R.keep((3, 4))
R.post((2, 3), (7, 3), (1, 6), (8, 6), (5, 5))
rooms.append(R)

# ---- the winery: rows of barrels, the press, racks of bottles, the tasting counter with stools, a table for
# tastings, boxes ready to go out
R = Inside("winery_in", "Виноробня «Лоза»", "winery_site", 15, 12, "floor.terracotta_tiles", "wall.brick", 6)
for y in (1, 3):
    for x in range(1, 7):
        R.prop("wine_barrel", x, y)
R.prop("wine_press", 9, 1)
R.prop("wine_press", 11, 1)
R.prop("bottle_shelf", 9, 4)
R.prop("bottle_shelf", 11, 4)
R.prop("bottle_shelf", 13, 4)
R.prop("bar_counter", 1, 7)
for x in (1, 2, 3):
    R.prop("bar_stool", x, 8)
R.prop("round_table", 10, 8)
R.prop("dining_chair_wood", 9, 8, rot=3)
R.prop("dining_chair_wood", 12, 9, rot=1)
R.prop("stock_boxes", 14, 0)
R.prop("stock_boxes", 14, 1)
R.prop("wall_lamp", 0, 4, wall="west")
R.prop("wall_lamp", 0, 9, wall="west")
R.prop("painting_small", 14, 7, wall="east")
R.prop("hanging_basket", 9, 0, wall="north")
R.post((2, 6), (10, 2), (8, 6), (4, 5), (13, 7), (1, 9))
rooms.append(R)

# ---- the church (костел): rows of pews down the nave, the altar under a crucifix, the organ, coloured windows,
# a statue of Our Lady with candles before her, a font by the door and the sacristy's cupboard
R = Inside("church_in", "Костел святого Миколая", "church_site", 14, 15, "floor.checker", "wall.cream", 5)
R.prop("altar", 6, 1)
R.prop("crucifix", 6, 0, wall="north")
R.prop("stained_glass", 3, 0, wall="north")
R.prop("stained_glass", 10, 0, wall="north")
for y in (3, 6, 9, 12):
    R.prop("stained_glass", 0, y, wall="west")
    R.prop("stained_glass", 13, y, wall="east")
# two blocks of pews either side of the aisle, facing the altar, a row's width apart
for y in (4, 6, 8, 10):
    for x in (2, 9):
        R.prop("pew", x, y)
R.prop("organ", 11, 1)
R.prop("madonna", 1, 1)
R.prop("candle_stand", 2, 1)
R.prop("candle_stand", 2, 2)
R.prop("wardrobe_tall", 13, 3)
R.prop("rug_long_runner", 6, 3)
R.prop("rug_long_runner", 7, 3)
R.prop("rug_long_runner", 6, 7)
R.prop("rug_long_runner", 7, 7)
R.keep((5, 8))
R.post((6, 3), (2, 5), (10, 5), (3, 7), (9, 9), (12, 6), (2, 11))
rooms.append(R)

# ---- the hostel: bunks with lockers, the reception, a common room with a sofa and a table, a kitchen corner with
# its kettle and fridge, maps of the world on the wall
R = Inside("hostel_in", "Хостел «Лелека»", "hostel_site", 16, 12, "floor.pine", "wall.stripe_blue", 7)
for x in (1, 3, 5, 7):
    R.prop("bunk_bed", x, 1)
R.prop("locker", 9, 0)
R.prop("locker", 10, 0)
R.partition(0, 4, 8, 4, gaps={(8, 4)})
R.prop("reception_desk", 11, 8)
R.prop("sofa3", 1, 9)
R.prop("coffee_table", 1, 7)
R.prop("armchair", 4, 7, rot=1)
R.prop("counter", 15, 1)
R.prop("counter_sink", 15, 2)
R.prop("fridge", 15, 3)
R.prop("stove", 15, 4)
R.prop("dining_table", 11, 3)
for x in (11, 13):
    R.prop("dining_chair_wood", x, 2)
    R.prop("dining_chair_wood", x, 5, rot=2)
R.prop("newspaper_rack", 0, 6)
R.prop("world_map", 0, 2, wall="west")
R.prop("poster", 6, 0, wall="north")
R.prop("window_wide", 15, 7, wall="east")
R.prop("monstera", 15, 10)
R.prop("floor_lamp", 0, 10)
R.post((12, 7), (2, 3), (4, 3), (6, 3), (2, 8), (12, 2), (10, 9))
rooms.append(R)

# ---- the bread factory: mills, mixers, two tunnel ovens, racks of loaves, sacks of flour, boxes going out, the
# foreman's desk behind glass
R = Inside("factory_in", "Хлібзавод «Колос»", "bread_factory_site", 18, 13, "floor.slate", "wall.brick", 7)
R.prop("flour_mill", 1, 1)
R.prop("flour_mill", 4, 1)
for x in (8, 9, 10, 11):
    R.prop("dough_mixer", x, 1)
R.prop("tunnel_oven", 1, 5)
R.prop("tunnel_oven", 1, 7)
R.prop("tunnel_oven", 5, 5)
R.prop("bread_shelf", 9, 5)
R.prop("bread_shelf", 11, 5)
R.prop("bread_shelf", 9, 7)
R.prop("bread_shelf", 11, 7)
for x, y in [(15, 1), (16, 1), (17, 1), (15, 2), (16, 2)]:
    R.prop("flour_sacks", x, y)
R.prop("stock_boxes", 1, 10)
R.prop("stock_boxes", 2, 10)
R.prop("stock_boxes", 1, 11)
R.partition(14, 6, 17, 6, gaps={(16, 6)})
R.partition(14, 7, 14, 9)
R.prop("desk", 15, 8)
R.prop("office_chair", 15, 7)
R.prop("filing_cabinet", 17, 8, rot=1)
R.prop("wall_clock", 7, 0, wall="north")
R.prop("window_wide", 17, 10, wall="east")
R.prop("mop_bucket", 13, 11)
R.post((3, 3), (7, 2), (5, 4), (5, 7), (11, 9), (14, 4), (9, 10), (16, 7))
rooms.append(R)

# ---- the wool-and-cheese factory: a loom, spinning wheels, bales of wool, yarn; vats, cheese ripening, milk cans;
# the shop's counter by the door with a cooler
R = Inside("creamery_in", "Міні-фабрика «Овечка»", "creamery_site", 15, 12, "floor.pine", "wall.panel_oak", 6)
R.prop("loom", 1, 1)
R.prop("loom", 1, 3)
R.prop("spinning_wheel", 4, 1)
R.prop("spinning_wheel", 5, 1)
for x, y in [(0, 6), (0, 7), (1, 7)]:
    R.prop("wool_bale", x, y)
R.prop("yarn_shelf", 2, 10)
R.partition(7, 0, 7, 4, gaps={(7, 2)})
R.prop("cheese_vat", 8, 1)
R.prop("cheese_vat", 8, 3)
R.prop("cheese_rack", 13, 1, rot=1)
R.prop("cheese_rack", 13, 4, rot=1)
R.prop("milk_can", 11, 0)
R.prop("milk_can", 12, 0)
R.prop("counter_sink", 10, 0)
R.prop("cash_counter", 9, 8)
R.prop("display_fridge", 12, 10)
R.prop("tapestry", 0, 3, wall="west")
R.prop("window_wide", 14, 8, wall="east")
R.post((10, 7), (3, 2), (5, 2), (9, 5), (4, 6), (12, 7))
rooms.append(R)

# ---- the newsroom: desks with typewriters, the editor's desk, the printing press, stacks of papers, a board of
# photographs and leads, a camera, a cooler and a sofa for the night before the paper goes out
R = Inside("newsroom_in", "Редакція «Липовий вісник»", "newsroom_site", 15, 12, "floor.oak", "wall.wainscot", 6)
for x, y in [(1, 2), (1, 5), (4, 2), (4, 5)]:
    R.prop("news_desk", x, y)
    R.prop("office_chair", x, y + 1 if y == 5 else y - 1, rot=2 if y == 5 else 0)
R.partition(8, 0, 8, 4, gaps={(8, 2)})
R.prop("desk_l", 11, 1)
R.prop("office_chair", 12, 3, rot=2)
R.prop("filing_cabinet", 13, 0)
R.prop("filing_cabinet", 14, 0)
R.prop("printing_press", 9, 7)
R.prop("newspaper_stack", 13, 7)
R.prop("newspaper_stack", 13, 8)
R.prop("newspaper_stack", 14, 8)
R.prop("camera_tripod", 9, 0)
R.prop("water_cooler", 0, 10)
R.prop("sofa2", 1, 9)
R.prop("photo_board", 1, 0, wall="north")
R.prop("photo_board", 4, 0, wall="north")
R.prop("wall_clock", 10, 0, wall="north")
R.prop("world_map", 0, 7, wall="west")
R.prop("window_wide", 14, 4, wall="east")
R.prop("fern", 14, 11)
R.post((12, 4), (3, 1), (6, 4), (7, 6), (8, 10), (3, 8))
rooms.append(R)

# ---- the town hall: the council's table, the mayor's office behind glass, flags, the village's map, portraits,
# the reception and a bench for those who come with a request
R = Inside("townhall_in", "Ратуша", "townhall_site", 18, 13, "floor.herring", "wall.cream", 7)
R.prop("council_table", 5, 3)
for x in (5, 6, 7):
    R.prop("dining_chair_wood", x, 2)
    R.prop("dining_chair_wood", x, 5, rot=2)
R.partition(12, 0, 12, 5, gaps={(12, 4)})
R.partition(13, 5, 17, 5)
R.prop("desk", 14, 2)
R.prop("office_chair", 14, 1)
R.prop("flag_stand", 13, 0)
R.prop("flag_stand", 17, 0)
R.prop("bookcase_tall", 17, 2)
R.prop("safe", 17, 4)
R.prop("filing_cabinet", 0, 1, rot=3)
R.prop("filing_cabinet", 0, 2, rot=3)
R.prop("reception_desk", 1, 9)
R.prop("waiting_bench", 12, 9)
R.prop("waiting_bench", 12, 11)
R.prop("water_cooler", 17, 7)
R.prop("newspaper_rack", 10, 7)
R.prop("world_map", 5, 0, wall="north")
R.prop("painting_tall", 3, 0, wall="north")
R.prop("painting_tall", 9, 0, wall="north")
R.prop("wall_clock", 0, 6, wall="west")
R.prop("window_tall", 17, 9, wall="east")
R.prop("fern", 17, 12)
R.prop("fern", 0, 12)
R.post((15, 3), (2, 8), (4, 4), (9, 4), (14, 8), (8, 10))
rooms.append(R)

# ---- the radio studio: the desk with its microphones behind glass, the ON AIR lamp, shelves of records, the
# transmitter cabinet, a sofa for guests waiting their turn
R = Inside("radio_in", "Радіо «Липове FM»", "radio_site", 13, 10, "floor.carpet_moss", "wall.charcoal", 5)
R.prop("mixing_desk", 3, 2)
R.prop("mic_stand", 3, 3)
R.prop("mic_stand", 4, 3)
R.prop("office_chair", 3, 4, rot=2)
R.prop("on_air", 3, 0, wall="north")
R.partition(0, 5, 7, 5, gaps={(6, 5)})
R.partition(7, 0, 7, 4)
R.prop("record_shelf", 9, 0)
R.prop("record_shelf", 11, 0)
R.prop("record_shelf", 0, 7, rot=3)
R.prop("filing_cabinet", 12, 4, rot=1)
R.prop("locker", 12, 5)
R.prop("sofa2", 8, 8, rot=2)
R.prop("water_cooler", 12, 9)
R.prop("poster", 9, 0, wall="north")
R.prop("record_player", 1, 1)
R.post((4, 4), (5, 2), (10, 2), (10, 6), (2, 6))
rooms.append(R)

locations += [r.build() for r in rooms]

# =============================================================================================================
# The cellar under the bar «Жабка»: barrels, bottles, crates in the dark; one of its brick walls gave way long
# ago, and through the gap there is a little cave nobody knows of, with an old computer someone hid there, its
# screen still glowing green; on it, a game. Up the ladder is the bar again.
# =============================================================================================================
CEL = Map("bar_cellar", "Льох під баром", 18, 12, ".", {".": "void", "a": "floor.slate", "k": "floor.cave"})
CEL.paint(1, 1, 8, 9, "a")
CEL.paint(9, 5, 10, 6, "k")
CEL.ellipse(14, 6, 3.6, 4.4, "k")
CEL.prop("cellar_ladder", 1, 1)
CEL.exits.append({"x": 2, "y": 1, "w": 1, "h": 1, "to": "bar_in", "at": [13, 9], "name": "Нагору, в бар"})
CEL.reserve(1, 1, 3, 3)
for x in range(4, 9):
    CEL.prop("wine_barrel", x, 1)
CEL.prop("bottle_shelf", 1, 5, rot=1)
CEL.prop("veg_crate", 1, 8)
CEL.prop("veg_crate", 2, 9)
CEL.prop("wine_barrel", 6, 9)
CEL.prop("wine_barrel", 7, 9)
CEL.prop("mine_lantern", 4, 4)
CEL.prop("cobweb", 8, 2)
CEL.prop("cobweb", 1, 7, must=False)
# the broken wall
CEL.prop("brick_rubble", 8, 4)
CEL.prop("brick_rubble", 8, 7)
CEL.prop("brick_rubble", 11, 7, must=False)
# the hiding place
CEL.prop("secret_pc", 13, 2)
CEL.prop("old_armchair", 13, 3, rot=2)
CEL.prop("floppy_crate", 16, 4)
CEL.prop("cobweb", 12, 3, must=False)
CEL.prop("candle_stand", 16, 8, must=False)
CEL.prop("glow_mushroom", 12, 9, must=False)
CEL.prop("crystal", 17, 6, must=False)
CEL.place("hiding_place", "Схованка", 12, 4, 4, 3, "walk")
cellar = CEL.build()
cellar["underground"] = True
cellar["wall"] = "wall.rock"
locations.append(cellar)
