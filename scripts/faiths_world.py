# Where the town's quieter places stand: the small temple in the park's quiet corner (by the lake, away from the
# main street), with stone lanterns along its path and a bench for those who wait; and the old circle on a clearing
# deep in the forest beyond the fire lookout: the idol in the middle, standing stones round it, the fire ring, the
# ribbon posts and the torches. Run by world_maps.py: `faith_village(V)` after town_growth.py, `faith_forest(F)`
# before the forest is scattered with trees.


def _spot_near(m, item, rot, cx, cy, radius, path_to=("p", "c", "h"), reach=4):
    """The free spot for a building nearest to (cx, cy) within `radius` whose door reaches a path."""
    cells = sorted(((x, y) for y in range(max(0, cy - radius), min(m.h, cy + radius)) for x in range(max(0, cx - radius), min(m.w, cx + radius))),
                   key=lambda c: (c[0] - cx) ** 2 + (c[1] - cy) ** 2)
    for x, y in cells:
        try:
            return free_spot(m, item, rot, [x], [y], path_to=path_to, reach=reach)
        except RuntimeError:
            continue
    return None


def faith_village(V):
    park = LANDMARKS.get("park", {"x": 39, "y": 45, "w": 12, "h": 6})
    cx, cy = park["x"] + park["w"] // 2, park["y"] + park["h"] // 2
    spot = None
    for rot in (0, 2):
        spot = _spot_near(V, "temple", rot, cx, cy, 22)
        if spot:
            break
    if not spot:
        spot, rot = free_spot(V, "temple", 0, range(2, V.w - 6), range(2, V.h - 6), path_to=("p", "c", "h")), 0
    x, y = spot
    door, fp = V.building_at("temple", x, y, rot=rot, path_to=("p", "c", "h"))
    V.site("temple_site", "Храм Тихого Лотоса", "temple", door, building=fp, jobs=[("temple_keeper", 360, 1200, 22, [])])
    fx, fy, fw, fh = fp
    # stone lanterns either side of the door, a bench a little way off
    for lx in (door[0] - 2, door[0] + 2):
        V.prop("stone_lantern", lx, door[1], must=False)
    V.prop("garden_bench", fx + fw + 1, fy + fh - 1, must=False)
    landmark("door:temple_site", "Храм Тихого Лотоса", *door)
    landmark("temple", "Біля храму", fx, fy, fw, fh)


def faith_forest(F):
    # a clearing in the pines east of the fire lookout, a trail to it from the lookout's clearing
    cx, cy = 97, 50
    F.ellipse(cx, cy, 6, 5, "m", only={"f"})
    F.line([(84, 52), (90, 51), (cx - 3, cy)], 1, "t", only={"f", "m"})
    ground = {"m", "g", "f", "t"}
    F.prop("forest_idol", cx, cy - 2, grounds=ground)
    # the cold ring on ordinary days, the fire in it on the full moon (one or the other in the same place)
    n = len(F.props)
    F.prop("ritual_hearth", cx, cy, grounds=ground)
    F.props[n]["unflag"] = "full_moon"
    F.props.append({"item": "ritual_hearth_lit", "x": cx, "y": cy, "flag": "full_moon"})
    # the standing stones in a ring round the fire, a gap on the west for the trail
    for dx, dy in ((0, -5), (4, -3), (5, 1), (3, 4), (-1, 5), (-4, 3)):
        F.prop("standing_stone", cx + dx, cy + dy, must=False, grounds=ground)
    for dx, dy in ((-3, -3), (2, -3)):
        F.prop("ribbon_post", cx + dx, cy + dy, must=False, grounds=ground)
    # torches lit on the full moon
    for dx, dy in ((-2, 2), (3, 2), (-2, -1), (2, -1)):
        n = len(F.props)
        if F.prop("torch_stake", cx + dx, cy + dy, must=False, grounds=ground):
            F.props[n]["flag"] = "full_moon"
    F.place("old_circle", "Старе коло", cx - 3, cy - 1, 7, 4, "walk", reserve=False)
    F.site("grove_site", "Старе коло", "grove", (cx - 1, cy + 1), area=(cx - 3, cy - 1, 7, 4))
