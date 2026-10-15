# A town that keeps on living

[Українською](town.uk.md)

**In short.** The town changes as real days pass:
- houses go up stage by stage in the Novobudovna (Новобудовна) outskirts;
- some construction sites stall and stay unfinished;
- old houses fall empty and are later repaired;
- buildings wear out and handymen fix them;
- the community raises money for shared projects and builds them;
- people have birthdays and weddings, children are born, families move, the old die;
- there are rare days: a storm, a fair, a street musician, a lost tourist;
- in summer an ice-cream cart goes around, and the Donut Shop («Пончикова», Ponchykova) opens on the outskirts.

All of this is derived from the seed, the content and the calendar.

## Growth and wear (`growth.rs`)

| What | How |
|---|---|
| Construction | Pit → foundation → walls in scaffolding → roof → done. In winter (December–February), on Sundays and on public holidays the builders rest, so a house takes months to build. Moving in: a van stands by the house for 3 days |
| Unfinished building | Some sites stall at the walls for 240–540 days: a frame, graffiti, weeds. The `grow.nova7` plot always stalls |
| Abandoned house | Two old houses on Sadova Street may fall empty: boarded windows, weeds, darkness. They are repaired during the last 21 days before new residents arrive |
| Building wear | 17 buildings in turn get a crack, a broken window, peeling paint, a leaking roof or a dead street lamp. The damage lasts 10–44 days, then a handyman works on a ladder for 2–4 days (the `work` pose) |
| Flags | `grow:<site>:<stage>`, `grow:<site>:work`, `grow:<site>:moving`, `fix:<id>`, `mend:<id>`, `icecream`, `cart:<i>`. Map props with `flag`/`unflag` show the right stage |

Builders, handymen, movers, the ice-cream seller and the children in the queue are drawn by `app/src/growth.ts` (`growthFigures`). Each of them says something when tapped (`growthLine`).

## The ice-cream cart

From May to September, on dry days, 11:00–20:00. It stands for three hours each by the park, the pier and the square (`cart_stop_0..2`). A seller and 2–4 children in the queue. Four flavours (plombir, chocolate, strawberry, pistachio). Ice cream can be eaten on a bench (the `eat` pose).

## The Donut Shop

At first it is a construction site on the outskirts. The door is locked (`requires.flags: grow:donut_site:built`) with its own words. After it opens: the `donuts_in` interior, a baker and a saleswoman on a schedule, 4 kinds of donuts and coffee, tables.

## People over the years, and friendship (`town.rs`)

- **Birthdays and tastes.** Everyone has their own birthday and tastes: two things the person loves and one they don't want. Congratulating (`Congratulate`) adds warmth, and a gift to their taste adds the most. In the evening the person gathers friends at home.
- **Invitations and visits.** From 300 warmth points a friend invites you to dinner (19:00–21:30, `guest_home`, `Dine`). From 500 they drop by in the evening. People remember what you have done for them.
- **Years** (`Population`):
  - at 18 school ends, at 30 one is no longer young, at 65 comes retirement;
  - families arrive on their own day and sometimes leave;
  - couples have children (two years with a pram);
  - the old die, with a funeral two days later.
- **Rare day** (`day_town`):
  - a storm, sometimes with a power cut (`outage`);
  - a young couple's wedding on a summer Saturday;
  - a fair at weekends from spring to autumn;
  - a musician on the square in the evening (`musician`);
  - a lost tourist.
- **Community projects** (`projects`: a gazebo, the library roof, a playground, a small square, street lamps):
  - stages: fundraising → funded → construction → done;
  - the town hall takes contributions (`Contribute`).
- **Openings** (`openings`): seasonal kiosks, openings after a project.

## New technology (`tech.rs`)

A few weeks after the world begins (day 21) the post office gets a «Техніка» ("Gadgets") counter with smartphones, and from day 45 laptops too. The town takes them up gradually: young and busy people first, older people last, and a third of the elderly never. Residents look at their phones on benches, talk on the go and take photos at holidays. Freelancers with laptops sit in the café. The hero's own smartphone has a camera, Maps ([maps.md](maps.md)), taxi, weather, messages and a handyman call.

## Where in the code

- `crates/teul-core/src/growth.rs` (`growth_view`, `growth_flags`, `growth_news`), `town.rs` (`town_flags`, `town_day`, `Population`, `invitation`), `tech.rs`.
- Content: `scripts/town_growth.py`, `growth_items.py`, `growth_life.py`, `town_life.py`, `town_village.py`.
- Client: `app/src/growth.ts`, `app/src/gadgets.ts`, `app/src/ui/projects.ts`, `app/src/ui/phone.ts`.
