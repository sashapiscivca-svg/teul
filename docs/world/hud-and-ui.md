# HUD and windows

[Українською](hud-and-ui.uk.md)

**In short.** Top left: a clock with the temperature and the name of today's holiday, and under it a line with the promise you are following. Top right: money, the pocket, the newspaper with the mail, and a single menu button with labelled tiles. Bottom: a joystick, the action button and two camera-rotation buttons. Windows have a title bar with the close cross built into it.

## Top bar (`ui/hud.ts`)

| Position | What |
|---|---|
| Left | `hud-tl`: day/night icon, "14:20 · +7°", holiday |
| Under the clock | `hud-quest`: the promise you are following (opens the notebook) |
| Right | Money; "Busk" (when you carry a portable instrument and are outdoors); the pocket with "used/slots"; newspaper and mail with an unread marker; menu |
| Menu (`hud-menu`) | Photo, Taxi (when not at home), Phone (when you have one), About me, Map, Cars, Residents, Notebook, Settings, Shop, Room |
| Bottom right | Action button with a label ("Enter", "Sit", "Gather", "Fish"…), with the camera rotations above it |
| Bottom left | Joystick (the side can be swapped in settings) |

The menu closes after a choice or a tap outside it.

## Doors, markers and the map

- **Doors.** Near the door of any building with an interior (and near your own home) the action button says "Enter"; tapping the building itself also takes you inside — the same for everyone. A small entrance marker bobs on the ground by nearby doors (yellow; green by your own home). There are no signs above the roofs: names are on the map.
- **The paper map** (`ui/papermap.ts`, key M, the "Map" tile): every place is a coloured pin with its own icon (homes are just houses), with names next to pins only where they don't cover others; the "Index" lists all places, and a tap finds the place on the map; "Plot a route" draws the road and leaves an arrow in the world.

## First letters

On the first morning there is a letter on the table from Baba Zlata (`scripts/first_letters.py`, quests of kind `letters`):
1. "Letter on the table" — how to walk, what the action button does, how to go outside (the door with the porch) and come back; the step "Go outside" counts by itself as soon as the hero is outdoors;
2. "Letter about the board" — the house, bills, the notice board;
3. "Letter about the market";
4. "Letter about the vegetable patch";
5. "Letter about people" — the map, taxis, work, the café.

There are no separate "welcome" letters from townsfolk: neighbours write once they already know you (from 2–3 hearts).

## Windows

- **Newspaper** (`ui/paper.ts`): the close cross is printed in the corner of the masthead, with "Fold the paper" at the bottom. See [paper.md](paper.md).
- **"Today in Lypove"** («Сьогодні в Липовому», `ui/daily.ts`): tabs Paper, Mail, Requests, Album, Stories, Bills, Me.
- **Other windows:**
  - pocket (`ui/pocket.ts`);
  - notebook (`ui/journal.ts`: Promised, Asked, Done, People);
  - residents (`ui/people.ts`);
  - "About me" (`ui/me.ts`): your name in town and which of your pets walks with you;
  - taxi (`ui/taxi.ts`);
  - cars for sale (`ui/cars.ts`, [drive.md](drive.md));
  - "Maps" (`ui/maps.ts`, [maps.md](maps.md));
  - wardrobe and hair salon (`ui/wardrobe.ts`, `ui/salon.ts`);
  - fridge, stove and bills (`ui/home.ts`);
  - workbench (`ui/craft.ts`);
  - builders (`ui/builders.ts`);
  - pets (`ui/pets.ts`);
  - smartphone (`ui/phone.ts`);
  - media (`ui/media/*`);
  - photo and album (`ui/photo.ts`);
  - community projects (`ui/projects.ts`);
  - "Backup" from settings (`ui/backup.ts`): save the world to a file under a passphrase, open a copy (replace this world or keep both), automatic copies of the last three days, worlds on the device ([architecture.md](../architecture.md#backup-and-moving));
  - settings (`ui/settings.ts`).
- **Toasts** (`ui/toast.ts`): identical words are not repeated while they are on screen.
- **Splash screen** (`ui/splash/*`): by default "Rift" — the town at night with a crack in the sky. Other options: "Depth", "Doors", "Seasons". There is also hero creation on first launch, without hints.

## Accessibility (`a11y.ts`, settings → "Accessibility")

All of this is how the world is shown on this device (`prefs.ts`, browser storage), not the world itself. The classes are set on `<html>`.

| Setting | What it does |
|---|---|
| Text size | Three steps (1; 1.15; 1.3): window cards, the shop, the HUD corners, conversation, toasts and captions scale together (`--ui-scale`, `a11y-text-1/2`) |
| High contrast | White words on black, white borders, a yellow focus ring (`a11y-contrast`) |
| Motion on screen | "System" (follows `prefers-reduced-motion`), "Reduced", "Full". Reduced: no lightning or camera flashes, no flicker, raindrops and heat haze stand still, interface animations are instant (`motionReduced()`, `a11y-still`) |
| Colour-blind colours | The Okabe–Ito palette for important signs: bubbles over things (`cueColor` in `pixel/scene.ts`), names of people who want to talk (plus ●), exits (plus ➜), icons (`a11y-cb`) |
| Large touch targets | Buttons and choices at least 46–52 px (`a11y-big`) |
| Plain font | A system font without pixels for windows, conversations, the newspaper and captions (`a11y-readable`) |
| Sound captions | A line at the bottom for sounds that matter: a knock at the door, thunder, fireworks, a siren, bells, whispers, footsteps… (`SOUND_CAPTIONS`, `Sound.at`/`loop` → `caption`); the same sound is captioned at most once every 6 s, and captions appear even with sound off |
| Joystick on the right | For left-handed play |

**Keyboard and screen readers.** Every window is a `role="dialog"` with `aria-modal` and a name (the `.ph b` title becomes `aria-labelledby`). When a window opens, focus moves into it; Tab stays inside it; Escape presses its close cross; when the window closes, focus returns to where it was opened from. The HUD menu: Enter opens it and focuses the first tile, arrow keys move between tiles, Escape folds the menu and returns focus to the button. Enter and Space on a button press only that button (the hero does not act at the same time). Safety net: a button without a name takes one from `title` or `data-label`. Language is in the same settings ("Language": Українська / English).

## Where in the code

`app/src/ui/hud.ts` (`Hud`, `closeMenu`, `setTaxi`, `setPhone`, `setBusk`), `app/src/style.css` (`.hud-*`, `.settings-card > .ph`, `.a11y-*`), `app/src/a11y.ts` (`applyA11y`, `installA11y`, `motionReduced`, `cueColor`, `caption`), `app/src/ui/settings.ts`, `app/src/prefs.ts`, `app/src/ui/screens.ts`, `app/src/main.ts`.
