mod common;
use std::sync::Arc;
use teul_core::core::{Command, Core, NewWorld};
use teul_core::storage::MemoryStorage;
use teul_core::time::WorldTime;
use teul_core::unlock::Missing;
use teul_core::view::ShopStatus;

fn core() -> Core<MemoryStorage> {
    Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 1, epoch_unix_secs: 0 }, Arc::new(common::content())).unwrap()
}

#[test]
fn the_room_view_lists_cells_styles_and_resolved_colors() {
    let mut c = core();
    let now = WorldTime(10);
    c.apply_all(now, Command::Acquire { item: "sofa".into() }).unwrap();
    c.apply_all(now, Command::Place { item: "sofa".into(), x: 0, y: 0, rot: 0, wall: None, on: None }).unwrap();
    let v = c.room_view();
    assert_eq!(v.cells.len(), 36);
    assert_eq!(v.styles["floor"], "floor.oak");
    assert_eq!(v.style_params["floor"]["color"], "#c28f5c");
    assert_eq!(v.placements.len(), 1);
    assert_eq!(v.placements[0].colors["body"], "#3f8c94");
    assert!(v.placements[0].known);
    c.apply_all(now, Command::Recolor { pid: 0, slot: "body".into(), color: "#e8a23a".into() }).unwrap();
    assert_eq!(c.room_view().placements[0].colors["body"], "#e8a23a");
}

#[test]
fn the_shop_shows_status_and_the_reason_for_locks() {
    let c = core();
    let shop = c.shop_view(WorldTime(10));
    let lamp = shop.iter().find(|e| e.id == "gold_lamp").unwrap();
    assert_eq!(lamp.status, ShopStatus::Locked { missing: vec![Missing::Coins { have: 0, need: 50 }] });
    let sofa = shop.iter().find(|e| e.id == "sofa").unwrap();
    assert!(matches!(sofa.status, ShopStatus::Available { .. }));
    let oak = shop.iter().find(|e| e.id == "floor.oak").unwrap();
    assert_eq!(oak.status, ShopStatus::Owned, "start styles are owned from the beginning");
    assert!(shop.iter().any(|e| e.id == "exp.1"));
}

#[test]
fn the_inventory_counts_owned_placed_and_free_and_flags_unknown_items() {
    let mut c = core();
    let now = WorldTime(10);
    c.apply_all(now, Command::Acquire { item: "plant".into() }).unwrap();
    c.apply_all(now, Command::Acquire { item: "plant".into() }).unwrap();
    c.apply_all(now, Command::Place { item: "plant".into(), x: 0, y: 0, rot: 0, wall: None, on: None }).unwrap();
    let inv = c.inventory_view();
    let plant = inv.iter().find(|e| e.item == "plant").unwrap();
    assert_eq!((plant.owned, plant.placed, plant.free), (2, 1, 1));
    assert!(plant.known);
}

#[test]
fn an_unknown_placed_item_is_flagged_not_dropped() {
    use teul_core::event::{Event, EventId, EventKind};
    use teul_core::storage::Storage;
    let mut storage = core().into_storage();
    let mk = |seq, kind| Event { id: EventId { device: 9, seq }, time: WorldTime(1), rules_version: 2, kind, chain: 0 };
    storage.append(&mk(0, EventKind::ItemAcquired { item: "ghost".into() })).unwrap();
    storage.append(&mk(1, EventKind::Placed { pid: 0, item: "ghost".into(), x: 1, y: 1, rot: 0, wall: None, on: None })).unwrap();
    let c = Core::open_with(storage, 1, Arc::new(common::content())).unwrap();
    let room = c.room_view();
    assert_eq!(room.placements.len(), 1);
    assert!(!room.placements[0].known);
    assert!(room.placements[0].colors.is_empty());
    assert!(!c.inventory_view().iter().find(|e| e.item == "ghost").unwrap().known);
}

#[test]
fn the_wallet_view_matches_the_engine() {
    let c = core();
    let w = c.wallet_view();
    assert_eq!(w.coins, 0);
    assert!(w.tokens.is_empty());
}

#[test]
fn views_serialize_to_json_for_the_shell() {
    let c = core();
    assert!(serde_json::to_string(&c.room_view()).unwrap().contains("\"cells\""));
    let shop = serde_json::to_string(&c.shop_view(WorldTime(1))).unwrap();
    assert!(shop.contains("gold_lamp") && shop.contains("\"state\":\"locked\""), "{shop}");
}
