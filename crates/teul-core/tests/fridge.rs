//! The fridge: food keeps there at home, out of the pocket.

mod common;

use std::sync::Arc;

use teul_core::core::{Command, Core, CoreError, NewWorld};
use teul_core::storage::MemoryStorage;
use teul_core::time::{WorldTime, MINUTES_PER_DAY};

fn at(day: u64, minute: u64) -> WorldTime {
    WorldTime(day * MINUTES_PER_DAY + minute)
}

/// A home with a fridge, and eggs and a pebble in the pocket.
fn world(with_fridge: bool) -> Core<MemoryStorage> {
    let mut core = Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 3, epoch_unix_secs: common::AUTUMN_EPOCH }, Arc::new(common::home())).unwrap();
    if with_fridge {
        core.apply_all(at(0, 500), Command::Acquire { item: "fridge_h".into() }).unwrap();
        core.apply_all(at(0, 500), Command::Place { item: "fridge_h".into(), x: 1, y: 1, rot: 0, wall: None, on: None }).unwrap();
    }
    core.apply_all(at(0, 600), Command::Travel { to: "market".into() }).unwrap();
    for spot in ["hen1", "hen2", "stone"] {
        core.apply_all(at(0, 601), Command::Gather { spot: spot.into() }).unwrap();
    }
    core
}

fn to_fridge(core: &mut Core<MemoryStorage>, t: WorldTime, item: &str, n: u32) -> Result<(), CoreError> {
    core.apply_all(t, Command::ToFridge { item: item.into(), n }).map(|_| ())
}

#[test]
fn food_goes_into_the_fridge_at_home_and_frees_the_pocket() {
    let mut core = world(true);
    assert_eq!(to_fridge(&mut core, at(0, 602), "eggs", 2), Err(CoreError::NotHere));
    core.apply_all(at(0, 603), Command::Travel { to: "home".into() }).unwrap();
    to_fridge(&mut core, at(0, 604), "eggs", 2).unwrap();
    let pocket = core.pocket_view();
    assert_eq!(pocket.used, 1, "only the pebble is left in the pocket");
    assert_eq!(core.fridge_view().items.get("eggs"), Some(&2));
    // and back out, while there is room
    core.apply_all(at(0, 605), Command::FromFridge { item: "eggs".into(), n: 1 }).unwrap();
    assert_eq!(core.pocket_view().used, 2);
    assert_eq!(core.fridge_view().items.get("eggs"), Some(&1));
}

#[test]
fn only_food_goes_into_the_fridge() {
    let mut core = world(true);
    core.apply_all(at(0, 603), Command::Travel { to: "home".into() }).unwrap();
    assert_eq!(to_fridge(&mut core, at(0, 604), "pebble", 1), Err(CoreError::NotFood));
    assert_eq!(to_fridge(&mut core, at(0, 604), "eggs", 3), Err(CoreError::NotEnough));
}

#[test]
fn there_must_be_a_fridge() {
    let mut core = world(false);
    core.apply_all(at(0, 603), Command::Travel { to: "home".into() }).unwrap();
    assert_eq!(to_fridge(&mut core, at(0, 604), "eggs", 1), Err(CoreError::Needs("fridge".into())));
}

#[test]
fn food_in_the_fridge_is_not_carried_and_cannot_be_handed_over_from_town() {
    let mut core = world(true);
    core.apply_all(at(0, 603), Command::Travel { to: "home".into() }).unwrap();
    to_fridge(&mut core, at(0, 604), "eggs", 2).unwrap();
    assert_eq!(core.available("eggs"), 0);
    assert_eq!(core.in_fridge("eggs"), 2);
}
