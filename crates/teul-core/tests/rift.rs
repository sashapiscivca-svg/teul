//! The Other Side: open only on the equinoxes and the solstices (real Kyiv dates), for the whole day.

mod common;

use std::sync::Arc;

use teul_core::content::Content;
use teul_core::core::{Command, Core, CoreError, NewWorld};
use teul_core::storage::MemoryStorage;
use teul_core::time::{WorldTime, MINUTES_PER_DAY};
use teul_core::unlock::Missing;

const RIFT: &str = r##"{
  "schema": 1, "id": "rift", "version": 1,
  "items": [
    { "id": "rift_shard", "name": "item.rift_shard", "category": "nature", "tags": ["rift"], "footprint": { "w": 1, "d": 1 }, "layer": "surface", "acquire": "free", "hidden": true, "carry": true }
  ],
  "locations": [{
    "id": "otherside", "name": "Інший бік", "w": 4, "h": 4,
    "tiles": ["gggg", "gggg", "gggg", "gggg"], "legend": { "g": "floor.oak" },
    "spots": [{ "id": "shardfall", "x": 1, "y": 1, "gives": [{ "item": "rift_shard" }] }],
    "requires": { "days": ["rift"], "hint": "Розлом відкривається лише в дні рівнодення й сонцестояння." }
  }]
}"##;

fn world() -> Core<MemoryStorage> {
    let content = Content::from_packs(&[common::PACK, common::ECONOMY, RIFT]).expect("the rift pack is valid");
    Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 3, epoch_unix_secs: common::AUTUMN_EPOCH }, Arc::new(content)).unwrap()
}

fn at(day: u64, minute: u64) -> WorldTime {
    WorldTime(day * MINUTES_PER_DAY + minute)
}

/// Day 0 is 2026-10-10; the winter solstice of 2026 (21 December) is day 72.
const SOLSTICE: u64 = 72;

#[test]
fn the_other_side_is_closed_on_ordinary_days_and_says_why() {
    let mut core = world();
    let err = core.apply_all(at(0, 600), Command::Travel { to: "otherside".into() }).unwrap_err();
    assert_eq!(err, CoreError::Locked(vec![Missing::Day { day: "rift".into() }]));
    let view = core.location_view(at(0, 600));
    assert!(!view.places["otherside"].open);
    assert!(view.places["otherside"].hint.contains("рівнодення"));
    // the day before the solstice too
    assert!(core.apply_all(at(SOLSTICE - 1, 1430), Command::Travel { to: "otherside".into() }).is_err());
}

#[test]
fn on_the_solstice_the_rift_is_open_all_day_and_gives_its_finds() {
    let mut core = world();
    assert!(core.location_view(at(SOLSTICE, 0)).places["otherside"].open);
    core.apply_all(at(SOLSTICE, 5), Command::Travel { to: "otherside".into() }).unwrap();
    core.apply_all(at(SOLSTICE, 10), Command::Gather { spot: "shardfall".into() }).unwrap();
    assert_eq!(core.pocket_view().items.get("rift_shard"), Some(&1));
    // late in the evening it is still the same day
    assert!(core.location_view(at(SOLSTICE, 1439)).places["otherside"].open);
}

#[test]
fn after_midnight_the_rift_has_closed_nothing_more_is_found_and_the_way_home_is_open() {
    let mut core = world();
    core.apply_all(at(SOLSTICE, 1400), Command::Travel { to: "otherside".into() }).unwrap();
    // the next day: still "there" until the player comes back, but the place gives nothing any more
    let err = core.apply_all(at(SOLSTICE + 1, 30), Command::Gather { spot: "shardfall".into() }).unwrap_err();
    assert_eq!(err, CoreError::Locked(vec![Missing::Day { day: "rift".into() }]));
    core.apply_all(at(SOLSTICE + 1, 31), Command::Travel { to: "home".into() }).unwrap();
    assert_eq!(core.location(), "home");
}

#[test]
fn a_place_open_only_on_a_holiday_follows_the_calendar() {
    // the `days` rule takes holiday ids too
    let pack = RIFT.replace(r#""days": ["rift"]"#, r#""days": ["christmas"]"#);
    let content = Content::from_packs(&[common::PACK, common::ECONOMY, &pack]).unwrap();
    let mut core = Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 3, epoch_unix_secs: common::AUTUMN_EPOCH }, Arc::new(content)).unwrap();
    assert!(core.apply_all(at(SOLSTICE, 600), Command::Travel { to: "otherside".into() }).is_err());
    // 25 December 2026 is day 76
    core.apply_all(at(76, 600), Command::Travel { to: "otherside".into() }).unwrap();
}

#[test]
fn an_unknown_day_in_the_rules_is_refused_by_the_content_check() {
    let pack = RIFT.replace(r#""days": ["rift"]"#, r#""days": ["blue_moon"]"#);
    assert!(Content::from_packs(&[common::PACK, common::ECONOMY, &pack]).is_err());
}

#[test]
fn the_base_story_of_the_rifts_has_a_chapter_in_each_world_on_its_day() {
    let c = Content::from_packs(&[include_str!("../../../content/base/pack.json")]).expect("the base pack is valid");
    let days = ["spring_equinox", "summer_solstice", "autumn_equinox", "winter_solstice"];
    for (k, id) in ["rift.ch1", "rift.ch2", "rift.ch3", "rift.ch4"].iter().enumerate() {
        let q = c.quests.get(*id).unwrap_or_else(|| panic!("{id} is in the pack"));
        assert_eq!(q.when.as_ref().and_then(|w| w.holiday.as_deref()), Some(days[k]), "{id} falls on its rift day");
        // each chapter stands on its own: one need not wait a year for the one before
        assert!(q.after.is_empty(), "{id} needs no chapter before it");
    }
    // each world opens only on its own day, has things to find, and a crack back; the cracks stand in this world
    for w in teul_core::sky::RIFT_WORLDS {
        let l = &c.locations[w];
        assert_eq!(l.requires.as_ref().map(|r| r.days.clone()), Some(vec![w.to_string()]), "{w}");
        assert!(!l.spots.is_empty(), "{w} has things to find");
        assert!(l.props.iter().any(|p| p.item == "rift_crack" && !p.rift), "{w}: the way back stands there");
    }
    let places: std::collections::BTreeSet<&str> = c.locations.values().filter(|l| l.props.iter().any(|p| p.rift)).map(|l| l.id.as_str()).collect();
    for p in ["village", "forest", "fields", "cave", "cemetery"] {
        assert!(places.contains(p), "a rift opens in {p}");
    }
    // the winter world is the town itself, with no doors and none of its sites
    let (town, mirror) = (&c.locations["village"], &c.locations["rift_winter"]);
    assert_eq!((town.w, town.h), (mirror.w, mirror.h));
    assert!(mirror.exits.is_empty() && mirror.sites.is_empty());
}
