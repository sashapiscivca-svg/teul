# Релізи: Android, Linux, Windows

[English](release.md)

**Коротко.** `scripts/release.sh` збирає все в `release/<версія>/`: підписаний мінімізований APK і AAB для Android, `.deb` і `.AppImage` для Linux, установник NSIS `.exe` для Windows, `SHA256SUMS` та `INSTALL.md` (як встановити, українською; шаблон — `scripts/release-INSTALL.md`). Тека `release/` у git не потрапляє.

## Одна версія

Версія живе в одному місці — `app/package.json`, поле `"version"` (`major.minor.patch`). Звідти її беруть:

- Android (`app/android/app/build.gradle`): `versionName` = версія, `versionCode` = `major·10000 + minor·100 + patch` (1.0.0 → 10000, 1.2.3 → 10203). Код має лише зростати, інакше Android не поставить оновлення.
- Tauri (`desktop/src-tauri/tauri.conf.json`: `"version": "../../app/package.json"`).

Кожен запуск `scripts/release.sh` спершу піднімає patch-номер у `app/package.json` і `package-lock.json` (1.0.0 → 1.0.1; після 1.0.99 іде 1.1.0, бо `versionCode` тримає patch нижче 100), тож кожна збірка ставиться поверх попередньої як оновлення. `--same-version` перезбирає поточну версію без підйому. Мажорну чи мінорну версію міняють руками в `"version"`.

## Збереження не ламаються

Оновлення ставиться поверх старої версії й мусить відкрити кожне старе збереження. Правила (ніколи не перейменовувати й не видаляти варіанти подій, команд і id вмісту без таблиці псевдонімів чи списку вилученого, версія формату збереження, міграції, золоті збереження в тестах) описані в [architecture.uk.md](architecture.uk.md#цілісність-і-сумісність-збережень).

## Android

```bash
scripts/android-keystore.sh          # один раз: ключ підпису
scripts/build-android-release.sh     # wasm → app/dist (production) → cap sync → assembleRelease + bundleRelease
```

- **Ключ підпису.** `scripts/android-keystore.sh` один раз створює сховище ключів (PKCS12, RSA 4096, псевдонім `teul`, 10000 днів) і файл `keystore.properties` з випадковим паролем — обидва в окремій теці поза репозиторієм, з правами 600 (теку можна задати змінною `TEUL_RELEASE_DIR`). Gradle читає `keystore.properties` із цієї теки за замовчуванням або з шляху в змінній `TEUL_KEYSTORE_PROPERTIES`. Жоден із цих файлів не можна додавати в git.
- **Збережіть копію обох файлів** (зашифрована флешка, менеджер паролів). Без цього ключа нову версію не можна встановити поверх уже встановленої: людям довелося б видаляти застосунок (а з ним і світ, якщо немає резервної копії).
- Без `keystore.properties` реліз збирається непідписаним (`app-release-unsigned.apk`), і скрипт зупиняється.
- Реліз мінімізується R8 (`minifyEnabled`, `shrinkResources`). Правила — `app/android/app/proguard-rules.pro`: Capacitor знаходить плагіни й методи за анотаціями та іменами, тому `com.getcapacitor.**`, класи з `@CapacitorPlugin`, `com.capacitorjs.plugins.**` і `com.aparajita.**` (сховище ключа в Android Keystore) зберігаються як є.
- **Без системних резервних копій.** `android:allowBackup="false"`, `fullBackupContent="false"` і `res/xml/data_extraction_rules.xml`, що виключає все (і хмарну копію, і перенесення телефон→телефон). Збереження зашифровані ключем з Android Keystore, а цей ключ Android не переносить, тож відновлена копія даних WebView була б нечитабельною. Перенесення на новий телефон — це файл гравця «Резервна копія».
- Вебзбірка — режим `production`: тестових прапорців URL і хука `window.__teul` у ній немає (`release.sh` перевіряє це й зупиняється, якщо хук знайдено).

## Комп'ютер (Tauri v2)

Проєкт — `desktop/`: `src-tauri/` (Rust, Tauri 2.12, версії закріплені через `=`) обгортає готовий `app/dist` у системний WebView (WebKitGTK на Linux, WebView2 на Windows). Сторінка викликає через `window.__TAURI__.core.invoke` лише сім команд застосунку:

| Команда | Що робить |
|---|---|
| `secret_get {name}` / `secret_set {name, value}` / `secret_delete {name}` | Ключ збережень у системній в'язці ключів (`keyring`: Secret Service на Linux, Credential Manager на Windows). Якщо в'язки немає — закритий файл `secrets.json` (0600) у теці даних застосунку; гра запускається завжди |
| `save_file {name, data}` | Системне вікно «Зберегти як» (дані — base64), `false`, якщо скасовано |
| `open_file {}` | Системне вікно «Відкрити» (фільтр `*.teulbackup`, `*.teul`), повертає base64 або `null` |
| `set_fullscreen {on}` | На весь екран і назад |
| `exit_app {}` | Закрити застосунок |

Доступу до файлів, оболонки й інших плагінів сторінка не має. CSP офлайнова: лише свої скрипти й wasm (`'wasm-unsafe-eval'`), стилі з `'unsafe-inline'`, картинки, звук і шрифти — свої або з `data:`/`blob:`, з'єднання — лише зі своїм застосунком (`ipc:`), жодних зовнішніх адрес.

### Збірка на Linux

Хостові не потрібні ні заголовки GTK/WebKit, ні NSIS, ні Windows SDK: усе в контейнері `desktop/build.Containerfile` (Debian trixie, Rust 1.99, `cargo-xwin`, clang/lld, NSIS). Потрібен лише podman (або docker), root не потрібен.

```bash
npm --prefix app run build                 # app/dist у режимі production
desktop/build-in-container.sh linux        # → release/<v>/teul_<v>_amd64.deb, teul-<v>-x86_64.AppImage
desktop/build-in-container.sh windows      # → release/<v>/teul-<v>-setup.exe (NSIS, крос-збірка cargo-xwin)
```

Кеш (реєстр cargo, `target`, Windows SDK від xwin, linuxdeploy) лежить у `~/.cache/teul-desktop` (інше місце — змінна `TEUL_DESKTOP_CACHE`), тож повторні збірки швидкі. Перша збірка образу контейнера й першого Windows-збирання завантажує кілька сотень МБ (xwin приймає ліцензію Microsoft CRT/SDK за вас через `XWIN_ACCEPT_LICENSE=1`).

### Збірка на Windows (для `.msi` або якщо крос-збірка не вдалася)

`.msi` збирає лише WiX, який працює тільки на Windows. На машині з Windows 10/11:

1. Встановіть [Rust](https://rustup.rs) (MSVC, `x86_64-pc-windows-msvc`), Visual Studio Build Tools із «Desktop development with C++», Node.js 20+, WebView2 (на Windows 11 уже є).
2. Встановіть інструменти wasm (з кореня репозиторію): `rustup target add wasm32-unknown-unknown`, `cargo install wasm-bindgen-cli --version 0.2.129`.
3. Зберіть вебчастину: `cargo build -p teul-wasm --target wasm32-unknown-unknown --release`, `wasm-bindgen target/wasm32-unknown-unknown/release/teul_wasm.wasm --out-dir app/src/wasm --target web --typescript`, `cd app && npm ci`.
4. `cd desktop && npm ci && npm run build:windows` (= `npm --prefix ../app run build` + `tauri build --bundles nsis,msi`).
5. Файли: `desktop/src-tauri/target/release/bundle/nsis/teul_<v>_x64-setup.exe` і `desktop/src-tauri/target/release/bundle/msi/teul_<v>_x64_en-US.msi`.

## Усе разом

```bash
scripts/release.sh                       # усе
scripts/release.sh --no-windows          # без Windows; також --no-android, --no-linux, --no-web
```

Результат — `release/<версія>/` з `SHA256SUMS` та `INSTALL.md`. Як встановлювати на кожну систему (дозвіл «Встановлення невідомих програм» на Android, SmartScreen на Windows, FUSE для AppImage) — у `INSTALL.md`.
