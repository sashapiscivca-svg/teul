# Economy: coins, pocket, stations, work, garden, skills

[Українською](economy.uk.md)

**In short.** Coins come only from the town: thanks for requests and favours, work shifts, selling finds at the market, playing music in the street. Nothing at home ever pays. Pocket items are separate from furniture: the pocket has 8 slots, a pouch or backpack adds more, and the rest lies in the chest at home. Guiding keys hang on the key ring and take no space. Technical specification: [world-economy.md](../world-economy.md) §1–5, §9, §11.

## Pocket, bags, chest, keys

- **Capacity:** pocket 8; the "Pouch" («Торбинка») adds 8, the "Backpack" («Рюкзак») adds 20 (both from the wool farm). Only the best bag counts; bags do not stack.
- **Full pocket.** Finds and purchases don't fit (`PocketFull`). Gifts from people then go home to the chest.
- **Chest.** Moving things in and out (`Stash`/`Take`) works only at home.
- **Keys** (`key`) cannot be given, sold or put in the chest:
  - the old miner's lantern (opens the cave);
  - the cellar and tower keys;
  - the racecourse pass;
  - the craftsman's book;
  - the smartphone;
  - the driving licence and the car keys.

## Stations (206)

A place of action next to a prop: buy, sell, make, gather, play, make a wish, read, ride, rest. The core checks:
- place, hours, day, season;
- how many times it has been used today (`per_day`);
- `requires` and the town flag;
- coins, pocket items (by id or `#tag`), free pocket space.

When everything for today has been handed out, the world says so in its own words (`spent`). The market is made of stations with `earn` and a daily limit, so you can't get rich there.

## Favours (15)

One-off tasks that open the way: a key, a place, an acquaintance. Some come in a chain (`after`). Examples:
- "The Old Miner's Lantern" («Ліхтар старого шахтаря») opens the cave;
- "The Vineyard's Thirst" («Спрага виноградника») opens the vineyard;
- "A Snack for Quiz Night" («Закуска до вечора вікторини») gives the cellar key;
- "The Feast by the Tower" («Свято біля вежі») gives the tower key;
- "The Kitten by the Vet Clinic" («Кошеня біля ветклініки»).

## Requests and stories (65) and small daily needs (19 kinds)

- **Calendar stories** come back every year in their own window, 6–9 a month. Each rift day has its own chapter of the rift world's story.
- **Small daily needs** are drawn every morning, taking into account the season, the weather, who fell ill, what burned down. An invisible limit (5 in hand, 6 taken per day) keeps bots out.
- **Notebook:** "Promised / Asked / Done", with no counters or prizes. Thanks come at the end: coins, items, a recipe, a title, people's warmth.

## Work shifts (18 places)

| Job | Place | Shifts |
|---|---|---|
| Shift at the «Липа» ("Linden") café | `cafe_in` | 8–22, daily |
| Shift at the bakery | `bakery_in` | 5–21, daily |
| Sorting at the post office | `post_in` | 8–21, weekdays |
| A day on the farm | `farm` | 5–21, daily |
| An hour at the library | `library_in` | 10–21, weekdays |
| Shift at «Півонія» ("Peony") | `flower_in` | 9–21, except holidays off |
| Shift at the «Колосок» ("Ear of Wheat") till | `grocery_in` | 7–21, daily |
| Shift at «Льон» ("Linen") | `clothes_in` | 9–20, daily |
| Shift at «Локон» ("Curl") | `salon_in` | 9–20, daily |
| Shift at «Майстер» ("Master") | `hardware_in` | 8–20, daily |
| Shift at the doughnut shop | `donuts_in` | 7–21, daily |
| Shift at «Овечка» ("Little Sheep") | `creamery_in` | 7–21, daily |
| Shift at «Лапка» ("Little Paw") | `vet_in` | 8–19, daily |
| An evening behind the bar at «Жабка» ("Little Frog") | `bar_in` | 16–23, daily |
| Shift at the «Лелека» ("Stork") reception | `hostel_in` | 7–22, daily |
| Shift at the «Гайка» ("Nut") service station | `sto_in` | 8–20, daily |
| Shift at «Липовий вісник» ("Lypove Herald") | `newsroom_in` | 9–19, weekdays |
| Shift at «Липове FM» ("Lypove FM") | `radio_in` | 8–22, daily |

- **Hiring.** First you take the job on site (`TakeJob`) — at any hour while you are there; you can quit from anywhere (`LeaveJob`; a shift in progress ends and is paid). You can hold several jobs. Anyone who worked somewhere before hiring existed keeps working there.
- **How a shift goes.** Once a day within the place's hours (`StartShift`), the last one starting at least an hour before closing. Every task comes from the world, and you cannot answer faster than a person could (`gap`; a world minute is a real minute). Pay comes at the end (`EndShift`): correct answers × rate, plus one extra rate for a full shift.
- **Memory.** The place remembers how reliable you are.

## Vegetable patch and garden

- **What grows:** 13 plants (tomatoes, cucumbers, carrots, potatoes, cabbage, pumpkin, strawberries, dill, sunflower, apple, cherry, pear, plum).
- **Growth** is counted in real days: the planting day, days of watering and rain.
- **Drought:** a few dry days in a row and a plant wilts; more and it dies.
- **Trees** bear fruit in their season.
- **Plots:** at home, on a rented plot by the field, in the greenhouse (grows all year).

## Skills (`skills.rs`)

- **Six skills:** fishing, cooking, gardening, crafting, music, painting.
- **Levels** in words: beginner, can do it, knows the craft, master.
- **How they grow:** only by doing the thing itself, with no bars.
- **What they give (modestly):**
  - rare fish a little more often;
  - sometimes a double dish;
  - a slightly richer harvest;
  - cheaper repairs;
  - more confident playing on an instrument.

## Where in the code

- `crates/teul-core/src/economy.rs` (pocket, stations, favours, newspaper, `missing_for`), `daily.rs`, `quests.rs`, `work.rs`, `garden.rs`, `skills.rs`, `unlock.rs`.
- Content: `scripts/economy.py`, `daily_content.py`, `quests.py`, `work_garden.py`.
- Client: `app/src/ui/pocket.ts`, `ui/work.ts`, `ui/journal.ts`, `ui/daily.ts`.
