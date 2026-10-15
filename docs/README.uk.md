# teul — документація

[English](README.md)

**Коротко.** teul — це офлайн-світ у піксельній ізометрії: містечко **Липове** з лісом, полем, фермою та околицями. Воно живе за справжнім календарем і годинником пристрою. Ядро на Rust детерміноване й побудоване на подіях, клієнт написаний на TypeScript, на Android світ працює через Capacitor, на комп'ютері — через Tauri. Гра повністю офлайнова й однокористувацька.

## Принципи, які не змінюються

- **Детермінізм.** Усе, що вирішує результат, живе в ядрі (`crates/teul-core`). Ядро не читає годинника і не має `f64`. Однакові зерно світу, вміст і журнал подій дають однаковий світ на будь-якому пристрої. Клієнт лише просить і малює.
- **Справжній календар.** Пори року, дні тижня, свята, Великдень, рівнодення й повня — справжні, за київським часом (`time::Calendar`, `holidays.rs`). Ігрового годинника немає.
- **Повністю офлайн.** Жодних серверів і жодних акаунтів: світ живе лише на пристрої, а на інший пристрій переходить файлом резервної копії.
- **Це світ, а не гра з завданнями.** Немає квот, лічильників, шкал чи текстів-інструкцій. Коли щось неможливо, світ пояснює це своїми словами. Тепло, настрій і стосунки показуються виглядом, жестами й словами, а не числами. Єдине число на екрані погоди — температура біля годинника.
- **Удома нічого не платить.** Монети приходять лише з містечка: робота, прохання, допомога, продаж.
- **Мова й тон.** Світ український; є англійська (вибір у налаштуваннях, уперше — за мовою пристрою). Кожен рядок клієнта — ключ у таблицях `app/src/lang/*.ts` з українським і англійським текстом; слова вмісту — накладка `content/base/en.json`; текст ядра обирається за `Content::lang`. Мова ніколи не впливає на перебіг світу. Тон міжнародний, з характером: свята світські, нейтральні й масштабні, а церковні дати лишаються тихими фактами календаря.

## Карта документації

| Файл | Про що |
|---|---|
| [architecture.uk.md](architecture.uk.md) | Шари, події та журнал вводу, знімки, чесна гра, кадр і рендер, продуктивність, збереження, шифрування, сумісність |
| [content.uk.md](content.uk.md) | Конвеєр вмісту: `gen_base_content.py`, карти, предмети, станції, мешканці, перевірки |
| [testing.uk.md](testing.uk.md) | Усі набори тестів і тестові прапорці URL |
| [release.uk.md](release.uk.md) | Релізи: підписаний APK/AAB, Linux `.deb`/`.AppImage`, Windows `.exe` (Tauri), одна версія, ключ підпису |
| [glossary.uk.md](glossary.uk.md) | Словник термінів |
| [world-economy.md](world-economy.md) | Технічна специфікація економіки та систем (англійською; на її розділи посилаються коментарі в коді) |

Системи світу (`docs/world/`):

| Файл | Про що |
|---|---|
| [time-and-calendar.uk.md](world/time-and-calendar.uk.md) | Календар, свята з підготовкою, розломи, повня, небесні події |
| [life.uk.md](world/life.uk.md) | Розклади мешканців, винятки, хвороби, дорога на роботу |
| [feelings.uk.md](world/feelings.uk.md) | Настрої, зв'язки між людьми, тепло до гравця |
| [town.uk.md](world/town.uk.md) | Зростання й знос міста, проєкти громади, народження, рідкісні дні, морозиво, пончики |
| [paper.uk.md](world/paper.uk.md) | Газета: сюжети, фото, пропущені випуски, АЕС |
| [places.uk.md](world/places.uk.md) | Усі локації |
| [faiths.uk.md](world/faiths.uk.md) | Костел, храм, капище |
| [weather-and-warmth.uk.md](world/weather-and-warmth.uk.md) | Температура, відчуття тепла, іній, крига, одяг |
| [economy.uk.md](world/economy.uk.md) | Монети, кишеня, станції, допомоги, роботи, город, навички |
| [home.uk.md](world/home.uk.md) | Дім, редактор, добудови, рахунки, кухня, знос, крафт, інструменти, улюбленці |
| [media.uk.md](world/media.uk.md) | Інструменти й твори, ТВ, радіо, платівки, комп'ютер |
| [drive.uk.md](world/drive.uk.md) | Автошкола, права, авто, порушення, камера, гроші на дорозі |
| [horror.uk.md](world/horror.uk.md) | Моторошні ночі (вмикаються в налаштуваннях) |
| [rifts.uk.md](world/rifts.uk.md) | Чотири світи розломів і місто навиворіт |
| [taxi.uk.md](world/taxi.uk.md) | Таксі: ціна за дорогою, хвилинами й попитом |
| [maps.uk.md](world/maps.uk.md) | «Мапи» на смартфоні й комп'ютері: вулиці, пошук, маршрут, шари |
| [sitting-and-poses.uk.md](world/sitting-and-poses.uk.md) | Сидіння, лежання, пози |
| [hud-and-ui.uk.md](world/hud-and-ui.uk.md) | Верхня панель, меню, вікна |
| [rules.uk.md](world/rules.uk.md) | Правила побудови світу |

## Як зібрати й запустити

Інструменти проєкту ставляться в `.toolchain/` (git його ігнорує):

```bash
bash scripts/install-toolchain.sh      # Rust stable + wasm32, wasm-bindgen-cli за Cargo.lock, JDK 21
source .toolchain/env.sh               # RUSTUP_HOME, CARGO_HOME, JAVA_HOME, ANDROID_HOME, PATH
```

| Крок | Команда |
|---|---|
| Згенерувати вміст | `python3 scripts/gen_base_content.py` → `content/base/pack.json` |
| Перевірити вміст | `python3 scripts/check_economy.py`, `python3 scripts/check_quests.py` |
| Тести ядра | `cargo test` (з кореня) |
| Усі перевірки | `scripts/check.sh` (лише те, що зачепила зміна), `scripts/check.sh --full` (усе — перед злиттям і релізом) |
| Ядро в WebAssembly | `cd app && npm run wasm` (= `scripts/build-wasm.sh --target web` → `app/src/wasm/`) |
| Розробка | `cd app && npm run dev` |
| Модульні тести клієнта | `cd app && npx vitest run` |
| Збірка для e2e | `cd app && npm run build:e2e` (режим `e2e`, де є `window.__teul`) |
| e2e | `npx vite preview --port 4300` і `BASE=http://localhost:4300/ node e2e/flows.mjs` |
| APK (debug) | `scripts/build-apk.sh` → `app/android/app/build/outputs/apk/debug/app-debug.apk` |
| Реліз (усе) | `scripts/release.sh` → `release/<версія>/` (APK, AAB, `.deb`, `.AppImage`, `.exe`, `SHA256SUMS`, `INSTALL.md`), див. [release.uk.md](release.uk.md) |
| Комп'ютер | `desktop/` (Tauri v2): `desktop/build-in-container.sh linux\|windows` |

Тестові прапорці URL працюють лише в непродакшн-збірках (`import.meta.env.MODE !== 'production'`): `?debug` (хук `window.__teul`), `?skip` (без заставки), `?shift=<хвилини>` (перемотати годинник уперед), `?lang=en|uk` (мова на цю сесію), `?rich` (окремий тестовий світ із 6000 монет), `?perf` (таймер секцій кадру), `?world=<id>` (інший тестовий світ). Подробиці — у [testing.uk.md](testing.uk.md).
