use serde_json::Value;
use teul_wasm::engine::EngineCore;

const PACK: &str = include_str!("../../../content/base/pack.json");

fn packs() -> String {
    serde_json::to_string(&vec![PACK]).unwrap()
}

fn engine() -> EngineCore {
    EngineCore::new(&packs(), 1, 7, 1_700_000_000, "[]").unwrap()
}

fn json(s: &str) -> Value {
    serde_json::from_str(s).unwrap()
}

#[test]
fn a_fresh_engine_reports_the_start_wallet_and_room() {
    let e = engine();
    assert_eq!(json(&e.wallet_view())["coins"], 300);
    let room = json(&e.room_view());
    assert_eq!(room["cells"].as_array().unwrap().len(), 100);
    assert_eq!(room["styles"]["floor"], "floor.oak");
}

#[test]
fn a_command_returns_its_events_and_queues_them_for_draining() {
    let mut e = engine();
    // naming the player: the only event is the name
    let r = json(&e.command(10, r#"{"type":"name_player","name":"Орися"}"#));
    assert_eq!(r["ok"], true);
    assert_eq!(r["events"][0]["kind"]["type"], "PlayerNamed");
    // the save gets the input too (logged first, chained), so the outcome can be re-derived when it is opened
    let drained = json(&e.drain_events());
    assert_eq!(drained.as_array().unwrap().len(), 2);
    assert_eq!(drained[0]["kind"]["type"], "Input");
    assert_eq!(drained[1]["kind"]["type"], "PlayerNamed");
    assert!(drained[1]["chain"].as_u64().unwrap() > 0);
    assert!(json(&e.drain_events()).as_array().unwrap().is_empty(), "draining empties the queue");
}

#[test]
fn reloading_from_drained_events_reproduces_the_state() {
    let mut e = engine();
    e.command(10, r#"{"type":"acquire","item":"fern"}"#);
    e.command(11, r#"{"type":"place","item":"fern","x":1,"y":1,"rot":0}"#);
    e.command(12, r#"{"type":"perform","action":"water_plant","pid":0}"#);
    let events = e.drain_events();
    let reloaded = EngineCore::new(&packs(), 1, 7, 1_700_000_000, &events).unwrap();
    assert_eq!(reloaded.room_view(), e.room_view());
    assert_eq!(reloaded.wallet_view(), e.wallet_view());
    // the fern cost 10; watering it pays nothing
    assert_eq!(json(&reloaded.wallet_view())["coins"], 290, "watering pays nothing");
}

#[test]
fn a_locked_purchase_comes_back_as_structured_json() {
    let mut e = engine();
    let r = json(&e.command(10, r#"{"type":"acquire","item":"piano"}"#));
    assert_eq!(r["ok"], false);
    assert_eq!(r["error"]["kind"], "locked");
    assert_eq!(r["error"]["missing"][0]["type"], "coins");
    assert!(json(&e.drain_events()).as_array().unwrap().is_empty());
}

#[test]
fn a_bad_placement_names_the_reason() {
    let mut e = engine();
    e.command(10, r#"{"type":"acquire","item":"sofa2"}"#);
    let r = json(&e.command(11, r#"{"type":"place","item":"sofa2","x":9,"y":0,"rot":0}"#));
    assert_eq!(r["error"]["kind"], "place");
    assert_eq!(r["error"]["reason"], "OutOfBounds");
}

#[test]
fn bad_json_is_an_error_not_a_panic() {
    let mut e = engine();
    for bad in ["", "nonsense", r#"{"type":"explode"}"#, r#"{"type":"place"}"#, "null", "[]"] {
        let r = json(&e.command(10, bad));
        assert_eq!(r["ok"], false, "{bad}");
        assert_eq!(r["error"]["kind"], "bad_command", "{bad}");
    }
    assert!(EngineCore::new("nonsense", 1, 1, 0, "[]").is_err());
    assert!(EngineCore::new(&packs(), 1, 1, 0, "nonsense").is_err());
}

#[test]
fn time_going_backwards_is_reported() {
    let mut e = engine();
    e.command(100, r#"{"type":"acquire","item":"fern"}"#);
    let r = json(&e.command(50, r#"{"type":"acquire","item":"fern"}"#));
    assert_eq!(r["error"]["kind"], "clock_went_backwards");
}

#[test]
fn the_catalog_carries_models_and_the_shop_carries_status() {
    let e = engine();
    let catalog = json(&e.catalog());
    assert!(catalog["items"]["sofa3"]["model"].as_array().unwrap().len() >= 3);
    assert!(catalog["styles"]["floor.oak"]["params"]["color"].is_string());
    assert!(catalog["palettes"]["fabric"].is_array());
    let shop = json(&e.shop_view(10));
    let bed = shop.as_array().unwrap().iter().find(|s| s["id"] == "piano").unwrap();
    assert_eq!(bed["status"]["state"], "locked");
}

#[test]
fn unix_milliseconds_convert_to_world_minutes_relative_to_the_epoch() {
    let e = engine();
    assert_eq!(e.world_minutes(1_700_000_000_000.0), 0);
    assert_eq!(e.world_minutes(1_700_000_000_000.0 + 125_000.0), 2);
    assert_eq!(e.world_minutes(1_000.0), 0, "before the epoch clamps to zero");
}

#[test]
fn the_world_view_reports_the_calendar() {
    let e = engine();
    let v = json(&e.world_view(1440 * 30 + 125));
    assert_eq!(v["day"], 30);
    // the real calendar: a world first opened on 2023-11-14 is in early winter 30 days on
    assert_eq!(v["season"], "Winter");
    assert_eq!(v["season_phase"], 0);
}

#[test]
fn can_previews_a_command_without_applying_it() {
    let mut e = engine();
    assert_eq!(json(&e.can(10, r#"{"type":"acquire","item":"fern"}"#))["ok"], true);
    assert!(json(&e.drain_events()).as_array().unwrap().is_empty(), "a preview leaves no events");
    assert_eq!(json(&e.inventory_view()).as_array().unwrap().len(), 0);
    let r = json(&e.can(10, r#"{"type":"acquire","item":"piano"}"#));
    assert_eq!(r["error"]["kind"], "locked");
    assert_eq!(json(&e.can(10, "garbage"))["error"]["kind"], "bad_command");
}

#[test]
fn the_catalog_lists_materials_and_themes() {
    let e = engine();
    let catalog = json(&e.catalog());
    assert!(catalog["materials"]["gloss"].is_object());
    assert!(catalog["themes"].is_object());
}

#[test]
fn a_save_reopened_with_its_secret_is_whole_and_without_it_is_not() {
    let packs = packs();
    let mut e = EngineCore::with_secret(&packs, 1, 7, 1_700_000_000, "[]", 4242).unwrap();
    e.command(10, r#"{"type":"name_player","name":"Орися"}"#);
    let events = e.drain_events();
    let again = EngineCore::with_secret(&packs, 1, 7, 1_700_000_000, &events, 4242).unwrap();
    assert_eq!(json(&again.integrity())["tampered"], 0);
    let stranger = EngineCore::with_secret(&packs, 1, 7, 1_700_000_000, &events, 1).unwrap();
    assert_eq!(json(&stranger.integrity())["tampered"], 2);
}

#[test]
fn a_kept_snapshot_and_the_tail_open_the_same_world_and_an_edited_one_is_refused() {
    let secret = 4_242_424_242u64;
    let mut e = EngineCore::with_secret(&packs(), 1, 7, 1_700_000_000, "[]", secret).unwrap();
    let mut log: Vec<Value> = Vec::new();
    let mut snap = String::new();
    let mut covered_at_snap = 0usize;
    for day in 0..3u32 {
        for (i, cmd) in [r#"{"type":"acquire","item":"fern"}"#, r#"{"type":"set_setting","key":"time_mode","value":"fixed"}"#].iter().enumerate() {
            let _ = e.command(day * 1440 + 600 + i as u32, cmd);
            log.extend(json(&e.drain_events()).as_array().unwrap().iter().cloned());
            let s = e.take_snapshot();
            if !s.is_empty() {
                snap = s;
                covered_at_snap = log.len();
            }
        }
    }
    let _ = e.command(3 * 1440 + 1, r#"{"type":"acquire","item":"fern"}"#);
    log.extend(json(&e.drain_events()).as_array().unwrap().iter().cloned());
    assert!(!snap.is_empty(), "a snapshot is made at the first command of a day");
    let tail = serde_json::to_string(&log[covered_at_snap..]).unwrap();
    let fast = EngineCore::with_snapshot(&packs(), 1, 7, 1_700_000_000, &tail, secret, &snap, covered_at_snap as u64).expect("a kept snapshot opens");
    let full = EngineCore::with_secret(&packs(), 1, 7, 1_700_000_000, &serde_json::to_string(&log).unwrap(), secret).unwrap();
    assert_eq!(fast.wallet_view(), full.wallet_view());
    assert_eq!(fast.inventory_view(), full.inventory_view());
    assert_eq!(json(&fast.integrity())["from_snapshot"], true);
    // an edited snapshot (more coins) or a wrong count is refused, and the shell opens the whole log
    let mut forged = json(&snap);
    forged["state"]["earned"] = serde_json::json!(99_999);
    let forged = serde_json::to_string(&forged).unwrap();
    assert_eq!(EngineCore::with_snapshot(&packs(), 1, 7, 1_700_000_000, &tail, secret, &forged, covered_at_snap as u64).err().as_deref(), Some("snapshot_refused"));
    assert_eq!(EngineCore::with_snapshot(&packs(), 1, 7, 1_700_000_000, &tail, secret, &snap, covered_at_snap as u64 + 1).err().as_deref(), Some("snapshot_refused"));
}

#[test]
fn a_world_seed_gives_its_public_key() {
    let seed = "07".repeat(32);
    let key = teul_wasm::engine::public_key(&seed);
    assert_eq!(key.len(), 64);
    assert_eq!(teul_wasm::engine::public_key(&seed), key, "the same seed, the same key");
    assert_ne!(teul_wasm::engine::public_key(&"08".repeat(32)), key);
    assert_eq!(teul_wasm::engine::public_key("not hex"), "");
}
