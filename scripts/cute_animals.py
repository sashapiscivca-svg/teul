# Friendlier animals: round bodies, big heads, eyes with whites and a dark pupil looking ahead, rosy cheeks, short
# legs. They replace the first models (which looked a little grim). Facing +x, within one tile. Run inside
# gen_base_content.py after world_items.py.

EYE = {"eye_w": slot("ceramic", 0), "eye": slot("ceramic", 5), "cheek": slot("fabric_pink", 0)}


def eyes(front, cy, z, gap=7, size=7, cheeks=True):
    """Two eyes on the front of a head facing +x: whites, pupils looking forward, and cheeks under them."""
    out = []
    for side in (-1, 1):
        y = cy + side * gap - size // 2
        out += [b(front - 3, y, z, 5, size, size, "eye_w", "ball"), b(front, y + 1, z + 1, 3, size - 3, size - 3, "eye", "ball")]
        if cheeks:
            out.append(b(front - 2, y + side * 2, z - 5, 3, 6, 4, "cheek", "ball"))
    return out


def legs(xs, ys, h, w=8, slot_="leg"):
    return [b(x, y, 0, w, w, h, slot_, "round") for x in xs for y in ys]


def redo(id, model, slots):
    for it in items:
        if it["id"] == id:
            it["model"] = model
            it["slots"] = {**slots, **EYE}
            return
    raise SystemExit(f"no animal {id}")


redo("duck", [b(24, 32, 0, 50, 36, 26, "body", "ball"), b(16, 42, 12, 16, 16, 10, "body", "ball"), b(34, 30, 12, 30, 8, 12, "wing", "ball"), b(34, 62, 12, 30, 8, 12, "wing", "ball"),
              b(56, 38, 22, 28, 24, 26, "head", "ball"), b(80, 44, 30, 14, 12, 6, "beak", "round")] + eyes(82, 50, 38, gap=6, size=6),
     {"body": slot("ceramic", 0), "wing": slot("ceramic", 1), "head": slot("leaf", 0), "beak": slot("autumn", 1)})
redo("swan", [b(20, 32, 0, 56, 36, 28, "body", "ball"), b(30, 30, 14, 34, 8, 14, "body", "ball"), b(30, 62, 14, 34, 8, 14, "body", "ball"), b(66, 44, 20, 10, 10, 30, "body", "cyl"),
              b(62, 40, 46, 22, 20, 20, "body", "ball"), b(82, 46, 52, 12, 8, 6, "beak", "round")] + eyes(83, 50, 56, gap=5, size=5, cheeks=False),
     {"body": slot("ceramic", 0), "beak": slot("autumn", 1)})
redo("chicken", [b(28, 32, 8, 40, 34, 30, "body", "ball"), b(20, 40, 24, 14, 18, 18, "tail", "ball"), b(56, 38, 26, 26, 24, 26, "body", "ball"), b(62, 44, 50, 12, 10, 10, "comb", "ball"),
                 b(80, 46, 34, 8, 8, 6, "beak", "round"), b(76, 48, 26, 6, 4, 8, "comb", "ball")] + eyes(80, 50, 40, gap=6, size=5) + legs((40, 52), (46,), 10, 5, "beak"),
     {"body": slot("ceramic", 0), "tail": slot("ceramic", 1), "comb": slot("fabric", 1), "beak": slot("autumn", 1)})
redo("goose", [b(22, 32, 6, 50, 36, 28, "body", "ball"), b(62, 44, 22, 10, 10, 26, "body", "cyl"), b(58, 38, 44, 28, 24, 24, "body", "ball"), b(84, 46, 50, 12, 10, 6, "beak", "round")]
     + eyes(84, 50, 54, gap=6, size=6) + legs((40, 50), (46,), 8, 5, "beak"),
     {"body": slot("ceramic", 0), "beak": slot("autumn", 1)})
redo("goat", [b(18, 32, 22, 56, 36, 30, "body", "ball"), b(62, 36, 40, 30, 28, 30, "body", "ball"), b(66, 38, 68, 6, 6, 12, "horn", "cone"), b(66, 56, 68, 6, 6, 12, "horn", "cone"),
              b(64, 30, 54, 10, 8, 6, "body", "round"), b(64, 62, 54, 10, 8, 6, "body", "round"), b(88, 46, 42, 6, 8, 10, "beard", "round"), b(10, 44, 40, 10, 10, 10, "body", "ball")]
     + eyes(90, 50, 54, gap=7) + legs((24, 62), (36, 56), 26),
     {"body": slot("ceramic", 0), "horn": slot("wood", 3), "beard": slot("ceramic", 1), "leg": slot("ceramic", 1)})
redo("dog_street", [b(20, 34, 14, 50, 32, 28, "body", "ball"), b(58, 34, 26, 32, 32, 30, "body", "ball"), b(86, 46, 34, 10, 10, 8, "nose", "ball"), b(80, 44, 28, 10, 14, 10, "muzzle", "ball"),
                    b(60, 28, 46, 10, 6, 16, "ear", "round"), b(60, 66, 46, 10, 6, 16, "ear", "round"), b(10, 46, 30, 14, 8, 8, "body", "round"), b(48, 38, 30, 6, 26, 6, "collar")]
     + eyes(86, 50, 44, gap=7) + legs((26, 58), (38, 56), 14),
     {"body": slot("wood", 3), "muzzle": slot("ceramic", 1), "nose": slot("ceramic", 5), "ear": slot("wood", 1), "collar": slot("fabric", 1), "leg": slot("wood", 3)})
redo("squirrel", [b(38, 40, 0, 26, 20, 22, "body", "ball"), b(56, 40, 14, 22, 20, 20, "body", "ball"), b(60, 40, 32, 5, 5, 8, "body", "cone"), b(60, 56, 32, 5, 5, 8, "body", "cone"),
                  b(18, 38, 6, 24, 24, 40, "tail", "ball")] + eyes(77, 50, 24, gap=5, size=5),
     {"body": slot("autumn", 0), "tail": slot("autumn", 0)})
redo("rabbit", [b(32, 36, 0, 38, 30, 26, "body", "ball"), b(62, 38, 14, 26, 26, 24, "body", "ball"), b(64, 40, 36, 7, 8, 26, "ear", "round"), b(64, 54, 36, 7, 8, 26, "ear", "round"),
                b(26, 46, 10, 10, 10, 10, "tail", "ball"), b(86, 48, 24, 4, 4, 4, "nose", "ball")] + eyes(86, 51, 28, gap=6, size=6),
     {"body": slot("wood", 3), "ear": slot("wood", 3), "tail": slot("ceramic", 0), "nose": slot("fabric_pink", 2)})
redo("deer", [b(18, 34, 36, 56, 32, 32, "body", "ball"), b(64, 38, 56, 26, 24, 28, "body", "ball"), b(84, 44, 60, 10, 12, 12, "muzzle", "ball"), b(66, 36, 82, 4, 4, 20, "antler"),
              b(66, 60, 82, 4, 4, 20, "antler"), b(62, 32, 98, 12, 4, 4, "antler"), b(62, 62, 98, 12, 4, 4, "antler"), b(64, 30, 74, 8, 6, 10, "body", "round"), b(64, 64, 74, 8, 6, 10, "body", "round"),
              b(30, 40, 56, 6, 6, 4, "spot", "ball"), b(42, 52, 60, 6, 6, 4, "spot", "ball")] + eyes(88, 50, 68, gap=7) + legs((24, 62), (38, 56), 38, 6),
     {"body": slot("wood", 3), "muzzle": slot("ceramic", 1), "antler": slot("wood", 1), "spot": slot("ceramic", 0), "leg": slot("wood", 1)})
redo("fox", [b(24, 38, 10, 46, 26, 22, "body", "ball"), b(62, 38, 16, 26, 24, 24, "body", "ball"), b(84, 46, 20, 10, 10, 8, "muzzle", "round"), b(64, 38, 38, 8, 6, 12, "body", "cone"),
             b(64, 56, 38, 8, 6, 12, "body", "cone"), b(4, 40, 14, 26, 18, 16, "tail", "ball"), b(2, 44, 16, 10, 10, 10, "tip", "ball"), b(70, 40, 16, 14, 20, 10, "tip", "ball")]
     + eyes(86, 50, 32, gap=6, size=6) + legs((30, 58), (42, 54), 12, 6),
     {"body": slot("autumn", 0), "muzzle": slot("ceramic", 0), "tail": slot("autumn", 0), "tip": slot("ceramic", 0), "leg": slot("earth", 2)})
redo("cow", [b(10, 30, 28, 66, 40, 38, "body", "round"), b(72, 34, 40, 26, 32, 30, "body", "ball"), b(90, 40, 40, 10, 20, 16, "muzzle", "round"), b(74, 30, 66, 6, 6, 10, "horn", "cone"),
             b(74, 66, 66, 6, 6, 10, "horn", "cone"), b(72, 26, 58, 10, 8, 6, "body", "round"), b(72, 68, 58, 10, 8, 6, "body", "round"), b(26, 32, 50, 22, 4, 16, "spot", "round"),
             b(46, 68, 40, 18, 4, 16, "spot", "round"), b(20, 50, 22, 16, 10, 8, "udder", "ball"), b(4, 48, 46, 8, 6, 22, "spot")] + eyes(97, 50, 58, gap=8) + legs((16, 64), (34, 58), 30, 9),
     {"body": slot("ceramic", 0), "muzzle": slot("fabric_pink", 0), "horn": slot("ceramic", 1), "spot": slot("ceramic", 5), "udder": slot("fabric_pink", 0), "leg": slot("ceramic", 0)})
redo("sheep", [b(16, 28, 14, 62, 44, 36, "wool", "ball"), b(24, 34, 40, 40, 30, 16, "wool", "ball"), b(68, 38, 22, 24, 24, 24, "face", "ball"), b(64, 36, 38, 14, 28, 10, "wool", "ball"),
               b(70, 30, 28, 8, 6, 6, "face", "round"), b(70, 64, 28, 8, 6, 6, "face", "round")] + eyes(91, 50, 32, gap=6, size=6) + legs((26, 60), (36, 56), 16, 6, "face"),
     {"wool": slot("ceramic", 0), "face": slot("earth", 2)})
redo("pig", [b(18, 32, 10, 58, 36, 32, "body", "ball"), b(66, 36, 16, 26, 28, 28, "body", "ball"), b(88, 42, 22, 8, 16, 12, "snout", "round"), b(92, 45, 26, 2, 3, 3, "nose", "ball"),
             b(92, 51, 26, 2, 3, 3, "nose", "ball"), b(68, 34, 40, 8, 8, 10, "body", "cone"), b(68, 58, 40, 8, 8, 10, "body", "cone"), b(12, 46, 26, 8, 6, 6, "tail", "ball")]
     + eyes(90, 50, 36, gap=8, size=6) + legs((24, 60), (36, 56), 10),
     {"body": slot("fabric_pink", 0), "snout": slot("fabric_pink", 2), "nose": slot("earth", 2), "tail": slot("fabric_pink", 2), "leg": slot("fabric_pink", 0)})
redo("boar", [b(16, 32, 12, 60, 36, 34, "body", "ball"), b(66, 36, 16, 26, 28, 28, "body", "ball"), b(88, 42, 20, 8, 16, 12, "snout", "round"), b(86, 40, 26, 6, 3, 8, "tusk", "cone"),
              b(86, 58, 26, 6, 3, 8, "tusk", "cone"), b(28, 40, 44, 40, 18, 6, "bristle", "round"), b(68, 34, 40, 8, 8, 10, "body", "cone"), b(68, 58, 40, 8, 8, 10, "body", "cone")]
     + eyes(90, 50, 36, gap=8, size=6, cheeks=False) + legs((22, 62), (36, 56), 14),
     {"body": slot("earth", 3), "snout": slot("earth", 2), "tusk": slot("ceramic", 0), "bristle": slot("earth", 2), "leg": slot("earth", 2)})
redo("hedgehog", [b(26, 32, 0, 44, 36, 28, "spines", "ball"), b(30, 36, 18, 36, 28, 18, "spines2", "ball"), b(62, 40, 2, 22, 20, 18, "face", "ball"), b(82, 48, 6, 6, 6, 6, "nose", "ball")]
     + eyes(80, 50, 12, gap=5, size=5),
     {"spines": slot("earth", 1), "spines2": slot("earth", 3), "face": slot("wood", 3), "nose": slot("ceramic", 5)})
HORSE_CUTE = [b(14, 34, 38, 66, 32, 32, "coat", "ball"), b(66, 38, 54, 18, 24, 34, "coat", "round"), b(74, 38, 80, 26, 24, 22, "coat", "ball"), b(94, 42, 80, 10, 16, 14, "nose", "round"),
              b(74, 36, 100, 8, 6, 12, "coat", "cone"), b(74, 58, 100, 8, 6, 12, "coat", "cone"), b(68, 44, 64, 8, 12, 36, "mane", "round"), b(6, 44, 40, 12, 10, 28, "mane", "round")]
HORSE_CUTE += eyes(96, 50, 90, gap=8) + legs((20, 66), (38, 56), 40, 8) + [b(x, y, 0, 9, 9, 6, "hoof") for x in (20, 66) for y in (38, 56)]
redo("horse", HORSE_CUTE, {"coat": slot("wood", 1), "mane": slot("earth", 2), "nose": slot("wood", 3), "leg": slot("wood", 1), "hoof": slot("ceramic", 5)})
for it in items:
    if it["id"].startswith("horse_rider_"):
        jockey = [m for m in it["model"] if m["slot"] in ("saddle", "silk", "skin", "cap")]
        it["model"] = HORSE_CUTE + jockey
        it["slots"] = {**it["slots"], **EYE}
redo("bird", [b(36, 40, 4, 30, 22, 22, "body", "ball"), b(58, 42, 14, 18, 18, 18, "body", "ball"), b(74, 48, 20, 8, 5, 4, "beak", "round"), b(22, 46, 10, 16, 8, 6, "body", "round"),
              b(40, 38, 14, 20, 4, 8, "wing", "round"), b(40, 62, 14, 20, 4, 8, "wing", "round")] + eyes(74, 51, 24, gap=4, size=4, cheeks=False),
     {"body": slot("glass", 1), "wing": slot("fabric", 6), "beak": slot("autumn", 1)})
redo("butterfly", [b(46, 46, 30, 8, 6, 4, "body", "round"), b(34, 30, 30, 16, 16, 3, "wing", "ball"), b(34, 56, 30, 16, 16, 3, "wing", "ball"), b(50, 32, 30, 10, 12, 3, "wing2", "ball"),
                   b(50, 56, 30, 10, 12, 3, "wing2", "ball"), b(54, 46, 34, 6, 2, 6, "body")],
     {"body": slot("ceramic", 5), "wing": slot("fabric", 2), "wing2": slot("fabric_pink", 0)})
redo("bat", [b(40, 42, 60, 20, 16, 18, "body", "ball"), b(16, 38, 66, 26, 24, 3, "wing", "round"), b(58, 38, 66, 26, 24, 3, "wing", "round"), b(46, 42, 76, 4, 4, 6, "body", "cone"),
             b(46, 56, 76, 4, 4, 6, "body", "cone")] + eyes(60, 50, 68, gap=4, size=4, cheeks=False),
     {"body": slot("earth", 2), "wing": slot("earth", 0)})
