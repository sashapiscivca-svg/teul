//! Monthly bills by the real calendar: garbage, water, electricity and gas, paid at the utility office.
//! Unpaid after the 10th, the utility is switched off until paid.

mod common;

use std::sync::Arc;

use teul_core::core::{Command, Core, CoreError, NewWorld};
use teul_core::storage::MemoryStorage;
use teul_core::time::{WorldTime, MINUTES_PER_DAY};

fn at(day: u64, minute: u64) -> WorldTime {
    WorldTime(day * MINUTES_PER_DAY + minute)
}

// The world starts on 2026-10-10 (day 0). 1 December is day 52, 10 December day 61, 1 January day 83.
const DEC_1: u64 = 52;
const DEC_10: u64 = 61;
const JAN_1: u64 = 83;
const JAN_10: u64 = 92;

fn world() -> Core<MemoryStorage> {
    let mut core = Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 3, epoch_unix_secs: common::AUTUMN_EPOCH }, Arc::new(common::home())).unwrap();
    for (item, x) in [("tub_h", 1), ("radio_h", 2), ("stove_h", 3), ("fridge_h", 4)] {
        core.apply_all(at(0, 500), Command::Acquire { item: item.into() }).unwrap();
        core.apply_all(at(0, 500), Command::Place { item: item.into(), x, y: 1, rot: 0, wall: None, on: None }).unwrap();
    }
    core
}

fn pid_of(core: &Core<MemoryStorage>, item: &str) -> u32 {
    *core.room_view().placements.iter().find(|p| p.item == item).map(|p| &p.pid).unwrap()
}

#[test]
fn the_first_month_is_free_and_bills_come_on_the_first() {
    let core = world();
    assert!(core.bills_view(at(30, 600)).bills.is_empty(), "no bill for October, the month the world began");
    assert!(core.bills_view(at(DEC_1 - 1, 600)).bills.is_empty(), "November's bills come on 1 December");
    let v = core.bills_view(at(DEC_1, 600));
    assert_eq!(v.bills.len(), 4, "{v:?}");
    let total: u32 = v.bills.iter().map(|b| b.amount).sum();
    assert_eq!(total, 55, "November is not winter: 10 + 15 + 20 + 10");
    assert!(v.bills.iter().all(|b| !b.paid && !b.overdue && b.period == "листопад 2026" && b.due == "10 грудня"));
    // winter months cost more for heating and light
    let jan = core.bills_view(at(JAN_1, 600));
    let dec: u32 = jan.bills.iter().filter(|b| b.period == "грудень 2026").map(|b| b.amount).sum();
    assert_eq!(dec, 85, "December: 10 + 15 + 30 + 30");
}

#[test]
fn an_unpaid_bill_switches_the_utility_off_after_the_due_date() {
    let mut core = world();
    let tub = pid_of(&core, "tub_h");
    let radio = pid_of(&core, "radio_h");
    core.apply_all(at(DEC_10, 600), Command::Perform { action: "rest".into(), pid: Some(tub) }).unwrap();
    assert!(core.utility_on(at(DEC_10, 600), "water"));
    assert!(!core.utility_on(at(DEC_10 + 1, 600), "water"));
    assert_eq!(core.apply_all(at(DEC_10 + 1, 600), Command::Perform { action: "rest".into(), pid: Some(tub) }).err(), Some(CoreError::UtilityOff("water".into())));
    assert_eq!(core.apply_all(at(DEC_10 + 1, 601), Command::Perform { action: "listen".into(), pid: Some(radio) }).err(), Some(CoreError::UtilityOff("power".into())));
    assert!(core.bills_view(at(DEC_10 + 1, 600)).bills.iter().all(|b| b.overdue));
}

#[test]
fn bills_are_paid_at_the_office_in_its_hours_and_the_utility_comes_back() {
    let mut core = world();
    let t = at(DEC_10 + 2, 10 * 60);
    assert_eq!(core.apply_all(t, Command::PayBill { utility: "water".into(), month: None }).err(), Some(CoreError::NotHere));
    core.apply_all(t, Command::Travel { to: "utility_in".into() }).unwrap();
    assert_eq!(core.apply_all(at(DEC_10 + 2, 20 * 60), Command::PayBill { utility: "water".into(), month: None }).err(), Some(CoreError::Closed));
    let coins = core.wallet().coins;
    core.apply_all(t, Command::PayBill { utility: "water".into(), month: None }).unwrap();
    assert_eq!(core.wallet().coins, coins - 15);
    assert!(core.utility_on(t, "water"));
    assert!(!core.utility_on(t, "power"));
    // all the rest at once
    core.apply_all(t, Command::PayAll).unwrap();
    assert_eq!(core.wallet().coins, coins - 55);
    for u in ["garbage", "water", "power", "gas"] {
        assert!(core.utility_on(t, u), "{u}");
    }
    assert!(core.bills_view(t).bills.iter().all(|b| b.paid));
    assert_eq!(core.apply_all(t, Command::PayAll).err(), Some(CoreError::NothingThere));
}

#[test]
fn several_unpaid_months_must_all_be_paid_to_switch_back_on() {
    let mut core = world();
    let t = at(JAN_10 + 1, 10 * 60);
    core.apply_all(t, Command::Travel { to: "utility_in".into() }).unwrap();
    core.apply_all(t, Command::PayBill { utility: "gas".into(), month: None }).unwrap();
    assert!(!core.utility_on(t, "gas"), "only the oldest gas bill was paid");
    core.apply_all(t, Command::PayBill { utility: "gas".into(), month: None }).unwrap();
    assert!(core.utility_on(t, "gas"));
}

#[test]
fn bills_cannot_be_paid_without_the_coins() {
    let content = {
        let home = common::HOME.replace("\"start_coins\": 300", "\"start_coins\": 5");
        teul_core::content::Content::from_packs(&[common::PACK, &home]).unwrap()
    };
    let mut core = Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 3, epoch_unix_secs: common::AUTUMN_EPOCH }, Arc::new(content)).unwrap();
    let t = at(DEC_1 + 1, 10 * 60);
    core.apply_all(t, Command::Travel { to: "utility_in".into() }).unwrap();
    assert!(matches!(core.apply_all(t, Command::PayBill { utility: "water".into(), month: None }).err(), Some(CoreError::Locked(_))));
}

#[test]
fn without_electricity_a_lamp_does_not_switch_on() {
    let mut core = world();
    let radio = pid_of(&core, "radio_h");
    let on = |c: &mut Core<MemoryStorage>, t| c.apply_all(t, Command::SetProp { pid: radio, key: "lit".into(), value: "1".into() });
    on(&mut core, at(DEC_10, 600)).unwrap();
    assert_eq!(on(&mut core, at(DEC_10 + 1, 600)).err(), Some(CoreError::UtilityOff("power".into())));
    // switching off is always possible
    core.apply_all(at(DEC_10 + 1, 601), Command::SetProp { pid: radio, key: "lit".into(), value: "0".into() }).unwrap();
}

#[test]
fn the_morning_paper_reminds_and_tells_when_something_is_off() {
    let core = world();
    let before = core.paper_view(at(DEC_1 + 2, 480));
    assert!(before.asks.iter().any(|l| l.contains("Комунальна контора нагадує") && l.contains("10 грудня")), "{:?}", before.asks);
    let after = core.paper_view(at(DEC_10 + 1, 480));
    assert!(after.asks.iter().any(|l| l.contains("вимкнено")), "{:?}", after.asks);
    assert!(after.asks.iter().any(|l| l.contains("Сусіди скаржаться")), "{:?}", after.asks);
}
