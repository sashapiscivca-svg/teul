//! The road: lessons at the driving school, the theory and the practical exam, the licence on the ring; a car
//! from the service station, its fuel and wear; what is done wrong on the road, the coupon, the cell, the paper;
//! money lying on the road.

mod common;

use std::sync::Arc;

use teul_core::content::Content;
use teul_core::core::{Command, Core, CoreError, NewWorld};
use teul_core::drive::{road_coins, COUPON};
use teul_core::event::EventKind;
use teul_core::storage::MemoryStorage;
use teul_core::time::{WorldTime, MINUTES_PER_DAY};

fn at(day: u64, minute: u64) -> WorldTime {
    WorldTime(day * MINUTES_PER_DAY + minute)
}

// day 0 is Saturday 2026-10-10: day 2 is a Monday, day 8 the next Sunday
const MON: u64 = 2;
const TEN: u64 = 10 * 60;

/// The base pack, with a fuller purse to start with (a car costs more than the first days bring).
fn base(coins: u64) -> Content {
    let text = include_str!("../../../content/base/pack.json");
    let mut v: serde_json::Value = serde_json::from_str(text).unwrap();
    v["start_coins"] = serde_json::json!(coins);
    Content::from_packs(&[&v.to_string()]).unwrap()
}

fn world(coins: u64) -> Core<MemoryStorage> {
    Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 7, epoch_unix_secs: common::AUTUMN_EPOCH }, Arc::new(base(coins))).unwrap()
}

fn go(core: &mut Core<MemoryStorage>, t: WorldTime, to: &str) {
    core.apply_all(t, Command::Travel { to: to.into() }).unwrap();
}

fn right_answers(core: &Core<MemoryStorage>, day: u64) -> Vec<u32> {
    let d = core.content().driving.as_ref().unwrap();
    core.theory_questions(day).into_iter().map(|i| d.questions[i].right).collect()
}

/// Lessons on four days, the theory on the fifth, the practical right after.
fn licensed(core: &mut Core<MemoryStorage>) -> u64 {
    let mut day = MON;
    for _ in 0..4 {
        go(core, at(day, TEN), "driving_in");
        core.apply_all(at(day, TEN + 1), Command::Lesson).unwrap();
        day += 1;
    }
    go(core, at(day, TEN), "driving_in");
    let answers = right_answers(core, day);
    core.apply_all(at(day, TEN + 1), Command::Theory { answers }).unwrap();
    core.apply_all(at(day, TEN + 2), Command::StartExam).unwrap();
    go(core, at(day, TEN + 3), "village");
    core.apply_all(at(day, TEN + 3), Command::StartDrive { exam: true }).unwrap();
    core.apply_all(at(day, TEN + 9), Command::Park { cells: 400, x: 10, y: 77, rot: 0 }).unwrap();
    core.apply_all(at(day, TEN + 9), Command::EndExam { faults: vec!["sidewalk".into()] }).unwrap();
    assert!(core.state().drive.licence.is_some());
    day
}

#[test]
fn lessons_then_theory_then_the_road_give_the_licence() {
    let mut core = world(300);
    let coins0 = core.wallet().coins;
    // only at the school, and only while it is open
    assert_eq!(core.apply_all(at(MON, TEN), Command::Lesson).err(), Some(CoreError::NotHere));
    go(&mut core, at(MON, 7 * 60), "driving_in");
    assert_eq!(core.apply_all(at(MON, 7 * 60), Command::Lesson).err(), Some(CoreError::Closed));
    core.apply_all(at(MON, TEN), Command::Lesson).unwrap();
    // one lesson a day
    assert_eq!(core.apply_all(at(MON, TEN + 30), Command::Lesson).err(), Some(CoreError::TooSoon));
    // the theory waits for all the lessons
    assert_eq!(core.apply_all(at(MON, TEN + 31), Command::Theory { answers: vec![0; 5] }).err(), Some(CoreError::NotToday));
    for day in MON + 1..MON + 4 {
        core.apply_all(at(day, TEN), Command::Lesson).unwrap();
    }
    assert_eq!(core.apply_all(at(MON + 4, TEN), Command::Lesson).err(), Some(CoreError::AlreadyDone));
    // a wrong theory: tried, failed, again only tomorrow
    let day = MON + 4;
    let wrong: Vec<u32> = right_answers(&core, day).into_iter().map(|a| (a + 1) % 2).collect();
    let ev = core.apply_all(at(day, TEN + 1), Command::Theory { answers: wrong }).unwrap();
    assert!(matches!(ev[0].kind, EventKind::TheoryTaken { passed: false, .. }));
    assert_eq!(core.apply_all(at(day, TEN + 2), Command::Theory { answers: right_answers(&core, day) }).err(), Some(CoreError::TooSoon));
    // the questions differ from day to day
    assert_ne!(core.theory_questions(day), core.theory_questions(day + 1));
    let day = day + 1;
    core.apply_all(at(day, TEN + 1), Command::Theory { answers: right_answers(&core, day) }).unwrap();
    assert!(core.state().drive.theory);
    core.apply_all(at(day, TEN + 2), Command::StartExam).unwrap();
    go(&mut core, at(day, TEN + 3), "village");
    core.apply_all(at(day, TEN + 3), Command::StartDrive { exam: true }).unwrap();
    // a minute is too short for the route
    assert_eq!(core.apply_all(at(day, TEN + 3), Command::EndExam { faults: vec![] }).err(), Some(CoreError::TooSoon));
    // a knock into a fence fails it
    let ev = core.apply_all(at(day, TEN + 8), Command::EndExam { faults: vec!["crash".into()] }).unwrap();
    assert!(matches!(&ev[0].kind, EventKind::ExamEnded { passed: false, .. }));
    assert!(core.state().drive.licence.is_none());
    // the next day is a Sunday: the school rests; on Monday one small slip is forgiven
    let day = day + 1;
    go(&mut core, at(day, TEN), "driving_in");
    assert_eq!(core.apply_all(at(day, TEN + 1), Command::StartExam).err(), Some(CoreError::Closed));
    let day = day + 1;
    core.apply_all(at(day, TEN + 1), Command::StartExam).unwrap();
    let ev = core.apply_all(at(day, TEN + 6), Command::EndExam { faults: vec!["sidewalk".into()] }).unwrap();
    assert!(matches!(&ev[0].kind, EventKind::ExamEnded { passed: true, .. }));
    assert_eq!(core.state().owned.get("driver_licence"), Some(&1));
    let v = core.drive_view(at(day, TEN + 7)).unwrap();
    assert_eq!(v.licence, Some(day));
    assert_eq!(v.holes, 0);
    // four lessons, two theories, two exams
    assert_eq!(coins0 - core.wallet().coins, 4 * 25 + 2 * 30 + 2 * 50);
}

#[test]
fn the_school_rests_on_sunday() {
    let mut core = world(300);
    go(&mut core, at(8, TEN), "driving_in");
    assert_eq!(core.apply_all(at(8, TEN), Command::Lesson).err(), Some(CoreError::Closed));
    assert!(!core.drive_view(at(8, TEN)).unwrap().school_open);
}

#[test]
fn a_car_is_bought_driven_and_wears() {
    let mut core = world(5000);
    go(&mut core, at(MON, TEN), "sto_in");
    assert_eq!(core.apply_all(at(MON, TEN), Command::BuyCar { car: "nope".into() }).err(), Some(CoreError::NoRequest));
    core.apply_all(at(MON, TEN), Command::BuyCar { car: "lastivka".into() }).unwrap();
    assert_eq!(core.apply_all(at(MON, TEN + 1), Command::BuyCar { car: "dnipro".into() }).err(), Some(CoreError::AlreadyOwned));
    assert_eq!(core.state().owned.get("car_keys"), Some(&1));
    let park = core.content().driving.as_ref().unwrap().sto_park;
    let car = core.state().drive.car.clone().unwrap();
    assert_eq!((car.at.1, car.at.2), (park.0, park.1));
    assert_eq!(car.fuel, 50);
    // fill up at the pump
    core.apply_all(at(MON, TEN + 2), Command::Refuel).unwrap();
    assert_eq!(core.state().drive.car.as_ref().unwrap().fuel, 100);
    // the car stands in the town: one drives it there
    assert_eq!(core.apply_all(at(MON, TEN + 3), Command::StartDrive { exam: false }).err(), Some(CoreError::NotHere));
    go(&mut core, at(MON, TEN + 3), "village");
    core.apply_all(at(MON, TEN + 3), Command::StartDrive { exam: false }).unwrap();
    // nobody drives two thousand cells in a minute
    assert_eq!(core.apply_all(at(MON, TEN + 4), Command::Park { cells: 2000, x: 20, y: 26, rot: 0 }).err(), Some(CoreError::TooFast));
    core.apply_all(at(MON, TEN + 6), Command::Park { cells: 600, x: 20, y: 26, rot: 2 }).unwrap();
    let car = core.state().drive.car.clone().unwrap();
    assert_eq!(car.odo, 600);
    assert_eq!(car.fuel, 80);
    assert_eq!(car.at, ("village".to_string(), 20, 26, 2));
    // a long way later the oil is due, then the engine seizes
    let mut t = TEN + 10;
    let mut cans = 0;
    for _ in 0..20 {
        if core.state().drive.car.as_ref().unwrap().broken() {
            break;
        }
        core.apply_all(at(MON, t), Command::StartDrive { exam: false }).unwrap();
        t += 10;
        core.apply_all(at(MON, t), Command::Park { cells: 600, x: 20, y: 26, rot: 0 }).unwrap();
        t += 1;
        if core.state().drive.car.as_ref().unwrap().fuel < 30 {
            if cans == 0 {
                // a canister from the station, poured in where the car stands
                go(&mut core, at(MON, t), "sto_in");
                core.apply_all(at(MON, t), Command::Use { station: "st.sto.can".into() }).unwrap();
                go(&mut core, at(MON, t), "village");
                core.apply_all(at(MON, t), Command::Refuel).unwrap();
                cans += 1;
            } else if !core.state().drive.car.as_ref().unwrap().broken() {
                // or driven to the station's yard and filled at the pump
                core.apply_all(at(MON, t), Command::StartDrive { exam: false }).unwrap();
                t += 2;
                core.apply_all(at(MON, t), Command::Park { cells: 60, x: park.0, y: park.1, rot: 0 }).unwrap();
                core.apply_all(at(MON, t), Command::Refuel).unwrap();
                assert_eq!(core.state().drive.car.as_ref().unwrap().fuel, 100);
            }
        }
    }
    let car = core.state().drive.car.clone().unwrap();
    assert!(car.odo > 8000);
    assert!(car.broken(), "{car:?}");
    assert_eq!(core.apply_all(at(MON, t + 1), Command::StartDrive { exam: false }).err(), Some(CoreError::CarBroken));
    // the station tows it in and mends it
    go(&mut core, at(MON, t + 2), "sto_in");
    core.apply_all(at(MON, t + 2), Command::Service { what: "repair".into() }).unwrap();
    let car = core.state().drive.car.clone().unwrap();
    assert!(!car.broken());
    assert_eq!((car.at.1, car.at.2), (park.0, park.1));
}

#[test]
fn a_full_coupon_takes_the_licence_and_the_night_is_spent_in_the_cell() {
    let mut core = world(5000);
    let day = licensed(&mut core);
    go(&mut core, at(day, TEN + 20), "sto_in");
    core.apply_all(at(day, TEN + 20), Command::BuyCar { car: "dnipro".into() }).unwrap();
    go(&mut core, at(day, TEN + 21), "village");
    // dangerous driving near people until the police take the licence
    let mut t = TEN + 22;
    let mut arrested = false;
    for _ in 0..40 {
        core.apply_all(at(day, t), Command::StartDrive { exam: false }).unwrap();
        let ev = core.apply_all(at(day, t + 1), Command::Violation { kind: "pedestrian".into(), cells: 50, x: 20, y: 26 }).unwrap();
        t += 2;
        if ev.iter().any(|e| matches!(e.kind, EventKind::Arrested { .. })) {
            arrested = true;
            break;
        }
        assert!(core.state().drive.holes_on(day) < COUPON);
        if core.state().drive.trip.is_some() {
            core.apply_all(at(day, t), Command::Park { cells: 0, x: 20, y: 26, rot: 0 }).unwrap();
        }
    }
    assert!(arrested);
    let st = core.state().drive.clone();
    assert!(st.licence.is_none());
    assert_eq!(core.state().owned.get("driver_licence").copied().unwrap_or(0), 0);
    assert!(!st.theory);
    assert_eq!(core.location(), "police_in");
    // the cell is locked: no walking out, no taxi
    assert_eq!(core.apply_all(at(day, t + 5), Command::Travel { to: "village".into() }).err(), Some(CoreError::Jailed));
    let until = st.jailed_until.unwrap();
    let v = core.drive_view(at(day, t + 5)).unwrap();
    assert_eq!(v.jailed_until, Some(until));
    assert!(!v.cellmate.is_empty());
    // the car was towed to the police yard
    let police = core.content().sites.get("police_site").unwrap();
    let car = st.car.clone().unwrap();
    assert_eq!((car.at.1, car.at.2), (police.x, police.y));
    // out when the time is up
    core.apply_all(WorldTime(until), Command::Travel { to: "village".into() }).unwrap();
    // the exams again, but only after a few days
    go(&mut core, WorldTime(until + 1), "driving_in");
    let d2 = WorldTime(until).day();
    assert!(core.drive_view(WorldTime(until + 1)).unwrap().back_in.is_some());
    assert_eq!(core.apply_all(at(d2, TEN + 30).max(WorldTime(until + 2)), Command::Theory { answers: right_answers(&core, d2) }).err(), Some(CoreError::NotToday));
    // the paper of the next morning tells of it
    let next = WorldTime(until).day().max(day + 1);
    let stories = core.driver_stories(day + 1);
    assert!(stories.iter().any(|s| s.headline == "Місцевий водій провів ніч у відділку" && s.section == "Кримінальна хроніка"), "{stories:?}");
    let _ = next;
    let paper = core.paper_view(at(day + 1, 8 * 60));
    assert!(std::iter::once(&paper.headline).chain(paper.stories.iter()).any(|s| s.title == "Місцевий водій провів ніч у відділку"));
}

#[test]
fn without_a_licence_the_police_take_one_straight_to_the_cell() {
    let mut core = world(5000);
    go(&mut core, at(MON, TEN), "sto_in");
    core.apply_all(at(MON, TEN), Command::BuyCar { car: "lastivka".into() }).unwrap();
    go(&mut core, at(MON, 20 * 60), "village");
    core.apply_all(at(MON, 20 * 60), Command::StartDrive { exam: false }).unwrap();
    let ev = core.apply_all(at(MON, 20 * 60 + 2), Command::Violation { kind: "no_licence".into(), cells: 80, x: 20, y: 26 }).unwrap();
    assert!(ev.iter().any(|e| matches!(&e.kind, EventKind::Arrested { kind, .. } if kind == "no_licence")));
    // arrested in the evening: out at seven in the morning
    assert_eq!(core.state().drive.jailed_until, Some((MON + 1) * MINUTES_PER_DAY + 7 * 60));
    // the fine was paid there and then
    assert_eq!(core.state().drive.fines_due, 0);
}

#[test]
fn a_fine_seen_is_paid_on_the_spot_and_punches_the_coupon() {
    let mut core = world(5000);
    let day = licensed(&mut core);
    go(&mut core, at(day, TEN + 20), "sto_in");
    core.apply_all(at(day, TEN + 20), Command::BuyCar { car: "poltava".into() }).unwrap();
    go(&mut core, at(day, TEN + 21), "village");
    let mut t = TEN + 22;
    let mut seen = false;
    for _ in 0..30 {
        core.apply_all(at(day, t), Command::StartDrive { exam: false }).unwrap();
        let before = core.wallet().coins;
        let ev = core.apply_all(at(day, t + 1), Command::Violation { kind: "speeding".into(), cells: 30, x: 20, y: 26 }).unwrap();
        t += 2;
        core.apply_all(at(day, t), Command::Park { cells: 30, x: 20, y: 26, rot: 0 }).unwrap();
        if let EventKind::Violated { seen: true, fine, paid, holes, .. } = &ev[0].kind {
            assert!(*paid);
            assert_eq!(*holes, 1);
            assert_eq!(before - core.wallet().coins, u64::from(*fine));
            seen = true;
            break;
        }
        // nobody saw: nothing paid, nothing punched
        assert_eq!(core.state().drive.holes_on(day), 0);
    }
    assert!(seen);
    assert_eq!(core.state().drive.holes_on(day), 1);
    assert_eq!(core.state().drive.fines_due, 0);
    let v = core.drive_view(at(day, t)).unwrap();
    assert_eq!(v.hole_names, vec!["перевищення швидкості".to_string()]);
    // a hole is forgiven after a season
    assert_eq!(core.state().drive.holes_on(day + 120), 0);
}

#[test]
fn money_on_the_road_is_where_the_core_says_and_only_once() {
    let content = base(300);
    // over a month some days have something, most have nothing, and the same seed gives the same
    let days: Vec<u64> = (0..30).filter(|d| !road_coins(7, &content, "village", *d).is_empty()).collect();
    assert!(!days.is_empty() && days.len() < 25, "{days:?}");
    assert_eq!(road_coins(7, &content, "village", 3), road_coins(7, &content, "village", 3));
    assert!(road_coins(7, &content, "home", 3).is_empty());
    let mut core = world(300);
    let day = days.into_iter().find(|d| *d > 0).unwrap();
    let coin = road_coins(7, &content, "village", day)[0].clone();
    assert!(coin.coins >= 1 && coin.coins <= 50);
    // not from home, not a made-up spot
    assert_eq!(core.apply_all(at(day, TEN), Command::PickCoin { x: coin.x, y: coin.y }).err(), Some(CoreError::NothingThere));
    go(&mut core, at(day, TEN), "village");
    assert_eq!(core.apply_all(at(day, TEN), Command::PickCoin { x: coin.x + 1, y: coin.y + 1 }).err().is_some(), true);
    let before = core.wallet().coins;
    core.apply_all(at(day, TEN), Command::PickCoin { x: coin.x, y: coin.y }).unwrap();
    assert_eq!(core.wallet().coins, before + u64::from(coin.coins));
    assert_eq!(core.apply_all(at(day, TEN + 1), Command::PickCoin { x: coin.x, y: coin.y }).err(), Some(CoreError::NothingThere));
    assert!(!core.drive_view(at(day, TEN + 1)).unwrap().coins.iter().any(|c| c.index == coin.index));
    // the next day the same spot has nothing (unless the dice say so again)
    let next = road_coins(7, &content, "village", day + 1);
    if !next.iter().any(|c| c.x == coin.x && c.y == coin.y) {
        assert_eq!(core.apply_all(at(day + 1, TEN), Command::PickCoin { x: coin.x, y: coin.y }).err(), Some(CoreError::NothingThere));
    }
}

#[test]
fn the_road_replays_the_same_from_the_log() {
    let mut core = world(5000);
    let day = licensed(&mut core);
    go(&mut core, at(day, TEN + 20), "sto_in");
    core.apply_all(at(day, TEN + 20), Command::BuyCar { car: "dnipro".into() }).unwrap();
    go(&mut core, at(day, TEN + 21), "village");
    core.apply_all(at(day, TEN + 21), Command::StartDrive { exam: false }).unwrap();
    let _ = core.apply_all(at(day, TEN + 22), Command::Violation { kind: "speeding".into(), cells: 100, x: 30, y: 26 });
    if core.state().drive.trip.is_some() {
        core.apply_all(at(day, TEN + 24), Command::Park { cells: 300, x: 30, y: 26, rot: 1 }).unwrap();
    }
    let before = core.state().drive.clone();
    let content = core.content().clone();
    let storage = core.into_storage();
    let again = Core::open_with(storage, 1, content).unwrap();
    assert_eq!(again.state().drive, before);
    assert_eq!(again.integrity().tampered, 0);
}

#[test]
fn a_car_can_be_bought_from_the_list_away_from_the_garage() {
    let mut core = world(5000);
    // still in the town, nowhere near the service station: the car is bought and waits at its forecourt
    core.apply_all(at(MON, TEN), Command::BuyCar { car: "lastivka".into() }).unwrap();
    assert_eq!(core.state().owned.get("car_keys"), Some(&1));
    assert!(core.drive_view(at(MON, TEN)).unwrap().car.is_some());
}
