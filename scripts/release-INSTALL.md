# Lypove (teul) {{VERSION}} — how to install

Українською — нижче.

All files in this folder are the same world for different devices. To check that a file is intact: `sha256sum -c SHA256SUMS` (Linux) or `certutil -hashfile <file> SHA256` (Windows) — the sum must match its line in `SHA256SUMS`.

| Device | File |
|---|---|
| Android 7.0 and newer | `teul-{{VERSION}}.apk` |
| Linux (Debian, Ubuntu, Mint…) | `teul_{{VERSION}}_amd64.deb` |
| Linux (any, without installing) | `teul-{{VERSION}}-x86_64.AppImage` |
| Windows 10 / 11 (64-bit) | `teul-{{VERSION}}-setup.exe` |

`teul-{{VERSION}}.aab` is for an app store (Google Play); it is not installed by hand.

## Android

1. Copy `teul-{{VERSION}}.apk` to the phone (or download it right there).
2. Open the file in Files or in the browser. Android asks for permission: **Settings → “Install unknown apps”** → allow it for the app you opened the file with (Files, Chrome…).
3. Tap “Install”. If Play Protect says the app is unknown — “More details → Install anyway”. The app is signed with our key, it just does not come from a store.

## Linux

- **.deb**: `sudo apt install ./teul_{{VERSION}}_amd64.deb`; then “Lypove” (teul) appears in the application menu. To remove: `sudo apt remove teul`.
- **AppImage**: `chmod +x teul-{{VERSION}}-x86_64.AppImage` and run it. It needs FUSE 2 (`sudo apt install libfuse2` / `libfuse2t64`); without it — `./teul-{{VERSION}}-x86_64.AppImage --appimage-extract-and-run`.
- The saves' key lives in the system keyring (GNOME Keyring / KWallet). Without one, the key is kept in a closed file in the app's data folder.

## Windows

1. Run `teul-{{VERSION}}-setup.exe`. It installs for your user; no administrator rights are needed.
2. Windows SmartScreen may say “Windows protected your PC” because the installer has no “reputation” yet: click **“More info” → “Run anyway”**.
   - If there is no “Run anyway” and Windows says **Smart App Control** blocked the app: it lets no unsigned programs run, and the only way around it is to turn it off in **Windows Security → App & browser control → Smart App Control**. It cannot be turned back on without reinstalling Windows, so it is better to wait for a signed build.
   - If the file came through a messenger or a browser and does not start: **right-click the file → Properties → “Unblock”** (at the bottom of the General tab) → OK.
   - If the file vanished right after downloading, the antivirus took it (a false alarm on an unsigned installer): **Windows Security → Virus & threat protection → Protection history** → find teul → “Allow”.
3. If the system has no Microsoft Edge WebView2 (Windows 10/11 nearly always has it), the installer downloads it — that needs the internet while installing.

## Updating

Install a new version right over the old one (the new version's same file) — nothing needs removing. The world and the settings stay: new versions always open old saves.

On Android an update installs only over a version signed with the same key (that is, ours). If you ever have to reinstall the app from scratch, make a backup first.

## Backup and moving to another device

**Settings → “Backup”**: the world is saved into one file under a password you make up. Move the file to another device (any of these) and open it there in the same window. On Android this is the only way to move the world: Google's system backup and “data transfer” to a new phone do not carry the world (its key never leaves the phone). Without the password the file cannot be opened — remember it. The app also keeps the last three daily copies on the device itself.

---

# Липове (teul) {{VERSION}} — як встановити

Усі файли цієї теки — один і той самий світ для різних пристроїв. Перевірити, що файл не пошкоджений: `sha256sum -c SHA256SUMS` (Linux) або `certutil -hashfile <файл> SHA256` (Windows) — сума має збігтися з рядком у `SHA256SUMS`.

| Пристрій | Файл |
|---|---|
| Android 7.0 і новіший | `teul-{{VERSION}}.apk` |
| Linux (Debian, Ubuntu, Mint…) | `teul_{{VERSION}}_amd64.deb` |
| Linux (будь-який, без встановлення) | `teul-{{VERSION}}-x86_64.AppImage` |
| Windows 10 / 11 (64-біт) | `teul-{{VERSION}}-setup.exe` |

`teul-{{VERSION}}.aab` — для магазину застосунків (Google Play), вручну його не встановлюють.

## Android

1. Скопіюйте `teul-{{VERSION}}.apk` на телефон (або завантажте просто на ньому).
2. Відкрийте файл у «Файлах» чи в браузері. Android попросить дозволу: **Налаштування → «Встановлення невідомих програм»** → увімкніть для застосунку, яким ви відкрили файл (Файли, Chrome…).
3. Натисніть «Встановити». Якщо Play Захист скаже, що застосунок невідомий, — «Більше відомостей → Усе одно встановити». Застосунок підписаний нашим ключем, просто не з магазину.

## Linux

- **.deb**: `sudo apt install ./teul_{{VERSION}}_amd64.deb`, далі «Липове» (teul) з'явиться в меню програм. Видалити: `sudo apt remove teul`.
- **AppImage**: `chmod +x teul-{{VERSION}}-x86_64.AppImage` і запустіть його. Потрібен FUSE 2 (`sudo apt install libfuse2` / `libfuse2t64`); без нього — `./teul-{{VERSION}}-x86_64.AppImage --appimage-extract-and-run`.
- Ключ збережень лежить у системній в'язці ключів (GNOME Keyring / KWallet). Якщо її немає, ключ зберігається в закритому файлі в теці даних застосунку.

## Windows

1. Запустіть `teul-{{VERSION}}-setup.exe`. Встановлення йде для вашого користувача, права адміністратора не потрібні.
2. Windows SmartScreen може сказати «Windows захистив ваш комп'ютер», бо установник ще не має «репутації»: натисніть **«Докладніше» → «Виконати однаково»**.
   - Якщо кнопки «Виконати однаково» немає, а Windows пише, що **Smart App Control** (Інтелектуальне керування застосунками) заблокував програму: він не пускає жодних непідписаних програм, і обійти його можна лише вимкнувши в **Безпека Windows → Керування застосунками й браузером → Інтелектуальне керування застосунками**. Назад його без перевстановлення Windows не ввімкнути, тож краще дочекатися підписаної збірки.
   - Якщо файл отримано через месенджер чи браузер і він не запускається: **ПКМ по файлу → Властивості → «Розблокувати»** (внизу вкладки «Загальні») → OK.
   - Якщо файл зник одразу після завантаження, його забрав антивірус (хибна тривога на непідписаний установник): **Безпека Windows → Захист від вірусів і загроз → Журнал захисту** → знайти teul → «Дозволити».
3. Якщо в системі немає Microsoft Edge WebView2 (на Windows 10/11 він майже завжди вже є), установник сам його завантажить — потрібен інтернет під час встановлення.

## Оновлення

Нову версію ставте просто поверх старої (той самий файл нової версії) — нічого видаляти не треба. Світ і налаштування лишаються: нові версії завжди відкривають старі збереження.

На Android оновлення встановиться лише поверх версії, підписаної тим самим ключем (тобто нашої). Якщо колись доведеться перевстановити застосунок начисто, спершу зробіть резервну копію.

## Резервна копія й перенесення на інший пристрій

**Налаштування → «Резервна копія»**: світ зберігається в один файл під паролем, який ви вигадаєте. Перенесіть файл на інший пристрій (будь-який із цих) і відкрийте його там у тому самому вікні. На Android це єдиний спосіб перенести світ: системна резервна копія Google і «перенесення даних» на новий телефон світу не переносять (його ключ ніколи не залишає телефон). Без пароля файл не відкрити — запам'ятайте його. Крім того, застосунок сам тримає три останні щоденні копії на самому пристрої.
