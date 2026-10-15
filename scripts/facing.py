# Every thing has a front, two sides and a back, so that turned in the editor one can tell which way it faces.
# A model's front is its +y side (the side a seat faces, the side one stands at to use a thing); its back is y=0.
#   front: doors and drawers that stand proud of the carcass, handles, knobs, screens, goods on shelf edges with
#          price strips, the recessed toe-kick under kitchen units;
#   sides: plain panels with what shows in profile (the doors' edges, hinge knuckles, vents on machines);
#   back:  bare hardboard in a frame of the carcass, the maker's label, wall brackets on tall pieces, cables and
#          coils on machines.
# Run inside gen_base_content.py twice: once after the home catalogue (before the worn copies are made from it,
# so they inherit their fronts and backs), and once at the end for everything added after that.
# Details flush with a face are listed after the part they sit on: the renderer lets later parts win ties.

FACED = set()

HARDBOARD = slot("earth", 3)
HARDBOARD_METAL = slot("stone", 1)
LABEL = slot("ceramic", 0)
CABLE = slot("metal", 2)
VENT = slot("metal", 2)
HINGE = slot("metal", 0)
PRICE = slot("pastel", 3)


def _parts(it, slot_name):
    return [m for m in it["model"] if m["slot"] == slot_name]


def _add(it, parts, **slots):
    it["model"] = it["model"] + parts
    for k, v in slots.items():
        it["slots"].setdefault(k, v)


def hardboard(x, z, w, h, y=0, s="back"):
    """A thin back panel flush with a back face at y, with the maker's label in its upper corner."""
    out = [b(x, y, z, w, 1, h, s)]
    if w >= 40 and h >= 30:
        out.append(b(x + 6, y, z + h - 18, 14, 1, 10, "label"))
    return out


def brackets(x0, x1, z, y=0):
    """Two little brackets that hold a tall piece to the wall."""
    return [b(x0, y, z, 8, 2, 6, "hinge"), b(x1 - 8, y, z, 8, 2, 6, "hinge")]


def cable(x, z, y=0, run=24):
    """A cable from a socket on the back down to the floor and along it to the plug (run < 0 goes left)."""
    x0 = x if run >= 0 else x + run
    plug = x + run if run >= 0 else x + run - 6
    return [b(x, y, 2, 3, 2, max(2, z - 2), "cable"), b(x0, y, 0, abs(run) + 3, 3, 2, "cable"), b(plug, y, 0, 6, 4, 4, "cable")]


def vents_back(x, z, w, n, y=0):
    return [b(x, y, z + i * 6, w, 1, 2, "vent") for i in range(n)]


def vents_side(xface, y, z, d, n):
    """Slats on a side face; xface is the x of that face (its left edge or its right edge)."""
    return [b(xface, y, z + i * 6, 1, d, 2, "vent") for i in range(n)]


def side_hinges(x_left, x_right, y, zs):
    """Hinge knuckles at the front edge of both sides (x_left and x_right are the faces of the carcass): in
    profile they show where the doors open from."""
    return [b(x, y, z, 1, 4, 8, "hinge") for x in (x_left, x_right - 1) for z in zs]


def back_slab(it):
    """The broad box at the back of a case piece: the one its back panel goes on."""
    W = it["footprint"]["w"] * 100
    cands = [m for m in it["model"] if m["box"][3] >= W * 0.6 and m["box"][5] >= 30 and m.get("shape") in (None, "box", "round") and m["box"][1] <= 30]
    if not cands:
        return None
    return min(cands, key=lambda m: (m["box"][1], -m["box"][3] * m["box"][5]))["box"]


def generic_back(it, metal=False):
    box = back_slab(it)
    if not box:
        return False
    bx, by, bz, bw, bd, bh = box
    parts = hardboard(bx + 6, bz + 6, bw - 12, bh - 12, by)
    if bh >= 120:
        parts += brackets(bx + 10, bx + bw - 10, bz + bh - 10, by)
    _add(it, parts, back=HARDBOARD_METAL if metal else HARDBOARD, label=LABEL, hinge=HINGE)
    return True


def protrude(it, slot_name, y0, depth, handle_slots=()):
    """Doors and drawer fronts made to stand proud of the carcass, from y0 (just inside its front face) `depth`
    deep, with their handles on them: from the side one sees their edges."""
    D = it["footprint"]["d"] * 100
    for m in _parts(it, slot_name):
        m["box"][1] = y0
        m["box"][4] = depth
    for hs in handle_slots:
        for m in _parts(it, hs):
            if m["box"][1] >= y0 - 6:
                m["box"][1] = y0 + depth
                m["box"][4] = max(1, min(3, D - y0 - depth))


def flip_y(it):
    """Turns a model modelled facing -y round to face +y like everything else."""
    D = it["footprint"]["d"] * 100
    for m in it["model"]:
        m["box"][1] = D - (m["box"][1] + m["box"][4])


# ---- the home ------------------------------------------------------------------------------------------------

def f_wardrobe(it):
    protrude(it, "door", 93, 4, ("trim",))
    for m in it["model"]:
        if m["box"][:3] == [4, 4, 0]:
            m["box"][4] = 80  # the toe-kick: the base stands back under the doors
    _add(it, side_hinges(0, 200, 90, (26, 120)), hinge=HINGE)
    generic_back(it)


def f_wardrobe_tall(it):
    protrude(it, "door", 91, 4, ("trim",))
    for m in it["model"]:
        if m["box"][:3] == [6, 6, 0]:
            m["box"][4] = 76
    _add(it, side_hinges(2, 98, 88, (24, 120)), hinge=HINGE)
    generic_back(it)


def f_drawers(it):
    """Dressers and chests of drawers: proud drawer fronts with their pulls; plain sides; hardboard back."""
    protrude(it, "front", 91 if it["id"] == "dresser" else 87, 4, ("trim",))
    generic_back(it)


def f_nightstand(it):
    protrude(it, "front", 91, 4, ("trim",))
    generic_back(it)


def f_cabinet_glass(it):
    # see-through glass: the plates and cups inside, on two shelves
    for m in _parts(it, "glass"):
        m["slot"] = "pane"
    it["slots"]["pane"] = it["slots"].pop("glass")
    inside = [b(10, 14, 54, 80, 70, 3, "wood"), b(10, 14, 96, 80, 70, 3, "wood")]
    for z in (18, 57, 99):
        inside += [b(16 + k * 22, 30, z, 16, 16, 18 if z != 57 else 14, ("cup", "plate")[(k + z) % 2], "cyl") for k in range(3)]
    it["model"] = [m for m in it["model"] if m["slot"] != "pane"] + inside + [m for m in it["model"] if m["slot"] == "pane"]
    _add(it, [b(12, 86, 18, 76, 3, 4, "wood"), b(12, 86, 126, 76, 3, 4, "wood")], cup=slot("ceramic", 0), plate=slot("ceramic", 2))
    # the body was solid behind the glass: hollow it to a shell (back, sides, base and top)
    for m in it["model"]:
        if m["box"] == [5, 10, 8, 90, 80, 132]:
            m["box"] = [5, 10, 8, 90, 6, 132]
    _add(it, [b(5, 16, 8, 6, 72, 132, "wood"), b(89, 16, 8, 6, 72, 132, "wood"), b(11, 16, 8, 78, 72, 10, "wood")])
    _add(it, hardboard(11, 14, 78, 120, 10), back=HARDBOARD, label=LABEL)


def f_tv_stand(it):
    protrude(it, "front", 89, 4, ("trim",))
    # an open middle shelf with a games console and its cable out at the back
    generic_back(it)
    _add(it, cable(150, 30, 10, 30), cable=CABLE)


def f_media_console(it):
    protrude(it, "front", 89, 4)
    _add(it, [b(40 + k * 96, 93, 26, 16, 3, 3, "legs") for k in range(3)])
    generic_back(it)
    _add(it, cable(240, 30, 10, 30), cable=CABLE)


def f_bookshelf(it):
    # the back is a bare board: a hardboard panel on it and two brackets to the wall
    _add(it, hardboard(14, 14, 172, 120, 0) + brackets(14, 186, 126, 0), back=HARDBOARD, label=LABEL, hinge=HINGE)
    # the front edge of each shelf banded in a lighter strip
    _add(it, [b(8, 96, z, 184, 4, 4, "top") for z in (50, 96)], top=slot("wood", 3))


def f_bookcase_tall(it):
    _add(it, hardboard(10, 10, 80, 164, 0) + brackets(10, 90, 166, 0), back=HARDBOARD, label=LABEL, hinge=HINGE)
    _add(it, [b(6, 96, z, 88, 4, 4, "top") for z in (46, 92, 138)], top=slot("wood", 3))


def f_desk(it):
    # a pedestal of drawers on the left, a panel and a cable tray at the back, a pencil drawer at the front
    protrude(it, "front", 93, 4, ("metal",))
    _add(it, hardboard(10, 8, 50, 38, 6) + [b(80, 60, 40, 90, 38, 10, "front"), b(118, 98, 43, 14, 2, 3, "metal")]
         + [b(70, 12, 30, 100, 10, 4, "cable"), b(120, 12, 2, 3, 2, 28, "cable"), b(120, 12, 0, 30, 3, 2, "cable")],
         back=HARDBOARD, label=LABEL, cable=CABLE)


def f_counter(it):
    """Kitchen units: a proud door with its pull, a toe-kick under it, a hardboard back with the pipes."""
    protrude(it, "front", 93, 4, ("trim",))
    for m in it["model"]:
        if m["slot"] == "plinth":
            m["box"][4] = 76
    parts = hardboard(6, 14, 88, 40, 0)
    if it["id"] == "counter_sink":
        parts += [b(30, 0, 0, 6, 4, 40, "tap", "cyl"), b(60, 0, 0, 6, 4, 34, "tap", "cyl"), b(28, 0, 30, 40, 4, 6, "tap")]
    _add(it, parts, back=HARDBOARD, label=LABEL)


def f_kitchen_island(it):
    # one side works (doors and drawers), the other is for sitting at: a panelled face and a footrest
    _add(it, [b(40, 99, 40, 20, 1, 3, "handle"), b(140, 99, 40, 20, 1, 3, "handle"), b(8, 99, 50, 184, 1, 6, "handle")]
         + [b(8 + k * 48, 0, 14, 40, 1, 40, "back") for k in range(4)] + [b(4, 0, 12, 192, 4, 4, "handle")],
         handle=slot("metal", 0), back=slot("fabric", 0))


def f_stove(it):
    _add(it, [
        # the oven door's bar handle, the knobs on the panel, the drawer for the trays under the door
        b(14, 94, 40, 72, 4, 4, "handle"),
        b(18, 96, 47, 7, 3, 6, "knob", "cyl"), b(32, 96, 47, 7, 3, 6, "knob", "cyl"), b(61, 96, 47, 7, 3, 6, "knob", "cyl"), b(75, 96, 47, 7, 3, 6, "knob", "cyl"),
        # a raised back guard on the hob: from above it says where the back is
        b(0, 0, 62, 100, 8, 14, "top"),
        # the back: a vent at the top, the gas pipe and the cable
        b(46, 0, 0, 6, 4, 30, "pipe", "cyl"),
    ] + vents_back(14, 44, 72, 2) + cable(76, 24, 0, -40) + vents_side(0, 20, 44, 50, 2) + vents_side(99, 20, 44, 50, 2),
        handle=slot("metal", 0), knob=slot("metal", 2), pipe=slot("metal", 1), vent=VENT, cable=CABLE)


def f_fridge(it):
    protrude(it, "door", 95, 3, ("trim",))
    _add(it, [
        # a badge on the upper door, rubber seals showing at the edges of the doors
        b(16, 98, 152, 18, 1, 6, "trim"),
        # the back: the black condenser coil over most of it, the compressor in a box at the bottom, the cable
        b(10, 4, 40, 80, 1, 112, "coil"),
    ] + [b(12, 3, 44 + k * 10, 76, 1, 3, "back") for k in range(11)] + [b(12 + k * 18, 3, 44, 2, 1, 104, "back") for k in range(5)]
        + [b(14, 4, 4, 72, 10, 30, "back"), b(20, 4, 10, 30, 1, 18, "coil")] + cable(70, 24, 4, 20)
        + side_hinges(2, 98, 92, (8, 160)),
        coil=slot("metal", 2), back=slot("metal", 2), cable=CABLE, hinge=HINGE)


def f_washing_machine(it):
    _add(it, [
        b(14, 95, 73, 20, 2, 6, "panel"), b(62, 96, 72, 8, 3, 8, "knob", "cyl"), b(76, 96, 72, 8, 3, 8, "knob", "cyl"),
        b(62, 96, 30, 6, 3, 14, "knob"),
        # the back: a removable panel with four transport bolts, the hoses and the cable
        b(12, 4, 12, 76, 1, 64, "back"),
    ] + [b(x, 3, z, 6, 1, 6, "knob", "cyl") for x in (18, 76) for z in (16, 66)]
        + [b(30, 2, 60, 8, 3, 8, "hose", "cyl"), b(30, 2, 0, 8, 3, 60, "hose"), b(54, 2, 0, 8, 3, 72, "hose2")] + cable(80, 40, 2, -20),
        knob=slot("metal", 0), back=HARDBOARD_METAL, hose=slot("metal", 2), hose2=slot("ceramic", 2), cable=CABLE)


def f_tv(it):
    # the set's back is a ventilated bulge with the cables coming out of it
    _add(it, [b(18, 34, 24, 64, 10, 40, "frame", "round")] + vents_back(28, 40, 44, 3, 34)
         + [b(48, 36, 4, 4, 4, 22, "cable"), b(48, 30, 0, 4, 10, 2, "cable"), b(80, 56, 20, 4, 1, 2, "glow")],
         cable=CABLE, vent=VENT, glow=slot("leaf", 1))


def f_computer(it):
    _add(it, [b(20, 42, 22, 60, 8, 34, "body", "round")] + vents_back(30, 34, 40, 3, 42) + [b(48, 44, 2, 4, 4, 20, "cable"), b(48, 36, 0, 4, 10, 2, "cable")],
         cable=CABLE, vent=VENT)


def f_radio(it):
    _add(it, hardboard(18, 6, 64, 24, 28) + [b(24, 26, 0, 3, 2, 10, "cable"), b(24, 14, 0, 3, 12, 2, "cable")] + [b(30, 68, 30, 40, 1, 2, "grill")],
         back=HARDBOARD, label=LABEL, cable=CABLE)


def f_microwave(it):
    _add(it, [b(66, 80, 8, 3, 1, 20, "handle"), b(72, 80, 24, 8, 1, 3, "knob"), b(72, 80, 14, 8, 1, 6, "knob", "cyl")]
         + vents_back(20, 8, 60, 3, 30) + vents_side(8, 40, 14, 30, 3) + cable(70, 14, 30, -30),
         handle=slot("metal", 0), knob=slot("metal", 2), vent=VENT, cable=CABLE)


def f_piano(it):
    # the back of an upright: two braced panels (there already) and the maker's label on the soundboard
    _add(it, [b(20, 0, 70, 20, 1, 12, "label"), b(4, 0, 10, 4, 2, 90, "body"), b(98, 0, 10, 4, 2, 90, "body"), b(192, 0, 10, 4, 2, 90, "body")], label=LABEL)


def f_filing_cabinet(it):
    protrude(it, "front", 93, 4, ("trim",))
    _add(it, [b(44, 97, 30 + i * 30, 12, 2, 4, "label") for i in range(3)], label=LABEL)
    generic_back(it, metal=True)


def f_chest(it):
    # the lid's hinges at the back, the lock and handles at the front and sides
    _add(it, [b(22, 13, 36, 10, 2, 8, "trim"), b(68, 13, 36, 10, 2, 8, "trim"), b(3, 40, 20, 3, 20, 6, "trim"), b(94, 40, 20, 3, 20, 6, "trim")])


def f_game_shelf(it):
    open_shelf(it, 8, 92, 30, 70, 120, (), "wood")


def f_washbasin(it):
    _add(it, [b(42, 6, 0, 4, 4, 60, "tap", "cyl"), b(54, 6, 0, 4, 4, 60, "tap", "cyl"), b(30, 76, 64, 40, 2, 6, "body")])


def f_aquarium(it):
    _add(it, [b(10, 98, 6, 180, 2, 22, "stand"), b(20, 99, 14, 30, 1, 6, "label"), b(150, 2, 34, 30, 10, 26, "filter"), b(160, 0, 0, 4, 4, 34, "cable")],
         label=LABEL, filter=slot("metal", 2), cable=CABLE)


# ---- shops and public rooms -----------------------------------------------------------------------------------

def f_cash_counter(it):
    """The till: the customer's side has a panelled front, a rack of sweets and the card reader; the cashier's
    side is open, with a cash drawer under the till, bags and rolls of receipt paper on a shelf."""
    _add(it, [
        # customer side
        b(10, 98, 70, 180, 2, 6, "top"), b(130, 98, 20, 50, 2, 40, "rack"),
        b(134, 96, 26, 42, 4, 8, "sweet1"), b(134, 96, 38, 42, 4, 8, "sweet2"), b(134, 96, 50, 42, 4, 8, "sweet1"),
        b(96, 70, 86, 14, 10, 12, "screen"), b(24, 96, 74, 50, 4, 4, "mat"),
        # cashier's side: the cash drawer, an open shelf with bags and paper rolls, the cashier's screen
        b(120, 18, 60, 50, 4, 14, "till"), b(140, 16, 64, 10, 2, 4, "screen"),
        b(10, 18, 8, 100, 2, 46, "shelf"), b(14, 16, 30, 90, 4, 3, "top"),
        b(20, 15, 34, 30, 5, 16, "bags"), b(60, 15, 34, 12, 5, 12, "roll", "cyl"), b(76, 15, 34, 12, 5, 12, "roll", "cyl"),
        b(20, 15, 10, 60, 5, 16, "bags"),
    ], rack=slot("metal", 2), sweet1=slot("fabric", 1), sweet2=slot("fabric", 2), shelf=slot("wood", 2), bags=slot("ceramic", 1), roll=slot("ceramic", 0))


def f_shop_shelf(it):
    # price strips along the front edge of every shelf; the back is a pegboard panel
    _add(it, [b(8, 96, z, 184, 4, 6, "price") for z in (8, 53, 98)] + [b(12, 0, 14, 176, 1, 128, "back")]
         + [b(22 + i * 22, 0, 24 + j * 22, 4, 1, 4, "label") for i in range(8) for j in range(5)],
         price=PRICE, back=HARDBOARD_METAL, label=slot("metal", 2))


def f_display_fridge(it):
    # glass doors one sees the drinks through, a lit sign on top, a grille at the bottom; the back is the
    # condenser and its cable
    for m in _parts(it, "glass"):
        m["slot"] = "pane"
    it["slots"]["pane"] = it["slots"].pop("glass")
    for m in it["model"]:
        if m["box"] == [0, 10, 0, 200, 90, 170]:
            m["box"] = [0, 10, 0, 200, 10, 170]  # a shell, so the bottles show
    shell = [b(0, 20, 0, 8, 80, 170, "body"), b(192, 20, 0, 8, 80, 170, "body"), b(8, 20, 0, 184, 80, 12, "body"), b(8, 20, 160, 184, 80, 10, "body"),
             b(98, 20, 10, 4, 80, 150, "body")] + [b(8, 20, z, 184, 76, 3, "shelfw") for z in (17, 65, 113)]
    panes = [m for m in it["model"] if m["slot"] == "pane"]
    rest = [m for m in it["model"] if m["slot"] != "pane"]
    it["model"] = rest + shell + panes
    _add(it, [b(10, 96, 2, 180, 4, 8, "vent"), b(102, 98, 60, 4, 2, 40, "handle")]
         + vents_back(20, 20, 160, 10, 10) + cable(170, 20, 10, 20),
         shelfw=slot("metal", 0), vent=VENT, handle=slot("metal", 0), cable=CABLE)


def f_bread_shelf(it):
    _add(it, [b(8, 90, z, 184, 4, 6, "price") for z in (8, 50, 92)] + hardboard(14, 14, 172, 116, 0), price=PRICE, back=HARDBOARD, label=LABEL)


def f_bread_oven(it):
    # the baker's side: an iron door with its latch, a peel leaning by it; the back is the brick dome and the flue
    _add(it, [b(20, 0, 20, 160, 2, 70, "brick2")] + [b(20, 0, 30 + k * 16, 160, 2, 2, "ash") for k in range(4)] + [b(150, 0, 0, 30, 4, 20, "ash")],
         brick2=slot("pot", 1), ash=slot("stone", 3))


def f_bar_counter(it):
    """The bar: the guests' side has a brass foot rail; the barman's side, under the top, glasses on a shelf, the
    ice well and the bottles in the speed rail."""
    _add(it, [
        b(10, 94, 14, 280, 4, 4, "rail", "cyl"), b(30, 94, 0, 4, 4, 18, "rail"), b(150, 94, 0, 4, 4, 18, "rail"), b(266, 94, 0, 4, 4, 18, "rail"),
        b(0, 18, 50, 300, 2, 4, "shelfw"),
    ] + [b(14 + k * 24, 15, 54, 14, 5, 18, "glass2", "cyl") for k in range(12)]
        + [b(14 + k * 24, 15, 20, 14, 5, 26, ("b1", "b2", "b3")[k % 3], "cyl") for k in range(12)]
        + [b(150, 14, 84, 120, 6, 16, "steel")],
        rail=slot("metal", 1), shelfw=slot("wood", 2), glass2=slot("glass", 2), b1=slot("leaf", 0), b2=slot("autumn", 1), b3=slot("glass", 3), steel=slot("metal", 0))


def open_shelf(it, x0, x1, y0, y1, top, boards, case_slot="frame"):
    """Turns a solid block of shelving into an open case (a back, two sides, a top, a base and the boards), so
    what was put on its shelves shows; its back gets a hardboard panel."""
    goods = [m for m in it["model"] if m["slot"] != case_slot]
    d = y1 - y0
    frame = [b(x0, y0, 0, x1 - x0, 4, top, case_slot), b(x0, y0 + 4, 0, 6, d - 4, top, case_slot), b(x1 - 6, y0 + 4, 0, 6, d - 4, top, case_slot),
             b(x0, y0, top - 6, x1 - x0, d, 6, case_slot), b(x0 + 6, y0 + 4, 0, x1 - x0 - 12, d - 4, 4, case_slot)]
    frame += [b(x0 + 6, y0 + 4, z, x1 - x0 - 12, d - 4, 4, case_slot) for z in boards]
    it["model"] = frame + goods
    _add(it, hardboard(x0 + 6, 10, x1 - x0 - 12, top - 22, y0), back=HARDBOARD, label=LABEL)


def f_bottle_shelf(it):
    open_shelf(it, 0, 200, 0, 40, 180, (40, 90, 140))
    _add(it, [b(6, 36, z, 188, 4, 3, "frame") for z in (44, 94, 144)])


def f_record_shelf(it):
    open_shelf(it, 0, 200, 0, 40, 160, (40, 90), "wood")


def f_yarn_shelf(it):
    open_shelf(it, 0, 200, 0, 40, 160, (40, 90, 140), "wood")


def f_cheese_rack(it):
    # cheeses ripen on open slatted boards: open the block, keep the boards
    it["model"] = [m for m in it["model"] if m["box"] != [0, 10, 0, 200, 60, 160]]
    _add(it, [b(0, 10, 0, 6, 60, 160, "wood"), b(194, 10, 0, 6, 60, 160, "wood"), b(0, 10, 154, 200, 60, 6, "wood"), b(6, 10, 0, 188, 4, 154, "wood")]
         + [b(6, 66, 30 + k * 50, 188, 4, 6, "price") for k in range(3)], price=slot("ceramic", 1))


def f_reception_desk(it):
    # the visitors' side (+y): the glass panel and the raised ledge they lean on; the staff's side: a low working
    # top with the screen turned to them, pedestals of drawers, a keyboard and papers
    for m in it["model"]:
        if m["box"] == [0, 20, 76, 300, 10, 30]:
            m["box"] = [0, 86, 76, 300, 10, 30]
    _add(it, [b(10, 28, 8, 60, 2, 56, "drawer"), b(30, 26, 20, 20, 2, 3, "handle"), b(30, 26, 40, 20, 2, 3, "handle"),
              b(240, 28, 8, 50, 2, 56, "drawer"), b(260, 26, 30, 20, 2, 3, "handle"), b(48, 34, 76, 30, 10, 2, "keys"), b(110, 40, 76, 40, 28, 3, "papers")],
         drawer=slot("ceramic", 0), handle=slot("metal", 0), keys=slot("metal", 2), papers=slot("ceramic", 0))


def f_bill_counter(it):
    # the clerk sits behind the glass (y=0 side): a drawer for cash, a ledger; the customers' side is the panel
    _add(it, [b(20, 28, 10, 60, 2, 50, "drawer"), b(40, 26, 30, 20, 2, 3, "slot"), b(110, 32, 120, 40, 2, 14, "sign")],
         drawer=slot("ceramic", 1), sign=slot("ceramic", 0))


def f_parcel_shelf(it):
    _add(it, hardboard(14, 14, 172, 136, 0) + [b(8, 96, z, 184, 4, 4, "tape") for z in (10, 60, 110)], back=HARDBOARD, label=LABEL)


def f_locker(it):
    protrude(it, "door", 95, 3, ("knob",))
    _add(it, [b(14 + i * 42, 98, 120, 14, 1, 8, "label") for i in range(2)] + side_hinges(6, 94, 94, (24, 130)), label=LABEL, hinge=HINGE)
    generic_back(it, metal=True)


def f_medical_cabinet(it):
    for m in _parts(it, "glass"):
        m["slot"] = "pane"
    it["slots"]["pane"] = it["slots"].pop("glass")
    for m in it["model"]:
        if m["box"] == [10, 20, 0, 80, 60, 130]:
            m["box"] = [10, 20, 0, 80, 8, 130]
    panes = [m for m in it["model"] if m["slot"] == "pane"]
    rest = [m for m in it["model"] if m["slot"] != "pane"]
    it["model"] = rest + [b(10, 28, 0, 6, 52, 130, "body"), b(84, 28, 0, 6, 52, 130, "body"), b(16, 28, 0, 68, 52, 10, "body"), b(16, 28, 124, 68, 52, 6, "body"),
                          b(20, 50, 12, 14, 14, 18, "bottle2", "cyl"), b(50, 46, 12, 24, 20, 14, "box")] + panes
    _add(it, [b(46, 82, 60, 4, 2, 14, "handle"), b(54, 82, 60, 4, 2, 14, "handle")] + hardboard(16, 10, 68, 110, 20),
         box=slot("ceramic", 1), handle=slot("metal", 0), back=HARDBOARD_METAL, label=LABEL)


def f_jukebox(it):
    _add(it, [b(30, 88, 64, 40, 2, 4, "slotc"), b(20, 88, 10, 60, 2, 6, "grill")] + vents_back(24, 20, 52, 6, 30) + cable(60, 20, 30, 20),
         slotc=slot("metal", 0), vent=VENT, cable=CABLE)


def f_pc_desk(it):
    _add(it, [b(60, 10, 96, 80, 8, 40, "body", "round")] + vents_back(70, 104, 60, 3, 10) + [b(100, 12, 70, 4, 4, 30, "cable"), b(170, 8, 4, 3, 2, 50, "cable")]
         + [b(166, 80, 40, 22, 1, 4, "keys"), b(176, 80, 10, 6, 1, 6, "glow")], cable=CABLE, vent=VENT, glow=slot("leaf", 1))


def f_shoe_shelf(it):
    open_shelf(it, 10, 90, 30, 70, 100, (), "body")
    _add(it, [b(16, 36, 4, 30, 24, 12, "s2"), b(52, 36, 4, 30, 24, 12, "s3"), b(14, 66, 30, 72, 4, 4, "shelf"), b(14, 66, 64, 72, 4, 4, "shelf")])


def f_donut_display(it):
    for m in _parts(it, "glass"):
        m["slot"] = "pane"
    it["slots"]["pane"] = it["slots"].pop("glass")
    panes = [m for m in it["model"] if m["slot"] == "pane"]
    rest = [m for m in it["model"] if m["slot"] != "pane"]
    it["model"] = rest + [b(10, 20, 94, 180, 60, 3, "top")] + panes
    # the server's side: sliding doors and tongs; the customers' side: a price card
    _add(it, [b(14, 18, 74, 80, 2, 44, "frame2"), b(106, 18, 74, 80, 2, 44, "frame2"), b(60, 18, 20, 80, 2, 40, "frame2"), b(90, 80, 40, 30, 1, 14, "label")],
         frame2=slot("metal", 0), label=LABEL)


def f_cinema_ticket_booth(it):
    _add(it, [b(30, 90, 20, 140, 1, 60, "panel2"), b(80, 18, 20, 40, 2, 50, "drawer"), b(140, 18, 30, 30, 2, 40, "drawer")],
         panel2=slot("autumn", 3), drawer=slot("wood", 2))


def f_popcorn_cart(it):
    _add(it, [b(40, 80, 30, 20, 1, 10, "label"), b(10, 20, 30, 10, 4, 4, "handlebar"), b(10, 24, 30, 4, 52, 4, "handlebar")],
         label=LABEL, handlebar=slot("metal", 0))


def f_tool_chest(it):
    # it was modelled with its drawers to -y, so it stood with them to the wall: turned round, and a push handle
    # on its side and casters under it
    flip_y(it)
    _add(it, hardboard(20, 8, 60, 56, 24) + [b(2, 40, 50, 12, 4, 4, "handle"), b(2, 40, 50, 4, 24, 4, "handle"), b(2, 60, 50, 12, 4, 4, "handle")]
         + [b(x, y, 0, 8, 8, 6, "handle", "cyl") for x in (16, 76) for y in (26, 66)],
         back=HARDBOARD_METAL, label=LABEL, handle=slot("metal", 0))


def f_queue_machine(it):
    _add(it, [b(34, 26, 100, 32, 1, 30, "label")] + [b(48, 34, 2, 3, 2, 88, "cable")], label=slot("ceramic", 1), cable=CABLE)


def f_salon_sink(it):
    # the client sits facing away, head back into the bowl: a neck rest on the front edge, the tap at the back
    for m in _parts(it, "tap"):
        m["box"][1] = 34
    _add(it, [b(36, 86, 70, 28, 6, 8, "rest", "round"), b(30, 36, 0, 4, 4, 70, "tap", "cyl"), b(66, 36, 0, 4, 4, 70, "tap", "cyl")], rest=slot("metal", 2))


FACES = {
    "wardrobe": f_wardrobe, "wardrobe_tall": f_wardrobe_tall, "dresser": f_drawers, "chest_drawers": f_drawers, "nightstand": f_nightstand,
    "cabinet_glass": f_cabinet_glass, "tv_stand": f_tv_stand, "media_console": f_media_console, "bookshelf": f_bookshelf, "bookcase_tall": f_bookcase_tall,
    "desk": f_desk, "counter": f_counter, "counter_sink": f_counter, "counter_drawers": f_counter, "kitchen_island": f_kitchen_island,
    "stove": f_stove, "fridge": f_fridge, "washing_machine": f_washing_machine, "tv": f_tv, "computer": f_computer, "radio": f_radio,
    "microwave": f_microwave, "piano": f_piano, "filing_cabinet": f_filing_cabinet, "chest": f_chest, "game_shelf": f_game_shelf,
    "washbasin": f_washbasin, "aquarium": f_aquarium,
    "cash_counter": f_cash_counter, "shop_shelf": f_shop_shelf, "display_fridge": f_display_fridge, "bread_shelf": f_bread_shelf,
    "bread_oven": f_bread_oven, "bar_counter": f_bar_counter, "bottle_shelf": f_bottle_shelf, "record_shelf": f_record_shelf,
    "yarn_shelf": f_yarn_shelf, "cheese_rack": f_cheese_rack, "reception_desk": f_reception_desk, "bill_counter": f_bill_counter,
    "parcel_shelf": f_parcel_shelf, "locker": f_locker, "medical_cabinet": f_medical_cabinet, "jukebox": f_jukebox, "pc_desk": f_pc_desk,
    "shoe_shelf": f_shoe_shelf, "donut_display": f_donut_display, "cinema_ticket_booth": f_cinema_ticket_booth, "popcorn_cart": f_popcorn_cart,
    "tool_chest": f_tool_chest, "queue_machine": f_queue_machine, "salon_sink": f_salon_sink,
}

# case furniture without a model of its own here still gets a hardboard back
GENERIC_BACK = {"storage", "kitchen", "office", "bath", "kids", "decor"}
NO_BACK = {"ladder_shelf", "toy_box", "chest", "home_workbench", "aquarium", "easel", "dollhouse", "bird_cage", "bust", "gramophone", "bandstand",
           "record_crate", "vase_tall", "cat_bed", "toilet", "bathtub", "shower", "laundry_basket", "guitar", "accordion", "violin", "bandura"}


def _ground(it):
    """The extent one bumps into (what stands lower than a head, app/src/world.ts), as x0, y0, x1, y1."""
    low = [m["box"] for m in it["model"] if m["box"][2] < 50]
    if not low:
        return None
    return (min(b[0] for b in low), min(b[1] for b in low), max(b[0] + b[3] for b in low), max(b[1] + b[4] for b in low))


def _keep_ground(it, was):
    """Things set out at home keep the ground they stood on: new handles and fronts may not make them any bigger
    to walk round (a gap one squeezed through stays open)."""
    if not was:
        return
    x0, y0, x1, y1 = was
    out = []
    for m in it["model"]:
        x, y, z, w, d, h = m["box"]
        if z < 50:
            nx0, ny0, nx1, ny1 = max(x, x0), max(y, y0), min(x + w, x1), min(y + d, y1)
            if nx1 <= nx0 or ny1 <= ny0:
                continue
            m["box"] = [nx0, ny0, z, nx1 - nx0, ny1 - ny0, h]
        out.append(m)
    it["model"] = out


def face_items():
    for it in items:
        if it["id"] in FACED or it["id"].startswith("worn_"):
            continue
        FACED.add(it["id"])
        was = _ground(it)
        f = FACES.get(it["id"])
        if f:
            f(it)
        elif it["layer"] == "floor" and it["category"] in GENERIC_BACK and it["id"] not in NO_BACK and not {"sit", "rest"} & set(it.get("actions", [])):
            generic_back(it, metal=it["category"] in ("bath",))
        if it["layer"] == "floor" and it["category"] != "village":
            _keep_ground(it, was)
