# Вміст: як будується світ

[English](content.md)

**Коротко.** Увесь вміст — предмети з моделями, карти, приміщення, мешканці, станції, історії, рецепти, одяг, свята — генерують Python-скрипти в один JSON `content/base/pack.json`. Головний скрипт `scripts/gen_base_content.py` по черзі виконує решту через `exec` у спільному просторі імен, тож пізніші скрипти бачать змінні попередніх (`items`, `locations`, `residents`, `stations`, `V` — мапа містечка…). Ядро завантажує пакет (`Content::from_packs`) і перевіряє його. Окремі скрипти шукають глухі кути.

Запуск: `python3 scripts/gen_base_content.py` (є прапорець `--legacy` для старого ядра без нових полів).

## Порядок виконання

| Етап | Скрипти | Що з'являється |
|---|---|---|
| 1. База | сам `gen_base_content.py` | `PALETTES` (палітри), `slot()`, `b()` (бокси моделі), `item()`, меблі дому |
| 2. Предмети світу | `village_items.py` (`civic`, `building`, `vehicle`), `facing.py`, `public_items.py`, `world_items.py`, `cute_animals.py`, `town_items.py`, `home_items.py`, `festive_items.py`, `style_items.py`, `town_things.py`, `driving_items.py`, `shop_fronts.py`, `growth_items.py`, `faiths_items.py`, `square_items.py`, `games_items.py`, `interior_items.py` | Будівлі, вуличні речі, тварини, костел, прикраси свят, одяг, знаки й авто, вітрини, будови, храм і капище, речі площі, настільні ігри, речі приміщень |
| 3. Карти | `world_maps.py` | Містечко `V`, ліс `F`, звалище й інше. Усередині виконуються `style_world.py` (нова вулиця, житло), `driving_world.py` (зебри, знаки), `town_growth.py` (Новобудовна, СТО, автошкола, «Пончикова», орієнтири), `faiths_world.py` (храм, капище), `world_more.py` (поле, ферма, іподром, печера, виноградник, кладовище), `town_village.py` |
| 4. Приміщення | `interiors.py` (`Inside`), `town_rooms.py` | Приміщення за дверима будівель, «У гостях» |
| 5. Люди | `residents.py`, `village_people.py` | Мешканці з домами, роботами й виглядом (фіксоване зерно 1991) |
| 6. Економіка | `daily_content.py` (знахідки, риба, альбом), `economy.py` (`good`, `key`, `st`, `aid`), `festival_food.py`, `home_life.py` (страви, рецепти, рахунки), `quests.py` (`quest`, `job`), `first_letters.py`, `rift.py`, `work_garden.py`, `town_life.py` | Речі для кишені, станції, допомоги, рецепти, історії року, підробітки дня, перші листи, світи розломів, зміни, город, проєкти |
| 7. Пізні системи | `craft_items.py`, `media_items.py` (+ `scores.py`), `driving.py`, `growth_life.py`, `faiths.py`, `cinema.py`, `games.py`, `home_more.py` | Крафт і «Господарчий», музика, автошкола й СТО всередині, морозиво й пончики, інтер'єр храму, кінотеатр, настільні ігри, добудови й улюбленці |
| 8. Розширення вулиць | `town_widen.py` (виконується останнім, перед записом) | Головна вулиця на 4 смуги, інші на 3. Зсуває все, що далі: пропи, сайти, виходи, орієнтири, стоянки таксі, домівки, будови, місце авто біля СТО |
| 9. Місто навиворіт | `rift.py::make_mirror_town()` (після розширення) | Копія готової мапи містечка для зимового розлому |

## Предмети

`item(id, category, w, d, layer, model, slots, acquire, actions=None, surface=False, name=None)`:
- **`layer`:** `floor`, `wall`, `rug`, `surface`.
- **`model`:** список боксів `b(x, y, z, w, d, h, slot, shape)`. Одна клітинка = 100 одиниць; форми `box`, `cyl`, `cone`, `ball`, `round`, `gable`.
- **`slots`:** слот → `slot(palette, i)`.
- **`actions`:** `sit`, `rest`, `play_music`, `water_plant`…
- **`tags`:** наприклад `light`, `fridge`, `water`, `window`, `zebra`.

Речі для кишені створюють `good(...)` (`carry`), ключі-провідники — `key(...)`. Будівлі створюють `civic(id, name, w, d, wall_h, colors, extra, roof_h)`. Двері будівель розставляє `Map.building_at`.

Річ, якої гра більше не має, не видаляють із пакета без сліду: її id додають у список `retired` пакета (див. [architecture.uk.md](architecture.uk.md#цілісність-і-сумісність-збережень)).

## Карти

- **Клас `Map`** (`world_maps.py`). Сітка клітинок-символів з легендою (`LEGEND`): `c` — бруківка проїжджої частини, `p` — плитка тротуару й площі, `h` — стежка, `r` — гравій, `d` — настил, `g`/`m`/`f` — трава, луг, мох, `t` — ґрунтова дорога, `o` — земля, `s` — пісок, `w` — вода. На неї ставляться пропи (`prop`, з перевіркою, що нічого не накладається), місця дій (`place`), сайти будівель (`site`, з роботами), виходи на інші мапи, дроти, стояча вода (`lake` — замерзає), ріки (`line` — течуть). `building_at` прокладає стежку від дверей до вулиці, `connect` — найкоротшу стежку.
- **`Inside`** (`interiors.py`) — кімната всередині будівлі: стіни, широкі двері на півдні, вихід до дверей сайту, пости персоналу (`post`).
- **Орієнтири** (`landmarks`, `town_growth.py::landmark`) — іменовані прямокутники, наприклад `square`, `square_centre`, `main_street`, `park`, `lake`, `beach`, `pier`, `parking_main`, `cart_stop_0..2`, `door:<site>`. Нові системи ставлять речі за орієнтирами, а не за координатами, бо розширення вулиць зсуває координати.
- **Прапорці на пропах.** `flag` — показувати лише тоді, коли місто має цей прапорець, `unflag` — лише коли не має. Так зроблено будови за етапами, вогонь повні, підношення в храмі, кіоски. Тест вмісту дозволяє двом пропам займати одну клітинку тільки тоді, коли їх ніколи не видно разом.

## Станції, допомоги, історії

- **Станція** (`st`). Обов'язкові поля: `id`, `location`, `prop` (предмет, що стоїть у цьому місці), `label`, `text`, `kind`. Необов'язкові:
  - `needs` (id або `#тег`), `cost`, `gives`, `earn`;
  - `per_day`, `hours`, `seasons`, `requires`, `flag`;
  - `days` (`daily`, `weekdays`, `weekends`, `full_moon` або id свята);
  - `spent` — слова, коли на сьогодні все.

  Вдома станція не може давати монети чи речі з нічого: це перевіряє `Content::from_packs`.
- **Допомога** (`aid`): одноразова справа, що відкриває шлях (ключ, місце).
- **Історія** (`quest`): етапи `go`, `bring`, `use`, `cook`, `gather`, `wait`, `choose`; подяка `thanks`; вікно `holiday(...)` чи `dates(...)`.
- **Підробіток на день** (`job`).

## Мешканці

`residents.py` розселяє домогосподарства по будинках містечка, дає дорослим роботи на сайтах, дітям школу. Пізніші скрипти додають нових людей у кінець списку (`res_<n>`), щоб нічиї id, домівки й роботи не зсувалися: продавця «Господарчого», інструктора й механіків, пекарів «Пончикової», хранительку храму. Робота задається на сайті: `jobs: [{role, from, to, wage, days}]`.

## Перевірки

| Перевірка | Що шукає |
|---|---|
| `Content::from_packs` (ядро) | Дублікати id, невідомі посилання, невідомі `days`, заробіток удома, модель кожного предмета, вилучений id, що водночас живий |
| `crates/teul-core/tests/base_content.rs` | Пакет завантажується, предмети не накладаються (з урахуванням `flag`/`unflag`), дороги не під будинками, мережа доріг зв'язна, кожні замкнені двері можна відкрити, перша сесія, таксі, коло на повню |
| `scripts/check_economy.py` | Усі посилання існують, станції стоять біля своїх пропів, удома нічого не заробляє, кожна потреба влазить у кишеню, немає глухих кутів |
| `scripts/check_quests.py` | Щомісяця щонайменше 4 календарні історії, і кожен етап виконується в своїй порі року |

## Як додати…

- **Предмет:** `item(...)` чи `good(...)` у відповідному `*_items.py`. Якщо його ставлять на мапу, мапа мусить знати предмет: скрипти предметів виконуються до `world_maps.py`.
- **Будівлю з приміщенням:**
  1. `civic(...)` у `*_items.py`;
  2. на мапі `door, fp = V.building_at(...)` і `V.site(id, name, kind, door, building=fp, jobs=[...])`;
  3. `Inside(id, name, site_id, w, h, floor, wall, door_x)` з пропами й постами, потім `locations.append(R.build())`.
- **Станцію:** `st(...)` (або власну функцію на кшталт `_fst` у `faiths.py`), коли вже є і проп, і місце.
- **Мешканця:** допиши в кінець `residents` (`id`, `name`, `gender`, `age`, `home`, `job: [site, role]`, `look`).
- **Свято:** у `crates/teul-core/src/holidays.rs` (`FIXED` або плаваючі). Якщо свято велике, ще й у `festival.rs::BIG`, а прикраси — у `app/src/festive.ts`.

**Англійська.** `scripts/lang_en.py` (запускається наприкінці `gen_base_content.py`) збирає `content/base/en.json` з перекладів `scripts/lang/en/*.json` (`{"український текст": "English"}`). Новий рядок без перекладу скрипт показує; `--missing out.json` випише їх, `--strict` провалить перевірку. Імена — транслітерацією (Липове → Lypove), назви вулиць і описові назви — перекладом.

Після змін: перегенеруй вміст, `python3 scripts/lang_en.py --strict`, `check_economy.py`, `check_quests.py`, `cargo test -p teul-core --test all base_content` (усі тести ядра зібрано в одну програму `tests/all.rs`).

## Де в коді

`scripts/gen_base_content.py`, `scripts/world_maps.py` (`Map`, `light_streets`), `scripts/interiors.py` (`Inside`), `scripts/town_growth.py` (`landmark`), `scripts/town_widen.py` (`widen`), `scripts/economy.py` (`st`, `aid`, `good`, `key`), `scripts/quests.py`, `crates/teul-core/src/content.rs` (`Content`, `from_packs`).
