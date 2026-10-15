//! Golden saves of version 1.0 (tests/fixtures/saves/*.json, made once by app/test/compat.test.ts and never
//! regenerated): the core of every later version must open them whole from the full log, with the same money and
//! home; what the game no longer has (friends, the shared world) is passed over as retired, never as tampering.
//! Their 1.x snapshots held the friends' state, so 2.0 no longer vouches for them: the shell opens the whole log
//! instead (app/src/engine.ts, `snapshot_refused`), and the snapshot made then opens the same world. A failure here
//! means a change broke old saves: add an alias (the pack's `aliases`) or a migration — never edit a fixture. See
//! docs/architecture.md, «Сумісність збережень».

use std::sync::Arc;

use serde_json::Value;
use teul_core::content::Content;
use teul_core::core::{Command, Core, CoreError, NewWorld, META_SECRET};
use teul_core::time::{WorldTime, MINUTES_PER_DAY};
use teul_core::event::Event;
use teul_core::state::Snapshot;
use teul_core::storage::{MemoryStorage, Storage};

const SAVES: &[(&str, &str)] = &[
    ("fresh", include_str!("fixtures/saves/fresh.json")),
    ("played", include_str!("fixtures/saves/played.json")),
    ("friends_a", include_str!("fixtures/saves/friends_a.json")),
    ("friends_b", include_str!("fixtures/saves/friends_b.json")),
];

fn content() -> Arc<Content> {
    Arc::new(Content::from_packs(&[include_str!("../../../content/base/pack.json")]).expect("the base pack is valid"))
}

struct Golden {
    device: u32,
    seed: u64,
    epoch: i64,
    secret: u64,
    events: Vec<Event>,
    snapshot: Option<String>,
    expect: Value,
}

fn golden(text: &str) -> Golden {
    let v: Value = serde_json::from_str(text).expect("a golden save is JSON");
    let w = &v["world"];
    let m = &w["meta"];
    let events: Vec<Event> = serde_json::from_value(w["events"].clone()).expect("the events of 1.0 still read");
    let snapshot = w["snapshots"].as_array().and_then(|s| s.last()).map(|s| s["json"].as_str().unwrap().to_string());
    Golden {
        device: m["device"].as_u64().unwrap() as u32,
        seed: m["seed"].as_u64().unwrap(),
        epoch: m["epochUnixSecs"].as_i64().unwrap(),
        secret: m["secret"].as_u64().unwrap() & teul_core::economy::MASK52,
        events,
        snapshot,
        expect: v["expect"].clone(),
    }
}

fn storage(g: &Golden, events: &[Event]) -> MemoryStorage {
    let mut s = MemoryStorage::new();
    s.meta_set(META_SECRET, &g.secret.to_string()).unwrap();
    s.append_batch(events).unwrap();
    s
}

/// What 2.0 no longer has of a golden save: friends (the world's key, parcels) are gone, and what was done with
/// them is passed over as retired — (the inputs among them, all their events). The rest opens as it was.
const RETIRED: &[(&str, u64, u32)] = &[("fresh", 0, 0), ("played", 0, 0), ("friends_a", 3, 6), ("friends_b", 3, 6)];

fn check(name: &str, core: &Core<MemoryStorage>, g: &Golden) {
    let i = core.integrity();
    let &(_, gone_inputs, retired) = RETIRED.iter().find(|r| r.0 == name).expect("every golden save is listed");
    assert_eq!(i.tampered, 0, "{name}: events left out {:?}", i.dropped);
    assert_eq!(i.retired, retired, "{name}: events of things the game no longer has");
    assert_eq!(u64::from(i.inputs), g.expect["inputs"].as_u64().unwrap() - gone_inputs, "{name}: inputs");
    assert_eq!(u64::from(core.wallet_view().coins), g.expect["coins"].as_u64().unwrap(), "{name}: coins");
    let mut placed: Vec<String> = core.room_view().placements.iter().map(|p| p.item.clone()).collect();
    placed.sort();
    let want: Vec<String> = serde_json::from_value(g.expect["placements"].clone()).unwrap();
    assert_eq!(placed, want, "{name}: the home");
}

#[test]
fn golden_saves_open_whole_from_the_full_log() {
    let c = content();
    for (name, text) in SAVES {
        let g = golden(text);
        let core = Core::bootstrap(storage(&g, &g.events), g.device, NewWorld { seed: g.seed, epoch_unix_secs: g.epoch }, c.clone()).unwrap_or_else(|e| panic!("{name}: {e}"));
        check(name, &core, &g);
    }
}

#[test]
fn golden_snapshots_give_way_to_the_whole_log_and_a_new_snapshot_opens_the_same() {
    let c = content();
    let params = |g: &Golden| NewWorld { seed: g.seed, epoch_unix_secs: g.epoch };
    for (name, text) in SAVES {
        let g = golden(text);
        let Some(json) = &g.snapshot else { continue };
        let snap: Snapshot = serde_json::from_str(json).unwrap_or_else(|e| panic!("{name}: the snapshot of 1.0 still reads: {e}"));
        let after: Vec<Event> = g.events.iter().filter(|e| e.sort_key() > snap.through).cloned().collect();
        let covered = (g.events.len() - after.len()) as u64;
        match Core::bootstrap_from_snapshot(storage(&g, &after), g.device, params(&g), c.clone(), snap, covered) {
            Err(CoreError::SnapshotRefused) => {}
            Ok(core) => check(name, &core, &g),
            Err(e) => panic!("{name}: {e}"),
        }
        // the shell opens the whole log, and keeps the snapshot made at the next command
        let mut core = Core::bootstrap(storage(&g, &g.events), g.device, params(&g), c.clone()).unwrap_or_else(|e| panic!("{name}: {e}"));
        check(name, &core, &g);
        let later = WorldTime(core.last_time().0 + MINUTES_PER_DAY);
        let new = core.apply_logged(later, Command::SetSetting { key: "time_mode".into(), value: "real".into() }).unwrap_or_else(|e| panic!("{name}: {e}"));
        let snap = core.latest_snapshot().expect("a snapshot at the first command of a day");
        let covered = (g.events.len() + new.len()) as u64;
        let reopened = Core::bootstrap_from_snapshot(storage(&g, &[]), g.device, params(&g), c.clone(), snap, covered).unwrap_or_else(|e| panic!("{name}: the new snapshot refused: {e}"));
        assert_eq!(reopened.integrity().retired, core.integrity().retired, "{name}: retired");
        assert_eq!(reopened.wallet_view().coins, core.wallet_view().coins, "{name}: coins");
        assert_eq!(reopened.room_view().placements, core.room_view().placements, "{name}: the home");
    }
}
