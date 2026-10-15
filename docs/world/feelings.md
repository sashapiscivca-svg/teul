# Feelings: mood, relationships, warmth towards the player

[Українською](feelings.uk.md)

**In short.** Every resident has a mood at any given moment. People are linked to each other: couples, families, friends, neighbours and rivals, crushes that turn into courtship and then a couple, quarrels and reconciliations. Each of them feels their own way about the player. All of this is a pure function of the seed, the town's people, the date and what the player has done. It is shown through faces, bubbles, gait, gestures and words, never through numbers.

## Mood (`feelings::Mood`)

| Mood | Where it comes from |
|---|---|
| `Joyful`, `Content`, `Calm` | Good weather, a holiday, a birthday, warm relationships |
| `Tired`, `Sleepy` | Work, a late hour |
| `Sad`, `Cross` | A quarrel, rain, illness of someone close |
| `InLove` | A crush, courtship |
| `Unwell` | Illness (from the simulation) |

The season, days off and a random daily swing also play a part. The client draws 7 facial expressions (front and side) and bubbles: a heart, a note, a cloud, anger, sleep, a drop, a wave, an exclamation mark. Someone happy bounces as they walk; someone sad walks slowly.

## Ties between people

- **Where from:** from content (spouses, families) and from the seed (friends, colleagues, neighbours, rivals among neighbours).
- **Crushes** between single adults: `crush` → `courting` → `sweethearts`, or they part. Couples on a date walk side by side in the evening.
- **Quarrels** pass, and a day of reconciliation follows. People who have fallen out do not talk; they glare with an anger bubble.
- **Gossip** tells of quarrels, reconciliations and new couples.

## Warmth towards the player (`feelings::Warmth`)

| Level | Points | How it shows |
|---|---|---|
| `Stranger` | not acquainted | "Good day." |
| `Known` | < 150 | "Oh, it's you!" |
| `Warm` | < 400 | Informal "you", wave from afar |
| `Close` | < 700 | Share a secret, sometimes have a little something for you (`AcceptGift`) |
| `Dear` | ≥ 700 | Pet names, come up to talk on their own |

- **Points come from:** conversation (`Talk`, rate-limited), gifts (taking tastes into account), help, birthday greetings, dinners.
- **Points are lost by:** a poor gift, a forgotten promise.
- **Fading:** without meetings warmth slowly fades (`Relation.last`), but not below two fifths.
- **Invitations:** from 300 points they invite you to dinner, from 500 they drop in to visit (see [town.md](town.md)).
- **Notebook:** the «Люди» (People) tab of the notebook describes the residents you know in words, plus up to four of their ties and a secret. There are no heart counters.

## Where in the code

- `crates/teul-core/src/feelings.rs`: `Mood`, `Warmth`, `feelings_view`, `kindness_today`, greetings.
- Commands `Talk`, `Gift`, `AcceptGift`, `Congratulate` (`core.rs`).
- `app/src/feel.ts` (mood lines), `app/src/townfeel.ts` (`TownFeel`: faces, bubbles, waves, couples, gait), `app/src/ui/journal.ts`, `app/src/ui/people.ts`.
