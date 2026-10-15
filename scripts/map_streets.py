# The town's streets by name, for the maps app on the phone and the computer (app/src/maps): every carriageway of
# the finished (widened) town — a band of paving at least two cells wide running most of the way across or down
# the map — gets a landmark `<name>_street` over its lanes, unless one is named already (Головна, Садова,
# Новобудовна). Their names, north to south and west to east, come from the houses along them and from where they
# lead. Run inside gen_base_content.py right after town_widen.py (it needs `pack`).


def _street_bands(tiles, horizontal, min_run):
    """(first line, last line, start, end) of every band of lines with a run of cobbles at least `min_run` long."""
    h, w = len(tiles), len(tiles[0])
    lines = range(h) if horizontal else range(w)
    found = []
    for i in lines:
        cells = tiles[i] if horizontal else "".join(tiles[y][i] for y in range(h))
        best = (0, 0)
        run = 0
        for j, ch in enumerate(cells + "."):
            if ch == "c":
                run += 1
            else:
                if run > best[1] - best[0]:
                    best = (j - run, j)
                run = 0
        found.append(best if best[1] - best[0] >= min_run else None)
    bands = []
    for i, r in enumerate(found):
        if r is None:
            continue
        if bands and bands[-1][1] == i - 1:
            b = bands[-1]
            bands[-1] = (b[0], i, min(b[2], r[0]), max(b[3], r[1]))
        else:
            bands.append((i, i, r[0], r[1]))
    return [b for b in bands if b[1] - b[0] >= 1]


def _name_streets():
    v = next(l for l in pack["locations"] if l["id"] == "village")
    marks = v.setdefault("landmarks", {})
    named = [m for k, m in marks.items() if k.endswith("_street")]

    def taken(x, y, w, h):
        # only a street running the same way counts: the cross streets cross them all
        return any((m["w"] >= m["h"]) == (w >= h) and x < m["x"] + m["w"] and m["x"] < x + w and y < m["y"] + m["h"] and m["y"] < y + h for m in named)

    across = iter([("lypova", "Вулиця Липова"), ("shkilna", "Вулиця Шкільна"), ("richkova", "Вулиця Річкова"), ("nova", "Вулиця Нова"),
                   ("vyshneva", "Вулиця Вишнева"), ("kvitkova", "Вулиця Квіткова")])
    down = iter([("lisova", "Вулиця Лісова"), ("rynkova", "Вулиця Ринкова"), ("naberezhna", "Вулиця Набережна"), ("zatyshna", "Вулиця Затишна")])
    for horizontal, names in ((True, across), (False, down)):
        for a, b, s, e in _street_bands(v["tiles"], horizontal, 30):
            x, y, w, h = (s, a, e - s, b - a + 1) if horizontal else (a, s, b - a + 1, e - s)
            if taken(x, y, w, h):
                continue
            nxt = next(names, None)
            if nxt is None:
                break
            marks[f"{nxt[0]}_street"] = {"name": nxt[1], "x": x, "y": y, "w": w, "h": h}
            named.append(marks[f"{nxt[0]}_street"])
    v["landmarks"] = dict(sorted(marks.items()))


_name_streets()
