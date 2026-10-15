#!/usr/bin/env python3
"""Checks the year's quests and the day's jobs in content/base/pack.json (docs/world-economy.md §9): every month has
at least four calendar quests, and every stage can be done in its season — whatever it asks to bring can be found,
caught, bought, made or cooked then, or was handed over before. Exits non-zero on any problem."""
import json
import pathlib
import sys
from datetime import date, timedelta

pack = json.loads((pathlib.Path(__file__).resolve().parent.parent / "content" / "base" / "pack.json").read_text(encoding="utf-8"))
items = {i["id"]: i for i in pack["items"]}
stations = {s["id"]: s for s in pack.get("stations", [])}
recipes = {r["id"]: r for r in pack.get("recipes", [])}
locked = {l["id"] for l in pack["locations"] if l.get("requires")}
# a place open only on certain days (the Other Side on the rift days) gives its finds on those days
locked = {l for l in locked if set((next(x for x in pack['locations'] if x['id'] == l).get('requires') or {}).keys()) - {'days', 'hint'}}
problems = []
SEASON_OF = {12: "Winter", 1: "Winter", 2: "Winter", 3: "Spring", 4: "Spring", 5: "Spring", 6: "Summer", 7: "Summer", 8: "Summer",
             9: "Autumn", 10: "Autumn", 11: "Autumn"}


def easter(y):
    a, b, c = y % 19, y // 100, y % 100
    d, e, f = b // 4, b % 4, (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = c // 4, c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    return date(y, (h + l - 7 * m + 114) // 31, (h + l - 7 * m + 114) % 31 + 1)


FIXED = {"new_year": (1, 1), "epiphany": (1, 6), "valentine": (2, 14), "womens_day": (3, 8), "labour_day": (5, 1), "remembrance": (5, 8),
         "childrens_day": (6, 1), "kupala": (6, 24), "constitution": (6, 28), "statehood": (7, 15), "honey_spas": (8, 1), "apple_spas": (8, 6),
         "independence": (8, 24), "knowledge_day": (9, 1), "defenders": (10, 1), "halloween": (10, 31), "st_andrew_eve": (11, 30),
         "st_nicholas": (12, 6), "christmas_eve": (12, 24), "christmas": (12, 25), "new_year_eve": (12, 31)}


RIFT_IDS = ["spring_equinox", "summer_solstice", "autumn_equinox", "winter_solstice"]


def holiday_date(h, y):
    if h in RIFT_IDS:
        import importlib.util, pathlib
        spec = importlib.util.spec_from_file_location("gen_solstices", pathlib.Path(__file__).resolve().parent / "gen_solstices.py")
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod.days(y)[RIFT_IDS.index(h)].date()
    e = easter(y)
    return {"easter": e, "palm_sunday": e - timedelta(7), "trinity": e + timedelta(49), "maslyana": e - timedelta(55)}.get(h) or date(y, *FIXED[h])


def window(w, y):
    if w.get("holiday"):
        d = holiday_date(w["holiday"], y)
        return d - timedelta(w.get("before", 0)), d + timedelta(w.get("after", 0))
    s = date(y, *w["from"])
    e = date(y, *w["to"])
    if e < s:
        e = date(y + 1, *w["to"])
    return s, e


def seasons_in(s, e):
    out = set()
    d = s
    while d <= e:
        out.add(SEASON_OF[d.month])
        d += timedelta(1)
    return out


def tagged(key):
    if key.startswith("#"):
        return [i for i, d in items.items() if key[1:] in d.get("tags", []) or d.get("category") == key[1:]]
    return [key]


# where each thing can be got, by season: spots and fishing (seasonal), stations (seasonal), recipes
sources = {}


def add(item, season, how):
    sources.setdefault(item, []).append((season, how))


for l in pack["locations"]:
    if l["id"] in locked:
        continue
    for s in l.get("spots", []):
        for g in s.get("gives", []):
            for se in g.get("seasons") or ["Spring", "Summer", "Autumn", "Winter"]:
                add(g["item"], se, f"spot {s['id']}")
    for f in l.get("fishing", []):
        for g in f.get("fish", []):
            for se in g.get("seasons") or ["Spring", "Summer", "Autumn", "Winter"]:
                add(g["item"], se, f"fishing {f['id']}")
for s in stations.values():
    if s["location"] in locked or s.get("requires"):
        continue
    for g, _ in s.get("gives", []):
        for se in s.get("seasons") or ["Spring", "Summer", "Autumn", "Winter"]:
            add(g, se, f"station {s['id']}")


def obtainable(key, season, depth=0, given=()):
    for it in tagged(key):
        if it in given:
            return True
        if any(se == season for se, _ in sources.get(it, [])):
            return True
        if depth < 2:
            for r in recipes.values():
                if r["gives"][0] == it and all(obtainable(k, season, depth + 1, given) for k, _ in r["needs"]):
                    return True
    return False


per_month = {y: [0] * 12 for y in (2026, 2027)}
for q in pack.get("quests", []):
    w = q.get("when")
    if not w:
        continue
    for y in per_month:
        s, e = window(w, y)
        months = set()
        d = s
        while d <= e:
            months.add(d.month)
            d += timedelta(1)
        for m in months:
            per_month[y][m - 1] += 1
    s, e = window(w, 2026)
    for season in seasons_in(s, e):
        given = {g for g, _ in q.get("start_gives", [])}
        for i, st in enumerate(q["stages"]):
            act = st["act"]
            where = f"{q['id']} stage {i} ({season})"
            if act["do"] == "bring":
                for k, _ in act["items"]:
                    if not obtainable(k, season, given=tuple(given)):
                        problems.append(f"{where}: cannot get {k}")
            elif act["do"] == "use":
                stn = stations[act["station"]]
                if stn.get("seasons") and season not in stn["seasons"]:
                    problems.append(f"{where}: {act['station']} is shut in {season}")
                for k, _ in stn.get("needs", []):
                    if not obtainable(k, season, given=tuple(given)):
                        problems.append(f"{where}: {act['station']} needs {k}")
                given |= {g for g, _ in stn.get("gives", [])}
            elif act["do"] == "cook":
                for k, _ in recipes[act["recipe"]]["needs"]:
                    if not obtainable(k, season, given=tuple(given)):
                        problems.append(f"{where}: {act['recipe']} needs {k}")
                given.add(recipes[act["recipe"]]["gives"][0])
            elif act["do"] == "gather":
                it = act.get("item")
                loc = act["location"]
                ok = any(se == season and (how.startswith("spot " + loc) or how.startswith("fishing " + loc) or loc in how) for x in ([it] if it else list(sources)) for se, how in sources.get(x, []))
                if not ok:
                    problems.append(f"{where}: nothing to gather at {loc}" + (f" ({it})" if it else ""))
                if it:
                    given.add(it)
            for g, _ in st.get("gives", []):
                given.add(g)
            if act["do"] == "choose":
                for o in act["options"]:
                    given |= set(o.get("reward", {}).get("items", []))
for y, counts in per_month.items():
    for m, n in enumerate(counts):
        if n < 4:
            problems.append(f"{y}-{m + 1:02}: only {n} calendar quests")
for j in pack.get("jobs", []):
    seasons = j.get("seasons") or ["Spring", "Summer", "Autumn", "Winter"]
    for season in seasons:
        given = {g for g, _ in j.get("start_gives", [])}
        for i, st in enumerate(j["stages"]):
            act = st["act"]
            if act["do"] == "bring":
                for k, _ in act["items"]:
                    if not obtainable(k, season, given=tuple(given)):
                        problems.append(f"job {j['id']} stage {i} ({season}): cannot get {k}")
            if act["do"] == "use":
                given |= {g for g, _ in stations[act["station"]].get("gives", [])}
            for g, _ in st.get("gives", []):
                given.add(g)
    for p in j.get("places", []):
        if p in locked:
            problems.append(f"job {j['id']} sends people to the locked {p}")

for p in problems:
    print("PROBLEM:", p)
print(f"{len(pack.get('quests', []))} quests, {len(pack.get('jobs', []))} kinds of jobs; per month {per_month[2026]}")
sys.exit(1 if problems else 0)
