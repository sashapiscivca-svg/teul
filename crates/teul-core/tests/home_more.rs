//! Building on to the house (the town's builders, real days of work, the keys) and the animals one lives with
//! (the turtle from the shelter, the fox that learns to trust, the robot from the counter, the dragon from an egg).

mod common;

use std::sync::Arc;

use teul_core::content::Content;
use teul_core::core::{Command, Core, CoreError, NewWorld};
use teul_core::event::EventKind;
use teul_core::storage::MemoryStorage;
use teul_core::time::{WorldTime, MINUTES_PER_DAY};

fn at(day: u64, minute: u64) -> WorldTime {
    WorldTime(day * MINUTES_PER_DAY + minute)
}

const MON: u64 = 2;
const TEN: u64 = 10 * 60;

/// The base pack with a fuller purse, and (for the tests only) eggs sold at the vet's.
fn base(coins: u64) -> Content {
    let text = include_str!("../../../content/base/pack.json");
    let mut v: serde_json::Value = serde_json::from_str(text).unwrap();
    v["start_coins"] = serde_json::json!(coins);
    v["stations"].as_array_mut().unwrap().push(serde_json::json!({
        "id": "st.test.egg", "location": "vet_in", "prop": "reception_desk", "label": "egg", "text": "", "kind": "buy",
        "needs": [], "cost": 1, "gives": [["dragon_egg", 1]], "earn": 0, "per_day": 3, "seasons": [], "spent": "", "hours": [0, 24]
    }));
    Content::from_packs(&[&v.to_string()]).unwrap()
}

fn world(coins: u64) -> Core<MemoryStorage> {
    Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 7, epoch_unix_secs: common::AUTUMN_EPOCH }, Arc::new(base(coins))).unwrap()
}

fn go(core: &mut Core<MemoryStorage>, t: WorldTime, to: &str) {
    core.apply_all(t, Command::Travel { to: to.into() }).unwrap();
}

fn budget(core: &Core<MemoryStorage>) -> u32 {
    core.room_view().area_budget
}

#[test]
fn the_builders_build_a_room_over_real_days_and_hand_over_the_keys() {
    let mut core = world(3000);
    let order = |x: i32, y: i32| Command::OrderBuild { build: "build.kitchen".into(), x, y };
    // orders are taken at the office, not at home
    assert_eq!(core.apply_all(at(MON, TEN), order(10, 0)).err(), Some(CoreError::NotHere));
    go(&mut core, at(MON, TEN), "utility_in");
    // the site must be free and along the house
    assert_eq!(core.apply_all(at(MON, TEN + 1), order(2, 2)).err(), Some(CoreError::Needs("site".into())));
    assert_eq!(core.apply_all(at(MON, TEN + 1), order(20, 20)).err(), Some(CoreError::Needs("site".into())));
    let coins = core.wallet().coins;
    let before = budget(&core);
    core.apply_all(at(MON, TEN + 2), order(10, 0)).unwrap();
    // the site is fenced off at once: its floor is the house's from today
    assert_eq!(budget(&core), before + 36);
    assert_eq!(core.wallet().coins, coins - 650);
    // one crew: one order at a time
    assert_eq!(
        core.apply_all(at(MON, TEN + 3), Command::OrderBuild { build: "build.bath".into(), x: 0, y: 10 }).err(),
        Some(CoreError::TooSoon)
    );
    let v = core.builds_view(at(MON, TEN + 3));
    assert_eq!(v.orders.len(), 1);
    assert_eq!(v.orders[0].stage, 0);
    assert!(!v.orders[0].due);
    // the walls go up over the days; the keys not before
    assert_eq!(core.builds_view(at(MON + 2, TEN)).orders[0].stage, 2);
    assert_eq!(core.apply_all(at(MON + 2, TEN), Command::FinishBuild { n: 0 }).err(), Some(CoreError::TooSoon));
    let v = core.builds_view(at(MON + 3, TEN));
    assert!(v.orders[0].due);
    let events = core.apply_all(at(MON + 3, TEN), Command::FinishBuild { n: 0 }).unwrap();
    assert!(events.iter().any(|e| matches!(e.kind, EventKind::BuildFinished { area: 36, .. })));
    assert_eq!(budget(&core), before + 36);
    assert!(core.inventory_view().iter().any(|i| i.item == "stove" && i.free > 0));
    assert_eq!(core.apply_all(at(MON + 3, TEN + 1), Command::FinishBuild { n: 0 }).err(), Some(CoreError::AlreadyDone));
    assert!(core.builds_view(at(MON + 3, TEN + 1)).orders[0].done);
    // and now a new order may be taken
    core.apply_all(at(MON + 3, TEN + 2), Command::OrderBuild { build: "build.terrace".into(), x: 0, y: 10 }).unwrap();
}

#[test]
fn a_tenant_does_not_build_on() {
    let mut core = world(3000);
    go(&mut core, at(MON, TEN), "village");
    core.apply_all(at(MON, TEN + 1), Command::Rent { home: "flat.sadova.1".into() }).unwrap();
    core.apply_all(at(MON, TEN + 2), Command::MoveHome { home: "flat.sadova.1".into() }).unwrap();
    go(&mut core, at(MON, TEN + 3), "utility_in");
    assert!(!core.builds_view(at(MON, TEN + 4)).owner);
    assert_eq!(
        core.apply_all(at(MON, TEN + 4), Command::OrderBuild { build: "build.kitchen".into(), x: 10, y: 0 }).err(),
        Some(CoreError::Tenant)
    );
}

#[test]
fn a_turtle_from_the_shelter_is_fed_and_played_with() {
    let mut core = world(500);
    assert_eq!(core.apply_all(at(MON, TEN), Command::Adopt { pet: "turtle".into() }).err(), Some(CoreError::NotHere));
    go(&mut core, at(MON, TEN), "vet_in");
    let offer = core.pets_view(at(MON, TEN)).here.into_iter().find(|o| o.id == "turtle").unwrap();
    assert_eq!(offer.step, "adopt");
    let coins = core.wallet().coins;
    core.apply_all(at(MON, TEN + 1), Command::Adopt { pet: "turtle".into() }).unwrap();
    assert_eq!(core.wallet().coins, coins - 80);
    assert_eq!(core.apply_all(at(MON, TEN + 2), Command::Adopt { pet: "turtle".into() }).err(), Some(CoreError::AlreadyOwned));
    // two days on without food: it is hungry (said in words, never counted)
    let v = core.pets_view(at(MON + 2, TEN));
    assert!(v.owned[0].hungry && !v.owned[0].words.is_empty());
    assert_eq!(
        core.apply_all(at(MON + 2, TEN), Command::PetCare { pet: "turtle".into(), what: "feed".into() }).err(),
        Some(CoreError::Needs("pet_food".into()))
    );
    core.apply_all(at(MON + 2, TEN + 1), Command::Use { station: "st.vet.pet_food".into() }).unwrap();
    core.apply_all(at(MON + 2, TEN + 2), Command::PetCare { pet: "turtle".into(), what: "feed".into() }).unwrap();
    assert_eq!(core.in_pocket("pet_food"), 0);
    core.apply_all(at(MON + 2, TEN + 3), Command::PetCare { pet: "turtle".into(), what: "play".into() }).unwrap();
    let v = core.pets_view(at(MON + 2, TEN + 4));
    assert!(v.owned[0].happy && !v.owned[0].hungry);
    // it goes out with the player when asked
    core.apply_all(at(MON + 2, TEN + 5), Command::Companion { pet: Some("turtle".into()) }).unwrap();
    assert_eq!(core.pets_view(at(MON + 2, TEN + 5)).companion.as_deref(), Some("turtle"));
    assert_eq!(core.apply_all(at(MON + 2, TEN + 6), Command::Companion { pet: Some("fox".into()) }).err(), Some(CoreError::NothingThere));
}

#[test]
fn the_fox_comes_along_after_food_left_on_three_days() {
    let mut core = world(500);
    for day in MON..MON + 3 {
        go(&mut core, at(day, TEN), "vet_in");
        core.apply_all(at(day, TEN + 1), Command::Use { station: "st.vet.pet_food".into() }).unwrap();
        go(&mut core, at(day, TEN + 2), "forest");
        let events = core.apply_all(at(day, TEN + 3), Command::Adopt { pet: "fox".into() }).unwrap();
        assert!(events.iter().any(|e| matches!(e.kind, EventKind::FoxFed { .. })));
        // once a day
        assert_eq!(core.apply_all(at(day, TEN + 4), Command::Adopt { pet: "fox".into() }).err(), Some(CoreError::TooSoon));
    }
    assert!(!core.pets_view(at(MON + 3, TEN)).fox.is_empty());
    go(&mut core, at(MON + 3, TEN), "forest");
    let events = core.apply_all(at(MON + 3, TEN + 1), Command::Adopt { pet: "fox".into() }).unwrap();
    assert!(events.iter().any(|e| matches!(&e.kind, EventKind::PetAdopted { pet, .. } if pet == "fox")));
}

#[test]
fn the_robot_comes_with_the_laptops_charges_and_needs_a_screwdriver_now_and_then() {
    let mut core = world(2000);
    go(&mut core, at(MON, TEN), "post_in");
    assert_eq!(core.apply_all(at(MON, TEN + 1), Command::Adopt { pet: "robot".into() }).err(), Some(CoreError::Closed));
    let day = 46;
    go(&mut core, at(day, TEN), "post_in");
    core.apply_all(at(day, TEN + 1), Command::Adopt { pet: "robot".into() }).unwrap();
    // it does not eat; it charges at home
    assert_eq!(core.apply_all(at(day, TEN + 2), Command::PetCare { pet: "robot".into(), what: "feed".into() }).err(), Some(CoreError::ActionNotAvailable));
    assert_eq!(core.apply_all(at(day, TEN + 2), Command::PetCare { pet: "robot".into(), what: "charge".into() }).err(), Some(CoreError::NotHere));
    go(&mut core, at(day, TEN + 3), "home");
    core.apply_all(at(day, TEN + 4), Command::PetCare { pet: "robot".into(), what: "charge".into() }).unwrap();
    // a month on it creaks; mended with one's own screwdrivers
    let later = day + 32;
    assert!(core.pets_view(at(later, TEN)).owned[0].worn);
    assert_eq!(core.apply_all(at(later, TEN), Command::PetCare { pet: "robot".into(), what: "fix".into() }).err(), Some(CoreError::Needs("screwdrivers".into())));
}

#[test]
fn a_dragon_hatches_from_an_egg_kept_warm_for_a_week() {
    let mut core = world(500);
    // no egg, nothing to do
    assert_eq!(core.apply_all(at(MON, TEN), Command::Adopt { pet: "dragon".into() }).err(), Some(CoreError::NothingThere));
    go(&mut core, at(MON, TEN), "vet_in");
    core.apply_all(at(MON, TEN + 1), Command::Use { station: "st.test.egg".into() }).unwrap();
    // the egg is laid in a warm nest at home, not elsewhere
    assert_eq!(core.apply_all(at(MON, TEN + 2), Command::Adopt { pet: "dragon".into() }).err(), Some(CoreError::NotHere));
    go(&mut core, at(MON, TEN + 3), "home");
    let events = core.apply_all(at(MON, TEN + 4), Command::Adopt { pet: "dragon".into() }).unwrap();
    assert!(events.iter().any(|e| matches!(e.kind, EventKind::EggNested { .. })));
    assert_eq!(core.in_pocket("dragon_egg"), 0);
    assert_eq!(core.pets_view(at(MON, TEN + 5)).egg, Some((MON, MON + 7)));
    assert_eq!(core.apply_all(at(MON + 3, TEN), Command::Adopt { pet: "dragon".into() }).err(), Some(CoreError::TooSoon));
    let events = core.apply_all(at(MON + 7, TEN), Command::Adopt { pet: "dragon".into() }).unwrap();
    assert!(events.iter().any(|e| matches!(&e.kind, EventKind::PetAdopted { pet, .. } if pet == "dragon")));
    let v = core.pets_view(at(MON + 7, TEN + 1));
    assert!(v.egg.is_none() && v.owned.iter().any(|p| p.id == "dragon"));
}

#[test]
fn building_on_and_the_animals_replay_the_same() {
    let mut core = world(3000);
    go(&mut core, at(MON, TEN), "utility_in");
    core.apply_all(at(MON, TEN + 1), Command::OrderBuild { build: "build.bath".into(), x: 10, y: 2 }).unwrap();
    go(&mut core, at(MON, TEN + 2), "vet_in");
    core.apply_all(at(MON, TEN + 3), Command::Adopt { pet: "turtle".into() }).unwrap();
    core.apply_all(at(MON + 4, TEN), Command::FinishBuild { n: 0 }).unwrap();
    let a = (core.builds_view(at(MON + 4, TEN + 1)), core.pets_view(at(MON + 4, TEN + 1)), core.wallet().coins);
    let content = core.content().clone();
    let again = Core::open_with(core.into_storage(), 1, content).unwrap();
    let b = (again.builds_view(at(MON + 4, TEN + 1)), again.pets_view(at(MON + 4, TEN + 1)), again.wallet().coins);
    assert_eq!(a, b);
}
