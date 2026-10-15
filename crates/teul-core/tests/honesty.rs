//! Honest play: every outcome must be re-derivable from the player's inputs, and the log is chained, so
//! editing the save does not pay; bots are slowed down.

mod common;

use std::sync::Arc;

use teul_core::core::{Command, Core, CoreError, NewWorld};
use teul_core::event::{Event, EventId, EventKind};
use teul_core::storage::{MemoryStorage, Storage};
use teul_core::time::{WorldTime, MINUTES_PER_DAY};

const SECRET: &str = "12345678901";

fn storage(secret: &str) -> MemoryStorage {
    let mut s = MemoryStorage::new();
    s.meta_set("chain_secret", secret).unwrap();
    s
}

fn world() -> Core<MemoryStorage> {
    Core::create_with(storage(SECRET), 1, NewWorld { seed: 3, epoch_unix_secs: common::AUTUMN_EPOCH }, Arc::new(common::economy())).unwrap()
}

fn reopen(events: Vec<Event>, secret: &str) -> Core<MemoryStorage> {
    let mut s = storage(secret);
    for (k, v) in [("seed", "3"), ("world_version", "1"), ("realm", "sandbox")] {
        s.meta_set(k, v).unwrap();
    }
    s.meta_set("epoch_unix_secs", &common::AUTUMN_EPOCH.to_string()).unwrap();
    s.append_batch(&events).unwrap();
    Core::open_with(s, 1, Arc::new(common::economy())).unwrap()
}

fn at(day: u64, minute: u64) -> WorldTime {
    WorldTime(day * MINUTES_PER_DAY + minute)
}

/// A world where the player earned 20 coins honestly (a request answered).
fn played() -> Vec<Event> {
    let mut core = world();
    core.apply_all(at(0, 600), Command::Travel { to: "village".into() }).unwrap();
    core.apply_all(at(0, 601), Command::Gather { spot: "shroom".into() }).unwrap();
    core.apply_all(at(0, 602), Command::NamePlayer { name: "Орися".into() }).unwrap();
    core.into_storage().events_after(None).unwrap()
}

#[test]
fn every_command_is_logged_before_what_it_did() {
    let events = played();
    assert!(matches!(&events[0].kind, EventKind::Input { cmd: Command::Travel { to }, .. } if to == "village"));
    assert!(matches!(&events[1].kind, EventKind::Travelled { .. }));
    assert!(matches!(&events[2].kind, EventKind::Input { .. }));
    assert!(events.iter().all(|e| e.chain != 0), "every event is chained");
    // the apply API still answers with what happened, not with the input
    let mut core = world();
    let first = core.apply(at(0, 600), Command::NamePlayer { name: "Тихон".into() }).unwrap();
    assert!(matches!(first.kind, EventKind::PlayerNamed { .. }));
    let all = core.apply_all(at(0, 601), Command::NamePlayer { name: "Тихон".into() }).unwrap();
    assert!(all.iter().all(|e| !matches!(e.kind, EventKind::Input { .. })));
}

#[test]
fn an_honest_save_opens_whole() {
    let events = played();
    let core = reopen(events.clone(), SECRET);
    let integrity = core.integrity();
    assert_eq!(integrity.tampered, 0);
    assert_eq!(integrity.dropped, Vec::<EventId>::new());
    assert_eq!(core.state().player_name.as_deref(), Some("Орися"));
    assert_eq!(core.pocket_view().items.get("mushroom"), Some(&1));
}

#[test]
fn coins_written_into_the_save_are_not_taken() {
    let mut events = played();
    let coins = reopen(events.clone(), SECRET).wallet().coins;
    let last = events.last().unwrap().clone();
    events.push(Event { id: EventId { device: 1, seq: last.id.seq + 1 }, time: last.time, rules_version: last.rules_version, kind: EventKind::CoinsEarned { amount: 9999 }, chain: last.chain });
    let core = reopen(events, SECRET);
    assert_eq!(core.wallet().coins, coins);
    assert_eq!(core.integrity().tampered, 1);
    assert_eq!(core.integrity().dropped, vec![EventId { device: 1, seq: last.id.seq + 1 }]);
}

#[test]
fn an_edited_event_breaks_the_chain() {
    let mut events = played();
    for e in &mut events {
        if let EventKind::Gathered { item, .. } = &mut e.kind {
            *item = "yarn".into();
        }
    }
    let core = reopen(events, SECRET);
    assert!(core.integrity().tampered >= 1);
    assert_eq!(core.pocket_view().items.get("yarn"), None);
}

#[test]
fn a_whole_fake_event_with_an_input_does_not_pass_either() {
    // even a forged input with its "outcome" must re-derive: gathering a spot that is somewhere else does not
    let mut events = played();
    let last = events.last().unwrap().clone();
    let t = WorldTime(last.time.0 + 1);
    events.push(Event { id: EventId { device: 1, seq: last.id.seq + 1 }, time: t, rules_version: last.rules_version, kind: EventKind::Input { cmd: Command::Gather { spot: "crystal".into() }, pack: 0 }, chain: 0 });
    events.push(Event { id: EventId { device: 1, seq: last.id.seq + 2 }, time: t, rules_version: last.rules_version, kind: EventKind::Gathered { spot: "crystal".into(), day: 0, item: "yarn".into() }, chain: 0 });
    let core = reopen(events, SECRET);
    assert_eq!(core.integrity().tampered, 2);
    assert_eq!(core.pocket_view().items.get("yarn"), None);
}

#[test]
fn a_save_moved_to_another_secret_is_not_trusted() {
    let events = played();
    let core = reopen(events.clone(), "999");
    assert_eq!(core.integrity().tampered as usize, events.len());
    assert_eq!(core.state().player_name, None);
}

#[test]
fn saves_from_before_inputs_still_open() {
    // an old save: plain events, no inputs, no chain
    let old = vec![
        Event { id: EventId { device: 1, seq: 0 }, time: at(0, 5), rules_version: 1, kind: EventKind::PlayerNamed { name: "Стара".into() }, chain: 0 },
        Event { id: EventId { device: 1, seq: 1 }, time: at(0, 6), rules_version: 1, kind: EventKind::CoinsEarned { amount: 30 }, chain: 0 },
    ];
    let mut core = reopen(old, SECRET);
    assert_eq!(core.integrity().tampered, 0);
    assert_eq!(core.integrity().legacy, 2);
    assert_eq!(core.state().player_name.as_deref(), Some("Стара"));
    // and play goes on, verified from here
    core.apply_all(at(0, 10), Command::NamePlayer { name: "Нова".into() }).unwrap();
    let events = core.into_storage().events_after(None).unwrap();
    let again = reopen(events.clone(), SECRET);
    assert_eq!(again.integrity().tampered, 0);
    assert_eq!(again.state().player_name.as_deref(), Some("Нова"));
    // but a plain event after the first input is a forgery
    let mut forged = events;
    forged.push(Event { id: EventId { device: 1, seq: 99 }, time: at(0, 11), rules_version: 1, kind: EventKind::CoinsEarned { amount: 500 }, chain: 0 });
    assert_eq!(reopen(forged, SECRET).integrity().tampered, 1);
}

#[test]
fn a_bot_is_slowed_down() {
    let mut core = world();
    for i in 0..40 {
        core.apply_all(at(0, 600), Command::NamePlayer { name: format!("n{i}") }).unwrap();
    }
    assert_eq!(core.apply_all(at(0, 600), Command::NamePlayer { name: "more".into() }).err(), Some(CoreError::TooFast));
    core.apply_all(at(0, 601), Command::NamePlayer { name: "later".into() }).unwrap();
    // arranging the home pays nothing and is never limited (a whole house is furnished in a minute)
    for _ in 0..60 {
        core.apply_all(at(0, 601), Command::SetSetting { key: "shadows".into(), value: "1".into() }).unwrap();
    }
}
