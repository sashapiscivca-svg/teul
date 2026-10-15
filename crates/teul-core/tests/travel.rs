//! Where the player is: the core knows it, finds need one to be there, some places are locked.

mod common;

use std::sync::Arc;

use teul_core::core::{Command, Core, CoreError, NewWorld};
use teul_core::event::EventKind;
use teul_core::storage::MemoryStorage;
use teul_core::time::{WorldTime, MINUTES_PER_DAY};
use teul_core::unlock::Missing;

fn world() -> Core<MemoryStorage> {
    Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 3, epoch_unix_secs: common::AUTUMN_EPOCH }, Arc::new(common::economy())).unwrap()
}

fn at(day: u64, minute: u64) -> WorldTime {
    WorldTime(day * MINUTES_PER_DAY + minute)
}

#[test]
fn a_new_world_starts_at_home_and_travel_moves_the_player() {
    let mut core = world();
    assert_eq!(core.location(), "home");
    let events = core.apply_all(at(0, 600), Command::Travel { to: "village".into() }).unwrap();
    assert!(matches!(&events[0].kind, EventKind::Travelled { to, day: 0 } if to == "village"));
    assert_eq!(core.location(), "village");
    assert_eq!(core.apply_all(at(0, 601), Command::Travel { to: "atlantis".into() }).err(), Some(CoreError::UnknownLocation("atlantis".into())));
    // the place is remembered
    let reopened = Core::open_with(core.into_storage(), 1, Arc::new(common::economy())).unwrap();
    assert_eq!(reopened.location(), "village");
}

#[test]
fn finds_need_the_player_to_be_where_they_are() {
    let mut core = world();
    assert_eq!(core.apply_all(at(0, 600), Command::Gather { spot: "shroom".into() }).err(), Some(CoreError::NotHere));
    assert_eq!(core.apply_all(at(0, 600), Command::Fish { place: "pond".into() }).err(), Some(CoreError::NotHere));
    core.apply_all(at(0, 601), Command::Travel { to: "village".into() }).unwrap();
    core.apply_all(at(0, 602), Command::Gather { spot: "shroom".into() }).unwrap();
    core.apply_all(at(0, 603), Command::Fish { place: "pond".into() }).unwrap();
}

#[test]
fn a_locked_place_says_what_it_needs() {
    let mut core = world();
    let err = core.apply_all(at(0, 600), Command::Travel { to: "cave".into() }).unwrap_err();
    assert_eq!(err, CoreError::Locked(vec![Missing::Item { item: "miner_lantern".into() }]));
    let view = core.location_view(at(0, 600));
    assert_eq!(view.location, "home");
    let cave = &view.places["cave"];
    assert!(!cave.open);
    assert_eq!(cave.hint, "Без ліхтаря там нічого не видно.");
    assert!(view.places["village"].open);
    // help opens the way
    core.apply_all(at(0, 601), Command::Travel { to: "village".into() }).unwrap();
    core.apply_all(at(0, 602), Command::Gather { spot: "shroom".into() }).unwrap();
    core.apply_all(at(0, 602), Command::Gather { spot: "shroom2".into() }).unwrap();
    core.apply_all(at(0, 603), Command::Help { help: "help.miner".into() }).unwrap();
    assert!(core.location_view(at(0, 604)).places["cave"].open);
    core.apply_all(at(0, 604), Command::Travel { to: "cave".into() }).unwrap();
    assert_eq!(core.location(), "cave");
}

#[test]
fn going_home_is_never_locked() {
    let mut core = world();
    core.apply_all(at(0, 600), Command::Travel { to: "village".into() }).unwrap();
    core.apply_all(at(0, 601), Command::Travel { to: "home".into() }).unwrap();
    assert_eq!(core.location(), "home");
}
