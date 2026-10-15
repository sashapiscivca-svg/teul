# Music, records, the TV and the computer (crates/teul-core/src/media.rs, app/src/ui/media): the instruments one can
# have at home and carry into town, the sheet music that teaches a piece, the records to put on, and where each is
# found. Run inside gen_base_content.py after economy.py and town_life.py (it needs `item`, `good`, `st`, `items`,
# `stations`). The scores themselves are in scores.py.

import importlib.util as _ilu

_spec = _ilu.spec_from_file_location("scores", pathlib.Path(__file__).resolve().parent / "scores.py")
_scores = _ilu.module_from_spec(_spec)
_spec.loader.exec_module(_scores)

# ---- instruments -----------------------------------------------------------------------------------------------
item("accordion", "office", 1, 1, "floor",
     [b(26, 30, 0, 48, 40, 6, "stand"), b(20, 34, 6, 18, 32, 50, "box", "round"), b(38, 36, 8, 24, 28, 46, "bellows"), b(62, 34, 6, 18, 32, 50, "box", "round"),
      b(22, 66, 12, 12, 2, 38, "keys"), b(66, 66, 16, 10, 2, 30, "keys")],
     {"stand": slot("wood", 2), "box": slot("fabric", 1), "bellows": slot("fabric", 7), "keys": slot("ceramic", 0)}, coins(260), ["play_music"], name="Акордеон")
item("violin", "office", 1, 1, "floor",
     [b(36, 36, 0, 28, 28, 6, "stand", "cyl"), b(46, 46, 6, 8, 8, 30, "stand"), b(34, 40, 30, 32, 16, 44, "body", "round"), b(46, 44, 74, 8, 8, 30, "neck"), b(44, 42, 104, 12, 12, 8, "neck", "round")],
     {"stand": slot("metal", 2), "body": slot("wood", 4), "neck": slot("wood", 2)}, coins(220), ["play_music"], name="Скрипка")
item("bandura", "office", 1, 1, "floor",
     [b(20, 40, 0, 60, 20, 10, "stand"), b(16, 42, 10, 68, 16, 56, "body", "ball"), b(24, 41, 20, 52, 2, 40, "strings"), b(18, 44, 60, 14, 12, 40, "neck", "round")],
     {"stand": slot("wood", 2), "body": slot("wood", 0), "strings": slot("metal", 0), "neck": slot("wood", 1)}, coins(300), ["play_music"], name="Бандура")
item("sopilka", "office", 1, 1, "surface",
     [b(20, 46, 0, 60, 8, 4, "stand"), b(22, 47, 4, 56, 6, 6, "pipe", "cyl"), b(34, 47, 10, 4, 6, 1, "hole"), b(46, 47, 10, 4, 6, 1, "hole"), b(58, 47, 10, 4, 6, 1, "hole")],
     {"stand": slot("wood", 2), "pipe": slot("wood", 0), "hole": slot("wood", 5)}, coins(40), ["play_music"], name="Сопілка")
for it in items:
    if it["id"] in ("accordion", "violin", "bandura", "sopilka", "guitar", "piano"):
        tags = {"instrument", "music"}
        if it["id"] != "piano":
            tags.add("portable")
        it["tags"] = sorted(set(it.get("tags", [])) | tags)
    # the computer prints a picture drawn on it, to frame and hang on the wall
    if it["id"] in ("computer", "pc_desk"):
        it["tags"] = sorted(set(it.get("tags", [])) | {"printer"})
    # the TV has its channels, the radio its stations
    if it["id"] in ("tv", "wall_tv"):
        it["tags"] = sorted(set(it.get("tags", [])) | {"screen"})

# ---- sheet music and records -------------------------------------------------------------------------------------
SHEET = [b(22, 30, 0, 56, 40, 3, "paper"), b(26, 34, 3, 48, 32, 1, "staff"), b(30, 38, 4, 10, 6, 1, "note"), b(50, 50, 4, 10, 6, 1, "note")]
RECORD = [b(18, 18, 0, 64, 64, 4, "sleeve"), b(26, 26, 4, 48, 48, 2, "vinyl", "cyl"), b(44, 44, 6, 12, 12, 1, "label", "cyl")]

for p in _scores.PIECES:
    if p["sheet"]:
        good(p["sheet"], f"Ноти «{p['name']}»", SHEET, {"paper": slot("ceramic", 0), "staff": slot("fabric", 7), "note": slot("fabric", 7)}, ("sheet", "music"))

RECORD_COLORS = [1, 2, 3, 4, 5, 6, 7, 0]
for i, (rid, pid, title, *_rest) in enumerate(_scores.RECORDS):
    good(rid, f"Платівка {title}", RECORD, {"sleeve": slot("fabric", RECORD_COLORS[i % len(RECORD_COLORS)]), "vinyl": slot("metal", 3), "label": slot("fabric", 0)}, ("record", "music"))

# the pieces, as the core knows them (the score is the shell's)
PIECES = [{"id": p["id"], "name": p["name"], "by": p["by"], "sheet": p["sheet"], "level": p["level"]} for p in _scores.PIECES]

# ---- where they are found ------------------------------------------------------------------------------------------
WHERE = {
    "market": ("village", "book_stall", "Букініст розгладжує пожовклі аркуші: «Ці ноти грали ще мої батьки. Тепер — твої»."),
    "school": ("school_in", "blackboard", "Вчителька музики переписує ноти від руки, акуратно, ноту за нотою: «Повільно спершу. Пальці самі запам'ятають»."),
    "church": ("church_in", "organ", "Органістка дістає з шафи ноти, перев'язані стрічкою: «Їх співають тут кожного Різдва»."),
    "teacher": ("school_in", "blackboard", "«Щедрик» вчителька віддає задарма: «Цю мелодію знає весь світ, але народилася вона тут, у нас»."),
}
_spent = "Ноти на сьогодні роздано — приходь іншого дня."
for p in _scores.PIECES:
    if not p["sheet"]:
        continue
    loc, prop, text = WHERE[p["where"]]
    seasons = ("Winter",) if p["id"] in ("silent_night", "shchedryk", "jingle") else ()
    st(f"st.sheet.{p['id']}", loc, prop, f"Ноти «{p['name']}»", text, "buy", cost=p["price"], gives=((p["sheet"], 1),), per_day=1, seasons=seasons, hours=(9, 18))
    stations[-1]["spent"] = _spent

for i, (rid, pid, title, *_rest) in enumerate(_scores.RECORDS):
    st(f"st.record.{rid}", "radio_in", "record_shelf", f"Платівка {title}", "Диджей «Липове FM» дістає платівку з полиці й дмухає на неї: «Тримай. У мене ще одна така є»", "buy",
       cost=18 + 3 * i, gives=((rid, 1),), per_day=1, hours=(10, 19))
    stations[-1]["spent"] = "На сьогодні досить платівок — полиця теж має відпочити."
