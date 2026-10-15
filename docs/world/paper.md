# The newspaper: «Lypove Herald» («Липовий вісник»)

[Українською](paper.uk.md)

**In short.** A newspaper comes out every morning: the headline of the day with a photo, two or three short stories with photos, an interview with a resident, "In Brief", "Coming Up" and "Notices". Each photo is taken from the real scene on that date — season, weather, light, decorations, people — and printed as a grainy duotone. If the player has been away for a few days, the missed issues (up to 5) lie by the door with a short note. There is no separate "While you were away" screen.

## Where the stories come from (`paper.rs`)

`Story { id, day, weight, headline, text, photo: Option<PhotoHint> }`. A photo is a `PhotoHint { place, at, props, people, minute, far }`: the place, the spot that must be in frame, the hour, and whether it is a panorama.

Stories come from providers (`providers()`). The paper sorts them by weight and takes the front page plus a few more:

| Provider | What | Weight |
|---|---|---|
| `life_stories` | Yesterday's events from the simulation: a fire, a theft… | fire 9 |
| `town_stories` | Births and deaths (12), weddings (11), moves, things built, things opened | 11–12 |
| `holiday_stories` | Preparations two days before and on the eve (6), the holiday itself (8), "After the holiday" (5) | 5–8 |
| `npp_stories` | Steps in building the nuclear power plant: 10 on the first day, 7 on the next | 7–10 |
| `driver_stories` | "Police Blotter", "Roads", "Lost and Found" (`drive.rs`) | per event |
| `sky_stories` | Eclipses, meteor showers, a comet, aliens (10), rifts (`sky::stories`) | 1–10 |

A new system only has to write a function `fn(&Core, WorldTime) -> Vec<Story>` and add it to `providers()`.

## The power plant beyond the fields (`npp.rs`)

A quiet story that follows the real calendar and is the same for everyone:

| Date | Step |
|---|---|
| 5 October 2026 | Rumours (geologists drilling in the field) |
| 26 October 2026 | Announcement |
| 14 November 2026 | Public hearing at the town hall |
| December 2026 | Debates; on 5 December a protest with placards on the square |
| January 2027 | Approval |
| March 2027 | The site is fenced off |
| April 2027 | Workers rent rooms |
| June 2027 | Cranes on the horizon |
| October 2027 | Cooling towers |
| June 2029 | The dome |
| September 2031 | First power |

Every resident has a fixed opinion of their own: for, against, or undecided. The construction can be seen on the horizon of the title screen and in the newspaper's panoramas (`plantOnHorizon`).

## Missed issues

`welcomeBack()` → `AwayIssues`: up to 5 missed issues with their front-page photos. The note on top is up to three lines: holidays, who asked for something, mail, bills.

## Interviews

When a journalist is nearby, the player can answer a question once a day (`Interview`). The next morning the paper quotes them.

## Where in the code

- `crates/teul-core/src/paper.rs` (`Story`, `PhotoHint`, `providers`, `stories_of`), `economy.rs::paper_view`, `npp.rs` (`npp_at`, `npp_story`).
- `app/src/ui/paper.ts` (`PaperSheet`), `app/src/paperphoto.ts` (rendering and printing the photos), `app/src/away.ts`, `app/src/nppdates.ts`.
