# Home

[Українською](home.uk.md)

**In short.** The player's home is a set of furnished rooms that can be arranged freely and extended for money. Utility bills (rubbish, water, electricity, gas) arrive every month, and an unpaid service gets cut off. There is a fridge and a stove with recipes. Things age and break; you mend them yourself or call a repairman. At the workbench you make things from materials with tools. Pets live with you. Nothing earns money at home.

## Furnishing

- **The gifted house** comes already furnished to a room plan (`homeplan.ts`): living room, kitchen, bedroom, bathroom, garden, vegetable patch, greenhouse.
- **Editor:**
  - a grid with a "ghost" of the item and highlighting of where it can and cannot go;
  - rotate, move, put away;
  - things on walls, rugs under furniture;
  - painting floors and walls (wallpaper);
  - switching rooms with arrows, up to the "Whole house" overview.
- **Windows** show the real time and weather; lamps glow at night.

## House plan (`sections.ts`, `ui/plan.ts`)

- **Parts of the house** are whatever the walls enclose: each room, the garden or the vegetable patch. No separate outline is stored anywhere; the name and type live in the room settings (`room.<x>_<y>.name|kind`) on any cell of the part. Without a name, the type is guessed from what stands there: a bed means bedroom, a stove means kitchen, glass walls mean greenhouse.
- **What you can do:**
  - name a part and say what it is: living room, home cinema, games room, workshop and so on;
  - add or remove a row on any side. Windows, doors and pictures move along with the wall, and things from a removed row go to the inventory;
  - remove a whole part. Its things go to the inventory and the area stays yours. A part holding the only way outside cannot be removed, nor can one without which the house would split in two;
  - build a new part of one of twelve types (small, medium or large). It comes with a door and furniture to plan right away (`homeplan.ts`: `lounge`, `cinema`, `games`, `hall`…), and the total price for area, furniture and door is shown before you press "Build".
- **Area is bought while building**, at `cell_price` coins per cell (`BuyArea` in the core, field `bought_area`). The shop no longer sells area. Area bought earlier is never taken away: while it lasts, building draws on it, and only then on coins. If you drag the floor by hand past your area, the world names the price first.
- **The home's name** (`home.name`) is set in the house plan; the home appears on the map under it.

## Extensions (`builds.rs`)

- **What can be added:** kitchen, bedroom, bathroom, workshop, music room, attic, cellar, upper floor (with stairs), terrace, yard.
- **Ordering:** at the utilities office or the town hall (`OrderBuild`), paid up front.
- **Construction** takes real days. The site stands next to the house: dug-up earth with a cement mixer, then walls in scaffolding, then the roof. Two builders work there during the day.
- **Handover:** a door or stairs open, and the new room gets its own floor, walls and furniture to plan.
- **Who may order:** only the owner of the home (tenants may not, `Tenant`). The town has one crew, so orders go one at a time.

## Bills and the utilities office (`home.rs`)

- **When:** the world's first month is free. After that a bill arrives on the 1st and must be paid by the 10th. Winter costs more.
- **Not paying:** the service is cut off until you pay (`UtilityOff`):
  - without electricity, lamps, the TV and the fridge stop working;
  - without gas, the stove is cold and so is the house;
  - without water, the bath and sink don't work;
  - without rubbish collection, bags pile up in the garden.
- **Where to pay:** the office (`utility_in`), weekdays 8–17.
- **Rent** for a flat, a house or the cottage at the edge of the forest is paid together with the bills.

## Fridge and stove

- **Fridge:** food from the pocket goes in and comes back out (`ToFridge`/`FromFridge`). Needs electricity.
- **Stove:** 20 recipes (omelette, pancakes, syrnyky, varenyky, borshch, yushka fish soup, honey cake, kompot, uzvar, paska, kalach, pumpkin porridge…). Some recipes must first be learned from people. Needs gas.

## Wear and repair (`wear.rs`)

- **Stages:** new → used → worn → broken. A thing ages with days and with use: it becomes used in 1–2 months and broken in about 7–11.
- **How it shows:**
  - colours fade, scuffs appear;
  - a lamp flickers;
  - a screen shows "snow";
  - a bed creaks.
- **Broken** things don't work and say so in their own words.
- **To fix:**
  - yourself with a repair kit (`Repair`; a broken thing only with the first level of crafting);
  - call a repairman from the office or by smartphone (`CallMaster`, daytime, for money).

## Crafting and tools (`craft.rs`)

- **Where:** at the workbench at home or in the «Друге життя» ("Second Life") workshop.
- **13 recipes:** repair kit, stool, starling box, wooden toy horse, scarf, mittens, motanka doll, shelf, picture frame, mug, fishing spoon lure, painted plate, wreath.
- **How you learn them:**
  - some are known from the start;
  - townsfolk you know teach others (Did Panas, Marta, Solomiia);
  - some are in the craftsman's book;
  - the rest you find by trying (`Tinker`): if nothing comes of it, the materials stay intact.
- **17 tools:** hammer, handsaw, screwdrivers, pliers, adjustable wrench, shovel, rake, hoe, watering can, bucket, axe, ladder, rod and reel, spoon lure, knitting needles, brushes, fertiliser.
  - A tool lasts a certain number of uses and then disappears with a line of its own.
  - Tools make crafting, repairs, gardening and fishing easier.
- **The «Майстер» ("Master") hardware store** (`hardware_in`, Mon–Sat 8–19) sells tools, materials and household goods.

## Pets (`pets.rs`)

| Animal | Where from |
|---|---|
| Cat, dog, rabbit | Chosen on the first day |
| Turtle | The vet clinic's shelter |
| Fox | A den in the forest: leave food on three different days, and on the next visit it follows you |
| Helper robot | The "Electronics" counter, once laptops appear in town |
| Little dragon | An egg from the summer rift world, 7 days in a warm nest at home |

- **Care** (`PetCare`): feed with pet food from the vet clinic, play, stroke. The robot needs charging, and after 30 days fixing with screwdrivers.
- **How they live at home:**
  - one pet walks with you, the rest stay at home (you choose who in the "About me" window);
  - the turtle heads for the bath;
  - the fox drags a sock around;
  - the robot goes to its charger;
  - the dragon sleeps by the stove and warms the air.
- A pet's state shows only through its behaviour. Townsfolk notice your pet on walks.

## Where in the code

- Core: `room.rs`, `home.rs`, `builds.rs`, `wear.rs`, `craft.rs`, `pets.rs`, `style.rs` (housing and rent).
- Content: `scripts/home_items.py`, `home_life.py`, `home_more.py`, `craft_items.py`.
- Client:
  - `app/src/homeplan.ts`, `sections.ts`, `wear.ts`, `site.ts`, `petlife.ts`, `pet.ts`;
  - `ui/home.ts`, `ui/craft.ts`, `ui/builders.ts`, `ui/pets.ts`, `ui/studio.ts`, `ui/plan.ts`, `ui/shop.ts`, `ui/me.ts`.
