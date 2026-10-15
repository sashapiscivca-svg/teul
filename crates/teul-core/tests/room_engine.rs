mod common;
use std::sync::Arc;
use teul_core::core::{Command, Core, CoreError, NewWorld};
use teul_core::event::EventKind;
use teul_core::room::PlaceError;
use teul_core::storage::MemoryStorage;
use teul_core::time::{WorldTime, MINUTES_PER_DAY};
use teul_core::unlock::Missing;

fn new_core() -> Core<MemoryStorage> {
    Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 1, epoch_unix_secs: 0 }, Arc::new(common::content())).unwrap()
}

fn t(day: u64, minute: u64) -> WorldTime {
    WorldTime(day * MINUTES_PER_DAY + minute)
}

fn acquire(c: &mut Core<MemoryStorage>, now: WorldTime, item: &str) {
    c.apply_all(now, Command::Acquire { item: item.into() }).unwrap();
}

fn place(c: &mut Core<MemoryStorage>, now: WorldTime, item: &str, x: i32, y: i32) -> u32 {
    let ev = c.apply_all(now, Command::Place { item: item.into(), x, y, rot: 0, wall: None, on: None }).unwrap();
    match ev[0].kind {
        EventKind::Placed { pid, .. } => pid,
        ref k => panic!("{k:?}"),
    }
}

#[test]
fn free_items_are_acquired_and_placed() {
    let mut c = new_core();
    acquire(&mut c, t(0, 1), "sofa");
    assert_eq!(c.free_count("sofa"), 1);
    let pid = place(&mut c, t(0, 2), "sofa", 0, 0);
    assert_eq!(c.free_count("sofa"), 0);
    assert_eq!(c.state().room.placements[&pid].item, "sofa");
}

#[test]
fn you_cannot_place_what_you_do_not_own_more_than_you_own() {
    let mut c = new_core();
    assert_eq!(
        c.apply_all(t(0, 1), Command::Place { item: "sofa".into(), x: 0, y: 0, rot: 0, wall: None, on: None }),
        Err(CoreError::NotOwned("sofa".into()))
    );
    acquire(&mut c, t(0, 2), "plant");
    place(&mut c, t(0, 3), "plant", 0, 0);
    assert_eq!(
        c.apply_all(t(0, 4), Command::Place { item: "plant".into(), x: 1, y: 0, rot: 0, wall: None, on: None }),
        Err(CoreError::NotOwned("plant".into()))
    );
}

#[test]
fn an_invalid_placement_is_reported_and_leaves_no_event() {
    let mut c = new_core();
    acquire(&mut c, t(0, 1), "sofa");
    let before = c.state().events_applied;
    assert_eq!(
        c.apply_all(t(0, 2), Command::Place { item: "sofa".into(), x: 5, y: 0, rot: 0, wall: None, on: None }),
        Err(CoreError::Place(PlaceError::OutOfBounds))
    );
    assert_eq!(c.state().events_applied, before);
}

#[test]
fn storing_returns_the_item_without_loss_and_pids_are_not_reused() {
    let mut c = new_core();
    acquire(&mut c, t(0, 1), "sofa");
    let first = place(&mut c, t(0, 2), "sofa", 0, 0);
    c.apply_all(t(0, 3), Command::Store { pid: first }).unwrap();
    assert_eq!(c.free_count("sofa"), 1);
    let second = place(&mut c, t(0, 4), "sofa", 0, 0);
    assert_ne!(first, second);
}

#[test]
fn a_host_with_items_on_it_cannot_be_moved_or_stored() {
    let mut c = new_core();
    acquire(&mut c, t(0, 1), "table");
    acquire(&mut c, t(0, 1), "cup");
    let table = place(&mut c, t(0, 2), "table", 1, 1);
    c.apply_all(t(0, 3), Command::Place { item: "cup".into(), x: 1, y: 1, rot: 0, wall: None, on: Some(table) }).unwrap();
    assert_eq!(c.apply_all(t(0, 4), Command::Store { pid: table }), Err(CoreError::Place(PlaceError::HostHasItems)));
    assert_eq!(
        c.apply_all(t(0, 4), Command::Move { pid: table, x: 3, y: 3, wall: None, on: None }),
        Err(CoreError::Place(PlaceError::HostHasItems))
    );
    assert!(c.state().room.placements.contains_key(&table));
}

#[test]
fn rotate_and_recolor_follow_the_rules() {
    let mut c = new_core();
    acquire(&mut c, t(0, 1), "sofa");
    let pid = place(&mut c, t(0, 2), "sofa", 3, 0);
    c.apply_all(t(0, 3), Command::Rotate { pid, rot: 1 }).unwrap();
    assert_eq!(c.state().room.placements[&pid].rot, 1);
    assert_eq!(c.apply_all(t(0, 4), Command::Rotate { pid, rot: 9 }), Err(CoreError::Place(PlaceError::BadRotation)));

    c.apply_all(t(0, 5), Command::Move { pid, x: 3, y: 5, wall: None, on: None }).unwrap_err();
    c.apply_all(t(0, 5), Command::Rotate { pid, rot: 0 }).unwrap();
    c.apply_all(t(0, 6), Command::Move { pid, x: 3, y: 5, wall: None, on: None }).unwrap();
    assert_eq!(
        c.apply_all(t(0, 7), Command::Rotate { pid, rot: 1 }),
        Err(CoreError::Place(PlaceError::OutOfBounds)),
        "rotating at the edge would stick out"
    );

    c.apply_all(t(0, 8), Command::Recolor { pid, slot: "body".into(), color: "#d9534f".into() }).unwrap();
    assert_eq!(c.state().room.placements[&pid].colors["body"], "#d9534f");
    assert_eq!(c.apply_all(t(0, 9), Command::Recolor { pid, slot: "body".into(), color: "red".into() }), Err(CoreError::InvalidColor));
    assert_eq!(c.apply_all(t(0, 9), Command::Recolor { pid, slot: "legs".into(), color: "#d9534f".into() }), Err(CoreError::InvalidSlot));
}

#[test]
fn buying_without_enough_coins_reports_what_is_missing_and_changes_nothing() {
    let mut c = new_core();
    let before = c.state().events_applied;
    assert_eq!(
        c.apply_all(t(0, 1), Command::Acquire { item: "gold_lamp".into() }),
        Err(CoreError::Locked(vec![Missing::Coins { have: 0, need: 50 }]))
    );
    assert_eq!(c.state().events_applied, before);
    assert_eq!(c.apply_all(t(0, 1), Command::Acquire { item: "ghost".into() }), Err(CoreError::UnknownItem("ghost".into())));
}

fn water_n(c: &mut Core<MemoryStorage>, day: u64, pid: u32, n: u64) {
    for i in 0..n {
        c.apply_all(t(day, 10 + i), Command::Perform { action: "water".into(), pid: Some(pid) }).unwrap();
    }
}

fn plant(c: &mut Core<MemoryStorage>) -> u32 {
    acquire(c, t(0, 1), "plant");
    place(c, t(0, 2), "plant", 0, 0)
}

#[test]
fn rewards_respect_the_per_day_cap_and_reset_with_the_world_day() {
    let mut c = new_core();
    let pid = plant(&mut c);
    water_n(&mut c, 0, pid, 3);
    assert_eq!(c.wallet().coins, 60, "cap is 2 rewarded waterings per day");
    assert_eq!(c.wallet().counters["water"], 3, "the third one still counts as an action");
    water_n(&mut c, 1, pid, 1);
    assert_eq!(c.wallet().coins, 90, "a new world day starts the cap again");
}

#[test]
fn coins_buy_items_atomically() {
    let mut c = new_core();
    let pid = plant(&mut c);
    water_n(&mut c, 0, pid, 2);
    c.apply_all(t(0, 50), Command::Acquire { item: "gold_lamp".into() }).unwrap();
    assert_eq!(c.wallet().coins, 10);
    assert_eq!(c.state().owned["gold_lamp"], 1);
}

#[test]
fn an_action_gate_unlocks_an_item_without_spending_the_counter() {
    let mut c = new_core();
    let pid = plant(&mut c);
    assert!(matches!(c.apply_all(t(0, 5), Command::Acquire { item: "vase".into() }), Err(CoreError::Locked(_))));
    water_n(&mut c, 0, pid, 3);
    c.apply_all(t(0, 60), Command::Acquire { item: "vase".into() }).unwrap();
    assert_eq!(c.wallet().counters["water"], 3);
    c.apply_all(t(0, 61), Command::Acquire { item: "vase".into() }).unwrap();
    assert_eq!(c.state().owned["vase"], 2, "the gate stays open");
}

#[test]
fn tokens_and_coins_can_be_a_combined_price() {
    let mut c = new_core();
    let pid = plant(&mut c);
    acquire(&mut c, t(0, 3), "sofa");
    let sofa = place(&mut c, t(0, 4), "sofa", 0, 3);
    water_n(&mut c, 0, pid, 1);
    c.apply_all(t(0, 20), Command::Perform { action: "sit".into(), pid: Some(sofa) }).unwrap();
    assert_eq!(c.wallet().tokens["leaf"], 1);
    c.apply_all(t(0, 21), Command::Perform { action: "sit".into(), pid: Some(sofa) }).unwrap();
    assert_eq!(c.wallet().tokens["leaf"], 1, "the sit reward is capped at one per day");
    c.apply_all(t(1, 20), Command::Perform { action: "sit".into(), pid: Some(sofa) }).unwrap();
    assert_eq!(c.wallet().tokens["leaf"], 2);
    c.apply_all(t(1, 30), Command::Acquire { item: "rare_clock".into() }).unwrap();
    let w = c.wallet();
    assert_eq!((w.coins, w.tokens["leaf"]), (20, 0));
}

#[test]
fn expansion_costs_coins_and_grows_the_room_once() {
    let mut c = new_core();
    let pid = plant(&mut c);
    water_n(&mut c, 0, pid, 2);
    water_n(&mut c, 1, pid, 2);
    c.apply_all(t(1, 100), Command::Expand { expansion: "exp.1".into() }).unwrap();
    assert_eq!(c.wallet().coins, 20);
    assert_eq!(c.apply_all(t(1, 101), Command::Expand { expansion: "exp.1".into() }), Err(CoreError::AlreadyExpanded));
    acquire(&mut c, t(1, 102), "sofa");
    assert_eq!(
        c.apply_all(t(1, 103), Command::Place { item: "sofa".into(), x: 5, y: 0, rot: 0, wall: None, on: None }),
        Err(CoreError::Place(PlaceError::OutOfBounds)),
        "the expansion only raises the budget"
    );
    let add: Vec<(i32, i32)> = (0..6).flat_map(|y| [(6, y), (7, y)]).collect();
    c.apply_all(t(1, 104), Command::PaintCells { add, remove: vec![] }).unwrap();
    c.apply_all(t(1, 105), Command::Place { item: "sofa".into(), x: 5, y: 0, rot: 0, wall: None, on: None }).unwrap();
    assert_eq!(c.apply_all(t(1, 106), Command::Expand { expansion: "ghost".into() }), Err(CoreError::UnknownExpansion("ghost".into())));
}

#[test]
fn styles_must_be_owned_before_they_are_used() {
    let mut c = new_core();
    assert_eq!(
        c.apply_all(t(0, 1), Command::SetStyle { kind: "floor".into(), style: "floor.stone".into() }),
        Err(CoreError::StyleNotOwned)
    );
    c.apply_all(t(0, 2), Command::SetStyle { kind: "floor".into(), style: "floor.oak".into() }).unwrap();
    assert!(matches!(c.apply_all(t(0, 3), Command::AcquireStyle { style: "floor.stone".into() }), Err(CoreError::Locked(_))));
    assert_eq!(c.apply_all(t(0, 4), Command::AcquireStyle { style: "floor.oak".into() }), Err(CoreError::AlreadyOwned));
    assert_eq!(
        c.apply_all(t(0, 5), Command::SetStyle { kind: "wall".into(), style: "floor.oak".into() }),
        Err(CoreError::UnknownStyle("floor.oak".into())),
        "a style of the wrong kind is refused"
    );
}

#[test]
fn perform_validates_its_target() {
    let mut c = new_core();
    let pid = plant(&mut c);
    assert_eq!(c.apply_all(t(0, 5), Command::Perform { action: "fly".into(), pid: None }), Err(CoreError::UnknownAction("fly".into())));
    assert_eq!(c.apply_all(t(0, 5), Command::Perform { action: "water".into(), pid: Some(99) }), Err(CoreError::UnknownPlacement(99)));
    assert_eq!(c.apply_all(t(0, 5), Command::Perform { action: "sit".into(), pid: Some(pid) }), Err(CoreError::ActionNotAvailable));
}

#[test]
fn state_survives_reopening_with_the_same_content() {
    let mut c = new_core();
    let pid = plant(&mut c);
    water_n(&mut c, 0, pid, 2);
    c.apply_all(t(0, 90), Command::Acquire { item: "gold_lamp".into() }).unwrap();
    let live = c.state().clone();
    let reopened = Core::open_with(c.into_storage(), 1, Arc::new(common::content())).unwrap();
    assert_eq!(reopened.state(), &live);
}

#[test]
fn unknown_items_in_the_log_do_not_break_opening() {
    use teul_core::event::{Event, EventId};
    use teul_core::storage::Storage;
    let c = new_core();
    let mut storage = c.into_storage();
    storage
        .append(&Event {
            id: EventId { device: 9, seq: 0 },
            time: t(0, 1),
            rules_version: 2,
            kind: EventKind::ItemAcquired { item: "ghost".into() },
            chain: 0,
        })
        .unwrap();
    let c = Core::open_with(storage, 1, Arc::new(common::content())).unwrap();
    assert_eq!(c.state().owned["ghost"], 1);
}

#[test]
fn random_play_never_breaks_the_invariants_and_replays_identically() {
    use teul_core::rng::{rand_below, Domain};
    let mut c = new_core();
    let items = ["sofa", "table", "cup", "plant", "gold_lamp", "vase", "rare_clock", "ghost"];
    let mut minute = 0u64;
    for step in 0..400u64 {
        minute += 1 + rand_below(7, Domain(1), 0, step, 30);
        let now = WorldTime(minute);
        let pick = |n: u64, salt: u64| rand_below(7, Domain(2), salt, step, n);
        let item = items[pick(items.len() as u64, 1) as usize].to_string();
        let pids: Vec<u32> = c.state().room.placements.keys().copied().collect();
        let some_pid = pids.get(pick(pids.len().max(1) as u64, 2) as usize).copied();
        let cmd = match pick(8, 3) {
            0 => Command::Acquire { item },
            1 => Command::Place { item, x: pick(8, 4) as i32 - 1, y: pick(8, 5) as i32 - 1, rot: pick(5, 6) as u8, wall: None, on: some_pid },
            2 => Command::Move { pid: some_pid.unwrap_or(0), x: pick(7, 4) as i32, y: pick(7, 5) as i32, wall: None, on: None },
            3 => Command::Rotate { pid: some_pid.unwrap_or(0), rot: pick(4, 6) as u8 },
            4 => Command::Store { pid: some_pid.unwrap_or(0) },
            5 => Command::Perform { action: if pick(2, 7) == 0 { "water".into() } else { "sit".into() }, pid: some_pid },
            6 => Command::Expand { expansion: "exp.1".into() },
            _ => Command::Recolor { pid: some_pid.unwrap_or(0), slot: "body".into(), color: "#d9534f".into() },
        };
        let _ = c.apply_all(now, cmd);
        let s = c.state();
        assert!(s.spent <= u64::from(common::content().start_coins) + s.earned, "coins went negative at step {step}");
        for p in s.room.placements.values() {
            assert!(s.owned.get(&p.item).copied().unwrap_or(0) >= 1, "placed an item that is not owned");
        }
    }
    let live = c.state().clone();
    let reopened = Core::open_with(c.into_storage(), 1, Arc::new(common::content())).unwrap();
    assert_eq!(reopened.state(), &live, "replaying the log reproduces the live state");
}

#[test]
fn check_gives_the_same_verdict_as_apply_without_changing_anything() {
    let mut c = new_core();
    let before = c.state().events_applied;
    assert_eq!(
        c.check(t(0, 1), Command::Acquire { item: "gold_lamp".into() }),
        Err(CoreError::Locked(vec![Missing::Coins { have: 0, need: 50 }]))
    );
    assert!(c.check(t(0, 1), Command::Acquire { item: "sofa".into() }).is_ok());
    assert_eq!(c.state().events_applied, before, "check never writes");
    assert_eq!(c.free_count("sofa"), 0);
    acquire(&mut c, t(0, 5), "sofa");
    assert!(matches!(c.check(t(0, 2), Command::Acquire { item: "sofa".into() }), Err(CoreError::ClockWentBackwards { .. })));
    assert_eq!(
        c.check(t(0, 6), Command::Place { item: "sofa".into(), x: 5, y: 0, rot: 0, wall: None, on: None }),
        Err(CoreError::Place(PlaceError::OutOfBounds))
    );
}
