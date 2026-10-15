# Spooky nights

[Українською](horror.uk.md)

**In short.** Spooky nights are turned on in the settings and are off by default. When on, they happen on Halloween, Walpurgis Night, Friday the 13th, Midsummer Night and on rift nights. After dark the town stops being itself: small eerie events happen, and whole night scenarios play out outdoors — a mob with torches and pitchforks, masked figures in the wheat, a chase. There is no blood, and no losses that last. You can walk away from every dialogue, and every night ends on its own. With the setting off, these nights stay gentle.

## When

`horror.ts::spookyTheme(night)` decides the theme of the night (`'halloween' | 'walpurgis' | 'friday13' | 'midsummer' | 'rift'`). A night belongs to its evening: from midnight until five it is still the previous night (`eveningOf`).

## What happens

- **Small events** (anywhere, including at home):
  - the lights flicker;
  - someone stands at the edge of sight;
  - a knock at the door;
  - the mirror;
  - a phone call with breathing on the line;
  - the TV turns itself on;
  - footsteps in the cave.

  Each one offers a choice that includes "leave".
- **Whole nights outdoors** (`wonders/nightmare.ts`):
  - **The mob.** 11 residents with (glowing) torches and pitchforks walk the streets. They come closer but keep 3–4 tiles away. The street lamps go out one by one.
  - **The field.** Masked, hooded figures stand in the wheat and creep closer the moment you look away. Then one suddenly appears right behind you.
  - **The chase.** A hunter runs slightly slower than the hero. Reach a lit doorway and the chase is over. If it catches you: a black screen, and you wake up at home at dawn with scratches on the door.
- **Atmosphere:** a red moon, fog, film grain, a vignette pulsing with a heartbeat, procedural sounds (`audio.ts`).

The figures walk along routes and do not pass through props.

## Where in the code

- `app/src/horror.ts` (themes, events, dialogues), `app/src/wonders/nightmare.ts` (night scenarios), `app/src/wonders/fx.ts`, `app/src/audio.ts`, the setting in `app/src/prefs.ts` and `ui/settings.ts`.
- Tests: `app/test/horror.test.ts`, `app/e2e/wonders.mjs`.
