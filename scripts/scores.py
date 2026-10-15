"""The pieces the hero can play: real compositions (public domain), written here once as a melody and its chords.

The shell plays them on any instrument from app/src/ui/media/scores.json (it arranges the chords for the
instrument and lets the hands' skill show); a few are also pressed onto records, arranged for a small band and
rendered with the SoundFont (crates/teul-music, scripts/build-music.sh records).

Notation: notes are `c4`, `f#5`, `bb3` with an optional `:beats` (it carries on to the next notes); `r` is a
rest; `|` only helps the eye. Chords are `Am:3`, `G7:1.5`, `F/C:2` or `r:3` (nothing).
Run directly to write scores.json and the records score (crates/teul-music/records.json).
"""

import json
import os
import re

NOTE = re.compile(r"^([a-g])(#|b)?(-?\d)$")
STEP = {"c": 0, "d": 2, "e": 4, "f": 5, "g": 7, "a": 9, "b": 11}


def midi(name):
    m = NOTE.match(name)
    if not m:
        raise ValueError(f"not a note: {name}")
    letter, acc, octave = m.groups()
    return 12 * (int(octave) + 1) + STEP[letter] + (1 if acc == "#" else -1 if acc == "b" else 0)


def melody(text):
    """[[beat, length, key]] (rests leave a gap)."""
    out, at, dur = [], 0.0, 1.0
    for tok in text.split():
        if tok == "|":
            continue
        name, _, d = tok.partition(":")
        if d:
            dur = float(d)
        if name != "r":
            out.append([round(at, 4), dur, midi(name)])
        at += dur
    return out


QUALITY = {"": [0, 4, 7], "m": [0, 3, 7], "7": [0, 4, 7, 10], "m7": [0, 3, 7, 10], "maj7": [0, 4, 7, 11], "dim": [0, 3, 6], "sus4": [0, 5, 7]}
CHORD = re.compile(r"^([A-G])(#|b)?(m7|maj7|m|7|dim|sus4)?(?:/([A-G])(#|b)?)?$")


def chord_keys(name):
    """The chord's root (in the bass octave) and its tones around middle C."""
    m = CHORD.match(name)
    if not m:
        raise ValueError(f"not a chord: {name}")
    root, acc, q, broot, bacc = m.groups()
    pc = STEP[root.lower()] + (1 if acc == "#" else -1 if acc == "b" else 0)
    bass_pc = pc if not broot else STEP[broot.lower()] + (1 if bacc == "#" else -1 if bacc == "b" else 0)
    bass = 36 + bass_pc % 12
    if bass > 43:
        bass -= 12
    tones = [48 + (pc + i) % 12 for i in QUALITY[q or ""]]
    tones = sorted(t if t >= 52 else t + 12 for t in tones)
    return bass, tones


def chords(text):
    """[[beat, length, bass, [tones]]]."""
    out, at = [], 0.0
    for tok in text.split():
        if tok == "|":
            continue
        name, _, d = tok.partition(":")
        dur = float(d) if d else 1.0
        if name != "r":
            bass, tones = chord_keys(name)
            out.append([round(at, 4), dur, bass, tones])
        at += dur
    return out


PIECES = []


def piece(id, name, by, tempo, meter, tune, harmony, level=0, sheet=None, price=0, where=None, about=""):
    m = melody(tune)
    c = chords(harmony)
    end_m = max(n[0] + n[1] for n in m)
    end_c = max([x[0] + x[1] for x in c] or [0])
    if abs(end_m - end_c) > meter + 1e-6:
        raise ValueError(f"{id}: the tune ({end_m} beats) and the chords ({end_c}) do not end together")
    PIECES.append({"id": id, "name": name, "by": by, "tempo": tempo, "meter": meter, "melody": m, "chords": c,
                   "level": level, "sheet": sheet, "price": price, "where": where, "about": about})


# ---- the pieces ------------------------------------------------------------------------------------------------

piece("lullaby", "Колискова", "Йоганнес Брамс", 84, 3,
      "r:2 e4:0.5 e4 | g4:1.5 e4:0.5 e4:1 | g4:2 e4:0.5 g4 | c5:1 b4:1.5 a4:0.5 | a4:1 g4 d4:0.5 e4 | f4:1 d4 d4:0.5 e4 |"
      " f4:2 d4:0.5 f4 | b4:0.5 a4 g4:1 b4 | c5:2 c4:0.5 c4 | c5:2 a4:0.5 f4 | g4:2 e4:0.5 c4 | f4:1 g4 a4 |"
      " g4:2 c4:0.5 c4 | c5:2 a4:0.5 f4 | g4:2 e4:0.5 c4 | f4:1 e4 d4 | c4:3",
      "r:3 | C:3 | C:3 | Am:3 | G:3 | G7:3 | G7:3 | G7:3 | C:3 | F:3 | C:3 | F:1.5 G:1.5 | C:3 | F:3 | C:3 | G7:3 | C:3",
      about="Колискова, яку наспівують над колисками вже півтора століття.")

piece("vesnianka", "Вийди, вийди, сонечко", "народна веснянка", 100, 2,
      "g4:1 e4 | g4 e4 | g4:0.5 g4 a4 g4 | e4:2 | g4:1 e4 | g4 e4 | g4:0.5 a4 g4 e4 | d4:1 c4 |"
      " e4:0.5 e4 g4 g4 | a4:1 g4 | e4:0.5 e4 g4 e4 | d4:2 | e4:0.5 g4 a4 g4 | e4:1 g4 | e4:0.5 d4 e4 d4 | c4:2",
      "C:2 | C:2 | C:2 | C:2 | C:2 | C:2 | C:2 | G:1 C:1 | C:2 | F:1 C:1 | C:2 | G:2 | C:2 | C:2 | G:2 | C:2",
      about="Закличка весни: її співають діти, коли сходить сніг.")

piece("ode", "Ода до радості", "Людвіг ван Бетховен", 112, 4,
      "e4:1 e4 f4 g4 | g4 f4 e4 d4 | c4 c4 d4 e4 | e4:1.5 d4:0.5 d4:2 |"
      " e4:1 e4 f4 g4 | g4 f4 e4 d4 | c4 c4 d4 e4 | d4:1.5 c4:0.5 c4:2 |"
      " d4:1 d4 e4 c4 | d4 e4:0.5 f4 e4:1 c4 | d4 e4:0.5 f4 e4:1 d4 | c4 d4 g3:2 |"
      " e4:1 e4 f4 g4 | g4 f4 e4 d4 | c4 c4 d4 e4 | d4:1.5 c4:0.5 c4:2",
      "C:4 | G:4 | C:4 | G:4 | C:4 | G:4 | C:4 | G:2 C:2 | G:4 | G:2 C:2 | G:2 C:2 | C:2 G:2 | C:4 | G:4 | C:4 | G:2 C:2",
      about="Фінал Дев'ятої симфонії — тепер гімн Європи.")

piece("jingle", "Дзвіночки", "Джеймс Лорд Пірпонт", 132, 4,
      "e4:1 e4 e4:2 | e4:1 e4 e4:2 | e4:1 g4 c4:1.5 d4:0.5 | e4:4 | f4:1 f4 f4:1.5 f4:0.5 | f4:1 e4 e4 e4:0.5 e4 |"
      " e4:1 d4 d4 e4 | d4:2 g4:2 | e4:1 e4 e4:2 | e4:1 e4 e4:2 | e4:1 g4 c4:1.5 d4:0.5 | e4:4 | f4:1 f4 f4 f4 |"
      " f4:1 e4 e4 e4:0.5 e4 | g4:1 g4 f4 d4 | c4:4",
      "C:4 | C:4 | C:4 | C:4 | F:4 | C:4 | D7:4 | G:4 | C:4 | C:4 | C:4 | C:4 | F:4 | C:4 | G7:4 | C:4",
      level=1, sheet="sheet_jingle", price=12, where="market",
      about="Зимова пісенька про сани й дзвіночки.")

piece("minuet", "Менует соль мажор", "Крістіан Петцольд", 116, 3,
      "d5:1 g4:0.5 a4 b4 c5 | d5:1 g4 g4 | e5:1 c5:0.5 d5 e5 f#5 | g5:1 g4 g4 | c5:1 d5:0.5 c5 b4 a4 | b4:1 c5:0.5 b4 a4 g4 |"
      " f#4:1 g4:0.5 a4 b4 g4 | a4:3 | d5:1 g4:0.5 a4 b4 c5 | d5:1 g4 g4 | e5:1 c5:0.5 d5 e5 f#5 | g5:1 g4 g4 |"
      " c5:1 d5:0.5 c5 b4 a4 | b4:1 c5:0.5 b4 a4 g4 | a4:1 b4:0.5 a4 g4 f#4 | g4:3",
      "G:3 | G:3 | C:3 | G:3 | C:3 | G:3 | D:3 | D7:3 | G:3 | G:3 | C:3 | G:3 | C:3 | G:3 | D7:3 | G:3",
      level=1, sheet="sheet_minuet", price=14, where="school",
      about="З нотного зошита Анни Магдалени Бах — з нього вчаться всі, хто сідає за інструмент.")

piece("silent_night", "Тиха ніч", "Франц Ксавер Грубер", 150, 6,
      "g4:3 a4:1 g4:2 | e4:6 | g4:3 a4:1 g4:2 | e4:6 | d5:4 d5:2 | b4:6 | c5:4 c5:2 | g4:6 | a4:4 a4:2 | c5:3 b4:1 a4:2 |"
      " g4:3 a4:1 g4:2 | e4:6 | a4:4 a4:2 | c5:3 b4:1 a4:2 | g4:3 a4:1 g4:2 | e4:6 | d5:4 d5:2 | f5:3 d5:1 b4:2 | c5:6 |"
      " e5:6 | c5:2 g4 e4 | g4:3 f4:1 d4:2 | c4:6",
      "C:6 | C:6 | C:6 | C:6 | G:6 | G:6 | C:6 | C:6 | F:6 | F:6 | C:6 | C:6 | F:6 | F:6 | C:6 | C:6 | G:6 | G7:6 | C:6 |"
      " C:6 | C:6 | G7:6 | C:6",
      level=1, sheet="sheet_silent_night", price=10, where="church",
      about="Різдвяна пісня з австрійського містечка Оберндорф, 1818 рік.")

piece("greensleeves", "Зелені рукави", "англійська народна", 120, 3,
      "r:2 a4:1 | c5:2 d5:1 | e5:1.5 f5:0.5 e5:1 | d5:2 b4:1 | g4:1.5 a4:0.5 b4:1 | c5:2 a4:1 | a4:1.5 g#4:0.5 a4:1 | b4:2 g#4:1 |"
      " e4:2 a4:1 | c5:2 d5:1 | e5:1.5 f5:0.5 e5:1 | d5:2 b4:1 | g4:1.5 a4:0.5 b4:1 | c5:1.5 b4:0.5 a4:1 | g#4:1.5 f#4:0.5 g#4:1 |"
      " a4:3 | a4:3 | g5:3 | g5:1.5 f#5:0.5 e5:1 | d5:2 b4:1 | g4:1.5 a4:0.5 b4:1 | c5:2 a4:1 | a4:1.5 g#4:0.5 a4:1 |"
      " b4:2 g#4:1 | e4:3 | g5:3 | g5:1.5 f#5:0.5 e5:1 | d5:2 b4:1 | g4:1.5 a4:0.5 b4:1 | c5:1.5 b4:0.5 a4:1 |"
      " g#4:1.5 f#4:0.5 g#4:1 | a4:3",
      "r:3 | Am:3 | C:3 | G:3 | Em:3 | Am:3 | F:3 | E:3 | E:3 | Am:3 | C:3 | G:3 | Em:3 | Am:3 | E:3 | Am:3 | Am:3 |"
      " C:3 | C:3 | G:3 | Em:3 | Am:3 | F:3 | E:3 | E:3 | C:3 | C:3 | G:3 | Em:3 | Am:3 | E:3 | Am:3",
      level=2, sheet="sheet_greensleeves", price=16, where="market",
      about="Старовинна англійська пісня, яку грали ще за часів Шекспіра.")

piece("fur_elise", "До Елізи", "Людвіг ван Бетховен", 132, 3,
      "r:2 e5:0.5 d#5 | e5 d#5 e5 b4 d5 c5 | a4:1 r:0.5 c4 e4 a4 | b4:1 r:0.5 e4 g#4 b4 | c5:1 r:0.5 e4 e5 d#5 |"
      " e5 d#5 e5 b4 d5 c5 | a4:1 r:0.5 c4 e4 a4 | b4:1 r:0.5 e4 c5 b4 | a4:1 r:0.5 b4 c5 d5 |"
      " e5:1.5 g4:0.5 f5 e5 | d5:1.5 f4:0.5 e5 d5 | c5:1.5 e4:0.5 d5 c5 | b4:1 r:0.5 e4 e5 d#5 |"
      " e5 d#5 e5 b4 d5 c5 | a4:1 r:0.5 c4 e4 a4 | b4:1 r:0.5 e4 g#4 b4 | c5:1 r:0.5 e4 e5 d#5 |"
      " e5 d#5 e5 b4 d5 c5 | a4:1 r:0.5 c4 e4 a4 | b4:1 r:0.5 e4 c5 b4 | a4:3",
      "r:3 | r:3 | Am:3 | E:3 | Am:3 | r:3 | Am:3 | E:3 | Am:3 | C:3 | G:3 | Am:3 | E:3 | r:3 | Am:3 | E:3 | Am:3 | r:3 |"
      " Am:3 | E:3 | Am:3",
      level=2, sheet="sheet_fur_elise", price=20, where="school",
      about="Багатель ля мінор — мабуть, найвідоміші дванадцять нот фортепіано.")

piece("canon", "Канон ре мажор", "Йоганн Пахельбель", 66, 4,
      "f#5:2 e5 | d5 c#5 | b4 a4 | b4 c#5 | d5 c#5 | b4 a4 | g4 f#4 | g4 e4 |"
      " d4:1 f#4 a4 g4 | f#4 d4 f#4 e4 | d4 b3 d4 a4 | g4 b4 a4 g4 |"
      " f#4:0.5 d4 e4 f#4 g4 f#4 e4 d4 | c#4 a3 b3 c#4 d4 e4 f#4 g4 | f#4 d4 e4 c#4 d4 f#4 a4 b4 | g4 b4 a4 g4 f#4 e4 g4 f#4 |"
      " f#5:2 e5 | d5 c#5 | b4 a4 | b4 c#5 | d5:4",
      "D:2 A:2 | Bm:2 F#m:2 | G:2 D:2 | G:2 A:2 | D:2 A:2 | Bm:2 F#m:2 | G:2 D:2 | G:2 A:2 | D:2 A:2 | Bm:2 F#m:2 | G:2 D:2 |"
      " G:2 A:2 | D:2 A:2 | Bm:2 F#m:2 | G:2 D:2 | G:2 A:2 | D:2 A:2 | Bm:2 F#m:2 | G:2 D:2 | G:2 A:2 | D:4",
      level=2, sheet="sheet_canon", price=18, where="market",
      about="Три скрипки грають одне й те саме, вступаючи по черзі, — а бас ходить по колу вісім нот.")

piece("moonlight", "Місячна соната", "Людвіг ван Бетховен", 54, 4,
      " ".join(["g#3:0.3333 c#4 e4"] * 4) + " | " + " ".join(["g#3 c#4 e4"] * 4) + " | " + " ".join(["a3 c#4 e4"] * 2) + " "
      + " ".join(["a3 d4 f#4"] * 2) + " | g#3 c4 f#4 g#3 c#4 e4 g#3 c#4 d#4 f#3 c4 d#4 | " + " ".join(["e3 g#3 c#4"] * 4)
      + " | " + " ".join(["g#3 c#4 e4"] * 4) + " | c#4:4",
      "C#m:4 | C#m/B:4 | A:2 F#m:2 | G#7:4 | C#m:4 | C#m:4 | C#m:4",
      level=3, sheet="sheet_moonlight", price=24, where="school",
      about="Перша частина сонати № 14: тихі тріолі, наче місячне світло на воді.")

piece("shchedryk", "Щедрик", "Микола Леонтович", 160, 3,
      " ".join(["bb4:1 a4:0.5 bb4:0.5 g4:1 |"] * 4) + " " + " ".join(["d5:1 c5:0.5 d5:0.5 bb4:1 |"] * 4)
      + " g5:1 f5:0.5 eb5:0.5 d5:1 | c5:1 bb4:0.5 a4:0.5 g4:1 | g5:1 f5:0.5 eb5:0.5 d5:1 | c5:1 bb4:0.5 a4:0.5 g4:1 |"
      " d4:0.5 e4 f#4 g4 a4 bb4 | c5:0.5 d5 c5:1 bb4:1 | d4:0.5 e4 f#4 g4 a4 bb4 | c5:0.5 d5 c5:1 bb4:1 | "
      + " ".join(["bb4:1 a4:0.5 bb4:0.5 g4:1 |"] * 3) + " g4:3",
      "Gm:3 | Gm/F:3 | Eb:3 | D:3 | Gm:3 | Gm/F:3 | Eb:3 | D:3 | Gm:3 | Cm:1.5 D:1.5 | Gm:3 | Cm:1.5 D:1.5 | D:3 | D7:3 | D:3 |"
      " D7:3 | Gm:3 | Gm/F:3 | Eb:3 | Gm:3",
      level=2, sheet="sheet_shchedryk", price=0, where="teacher",
      about="Щедрівка, яку Леонтович обробив для хору 1916 року, — світ знає її як «Carol of the Bells».")

# ---- records: pieces pressed onto vinyl, arranged for a small band --------------------------------------------------

# General MIDI programs
PIANO, NYLON, ACCORDION, VIOLIN, CELLO, STRINGS, CHOIR, HARP, FLUTE, RECORDER, CLARINET, CELESTA = 0, 24, 21, 40, 42, 48, 52, 46, 73, 74, 71, 8

RECORDS = [
    # id, piece, title on the sleeve, lead, accompaniment style, tempo factor
    ("rec_shchedryk", "shchedryk", "«Щедрик» — хор і струнні", CHOIR, ("strings", STRINGS), 0.9),
    ("rec_canon", "canon", "«Канон» — струнний квартет", VIOLIN, ("strings", STRINGS), 1.0),
    ("rec_fur_elise", "fur_elise", "«До Елізи» — фортепіано", PIANO, ("arp", PIANO), 0.92),
    ("rec_silent_night", "silent_night", "«Тиха ніч» — арфа й флейта", FLUTE, ("arp", HARP), 0.9),
    ("rec_greensleeves", "greensleeves", "«Зелені рукави» — гітара й флейта", RECORDER, ("pick", NYLON), 0.95),
    ("rec_ode", "ode", "«Ода до радості» — оркестр", VIOLIN, ("strings", STRINGS), 1.0),
    ("rec_moonlight", "moonlight", "«Місячна соната» — фортепіано", PIANO, ("bass", PIANO), 1.0),
]


def arrange(rid, pid, lead, acc, factor):
    p = next(x for x in PIECES if x["id"] == pid)
    style, program = acc
    parts = [{"program": lead, "volume": 104, "pan": 64, "reverb": 70, "notes": [[a, l, k + (12 if lead in (FLUTE, RECORDER) and k < 67 else 0), 92] for a, l, k in p["melody"]]}]
    acc_notes, bass_notes = [], []
    for at, ln, bass, tones in p["chords"]:
        bass_notes.append([at, ln, bass, 70])
        if style == "strings":
            acc_notes += [[at, ln, t, 56] for t in tones[:3]]
        elif style == "arp":
            step = 0.5
            k = 0
            t = at
            while t < at + ln - 1e-6:
                acc_notes.append([round(t, 4), step * 1.6, ([bass + 12] + tones)[k % (len(tones) + 1)], 58])
                t += step
                k += 1
        elif style == "pick":
            t, k = at, 0
            while t < at + ln - 1e-6:
                acc_notes.append([round(t, 4), 1.2, tones[k % len(tones)] - (12 if k % 3 == 0 else 0), 62])
                t += 1.0
                k += 1
        # "bass": only the octave bass below
    if style == "bass":
        bass_notes += [[a, l, b - 12, 64] for a, l, b, _ in bass_notes]
    parts.append({"program": program, "volume": 84, "pan": 50, "reverb": 80, "notes": acc_notes})
    parts.append({"program": CELLO if style == "strings" else program, "volume": 88, "pan": 76, "reverb": 70, "notes": bass_notes})
    return {"name": rid, "tempo": p["tempo"] * factor, "meter": p["meter"], "parts": [x for x in parts if x["notes"]]}


def write():
    root = os.path.join(os.path.dirname(__file__), "..")
    scores = [{k: p[k] for k in ("id", "name", "by", "tempo", "meter", "melody", "chords", "level")} for p in PIECES]
    with open(os.path.join(root, "app/src/ui/media/scores.json"), "w") as f:
        json.dump(scores, f, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(root, "crates/teul-music/records.json"), "w") as f:
        json.dump([arrange(*r[:2], r[3], r[4], r[5]) for r in RECORDS], f, separators=(",", ":"))


if __name__ == "__main__":
    write()
    for p in PIECES:
        print(f"{p['id']:<14} {len(p['melody']):>3} notes  {max(n[0] + n[1] for n in p['melody']):>5.1f} beats")
