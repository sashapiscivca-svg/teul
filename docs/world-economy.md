# The world fills up: pocket, bags, places to use, help that opens the way, the morning paper, honest play

The technical specification of the economy and the systems of the world: the binding contract between the core (Rust), the content (scripts/*.py → content/base/pack.json) and the client (app/src). Names here are exact. Code comments refer to its sections by number, so the numbers stay as they are (some are repeated, and a removed section leaves a gap).

## Rules that do not bend

- Nothing done in the player's own home pays (no coins, no tokens, no items from nothing). Coins come from the town: answering requests, help, selling finds at the market.
- Seasons are the real calendar's (already done: `time::Calendar`).
- Everything that decides an outcome lives in the deterministic core. The client only asks.
- Player-facing text is Ukrainian, with an English translation (client strings in `app/src/lang/*.ts`, content words through the `content/base/en.json` overlay). The language never changes the course of the world.

## 1. The pocket, the bags and the chest at home

Things the player *carries* are separate from furniture.

Content, `ItemDef` (all optional, serde defaults):
- `carry: bool` — lives in the pocket (finds, fish, food, materials, goods). Default false.
- `key: bool` — a guide/key item: kept on the keyring, takes no pocket room, never given, sold or stashed.
- `bag: u32` — a bag adds this much room when owned (the best owned bag counts, they do not add up). Content, top level: `pocket: u32` — the room of an empty pocket, in pieces (default 8).

Base content: pocket 8; `pouch` («Торбинка», bag 8) and `backpack` («Рюкзак», bag 20), both from the wool farm.

Core state: `carried: BTreeMap<String, u32>` (copies in the pocket) — a subset of `owned` for carry items. Copies of carry items not carried are in the chest at home ("stash" = owned − carried).
- Everything that brings a carry item (Gathered, Caught, station gives, NPC gifts, Delivered gift, Letter, Story, Collection reward, Help reward) puts it in the pocket; if the pocket is full the command fails with `PocketFull` — except gifts from people (letters, hearts gifts, help rewards), which are sent home to the chest instead (event says so: `to_chest: true`).
- Everything that takes carry items (Deliver, Gift, AdvanceStory, Help, station needs, market) takes them from the pocket only.
- Room: `capacity = content.pocket + max(bag of owned bags)`; used = sum of carried counts (keys excluded). Old saves may be over capacity: nothing is lost, new things just do not fit until there is room.
- Commands (only when `location == "home"`): `Stash { item, n }`, `Take { item, n }`. Events: `Stashed { item, n }`, `Taken { item, n }`.
- Anywhere: `ThrowAway { item, n }` → `ThrownAway { item, n }` — out of the pocket for good (never from the chest, never a key).
- At a buyer (a station with `buys`: `[[item | "#tag" | "*", price], …]`, the first that fits pays, price 0 refuses): `SellTo { station, item, n }` → `SoldTo { station, item, n, coins, day }`. Its hours, days and `per_day` hold as for any station, `per_day` counting pieces; `NotBought` for what it does not take. The market's second-hand buyer (`st.market.buyer`, by the vegetable stalls, 8:00–17:00, 20 pieces a day) takes anything but what was lent or is someone else's.
- At home, from the inventory: `SellBack { item }` → `SoldBack { item, coins, day }` — a thing that stands nowhere sold second-hand through the paper's small ads for 40% of its catalogue coins (`SELL_BACK_PERCENT`), ten a day (`SELL_BACK_PER_DAY`); free things, keys, carried things and clothes are not bought.
- The pocket sheet: «Подарувати» (people within 4 cells — a gift as in a talk, one a day each), «Викинути» (a second tap to be sure); at the buyer's stall the pocket opens with its prices («Продати · N», «Усі · N»). The catalogue's inventory tab: «Продати вживане · N».

## 2. Where the player is: travel and locked places

The core now knows the location (`state.location`, default `"home"`).
- `Command::Travel { to }` → `Event::Travelled { to, day }`. `to` is `"home"` or a location id. Fails with `Locked(missing)` when the place's requirements are not met (see below), `UnknownLocation`.
- `Gather { spot }` and `Fish { place }` require the spot/place to be in the current location (`NotHere`). `TakeTaxi.from` must equal the current location. Stations require their location.

Content, `LocationDef.requires` (optional) = `Requires`:
```json
{ "items": ["miner_lantern"], "helped": ["help.old_miner"], "hearts": [["olena", 2]],
  "hint": "Без ліхтаря в печері нічого не видно. Старий шахтар біля пагорба щось казав про свій ліхтар…" }
```
All listed conditions must hold (items = owned keys or items; helped = completed helps; hearts = npc level). `Missing` gains variants for these (`Item {item}`, `Help {help}`, `Hearts {npc, need, have}`). The same `Requires` is used by stations and helps.

Base content gates (at least): `cave` (key `miner_lantern`), `bar_cellar` (key `cellar_key`), `water_tower_in` (key `tower_key`), `hippodrome` (key `race_pass`, bought), `vineyard` (help). Everything else stays open.

## 3. Places to use (stations)

The most interesting things in the world do something. Content `stations: [StationDef]`:
```json
{ "id": "st.bakery.bread", "location": "bakery_in", "prop": "bread_counter", "label": "Купити хліб",
  "text": "Тепла паляниця, ще пахне піччю.",
  "needs": [["#fish", 1]], "cost": 6, "gives": [["bread", 1]], "earn": 0,
  "per_day": 2, "seasons": [], "hours": [6, 20], "requires": null, "kind": "buy" }
```
- `prop` is the item id of a prop standing in that location (the client offers the station when the player is at such a prop); the core checks the location, the day/hours/season, `per_day`, `requires`, coins, pocket needs (item ids or `#tag`) and pocket room for `gives`.
- `kind` is a hint for the client's icon/sound: buy, sell, make, gather, play, wish, read, ride, rest.
- `Command::Use { station }` → `Event::Used { station, day, took: Vec<String>, gave: Vec<String>, cost, earn }`.
- Selling (the market) is a station with needs and `earn`; per-day caps keep it from being a farm.
- Nothing at `"home"` may have `earn > 0` or give items from nothing (validated in `Content::from_packs`).

## 4. Help that opens the way

Content `helps: [HelpDef]` — one-time tasks from the town's people (story NPCs or residents):
```json
{ "id": "help.old_miner", "giver": "res.petro_miner", "giver_name": "Дід Петро", "location": "village",
  "title": "Ліхтар для старого шахтаря", "text": "…принеси мені три гриби й моток пряжі…",
  "needs": [["mushroom", 3], ["yarn", 1]], "after": [], "requires": null,
  "coins": 40, "gives": ["miner_lantern"], "thanks": "…" }
```
- `Command::Help { help }` (player must be in `location`) → `Event::Helped { help, day, took, coins, gives, to_chest }`.
- `after`: other helps that must be done first (chains). One time each.

## 5. The morning paper

`core.paper_view(now) -> Paper` for the world day of `now` (deterministic, nothing stored): `{ day, title: "Липовий вісник", number, date: "10 жовтня", weather: {today, tomorrow}, headline: {title, text}, stories: [{title, text}], interview: Option<{question, answer}>, town: [lines], asks: [lines], ads: [lines] }` built from yesterday's life incidents, the weather, the player's interview of yesterday, today's requests and open helps, stations' offers.
- `Command::Interview { question: u32, answer: u32 }` once a day (only when a journalist is near: the client's job; the core caps it at once a day) → `Event::Interviewed { day, question, answer }`; the next morning's paper quotes the player. Questions/answers are content (`interviews: [{q, answers: [..]}]`).
- The client opens the paper by itself on the first open of each world day (no tutorial, just the paper).

## 6. Honest play (cheaters and bots)

There is no server; the defence is that every outcome must be re-derivable and the log tamper-evident.
1. **Inputs are logged.** Every applied command is stored as `Event::Input { cmd }` right before the events it produced (same time, consecutive seq). On open the core *re-executes* every input on a fresh state and requires the stored outcome events to match exactly. Events not produced by an input are rejected. Saves from before this build (no inputs at all) are accepted as a legacy prefix, but once a save has an input, any later bare outcome event is tampering.
2. **Chained.** Each stored event carries `chain = H(prev_chain, device, seq, time, kind-json, secret)` (a 64-bit FNV-1a/xorshift mix, deterministic; `secret` is a per-device random from the meta). Editing, reordering, inserting or deleting events breaks the chain.
3. **On tampering** the core opens the save up to the last valid event and reports `opened.tampered = n` (the client says so once). It never crashes the world.
4. **Rate limits.** At most 40 commands per world minute; more → `TooFast`. Daily caps stay.
5. **Clock.** Backwards is refused (as now). Forward: the client takes `now = min(wall, last_wall + monotonic elapsed)` within a session, so moving the device clock while playing does nothing; the world remembers the latest time it has seen.
6. **No hooks in release.** `window.__teul` exists only in non-production builds (`vite build --mode e2e` for e2e). The APK is a production build.

7. **Verified snapshots (opening fast without trusting less).** At the first command of each world day (and after 400 inputs in one day) the core makes a snapshot: the state, the place in the log it covers (`through`, a sort key), how many events the log holds up to it (`covered`), each device's chain tip and highest seq, the devices that chain, what the checks had found (legacy, inputs, dropped, whether an input was seen) — and `mac = H(all of it, the device secret)` (52-bit FNV-1a, like the chain). Opening starts from the latest snapshot that verifies: its mac matches, it covers exactly the events the log has up to `through` (sqlite: a count; the client: an IndexedDB count over the log's order index), and nothing else sits before it; then only the events after it are chain-checked and re-executed. A snapshot that does not verify is ignored (the whole log is replayed; the client reloads the whole log and opens again). Editing old events behind a valid snapshot changes nothing (the snapshot is the authority for what it covers); editing the snapshot breaks its mac; deleting or adding events before it changes `covered`. The client keeps the two latest snapshots (IndexedDB `snapshots`, version 2 of the database, which also indexes the log by `[time, id.device, id.seq]`), reads only the snapshot and the events after it at start, and keeps in memory only the log after the latest snapshot. Merging logs from several devices whose events fall before a snapshot invalidates it (full replay), as before.

## 7. Client (after core + content)

Pocket button in the HUD (bag icon with used/capacity) → pocket sheet (pocket | chest at home | keys); stash/take at home; stations offered at props (bubble buttons); travel commands sent on every location change, locked places show their hint; helps shown in the people/Today panel and offered by the giver; the morning paper opens by itself; the journalist asks a real question with answers; new world icon.

## 8. Living at home: the fridge, the stove, the bills, the utility office

Code: `crates/teul-core/src/home.rs`; content: `scripts/home_items.py` (the office), `scripts/home_life.py` (dishes, recipes, bills, utility tags, the fuller house kit); client: `app/src/ui/home.ts`, `app/src/homeplan.ts`.

- **Fridge.** Food (a carry item tagged food, fruit, veg, vegetable, fish, drink, dish, dairy, berry or mushroom) goes from the pocket into the fridge at home and back: `Command::ToFridge { item, n }` / `FromFridge` → `Fridged` / `Unfridged`. Needs a placed item tagged `fridge` (`Needs("fridge")`), the electricity on (`UtilityOff("power")`), only food (`NotFood`), room in the pocket to take out (`PocketFull`). Food in the fridge is not carried (`in_pocket` = owned − chest − fridge − placed).
- **Stove.** `recipes: [{ id, name, needs: [[key, n]], gives: [item, n], text }]` (20 in the base pack, among them омлет, млинці, печена картопля, сирники, вареники, борщ, юшка, грибна юшка, кукурудзяна каша, медовик, компот, чай з ромашки). `Command::Cook { recipe }` at home with a placed `stove`, gas on; takes from the fridge first, then the pocket; the dish goes into the pocket, or into the fridge when the pocket is full → `Cooked { recipe, day, took, from_fridge, gave, n, to_fridge }`. Validation: a recipe takes something and gives a carried thing (nothing from nothing, nothing earns).
- **Bills.** `bills: { office, hours, due_day, utilities: [{ id, name, monthly, winter }] }`, utilities garbage, water, power, gas. By the real calendar (`time::Calendar::month_index`): the month the world began is free; each later month is billed on the 1st of the next and due by `due_day` (10); `winter` is added for December, January and February. A utility is off while any of its bills is unpaid after its due date. `Command::PayBill { utility, month: Option }` (the oldest unpaid if none) / `PayAll` → `BillPaid { utility, month, amount }` (counts as spent), only at the office (`NotHere`), in its hours (`Closed`), with the coins (`Locked([Coins])`).
- **What switches off.** Items tagged `water` (bath, shower, basins, toilet, washing machine), `gas` (stove), `power`/`light`/`switch` (lamps, TV, radio, computer, fridge, kettle…): `Perform` on them, and switching one on (`SetProp lit=1`) for power, fail with `UtilityOff(kind)`. The client shows the home dark (every electric thing `lit=0`), rubbish bags in the garden while the garbage is unpaid, a cold stove, and says it in the morning.
- **Views.** `fridge_view(now)`, `recipes_view(now)` (needs with what one has, `ok`, `reason`), `bills_view(now)` (bills with period «листопад 2026», due «10 грудня», paid/overdue; utilities on/off; `can_pay`). The morning paper carries the office's reminders before the due date, the notice when something is off, and the neighbours' complaint about the rubbish.
- **The office.** «Комунальна контора» on the street south of the centre (`utility_office`, `utility_site`), its inside `utility_in` (the cash counter `bill_counter` where bills are paid, the queue's ticket machine, waiting benches, filing cabinets, the meters on the wall, a notice), open 8–17 on weekdays; a clerk, and an inspector who goes round the houses reading the meters from 10 to 13.
- **The house.** The gift of the house now furnishes every room by a plan read from the back wall toward the door (`homeplan.ts`), turned and mirrored the way most of it fits round the doors: the living room round the TV with the sofa, armchair, low table on a big rug, bookshelf, lamp, plants and pictures; the kitchen's working wall (fridge, counter, stove, sink, drawers, cupboards above) and a table for two; the bedroom's bed between two bedside tables with lamps, wardrobe, dresser, mirror; the bathroom; the garden round its pond; the vegetable plot in rows; the orangery.

## 9. The year of Lypove: requests, promises and the day's small needs

A world, not a game: no quotas, no "tasks", no prizes announced. People ask; the player promises or not; they thank.
- **Quests** (`quests` in the pack, `crates/teul-core/src/quests.rs`): stages `go` (a place, maybe some hours), `bring` (from the pocket), `use` (a station), `cook`, `gather` (a spot/fishing place of a location), `wait` (days), `choose` (options with their own thanks and `goto`). Use/cook/gather/fish move a quest on by themselves (hooks in the plan); the rest with `QuestStep { quest, choice }` where it is to be done. `QuestStart { quest }` where it is offered (or at the board on the village square). Thanks (`reward`) — coins (never for staying home, checked), items, recipes to learn (`learn: true` recipes stay hidden until taught), a title, standing with the town, friendship — come only at the end, as thanks.
- **Calendar quests** (`when`: a date range or around a holiday of `holidays.rs`) come back every year as `id@year`; their window is when they are asked and done; what is not done in time closes kindly ("Життя пішло далі"). 70 quests in the base pack (`scripts/check_quests.py` checks every month has ≥4 and that every stage can be done in its season).
- **The day's small needs** (`jobs`): each kind comes up by its own chance on a day it fits (season, weather, workday/day off), one per person who fell ill yesterday (from the simulation), after a fire; giver by job or age; `{giver}`, `{who}`, `{place}`, `{t1..t3}` filled in; key `job:<day>:<kind>:<n>`, drawn alone (the simulation runs only for illness/fire jobs, so checking a save on open stays cheap). An invisible bound (5 going, 6 taken a day) keeps bots out; people simply do not hand more to someone already carrying so many.
- **Stations** keep the calendar (`days`: daily, weekdays, weekends, or a holiday id for a fair); shops rest on the great holidays' days off; `spent` is what the world says when it has given all it has today.
- **The paper** has a Календар (the next fortnight's feasts, the season's requests) and today's needs.
- **Client**: the notebook (`ui/journal.ts`: Обіцяне / Просять / Було, no counters, no prizes), a line under the clock for the promise followed, the board on the square, people who ask say so when tapped, thanks at the end.

## 10. Work, the garden, and what the hands learn

A reason to come back, the real-world way: earn by working for the town, grow food in real days, get better at things by doing them. No quotas, no counters on screen; the world says why when something is not possible. Code: `crates/teul-core/src/work.rs`, `garden.rs`, `skills.rs`; content `scripts/work_garden.py`.

- **Shifts.** `work: [{ id, location, prop, name, boss, employer?, hours: [from, to], days?, steps, gap, pay, ask, options: [..], start, thanks }]` — one job per place (café, bakery, post, farm, library, flower shop). `StartShift { work }` at the place (`NotHere`), on its days (`days` as stations: unset = not on the great holidays' days off) and hours, with time left before closing (`Closed`), once a day per place (`AlreadyDone`: "Сьогодні вже відпрацювали"), one shift at a time → `ShiftStarted { work, day }`. Each task is drawn from `options` by the world seed, the day, the job and the task's number (the same on every device): the client shows it («Олена просить: какао»), the player answers `WorkStep { choice }` — not sooner than `gap` world minutes after the last one (`TooSoon`: the next guest is not in yet), in the hours, at the place → `WorkDone { work, step, right }`. `EndShift` (any time; travelling away ends it too; a shift left from an earlier day or past closing ends by itself with the next shift command) → `ShiftEnded { work, day, steps, right, pay, full }`: `pay` = right answers × `pay`, plus one `pay` as thanks for a whole shift; coins from the town, never from home. Each job remembers the player (`work_record`: shifts, whole shifts, tasks, right) and a whole shift adds to standing with the town. Views: `works_view(now)` (the jobs here and their state), `shift_view(now)` (the task asked now, its options, when the next comes, earned so far).
- **The garden.** `plants: [{ id, name, seed, tree?, stages: [growth days…], models: [item…], dead_model, harvest: [item, n], seasons?, thirst, die, fruit_every?, fruit_seasons? }]`. Plots are placed items tagged `plot` (`indoor` too: a pot in the orangery — grows all year, rain does not reach it). `Plant { pid, seed }` at home on an empty plot, the seed from the pocket → `Planted { pid, plant, day }`; `Water { pid }` once a day per plot (the water utility on) → `Watered { pid, day }`; `Harvest { pid }` → `Harvested { pid, plant, day, item, n, cleared }` (a bed is cleared; a tree stays and fruits again); `ClearPlot { pid }` → `PlotCleared { pid }`. Growth is computed, never stored: from the planting day, each day the plant is wet if watered that day or (out of doors) it rained; a growing day (its seasons; indoors always) adds one growth day; `thirst` dry days in a row wilt it (no growth), `die` dry days kill it; the stage is the last whose growth days are reached. A ripe tree fruits in its `fruit_seasons`, every `fruit_every` days. Growth turns a bought seed and care into food: no coins at home. View `garden_view(now)`: every plot, its plant, stage, model, wilting/dead, ripe, needs water.
- **Skills.** Practice (`practice` in the state) grows from doing: fishing (a catch), cooking (a dish), gardening (planting, a harvest), crafting (restoring), music (`Play { pid }` at an instrument at home, once in a few minutes → `Played`), painting (`Paint { pid, title, pixels }` at an easel: 16×12 pixels in 16 colours → a canvas to hang, `Painted`). Levels in words: новачок, вже вміє, знається, майстер. Modest effects: rarer fish come a little more often, a dish now and then turns out double, harvests are a little richer, mending costs a little less. `skills_view()`; `paintings_view()`; a canvas on the wall shows its picture by the prop `art = <painting number>`.

## 11. How one looks and where one lives: clothes, the salon, homes

Code: `crates/teul-core/src/style.rs`; content: `scripts/style_items.py` (buildings, shop and salon furniture, 39 garments), `scripts/style_world.py` (the new southern street of the village, the forest cottage, the allotments, the homes and the shop's and salon's data); client: `app/src/ui/wardrobe.ts`, `app/src/ui/salon.ts`, `app/src/dressing.ts`.

- **The hero is made once.** `Command::MakeHero { set }` at the first open (clothes, hair and body keys); after it `SetSetting` refuses those keys (`LookFixed`) — clothes are garments, hair is cut at the salon, the body stays as made. The pet stays the player's free choice. A save from before counts as made once it has any of those keys. The studio shows only the pet then.
- **Garments.** Items with `wear: { slot, set }` (slot `top` | `bottom` | `shoes` | `acc`, `set` the slot's look keys), hidden from the furniture shop, priced in coins, one of each. Bought only at «Льон» (`fashion.shop`) in its hours (`Closed`, `NotHere`). `Command::Dress { slot, item }` puts an owned one on (`NotOwned`, `InvalidSlot`), or with `item: None` the first day's clothes for that slot (kept by `HeroMade`, or from the look of an older save at its first change); only at home by something tagged `wardrobe` (`Needs("wardrobe")`) or in a fitting room (`fashion.fitting`). Events: `HeroMade`, `Dressed`.
- **The salon.** `Command::Haircut { set }` with hair keys only (`look.hair`, `look.hair_color`, `look.beard`) at «Локон» in its hours; each changed part has its price (`price_style`, `price_color`, `price_beard`); nothing changed → `NothingThere`; event `HairCut { set, coins }` (spent).
- **Homes.** `homes: [{ id, name, location, prop, x, y (the door), kind: house|flat|cottage|plot, rent, price, start, text }]`. `Rent` (at its place; the first month at once), `Buy`, `MoveHome` (owned or rented, not a plot; the address — everything at home comes along), `EndLease`. Rent of later months comes with the bills as utility `rent:<home>` (billed and due like the others); an unpaid rent past the due date ends the lease (the debt stays payable) and the address falls back to the first house. `Requires.leased` opens stations on a rented plot (`Missing::Lease`). The taxi's «home» stop is the door of the address; out of the house one steps out of its door.
- **Base content.** A new street in the south of the village (the map grows by 14 rows, after the trees are scattered, so nothing standing moves): «Льон» (racks, coats, hats, shoes, mirrors, fitting booths; a shop assistant 9–19, Mon–Sat), «Локон» (two chairs, mirrors, a wash basin, a hood dryer; a hairdresser 9–18), a block of flats (two flats, 45 and 60 a month), a house for sale (1800, or 90 a month); a cottage at the forest's edge (35 a month or 900); two allotments by the fields' road (12 a month) whose beds give carrots and potatoes in summer and autumn.
- **The town dresses for the weather** (client): out of doors in winter coats, boots and a beanie or a scarf; in the rain most put on raincoats and rubber boots, children always; indoors and in uniform as they are.

## 12. A town that lives on: people over the years, friendship, projects, the rare day

Code: `crates/teul-core/src/town.rs` (everything derived from the seed, the content, the real calendar and the state; nothing stored that can be worked out); content: `scripts/town_things.py` (models), `scripts/town_village.py` (the map's flagged props, the newcomers' houses), `scripts/town_rooms.py` (a friend's home, the library's buckets), `scripts/town_life.py` (projects, openings, newcomers, stations); client: `app/src/ui/projects.ts`, `game.ts`.

- **Birthdays and tastes.** Everyone (residents and the story's people) has a birthday from the seed (`town::birthday`) and tastes (`town::tastes`: two kinds of thing loved, one not wanted). `Command::Congratulate { who, gift }` on the day, in town, once a year → `Congratulated { who, year, day, gift, taste, delta }` (friendship +60, +100 with a gift, +160 loved, +50 not wanted). `Gift` now goes to any resident too (once a day each). On someone's birthday they hold a party at home in the evening; friends and colleagues go (`life::town_visits`).
- **Invitations and visits.** Someone warm enough (`INVITE_POINTS` 300) may invite the player to dinner in a week (`town::invitation`, seeded by the week): 19:00–21:30; the friend's home (`guest_home`, a location with `invite_only`) opens an hour before; `Command::Dine { host }` there → `Dined { host, day, gave, delta }` (+90, a dish of the house to take home). Closer friends (`VISIT_POINTS` 500) drop by the player's home some evenings (18:00–19:30; `TownView.visitor`). People remember: birthdays wished, dinners, gifts, help given (`TownView.bonds[].memories`, and a line they say about it).
- **People over the years** (`town::Population`): ages from the seed within what the content says; children turn 18 (no more school, young), adults 65 (retire, unless the town cannot do without them), the young turn 30; content residents with `arrives` (days after the world began, ± a little) move in then; a family may move away now and then (never the "rooted": givers of quests/helps, sole workers, those living where they work); a couple has a baby some years (the parents push a pram for two years); one of the old passes away now and then, with a funeral two days later at the cemetery (family, friends, some of the old). The simulation runs with the people of the day (`World::of_people`), and starts again when the people change. Told in the paper (`town_changes`).
- **The rare day** (`town::day_town`): a storm (from the weather; the free stay in; sometimes the power goes out: the street lamps stay dark), a wedding of a young couple on a summer Saturday (the church, then the square), a visiting fair on spring-to-autumn weekends, a wandering musician on the square in the evening, a lost tourist.
- **Projects** (`projects`: coins, materials, what the town gives each day by itself, stages with days, `opens`, `after`, the paper's words when done): open → funded (the first day everything is there) → building, stage by stage → done for good. `Command::Contribute { project, coins, items }` at the town hall (`BOARD`), only while it is collecting → `Contributed`. **Openings** (`openings`: from a day, in some months, after a project).
- **Flags** (`Core::town_flags`, `TownView.flags`): `project:<id>:open|building|stage<k>|done`, `open:<id>`, `storm`, `outage`, `wedding`, `fair`, `musician`, `tourist`, `funeral`. A map prop with `flag` is shown only while the town has it, one with `unflag` only while it has not (the old roof and the mended one); a station with `flag` works only then. Content checks let flagged props share cells only when the town never shows them together.
- **The paper**: births, passings, arrivals, departures, a wedding, what was built, what opened, whose birthday it is, how the collections go, the musician and the fair, a storm warning, birthdays in the next days.

## 13. Cold and warmth, the ice, the clothes of the seasons

- **The air** (`warmth.rs`): a climate like central Ukraine's by the real date (monthly means interpolated), five-day spells warmer or colder (seeded), a day's swing from dawn to mid-afternoon, rain and storms cooler, snow only near a frost. Tenths of a degree, integers only. The HUD shows it by the clock («14:20 · +7°») — the only number about the weather; the season itself is not named (the world shows it).
- **How the hero feels** (`comfort_view`, −3..+3): the air where they are (out of doors; a heated room; at home heated while the gas is on, the street's cold seeping in when it is cut off; a cave; the Other Side), the clothes' warmth (opened indoors), wet through (rain without a raincoat or an umbrella, just out of the water), the sun on a bare head in summer, a stove, a fireplace or a fire within a few steps, something hot eaten or drunk in the last hour (cooked, a dinner, a coffee or cocoa). Never a bar or a number: the client shows it as frost creeping in from the screen's edges and a cold blue light, the hero hugging themself and shivering, breath in the air; a golden glow by the stove; the light burning white and the air shimmering in the heat, a drop of sweat; raindrops on the lens. Passers-by remark on it in their own words.
- **Ice**: the still waters (lakes and ponds, `ice` runs in the map) gather frost through the winter (degree-days of frost less three times the thaw's) and hold when thick enough; rivers never freeze. On the ice one walks and skates (the hero and the town's people, arms out), nobody swims.
- **Clothes of the seasons** at «Льон»: windbreakers, trenches, umbrellas (spring); sundresses, swimwear, swim shorts, flip-flops, panamas, dark glasses (summer); a jumper with a collar, a checked scarf, warm boots (autumn); down coats, a sheepskin, felt boots, an ear-flap hat, mittens and gloves — a slot of their own, `hands` (winter). The town dresses by the air of the day, each person in their own way.

## 14. Things grow old, things are made with tools, new things come

**Wear** (`crates/teul-core/src/wear.rs`, content `wear`). Every ageing thing at home (seats, beds, lamps, the fridge, the stove, taps, devices, instruments, tables and storage) has a profile: the wear at which it turns *used*, *worn* and *broken*. Wear = real days since it was placed or last mended + uses × `per_use` (a sit, a lamp switched on, a while at the piano), with ±15% luck of its own. Nothing is shown as a number: the picture fades, darkens, gets scuffs and finally sags and cracks; an old lamp blinks, an old screen shows snow. A broken thing refuses in its own words (`CoreError::Broken`): the chair will not be sat on, the stove does not light, a broken fridge keeps nothing new. Mending:
- by hand (`Repair`): the profile's tool (hammer, screwdrivers, wrench, pliers, ladder) and its kit (a repair kit, a bulb for a lamp); a broken thing needs hands that know the craft (crafting level 1);
- by a master (`CallMaster`): from the utility office, or from anywhere with one's own smartphone; by day only, for coins (a quarter, a half or the whole of the profile's `fix`).

**Crafting** (`craft.rs`, content `crafts`). At a workbench — the town workshop's (with the master's tools) or one's own at home (`home_workbench`, with one's own tools) — carried materials become things. A recipe is known from the start, or learned when its `learn` holds (a friendship with someone who teaches it, a book on the keyring), or found by trying (`Tinker`: things laid side by side; when they are exactly what a recipe takes it is made and remembered, otherwise nothing is lost). Crafted things are real items: furniture goes home, carried ones are gifts or are sold to the workshop's master and at the weekend flea market by the dump.

**Tools** (content `tools`). Hammer, saw, screwdrivers, pliers, wrench, shovel, rake, hoe, watering can, bucket, axe, ladder, a good rod, knitting needles, brushes: each serves a number of uses (`ToolUsed`) and then is gone, saying so in words. They hang on the belt (no pocket room). Uses in the world: recipes and repairs need them; a shovel and fertilizer give more at a harvest; a watering can keeps a bed moist for the next day too; a bucket waters from the rain barrel when the tap is off; a good rod and a lure bring rarer fish; an axe cuts firewood, a shovel digs clay, a rake rakes the square's leaves in autumn (the town pays for that). The hardware store «Господарчий «Майстер»» (`hardware_in`, a seller on the life schedule, Monday to Saturday 8–19) sells tools, materials and household goods.

**Technology over real time** (`tech.rs`). Three weeks after the world began the post office opens the counter «Техніка» with smartphones; laptops follow at six weeks. Each resident's day of taking one up is drawn from the seed: grown-ups first along a curve, children later, the old last and a third of them never; about a third of grown-ups get laptops, and those without a shift that weekday sit in the café with a laptop through the late morning (the life engine's coffee slot). In the picture: phones looked at on benches, held to the ear walking, raised at feasts; laptops open on café tables. The player's own smartphone (bought at the post office) has a camera, a taxi, the weather, messages and a master to call; `tech_news` gives the paper its lines on the days these things happen.

## 15. The road: the driving school, the service station, the police

Core: `crates/teul-core/src/drive.rs`; content: `scripts/driving_items.py`, `scripts/driving_world.py`, `scripts/driving.py` (pack key `driving`); client: `app/src/drive/` and the road block of `game.ts`.

- **Автошкола «Зелене світло»** (`driving_in`, Mon–Sat 9–18, instructor `res_instructor`). Four lessons, one a day, 25 coins each, are the instructor's own words. Then a theory exam: today's five questions, drawn from the school's list, four of them right, 30 coins, one try a day. Then a practical exam: 50 coins, the school's car, three points on the town's streets and back to the school. One small slip is forgiven. A grave one fails it:
  - people too close;
  - a knock;
  - a busy zebra;
  - speed by the school;
  - giving up.

  Passing gives the licence (`driver_licence`, a key on the ring).
- **СТО «Гайка»** (`sto_in`, Mon–Sat 8–19, the mechanic and an apprentice). Three used cars: «Ластівка» 650, «Дніпро» 1150, «Полтава» 1700. They come with the keys and wait on the gravel forecourt. Services:
  - the pump: 3 coins for ten units;
  - a canister: a carry item, poured in where the car stands;
  - oil, tyres, a repair: a broken car is towed in.

  A car wears by the road driven. Oil every 4000 cells; twice that and the engine seizes. Tyres every 15000. Three dents and it does not go.
- **A trip.** A trip is `StartDrive` … `Park`. The cells driven are capped by the minutes it took (480 a minute), and the fuel is burned by the core. The car stays in town: the town's exits are not driven through.
- **Wrongs on the road.** These are told by the device:
  - speeding over «50»;
  - over «20» by the school;
  - the pavement;
  - a busy zebra;
  - people too close;
  - a knock;
  - driving without a licence near the police.

  What comes of it is the core's:
  - whether anyone saw: a chance per kind, from the seed;
  - the fine, paid there and then or owed at the police;
  - the holes punched in the licence's coupon: five places, forgiven after 90 days.

  A full coupon, or no licence, means a night in the cell of `police_in` (till 7:00, or three hours by day). In the cell, `Travel` and the taxi are refused. The car goes to the police yard. The licence is taken away for three days, and then both exams are taken again.
- **The paper.** `driver_stories(day)` gives yesterday's licence, fines, the night in the cell, a car bought, money found. Each story has a headline, text, a photo place and a section («Кримінальна хроніка», «Дороги», «Бюро знахідок»). `paper_view` prints them among the day's stories.
- **Money on the road.** `road_coins(seed, content, location, day)` lays nothing on most days and a coin or two on some. A note is rare. They lie on the roads and pavements of the town, the fields, the forest and the farm. The player picks them up by walking over them (`PickCoin`, once each). Never at home.
- **No numbers on the screen.** The coupon is ▣ ○. The speedometer is a dial with a red mark and no digits. The car's state is in the mechanic's words.

## 16. The town grows and wears (`growth.rs`, `scripts/town_growth.py`, `scripts/growth_life.py`)

Everything here is a pure function of the seed, the world's first day, the content and the real calendar.

- **Layout.** Lypove is «Містечко Липове» now:
  - the main street (`main_street`, rows 26–27) has the shops, the café and the square with the town hall and the fountain;
  - the lane behind the shops joins it through curb cuts;
  - the household shop «Господарчий» (`hardware_in`) stands on the main street by the square's lane;
  - the water tower moved to the factories' edge across the river, by the bread factory's silos;
  - the outskirts street «Новобудовна» (rows 96–97) is joined to the Садова by the two cross streets.

  The streets are wider (`scripts/town_widen.py`, applied last to the built pack): the main street has four lanes and the other streets three; the short Річкова stays two. Everything beyond a new lane moves with it (props, sites, exits into the town, taxi stands, homes, building sites, landmarks). Every paved cell is one road network, checked by a test. There are parking bays on the main street and on Новобудовна, and zebra crossings by the school, the square and the outskirts.
- **Landmarks.** `locations[].landmarks` names places on the map, so other features can stand by a name instead of coordinates. It includes `square_centre`, `main_street`, `park`, `lake`, `pier`, `forest_edge`, `to_fields`, `to_cemetery`, `outskirts_street`, `training_ground`, `sto_forecourt`, the cart's stops, and `door:<site>` for every building.
- **Building sites.** A site moves through the pit, the foundation, the walls, the roof and then built. Each stage is a prop under `grow:<site>:<stage>`, sharing the plot's cells.
  - Builders work on working days only: not on Sundays, not on the great holidays, not in December to February.
  - Some sites stall at the walls for 240–540 days (`grow:<site>:stalled`: a bare frame, graffiti, weeds), then go on.
  - A finished house has a moving van at the door for three days (`grow:<site>:moving`).
  - «Пончикова» is built the same way. Its room `donuts_in` requires the flag `grow:donut_site:built`, a new `Requires.flags` that becomes `Missing::Flag`.
- **Empty houses.** Two old houses on the Садова may be left empty (`abandon:<home>`: boarded windows, a hole in the roof, weeds, a broken fence). Their last 21 days are mending (`mend:<home>`: scaffolding, workers), and then people move in again.
- **Wear.** About once in 150–270 days a building gets one thing wrong: `wear:<site>:crack|window|paint|roof|lamp`.
  - While anything but the lamp is broken, the town also has `worn:<site>`; the building's prop has `unflag: worn:<site>` and its worn variant shows instead.
  - It stays broken for 10–44 days, then is mended for 2–4 days (`fix:<site>`: a ladder with tools, a mender at work).
- **The ice-cream cart.** It comes out in May–September on days with no rain, storm or snow in its hours (11:00–20:00), under the flag `icecream`.
  - It moves between the park, the pier and the square, three hours at each. The client adds the flag `cart:<stop>` of the hour.
  - It sells four flavours (items tagged `icecream`). One can be eaten on a bench, with the pose of eating.
- **The paper.** `Core::growth_news(from, to)` tells what was begun, roofed, built, opened, stalled, resumed, left, mended and broken. `Core::growth_view(now)` (wasm `growth_view`) gives the sites' stages, the last thirty days of news, and whether the cart is out.

## 17. Building on to the house, the animals one lives with (`builds.rs`, `pets.rs`, `scripts/home_more.py`)

- **The builders** take orders at the utility office counter and at the town hall: a kitchen, a bedroom, a bath, a workshop, a music room, an attic, a cellar, a second floor (by the stairs), a terrace, a yard (`OrderBuild { build, x, y }`). The site must be free and along the house, inside its 32×32 plan; it is paid when ordered and its floor counts toward the house's from that day (`room.built_area`). Only an owner builds on (`CoreError::Tenant` for a tenant); one order at a time — the town has one crew.
- The work takes real days: dug earth and a cement mixer, then walls in scaffolding, then the roof (the shell draws it from `stage`, display-only things, `site.ts`); two builders in orange work there by day. The site is walled off from the house until the keys are handed over (`FinishBuild { n }`, not before `ready`): the doorway opens (a door, a garden door or the stairs), floor and walls are done in the order's finishes and the room is furnished by its plan (`homeplan.ts`) with what the order brought (given into the inventory).
- **The animals**: the first day's cat, dog or rabbit stay the player's choice of look. A turtle comes from the vet's shelter (for coins), a robot from the «Техніка» counter once laptops have come, a fox from its den in the forest after food left for it on three different days (it follows the next time), a dragon from an egg found among the bones of the summer rift's salt sea, kept in a warm nest at home for a week (`Adopt { pet }` takes each next step). They are fed (`pet_food` from the vet, or what each eats), played with, stroked; the robot charges at home (with the power on) and wants a screwdriver after a month (`PetCare { pet, what }`). One goes out walking with the player (`Companion`); the others go about the house (`petlife.ts`): the turtle slowly to the bath, the fox everywhere (a striped sock in its teeth now and then), the robot to its charger, the dragon to its nest or the stove — and the air near it is warm. How they are is only said in words and shown in what they do (hungry by the bowl, lonely at one's heels, happy at play); nothing is counted. In town people notice the animal walking with the player.
