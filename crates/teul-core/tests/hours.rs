//! The town's shops and offices keep their hours: one does not walk into a shut shop at night; whoever is inside at
//! closing is not thrown out, and the places that never close (the hospital, the police, the fire station) never do.

mod common;

use std::sync::Arc;

use teul_core::content::Content;
use teul_core::core::{Command, Core, CoreError, NewWorld};
use teul_core::storage::{MemoryStorage, Storage};
use teul_core::time::{WorldTime, MINUTES_PER_DAY};

fn at(day: u64, minute: u64) -> WorldTime {
    WorldTime(day * MINUTES_PER_DAY + minute)
}

fn base() -> Content {
    Content::from_packs(&[include_str!("../../../content/base/pack.json")]).expect("the base pack is valid")
}

fn world() -> Core<MemoryStorage> {
    Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 7, epoch_unix_secs: common::AUTUMN_EPOCH }, Arc::new(base())).unwrap()
}

fn go(core: &mut Core<MemoryStorage>, t: WorldTime, to: &str) -> Result<(), CoreError> {
    core.apply_all(t, Command::Travel { to: to.into() }).map(|_| ())
}

#[test]
fn every_shop_and_office_has_its_hours_and_the_emergency_services_none() {
    let c = base();
    for id in ["cafe_in", "grocery_in", "bakery_in", "post_in", "clothes_in", "salon_in", "flower_in", "hardware_in", "townhall_in", "utility_in", "library_in"] {
        assert!(c.locations[id].hours.is_some(), "{id} has no hours");
    }
    for id in ["hospital_in", "police_in", "fire_in"] {
        assert!(c.locations[id].hours.is_none(), "{id} should never close");
    }
}

#[test]
fn a_shut_shop_is_not_walked_into_and_an_open_one_is() {
    let mut core = world();
    let (open, close) = core.content().locations["grocery_in"].hours.unwrap();
    // at three in the night
    assert_eq!(go(&mut core, at(1, 3 * 60), "grocery_in").err(), Some(CoreError::Closed));
    assert_eq!(core.location(), "home");
    // in its hours
    assert!(go(&mut core, at(1, u64::from(open) * 60 + 5), "grocery_in").is_ok());
    // after closing, whoever is inside stays (and may step out); only the way in is shut
    assert!(go(&mut core, at(1, u64::from(close) * 60 + 5), "grocery_in").is_ok(), "already inside");
    assert!(go(&mut core, at(1, u64::from(close) * 60 + 6), "village").is_ok());
    assert_eq!(go(&mut core, at(1, u64::from(close) * 60 + 7), "grocery_in").err(), Some(CoreError::Closed));
    // the hospital at any hour
    let r = go(&mut core, at(2, 3 * 60 + 10), "hospital_in");
    assert!(r.is_ok(), "{r:?}");
}

#[test]
fn a_place_open_past_midnight_is_open_after_it_too() {
    let mut c = base();
    let bar = c.locations.get_mut("bar_in").unwrap();
    bar.hours = Some((18, 2));
    let mut core = Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 7, epoch_unix_secs: common::AUTUMN_EPOCH }, Arc::new(c)).unwrap();
    assert!(go(&mut core, at(1, 60), "bar_in").is_ok(), "one in the night");
    assert!(go(&mut core, at(1, 90), "village").is_ok());
    assert_eq!(go(&mut core, at(1, 3 * 60), "bar_in").err(), Some(CoreError::Closed));
    assert_eq!(go(&mut core, at(1, 12 * 60), "bar_in").err(), Some(CoreError::Closed));
    assert!(go(&mut core, at(1, 19 * 60), "bar_in").is_ok());
}

#[test]
fn what_was_done_before_the_hours_came_stays_done() {
    // a world played under content without hours: into the grocery at three in the night
    let mut then = base();
    for l in then.locations.values_mut() {
        l.hours = None;
    }
    // (other content: another fingerprint, as an update gives)
    then.fingerprint ^= 1;
    let mut core = Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 7, epoch_unix_secs: common::AUTUMN_EPOCH }, Arc::new(then)).unwrap();
    go(&mut core, at(1, 3 * 60), "grocery_in").unwrap();
    go(&mut core, at(1, 3 * 60 + 5), "village").unwrap();
    // opened with the hours, its log read from the start (as a backup restored without its snapshot): nothing
    // of it is lost or taken for tampering
    let old = core.into_storage();
    let mut log = MemoryStorage::new();
    for k in ["seed", "world_version", "epoch_unix_secs", "realm", "chain_secret"] {
        if let Some(v) = old.meta_get(k).unwrap() {
            log.meta_set(k, &v).unwrap();
        }
    }
    log.append_batch(&old.events_after(None).unwrap()).unwrap();
    let now = Core::open_with(log, 1, Arc::new(base())).unwrap();
    assert!(!now.integrity().from_snapshot);
    assert_eq!(now.integrity().tampered, 0, "{:?}", now.integrity().dropped);
    assert_eq!(now.location(), "village");
}
