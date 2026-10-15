# Music and media

[Українською](media.uk.md)

**In short.** Six instruments can play 11 real pieces, each with the instrument's own live sound. How the playing sounds depends on skill. There is free play too. Out on the street, passers-by stop to listen. At home there is a record player with records, a radio with stations by the hour, a TV with a schedule on real time, and a computer with a desktop. The world's music is pre-rendered from scores and plays only while the app is on screen.

## Instruments and pieces

- **Instruments:** piano, guitar, accordion, violin, bandura, sopilka (a Ukrainian fipple flute). All except the piano can be carried and played on the street.
- **Sound:** every third semitone is rendered with rustysynth + GeneralUser GS; the notes in between are pitched in the browser.
- **Pieces** (`scripts/scores.py`):
  - Lullaby (Brahms);
  - «Come Out, Come Out, Little Sun» («Вийди, вийди, сонечко»);
  - «Ode to Joy»;
  - «Jingle Bells» («Дзвіночки»);
  - Minuet in G major;
  - «Silent Night»;
  - «Greensleeves»;
  - «Für Elise»;
  - Canon in D major;
  - «Moonlight Sonata» (the opening);
  - «Shchedryk» («Щедрик», Leontovych).
- **How you learn a piece:** three are known from the start. The rest come from sheet music (the book stall, the school, the Catholic church) or from the music teacher («Shchedryk» in winter).
- **Skill.** A beginner plays at 72% tempo with ~7% wrong notes and a thin bass; a master plays it as written.
- **Free play:** a 2-octave keyboard, guitar chords, violin and bandura strings, sopilka holes, a staff.
- **Poses:** from all four sides, with moving hands. The piano and the bandura come with a chair.
- **On the street** (`Busk`): people stop, turn to the hero, and clap at the end. The core decides the coins: no more often than once every 20 minutes, a hidden daily cap, nothing at night, never at home.

## Record player and radio

- **Records:** seven, sold at the radio station. The chosen record stays on the player.
- **Radio:** «Lypove FM» («Липове FM»), «Classics» («Класика»), «Native Wave» («Рідна хвиля»), by the hour of the day.

## The TV, «Lypove TV» («Липове ТБ»)

| Time | Programme |
|---|---|
| 0–6 | Test card |
| 6–9 | Morning news (newspaper headlines + weather) |
| 9–12 | Cartoons |
| 12–13 | Cooking show (recipe of the day) |
| 13–17 | Nature (cartoons at weekends) |
| 17–18 | Cartoons |
| 18–19 | Evening news |
| 19–21 | Concert (a real piece) |
| 21–24 | Film |

The second channel is the weather. The hero sits down on a sofa or an armchair, and the screen opens to one side so the room stays visible.

## Computer

An offline desktop:
- a diary;
- a paint app — the picture is printed in a frame to hang on the wall;
- a 16-step composer with the instruments' sounds;
- an encyclopedia of places and people you know;
- «Minesweeper»;
- the weather;
- «Maps» — a street map of Lypove (Липове) with search and routes ([maps.md](maps.md));
- arcade games (`arcade/*`: blocks, a maze, minesweeper, and a secret game from the cellar).

## Where in the code

- Core: `media.rs` (knowledge of pieces, `Busk`), `skills.rs`.
- Client:
  - `app/src/ui/media/*`: `instrument.ts`, `sampler.ts`, `arrange.ts`, `audience.ts`, `tv.ts`, `radio.ts`, `desktop.ts`, `composer.ts`, `scores.json`;
  - `app/src/musicplayer.ts` (two decks with crossfades), `app/src/audio.ts`.
- Content: `scripts/media_items.py`, `scripts/scores.py`, `scripts/build-media-audio.sh`, `scripts/build-music.sh`, `crates/teul-music`.
