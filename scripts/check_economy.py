#!/usr/bin/env python3
"""Checks the world economy in content/base/pack.json (docs/world-economy.md): every reference exists, stations
stand at props that are really in their place, nothing at home earns, every need fits in a pocket, and — the
main thing — no dead ends: starting from the open places, everything locked can be opened, every help done,
every station used, every collection completed. Exits non-zero on any problem."""
import json
import pathlib
import sys

pack = json.loads((pathlib.Path(__file__).resolve().parent.parent / "content" / "base" / "pack.json").read_text(encoding="utf-8"))
items = {i["id"]: i for i in pack["items"]}
locs = {l["id"]: l for l in pack["locations"]}
npcs = {n["id"] for n in pack["npcs"]}
residents = {r["id"] for r in pack["residents"]}
stations = pack.get("stations", [])
helps = {h["id"]: h for h in pack.get("helps", [])}
pocket = pack.get("pocket", 8)
# what is asked for at once: by kinds, in the inventory
inventory = pack.get("inventory", pocket)
KINDS = {"buy", "sell", "make", "gather", "play", "wish", "read", "ride", "rest"}
SEASONS = {"Spring", "Summer", "Autumn", "Winter"}
problems = []


def bad(msg):
    problems.append(msg)


def tagged(tag):
    return [i["id"] for i in items.values() if tag in i.get("tags", []) and i.get("carry")]


def ref_ok(ref, where):
    if ref.startswith("#"):
        if not tagged(ref[1:]):
            bad(f"{where}: no carry item has tag {ref}")
    elif ref not in items:
        bad(f"{where}: unknown item {ref}")
    elif not items[ref].get("carry"):
        bad(f"{where}: {ref} is not a carry item (needs come from the pocket)")


def requires_ok(req, where):
    if not req:
        return
    for k in req:
        if k not in ("items", "helped", "hearts", "hint", "days", "leased", "flags"):
            bad(f"{where}: unknown requires field {k}")
    for i in req.get("items", []):
        if i not in items:
            bad(f"{where}: requires unknown item {i}")
    for h in req.get("helped", []):
        if h not in helps:
            bad(f"{where}: requires unknown help {h}")
    homes = {h["id"]: h for h in pack.get("homes", [])}
    for hid in req.get("leased", []):
        if hid not in homes or not homes[hid].get("rent"):
            bad(f"{where}: requires renting {hid}, which is not to rent")
    grown = {f"grow:{g['id']}:built" for g in pack.get("growth", {}).get("sites", [])}
    for f in req.get("flags", []):
        if f not in grown and not f.startswith(("project:", "open:")):
            bad(f"{where}: requires unknown town flag {f}")
    for npc, n in req.get("hearts", []):
        if npc not in npcs:
            bad(f"{where}: hearts of unknown npc {npc}")
    if not req.get("hint"):
        bad(f"{where}: a lock needs a hint")


# ---- references -----------------------------------------------------------------------------------------------
for it in items.values():
    if it.get("key") and it.get("carry"):
        bad(f"{it['id']}: a key is never in the pocket")
    if it.get("bag") and (it.get("carry") or it.get("key")):
        bad(f"{it['id']}: a bag is neither carried nor a key")
for loc in locs.values():
    requires_ok(loc.get("requires"), f"location {loc['id']}")
ids = set()
for s in stations:
    w = f"station {s['id']}"
    if s["id"] in ids:
        bad(f"{w}: duplicate id")
    ids.add(s["id"])
    if s["location"] == "home":
        if s["earn"] > 0 or (s["gives"] and not s["needs"]):
            bad(f"{w}: nothing at home earns or gives from nothing")
        continue
    if s["location"] not in locs:
        bad(f"{w}: unknown location {s['location']}")
        continue
    if s["prop"] not in {p["item"] for p in locs[s["location"]].get("props", [])}:
        bad(f"{w}: prop {s['prop']} is not in {s['location']}")
    if s["kind"] not in KINDS:
        bad(f"{w}: kind {s['kind']}")
    for n, k in s["needs"]:
        ref_ok(n, w)
        if k < 1:
            bad(f"{w}: need count {k}")
    for g, k in s["gives"]:
        if g not in items:
            bad(f"{w}: gives unknown item {g}")
    if len(s["needs"]) > inventory:
        bad(f"{w}: needs more kinds than an empty inventory holds")
    if not set(s["seasons"]) <= SEASONS:
        bad(f"{w}: seasons {s['seasons']}")
    if "hours" in s and not (0 <= s["hours"][0] < s["hours"][1] <= 24):
        bad(f"{w}: hours {s['hours']}")
    if s["per_day"] < 1:
        bad(f"{w}: per_day")
    if not s["label"] or not s["text"]:
        bad(f"{w}: label and text are needed")
    requires_ok(s.get("requires"), w)
for h in helps.values():
    w = f"help {h['id']}"
    if h["giver"] not in npcs and h["giver"] not in residents:
        bad(f"{w}: unknown giver {h['giver']}")
    if h["location"] not in locs and h["location"] != "home":
        bad(f"{w}: unknown location {h['location']}")
    for n, k in h["needs"]:
        ref_ok(n, w)
    for g in h["gives"]:
        if g not in items:
            bad(f"{w}: gives unknown item {g}")
    for a in h["after"]:
        if a not in helps:
            bad(f"{w}: after unknown help {a}")
    if len(h["needs"]) > inventory:
        bad(f"{w}: needs more kinds than an empty inventory holds")
    requires_ok(h.get("requires"), w)
for c in pack["collections"]:
    for i in c["items"]:
        if i not in items:
            bad(f"collection {c['id']}: unknown item {i}")
    if c["reward"] not in items:
        bad(f"collection {c['id']}: unknown reward {c['reward']}")
for q in pack.get("interviews", []):
    if not (3 <= len(q["answers"]) <= 4):
        bad(f"interview «{q['q']}»: 3 or 4 answers")

# ---- no dead ends: what can be had, starting from the open places ----------------------------------------------
have = set()      # items that can be had
done = set()      # helps that can be done
open_locs = {"home"}


def can_need(ref):
    return any(t in have for t in tagged(ref[1:])) if ref.startswith("#") else ref in have


def met(req):
    if not req:
        return True
    return all(i in have for i in req.get("items", [])) and all(h in done for h in req.get("helped", []))


links = {}
for lid, loc in locs.items():
    for e in loc.get("exits", []):
        links.setdefault(lid, set()).add(e["to"])
        links.setdefault(e["to"], set()).add(lid)
    # a crack of the rift (on its days) is a way to the Other Side and back
    # (each rift day opens into its own world: they all lie behind every crack)
    for world in ("rift_spring", "rift_summer", "rift_autumn", "rift_winter"):
        if any(p.get("rift") for p in loc.get("props", [])) and world in locs and lid != world:
            links.setdefault(lid, set()).add(world)
            links.setdefault(world, set()).add(lid)

changed = True
while changed:
    changed = False
    # places reachable through exits whose locks are met
    frontier = ["village"] if "village" in locs and met(locs["village"].get("requires")) else []
    seen = set(frontier)
    while frontier:
        lid = frontier.pop()
        # ways go both ways: an interior's exit to the street is also the door into it from the street
        for to in links.get(lid, ()):
            if to in locs and to not in seen and met(locs[to].get("requires")):
                seen.add(to)
                frontier.append(to)
    if not seen <= open_locs:
        open_locs |= seen
        changed = True
    gained = set()
    for lid in open_locs - {"home"}:
        for sp in locs[lid].get("spots", []):
            gained |= {g["item"] for g in sp["gives"]}
        for f in locs[lid].get("fishing", []):
            gained |= {g["item"] for g in f["fish"]}
    for s in stations:
        if s["location"] in open_locs and met(s.get("requires")) and all(can_need(n) for n, _ in s["needs"]):
            gained |= {g for g, _ in s["gives"]}
    for h in helps.values():
        if h["id"] not in done and h["location"] in open_locs and met(h.get("requires")) and all(a in done for a in h["after"]) and all(can_need(n) for n, _ in h["needs"]):
            done.add(h["id"])
            gained |= set(h["gives"])
            changed = True
    if not gained <= have:
        have |= gained
        changed = True

for lid, loc in locs.items():
    if lid not in open_locs:
        bad(f"dead end: location {lid} can never be reached")
for h in helps:
    if h not in done:
        bad(f"dead end: help {h} can never be done")
for s in stations:
    if not (s["location"] in open_locs and all(can_need(n) for n, _ in s["needs"])):
        bad(f"dead end: station {s['id']} can never be used")
for c in pack["collections"]:
    missing = [i for i in c["items"] if i not in have]
    if missing:
        bad(f"dead end: collection {c['id']} misses {missing}")

print(f"items {len(items)} (carry {sum(1 for i in items.values() if i.get('carry'))}, keys {sum(1 for i in items.values() if i.get('key'))}, "
      f"bags {sum(1 for i in items.values() if i.get('bag'))}), stations {len(stations)}, helps {len(helps)}, "
      f"interviews {len(pack.get('interviews', []))}, collections {len(pack['collections'])}, "
      f"locked places {sum(1 for l in locs.values() if l.get('requires'))}, inventory {inventory} kinds")
if problems:
    print("\n".join(problems))
    sys.exit(1)
print("ok: no dead ends")
