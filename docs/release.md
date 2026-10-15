# Releases: Android, Linux, Windows

[Українською](release.uk.md)

**In short.** `scripts/release.sh` builds everything into `release/<version>/`: a signed, minified APK and AAB for Android, a `.deb` and an `.AppImage` for Linux, an NSIS `.exe` installer for Windows, `SHA256SUMS` and `INSTALL.md` (how to install, in Ukrainian; the template is `scripts/release-INSTALL.md`). The `release/` folder never goes into git.

## One version

The version lives in one place: `app/package.json`, the `"version"` field (`major.minor.patch`). It is taken from there by:

- Android (`app/android/app/build.gradle`): `versionName` = the version, `versionCode` = `major·10000 + minor·100 + patch` (1.0.0 → 10000, 1.2.3 → 10203). The code must only grow, otherwise Android will not install the update.
- Tauri (`desktop/src-tauri/tauri.conf.json`: `"version": "../../app/package.json"`).

Every run of `scripts/release.sh` first raises the patch number in `app/package.json` and `package-lock.json` (1.0.0 → 1.0.1; after 1.0.99 comes 1.1.0, because `versionCode` keeps the patch below 100), so each build installs over the previous one as an update. `--same-version` rebuilds the current version without raising it. The major or minor version is changed by hand in `"version"`.

## Saves do not break

An update installs over the old version and must open every old save. The rules (never rename or remove event, command or content id variants without an alias table or the retired list, the save format version, migrations, golden saves in the tests) are described in [architecture.md](architecture.md#save-integrity-and-compatibility).

## Android

```bash
scripts/android-keystore.sh          # once: the signing key
scripts/build-android-release.sh     # wasm → app/dist (production) → cap sync → assembleRelease + bundleRelease
```

- **The signing key.** `scripts/android-keystore.sh` makes, once, a keystore (PKCS12, RSA 4096, alias `teul`, 10000 days) and a `keystore.properties` file with a random password — both in a separate folder outside the repository, with permissions 600 (the folder can be set with the `TEUL_RELEASE_DIR` variable). Gradle reads `keystore.properties` from that default folder or from the path in the `TEUL_KEYSTORE_PROPERTIES` variable. Neither file may ever be added to git.
- **Keep a copy of both files** (an encrypted USB stick, a password manager). Without this key a new version cannot be installed over the one already installed: people would have to uninstall the app (and with it the world, if they have no backup).
- Without `keystore.properties` the release is built unsigned (`app-release-unsigned.apk`), and the script stops.
- The release is minified by R8 (`minifyEnabled`, `shrinkResources`). The rules are in `app/android/app/proguard-rules.pro`: Capacitor finds plugins and methods by annotations and names, so `com.getcapacitor.**`, classes with `@CapacitorPlugin`, `com.capacitorjs.plugins.**` and `com.aparajita.**` (the key storage in the Android Keystore) are kept as they are.
- **No system backups.** `android:allowBackup="false"`, `fullBackupContent="false"` and `res/xml/data_extraction_rules.xml`, which excludes everything (both the cloud backup and phone-to-phone transfer). Saves are encrypted with a key from the Android Keystore, and Android does not transfer that key, so a restored copy of the WebView data would be unreadable. Moving to a new phone is done with the player's "Backup" file.
- The web build is in `production` mode: it has no test URL flags and no `window.__teul` hook (`release.sh` checks this and stops if the hook is found).

## Computer (Tauri v2)

The project is `desktop/`: `src-tauri/` (Rust, Tauri 2.12, versions pinned with `=`) wraps the finished `app/dist` in the system WebView (WebKitGTK on Linux, WebView2 on Windows). Through `window.__TAURI__.core.invoke` the page can call only seven commands of the app:

| Command | What it does |
|---|---|
| `secret_get {name}` / `secret_set {name, value}` / `secret_delete {name}` | The saves' key in the system keyring (`keyring`: Secret Service on Linux, Credential Manager on Windows). Without a keyring, a private `secrets.json` file (0600) in the app's data folder; the game always starts |
| `save_file {name, data}` | The system "Save as" dialog (data in base64), `false` if cancelled |
| `open_file {}` | The system "Open" dialog (filter `*.teulbackup`, `*.teul`), returns base64 or `null` |
| `set_fullscreen {on}` | Full screen on and off |
| `exit_app {}` | Close the app |

The page has no access to files, the shell or other plugins. The CSP is offline: only the app's own scripts and wasm (`'wasm-unsafe-eval'`), styles with `'unsafe-inline'`, images, sound and fonts from the app itself or from `data:`/`blob:`, connections only to the app itself (`ipc:`), no outside addresses.

### Building on Linux

The host needs neither GTK/WebKit headers, nor NSIS, nor a Windows SDK: everything is in the container `desktop/build.Containerfile` (Debian trixie, Rust 1.99, `cargo-xwin`, clang/lld, NSIS). Only podman (or docker) is needed, and no root.

```bash
npm --prefix app run build                 # app/dist in production mode
desktop/build-in-container.sh linux        # → release/<v>/teul_<v>_amd64.deb, teul-<v>-x86_64.AppImage
desktop/build-in-container.sh windows      # → release/<v>/teul-<v>-setup.exe (NSIS, cross-built with cargo-xwin)
```

The cache (the cargo registry, `target`, the Windows SDK from xwin, linuxdeploy) lives in `~/.cache/teul-desktop` (another place with the `TEUL_DESKTOP_CACHE` variable), so later builds are fast. The first build of the container image and the first Windows build download a few hundred MB (xwin accepts the Microsoft CRT/SDK licence for you through `XWIN_ACCEPT_LICENSE=1`).

### Building on Windows (for an `.msi`, or if cross-building failed)

An `.msi` is built only by WiX, which runs only on Windows. On a Windows 10/11 machine:

1. Install [Rust](https://rustup.rs) (MSVC, `x86_64-pc-windows-msvc`), Visual Studio Build Tools with "Desktop development with C++", Node.js 20+, WebView2 (Windows 11 already has it).
2. Install the wasm tools (from the repository root): `rustup target add wasm32-unknown-unknown`, `cargo install wasm-bindgen-cli --version 0.2.129`.
3. Build the web part: `cargo build -p teul-wasm --target wasm32-unknown-unknown --release`, `wasm-bindgen target/wasm32-unknown-unknown/release/teul_wasm.wasm --out-dir app/src/wasm --target web --typescript`, `cd app && npm ci`.
4. `cd desktop && npm ci && npm run build:windows` (= `npm --prefix ../app run build` + `tauri build --bundles nsis,msi`).
5. The files: `desktop/src-tauri/target/release/bundle/nsis/teul_<v>_x64-setup.exe` and `desktop/src-tauri/target/release/bundle/msi/teul_<v>_x64_en-US.msi`.

## Everything at once

```bash
scripts/release.sh                       # everything
scripts/release.sh --no-windows          # without Windows; also --no-android, --no-linux, --no-web
```

The result is `release/<version>/` with `SHA256SUMS` and `INSTALL.md`. How to install on each system (the "Install unknown apps" permission on Android, SmartScreen on Windows, FUSE for the AppImage) is in `INSTALL.md`.
