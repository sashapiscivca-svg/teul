//! A save of version 1.x that went out into the shared world beyond the edge, tamed a horse there, broke trees,
//! took a key and got the green gate the game no longer has: 2.0 has none of it. The save still opens whole — what
//! was done out there and with friends is passed over (counted as retired, never as tampering), the purse and the
//! home of Lypove are as they were, and the player comes back where they walked to.

use std::sync::Arc;

use serde_json::{json, Value};
use teul_core::content::Content;
use teul_core::core::{Command, Core, NewWorld, META_SECRET};
use teul_core::event::{decode_kind, encode_kind, Event, EventKind, EVENT_SCHEMA};
use teul_core::storage::{MemoryStorage, Storage};
use teul_core::time::{WorldTime, MINUTES_PER_DAY};

const SECRET: u64 = 400_400_028_028;
const DEVICE: u32 = 7;
/// The content of then: not today's, so outcomes are compared by kind (as for any save of an older version).
const OLD_PACK: u64 = 1_528_447_675_680_471;

fn content() -> Arc<Content> {
    Arc::new(Content::from_packs(&[include_str!("../../../content/base/pack.json")]).expect("the base pack is valid"))
}

fn params() -> NewWorld {
    NewWorld { seed: 22, epoch_unix_secs: 1_791_579_600 }
}

fn storage(events: &[Event]) -> MemoryStorage {
    let mut s = MemoryStorage::new();
    s.meta_set(META_SECRET, &SECRET.to_string()).unwrap();
    s.append_batch(events).unwrap();
    s
}

/// An input and what it did, at one minute, as 1.x wrote them (JSON, then read the way the shell reads a save).
fn log(groups: &[(u64, Value, Vec<Value>)]) -> Vec<Event> {
    let mut out = Vec::new();
    let mut seq = 0;
    let mut tip = 0;
    for (time, cmd, outcomes) in groups {
        let kinds = std::iter::once(json!({ "type": "Input", "cmd": cmd, "pack": OLD_PACK })).chain(outcomes.iter().cloned());
        for kind in kinds {
            let raw = json!({ "id": { "device": DEVICE, "seq": seq }, "time": time, "rules_version": 2, "kind": kind, "chain": 0 });
            let mut e: Event = serde_json::from_str(&raw.to_string()).expect("an event of 1.x still reads");
            e.chain = teul_core::economy::link(tip, &e, SECRET);
            tip = e.chain;
            seq += 1;
            out.push(e);
        }
    }
    out
}

fn at(minute: u64) -> u64 {
    9 * 60 + minute
}

fn travel(to: &str, minute: u64) -> (u64, Value, Vec<Value>) {
    (at(minute), json!({ "type": "travel", "to": to }), vec![json!({ "type": "Travelled", "to": to, "day": 0 })])
}

/// Home → the village → over the edge into Обшир (its purse with ten diamonds) → a tree broken, a stall of
/// Злагода used, a horse tamed → back to the village (the purses swap back) → the world's key taken → the green
/// gate to the world beyond taken (free) → home.
fn beyond_and_back() -> Vec<Event> {
    log(&[
        (at(0), json!({ "type": "name_player", "name": "Орися" }), vec![json!({ "type": "PlayerNamed", "name": "Орися" })]),
        travel("village", 1),
        (
            at(2),
            json!({ "type": "travel", "to": "obshyr" }),
            vec![json!({ "type": "Travelled", "to": "obshyr", "day": 0 }), json!({ "type": "RealmCrossed", "to": "net", "fresh": [["diamond", 10]] })],
        ),
        (
            at(3),
            json!({ "type": "strike", "node": "oak.12_40", "with": null, "at": [12, 41], "helpers": 0 }),
            vec![
                json!({ "type": "Struck", "node": "oak.12_40", "damage": 9, "fresh": true, "with": null, "broke": false, "minute": at(3) }),
                json!({ "type": "NodeBroken", "node": "oak.12_40", "minute": at(3), "got": [["log", 2]], "ground": [] }),
            ],
        ),
        (
            at(4),
            json!({ "type": "use", "station": "st.zlahoda.smith" }),
            vec![json!({ "type": "Used", "station": "st.zlahoda.smith", "day": 0, "took": ["log"], "gave": ["nail"], "cost": 0, "earn": 0 })],
        ),
        (
            at(5),
            json!({ "type": "tame", "beast": "horse.3", "with": "apple", "x": 30, "y": 31 }),
            vec![json!({ "type": "HorseTamed", "horse": "horse.3", "day": 0, "took": [["apple", 2]], "at": [30, 31], "name": "Сірко", "coat": 2 })],
        ),
        (
            at(6),
            json!({ "type": "travel", "to": "village" }),
            vec![json!({ "type": "Travelled", "to": "village", "day": 0 }), json!({ "type": "RealmCrossed", "to": "lypove", "fresh": [] })],
        ),
        (at(7), json!({ "type": "set_identity", "key": "d759793bbc13a2819a827c76adb6fba8a49aee007f49f2d0992d99b825ad2c48" }), vec![json!({ "type": "IdentitySet", "key": "d759793bbc13a2819a827c76adb6fba8a49aee007f49f2d0992d99b825ad2c48" })]),
        (
            at(8),
            json!({ "type": "acquire", "item": "portal_gate" }),
            vec![json!({ "type": "ItemAcquired", "item": "portal_gate" })],
        ),
        travel("home", 9),
    ])
}

#[test]
fn a_save_that_went_beyond_the_edge_opens_whole_without_it() {
    let c = content();
    assert!(!c.locations.contains_key("obshyr") && c.retired.contains("portal_gate"), "the test needs places and things that are gone");
    let events = beyond_and_back();
    let core = Core::bootstrap(storage(&events), DEVICE, params(), c.clone()).unwrap();
    let i = core.integrity();
    assert_eq!(i.tampered, 0, "nothing is taken for tampering: {:?}", i.dropped);
    // name, to the village, back home; the rest (the way over and back, the wilds, the stall, the horse, the key, the gate)
    assert_eq!(i.inputs, 3);
    assert_eq!(i.retired, 3 + 3 + 2 + 2 + 3 + 2 + 2);
    assert_eq!(core.location(), "home");
    // Lypove's purse as it was: nothing spent, nothing of out there
    assert_eq!(core.wallet_view().coins, u64::from(c.start_coins));
    for gone in ["diamond", "log", "nail", "portal_gate"] {
        assert_eq!(core.state().owned.get(gone).copied().unwrap_or(0), 0, "{gone}");
    }
    assert_eq!(core.state().player_name.as_deref(), Some("Орися"));
}

#[test]
fn the_way_back_from_beyond_counts_where_it_leads() {
    let c = content();
    // 1.x ended out beyond the edge, then walked back to the village: the player is in the village
    let mut events = beyond_and_back();
    events.truncate(events.iter().position(|e| matches!(&e.kind, EventKind::Retired { body } if body["type"] == "Input" && body["cmd"]["type"] == "set_identity")).unwrap());
    let core = Core::bootstrap(storage(&events), DEVICE, params(), c.clone()).unwrap();
    assert_eq!(core.location(), "village");
    assert_eq!(core.integrity().tampered, 0);
    // still out there when the save ends: the player is where they were before the edge
    events.truncate(events.iter().position(|e| matches!(&e.kind, EventKind::Retired { body } if body["type"] == "Input" && body["cmd"]["type"] == "tame")).unwrap());
    let core = Core::bootstrap(storage(&events), DEVICE, params(), c).unwrap();
    assert_eq!(core.location(), "village");
    assert_eq!(core.integrity().tampered, 0);
}

#[test]
fn a_retired_event_reads_writes_back_and_still_chains() {
    let c = content();
    let events = beyond_and_back();
    let retired = events.iter().filter(|e| e.kind.is_retired()).count();
    assert!(retired > 0);
    // what a shell keeps (its JSON) reads again the same
    let again: Vec<Event> = serde_json::from_str(&serde_json::to_string(&events).unwrap()).unwrap();
    assert_eq!(again, events);
    // and what the sqlite store keeps (the payload alone)
    for e in &events {
        assert_eq!(decode_kind(EVENT_SCHEMA, &encode_kind(&e.kind)).unwrap(), e.kind);
    }
    // the chain still guards what is live: an event after the retired ones, edited, is found out
    let mut forged = events.clone();
    let last = forged.len() - 1;
    forged[last].kind = EventKind::Travelled { to: "village".into(), day: 0 };
    let core = Core::bootstrap(storage(&forged), DEVICE, params(), c.clone()).unwrap();
    assert!(core.integrity().tampered > 0);
    // a type no version ever wrote is still an error, not something passed over
    assert!(decode_kind(EVENT_SCHEMA, r#"{"type":"Teleported","to":"moon"}"#).is_err());
}

#[test]
fn the_world_goes_on_after_and_its_new_snapshot_opens_the_same() {
    let c = content();
    let events = beyond_and_back();
    let mut core = Core::bootstrap(storage(&events), DEVICE, params(), c.clone()).unwrap();
    let new = core.apply_logged(WorldTime(MINUTES_PER_DAY + 600), Command::SetSetting { key: "time_mode".into(), value: "real".into() }).unwrap();
    let snap = core.latest_snapshot().unwrap();
    assert_eq!(snap.retired, core.integrity().retired);
    let covered = (events.len() + new.len()) as u64;
    let reopened = Core::bootstrap_from_snapshot(storage(&[]), DEVICE, params(), c.clone(), snap, covered).unwrap();
    assert_eq!(reopened.integrity().retired, core.integrity().retired);
    assert_eq!(reopened.location(), "home");
    assert_eq!(reopened.wallet_view().coins, core.wallet_view().coins);
    // the commands of what is gone are no longer commands at all
    assert!(serde_json::from_str::<Command>(r#"{"type":"strike","node":"x","with":null,"at":[0,0],"helpers":0}"#).is_err());
}

#[test]
fn plain_events_of_before_the_inputs_pass_over_the_same() {
    // the oldest saves logged no inputs: plain events, trusted as they are — a retired one among them changes nothing
    let c = content();
    let raw = json!([
        { "id": { "device": DEVICE, "seq": 0 }, "time": 10, "rules_version": 1, "kind": { "type": "PlayerNamed", "name": "Тарас" }, "chain": 0 },
        { "id": { "device": DEVICE, "seq": 1 }, "time": 11, "rules_version": 1, "kind": { "type": "RealmCrossed", "to": "net", "fresh": [["diamond", 10]] }, "chain": 0 },
        { "id": { "device": DEVICE, "seq": 2 }, "time": 12, "rules_version": 1, "kind": { "type": "ParcelReceived", "from": "ab", "from_name": "Ганна", "item": "worn_stool", "note": "", "nonce": 1, "day": 0, "to_chest": false }, "chain": 0 },
        { "id": { "device": DEVICE, "seq": 3 }, "time": 13, "rules_version": 1, "kind": { "type": "Travelled", "to": "lobby", "day": 0 }, "chain": 0 }
    ]);
    let events: Vec<Event> = serde_json::from_value(raw).expect("plain events of 1.x still read");
    let core = Core::bootstrap(storage(&events), DEVICE, params(), c).unwrap();
    let i = core.integrity();
    // (the way to the lobby is a plain event like any other until the replay finds where it led)
    assert_eq!((i.tampered, i.legacy, i.retired), (0, 2, 3));
    assert_eq!(core.location(), "home");
    assert_eq!(core.state().owned.get("worn_stool"), None);
}

#[test]
fn the_green_gate_of_1_x_leaves_the_home() {
    // 1.x gave the gate with the starter kit and stood it on the wall of the first room
    let c = content();
    assert!(c.retired.contains("portal_gate") && !c.items.contains_key("portal_gate"));
    let raw = json!([
        { "id": { "device": DEVICE, "seq": 0 }, "time": 10, "rules_version": 1, "kind": { "type": "KitClaimed", "kit": "kit.starter", "items": ["portal_gate", "fern"], "styles": [] }, "chain": 0 },
        { "id": { "device": DEVICE, "seq": 1 }, "time": 11, "rules_version": 1, "kind": { "type": "Placed", "pid": 1, "item": "portal_gate", "x": 0, "y": 2, "rot": 0, "wall": "west", "on": null }, "chain": 0 },
        { "id": { "device": DEVICE, "seq": 2 }, "time": 12, "rules_version": 1, "kind": { "type": "Placed", "pid": 2, "item": "fern", "x": 3, "y": 3, "rot": 0, "wall": null, "on": null }, "chain": 0 }
    ]);
    let events: Vec<Event> = serde_json::from_value(raw).expect("plain events of 1.x still read");
    let core = Core::bootstrap(storage(&events), DEVICE, params(), c).unwrap();
    assert_eq!(core.integrity().tampered, 0);
    let placed: Vec<String> = core.room_view().placements.iter().map(|p| p.item.clone()).collect();
    assert_eq!(placed, vec!["fern".to_string()]);
    assert_eq!(core.state().owned.get("portal_gate"), None);
    assert_eq!(core.state().owned.get("fern"), Some(&1));
}
