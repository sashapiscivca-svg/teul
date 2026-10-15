# Sitting, lying and poses

[Українською](sitting-and-poses.uk.md)

**In short.** The client does not guess how to sit or lie on an item; it reads it from the item's model: the seat height, the facing (away from the backrest), and whether the item is something you lie on. The rule is the same for the hero and the townsfolk. Outdoors you can sit right on the ground: on grass, sand or the square, but not on the roadway. The beach has sun loungers. When the hero ends up behind a building, a tree or the back of a bench, they show through it, semi-transparent.

## Rules (`seats.ts`)

- **`seatMode(def, action)`** returns `sit`, `lie`, `bath` or nothing:
  - beds, the hammock and the sun lounger (`sun_lounger`) are for lying;
  - the fireplace, the kotatsu and the bandstand only look like seats.
- **`seatSpots(def, placement)`:** for each tile, the seat height (the highest wide part, not an armrest and not a cushion), the spot, and the facing away from the backrest. It is returned together with the item. At a picnic table people sit on the benches, not on the tabletop.
- **`sittingPose(item)`:** on a meditation cushion or a mat the pose is `lotus` (cross-legged, palms together); on everything else it is `sit`.
- **Taken seats.** Townsfolk do not take the computer chair at a desk (`PLAYER_DESKS`). Two people never sit on the same spot (`seatsTaken`).
- **Checks:** `app/test/seats.test.ts` goes through all 58 seats in four rotations; `app/e2e/seats.mjs` produces a contact sheet of 64 sittings.

## Character poses (`character.ts::PoseName`)

| Pose | What |
|---|---|
| `idle`, `walk` | Standing, walking (4 frames) |
| `sit` | Sitting on a seat, hands on knees |
| `lotus` | Cross-legged on the floor, palms together |
| `ground` | Cross-legged on the ground, hands on knees |
| `pray` | Standing, palms together in front of the chest |
| `wash` | Hands under the tap |
| `work` | A hammer going up and down |
| `eat` | An ice cream by the face |
| `crouch` | Squatting down |
| `pedal` | On a bicycle: hands on the handlebars, pedals turning (4 frames) |
| `piano`, `guitar`, `accordion`, `violin`, `bandura`, `sopilka` | Playing an instrument, with hand movement |

**Weather effects** (`Fx`): hugging oneself and shivering, breath vapour, sweat, ice skates. Faces have expressions (`expr`).

## The hero (`people/hero.ts`)

The hero (and their reflection in a mirror) is drawn by `heroLayers(look, dir, pose, frame, blink, fx)`. The signature is the same as `figureLayers`. The hero is a tall, slim figure with a small head, dressed as a traveller of today. The people of Lypove (Липове) and the pets are round-headed (`figureLayers`).

- **A 40×40 grid**, drawn pixel by pixel, with no scaling. The feet stand on row 38, the shadow on row 39. The layers are tagged with their size (`sizedLayers` / `layersSize` in `layers.ts`), so the renderer (`pixel/scene.ts`, `render.ts`) places them with the feet at the same point as the townsfolk's 32-pixel figures. Seats and the bicycle keep their own offsets.
- **Look.** All `look.*` settings are kept, among them:
  - `look.build` — the build (0 a woman's, 1 a man's). For an older hero without it, the build is guessed from the hairstyle and beard;
  - top 17 — a travel jacket with pockets;
  - bottom 6 — cargo trousers.
- **Speed.** Every frame is cached by `remember`. A new figure takes about 0.8 ms to build, only once per look and pose.
- **Sheet and checks:** `app/test/hero.test.ts`.

## Outdoors

- **Action button:** when nothing is nearby and the hero is standing on a free tile off the road, it offers «Sit». The pose becomes `ground` and the button turns into «Stand up». Taking a step cancels sitting (`game.ts::canSitHere`, `groundSit`).
- **The lake beach:** a row of sun loungers under umbrellas. You lie down on a lounger.
- **In the Catholic church and the temple** everyone faces the altar: the seats are turned, townsfolk stand facing the north wall, and the clergy face the people (`FACE_ALTAR`).
- **Semi-transparent hero:** after all entities, the scene draws the hero once more at 0.38 opacity. Where nothing covers the hero the picture does not change, and behind an obstacle you see a silhouette (`scene.heroGhost`).

## Where in the code

`app/src/seats.ts`, `app/src/character.ts` (`poseOf`, `drawFront`, `drawSide`), `app/src/mobility.ts`, `app/src/pixel/scene.ts` (`drawEntities`, `drawSeatOver`, `heroGhost`), `app/src/game.ts` (`sitOn`, `npcSeat`, `poseOnSeat`, `canSitHere`). Tests: `app/e2e/sitting.mjs`, `app/e2e/seats.mjs`.
