# The utility office («Комунальна контора») and what stands inside it: the building on the street, the counter
# where bills are paid, the ticket machine of the queue, the meters on the wall. Run inside gen_base_content.py
# after town_items.py (it needs `civic`, `item`, `b`, `slot`).

# the building: sober grey-green, a sign with the three signs of the utilities (a drop, a bolt, a flame),
# meter boxes and a gas pipe on the side wall, a notice board by the door
civic("utility_office", "Комунальна контора", 5, 3, 110,
      [("leaf", 3), ("earth", 2), ("ceramic", 0), ("wood", 1),
       {"sign": slot("ceramic", 0), "drop": slot("glass", 1), "bolt": slot("fabric", 2), "flame": slot("fabric", 1), "meter": slot("metal", 0), "dial": slot("ceramic", 0),
        "pipe": slot("fabric", 2), "board": slot("wood", 3), "paper": slot("pastel", 3)}],
      [b(150, 286, 124, 200, 6, 30, "sign", "round"), b(176, 283, 130, 20, 4, 18, "drop", "ball"), b(240, 283, 128, 14, 4, 22, "bolt"), b(300, 283, 130, 18, 4, 18, "flame", "cone"),
       b(470, 40, 30, 10, 60, 50, "meter"), b(472, 50, 50, 6, 16, 16, "dial", "cyl"), b(472, 74, 50, 6, 16, 16, "dial", "cyl"),
       b(476, 100, 0, 8, 8, 80, "pipe", "cyl"), b(476, 100, 76, 8, 120, 8, "pipe", "cyl"),
       b(20, 296, 20, 70, 6, 60, "board"), b(28, 293, 34, 22, 4, 28, "paper"), b(56, 293, 40, 24, 4, 22, "paper")],
      roof_h=60)

# inside: the counter where the clerk takes the money (the bills are paid here)
item("bill_counter", "village", 2, 1, "floor",
     [b(0, 30, 0, 200, 70, 72, "body"), b(0, 30, 72, 200, 70, 6, "top", "round"), b(0, 24, 78, 200, 8, 70, "glass"), b(80, 22, 78, 40, 10, 18, "slot"),
      b(20, 50, 78, 34, 26, 4, "papers"), b(140, 46, 78, 30, 24, 22, "stamp", "cyl"), b(10, 100, 10, 180, 2, 50, "panel")],
     {"body": slot("leaf", 3), "top": slot("wood", 3), "glass": slot("glass", 0), "slot": slot("metal", 0), "papers": slot("pastel", 3), "stamp": slot("fabric", 1), "panel": slot("ceramic", 0)},
     "free", name="Каса комунальної контори")
# the queue: take a ticket, wait for your number on the board
item("queue_machine", "village", 1, 1, "floor",
     [b(34, 34, 0, 32, 32, 90, "post", "round"), b(26, 26, 90, 48, 40, 50, "box", "round"), b(32, 64, 104, 36, 4, 24, "screen"), b(42, 66, 96, 16, 4, 6, "ticket")],
     {"post": slot("metal", 0), "box": slot("fabric", 6), "screen": slot("glass", 1), "ticket": slot("pastel", 3)},
     "free", name="Термінал черги")
# the meters on the wall: water, electricity, gas, with their dials
item("meter_board", "village", 2, 1, "wall",
     [b(10, 0, 40, 180, 10, 90, "board"), b(24, 8, 60, 40, 6, 50, "box"), b(80, 8, 60, 40, 6, 50, "box"), b(136, 8, 60, 40, 6, 50, "box"),
      b(32, 12, 80, 24, 4, 14, "dial"), b(88, 12, 80, 24, 4, 14, "dial"), b(144, 12, 80, 24, 4, 14, "dial"),
      b(38, 12, 66, 12, 4, 8, "drop"), b(94, 12, 66, 12, 4, 8, "bolt"), b(150, 12, 66, 12, 4, 8, "flame")],
     {"board": slot("wood", 1), "box": slot("ceramic", 0), "dial": slot("metal", 2), "drop": slot("glass", 1), "bolt": slot("fabric", 2), "flame": slot("fabric", 1)},
     "free", name="Лічильники")
# a poster about paying on time
item("notice_bills", "village", 1, 1, "wall",
     [b(10, 0, 50, 80, 6, 100, "paper"), b(20, 4, 120, 60, 4, 16, "title"), b(20, 4, 70, 26, 4, 30, "drop"), b(54, 4, 70, 26, 4, 30, "bolt")],
     {"paper": slot("pastel", 3), "title": slot("fabric", 6), "drop": slot("glass", 1), "bolt": slot("fabric", 2)},
     "free", name="Оголошення: сплачуйте вчасно")
