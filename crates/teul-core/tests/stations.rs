//! Places to use: the interesting things of the world do something, by their own rules.

mod common;

use std::sync::Arc;

use teul_core::content::Content;
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

fn use_(core: &mut Core<MemoryStorage>, t: WorldTime, station: &str) -> Result<Vec<teul_core::event::Event>, CoreError> {
    core.apply_all(t, Command::Use { station: station.into() })
}

#[test]
fn a_station_is_used_where_it_stands_and_as_often_as_it_allows() {
    let mut core = world();
    assert_eq!(use_(&mut core, at(0, 600), "st.farm.shear").err(), Some(CoreError::NotHere));
    core.apply_all(at(0, 601), Command::Travel { to: "farm".into() }).unwrap();
    let events = use_(&mut core, at(0, 602), "st.farm.shear").unwrap();
    assert!(matches!(&events[0].kind, EventKind::Used { station, day: 0, gave, .. } if station == "st.farm.shear" && gave == &vec!["yarn".to_string()]));
    use_(&mut core, at(0, 603), "st.farm.shear").unwrap();
    assert_eq!(use_(&mut core, at(0, 604), "st.farm.shear").err(), Some(CoreError::TooSoon));
    // a new day, a new chance
    use_(&mut core, at(1, 600), "st.farm.shear").unwrap();
    assert_eq!(core.pocket_view().items.get("yarn"), Some(&3));
}

#[test]
fn buying_and_selling_move_coins_and_things() {
    let mut core = world();
    core.apply_all(at(0, 600), Command::Travel { to: "village".into() }).unwrap();
    let coins = core.wallet().coins;
    use_(&mut core, at(0, 601), "st.village.bakery").unwrap();
    assert_eq!(core.wallet().coins, coins - 3);
    assert_eq!(core.pocket_view().items.get("bread"), Some(&1));
    core.apply_all(at(0, 602), Command::Travel { to: "farm".into() }).unwrap();
    let events = use_(&mut core, at(0, 603), "st.farm.sell").unwrap();
    assert!(matches!(&events[0].kind, EventKind::Used { took, earn: 5, .. } if took == &vec!["bread".to_string()]));
    assert_eq!(core.wallet().coins, coins - 3 + 5);
    // nothing left to sell
    assert_eq!(use_(&mut core, at(0, 604), "st.farm.sell").err(), Some(CoreError::NotEnough));
}

#[test]
fn a_station_keeps_its_hours_and_its_requirements() {
    let mut core = world();
    core.apply_all(at(0, 60), Command::Travel { to: "village".into() }).unwrap();
    // the bakery opens at six
    assert_eq!(use_(&mut core, at(0, 61), "st.village.bakery").err(), Some(CoreError::Closed));
    // the cave's dig needs a second help first (and the cave itself a lantern)
    let view = core.stations_view(at(0, 62));
    let dig = view.iter().find(|s| s.id == "st.cave.dig").unwrap();
    assert!(!dig.ok);
    assert!(dig.missing.contains(&Missing::Help { help: "help.second".into() }));
}

#[test]
fn a_station_needs_room_for_what_it_gives_and_coins_for_what_it_costs() {
    let mut core = world();
    core.apply_all(at(0, 600), Command::Travel { to: "farm".into() }).unwrap();
    // the pouch costs 20 coins and a yarn
    assert_eq!(use_(&mut core, at(0, 601), "st.farm.pouch").err(), Some(CoreError::NotEnough));
    core.apply_all(at(0, 602), Command::Travel { to: "village".into() }).unwrap();
    // three kinds carried (mushrooms, bread, a perch): the yarn, a fourth, has no name free
    core.apply_all(at(0, 603), Command::Gather { spot: "shroom".into() }).unwrap();
    core.apply_all(at(0, 603), Command::Use { station: "st.village.bakery".into() }).unwrap();
    core.apply_all(at(0, 603), Command::Fish { place: "pond".into() }).unwrap();
    core.apply_all(at(0, 604), Command::Travel { to: "farm".into() }).unwrap();
    assert_eq!(use_(&mut core, at(0, 605), "st.farm.shear").err(), Some(CoreError::PocketFull));
}

#[test]
fn the_home_never_pays() {
    let bad = r#"{ "schema": 1, "id": "cheat", "version": 1,
      "stations": [{ "id": "st.home.mint", "location": "home", "prop": "teapot", "label": "Чай", "text": "", "earn": 5, "kind": "sell" }] }"#;
    let err = Content::from_packs(&[common::PACK, common::ECONOMY, bad]).unwrap_err();
    assert!(err.to_string().contains("home"), "{err}");
    let free = r#"{ "schema": 1, "id": "cheat", "version": 1,
      "stations": [{ "id": "st.home.bake", "location": "home", "prop": "teapot", "label": "Хліб", "text": "", "gives": [["bread", 1]], "kind": "make" }] }"#;
    assert!(Content::from_packs(&[common::PACK, common::ECONOMY, free]).is_err(), "nothing from nothing at home");
}

#[test]
fn stations_refer_to_real_things() {
    let unknown = r#"{ "schema": 1, "id": "x", "version": 1,
      "stations": [{ "id": "st.x", "location": "farm", "prop": "counter", "label": "x", "text": "", "gives": [["unicorn", 1]], "kind": "buy" }] }"#;
    assert!(Content::from_packs(&[common::PACK, common::ECONOMY, unknown]).is_err());
    let key = r#"{ "schema": 1, "id": "x", "version": 1,
      "stations": [{ "id": "st.x", "location": "farm", "prop": "counter", "label": "x", "text": "", "needs": [["miner_lantern", 1]], "earn": 99, "kind": "sell" }] }"#;
    assert!(Content::from_packs(&[common::PACK, common::ECONOMY, key]).is_err(), "keys are never sold");
    let nowhere = r#"{ "schema": 1, "id": "x", "version": 1,
      "stations": [{ "id": "st.x", "location": "farm", "prop": "teapot", "label": "x", "text": "", "gives": [["yarn", 1]], "kind": "buy" }] }"#;
    assert!(Content::from_packs(&[common::PACK, common::ECONOMY, nowhere]).is_err(), "the prop must stand in that place");
}
