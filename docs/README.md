# teul — documentation

[Українською](README.uk.md)

**In short.** teul is an offline world in pixel isometry: the small town of **Lypove (Липове)** with its forest, fields, farm and outskirts. It lives by the device's real calendar and clock. The core is written in Rust, deterministic and event-sourced; the client is written in TypeScript; on Android the world runs through Capacitor, on a computer through Tauri. The game is fully offline and single-player.

## Principles that do not change

- **Determinism.** Everything that decides an outcome lives in the core (`crates/teul-core`). The core does not read a clock and has no `f64`. The same world seed, content and event log give the same world on any device. The client only asks and draws.
- **The real calendar.** Seasons, weekdays, holidays, Easter, the equinoxes and the full moon are real, by Kyiv time (`time::Calendar`, `holidays.rs`). There is no game clock.
- **Fully offline.** No servers and no accounts: the world lives only on the device, and it moves to another device as a backup file.
- **A world, not a game of tasks.** No quotas, counters, bars or instruction texts. When something is not possible, the world explains it in its own words. Warmth, mood and relationships show in looks, gestures and words, not numbers. The only number on screen about the weather is the temperature by the clock.
- **Nothing at home pays.** Coins come only from the town: work, requests, help, selling.
- **Language and tone.** The world is Ukrainian; there is an English translation (chosen in the settings, the first time by the device's language). Every client string is a key in the tables `app/src/lang/*.ts` with Ukrainian and English text; content words come from the overlay `content/base/en.json`; text written by the core is chosen by `Content::lang`. The language never changes the course of the world. The tone is international, with character: the holidays are secular, neutral and large-scale, while church dates stay quiet facts of the calendar.

## Documentation map

| File | About |
|---|---|
| [architecture.md](architecture.md) | Layers, events and the input log, snapshots, honest play, the frame and rendering, performance, saves, encryption, compatibility |
| [content.md](content.md) | The content pipeline: `gen_base_content.py`, maps, items, stations, residents, checks |
| [testing.md](testing.md) | Every test suite and the test URL flags |
| [release.md](release.md) | Releases: signed APK/AAB, Linux `.deb`/`.AppImage`, Windows `.exe` (Tauri), one version, the signing key |
| [glossary.md](glossary.md) | Glossary of terms |
| [world-economy.md](world-economy.md) | Technical specification of the economy and systems (code comments refer to its sections) |

Systems of the world (`docs/world/`):

| File | About |
|---|---|
| [time-and-calendar.md](world/time-and-calendar.md) | The calendar, holidays with their preparations, rifts, the full moon, sky events |
| [life.md](world/life.md) | Residents' schedules, exceptions, illness, the way to work |
| [feelings.md](world/feelings.md) | Moods, bonds between people, warmth toward the player |
| [town.md](world/town.md) | The town's growth and wear, community projects, births, rare days, ice cream, doughnuts |
| [paper.md](world/paper.md) | The newspaper: stories, photos, missed issues, the nuclear plant |
| [places.md](world/places.md) | All locations |
| [faiths.md](world/faiths.md) | The church, the temple, the old shrine |
| [weather-and-warmth.md](world/weather-and-warmth.md) | Temperature, feeling warm or cold, frost, ice, clothes |
| [economy.md](world/economy.md) | Coins, the pocket, stations, helps, work, the garden, skills |
| [home.md](world/home.md) | The home, the editor, extensions, bills, the kitchen, wear, crafting, tools, pets |
| [media.md](world/media.md) | Instruments and works, TV, radio, records, the computer |
| [drive.md](world/drive.md) | The driving school, the licence, cars, offences, the camera, money on the road |
| [horror.md](world/horror.md) | Eerie nights (switched on in the settings) |
| [rifts.md](world/rifts.md) | The four rift worlds and the town turned inside out |
| [taxi.md](world/taxi.md) | The taxi: price by distance, minutes and demand |
| [maps.md](world/maps.md) | "Maps" on the smartphone and the computer: streets, search, route, layers |
| [sitting-and-poses.md](world/sitting-and-poses.md) | Sitting, lying, poses |
| [hud-and-ui.md](world/hud-and-ui.md) | The top bar, the menu, windows |
| [rules.md](world/rules.md) | Rules for building the world |

## How to build and run

The project's tools are installed into `.toolchain/` (ignored by git):

```bash
bash scripts/install-toolchain.sh      # Rust stable + wasm32, wasm-bindgen-cli from Cargo.lock, JDK 21
source .toolchain/env.sh               # RUSTUP_HOME, CARGO_HOME, JAVA_HOME, ANDROID_HOME, PATH
```

| Step | Command |
|---|---|
| Generate the content | `python3 scripts/gen_base_content.py` → `content/base/pack.json` |
| Check the content | `python3 scripts/check_economy.py`, `python3 scripts/check_quests.py` |
| Core tests | `cargo test` (from the root) |
| All checks | `scripts/check.sh` (only what a change touched), `scripts/check.sh --full` (everything — before a merge and a release) |
| Core to WebAssembly | `cd app && npm run wasm` (= `scripts/build-wasm.sh --target web` → `app/src/wasm/`) |
| Development | `cd app && npm run dev` |
| Client unit tests | `cd app && npx vitest run` |
| Build for e2e | `cd app && npm run build:e2e` (mode `e2e`, which has `window.__teul`) |
| e2e | `npx vite preview --port 4300` and `BASE=http://localhost:4300/ node e2e/flows.mjs` |
| APK (debug) | `scripts/build-apk.sh` → `app/android/app/build/outputs/apk/debug/app-debug.apk` |
| Release (everything) | `scripts/release.sh` → `release/<version>/` (APK, AAB, `.deb`, `.AppImage`, `.exe`, `SHA256SUMS`, `INSTALL.md`), see [release.md](release.md) |
| Computer | `desktop/` (Tauri v2): `desktop/build-in-container.sh linux\|windows` |

Test URL flags work only in non-production builds (`import.meta.env.MODE !== 'production'`): `?debug` (the `window.__teul` hook), `?skip` (no splash screen), `?shift=<minutes>` (move the clock forward), `?lang=en|uk` (language for this session), `?rich` (a separate test world with 6000 coins), `?perf` (frame section timer), `?world=<id>` (another test world). Details in [testing.md](testing.md).
