# Time and calendar

[Українською](time-and-calendar.uk.md)

**In short.** The world runs on the device's real date and hour, in Kyiv time. Seasons follow the months. The calendar knows the days of the week, school days and holidays from school, and both national and town holidays. Easter and the Lunar New Year are computed every year; equinoxes, solstices and full moons come from tables. Big holidays have several days of preparation, the day itself, and a clean-up the next morning. The sky has eclipses, meteor showers, comets and, very rarely, aliens. All of this is made of pure integer functions of the date and the world seed.

## World time

- `WorldTime` is minutes since the world began. The world starts at local midnight on the day it was created. `Calendar::from_epoch` knows the date of the first day.
- **Seasons:** spring from 1 March, summer from 1 June, autumn from 1 September, winter from 1 December (`Calendar::season`). There is no in-game clock.
- `time::civil_from_days`/`days_from_civil` convert days since 1970-01-01 to a date and back.
- **On the panel:** the time and the outdoor temperature («14:20 · +7°»). The season is not labelled: you can see it in the world. If today is a holiday, its name is shown.

## The day (`holidays.rs::day_info`)

| Field | Meaning |
|---|---|
| `weekday`, `weekend` | The real day of the week |
| `holiday` | Today's holiday: `id`, name, `day_off`, `festive` (the town celebrates) |
| `day_off` | A weekend or a national public holiday: shops and offices are closed |
| `school` | Whether there are lessons: September–May, weekdays, outside school breaks (end of October, 24 December – 7 January, end of March) |
| `rift` | An equinox or solstice: the rifts are open |
| `full_moon` | A full moon tonight |

## Holidays

- **Big town holidays** (`festive: true`, with preparation):
  - New Year and New Year's Eve;
  - Lunar New Year (dates 2020–2060, `scripts/gen_lunar_new_year.py`);
  - Valentine's Day, International Women's Day;
  - Spring Carnival (last Saturday of March);
  - Earth Day (22 April);
  - Flower Festival (3rd Saturday of May);
  - Children's Day;
  - Midsummer Night (24 June, id `kupala`);
  - Lypove Day (День Липового, 2nd Saturday of July);
  - «Goodbye, Summer» («Прощавай, літо», last Saturday of August);
  - Harvest Fair (3rd Saturday of September);
  - Halloween;
  - Lantern Night (11 November);
  - Winter Lights Festival (2nd Saturday of December).
- **Small holidays:** April Fools' Day, Mother's Day, the Last Bell, the First of September.
- **Quiet dates** (`festive: false`, no town decorations): Epiphany, Easter, Palm Sunday, Pentecost (Трійця), Maslenitsa (Масляна), Christmas Eve, Christmas, St Nicholas Day, St Andrew's Eve (Андріївські вечорниці), the Saviour feasts (Спаси). National days (Constitution, Independence, Defenders, Statehood, Remembrance, May Day) only put out flags and give a day off where that is customary.

**Preparation** (`festival.rs::BIG`, `festival_at(day)`). Each big holiday has its own number of preparation days: Lypove Day 7 days; New Year's Eve 7 days, and it lasts 2 days.

| Phase | What happens |
|---|---|
| `prep` | Posters, stage scaffolding up to ¾ ready, garlands added every day, stalls appear as soon as they are half-built. People talk about it (`topics.ts`), the newspaper writes about it every other day |
| `day` | Everything is up, crowds, music. On the Lunar New Year an 8-segment dragon on poles walks down the main street at 11–12 and 16:30–17:30 (`parade.ts`) |
| `after` | In the morning, rubbish bags and half the decorations |

Fireworks (`pixel/fireworks.ts`): at midnight on New Year, at 22:00 on Lypove Day, in the evening of the Lunar New Year, and when the winter lights are lit.

## Rifts

On equinoxes and solstices (a 2020–2060 table, `RIFTS`) the world cracks for a day. Details in [rifts.md](rifts.md).

## Full moon

`holidays::full_moon(day)`: the `FULL_MOONS` table for 2020–2060 in Kyiv time (`scripts/gen_full_moons.py`, Meeus, ch. 49). Outside the table the mean synodic month is used, accurate to a day. On that day the town has the `full_moon` and `offerings` flags. Stations with `days: "full_moon"` are open on the full-moon evening until 4:00 the next morning. What happens that evening is in [faiths.md](faiths.md).

## The sky (`sky.rs`)

| Event | How it is decided | What you see |
|---|---|---|
| Solar eclipse | The `ECLIPSES` table (2021–2053: date, minute of maximum, coverage percentage for the region; ±80 min) | The sky darkens in daytime, birds fall silent, some people come out to the square with eclipse glasses |
| Meteor showers | Peaks: Quadrantids 3 Jan, Lyrids 22 Apr, Perseids 12 Aug, Orionids 21 Oct, Leonids 17 Nov, Geminids 14 Dec. Visible only on a clear night | Streaks in the sky, people on blankets on «Star Hill» («Зоряний пагорб») |
| Comet | From the world seed, about three per decade, lasting a few weeks | A tail in the night sky, a newspaper story on the first day |
| Aliens | From the world seed, about once every four years, between June and mid-October | Lights over the pasture, a beam, a cow in the sky. For a week the farm has one cow fewer, for 10 days there is a circle in the field, then the cow comes back wearing a bell. The newspaper writes about it (weight 10) |

The client decides who goes to watch (`wonders.gather`); the stories come from `sky::stories` (see [paper.md](paper.md)).

## Where in the code

- `crates/teul-core/src/time.rs`: `Calendar`, `WorldClock`, `Season`.
- `crates/teul-core/src/holidays.rs`: `day_info`, `holiday`, `easter`, `school_day`, `rift_day`, `full_moon`, `date_of`, `name_of`.
- `crates/teul-core/src/festival.rs`: `BIG`, `festival_at`, `Phase`.
- `crates/teul-core/src/sky.rs`: `sky_view`, `stories`, `rift_world`, `next_date`.
- `crates/teul-core/src/life.rs::day_view` (`DayView` for the client).
- `app/src/festive.ts`, `app/src/parade.ts`, `app/src/topics.ts`, `app/src/wonders/*`.
- Tables: `scripts/gen_solstices.py`, `gen_full_moons.py`, `gen_lunar_new_year.py`.
