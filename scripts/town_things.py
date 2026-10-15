# What a living town builds and opens over time: the bandstand on the square, scaffolding and site fences while
# something is being built, a bucket under a leaking roof, and the small stalls that open by the season (ice cream
# in summer, hot coffee in winter, a book stall). Run inside gen_base_content.py after home_items.py.

# ---- the bandstand: a round wooden pavilion on a low platform, slim posts, a railing, a green tented roof
bandstand = [b(10, 10, 0, 280, 280, 26, "deck", "round"), b(20, 20, 26, 260, 260, 6, "trim", "round")]
for (px, py) in ((30, 30), (135, 18), (240, 30), (262, 135), (240, 240), (135, 252), (30, 240), (18, 135)):
    bandstand.append(b(px, py, 32, 14, 14, 150, "post", "cyl"))
for (px, py, w, d) in ((40, 30, 200, 6), (40, 258, 200, 6), (24, 40, 6, 200), (264, 40, 6, 200)):
    bandstand.append(b(px, py, 70, w, d, 6, "trim"))
bandstand += [b(0, 0, 180, 300, 300, 24, "trim", "round"), b(6, 6, 200, 288, 288, 110, "roof", "cone"), b(144, 144, 306, 12, 12, 30, "gold", "cyl"),
              b(110, 120, 32, 30, 20, 50, "stand", "cyl"), b(160, 130, 32, 26, 26, 40, "stand", "cyl")]
item("bandstand", "decor", 3, 3, "floor", bandstand,
     {"deck": slot("stone", 1), "trim": slot("ceramic", 0), "post": slot("ceramic", 0), "roof": slot("leaf", 0), "gold": slot("autumn", 3), "stand": slot("wood", 2)},
     "free", ["sit"], name="Альтанка-естрада")
items[-1]["hidden"] = True

# ---- building: a site fence (boards with red and white stripes), scaffolding of poles and planks
item("work_fence", "village", 1, 1, "floor",
     [b(4, 44, 0, 8, 8, 70, "pole", "cyl"), b(88, 44, 0, 8, 8, 70, "pole", "cyl"), b(0, 46, 20, 100, 4, 46, "board"),
      b(10, 45, 30, 16, 4, 10, "stripe"), b(42, 45, 30, 16, 4, 10, "stripe"), b(74, 45, 30, 16, 4, 10, "stripe")],
     {"pole": slot("metal", 2), "board": slot("ceramic", 0), "stripe": slot("fabric", 1)}, "free", name="Будівельний паркан")
scaffold = []
for (px, py) in ((8, 8), (84, 8), (8, 84), (84, 84)):
    scaffold.append(b(px, py, 0, 8, 8, 230, "pole", "cyl"))
for z in (70, 140, 210):
    scaffold += [b(4, 4, z, 92, 92, 6, "plank"), b(4, 4, z + 6, 92, 4, 14, "rail")]
scaffold += [b(46, 10, 10, 6, 6, 200, "ladder"), b(42, 10, 40, 14, 4, 4, "ladder"), b(42, 10, 100, 14, 4, 4, "ladder"), b(42, 10, 160, 14, 4, 4, "ladder")]
item("scaffold", "village", 1, 1, "floor", scaffold, {"pole": slot("metal", 0), "plank": slot("wood", 1), "rail": slot("metal", 3), "ladder": slot("wood", 2)}, "free", name="Риштування")
item("brick_pallet", "village", 1, 1, "floor",
     [b(10, 10, 0, 80, 80, 10, "pallet")] + [b(14 + (k % 3) * 24, 14 + (k // 3) * 24, 10 + (k % 2) * 0, 22, 22, 30, "brick") for k in range(9)] + [b(20, 20, 40, 60, 60, 24, "brick")],
     {"pallet": slot("wood", 1), "brick": slot("pot", 0)}, "free", name="Піддон цегли")
item("leak_bucket", "village", 1, 1, "floor",
     [b(34, 34, 0, 32, 32, 30, "bucket", "cyl"), b(37, 37, 24, 26, 26, 4, "water", "cyl"), b(48, 48, 120, 4, 4, 8, "drop", "ball")],
     {"bucket": slot("metal", 0), "water": slot("glass", 1), "drop": slot("glass", 0)}, "free", name="Відро під протікання")

# ---- seasonal stalls
item("ice_cream_kiosk", "village", 2, 1, "floor",
     [b(10, 20, 0, 180, 60, 80, "body"), b(10, 20, 80, 180, 60, 6, "trim"), b(20, 26, 86, 160, 40, 20, "glass")]
     + [b(30 + k * 30, 36, 90, 16, 16, 14, f"scoop{k % 3}", "ball") for k in range(5)]
     + [b(96, 46, 106, 6, 6, 120, "pole", "cyl"), b(10, 0, 220, 180, 100, 40, "umbrella", "cone"), b(20, 70, 0, 22, 22, 22, "wheel", "cyl"), b(158, 70, 0, 22, 22, 22, "wheel", "cyl")],
     {"body": slot("pastel", 1), "trim": slot("ceramic", 0), "glass": slot("glass", 2), "scoop0": slot("fabric_pink", 0), "scoop1": slot("pastel", 3), "scoop2": slot("earth", 3),
      "pole": slot("metal", 0), "umbrella": slot("fabric_pink", 2), "wheel": slot("metal", 2)}, "free", name="Кіоск з морозивом")
item("coffee_cart", "village", 2, 1, "floor",
     [b(10, 24, 20, 180, 56, 70, "body"), b(10, 24, 90, 180, 56, 6, "top"), b(20, 30, 96, 40, 30, 40, "machine"), b(70, 36, 96, 14, 14, 18, "cup", "cyl"),
      b(90, 36, 96, 14, 14, 18, "cup", "cyl"), b(10, 20, 160, 180, 64, 10, "awning"), b(14, 22, 96, 6, 6, 64, "pole", "cyl"), b(180, 22, 96, 6, 6, 64, "pole", "cyl"),
      b(20, 70, 0, 26, 26, 26, "wheel", "cyl"), b(154, 70, 0, 26, 26, 26, "wheel", "cyl"), b(150, 30, 100, 30, 6, 30, "sign")],
     {"body": slot("earth", 3), "top": slot("wood", 3), "machine": slot("metal", 0), "cup": slot("ceramic", 0), "awning": slot("fabric", 2), "pole": slot("metal", 2),
      "wheel": slot("metal", 2), "sign": slot("ceramic", 1)}, "free", name="Кавовий візок")
item("book_stall", "village", 2, 1, "floor",
     [b(10, 20, 0, 180, 60, 70, "table")] + books(16, 184, 26, 70, 40, ["b0", "b1", "b2"], 7)
     + [b(10, 10, 140, 180, 80, 8, "awning"), b(12, 12, 70, 6, 6, 70, "pole", "cyl"), b(182, 12, 70, 6, 6, 70, "pole", "cyl")],
     {"table": slot("wood", 1), "b0": slot("fabric", 6), "b1": slot("fabric", 1), "b2": slot("fabric", 4), "awning": slot("fabric", 0), "pole": slot("wood", 2)},
     "free", name="Книжкова ятка")
