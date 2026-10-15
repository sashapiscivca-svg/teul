//! Cooking at home: a stove turns what one has into a dish; nothing comes from nothing; it needs gas.

mod common;

use std::sync::Arc;

use teul_core::core::{Command, Core, CoreError, NewWorld};
use teul_core::event::EventKind;
use teul_core::storage::MemoryStorage;
use teul_core::time::{WorldTime, MINUTES_PER_DAY};

fn at(day: u64, minute: u64) -> WorldTime {
    WorldTime(day * MINUTES_PER_DAY + minute)
}

fn world(stove: bool) -> Core<MemoryStorage> {
    let mut core = Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 3, epoch_unix_secs: common::AUTUMN_EPOCH }, Arc::new(common::home())).unwrap();
    for (item, x) in [("fridge_h", 1), ("stove_h", 2)] {
        if item == "stove_h" && !stove {
            continue;
        }
        core.apply_all(at(0, 500), Command::Acquire { item: item.into() }).unwrap();
        core.apply_all(at(0, 500), Command::Place { item: item.into(), x, y: 1, rot: 0, wall: None, on: None }).unwrap();
    }
    core.apply_all(at(0, 600), Command::Travel { to: "market".into() }).unwrap();
    for spot in ["hen1", "hen2", "cow1"] {
        core.apply_all(at(0, 601), Command::Gather { spot: spot.into() }).unwrap();
    }
    core
}

fn cook(core: &mut Core<MemoryStorage>, t: WorldTime) -> Result<Vec<teul_core::event::Event>, CoreError> {
    core.apply_all(t, Command::Cook { recipe: "rc.omelette".into() })
}

#[test]
fn a_stove_turns_eggs_and_milk_into_an_omelette() {
    let mut core = world(true);
    assert_eq!(cook(&mut core, at(0, 602)).err(), Some(CoreError::NotHere));
    core.apply_all(at(0, 603), Command::Travel { to: "home".into() }).unwrap();
    let events = cook(&mut core, at(0, 604)).unwrap();
    assert!(events.iter().any(|e| matches!(&e.kind, EventKind::Cooked { recipe, gave, .. } if recipe == "rc.omelette" && gave == "omelette")));
    let pocket = core.pocket_view();
    assert_eq!(pocket.items.get("omelette"), Some(&1));
    assert_eq!(pocket.items.get("eggs"), None);
    assert_eq!(pocket.items.get("milk"), None);
    // nothing left to cook with
    assert_eq!(cook(&mut core, at(0, 605)).err(), Some(CoreError::NotEnough));
}

#[test]
fn cooking_takes_from_the_fridge_too() {
    let mut core = world(true);
    core.apply_all(at(0, 603), Command::Travel { to: "home".into() }).unwrap();
    core.apply_all(at(0, 604), Command::ToFridge { item: "eggs".into(), n: 2 }).unwrap();
    cook(&mut core, at(0, 605)).unwrap();
    assert_eq!(core.in_fridge("eggs"), 0);
    assert_eq!(core.pocket_view().items.get("omelette"), Some(&1));
}

#[test]
fn there_must_be_a_stove_and_a_known_recipe() {
    let mut core = world(false);
    core.apply_all(at(0, 603), Command::Travel { to: "home".into() }).unwrap();
    assert_eq!(cook(&mut core, at(0, 604)).err(), Some(CoreError::Needs("stove".into())));
    assert_eq!(core.apply_all(at(0, 604), Command::Cook { recipe: "rc.nothing".into() }).err(), Some(CoreError::UnknownRecipe("rc.nothing".into())));
}

#[test]
fn the_recipes_view_says_what_is_there_and_what_is_missing() {
    let mut core = world(true);
    core.apply_all(at(0, 603), Command::Travel { to: "home".into() }).unwrap();
    let r = core.recipes_view(at(0, 604));
    let om = r.iter().find(|r| r.id == "rc.omelette").unwrap();
    assert!(om.ok, "{om:?}");
    cook(&mut core, at(0, 605)).unwrap();
    let om = core.recipes_view(at(0, 606)).into_iter().find(|r| r.id == "rc.omelette").unwrap();
    assert!(!om.ok);
    assert_eq!(om.reason.as_deref(), Some("not_enough"));
}
