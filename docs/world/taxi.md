# Taxi

[Українською](taxi.uk.md)

**In short.** You can call a taxi anywhere outside your home, including from indoors and from the forest. It goes to 14 taxi stands and to the door of every place that is not somebody's home. Each place appears once in the list, and there is a search. Closed places are shown in grey with an explanation in the world's own words, and when you are short of money it says so plainly. The fare is built the way taxi apps build it: for the road, for the minutes and for demand. In rain, at rush hour, at night, on a holiday or while the races are on the fare is higher, and on a clear quiet day it is a little lower. The window shows how many minutes until the car arrives and briefly explains the fare in the world's words. The car first drives up (longer when there are fewer cars), the hero gets up if they were sitting, and gets out at the destination. A taxi can also be called from a place's card in «Maps» ([maps.md](maps.md)).

## How it is calculated (`crates/teul-core/src/ride.rs`)

- **Where to** (`core::taxi_destinations`): the stands from the content (`taxi`: the square and town hall, the radio station, «near your home», the fields, the racecourse, the farm, the forest by the road, the mountain and the cave, the dump, the vineyard, the Catholic church, the hostel, the bakery, the newspaper office). On top of them come the doors of all non-home sites on the open maps. A site is skipped if a stand is already nearby (≤ 4 tiles) or has the same name.
- **«Near your home»** is the door of your current address (`style.rs::taxi_dests`).
- **The road** (`road_tiles`). The shortest path along roads is found. Within a map, distance is counted on the street grid (across plus along). Between maps the path goes through the exits, and each road between maps counts as 24 tiles. A building's door adds nothing.
- **Fare before demand** = 4 + tiles / 10 + ride minutes (2 + tiles / 25) + pickup. Pickup is counted from the stand on the square when the car has far to go to reach the hero: (tiles from the stand − 40) / 12. That is why the outskirts, the forest and the fields cost more.
- **Demand** (`Demand`, `taxi_demand`): surcharges are added to 100 %. Thunderstorm +60, snow +40, rain +30, fog +10, frost below −8° +20. Night (23:00–05:00) +40, weekday rush hours (7–9, 17–19) +30. A town holiday +35, another public holiday or festive day +20. Races at the racecourse (9:00–20:00, if the pickup or drop-off is there) +25. Evening shows at the «Zorya» (Зоря) cinema (18:00–23:00, near the cinema) +20. If there are no surcharges, the day is clear and it is 10:00–16:00, it is 90 %. Bounds: 85 % to 220 %.
- **Fare** = (fare before demand × percentage + 50) / 100, but at least 5. The multiplier itself is never shown.
- **Reason** — the words of the largest surcharge, for example «Rain — few cars, higher fare» or «Rush hour — everyone is heading home, higher fare». On a clear day it is «Clear day — plenty of cars, lower fare». When there are no surcharges but the pickup is expensive, it is «Far from the stand — the driver takes longer to reach you». A normal fare comes with no explanation.
- **Arrival time** = 2 + pickup tiles / 30 + surcharge / 20 minutes, from 1 to 25.
- Everything is calculated in integers, so every device gets the same fare for the same minute.

## The ride and old logs

- **Command** `TakeTaxi { to, from, x, y, fare }`. `fare` is the fare the player saw. The core calculates this minute's fare with the same `ride::quote`. If it differs (the minute crossed a rush-hour boundary, etc.), the core refuses with `FareChanged { fare }`. The client says «While you were choosing, the fare changed: it is now N» and reopens the list.
- **Old saves.** Inputs in the log recorded before demand pricing have no `fare`. For them the fare is calculated the old way (`taxi_fare`: 6 + 9 for each location passed + distance within one location, at most 40). So old logs replay exactly the same. The `fare` field is not serialised when absent, so the bytes of old events do not change.
- **A closed place** (`taxi_shut`) returns a hint from `requires.hint`. The ride then does not happen and costs nothing. A taxi will not come to a police station cell (`Jailed`).
- **Events** of a ride: `CoinsSpent` (exactly the fare shown) and `Travelled`.

## In the client

- **The «Taxi» button** is in the top-panel menu and on a phone. It is not there at home.
- **The window** (`ui/taxi.ts`). At the top it says «Nearest car — N min away» and the shared reason for the fare: reddish when it is dearer, green when it is cheaper. Below come the search «Where to?» and groups by place («Nearby» first) with fares. A separate line shows a reason only when it differs from the shared one.
- **The ride** (`game.ts::rideTaxi`). First «The taxi is on its way…»: the wait is 0.6 s + 0.12 s for each minute until the car, capped at 12 minutes. Then a fade to black and «Arrived: …». One ride at a time.

## Where in the code

`crates/teul-core/src/ride.rs` (`Demand`, `TaxiQuote`, `road_tiles`, `quote`, `Core::taxi_quote`), `crates/teul-core/src/core.rs` (`TaxiDest`, `taxi_destinations`, the old `taxi_fare`, `TakeTaxi`), `style.rs` (`taxi_dests`, `taxi_shut`), `crates/teul-wasm/src/engine.rs::taxi_destinations(now, …)`, `app/src/ui/taxi.ts`, `app/src/game.ts` (`taxiQuotes`, `openTaxi`, `rideTaxi`). Tests: `crates/teul-core/tests/taxi_pricing.rs`, `crates/teul-core/tests/wider_world.rs`, `app/e2e/taxi.mjs`, `app/e2e/maps.mjs`.
