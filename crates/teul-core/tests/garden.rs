//! The garden grows in real days (docs/world-economy.md §10): a bought seed and care turn into food; water or
//! rain each day; a few dry days wilt a plant and more kill it; trees fruit in their season, again and again.

mod common;

use std::sync::Arc;

use teul_core::core::{Command, Core, CoreError, NewWorld};
use teul_core::event::EventKind;
use teul_core::storage::MemoryStorage;
use teul_core::time::{WorldTime, MINUTES_PER_DAY};

fn at(day: u64, minute: u64) -> WorldTime {
    WorldTime(day * MINUTES_PER_DAY + minute)
}

/// A home with a bed out of doors (pid of the plot) and a pot inside, and seeds in the pocket.
fn world(seeds: &[&str]) -> (Core<MemoryStorage>, u32, u32) {
    let mut core = Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 5, epoch_unix_secs: common::AUTUMN_EPOCH }, Arc::new(common::work())).unwrap();
    let mut pids = Vec::new();
    for (item, x) in [("garden_plot", 1), ("pot_plot", 3)] {
        core.apply_all(at(0, 500), Command::Acquire { item: item.into() }).unwrap();
        let ev = core.apply_all(at(0, 500), Command::Place { item: item.into(), x, y: 2, rot: 0, wall: None, on: None }).unwrap();
        pids.push(ev.iter().find_map(|e| match &e.kind {
            EventKind::Placed { pid, .. } => Some(*pid),
            _ => None,
        }).unwrap());
    }
    core.apply_all(at(0, 600), Command::Travel { to: "bazaar".into() }).unwrap();
    for (i, s) in seeds.iter().enumerate() {
        let st = if *s == "seed_tomato" { "st.seeds" } else { "st.sapling" };
        core.apply_all(at(0, 601 + i as u64), Command::Use { station: st.into() }).unwrap();
    }
    core.apply_all(at(0, 620), Command::Travel { to: "home".into() }).unwrap();
    (core, pids[0], pids[1])
}

fn plot(core: &Core<MemoryStorage>, t: WorldTime, pid: u32) -> teul_core::garden::PlotView {
    core.garden_view(t).into_iter().find(|p| p.pid == pid).unwrap()
}

#[test]
fn a_seed_from_the_pocket_goes_into_an_empty_plot_at_home() {
    let (mut core, bed, _) = world(&["seed_tomato", "seed_tomato"]);
    assert_eq!(core.apply_all(at(0, 630), Command::Plant { pid: 999, seed: "seed_tomato".into() }).err(), Some(CoreError::UnknownPlacement(999)));
    assert_eq!(core.apply_all(at(0, 630), Command::Plant { pid: bed, seed: "apple_w".into() }).err(), Some(CoreError::NotEnough));
    let ev = core.apply_all(at(0, 630), Command::Plant { pid: bed, seed: "seed_tomato".into() }).unwrap();
    assert!(ev.iter().any(|e| matches!(&e.kind, EventKind::Planted { plant, .. } if plant == "tomato")));
    assert_eq!(core.pocket_view().items.get("seed_tomato"), Some(&1));
    // one plant to a plot
    assert_eq!(core.apply_all(at(0, 631), Command::Plant { pid: bed, seed: "seed_tomato".into() }).err(), Some(CoreError::AlreadyDone));
    let p = plot(&core, at(0, 632), bed);
    assert_eq!((p.plant.as_deref(), p.stage, p.model.as_deref()), (Some("tomato"), 0, Some("plant_tomato_0")));
}

#[test]
fn watered_every_day_it_ripens_and_the_harvest_goes_into_the_pocket() {
    let (mut core, _, pot) = world(&["seed_tomato"]);
    core.apply_all(at(0, 630), Command::Plant { pid: pot, seed: "seed_tomato".into() }).unwrap();
    // it was planted wet; water the pot each morning (rain never reaches it)
    for day in 1..=9 {
        core.apply_all(at(day, 480), Command::Water { pid: pot }).unwrap();
        // once a day is enough: the soil is still wet
        assert_eq!(core.apply_all(at(day, 481), Command::Water { pid: pot }).err(), Some(CoreError::AlreadyDone));
    }
    let p = plot(&core, at(9, 600), pot);
    assert!(p.ripe, "{p:?}");
    assert_eq!(p.stage, 3);
    let ev = core.apply_all(at(9, 601), Command::Harvest { pid: pot }).unwrap();
    assert!(ev.iter().any(|e| matches!(&e.kind, EventKind::Harvested { item, n: 3, cleared: true, .. } if item == "tomato")), "{ev:?}");
    assert_eq!(core.pocket_view().items.get("tomato"), Some(&3));
    assert_eq!(plot(&core, at(9, 602), pot).plant, None);
    // nothing to pick before it is ripe
    assert_eq!(core.apply_all(at(9, 603), Command::Harvest { pid: pot }).err(), Some(CoreError::NothingThere));
}

#[test]
fn dry_days_wilt_a_plant_and_more_kill_it() {
    let (mut core, _, pot) = world(&["seed_tomato"]);
    core.apply_all(at(0, 630), Command::Plant { pid: pot, seed: "seed_tomato".into() }).unwrap();
    // two dry days in a row: it wilts (thirst 2)
    let p = plot(&core, at(2, 600), pot);
    assert!(p.wilting && !p.dead, "{p:?}");
    assert!(p.thirsty);
    // watered again it recovers
    core.apply_all(at(2, 601), Command::Water { pid: pot }).unwrap();
    assert!(!plot(&core, at(2, 700), pot).wilting);
    // four dry days kill it (die 4)
    let p = plot(&core, at(6, 600), pot);
    assert!(p.dead, "{p:?}");
    assert_eq!(p.model.as_deref(), Some("plant_withered"));
    assert_eq!(core.apply_all(at(6, 601), Command::Water { pid: pot }).err(), Some(CoreError::NothingThere));
    core.apply_all(at(6, 602), Command::ClearPlot { pid: pot }).unwrap();
    assert_eq!(plot(&core, at(6, 603), pot).plant, None);
}

#[test]
fn rain_waters_the_beds_out_of_doors_but_not_the_pots() {
    let (mut core, bed, pot) = world(&["seed_tomato", "seed_tomato"]);
    core.apply_all(at(0, 630), Command::Plant { pid: bed, seed: "seed_tomato".into() }).unwrap();
    core.apply_all(at(0, 631), Command::Plant { pid: pot, seed: "seed_tomato".into() }).unwrap();
    // over two weeks without watering the bed is watered by whatever rain falls; the pot dies anyway
    let b = plot(&core, at(14, 600), bed);
    let p = plot(&core, at(14, 600), pot);
    assert!(p.dead);
    assert!(b.growth >= p.growth, "{b:?} {p:?}");
    let rainy = (1..=14).filter(|d| core.rained(at(*d, 0))).count();
    if rainy > 0 {
        assert!(b.growth > 0, "rain fell on {rainy} days, the bed should have grown");
    }
}

#[test]
fn a_tree_fruits_in_its_season_again_and_again() {
    let (mut core, _, pot) = world(&["sapling_apple"]);
    core.apply_all(at(0, 630), Command::Plant { pid: pot, seed: "sapling_apple".into() }).unwrap();
    for day in 1..=17 {
        core.apply_all(at(day, 480), Command::Water { pid: pot }).unwrap();
        if day == 10 {
            // ripe at 10 growth days (autumn, a fruiting season)
            let ev = core.apply_all(at(10, 600), Command::Harvest { pid: pot }).unwrap();
            assert!(ev.iter().any(|e| matches!(&e.kind, EventKind::Harvested { cleared: false, n: 4, .. })), "{ev:?}");
        }
        if day == 12 {
            // not again for a week
            assert_eq!(core.apply_all(at(12, 600), Command::Harvest { pid: pot }).err(), Some(CoreError::NothingThere));
        }
    }
    core.apply_all(at(17, 600), Command::Harvest { pid: pot }).unwrap();
    assert_eq!(core.pocket_view().items.get("apple_w"), Some(&8));
    assert!(plot(&core, at(17, 601), pot).plant.is_some(), "the tree stays");
}

#[test]
fn watering_is_done_at_home_with_the_water_on() {
    let (mut core, bed, _) = world(&["seed_tomato"]);
    core.apply_all(at(0, 630), Command::Plant { pid: bed, seed: "seed_tomato".into() }).unwrap();
    core.apply_all(at(1, 400), Command::Travel { to: "bazaar".into() }).unwrap();
    assert_eq!(core.apply_all(at(1, 401), Command::Water { pid: bed }).err(), Some(CoreError::NotHere));
}

#[test]
fn the_garden_reads_the_same_after_reopening() {
    let (mut core, bed, pot) = world(&["seed_tomato", "seed_tomato"]);
    core.apply_all(at(0, 630), Command::Plant { pid: bed, seed: "seed_tomato".into() }).unwrap();
    core.apply_all(at(0, 631), Command::Plant { pid: pot, seed: "seed_tomato".into() }).unwrap();
    core.apply_all(at(3, 500), Command::Water { pid: pot }).unwrap();
    let before = core.garden_view(at(5, 0));
    let reopened = Core::open_with(core.into_storage(), 1, Arc::new(common::work())).unwrap();
    assert_eq!(reopened.garden_view(at(5, 0)), before);
}
