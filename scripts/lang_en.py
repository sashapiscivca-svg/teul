#!/usr/bin/env python3
"""The English words of the base pack: `content/base/en.json`, a text overlay the core lays over the pack when the
player reads in English (`Content::from_packs_in`). The fingerprint stays that of the Ukrainian pack, so the
language never changes an outcome.

Translations live in `scripts/lang/en/*.json` as {"Ukrainian text": "English text"}: the same words get the same
translation wherever they appear. The overlay mirrors the pack's shape and holds only the strings it replaces;
lists are keyed by their elements' `id` (or by position when they have none).

  python3 scripts/lang_en.py                     # writes content/base/en.json, lists what is missing
  python3 scripts/lang_en.py --missing out.json  # also writes the untranslated strings to out.json
  python3 scripts/lang_en.py --strict            # fails when anything is missing or wrong
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
CYR = re.compile("[А-Яа-яЄєІіЇїҐґ]")
HOLE = re.compile(r"\{[a-z_0-9]+\}")


def memory() -> dict:
    tm = {}
    for f in sorted((ROOT / "scripts" / "lang" / "en").glob("*.json")):
        tm.update(json.loads(f.read_text(encoding="utf-8")))
    return tm


def build(pack: dict, tm: dict):
    missing, wrong = [], []

    def walk(x):
        if isinstance(x, str):
            if not CYR.search(x):
                return None
            en = tm.get(x)
            if en is None:
                missing.append(x)
                return None
            if CYR.search(en) or sorted(HOLE.findall(en)) != sorted(HOLE.findall(x)):
                wrong.append((x, en))
                return None
            return en
        if isinstance(x, list):
            out = {}
            for i, el in enumerate(x):
                key = el["id"] if isinstance(el, dict) and isinstance(el.get("id"), str) else str(i)
                v = walk(el)
                if v is not None:
                    out[key] = v
            return out or None
        if isinstance(x, dict):
            out = {}
            for k, el in x.items():
                v = walk(el)
                if v is not None:
                    out[k] = v
            return out or None
        return None

    return walk(pack) or {}, missing, wrong


def main() -> int:
    pack_path = ROOT / "content" / "base" / "pack.json"
    pack = json.loads(pack_path.read_text(encoding="utf-8"))
    text, missing, wrong = build(pack, memory())
    out = pack_path.with_name("en.json")
    out.write_text(json.dumps({"lang": "en", "pack": pack["id"], "text": text}, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    uniq = sorted(set(missing))
    print(f"wrote {out}: {len(uniq)} strings without English, {len(wrong)} wrong")
    for uk, en in wrong[:20]:
        print(f"  wrong: {uk!r} -> {en!r}")
    if "--missing" in sys.argv:
        pathlib.Path(sys.argv[sys.argv.index("--missing") + 1]).write_text(json.dumps(uniq, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    if "--strict" in sys.argv and (uniq or wrong):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
