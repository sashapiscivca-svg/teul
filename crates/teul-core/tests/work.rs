//! Shifts at the town's places (docs/world-economy.md §10): one is taken on at the place first (a word with
//! whoever runs it); then shifts are taken there, in its hours, once a day; each task is the world's (seeded),
//! answered not faster than a person; paid by the town at the end.

mod common;

use std::sync::Arc;

use teul_core::core::{Command, Core, CoreError, NewWorld};
use teul_core::event::EventKind;
use teul_core::storage::MemoryStorage;
use teul_core::time::{WorldTime, MINUTES_PER_DAY};

fn at(day: u64, minute: u64) -> WorldTime {
    WorldTime(day * MINUTES_PER_DAY + minute)
}

fn world() -> Core<MemoryStorage> {
    Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 7, epoch_unix_secs: common::AUTUMN_EPOCH }, Arc::new(common::work())).unwrap()
}

fn go(core: &mut Core<MemoryStorage>, t: WorldTime, to: &str) {
    core.apply_all(t, Command::Travel { to: to.into() }).unwrap();
}

fn hire(core: &mut Core<MemoryStorage>, t: WorldTime) {
    core.apply_all(t, Command::TakeJob { work: "work.cafe".into() }).unwrap();
}

fn start(core: &mut Core<MemoryStorage>, t: WorldTime) -> Result<Vec<teul_core::event::Event>, CoreError> {
    core.apply_all(t, Command::StartShift { work: "work.cafe".into() })
}

/// The right answer to the task asked now (what the client shows).
fn right(core: &Core<MemoryStorage>, t: WorldTime) -> u32 {
    let s = core.shift_view(t).expect("a shift is going");
    s.options.iter().position(|o| *o == s.asks).unwrap() as u32
}

#[test]
fn a_shift_is_taken_at_the_place_in_its_hours() {
    let mut core = world();
    assert_eq!(start(&mut core, at(0, 6 * 60)).err(), Some(CoreError::NotHere));
    go(&mut core, at(0, 6 * 60), "cafe_in");
    hire(&mut core, at(0, 6 * 60));
    // before opening
    assert_eq!(start(&mut core, at(0, 7 * 60)).err(), Some(CoreError::Closed));
    // too near closing for a shift
    let mut late = world();
    go(&mut late, at(0, 17 * 60), "cafe_in");
    hire(&mut late, at(0, 17 * 60));
    assert_eq!(start(&mut late, at(0, 17 * 60 + 40)).err(), Some(CoreError::Closed));
    let events = start(&mut core, at(0, 9 * 60 + 1)).unwrap();
    assert!(events.iter().any(|e| matches!(&e.kind, EventKind::ShiftStarted { work, .. } if work == "work.cafe")));
    // one shift at a time
    assert_eq!(start(&mut core, at(0, 9 * 60 + 2)).err(), Some(CoreError::AlreadyDone));
}

#[test]
fn tasks_come_at_a_person_s_pace_and_are_paid_by_the_town_at_the_end() {
    let mut core = world();
    go(&mut core, at(0, 9 * 60), "cafe_in");
    hire(&mut core, at(0, 9 * 60));
    start(&mut core, at(0, 9 * 60 + 1)).unwrap();
    let coins = core.wallet().coins;
    let mut t = 9 * 60 + 1;
    for step in 0..4 {
        t += 2;
        if step == 1 {
            // too soon after the last one: the next guest is not in yet
            assert_eq!(core.apply_all(at(0, t - 1), Command::WorkStep { choice: right(&core, at(0, t - 1)) }).err(), Some(CoreError::TooSoon));
        }
        let choice = right(&core, at(0, t));
        let ev = core.apply_all(at(0, t), Command::WorkStep { choice }).unwrap();
        assert!(ev.iter().any(|e| matches!(&e.kind, EventKind::WorkDone { right: true, .. })), "step {step}");
    }
    let ev = core.apply_all(at(0, t + 1), Command::EndShift).unwrap();
    // 4 right × 5, and 5 more as thanks for the whole shift
    assert!(ev.iter().any(|e| matches!(&e.kind, EventKind::ShiftEnded { pay: 25, full: true, right: 4, .. })), "{ev:?}");
    assert_eq!(core.wallet().coins, coins + 25);
    // once a day per place
    assert_eq!(start(&mut core, at(0, t + 5)).err(), Some(CoreError::AlreadyDone));
    // tomorrow again; the place remembers
    let w = core.works_view(at(1, 9 * 60)).into_iter().find(|w| w.id == "work.cafe").unwrap();
    assert_eq!((w.shifts, w.whole), (1, 1));
}

#[test]
fn a_wrong_answer_earns_nothing_and_leaving_early_pays_what_was_done() {
    let mut core = world();
    go(&mut core, at(0, 9 * 60), "cafe_in");
    hire(&mut core, at(0, 9 * 60));
    start(&mut core, at(0, 9 * 60)).unwrap();
    let good = right(&core, at(0, 9 * 60 + 2));
    core.apply_all(at(0, 9 * 60 + 2), Command::WorkStep { choice: good }).unwrap();
    let bad = (right(&core, at(0, 9 * 60 + 4)) + 1) % 3;
    let ev = core.apply_all(at(0, 9 * 60 + 4), Command::WorkStep { choice: bad }).unwrap();
    assert!(ev.iter().any(|e| matches!(&e.kind, EventKind::WorkDone { right: false, .. })));
    let ev = core.apply_all(at(0, 9 * 60 + 5), Command::EndShift).unwrap();
    assert!(ev.iter().any(|e| matches!(&e.kind, EventKind::ShiftEnded { pay: 5, full: false, .. })), "{ev:?}");
}

#[test]
fn walking_away_ends_the_shift() {
    let mut core = world();
    go(&mut core, at(0, 9 * 60), "cafe_in");
    hire(&mut core, at(0, 9 * 60));
    start(&mut core, at(0, 9 * 60)).unwrap();
    let c = right(&core, at(0, 9 * 60 + 2));
    core.apply_all(at(0, 9 * 60 + 2), Command::WorkStep { choice: c }).unwrap();
    let ev = core.apply_all(at(0, 9 * 60 + 3), Command::Travel { to: "bazaar".into() }).unwrap();
    assert!(ev.iter().any(|e| matches!(&e.kind, EventKind::ShiftEnded { pay: 5, .. })), "{ev:?}");
    assert!(core.shift_view(at(0, 9 * 60 + 4)).is_none());
    assert_eq!(core.apply_all(at(0, 9 * 60 + 6), Command::WorkStep { choice: 0 }).err(), Some(CoreError::NoShift));
}

#[test]
fn the_tasks_are_the_world_s_and_the_same_everywhere() {
    let asks = |seed| {
        let mut core = Core::create_with(MemoryStorage::new(), 1, NewWorld { seed, epoch_unix_secs: common::AUTUMN_EPOCH }, Arc::new(common::work())).unwrap();
        go(&mut core, at(0, 9 * 60), "cafe_in");
        hire(&mut core, at(0, 9 * 60));
        start(&mut core, at(0, 9 * 60)).unwrap();
        let mut out = Vec::new();
        for i in 0..4u64 {
            let t = at(0, 9 * 60 + 2 + i * 2);
            let s = core.shift_view(t).unwrap();
            out.push(s.asks.clone());
            core.apply_all(t, Command::WorkStep { choice: right(&core, t) }).unwrap();
        }
        out
    };
    assert_eq!(asks(7), asks(7));
    // the day's guests want different things
    let a = asks(7);
    assert!(a.iter().any(|x| *x != a[0]) || asks(8) != a, "{a:?}");
}

#[test]
fn a_shift_left_from_yesterday_does_not_hold_today_back() {
    let mut core = world();
    go(&mut core, at(0, 9 * 60), "cafe_in");
    hire(&mut core, at(0, 9 * 60));
    start(&mut core, at(0, 9 * 60)).unwrap();
    // the next day, a new shift: yesterday's ends by itself first
    let ev = start(&mut core, at(1, 9 * 60)).unwrap();
    assert!(ev.iter().any(|e| matches!(&e.kind, EventKind::ShiftEnded { day: 0, .. })), "{ev:?}");
    assert!(ev.iter().any(|e| matches!(&e.kind, EventKind::ShiftStarted { day: 1, .. })));
}

#[test]
fn one_is_taken_on_at_the_place_before_the_first_shift() {
    let mut core = world();
    // not from across the town
    assert_eq!(core.apply_all(at(0, 9 * 60), Command::TakeJob { work: "work.cafe".into() }).err(), Some(CoreError::NotHere));
    go(&mut core, at(0, 9 * 60), "cafe_in");
    let w = |core: &Core<MemoryStorage>| core.works_view(at(0, 9 * 60 + 1)).into_iter().find(|w| w.id == "work.cafe").unwrap();
    assert!(!w(&core).hired);
    assert_eq!(w(&core).reason.as_deref(), Some("not_hired"));
    assert_eq!(start(&mut core, at(0, 9 * 60)).err(), Some(CoreError::NotHired));
    // taken on at any hour one is there (the boss is in the back), the shift then in the hours
    let ev = core.apply_all(at(0, 9 * 60), Command::TakeJob { work: "work.cafe".into() }).unwrap();
    assert!(ev.iter().any(|e| matches!(&e.kind, EventKind::JobTaken { work } if work == "work.cafe")), "{ev:?}");
    assert!(w(&core).hired);
    assert_eq!(core.apply_all(at(0, 9 * 60), Command::TakeJob { work: "work.cafe".into() }).err(), Some(CoreError::AlreadyDone));
    assert!(start(&mut core, at(0, 9 * 60 + 1)).is_ok());
}

#[test]
fn leaving_a_job_ends_its_shift_and_the_place_still_remembers() {
    let mut core = world();
    go(&mut core, at(0, 9 * 60), "cafe_in");
    hire(&mut core, at(0, 9 * 60));
    start(&mut core, at(0, 9 * 60)).unwrap();
    let c = right(&core, at(0, 9 * 60 + 2));
    core.apply_all(at(0, 9 * 60 + 2), Command::WorkStep { choice: c }).unwrap();
    let ev = core.apply_all(at(0, 9 * 60 + 3), Command::LeaveJob { work: "work.cafe".into() }).unwrap();
    assert!(ev.iter().any(|e| matches!(&e.kind, EventKind::ShiftEnded { pay: 5, .. })), "{ev:?}");
    assert!(ev.iter().any(|e| matches!(&e.kind, EventKind::JobLeft { work } if work == "work.cafe")), "{ev:?}");
    let w = core.works_view(at(1, 9 * 60)).into_iter().find(|w| w.id == "work.cafe").unwrap();
    assert!(!w.hired);
    assert_eq!(w.shifts, 1);
    assert_eq!(start(&mut core, at(1, 9 * 60)).err(), Some(CoreError::NotHired));
    assert_eq!(core.apply_all(at(1, 9 * 60), Command::LeaveJob { work: "work.cafe".into() }).err(), Some(CoreError::NotHired));
    // and back again
    hire(&mut core, at(1, 9 * 60));
    assert!(start(&mut core, at(1, 9 * 60 + 1)).is_ok());
}

#[test]
fn whoever_already_worked_somewhere_before_jobs_were_taken_is_one_of_them() {
    // a record kept from before: shifts, and no word of being taken on
    let old: teul_core::work::WorkRecord = serde_json::from_str(r#"{"shifts":3,"whole":2,"tasks":12,"right":11,"last_day":40}"#).unwrap();
    assert!(old.is_hired());
    let never: teul_core::work::WorkRecord = serde_json::from_str(r#"{"shifts":0,"whole":0,"tasks":0,"right":0,"last_day":null}"#).unwrap();
    assert!(!never.is_hired());
}
