# Rifts

[Українською](rifts.uk.md)

**In short.** On the spring and autumn equinoxes and the summer and winter solstices the world cracks open for a day:
- glowing cracks appear by the square, the lakes, the grotto, the cemetery and in the player's garden;
- each opens a separate world with its own palette, music, creatures, finds and chapter of the story;
- the winter crack leads into the same Lypove (Липове), only inside out: a shader, the northern lights, snow falling upwards, and instead of people, other creatures that live by the residents' schedules.

At midnight everything closes.

## When and where

`holidays::rift_day` (a table of dates for 2020–2060, Kyiv time), `sky::rift_world(date)`:

| Day | World | What is there |
|---|---|---|
| Spring equinox | `rift_spring` "The Sunken Orangery" («Затонула оранжерея») | Giant flowers, iron arches, lilies, seed spirits, gardeners |
| Summer solstice | `rift_summer` "The Salt Sea" («Соляне море») | A mirage city, a giant's ribs, a sundial, salt wanderers, glass beetles. This is where the little dragon's egg is found |
| Autumn equinox | `rift_autumn` "The Clockwork Garden" («Годинниковий сад») | Trees made of books, pendulums, a tower without hands, archivist owls, clock foxes |
| Winter solstice | `rift_winter` "Lypove Inside Out" («Липове навиворіт») | A copy of the finished town map without doors or sites |

- **Access.** These places are open only on their own day (`requires.days: ["rift_spring"]`…). On other days the doors say something of their own.
- **Finds:** `glow_seed`, `mirage_glass`, `brass_gear`, `future_page`, `upward_snow`.
- **Story.** Four separate chapters (`rift.ch1`–`ch4`), one in each world.
- **The cracks** stand by named places: the square, the forest lake, the lake in the pine wood, the crystal grotto, the cemetery. Coming back takes you to where you went in, including the garden.

## Lypove Inside Out

- **Look:** a WebGL shader (`wonders/post.ts`) inverts the colours and draws the northern lights, upward snow, wavy air and a vignette. Without WebGL a CSS filter is used.
- **Residents** following their own schedules become lantern-heads, moth people, figures with deer skulls, shadows (`wonders/creatures.ts`). There are no names and no cars.
- **Map:** the copy is made by `rift.py::make_mirror_town()` after the streets are widened, so the routes match.

## Where in the code

- Core: `holidays.rs` (`RIFTS`, `rift_day`, `rift_of`), `sky.rs` (`rift_world`, `RIFT_WORLDS`, stories).
- Content: `scripts/rift.py`.
- Client: `app/src/wonders/index.ts`, `worlds.ts` (`isRiftWorld`, `MIRROR_TOWN`), `creatures.ts`, `post.ts`, `fx.ts`.
- Tests: `crates/teul-core/tests/rift.rs`, `app/e2e/rift.mjs`, `app/e2e/wonders.mjs`.
