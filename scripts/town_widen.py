# Wider streets: the town's carriageways are widened once the whole pack is built, by putting in whole rows or
# columns of the town's map right along a street (a copy of its lane: the paving, the bridge's deck, the river
# carry on through) and moving everything beyond them — props, sites, places, exits, spots, animals, wires,
# landmarks, the taxi stands, the homes, the building sites and the cart's stops, and every way into the town from
# the other maps and from the rooms inside its buildings. The main street gets four lanes, the other streets three.
# Nothing standing is cut in two: a line that would cross a building moves to the street's other lane.
# Run inside gen_base_content.py last, just before the pack is written (it needs `pack`).

_TOWN = "village"


def _town():
    return next(l for l in pack["locations"] if l["id"] == _TOWN)


def _spans(item, x, y, rot):
    d = _WIDEN_ITEMS[item]
    w, h = d["footprint"]["w"], d["footprint"]["d"]
    return (h, w) if rot % 2 else (w, h)


def _tears(v, axis, at):
    """Buildings a line put in after row/column `at` would cut in two (a small thing across it — a swing, a car —
    just stays where its first cell is)."""
    out = []
    for p in v["props"]:
        if p.get("wall") or _WIDEN_ITEMS[p["item"]]["layer"] == "rug":
            continue
        w, h = _spans(p["item"], p["x"], p["y"], p.get("rot", 0))
        if w * h <= 4:
            continue
        a, n = (p["x"], w) if axis == "x" else (p["y"], h)
        if a <= at < a + n - 1:
            out.append(p["item"])
    return out


def _move(c, axis, at, k):
    return c + k if c > at else c


def _rect(r, axis, at, k, keys=("x", "y", "w", "h")):
    """A rectangle (dict) moved past the line, or grown when it spans it."""
    kx, ky, kw, kh = keys
    a, n = (kx, kw) if axis == "x" else (ky, kh)
    if a not in r:
        return
    if r[a] > at:
        r[a] += k
    elif n in r and r[a] + r[n] - 1 > at:
        r[n] += k


def widen(axis, at, k):
    """Puts in `k` copies of row/column `at` of the town, right after it."""
    v = _town()
    if axis == "y":
        rows = v["tiles"]
        v["tiles"] = rows[: at + 1] + [rows[at]] * k + rows[at + 1:]
        v["h"] += k
    else:
        v["tiles"] = [r[: at + 1] + r[at] * k + r[at + 1:] for r in v["tiles"]]
        v["w"] += k
    i = 0 if axis == "x" else 1
    for p in v["props"]:
        if axis == "x":
            p["x"] = _move(p["x"], axis, at, k)
        else:
            p["y"] = _move(p["y"], axis, at, k)
    # the zebra crossings run over the new lanes too
    for p in [p for p in v["props"] if p["item"] in ("zebra", "zebra_v") and p["x" if axis == "x" else "y"] == at]:
        for j in range(1, k + 1):
            q = dict(p)
            q["x" if axis == "x" else "y"] = at + j
            v["props"].append(q)
    for s in v["sites"]:
        s["x" if axis == "x" else "y"] = _move(s["x" if axis == "x" else "y"], axis, at, k)
        for key in ("area", "building"):
            if key in s:
                r = dict(zip("xywh", s[key]))
                _rect(r, axis, at, k)
                s[key] = [r["x"], r["y"], r["w"], r["h"]]
    for coll in ("places", "spots", "fishing", "animals"):
        for r in v.get(coll, []):
            _rect(r, axis, at, k)
    for e in v["exits"]:
        _rect(e, axis, at, k)
    if v.get("entry"):
        v["entry"][i] = _move(v["entry"][i], axis, at, k)
    for l in v.get("landmarks", {}).values():
        _rect(l, axis, at, k)
    for wire in v.get("wires", []):
        for end in ("a", "b"):
            c = wire[end][i]
            if c > (at + 1) * 100:
                wire[end][i] = c + k * 100
            elif c > at * 100:
                # a pole in the widened lane keeps its place in the lane
                pass
    # every way into the town: from the other maps and from the rooms in its buildings
    for l in pack["locations"]:
        for e in l.get("exits", []):
            if e["to"] == _TOWN:
                e["at"][i] = _move(e["at"][i], axis, at, k)
    key = "x" if axis == "x" else "y"
    for t in pack.get("taxi", []):
        if t["location"] == _TOWN:
            t[key] = _move(t[key], axis, at, k)
    for h in pack.get("homes", []):
        if h.get("location") == _TOWN:
            h[key] = _move(h[key], axis, at, k)
    g = pack.get("growth") or {}
    for coll in ("sites", "abandon", "wear"):
        for s in g.get(coll, []):
            if s["location"] == _TOWN:
                s[key] = _move(s[key], axis, at, k)
    d = pack.get("driving") or {}
    if d.get("sto_park"):
        d["sto_park"][i] = _move(d["sto_park"][i], axis, at, k)
    if g.get("cart") and g["cart"]["location"] == _TOWN:
        for s in g["cart"]["spots"]:
            s[key] = _move(s[key], axis, at, k)


def widen_street(axis, lanes, k):
    """Widens a street by `k`, putting the new lanes in after the first of its `lanes` that cuts nothing."""
    v = _town()
    for at in lanes:
        if not _tears(v, axis, at):
            widen(axis, at, k)
            return at
    raise SystemExit(f"the street at {axis}={lanes} cannot be widened without cutting {_tears(v, axis, lanes[0])}")


_WIDEN_ITEMS = {it["id"]: it for it in items}
# from the far end back, so the lanes of the streets still to widen keep their numbers: the outskirts street, the
# Садова, the fourth and the third streets, the main street (to four lanes), the first street; then the columns
WIDENED = {}
for (_name, _lanes, _k) in (("Новобудовна", (96, 97), 1), ("Садова", (76, 77), 1), ("Нова", (66, 67), 1), ("Липова", (52, 53), 1), ("Шкільна", (40, 41), 1),
                            ("Головна", (26, 27), 2), ("Перша", (12, 13), 1)):
    WIDENED[_name] = ("y", widen_street("y", _lanes, _k), _k)
# (the short Річкова by the stream stays two lanes: a house stands across every line through it further south)
for (_name, _lanes, _k) in (("Центральна", (34, 35), 1), ("Лісова", (14, 15), 1)):
    WIDENED[_name] = ("x", widen_street("x", _lanes, _k), _k)
