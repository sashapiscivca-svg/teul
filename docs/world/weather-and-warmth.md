# Weather, warmth and cold, ice, clothing

[Українською](weather-and-warmth.uk.md)

**In short.** The air temperature depends on the real date (the climate of central Ukraine), warm and cold spells, the hour of the day and the sky. It is shown as a number next to the clock, and that is the only number about the weather. How warm the hero feels is computed by the core from clothing, place, a nearby fire, wetness and hot food, and the client shows it only through screen and hero effects. Lakes freeze after frosty days; rivers keep flowing. Residents dress for the temperature.

## The air (`warmth.rs`)

- Monthly averages are interpolated. Warm and cold spells last 5 days (from the seed), with a daily curve from dawn to mid-afternoon. Rain and storms are colder. Snow falls only near zero.
- Values are integers in tenths of a degree.
- Panel: "14:20 · +7°" (with a true minus sign "−").

## How it feels (`comfort_view`, from −3 to +3)

**What it depends on:**
- **place:** outdoors, a heated building, home (warm only while there is gas; without it the street's cold seeps in), a cave, the rift worlds;
- **clothing:** indoors its warmth counts at half;
- **wetness:** rain without a raincoat or umbrella, just out of the water;
- **sun:** on a bare head in summer;
- **fire:** a stove, fireplace or bonfire within a few steps, and also the little dragon at home;
- **hot food:** something hot eaten or drunk within the last hour (the `warmed_at` field).

**How it shows** (`app/src/ui/feel.ts`, a layer over the scene):

| State | Effect |
|---|---|
| Cold | Pixel frost creeps in from the edges at three depths, with a bluish tint. The hero hugs themself and shivers, breath steams, steps are slower |
| By a stove | Flickering golden light |
| Heat | White haze at the top, shimmering air, sweat, the hero squints |
| Wet | Drops on the "lens" |

Effects fade in and out smoothly and freeze when reduced motion is on. Passers-by comment in their own words.

## Ice

Ponds and lakes (`Map.lake`, the `ice` field) build up frost in winter, and a thaw melts them three times as fast. Once the ice is thick enough you can walk and slide on it, arms out for balance. Swimming is not possible then. Rivers (`Map.line`) never freeze. Swimming is in summer from 10 to 19, when it is not raining.

## Clothing

- **The «Льон» (Flax) shop:** 71 items for all seasons:
  - windbreakers, trench coats, umbrellas;
  - sundresses, swimsuits, swim trunks, panama hats;
  - raincoats, sweaters, scarves;
  - puffer jackets, sheepskin coats, ear-flap hats, mittens, felt boots.

  Mittens have their own slot, `hands`. You change at home by the wardrobe or in the fitting room (`Dress`); hairstyles are done at the «Локон» (Curl) hair salon.
- **Residents** dress for the day's real temperature and their gender (`dressing.ts`).

## Where in the code

- `crates/teul-core/src/warmth.rs` (`comfort_view`, air, ice), `style.rs` (clothing, `Dress`, `Haircut`).
- `app/src/warmth.ts` (heat sources, hero effects, words, ice tiles), `app/src/ui/feel.ts`, `app/src/dressing.ts`, `app/src/ui/wardrobe.ts`, `app/src/ui/salon.ts`.
- Content: `scripts/style_items.py`, `scripts/style_world.py`.
