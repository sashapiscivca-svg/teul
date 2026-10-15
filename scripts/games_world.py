# Where the town plays: a chess table under the trees of the park and a domino table at the edge of the square,
# each with two stools. Run by world_maps.py after the town is laid out: `games_village(V)`.


def _three_free(m, x, y, grounds):
    return all(m.fits(it, x + dx, y, 0, grounds) for it, dx in (("stool", -1), ("chess_table", 0), ("stool", 1)))


def _table_near(m, item, cx, cy, radius, grounds, name):
    cells = sorted(((x, y) for y in range(max(1, cy - radius), min(m.h - 1, cy + radius)) for x in range(max(1, cx - radius), min(m.w - 1, cx + radius))),
                   key=lambda c: (c[0] - cx) ** 2 + (c[1] - cy) ** 2)
    for x, y in cells:
        if _three_free(m, x, y, grounds):
            m.prop("stool", x - 1, y, rot=3, grounds=grounds)
            m.prop(item, x, y, grounds=grounds)
            m.prop("stool", x + 1, y, rot=1, grounds=grounds)
            landmark(item, name, x - 1, y, 3, 1)
            return (x, y)
    return None


def games_village(V):
    green = {"g", "m", "p", "h"}
    park = LANDMARKS.get("park", {"x": 41, "y": 49, "w": 12, "h": 6})
    _table_near(V, "chess_table", park["x"] + park["w"] // 2, park["y"] + park["h"] // 2, 12, green, "Шаховий столик у парку")
    sq = LANDMARKS.get("square", {"x": 39, "y": 16, "w": 13, "h": 6})
    _table_near(V, "domino_table", sq["x"] + sq["w"] + 6, sq["y"] + sq["h"] // 2, 12, green, "Стіл доміношників")
