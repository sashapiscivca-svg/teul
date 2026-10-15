# The table games' things: a stone chess table for the park, a wooden domino table for the yard (both with a game
# laid out), a games table for one's home (bought), and a shelf of boxed games for the café, the library and the
# hostel. Each is tagged «game_table»: sitting down at one, a game can be played (app/src/games).
# Run inside gen_base_content.py after town_things.py (it needs `item`, `b`, `slot`, `legs4`, `coins`).

_board = [b(14 + (k % 4) * 18, 14 + (k // 4) * 18, 46, 18, 18, 2, "dark" if (k + k // 4) % 2 else "light") for k in range(16)]
item("chess_table", "village", 1, 1, "floor",
     [b(38, 38, 0, 24, 24, 34, "stone", "cyl"), b(26, 26, 0, 48, 48, 6, "stone", "cyl"), b(8, 8, 34, 84, 84, 12, "top")] + _board
     + [b(20, 20, 48, 6, 6, 10, "white", "cyl"), b(38, 20, 48, 6, 6, 12, "white", "cyl"), b(56, 74, 48, 6, 6, 10, "black", "cyl"), b(74, 74, 48, 6, 6, 14, "black", "cyl")],
     {"stone": slot("stone", 1), "top": slot("stone", 0), "light": slot("ceramic", 0), "dark": slot("earth", 1), "white": slot("ceramic", 0), "black": slot("ceramic", 5)},
     "free", name="Шаховий столик")
items[-1]["tags"] = ["game_table"]
item("domino_table", "village", 1, 1, "floor",
     legs4(100, 100, 40, 8, 10) + [b(4, 4, 40, 92, 92, 8, "top")]
     + [b(20 + k * 14, 40 + (k % 2) * 10, 48, 10, 18, 3, "bone") for k in range(5)] + [b(30, 70, 48, 18, 10, 3, "bone"), b(60, 20, 48, 18, 10, 3, "bone")],
     {"legs": slot("wood", 2), "top": slot("wood", 1), "bone": slot("ceramic", 0)}, "free", name="Стіл для доміно")
items[-1]["tags"] = ["game_table"]
item("game_table_home", "tables", 1, 1, "floor",
     legs4(100, 100, 44, 8, 12) + [b(6, 6, 44, 88, 88, 8, "top")] + [b(16 + (k % 4) * 16, 16 + (k // 4) * 16, 52, 16, 16, 2, "dark" if (k + k // 4) % 2 else "light") for k in range(16)]
     + [b(70, 70, 52, 20, 14, 10, "box")],
     {"legs": slot("wood", 0), "top": slot("wood", 3), "light": slot("ceramic", 0), "dark": slot("wood", 0), "box": slot("fabric", 1)}, coins(80), name="Столик для настільних ігор")
items[-1]["tags"] = ["game_table"]
item("game_shelf", "storage", 1, 1, "floor",
     [b(8, 30, 0, 84, 40, 120, "wood"), b(12, 34, 40, 76, 34, 4, "shelf"), b(12, 34, 80, 76, 34, 4, "shelf")]
     + [b(16, 36, 4, 70, 30, 12, "box1"), b(20, 36, 16, 60, 30, 10, "box2"), b(14, 36, 44, 34, 30, 30, "box3"), b(52, 36, 44, 34, 30, 22, "box1"), b(18, 36, 84, 66, 30, 14, "box2")],
     {"wood": slot("wood", 2), "shelf": slot("wood", 1), "box1": slot("fabric", 1), "box2": slot("fabric", 6), "box3": slot("autumn", 3)}, coins(60), name="Полиця з настільними іграми")
items[-1]["tags"] = ["game_table"]
