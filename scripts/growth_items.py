# What a growing and wearing town looks like (crates/teul-core/src/growth.rs): building sites stage by stage (a
# pit, a slab, bare walls, a stalled frame with graffiti), the moving van, the cement mixer; old houses left empty
# (boarded windows, a hole in the roof) and buildings with a crack, a broken window, peeling paint or a tarp on a
# leaking roof; a dead street lamp; the ice-cream cart; the donut shop «Пончикова» and what is inside it; the car
# service «СТО» and the driving school; parking bays and zebra crossings. Run inside gen_base_content.py after
# town_things.py (it needs `item`, `b`, `slot`, `civic`, `building`, `items`, `good`-less helpers only).

import copy as _copy

_ITEMS = {it["id"]: it for it in items}


# ---- building sites -------------------------------------------------------------------------------------------

def _frame_walls(W, D, h, s="block"):
    """Bare walls with holes for the windows and the door, no roof: a house the builders are still raising."""
    out = [b(10, 10, 0, W - 20, D - 20, 10, "slab")]
    out += [b(10, 10, 10, W - 20, 14, h, s), b(10, 10, 10, 14, D - 20, h, s), b(W - 24, 10, 10, 14, D - 20, h, s)]
    # the front wall: a low band, pillars between the window holes, a lintel band over them
    y = D - 24
    out += [b(10, y, 10, W - 20, 14, 40, s), b(10, y, 10 + h - 30, W - 20, 14, 30, s)]
    for x in range(10, W - 20, 70):
        out.append(b(x, y, 50, 24, 14, h - 70, s))
    # rods sticking out of the top where the next course will go
    for x in range(30, W - 30, 90):
        out.append(b(x, 14, 10 + h, 4, 4, 30, "rebar", "cyl"))
    return out


for w, d in ((4, 3), (4, 4)):
    W, D = w * 100, d * 100
    tag = f"{w}x{d}"
    item(f"site_pit_{tag}", "village", w, d, "floor",
         [b(14, 14, 0, W - 28, D - 28, 3, "pit"), b(24, 24, 0, W - 48, D - 48, 4, "deep"), b(W - 90, 16, 0, 70, 70, 46, "mound", "round"), b(W - 80, 92, 0, 50, 40, 26, "mound", "round")]
         + [b(x, y, 0, 6, 6, 50, "stake", "cyl") for x in (10, W - 16) for y in (10, D - 16)]
         + [b(10, 12, 44, W - 20, 2, 2, "string"), b(10, D - 14, 44, W - 20, 2, 2, "string")],
         {"pit": slot("earth", 1), "deep": slot("earth", 2), "mound": slot("earth", 3), "stake": slot("wood", 3), "string": slot("fabric", 1)}, "free", name="Котлован")
    item(f"site_slab_{tag}", "village", w, d, "floor",
         [b(10, 10, 0, W - 20, D - 20, 22, "concrete")] + [b(x, y, 22, 4, 4, 40, "rebar", "cyl") for x in range(30, W - 20, 60) for y in range(30, D - 20, 60)]
         + [b(20, D - 60, 22, 60, 40, 30, "blocks"), b(26, D - 54, 52, 48, 28, 24, "blocks")],
         {"concrete": slot("stone", 1), "rebar": slot("earth", 0), "blocks": slot("ceramic", 1)}, "free", name="Фундамент")
    item(f"site_frame_{tag}", "village", w, d, "floor", _frame_walls(W, D, 150 if d == 3 else 210),
         {"slab": slot("stone", 1), "block": slot("ceramic", 1), "rebar": slot("earth", 0)}, "free", name="Стіни без даху")
    stalled = _frame_walls(W, D, 110 if d == 3 else 160, "old")
    stalled += [b(40, D - 26, 60, 60, 2, 26, "graf1", "round"), b(110, D - 26, 52, 70, 2, 20, "graf2"), b(200, D - 26, 64, 40, 2, 30, "graf1", "round")]
    stalled += [b(x, y, 0, 26, 26, 22, "weed", "ball") for x, y in ((0, D - 30), (W - 34, D - 26), (W // 2, D - 28), (6, 40), (W - 30, 60))]
    stalled += [b(W // 2 - 40, D // 2 - 20, 10, 50, 40, 20, "junk"), b(30, 40, 10, 40, 30, 14, "junk")]
    item(f"site_stalled_{tag}", "village", w, d, "floor", stalled,
         {"slab": slot("stone", 2), "old": slot("stone", 0), "rebar": slot("earth", 0), "graf1": slot("fabric", 6), "graf2": slot("fabric", 7), "weed": slot("leaf", 2), "junk": slot("earth", 2)},
         "free", name="Недобудова")

item("cement_mixer", "village", 1, 1, "floor",
     [b(30, 30, 0, 10, 10, 30, "leg", "cyl"), b(60, 60, 0, 10, 10, 30, "leg", "cyl"), b(20, 20, 30, 60, 60, 50, "drum", "ball"), b(36, 36, 74, 28, 28, 20, "drum", "cone"),
      b(10, 70, 0, 20, 20, 20, "wheel", "cyl")],
     {"leg": slot("metal", 2), "drum": slot("autumn", 1), "wheel": slot("metal", 2)}, "free", name="Бетономішалка")
item("moving_van", "village", 2, 1, "floor",
     [b(10, 16, 18, 130, 68, 110, "box"), b(140, 20, 18, 50, 60, 70, "cab"), b(150, 22, 60, 36, 56, 26, "glass")]
     + [b(x, y, 0, 26, 12, 26, "wheel", "cyl") for x in (24, 150) for y in (10, 78)]
     + [b(16, 14, 70, 120, 2, 20, "stripe"), b(30, 84, 0, 40, 30, 30, "parcel"), b(76, 86, 0, 30, 26, 24, "parcel"), b(40, 86, 30, 30, 24, 20, "parcel")],
     {"box": slot("ceramic", 0), "cab": slot("fabric", 6), "glass": slot("glass", 1), "wheel": slot("ceramic", 5), "stripe": slot("autumn", 1), "parcel": slot("wood", 3)},
     "free", name="Вантажівка з меблями")


# ---- the old and the worn ---------------------------------------------------------------------------------

def _front_glass(model, D, front=None):
    """The glass on the street side (the front wall stands at `front`; on a plain building, at D - 10)."""
    fy = D - 10 if front is None else front
    return [m for m in model if m["slot"] == "glass" and m["box"][1] >= fy - 4]


def abandoned_of(base):
    """The same house left empty: faded walls, boards nailed over the front windows, a hole in the roof."""
    src = _ITEMS[base]
    W, D = src["footprint"]["w"] * 100, src["footprint"]["d"] * 100
    model = [dict(m) for m in src["model"] if m["slot"] != "flower"]
    for m in model:
        if m["slot"] == "glass":
            m["slot"] = "hole"
    for g in _front_glass(model, D):
        x, y, z, w, d, h = g["box"]
        model += [b(x - 4, D - 9, z + 6, w + 8, 3, 8, "board"), b(x - 4, D - 9, z + h - 14, w + 8, 3, 8, "board"), b(x + w // 2 - 4, D - 9, z - 2, 8, 3, h + 4, "board")]
    roof = next(m for m in model if m["slot"] == "roof")
    rz = roof["box"][2]
    model += [b(W // 2, D // 3, rz + 10, 60, 50, 30, "gap", "round"), b(20, D - 40, 0, 30, 30, 26, "weed", "ball"), b(W - 50, D - 36, 0, 28, 28, 30, "weed", "ball")]
    slots = dict(src["slots"])
    slots.update({"wall": slot("worn", 4), "roof": slot("worn", 12), "door": slot("worn", 5), "hole": slot("ceramic", 5), "board": slot("worn", 1), "gap": slot("ceramic", 5),
                  "weed": slot("leaf", 2), "trim": slot("worn", 14)})
    item(f"abandoned_{base}", "village", src["footprint"]["w"], src["footprint"]["d"], "floor", model, slots, "free", name="Покинутий дім")


def worn_of(base, kind):
    """A building with one thing wrong: a crack, a broken window, peeling paint or a tarp on the leaking roof."""
    src = _ITEMS[base]
    W, D = src["footprint"]["w"] * 100, src["footprint"]["d"] * 100
    model = [dict(m) for m in src["model"]]
    slots = dict(src["slots"])
    wall = next(m for m in model if m["slot"] == "wall")
    wz, wh = wall["box"][2], wall["box"][5]
    # the front wall: a shop's stands back behind its pavement (shop_fronts.py)
    fy = SHOP_FRONT.get(base, D - 10)
    y = fy - 1
    if kind == "crack":
        x0 = W // 5
        steps = [(0, 0), (8, 14), (2, 28), (12, 42), (6, 56), (16, 70)]
        model += [b(x0 + dx, y, wz + 10 + dz, 4, 3, 16, "crack") for dx, dz in steps if dz + 26 < wh]
        model += [b(W - W // 4 + dx, y, wz + 14 + dz, 4, 3, 14, "crack") for dx, dz in steps[:3]]
        slots["crack"] = slot("ceramic", 5)
    elif kind == "window":
        glass = _front_glass(model, D, fy) or [m for m in model if m["slot"] == "glass"] or [m for m in model if m["slot"] in ("window", "door")]
        g = glass[len(glass) // 2]
        g["slot"] = "broken"
        x, gy, z, w, d, h = g["box"]
        model += [b(x + 2, fy + 1, z + 4, w - 4, 3, 6, "tape"), b(x + w // 2 - 3, fy + 1, z + 2, 6, 3, h - 4, "tape"), b(x - 6, fy + 12, 0, 18, 14, 4, "shard")]
        slots.update({"broken": slot("ceramic", 5), "tape": slot("wood", 3), "shard": slot("glass", 0)})
    elif kind == "paint":
        model += [b(x, y, wz + z, w, 3, h, "peel") for x, z, w, h in ((30, 20, 46, 30), (W // 2 + 30, 50, 60, 24), (W - 90, 14, 40, 40), (W // 3, wh - 40, 50, 20)) if z + h < wh]
        slots["peel"] = slot("stone", 1)
    elif kind == "roof":
        # the whole roof, however it is built (one gable, or slabs of a hipped, round or flat one)
        roofs = [m["box"] for m in model if m["slot"].startswith("roof")]
        rx, ry, rz = min(r[0] for r in roofs), min(r[1] for r in roofs), min(r[2] for r in roofs)
        rw, rd = max(r[0] + r[3] for r in roofs) - rx, max(r[1] + r[4] for r in roofs) - ry
        rh = max(r[2] + r[5] for r in roofs) - rz
        model += [b(rx + rw // 3, ry + rd // 2, rz + rh // 3, rw // 3, rd // 2, rh // 2 + 6, "tarp", "gable"), b(rx + rw // 3 - 6, ry + rd - 30, rz + 4, 12, 12, 10, "brick")]
        slots.update({"tarp": slot("fabric", 6), "brick": slot("stone", 2)})
    item(f"worn_{base}_{kind}", "village", src["footprint"]["w"], src["footprint"]["d"], "floor", model, slots, "free", name=src["name"])


def dead_lamp():
    src = _ITEMS["lamp_street"]
    model = [dict(m) for m in src["model"]]
    for m in model:
        if m["slot"] == "bulb":
            m["slot"] = "dead"
    slots = {**src["slots"], "dead": slot("stone", 2)}
    slots.pop("bulb", None)
    item("lamp_street_dead", "village", 1, 1, "floor", model, slots, "free", name="Згаслий ліхтар")


dead_lamp()

item("weeds", "village", 1, 1, "rug",
     [b(10 + (k * 37) % 70, 10 + (k * 53) % 70, 0, 14 + k % 3 * 4, 14 + k % 3 * 4, 18 + (k * 7) % 16, "weed" if k % 2 else "weed2", "cone") for k in range(7)],
     {"weed": slot("leaf", 2), "weed2": slot("autumn", 3)}, "free", name="Бур'ян")
item("fence_broken", "village", 1, 1, "floor",
     [b(4, 44, 0, 8, 8, 60, "post", "cyl"), b(88, 44, 0, 8, 8, 40, "post", "cyl"), b(0, 46, 40, 60, 4, 10, "rail"), b(40, 46, 6, 50, 4, 10, "rail"),
      b(14, 44, 0, 8, 4, 54, "picket"), b(30, 44, 0, 8, 4, 50, "picket"), b(54, 40, 0, 30, 8, 6, "picket")],
     {"post": slot("worn", 1), "rail": slot("worn", 13), "picket": slot("worn", 0)}, "free", name="Поламаний паркан")
item("ladder_wall", "village", 1, 1, "floor",
     [b(30, 16, 0, 6, 6, 200, "rail", "cyl"), b(64, 16, 0, 6, 6, 200, "rail", "cyl")] + [b(30, 16, z, 40, 6, 4, "rung") for z in range(20, 200, 26)]
     + [b(20, 60, 0, 40, 26, 22, "box"), b(24, 64, 22, 32, 6, 6, "handle"), b(66, 64, 0, 26, 26, 30, "paint", "cyl")],
     {"rail": slot("wood", 1), "rung": slot("wood", 3), "box": slot("fabric", 1), "handle": slot("metal", 2), "paint": slot("ceramic", 0)}, "free", name="Драбина з інструментами")


# ---- the ice-cream cart -----------------------------------------------------------------------------------
item("ice_cream_cart", "village", 2, 1, "floor",
     [b(20, 22, 22, 150, 56, 64, "body", "round"), b(20, 22, 86, 150, 56, 8, "lid"), b(30, 30, 94, 40, 40, 6, "glass"), b(80, 30, 94, 40, 40, 6, "glass"),
      b(36, 36, 100, 12, 12, 12, "scoop1", "ball"), b(52, 40, 100, 12, 12, 12, "scoop2", "ball"), b(88, 36, 100, 12, 12, 12, "scoop3", "ball"), b(100, 42, 100, 12, 12, 12, "scoop1", "ball"),
      b(168, 46, 22, 30, 6, 6, "handle"), b(192, 40, 22, 6, 20, 30, "handle"),
      b(140, 46, 94, 6, 6, 110, "pole", "cyl"), b(70, 0, 200, 150, 100, 36, "umbrella", "cone"), b(132, 40, 160, 14, 14, 14, "bell", "ball"),
      b(30, 8, 0, 34, 10, 34, "wheel", "cyl"), b(30, 82, 0, 34, 10, 34, "wheel", "cyl"), b(30, 18, 50, 120, 4, 24, "stripe")],
     {"body": slot("ceramic", 0), "lid": slot("pastel", 1), "glass": slot("glass", 2), "scoop1": slot("fabric_pink", 0), "scoop2": slot("earth", 3), "scoop3": slot("pastel", 3),
      "handle": slot("metal", 0), "pole": slot("metal", 0), "umbrella": slot("fabric_pink", 2), "bell": slot("metal", 1), "wheel": slot("ceramic", 5), "stripe": slot("fabric_pink", 2)},
     "free", name="Візок з морозивом")


item("donut_display", "village", 2, 1, "floor",
     [b(10, 20, 0, 180, 60, 70, "base"), b(10, 20, 70, 180, 60, 50, "glass"), b(10, 20, 120, 180, 60, 6, "top")]
     + [b(24 + k * 30, 30 + (k % 2) * 18, 76, 22, 22, 8, ("d1", "d2", "d3")[k % 3], "cyl") for k in range(6)]
     + [b(24 + k * 30, 36, 98, 22, 22, 8, ("d2", "d3", "d1")[k % 3], "cyl") for k in range(6)],
     {"base": slot("fabric_pink", 2), "glass": slot("glass", 2), "top": slot("ceramic", 0), "d1": slot("fabric_pink", 0), "d2": slot("earth", 3), "d3": slot("autumn", 3)},
     "free", name="Вітрина з пончиками")
item("donut_fryer", "village", 1, 1, "floor",
     [b(10, 10, 0, 80, 80, 80, "body"), b(16, 16, 80, 68, 68, 6, "oil"), b(20, 20, 86, 26, 26, 8, "d1", "cyl"), b(52, 46, 86, 26, 26, 8, "d1", "cyl"), b(84, 30, 60, 12, 30, 6, "knob")],
     {"body": slot("metal", 0), "oil": slot("autumn", 1), "d1": slot("autumn", 1), "knob": slot("metal", 2)}, "free", name="Фритюрниця")
item("menu_board_donut", "village", 2, 1, "wall",
     [b(10, 0, 120, 180, 6, 90, "board"), b(24, 6, 180, 80, 2, 10, "line"), b(24, 6, 160, 120, 2, 8, "line"), b(24, 6, 142, 100, 2, 8, "line"), b(140, 6, 136, 40, 2, 40, "pic", "round")],
     {"board": slot("ceramic", 5), "line": slot("ceramic", 0), "pic": slot("fabric_pink", 0)}, "free", name="Меню пончикової")

# ---- the car service «СТО» and the driving school «Автошкола» -------------------------------------------
# the school's practice car on the training ground: the town's car body (front first), white, a red «У» triangle
item("learner_car", "village", 2, 1, "floor",
     car_body("body", "top", [b(84, 34, 74, 30, 30, 4, "base"), b(90, 46, 78, 20, 4, 20, "tri"), b(94, 45, 82, 12, 2, 12, "tri_in")]),
     {**CAR_SLOTS, "body": slot("ceramic", 0), "top": slot("ceramic", 0), "base": slot("ceramic", 5), "tri": slot("fabric", 1), "tri_in": slot("ceramic", 0)}, "free", name="Навчальна машина")
item("tool_board_garage", "village", 2, 1, "wall",
     [b(10, 0, 100, 180, 6, 100, "board")] + [b(24 + k * 26, 6, 130 + (k % 2) * 20, 8, 4, 40, ("t1", "t2")[k % 2]) for k in range(6)],
     {"board": slot("wood", 1), "t1": slot("metal", 0), "t2": slot("fabric", 1)}, "free", name="Стенд з інструментами")
item("road_sign_board", "village", 1, 1, "wall",
     [b(14, 0, 110, 72, 6, 72, "board"), b(30, 6, 130, 40, 2, 40, "sign", "round"), b(40, 8, 140, 20, 2, 20, "mark", "round")],
     {"board": slot("ceramic", 0), "sign": slot("fabric", 1), "mark": slot("ceramic", 0)}, "free", name="Плакат з дорожніми знаками")

# ---- markings on the road ---------------------------------------------------------------------------------
item("zebra", "village", 1, 1, "rug", [b(6, y, 0, 88, 10, 1, "paint") for y in range(4, 100, 20)], {"paint": slot("ceramic", 0)}, "free", name="Пішохідний перехід")
item("zebra_v", "village", 1, 1, "rug", [b(x, 6, 0, 10, 88, 1, "paint") for x in range(4, 100, 20)], {"paint": slot("ceramic", 0)}, "free", name="Пішохідний перехід")
item("parking_bay", "village", 1, 1, "rug", [b(0, 0, 0, 4, 100, 1, "paint"), b(0, 92, 0, 100, 4, 1, "paint")], {"paint": slot("ceramic", 0)}, "free", name="Паркомісце")

# ---- variants of the town's buildings: worn (one thing wrong) and left empty --------------------------------
_ITEMS = {it["id"]: it for it in items}
for _base in ("bakery", "grocery", "cafe_house", "post_office", "flower_shop", "school", "utility_office", "gym", "bar_house", "hostel", "vet_clinic", "hospital",
              "police_station", "newsroom", "clothes_shop", "hair_salon", "hardware_store"):
    if _base not in _ITEMS:
        continue
    for _kind in ("crack", "window", "paint", "roof"):
        worn_of(_base, _kind)
for _base in ("cottage_honey", "cottage_blue"):
    abandoned_of(_base)
