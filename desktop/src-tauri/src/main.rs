// teul on the desktop: the built web app (../../app/dist) in a system webview, plus the few things a page cannot do
// by itself. The page calls these through `window.__TAURI__.core.invoke`:
// - `secret_get` / `secret_set` / `secret_delete`: the data key of the saves, in the OS keyring (Secret Service, Windows Credential
//   Manager); a private file in the app's data folder when no keyring is running, so the game always starts;
// - `save_file` / `open_file`: a native Save / Open dialog for backups and codes (bytes as base64);
// - `set_fullscreen`: the window over the whole screen, or back;
// - `exit_app`: closes the app.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::Engine as _;
use std::collections::BTreeMap;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

const SERVICE: &str = "com.teul.app";

fn b64() -> base64::engine::GeneralPurpose {
    base64::engine::general_purpose::STANDARD
}

/// The fallback file of secrets (only when no keyring answers).
fn secrets_file(app: &AppHandle) -> Option<PathBuf> {
    let dir = app.path().app_data_dir().ok()?;
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir.join("secrets.json"))
}

fn read_secrets(app: &AppHandle) -> BTreeMap<String, String> {
    secrets_file(app)
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_default()
}

fn write_secrets(app: &AppHandle, all: &BTreeMap<String, String>) -> Result<(), String> {
    let path = secrets_file(app).ok_or("no data folder")?;
    let text = serde_json::to_string(all).map_err(|e| e.to_string())?;
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, text).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&tmp, std::fs::Permissions::from_mode(0o600));
    }
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

#[tauri::command]
fn secret_get(app: AppHandle, name: String) -> Option<String> {
    match keyring::Entry::new(SERVICE, &name).and_then(|e| e.get_password()) {
        Ok(v) => Some(v),
        Err(keyring::Error::NoEntry) => read_secrets(&app).remove(&name),
        Err(e) => {
            eprintln!("teul: keyring unavailable ({e}); using the private file");
            read_secrets(&app).remove(&name)
        }
    }
}

#[tauri::command]
fn secret_set(app: AppHandle, name: String, value: String) -> Result<(), String> {
    match keyring::Entry::new(SERVICE, &name).and_then(|e| e.set_password(&value)) {
        Ok(()) => {
            // stored in the keyring: nothing stays in the file
            let mut all = read_secrets(&app);
            if all.remove(&name).is_some() {
                let _ = write_secrets(&app, &all);
            }
            Ok(())
        }
        Err(e) => {
            eprintln!("teul: keyring unavailable ({e}); keeping the secret in the private file");
            let mut all = read_secrets(&app);
            all.insert(name, value);
            write_secrets(&app, &all)
        }
    }
}

#[tauri::command]
fn secret_delete(app: AppHandle, name: String) -> Result<(), String> {
    if let Ok(e) = keyring::Entry::new(SERVICE, &name) {
        let _ = e.delete_credential();
    }
    let mut all = read_secrets(&app);
    if all.remove(&name).is_some() {
        write_secrets(&app, &all)?;
    }
    Ok(())
}

#[tauri::command]
async fn save_file(app: AppHandle, name: String, data: String) -> Result<bool, String> {
    let bytes = b64().decode(data.as_bytes()).map_err(|e| e.to_string())?;
    let Some(path) = app.dialog().file().set_file_name(&name).blocking_save_file() else {
        return Ok(false);
    };
    let path = path.into_path().map_err(|e| e.to_string())?;
    std::fs::write(path, bytes).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
async fn open_file(app: AppHandle) -> Result<Option<String>, String> {
    let Some(path) = app.dialog().file().add_filter("Липове", &["teulbackup", "teul"]).add_filter("*", &["*"]).blocking_pick_file() else {
        return Ok(None);
    };
    let path = path.into_path().map_err(|e| e.to_string())?;
    let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
    Ok(Some(b64().encode(bytes)))
}

#[tauri::command]
fn set_fullscreen(window: tauri::WebviewWindow, on: bool) -> Result<(), String> {
    window.set_fullscreen(on).map_err(|e| e.to_string())
}

#[tauri::command]
fn exit_app(app: AppHandle) {
    app.exit(0);
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![secret_get, secret_set, secret_delete, save_file, open_file, set_fullscreen, exit_app])
        .run(tauri::generate_context!())
        .expect("teul: the window could not be opened");
}
