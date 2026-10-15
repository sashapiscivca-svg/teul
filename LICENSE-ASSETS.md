# Licence of the game's content

[Українською](LICENSE-ASSETS.uk.md)

Copyright © 2026 The Teul authors.

Teul's **code** is free software under the GNU Affero General Public License, version 3 or (at your option) any later version ([LICENSE](LICENSE)). Teul's **original content** — the things that make the world of Lypove what it is — is licensed differently, under the **Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International** licence (CC BY-NC-ND 4.0). The full legal text is in [LICENSES/CC-BY-NC-ND-4.0.txt](LICENSES/CC-BY-NC-ND-4.0.txt) and at https://creativecommons.org/licenses/by-nc-nd/4.0/legalcode.

## In short

- You **may** copy and share the content **unmodified**, for **non-commercial** purposes, as long as you credit it as “Teul, © The Teul authors” with a link to the project and to the licence.
- You **may not** use it commercially, or share adapted or modified versions of it, without permission.
- **Any other use needs written permission** from the copyright holder. Open an issue or write to the maintainers to ask.

The names and the icon of the game are not covered by any of these licences: see [TRADEMARKS.md](TRADEMARKS.md).

## What is content

The following is covered by CC BY-NC-ND 4.0 and not by the AGPL:

| What | Where |
|---|---|
| The content pack: the world's maps, places, interiors, items, recipes, stations, townsfolk, their names, schedules and words, the newspaper's stories, quests, holidays, the English overlay | `content/base/` (`pack.json`, `en.json`) |
| The world data and texts the content pack is generated from (the generators' code is code, the world they describe is content) | `scripts/*.py` that write the pack (everything run by `scripts/gen_base_content.py`), `scripts/lang/` |
| The music: the compositions and arrangements, and their recordings | `crates/teul-music/src/pieces.rs`, `places.rs`; `app/public/music/` (all `.ogg`, including `kit/` and `rec/`) |
| The graphics: icons, splash screens, the title art, and the look of the world — the buildings, people, animals, items and places as drawn by the game's procedural art | `app/public/*.png`, `app/android/app/src/main/res/` (the `mipmap-*` and `drawable*` images), `desktop/src-tauri/icons/`, the images the game draws |
| The screenshots and animation of the game | `docs/media/` |
| The texts of the world in the documentation | `docs/world/` |

Where one file holds both code and content (a generator script that also holds the world's texts, a module that draws a sprite), the program logic is under the AGPL-3.0-or-later and the creative content it holds or produces is under CC BY-NC-ND 4.0.

## Not ours

Third-party material keeps its own licence: the fonts (SIL Open Font License 1.1), and the dependencies listed with their licences in [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md). The seven records in `app/public/music/rec/` are our arrangements of melodies in the public domain; the melodies themselves stay in the public domain.
