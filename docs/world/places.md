# Places of the world (47 locations)

[Українською](places.uk.md)

**In short.** The world consists of the player's home (a separate room), the town map of 74×114 (75 sites for buildings and grounds), eight maps around it, and 38 interiors and special places. Some places are locked until a key, a favour or a calendar day opens them (the `requires` field, with a hint in the world's own words).

## Outdoor maps

| id | Name | Size | What's there | How to open |
|---|---|---|---|---|
| `village` | The town of Lypove (Липове) | 74×114 | Square with the town hall, the Catholic church and a fountain; a four-lane main street with shops and a café; residential quarters (Lypova, Sadova, Shkilna, Richkova, Nova); a school; a park by the lake with a beach, a pier, loungers and a playground; a market; a water tower by the silos at the edge; a bread factory; the Novobudovna outskirts with construction sites; the Donut Shop («Пончикова», Ponchykova); a car service and a driving school with a training ground; a temple by the park | open |
| `forest` | Whispering Forest (Шепітливий ліс) | 140×96 | A clearing with a campfire, a forest lake, an ancient oak, a berry patch, a hill with a cave, a lake in the pinewood, a flower meadow, the forester's hut, a sawmill, a watchtower, the Old Circle (a pagan shrine) | open |
| `fields` | Wheat Field (Пшеничне поле) | 64×48 | Wheat, a crop circle left by aliens | open |
| `farm` | Lypovyi Hai farm («Липовий гай») | 64×48 | Yard, pasture, the farmer's house, the Ovechka («Овечка», "Little Sheep") mini-factory (wool, bags) | open |
| `cemetery` | Cemetery | 36×28 | Graves, a chapel | open |
| `dump` | Dump | 28×22 | Heaps of junk, a flea market at weekends | open |
| `hippodrome` | Burevii racecourse («Буревій») | 60×44 | Grandstand, races | pass `race_pass` |
| `vineyard` | Loza vineyard («Лоза») | 56×44 | Vines, a tasting terrace | favour `help.vineyard` |
| `cave` | Cave under Rocky Hill (Скелястий пагорб) | 44×32 | Underground lake, a crystal grotto | lantern `miner_lantern` |

## Town interiors (entered through a building's door)

| id | Name | id | Name |
|---|---|---|---|
| `school_in` | School: classroom | `hospital_in` | Hospital |
| `police_in` | Police station (with a cell) | `fire_in` | Fire station |
| `cafe_in` | Lypa café («Липа») | `library_in` | Library |
| `grocery_in` | Kolosok grocery («Колосок») | `bakery_in` | Palianytsia bakery («Паляниця») |
| `post_in` | Lypove post office (with the «Техніка» "Gadgets" counter) | `utility_in` | Utilities office |
| `clothes_in` | Lon clothes shop («Льон») | `salon_in` | Lokon hair salon («Локон») |
| `flower_in` | Pivoniia flower shop («Півонія») | `workshop_in` | Second Life workshop («Друге життя») |
| `vet_in` | Lapka vet clinic («Лапка», with a shelter) | `gym_in` | Syla gym («Сила») |
| `bar_in` | Zhabka bar («Жабка») | `church_in` | St Nicholas Church (Костел святого Миколая) |
| `hostel_in` | Leleka hostel («Лелека») | `factory_in` | Kolos bread factory («Колос») |
| `newsroom_in` | Newsroom of the «Lypove Herald» («Липовий вісник») | `townhall_in` | Town hall |
| `radio_in` | Lypove FM radio («Липове FM») | `hardware_in` | Maister hardware store («Майстер») |
| `driving_in` | Driving school | `sto_in` | Car service (СТО) |
| `temple_in` | Temple of the Quiet Lotus (Храм Тихого Лотоса) | `donuts_in` | Donut Shop (after it opens) |
| `creamery_in` | Ovechka mini-factory (at the farm) | `winery_in` | Loza winery (at the vineyard) |
| `cinema_in` | Zoria cinema («Зоря») | | |

## Special places

| id | Name | How to get in |
|---|---|---|
| `water_tower_in` | Water tower | key `tower_key` from the head of the community |
| `bar_cellar` | Cellar under the bar (a secret computer game) | key `cellar_key` from the barmaid |
| `guest_home` | Visiting | only when invited to dinner |
| `rift_spring`, `rift_summer`, `rift_autumn` | Rift worlds | only on their own equinox or solstice |
| `rift_winter` | Lypove Inside Out («Липове навиворіт») | only on the winter solstice |

The player's home is a separate world of rooms (`home`), see [home.md](home.md). From home you step out onto the town map.

The town's streets have landmark names (`<name>_street`): Holovna (Main), Sadova, Novobudovna, Lypova, Shkilna, Richkova, Nova, Lisova, Rynkova, Naberezhna (`scripts/map_streets.py`). They are shown in the Maps app ([maps.md](maps.md)).

## Where in the code

`scripts/world_maps.py`, `scripts/world_more.py`, `scripts/interiors.py`, `scripts/town_rooms.py`, `scripts/town_growth.py`, `scripts/faiths_world.py`, `scripts/rift.py`, `scripts/map_streets.py`; in the core — `LocationDef` (`content.rs`), `Requires` (`economy.rs`), the `Travel` command.
