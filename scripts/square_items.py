# The square through the year: in winter the fountain is drained and taken under cover, and in its place stands a
# fir in a wooden tub with lights and parcels round it. Run inside gen_base_content.py after town_things.py.

_fir = [b(10, 10, 0, 180, 180, 30, "tub"), b(14, 14, 30, 172, 172, 6, "rim"), b(20, 20, 36, 160, 160, 4, "snow")]
for k, (r, z, hgt) in enumerate(((150, 40, 70), (118, 100, 64), (86, 154, 56), (54, 200, 50))):
    o = (200 - r) // 2
    _fir.append(b(o, o, z, r, r, hgt, "needles" if k % 2 == 0 else "needles2", "cone"))
_fir += [b(94, 94, 248, 12, 12, 16, "star", "ball")]
# the lights wound round the tree, and the parcels at its foot
for k, (x, y, z) in enumerate(((40, 60, 70), (140, 70, 80), (60, 140, 90), (130, 130, 120), (70, 70, 130), (120, 100, 160), (90, 120, 190), (100, 80, 215))):
    _fir.append(b(x, y, z, 8, 8, 8, "bulb" if k % 2 == 0 else "bulb2", "ball"))
_fir += [b(24, 150, 36, 30, 26, 24, "gift"), b(150, 30, 36, 26, 30, 22, "gift2"), b(150, 150, 36, 24, 24, 20, "gift")]
item("square_winter_fir", "village", 2, 2, "floor", _fir,
     {"tub": slot("wood", 2), "rim": slot("wood", 3), "snow": slot("ceramic", 0), "needles": slot("leaf", 1), "needles2": slot("leaf", 2),
      "star": slot("autumn", 3), "bulb": slot("autumn", 1), "bulb2": slot("fabric", 1), "gift": slot("fabric", 1), "gift2": slot("leaf", 0)},
     "free", name="Ялинка в діжці на місці фонтану")
items[-1]["tags"] = ["light"]

# ---- the cinema «Зоря»: a brick hall with a marquee of lights over its doors and posters either side ----------
_marquee = [b(110, 290, 150, 280, 20, 50, "marquee"), b(116, 296, 156, 268, 16, 38, "board")]
_marquee += [b(118 + k * 22, 306, 196, 8, 8, 8, "bulb" if k % 2 == 0 else "bulb2", "ball") for k in range(13)]
_marquee += [b(130 + k * 30, 309, 166, 18, 2, 18, "letters") for k in range(8)]
_posters = [b(30, 296, 40, 60, 4, 90, "poster1"), b(410, 296, 40, 60, 4, 90, "poster2"), b(34, 298, 46, 52, 2, 40, "poster2"), b(414, 298, 46, 52, 2, 40, "poster1")]
civic("cinema_house", "Кінотеатр «Зоря»", 5, 3, 150,
      [("ceramic", 4), ("ceramic", 5), ("ceramic", 0), ("fabric", 1),
       {"marquee": slot("fabric", 1), "board": slot("ceramic", 0), "bulb": slot("autumn", 3), "bulb2": slot("autumn", 1), "letters": slot("ceramic", 5),
        "poster1": slot("fabric", 6), "poster2": slot("autumn", 2)}],
      _marquee + _posters, roof_h=40)
items[-1]["tags"] = ["light"]
# inside: the big screen on the far wall, rows of red plush seats facing it, the ticket window, a popcorn cart
item("cinema_big_screen", "village", 4, 1, "wall",
     [b(10, 0, 60, 380, 6, 150, "frame"), b(20, 4, 70, 360, 4, 130, "screen"), b(0, 0, 50, 400, 8, 10, "curtain"), b(0, 0, 60, 20, 8, 160, "curtain"), b(380, 0, 60, 20, 8, 160, "curtain")],
     {"frame": slot("ceramic", 5), "screen": slot("ceramic", 0), "curtain": slot("fabric", 1)}, "free", name="Екран")
# a pair of seats: the backs behind (south), so one faces the screen on the north wall
item("cinema_seat", "village", 2, 1, "floor",
     [b(8, 20, 0, 84, 70, 30, "base"), b(8, 20, 30, 84, 60, 10, "seat"), b(108, 20, 0, 84, 70, 30, "base"), b(108, 20, 30, 84, 60, 10, "seat"),
      b(8, 78, 30, 84, 14, 60, "seat"), b(108, 78, 30, 84, 14, 60, "seat"), b(0, 20, 0, 8, 72, 50, "arm"), b(96, 20, 0, 8, 72, 50, "arm"), b(192, 20, 0, 8, 72, 50, "arm")],
     {"base": slot("ceramic", 5), "seat": slot("fabric", 1), "arm": slot("wood", 2)}, "free", ["sit"], name="Крісла в кінозалі")
item("cinema_ticket_booth", "village", 2, 1, "floor",
     [b(10, 20, 0, 180, 70, 100, "wood"), b(10, 16, 100, 180, 78, 8, "top"), b(60, 22, 60, 80, 4, 40, "glass"), b(20, 30, 108, 50, 30, 20, "roll", "cyl")],
     {"wood": slot("fabric", 1), "top": slot("autumn", 3), "glass": slot("glass", 1), "roll": slot("ceramic", 0)}, "free", name="Каса")
item("popcorn_cart", "village", 1, 1, "floor",
     [b(20, 20, 0, 60, 60, 50, "cart"), b(24, 24, 50, 52, 52, 50, "glass"), b(30, 30, 52, 40, 40, 30, "corn", "ball"), b(20, 20, 100, 60, 60, 10, "roof"),
      b(14, 70, 0, 14, 14, 14, "wheel", "cyl"), b(72, 70, 0, 14, 14, 14, "wheel", "cyl")],
     {"cart": slot("fabric", 1), "glass": slot("glass", 0), "corn": slot("autumn", 3), "roof": slot("fabric", 1), "wheel": slot("ceramic", 5)}, "free", name="Попкорн")
item("film_poster", "village", 1, 1, "wall",
     [b(20, 0, 60, 60, 3, 90, "frame"), b(24, 2, 64, 52, 2, 82, "print"), b(30, 3, 100, 40, 2, 30, "picture")],
     {"frame": slot("ceramic", 5), "print": slot("fabric", 6), "picture": slot("autumn", 2)}, "free", name="Афіша")
