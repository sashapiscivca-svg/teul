# Tests

[Українською](testing.uk.md)

**In short.**
- **Core:** `cargo test`, over 480 tests in `crates/teul-core/tests` (one test program, `tests/all.rs`) and in the modules.
- **Client:** `vitest`, over 480 tests in `app/test`.
- **Content:** scripts that check the economy and the stories.
- **e2e:** 35 scenarios in a real headless Firefox through WebDriver BiDi (`scripts/bidi.mjs`). They run against `vite preview` of the e2e build, which has the test hook `window.__teul`.
- **Tools, not tests:** the photo session (`shoot.mjs`) and performance measurements (`perf.mjs`).

## How to run

```bash
cargo test                                  # or scripts/check.sh — checks by the changed files; --full — everything
python3 scripts/check_economy.py && python3 scripts/check_quests.py
cd app && npx vitest run --testTimeout=30000   # the heavy wardrobe test on a busy machine
npm run build:e2e && npx vite preview --port 4300 --strictPort &
BASE=http://localhost:4300/ node e2e/flows.mjs
BASE=http://localhost:4300/ node e2e/growth.mjs /path/to/shots   # many scenarios take a folder for screenshots
```

`scripts/check.sh --full` is required before a merge and before a release; `--no-e2e` skips the e2e suites, `--base REF` compares with another branch.

## Test URL flags (non-production builds only)

| Flag | What it does |
|---|---|
| `?debug` | `window.__teul = { game, engine, … }`, render profiling |
| `?skip` | No splash screen, straight into the world |
| `?shift=<min>` | Moves the world clock forward by that many minutes (the world only goes forward, so each moment is in a fresh world) |
| `?rich` | A separate test world with 6000 coins |
| `?lang=en` / `?lang=uk` | Language for this session (not stored) |
| `?world=<id>` | Another test world (two worlds in one browser) |
| `?perf` | `game.perf` (`FramePerf`): the frame section timer |

None of this exists in a release (`vite build`, APK).

## e2e scenarios (`app/e2e`)

| File | What it checks |
|---|---|
| `lang.mjs` | English: no Cyrillic on the splash screen, in hero creation, the room, the paper, the menu, the notebook, the shop, a talk and the taxi; the language choice is kept |
| `erase.mjs` | "Delete account" in the settings: it first offers a copy, asks once more, and after "Yes" the world, the keys and the settings are gone and the game starts from the beginning |
| `trade.mjs` | The pocket: throw away (a second tap to be sure), give to someone nearby, sell to the market's buyer at the price shown; sell a used thing from the inventory for 40%; the gate between the garden and the vegetable plot is taken off and put back |
| `desktop.mjs` | A computer (mouse and keys): no joystick, settings in two columns without the phone rows, with "Full screen" and keys; M opens "Maps" with search, not the paper map; the wheel scrolls the row of things in the editor; on a touch screen the joystick and the phone rows are in place |
| `a11y.mjs` | Accessibility: names of every button of the bar and the settings, the menu by keyboard, focus into a window and back, Tab inside, Escape, text size, contrast, motion, colours, touch targets, the font, sound captions, all kept after a restart |
| `settings.mjs` | Every choice in the settings, with a finger and with a mouse: stored, shown as chosen and applied; the sound sliders follow the hand smoothly |
| `flows.mjs` | The main one, ≈130 checks: the splash screen, a hero without hints, the home, the editor, the shop, the pocket, the town, stations, helps, locked places, the paper, the taxi, seats, nobody gets stuck in props |
| `onboard.mjs` | A new world: the neighbour's letter waits on the first morning, and following it brings the next one; the paper map from the menu draws the way and leaves an arrow in the world |
| `fixes.mjs` | The first meeting with the world (name, pet), the camera holds still while watching TV, the garden from the action button, in the rain the town opens umbrellas or runs, the racecourse's stables and horses |
| `moves.mjs` | A hop and a crouch: keys on a computer (which can be set anew), two buttons on a phone |
| `solid.mjs` | The hero does not walk through a car, and a car moves them aside; the person one talks to stands still; small things on the ground are walked round or over |
| `terrain.mjs` | The lie of the land: the sides of a raised cell reach the ground without holes from every view angle; a high bank hides whoever stands behind it |
| `equip.mjs` | Hands and armour: a thing from the inventory goes where one taps next; X swaps hands; the left hand by the bottom bar; armour shows on the hero |
| `stallwork.mjs` | Counters and jobs: a counter opens every ware with its price and "Buy"; at the café one is taken on and works an evening shift; the job shows in "Me" and can be left |
| `square.mjs` | The square through the year (the fountain in summer, a fir in a tub in winter), the cinema «Зоря» (Zorya: a ticket, a seat, the film), "About me" in the menu |
| `games.mjs` | Table games: dominoes by the square, chess in the park, a whole game of draughts, the card game «Дурень» (Durak) |
| `sound.mjs` | Music and sounds by the state of the audio graph: the piece follows the hour, the season, the place, the rain and the feast; the ambience's layers follow the world around |
| `growth.mjs` | Building sites by stages, an unfinished building, an abandoned house, repairs, ice cream, «Пончикова» before and after it opens |
| `wonders.mjs` | The four rift worlds, the town inside out, eerie nights (nothing without the setting; the crowd, the field, the chase with it), an eclipse, a meteor shower, a comet, aliens |
| `rift.mjs` | Rifts and eerie nights in fresh worlds |
| `faiths.mjs` | The temple (cushions, offerings, people, the hero cross-legged and with palms together), the old shrine by day and at the full moon, the circle of people, the circle station |
| `paper.mjs` | The paper with photos, missed issues, the nuclear plant and the horizon, holidays with preparation, the Lunar New Year with a dragon, Lypove Day |
| `feel.mjs` | Faces and bubbles, getting acquainted, the people page in the notebook, a couple on a date, two who have fallen out, a friend who waves and comes over |
| `warmth.mjs` | A frozen lake and a flowing river, skates, frost, warmth by the stove, heat, rain, clothes, the temperature on the bar |
| `craft.mjs` | Wear and repair, the master, the workbench and recipes, «Господарчий», smartphones and laptops |
| `home.mjs` | The home as a person goes through it: every thing and action, the editor, the builders and a new room, pets |
| `plan.mjs` | The plan of the home: its parts told apart by walls, a row more or less on a side (windows move with the wall), a new part built, furnished, named and taken away with its things back in the inventory |
| `media.mjs` | Instruments, works, street performances, TV, radio, records, the computer |
| `seats.mjs` | Every seat, bed and bath, at home and in town, a contact sheet |
| `sitting.mjs` | Sitting down on the ground in the park and getting up, not on the road, deckchairs on the beach |
| `drive.mjs` | Lessons, theory, practice, the licence, a car from the service station, driving, a police stop, the coupon, the camera, the paper, a coin on the road |
| `taxi.mjs` | A list without duplicates, an honest price with the arrival time and the reason, closed places with an explanation, every ride costs exactly the price shown and ends on a free cell |
| `maps.mjs` | "Maps" from the smartphone and the computer: a map with street names and the hero's dot, search ("coffee", a name, "pharmacy"), a card with hours, description, photo and the week by days, "Who works when", hours on the paper map, a route, a taxi from the card at the price shown, dearer in the rain than on a clear day, layers |
| `backup.mjs` | "Backup": world A to a file under a passphrase, a too-short and a wrong passphrase, the file opened in world B gives the same state, the save in IndexedDB is sealed, "keep both" gives a second world |
| `storage.mjs` | A browser that refuses the site its storage (the web storage switched off; all cross-site data blocked with the game in another site's frame, as on itch.io): the game's own screen in the player's language with what to do and links to the game's page and downloads, never a raw error; with default privacy the same frame starts the game |
| `perf.mjs` | Frame measurements (not a test) |
| `shoot.mjs` | A photo session of the world (not a test) |

## Client unit tests (`app/test`, examples)

- **Rendering and geometry:** `character`, `seats`, `layers`, `iso`, `geometry`, `path`, `village`, `models`, `occupant`, `facing` (cars nose first).
- **Systems:** `faiths`, `growth`, `festive`, `parade`, `topics`, `warmth`, `wear`, `drive`, `feel`, `horror`, `wonders`, `rift`, `media`, `musicplayer`, `paperphoto`, `away`.
- **Saves:** `storage`, `history`, `engine` (through the real wasm).
- **Encryption and copies:** `sealed` (AES-GCM round trip, a changed byte / place / key, moving an old plain save, the 1.0 network features' entries are removed), `backup` (export → import on "another device" gives the same state hash, a wrong passphrase, daily automatic copies), `compat` (the 1.0 golden saves — see below).

## Core tests (`crates/teul-core/tests`, examples)

- **Content:** `base_content.rs` (the real pack: loading, overlaps, roads, reachability, the first session, the taxi, the full-moon circle, the temple).
- **Honesty and saves:** `determinism.rs`, `honesty.rs`, `snapshots.rs`, `core_hardening.rs`.
- **Update compatibility:** `golden_saves.rs` (the 1.0 golden saves from the full log and from a snapshot), `retired.rs` (a hand-made 1.x log with the world beyond the edge and friends opens whole; what was retired is counted apart, never as tampering), `variants_kept.rs` (no 1.0 command or event variant is gone unless it is retired), `content_ids_kept.rs` (no 1.0 content id is gone without an alias or the retired list), `aliases.rs` (a renamed id: an old save opens whole).
- **Calendar:** `calendar_days.rs` (weekdays, Easter, holidays, school, rifts, full moons), `calendar_quests.rs`.
- **Life:** `life*.rs`, `feelings.rs`, `town.rs`, `growth.rs`, `sky.rs`, `paper.rs`.
- **Economy and home:** `stations.rs`, `pocket.rs`, `helps.rs`, `quests.rs`, `work.rs`, `garden.rs`, `skills.rs`, `bills.rs`, `fridge.rs`, `cooking.rs`, `craft.rs`, `home_more.rs`.
- **Other systems:** `style.rs`, `warmth.rs`, `media.rs`, `drive.rs`, `rift.rs`, `taxi_pricing.rs`, `perf.rs`.

There are also tests in `crates/teul-music` and `crates/teul-wasm`.

## Golden saves

`crates/teul-core/tests/fixtures/saves/*.json` are four worlds saved by version 1.0: a new one (`fresh`), one lived in for four days with 43 commands (`played`), and a pair of friends with parcels both ways (`friends_a`, `friends_b`). They were made once by `app/test/compat.test.ts`, and nobody rewrites them. Every new version must open them whole — both in the client (`compat.test.ts`) and in the core (`golden_saves.rs`). This version no longer has friends or parcels: in `friends_a` and `friends_b` they are passed over as retired, the tests check the exact count of what was retired, and everything else (coins, the home) opens as it was. If such a test fails, a change has broken old saves: it needs a migration step, an alias or a retirement, not a new fixture (see [architecture.md](architecture.md#save-integrity-and-compatibility)). After each release it is worth adding another golden save of the new version.

## Where in the code

`scripts/bidi.mjs` (`withFirefox`, `newPage`, `activate`), `app/e2e/*.mjs`, `app/test/*.test.ts`, `crates/teul-core/tests/*.rs`, `scripts/check.sh`.
