//! The hands and the armour: a thing in the left hand beside the one at hand, the hands swapped; armour worn on the
//! head, the body, the legs, the feet — one piece to a place, its defence counted, and while worn it takes no place
//! in the inventory.

mod common;

use std::sync::Arc;

use teul_core::core::{Command, Core, CoreError, NewWorld};
use teul_core::storage::MemoryStorage;
use teul_core::time::{WorldTime, MINUTES_PER_DAY};

fn world() -> Core<MemoryStorage> {
    let mut core = Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 3, epoch_unix_secs: common::AUTUMN_EPOCH }, Arc::new(common::economy())).unwrap();
    core.apply_all(at(0, 600), Command::Travel { to: "village".into() }).unwrap();
    core
}

fn at(day: u64, minute: u64) -> WorldTime {
    WorldTime(day * MINUTES_PER_DAY + minute)
}

fn buy(core: &mut Core<MemoryStorage>, t: u64, st: &str) {
    core.apply_all(at(0, t), Command::Use { station: st.into() }).unwrap();
}

#[test]
fn the_left_hand_holds_a_thing_and_the_hands_swap() {
    let mut core = world();
    core.apply_all(at(0, 601), Command::Gather { spot: "shroom".into() }).unwrap();
    buy(&mut core, 601, "st.village.bakery");
    assert_eq!(core.apply_all(at(0, 602), Command::SetOffhand { item: Some("yarn".into()) }).err(), Some(CoreError::NotEnough));
    core.apply_all(at(0, 602), Command::SetOffhand { item: Some("bread".into()) }).unwrap();
    core.apply_all(at(0, 603), Command::SetHotbar { slot: 0, item: Some("mushroom".into()) }).unwrap();
    let v = core.pocket_view();
    assert_eq!((v.offhand.as_deref(), v.hotbar[0].as_deref()), (Some("bread"), Some("mushroom")));
    // the hands change their things
    core.apply_all(at(0, 604), Command::SwapHands { slot: 0 }).unwrap();
    let v = core.pocket_view();
    assert_eq!((v.offhand.as_deref(), v.hotbar[0].as_deref()), (Some("mushroom"), Some("bread")));
    // a thing is in one hand at most: into the left hand, it leaves its place at hand
    core.apply_all(at(0, 605), Command::SetOffhand { item: Some("bread".into()) }).unwrap();
    let v = core.pocket_view();
    assert_eq!((v.offhand.as_deref(), v.hotbar[0].as_deref()), (Some("bread"), None));
    // and back at hand, it leaves the left hand
    core.apply_all(at(0, 606), Command::SetHotbar { slot: 2, item: Some("bread".into()) }).unwrap();
    let v = core.pocket_view();
    assert_eq!((v.offhand.as_deref(), v.hotbar[2].as_deref()), (None, Some("bread")));
}

#[test]
fn armour_is_worn_a_piece_to_a_place_and_takes_no_place_in_the_inventory() {
    let mut core = world();
    buy(&mut core, 601, "st.village.smith");
    buy(&mut core, 601, "st.village.smith2");
    assert_eq!(core.pocket_view().used, 2);
    core.apply_all(at(0, 602), Command::Wear { item: "helmet".into() }).unwrap();
    core.apply_all(at(0, 602), Command::Wear { item: "plate".into() }).unwrap();
    let v = core.pocket_view();
    assert_eq!((v.armor.get("head").map(String::as_str), v.armor.get("body").map(String::as_str)), (Some("helmet"), Some("plate")));
    assert_eq!(v.defense, 5);
    assert_eq!(v.used, 0, "worn, it is on one, not in the inventory");
    // another piece for the same place takes its place
    buy(&mut core, 603, "st.village.smith3");
    core.apply_all(at(0, 603), Command::Wear { item: "cap".into() }).unwrap();
    let v = core.pocket_view();
    assert_eq!((v.armor.get("head").map(String::as_str), v.defense, v.used), (Some("cap"), 4, 1));
    // off again
    core.apply_all(at(0, 604), Command::TakeOff { slot: "body".into() }).unwrap();
    let v = core.pocket_view();
    assert_eq!((v.armor.get("body"), v.defense), (None, 1));
    // only armour, only what one has
    core.apply_all(at(0, 605), Command::Gather { spot: "shroom".into() }).unwrap();
    assert_eq!(core.apply_all(at(0, 606), Command::Wear { item: "mushroom".into() }).err(), Some(CoreError::NoRequest));
    assert_eq!(core.apply_all(at(0, 606), Command::TakeOff { slot: "feet".into() }).err(), Some(CoreError::NoRequest));
}
