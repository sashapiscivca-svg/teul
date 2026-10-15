# The road in the town (docs/world-economy.md §15): the zebra crossings and signs by the school and the shops,
# and (for now) the service station and the driving school. Run by world_maps.py: `driving_village(V)` after
# `style_village(V)` and before the street lamps (it uses `free_spot` from style_world.py).

DRIVE_WORLD = {}


def _crossing(m, start):
    """The road cell nearest to `start` where a two-lane street can be crossed straight (pavement on both sides,
    not at a junction): the two cells of the crossing, or None."""
    from collections import deque
    seen = {start}
    q = deque([start])
    while q:
        x, y = q.popleft()
        if abs(x - start[0]) + abs(y - start[1]) > 14:
            continue
        if m.at(x, y) == "c":
            # a street running east-west: the crossing goes north-south over its two rows
            for y0 in (y, y - 1):
                if m.at(x, y0) == "c" and m.at(x, y0 + 1) == "c" and m.at(x, y0 - 1) == "p" and m.at(x, y0 + 2) == "p" \
                        and m.at(x - 1, y0) == "c" and m.at(x + 1, y0) == "c" and m.at(x - 1, y0 - 1) == "p" and m.at(x + 1, y0 + 2) == "p":
                    return [(x, y0), (x, y0 + 1)], "ns"
            for x0 in (x, x - 1):
                if m.at(x0, y) == "c" and m.at(x0 + 1, y) == "c" and m.at(x0 - 1, y) == "p" and m.at(x0 + 2, y) == "p" \
                        and m.at(x0, y - 1) == "c" and m.at(x0, y + 1) == "c" and m.at(x0 - 1, y - 1) == "p" and m.at(x0 + 2, y + 1) == "p":
                    return [(x0, y), (x0 + 1, y)], "ew"
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nb = (x + dx, y + dy)
            if nb not in seen and m.inside(*nb):
                seen.add(nb)
                q.append(nb)
    return None


def driving_village(V):
    sites = {s["id"]: s for s in V.sites}
    zebras = []
    # zebra crossings by the school (with «Діти» signs), the shops and the post office
    for sid, sign in (("school_site", "road_sign_children"), ("grocery", "road_sign_crossing"), ("post_site", "road_sign_crossing"), ("hospital_site", "road_sign_crossing")):
        s = sites.get(sid)
        if not s:
            continue
        found = _crossing(V, (s["x"], s["y"]))
        if not found:
            continue
        cells, way = found
        if any(c in zebras for c in cells):
            continue
        for (x, y) in cells:
            V.prop("road_zebra", x, y, rot=0 if way == "ns" else 1, must=False)
            zebras.append((x, y))
        # the sign on the pavement at the near end
        (ax, ay), (bx, by) = cells
        for (px, py) in ((ax - 1, ay - 1), (ax + 1, ay - 1), (ax - 1, ay), (bx + 1, by + 1)) if way == "ns" else ((ax - 1, ay - 1), (ax - 1, ay + 1), (bx + 1, by - 1)):
            if V.at(px, py) == "p" and V.prop(sign, px, py, must=False):
                break
    DRIVE_WORLD["zebras"] = zebras
