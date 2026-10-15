use teul_core::event::{Event, EventId, EventKind};
use teul_core::room::WallSide;
use teul_core::state::DeltaState;
use teul_core::time::WorldTime;

fn ev(seq: u64, kind: EventKind) -> Event {
    Event { id: EventId { device: 1, seq }, time: WorldTime(seq), rules_version: 2, kind, chain: 0 }
}

fn fold(kinds: Vec<EventKind>) -> DeltaState {
    let mut s = DeltaState::default();
    for (i, k) in kinds.into_iter().enumerate() {
        s.apply(&ev(i as u64, k));
    }
    s
}

#[test]
fn acquiring_and_placing_tracks_ownership_and_the_room() {
    let s = fold(vec![
        EventKind::ItemAcquired { item: "sofa".into() },
        EventKind::ItemAcquired { item: "sofa".into() },
        EventKind::Placed { pid: 0, item: "sofa".into(), x: 1, y: 2, rot: 0, wall: None, on: None },
    ]);
    assert_eq!(s.owned["sofa"], 2);
    assert_eq!(s.room.placements.len(), 1);
    assert_eq!(s.room.next_pid, 1, "next_pid follows the highest placed pid");
    assert_eq!(s.room.placements[&0].x, 1);
}

#[test]
fn move_rotate_recolor_store_update_the_placement() {
    let s = fold(vec![
        EventKind::Placed { pid: 0, item: "painting".into(), x: 0, y: 1, rot: 0, wall: Some(WallSide::West), on: None },
        EventKind::Moved { pid: 0, x: 0, y: 3, wall: Some(WallSide::West), on: None },
        EventKind::Rotated { pid: 0, rot: 2 },
        EventKind::Recolored { pid: 0, slot: "body".into(), color: "#d9534f".into() },
    ]);
    let p = &s.room.placements[&0];
    assert_eq!((p.y, p.rot), (3, 2));
    assert_eq!(p.colors["body"], "#d9534f");
    let s = fold(vec![
        EventKind::Placed { pid: 0, item: "sofa".into(), x: 0, y: 0, rot: 0, wall: None, on: None },
        EventKind::Stored { pid: 0 },
    ]);
    assert!(s.room.placements.is_empty());
    assert_eq!(s.room.next_pid, 1, "pids are never reused");
}

#[test]
fn money_and_counters_are_folded() {
    let s = fold(vec![
        EventKind::CoinsEarned { amount: 30 },
        EventKind::CoinsEarned { amount: 30 },
        EventKind::CoinsSpent { amount: 50 },
        EventKind::TokenGranted { kind: "leaf".into(), n: 3 },
        EventKind::TokenSpent { kind: "leaf".into(), n: 2 },
        EventKind::ActionPerformed { action: "water".into(), pid: Some(0), day: 4, rewarded: true },
        EventKind::ActionPerformed { action: "water".into(), pid: Some(0), day: 4, rewarded: true },
        EventKind::ActionPerformed { action: "water".into(), pid: Some(0), day: 4, rewarded: false },
        EventKind::ActionPerformed { action: "water".into(), pid: Some(0), day: 5, rewarded: true },
    ]);
    assert_eq!((s.earned, s.spent), (60, 50));
    assert_eq!(s.tokens["leaf"], 1);
    assert_eq!(s.counters["water"], 4);
    assert_eq!(s.reward_days["water"], (5, 1), "the day rolled over, the rewarded count restarted");
}

#[test]
fn styles_expansions_and_owned_styles_are_folded() {
    let s = fold(vec![
        EventKind::StyleAcquired { style: "floor.stone".into() },
        EventKind::StyleSet { kind: "floor".into(), style: "floor.stone".into() },
        EventKind::RoomExpanded { expansion: "exp.1".into() },
    ]);
    assert!(s.room.owned_styles.contains("floor.stone"));
    assert_eq!(s.room.styles["floor"], "floor.stone");
    assert!(s.room.expansions.contains("exp.1"));
}

#[test]
fn events_for_pids_that_do_not_exist_are_ignored_not_fatal() {
    let s = fold(vec![EventKind::Moved { pid: 9, x: 1, y: 1, wall: None, on: None }, EventKind::Stored { pid: 9 }]);
    assert!(s.room.placements.is_empty());
}

#[test]
fn new_event_kinds_round_trip_through_json() {
    let kinds = vec![
        EventKind::Placed { pid: 3, item: "sofa".into(), x: 1, y: 2, rot: 1, wall: None, on: Some(2) },
        EventKind::ActionPerformed { action: "sit".into(), pid: None, day: 9, rewarded: false },
        EventKind::TokenGranted { kind: "leaf".into(), n: 1 },
    ];
    for k in kinds {
        let json = teul_core::event::encode_kind(&k);
        assert_eq!(teul_core::event::decode_kind(teul_core::event::EVENT_SCHEMA, &json), Ok(k));
    }
}

#[test]
fn an_old_snapshot_without_room_fields_still_loads() {
    let old = r#"{"player_name":"Орися","events_applied":3}"#;
    let s: DeltaState = serde_json::from_str(old).unwrap();
    assert_eq!(s.player_name.as_deref(), Some("Орися"));
    assert!(s.room.placements.is_empty());
}
