# Residents' lives

[Українською](life.uk.md)

**In short.** Over a hundred residents live by a deterministic simulation. Every 10 world minutes each of them decides what to do: sleep, work, study, eat, go shopping, rest. The decision depends on their schedule, their needs (food, money, company) and the state of the world. The world seed brings illnesses, thefts, fights and fires. Each day's schedule is individual and has exceptions. The same seed and date give the same day, so the residents' state is never saved but computed afresh each time.

## Daily schedule (`life.rs::plan_of`)

| Part | How it is decided |
|---|---|
| Waking and sleeping | Children 7:00/20:30, elderly 6:00/21:00, young people 7:30/23:45, adults 6:30/~22:00, with a few minutes' scatter each day |
| Work | From the job at a site (`jobs`: `role`, `from`, `to`, `days`). Someone who works alone keeps the hours all week except Sunday. Where there are several people, each has their own day off. Long shifts are split into an early and a late half, alternating weekly. Nobody arrives to the minute |
| School | Children on school days, ~7:45–13:30 and longer |
| Day off | They sleep longer. Offices and shops on the `SHUT_ON_HOLIDAYS` list are closed on public holidays |
| Holiday leave | Once a year, a week or two, between May and October. Spouses go together. ~40% leave town (`Away`); the others stay at home |
| Mass | For believers (≈75% of the elderly, ≈45% of adults, ≈50% of children) on Sundays 9:20–11:00, some of the elderly also on weekday evenings |
| Coffee on the way | Sometimes before work, if the café is already open. Freelancers with laptops sit in the café in the morning (see `tech.rs`) |
| Errands | Shop, post office, pharmacy, flowers, library, bills |
| Visits | Birthdays, dinners, couples' dates (`town_visits`), holidays |
| Storm | Those who are free stay at home |

**Activities** (`Activity`): `Sleep`, `Home`, `Work`, `School`, `Eat`, `Shop`, `Leisure`, `Sick`, `Injured`, `Arrested`, `Firefight`, `Patrol`, `Interview` (a journalist asks questions), `Away` (holiday out of town).

**Incidents** (`IncidentKind`): theft, a fight, a fire and others. They are recorded and retold (`life::tell`) in news, gossip and the newspaper. Someone who falls ill goes to the doctor on the first day, firefighters put out fires, the police patrol. The simulation keeps incidents for the last 7 days (`KEEP_DAYS`).

**The years go by** (`town::Population`): children grow up, adults retire, families move in and out, children are born, old people die. See [town.md](town.md).

## On screen

- `app/src/life.ts` turns an activity and a place into a pose and a route: walks along paths, couples side by side, prams, carts, walking sticks. Seats and occupied places: `seats.ts`.
- Residents dress for the real temperature (`dressing.ts`) and carry phones and laptops (`gadgets.ts`).
- A conversation with a resident (`talk.ts`) is made of their words, mood, gossip and the town's topics.
- At midnight the world computes the new day in about 5 ms.

## Where in the code

- `crates/teul-core/src/life.rs`: `plan_of`, `DayPlan`, `Life::advance`, `Life::view`, `schedule_view`, `tell`.
- `crates/teul-core/src/npc.rs`: story characters (not residents).
- `app/src/life.ts`, `app/src/game.ts` (`updateLife`, `residentFigures`), `app/src/mobility.ts`, `app/src/dressing.ts`, `app/src/talk.ts`.
- Content: `scripts/residents.py`, `scripts/village_people.py`.
