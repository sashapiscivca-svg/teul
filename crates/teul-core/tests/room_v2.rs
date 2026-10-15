mod common;
use std::sync::Arc;
use teul_core::core::{Command, Core, CoreError, NewWorld};
use teul_core::event::EventKind;
use teul_core::room::{PlaceError, RoomError, WallSide};
use teul_core::storage::MemoryStorage;
use teul_core::time::{WorldTime, MINUTES_PER_DAY};

type C = Core<MemoryStorage>;

fn core() -> C {
    Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 1, epoch_unix_secs: 0 }, Arc::new(common::content())).unwrap()
}

/// Every call advances the clock so commands never go backwards.
struct Clock(u64);
impl Clock {
    fn next(&mut self) -> WorldTime {
        self.0 += 1;
        WorldTime(self.0)
    }
}

fn acquire(c: &mut C, k: &mut Clock, item: &str) {
    c.apply_all(k.next(), Command::Acquire { item: item.into() }).unwrap();
}

fn place(c: &mut C, k: &mut Clock, item: &str, x: i32, y: i32, wall: Option<WallSide>) -> u32 {
    acquire(c, k, item);
    let ev = c.apply_all(k.next(), Command::Place { item: item.into(), x, y, rot: 0, wall, on: None }).unwrap();
    match ev[0].kind {
        EventKind::Placed { pid, .. } => pid,
        ref other => panic!("{other:?}"),
    }
}

/// Gives the player coins by playing several world days (the test pack pays 30 coins per watering, twice a day).
fn rich(c: &mut C, k: &mut Clock) {
    let plant = place(c, k, "plant", 0, 0, None);
    for day in 1..=8u64 {
        for i in 0..2 {
            k.0 = day * MINUTES_PER_DAY + i;
            c.apply_all(WorldTime(k.0), Command::Perform { action: "water".into(), pid: Some(plant) }).unwrap();
        }
    }
    c.apply_all(k.next(), Command::Store { pid: plant }).unwrap();
}

fn cells(list: &[(i32, i32)]) -> Vec<(i32, i32)> {
    list.to_vec()
}

#[test]
fn the_floor_plan_stays_within_the_area_budget() {
    let mut c = core();
    let mut k = Clock(0);
    let r = c.apply_all(k.next(), Command::PaintCells { add: cells(&[(6, 0)]), remove: vec![] });
    assert_eq!(r, Err(CoreError::Room(RoomError::TooManyCells)), "36 cells fill the budget of 36");
    // Moving a cell elsewhere keeps the count.
    c.apply_all(k.next(), Command::PaintCells { add: cells(&[(6, 0)]), remove: cells(&[(5, 5)]) }).unwrap();
    let room = c.room_view();
    assert!(room.cells.contains(&(6, 0)) && !room.cells.contains(&(5, 5)));
    assert_eq!((room.area_used, room.area_budget), (36, 36));
}

#[test]
fn floor_is_bought_cell_by_cell_while_building() {
    let mut c = core();
    let mut k = Clock(0);
    assert!(matches!(c.apply_all(k.next(), Command::BuyArea { cells: 2 }), Err(CoreError::Locked(_))), "no coins, no floor");
    rich(&mut c, &mut k);
    let coins = c.wallet().coins;
    c.apply_all(k.next(), Command::BuyArea { cells: 2 }).unwrap();
    assert_eq!(c.wallet().coins, coins - 10, "5 coins a cell");
    assert_eq!(c.room_view().area_budget, 38);
    c.apply_all(k.next(), Command::PaintCells { add: cells(&[(6, 0), (6, 1)]), remove: vec![] }).unwrap();
    assert_eq!(c.room_view().area_used, 38);
    assert_eq!(c.apply_all(k.next(), Command::BuyArea { cells: 0 }), Err(CoreError::Room(RoomError::TooManyCells)));
    assert_eq!(c.apply_all(k.next(), Command::BuyArea { cells: 2000 }), Err(CoreError::Room(RoomError::TooManyCells)), "never past the grid");
}

#[test]
fn parts_of_the_home_have_names_and_kinds() {
    let mut c = core();
    let mut k = Clock(0);
    let set = |c: &mut C, k: &mut Clock, key: &str, value: &str| c.apply_all(k.next(), Command::SetSetting { key: key.into(), value: value.into() });
    set(&mut c, &mut k, "room.3_4.name", "Підвал Ейча").unwrap();
    set(&mut c, &mut k, "room.3_4.kind", "lounge").unwrap();
    set(&mut c, &mut k, "home.name", "Хата скраю").unwrap();
    assert_eq!(c.room_view().settings.get("room.3_4.name").map(String::as_str), Some("Підвал Ейча"));
    assert!(set(&mut c, &mut k, "room.3_4.kind", "dungeon").is_err());
    assert!(set(&mut c, &mut k, "room.40_4.name", "x").is_err(), "outside the grid");
    assert!(set(&mut c, &mut k, "room.+3_4.name", "x").is_err());
    assert!(set(&mut c, &mut k, "room.3_4.name", &"я".repeat(33)).is_err());
    assert!(set(&mut c, &mut k, "room.3_4.name", " край").is_err());
    set(&mut c, &mut k, "room.3_4.name", "").unwrap();
    assert!(!c.room_view().settings.contains_key("room.3_4.name"));
}

#[test]
fn buying_an_expansion_lets_the_room_grow() {
    let mut c = core();
    let mut k = Clock(0);
    rich(&mut c, &mut k);
    c.apply_all(k.next(), Command::Expand { expansion: "exp.1".into() }).unwrap();
    assert_eq!(c.room_view().area_budget, 48);
    let add: Vec<(i32, i32)> = (0..6).flat_map(|y| [(6, y), (7, y)]).collect();
    c.apply_all(k.next(), Command::PaintCells { add, remove: vec![] }).unwrap();
    assert_eq!(c.room_view().area_used, 48);
    assert_eq!(
        c.apply_all(k.next(), Command::PaintCells { add: cells(&[(8, 0)]), remove: vec![] }),
        Err(CoreError::Room(RoomError::TooManyCells))
    );
}

#[test]
fn the_floor_plan_must_stay_in_one_piece_inside_the_buildable_area() {
    let mut c = core();
    let mut k = Clock(0);
    let split: Vec<(i32, i32)> = (0..6).map(|y| (3, y)).collect();
    assert_eq!(
        c.apply_all(k.next(), Command::PaintCells { add: vec![], remove: split }),
        Err(CoreError::Room(RoomError::Disconnected)),
        "cutting a column in two would split the room"
    );
    let everything: Vec<(i32, i32)> = (0..6).flat_map(|x| (0..6).map(move |y| (x, y))).collect();
    assert_eq!(c.apply_all(k.next(), Command::PaintCells { add: vec![], remove: everything }), Err(CoreError::Room(RoomError::Empty)));
    assert_eq!(
        c.apply_all(k.next(), Command::PaintCells { add: cells(&[(-1, 0)]), remove: cells(&[(5, 5)]) }),
        Err(CoreError::Room(RoomError::OutOfRange))
    );
    assert_eq!(
        c.apply_all(k.next(), Command::PaintCells { add: cells(&[(32, 0)]), remove: cells(&[(5, 5)]) }),
        Err(CoreError::Room(RoomError::OutOfRange))
    );
}

#[test]
fn a_cell_with_furniture_cannot_be_removed() {
    let mut c = core();
    let mut k = Clock(0);
    place(&mut c, &mut k, "plant", 5, 5, None);
    assert_eq!(
        c.apply_all(k.next(), Command::PaintCells { add: vec![], remove: cells(&[(5, 5)]) }),
        Err(CoreError::Room(RoomError::CellOccupied))
    );
    place(&mut c, &mut k, "rug", 0, 0, None);
    assert_eq!(
        c.apply_all(k.next(), Command::PaintCells { add: vec![], remove: cells(&[(1, 1)]) }),
        Err(CoreError::Room(RoomError::CellOccupied)),
        "a rug counts too"
    );
}

#[test]
fn growing_or_shrinking_cannot_strand_a_wall_item() {
    let mut c = core();
    let mut k = Clock(0);
    place(&mut c, &mut k, "painting", 2, 5, Some(WallSide::South));
    assert_eq!(
        c.apply_all(k.next(), Command::PaintCells { add: vec![], remove: cells(&[(2, 5)]) }),
        Err(CoreError::Room(RoomError::WallItemAttached)),
        "the painting hangs on that cell's south wall"
    );
    // Floor added below the painting would turn its wall into open space.
    let r = c.apply_all(k.next(), Command::PaintCells { add: cells(&[(2, 6)]), remove: cells(&[(0, 0)]) });
    assert_eq!(r, Err(CoreError::Room(RoomError::WallItemAttached)));
}

#[test]
fn dividers_split_the_room_with_walls_that_hold_items() {
    let mut c = core();
    let mut k = Clock(0);
    c.apply_all(k.next(), Command::SetDivider { x: 2, y: 2, side: WallSide::East, on: true }).unwrap();
    c.apply_all(k.next(), Command::SetDivider { x: 2, y: 3, side: WallSide::East, on: true }).unwrap();
    assert_eq!(c.room_view().dividers.len(), 2);
    let pid = place(&mut c, &mut k, "painting", 2, 2, Some(WallSide::East));
    assert_eq!(
        c.apply_all(k.next(), Command::SetDivider { x: 2, y: 2, side: WallSide::East, on: false }),
        Err(CoreError::Room(RoomError::DividerBusy)),
        "a painting hangs on it"
    );
    c.apply_all(k.next(), Command::Store { pid }).unwrap();
    c.apply_all(k.next(), Command::SetDivider { x: 2, y: 2, side: WallSide::East, on: false }).unwrap();
    assert_eq!(c.room_view().dividers.len(), 1);
}

#[test]
fn a_divider_needs_two_cells_and_the_same_wall_is_one_divider_from_either_side() {
    let mut c = core();
    let mut k = Clock(0);
    assert_eq!(
        c.apply_all(k.next(), Command::SetDivider { x: 5, y: 5, side: WallSide::East, on: true }),
        Err(CoreError::Room(RoomError::NotInRoom))
    );
    c.apply_all(k.next(), Command::SetDivider { x: 3, y: 1, side: WallSide::West, on: true }).unwrap();
    c.apply_all(k.next(), Command::SetDivider { x: 2, y: 1, side: WallSide::East, on: true }).unwrap();
    assert_eq!(c.room_view().dividers, vec![(2, 1, WallSide::East)], "both calls name the same wall");
}

#[test]
fn erasing_a_cell_takes_its_dividers_with_it() {
    let mut c = core();
    let mut k = Clock(0);
    c.apply_all(k.next(), Command::SetDivider { x: 4, y: 5, side: WallSide::East, on: true }).unwrap();
    c.apply_all(k.next(), Command::PaintCells { add: vec![], remove: cells(&[(5, 5)]) }).unwrap();
    assert!(c.room_view().dividers.is_empty());
}

#[test]
fn floor_and_walls_are_painted_with_owned_styles_only() {
    let mut c = core();
    let mut k = Clock(0);
    assert_eq!(
        c.apply_all(k.next(), Command::PaintFloor { cells: cells(&[(0, 0)]), style: Some("floor.stone".into()) }),
        Err(CoreError::StyleNotOwned)
    );
    c.apply_all(k.next(), Command::PaintFloor { cells: cells(&[(0, 0), (1, 0)]), style: Some("floor.oak".into()) }).unwrap();
    assert_eq!(c.room_view().floor_paint["0,0"], "floor.oak");
    assert_eq!(
        c.apply_all(k.next(), Command::PaintFloor { cells: cells(&[(9, 9)]), style: Some("floor.oak".into()) }),
        Err(CoreError::Room(RoomError::NotInRoom))
    );
    assert_eq!(
        c.apply_all(k.next(), Command::PaintFloor { cells: cells(&[(0, 0)]), style: Some("wall.plum".into()) }),
        Err(CoreError::UnknownStyle("wall.plum".into())),
        "a wall style is not a floor"
    );
    c.apply_all(k.next(), Command::PaintFloor { cells: cells(&[(0, 0)]), style: None }).unwrap();
    assert!(!c.room_view().floor_paint.contains_key("0,0"));

    c.apply_all(k.next(), Command::PaintWall { edges: vec![(0, 0, WallSide::North), (1, 0, WallSide::North)], style: Some("wall.plum".into()) }).unwrap();
    assert_eq!(c.room_view().wall_paint["0,0,n"], "wall.plum");
    assert_eq!(
        c.apply_all(k.next(), Command::PaintWall { edges: vec![(2, 2, WallSide::North)], style: Some("wall.plum".into()) }),
        Err(CoreError::Room(RoomError::NotAWall)),
        "an interior edge is not a wall"
    );
}

#[test]
fn item_props_are_validated_and_clearable() {
    let mut c = core();
    let mut k = Clock(0);
    let sofa = place(&mut c, &mut k, "sofa", 0, 0, None);
    let set = |c: &mut C, k: &mut Clock, key: &str, value: &str| c.apply_all(k.next(), Command::SetProp { pid: sofa, key: key.into(), value: value.into() });
    assert!(set(&mut c, &mut k, "mirror", "1").is_ok());
    assert!(set(&mut c, &mut k, "nudge_x", "-30").is_ok());
    assert!(set(&mut c, &mut k, "light_color", "#ffaa00").is_ok());
    assert!(set(&mut c, &mut k, "light_strength", "80").is_ok());
    assert!(set(&mut c, &mut k, "finish.body", "gloss").is_ok());
    assert_eq!(set(&mut c, &mut k, "mirror", "2"), Err(CoreError::InvalidProp));
    assert_eq!(set(&mut c, &mut k, "nudge_x", "51"), Err(CoreError::InvalidProp));
    assert_eq!(set(&mut c, &mut k, "light_color", "yellow"), Err(CoreError::InvalidProp));
    assert_eq!(set(&mut c, &mut k, "finish.body", "lava"), Err(CoreError::InvalidProp), "unknown material");
    assert_eq!(set(&mut c, &mut k, "finish.legs", "gloss"), Err(CoreError::InvalidProp), "unknown slot");
    assert_eq!(set(&mut c, &mut k, "secret", "1"), Err(CoreError::InvalidProp), "only known keys");
    let p = &c.room_view().placements[0];
    assert_eq!(p.props["mirror"], "1");
    assert_eq!(p.props["finish.body"], "gloss");
    assert!(set(&mut c, &mut k, "mirror", "").is_ok());
    assert!(!c.room_view().placements[0].props.contains_key("mirror"), "an empty value clears the prop");
    assert_eq!(
        c.apply_all(k.next(), Command::SetProp { pid: 99, key: "mirror".into(), value: "1".into() }),
        Err(CoreError::UnknownPlacement(99))
    );
}

#[test]
fn any_hex_colour_is_allowed_on_a_slot() {
    let mut c = core();
    let mut k = Clock(0);
    let sofa = place(&mut c, &mut k, "sofa", 0, 0, None);
    c.apply_all(k.next(), Command::Recolor { pid: sofa, slot: "body".into(), color: "#A1B2C3".into() }).unwrap();
    assert_eq!(c.room_view().placements[0].colors["body"], "#a1b2c3", "stored in lower case");
    for bad in ["#12345", "123456", "#gggggg", "", "#1234567"] {
        assert_eq!(c.apply_all(k.next(), Command::Recolor { pid: sofa, slot: "body".into(), color: bad.into() }), Err(CoreError::InvalidColor), "{bad}");
    }
}

#[test]
fn room_settings_are_validated() {
    let mut c = core();
    let mut k = Clock(0);
    let set = |c: &mut C, k: &mut Clock, key: &str, value: &str| c.apply_all(k.next(), Command::SetSetting { key: key.into(), value: value.into() });
    for (key, value) in [
        ("time_mode", "fixed"),
        ("time_fixed", "21:30"),
        ("ambient_color", "#334466"),
        ("ambient_strength", "40"),
        ("shadows", "0"),
        ("wall_mode", "cut"),
        ("look.hair_color", "#aa5500"),
        ("look.height", "60"),
        ("look.cat_color", "#e8e0c8"),
    ] {
        assert!(set(&mut c, &mut k, key, value).is_ok(), "{key}={value}");
    }
    for (key, value) in [
        ("time_mode", "sometimes"),
        ("time_fixed", "25:00"),
        ("time_fixed", "9:5"),
        ("ambient_color", "blue"),
        ("ambient_strength", "101"),
        ("shadows", "yes"),
        ("wall_mode", "none"),
        ("look.cat_color", "brown"),
        ("look.height", "200"),
        ("unknown", "1"),
        ("look.", "1"),
    ] {
        assert_eq!(set(&mut c, &mut k, key, value), Err(CoreError::InvalidSetting), "{key}={value}");
    }
    // once the hero has a look (here the hair colour set above), clothes, hair and body are not set freely:
    // clothes come from the wardrobe, hair from the salon (tests/style.rs)
    for key in ["look.top2_color", "look.hair_color", "look.skin_color"] {
        assert_eq!(set(&mut c, &mut k, key, "#e8e0c8"), Err(CoreError::LookFixed), "{key}");
    }
    assert_eq!(c.room_view().settings["wall_mode"], "cut");
    assert!(set(&mut c, &mut k, "ambient_color", "").is_ok());
    assert!(!c.room_view().settings.contains_key("ambient_color"));
}

#[test]
fn a_theme_is_bought_then_applied() {
    let mut c = core();
    let mut k = Clock(0);
    assert_eq!(c.apply_all(k.next(), Command::ApplyTheme { theme: "theme.cozy".into() }), Err(CoreError::StyleNotOwned));
    assert!(matches!(c.apply_all(k.next(), Command::AcquireTheme { theme: "theme.cozy".into() }), Err(CoreError::Locked(_))));
    rich(&mut c, &mut k);
    c.apply_all(k.next(), Command::AcquireTheme { theme: "theme.cozy".into() }).unwrap();
    assert_eq!(c.apply_all(k.next(), Command::AcquireTheme { theme: "theme.cozy".into() }), Err(CoreError::AlreadyOwned));
    c.apply_all(k.next(), Command::ApplyTheme { theme: "theme.cozy".into() }).unwrap();
    let room = c.room_view();
    assert_eq!(room.styles["floor"], "floor.stone", "the theme's floor style is now owned and chosen");
    assert_eq!(room.settings["ambient_color"], "#ffd9a0");
    assert_eq!(c.apply_all(k.next(), Command::ApplyTheme { theme: "nope".into() }), Err(CoreError::UnknownTheme("nope".into())));
}

#[test]
fn a_unique_item_can_only_be_owned_once() {
    let mut c = core();
    let mut k = Clock(0);
    acquire(&mut c, &mut k, "portal");
    assert_eq!(c.apply_all(k.next(), Command::Acquire { item: "portal".into() }), Err(CoreError::AlreadyOwned));
}

#[test]
fn wall_items_use_any_side_through_the_engine() {
    let mut c = core();
    let mut k = Clock(0);
    place(&mut c, &mut k, "painting", 1, 0, Some(WallSide::North));
    acquire(&mut c, &mut k, "painting");
    assert_eq!(
        c.apply_all(k.next(), Command::Place { item: "painting".into(), x: 2, y: 2, rot: 0, wall: Some(WallSide::North), on: None }),
        Err(CoreError::Place(PlaceError::NoWallThere))
    );
    c.apply_all(k.next(), Command::Place { item: "painting".into(), x: 0, y: 1, rot: 0, wall: Some(WallSide::West), on: None }).unwrap();
}

#[test]
fn the_whole_customised_room_replays_identically() {
    let mut c = core();
    let mut k = Clock(0);
    rich(&mut c, &mut k);
    let sofa = place(&mut c, &mut k, "sofa", 1, 1, None);
    c.apply_all(k.next(), Command::Recolor { pid: sofa, slot: "body".into(), color: "#112233".into() }).unwrap();
    c.apply_all(k.next(), Command::SetProp { pid: sofa, key: "finish.body".into(), value: "stripes".into() }).unwrap();
    c.apply_all(k.next(), Command::SetDivider { x: 3, y: 3, side: WallSide::South, on: true }).unwrap();
    c.apply_all(k.next(), Command::PaintFloor { cells: cells(&[(0, 0), (1, 1)]), style: Some("floor.oak".into()) }).unwrap();
    c.apply_all(k.next(), Command::PaintWall { edges: vec![(0, 0, WallSide::West)], style: Some("wall.plum".into()) }).unwrap();
    c.apply_all(k.next(), Command::SetSetting { key: "ambient_strength".into(), value: "70".into() }).unwrap();
    c.apply_all(k.next(), Command::PaintCells { add: cells(&[(6, 2)]), remove: cells(&[(5, 5)]) }).unwrap();
    c.apply_all(k.next(), Command::AcquireTheme { theme: "theme.cozy".into() }).unwrap();
    c.apply_all(k.next(), Command::ApplyTheme { theme: "theme.cozy".into() }).unwrap();
    let live = c.state().clone();
    let view = serde_json::to_string(&c.room_view()).unwrap();
    let reopened = Core::open_with(c.into_storage(), 1, Arc::new(common::content())).unwrap();
    assert_eq!(reopened.state(), &live);
    assert_eq!(serde_json::to_string(&reopened.room_view()).unwrap(), view);
}

#[test]
fn state_snapshots_with_the_new_fields_round_trip_through_json() {
    let mut c = core();
    let mut k = Clock(0);
    c.apply_all(k.next(), Command::SetDivider { x: 1, y: 1, side: WallSide::East, on: true }).unwrap();
    c.apply_all(k.next(), Command::PaintFloor { cells: cells(&[(0, 0)]), style: Some("floor.oak".into()) }).unwrap();
    let json = serde_json::to_string(c.state()).unwrap();
    let back: teul_core::state::DeltaState = serde_json::from_str(&json).unwrap();
    assert_eq!(&back, c.state());
}

#[test]
fn empty_paint_and_shape_commands_are_refused() {
    use teul_core::core::Command;
    let mut c = core();
    let now = teul_core::time::WorldTime(10);
    assert!(c.apply_all(now, Command::PaintCells { add: vec![], remove: vec![] }).is_err());
    assert!(c.apply_all(now, Command::PaintFloor { cells: vec![], style: None }).is_err());
    assert!(c.apply_all(now, Command::PaintWall { edges: vec![], style: None }).is_err());
}

#[test]
fn look_settings_are_bounded_in_number_and_name_length() {
    use teul_core::core::Command;
    let mut c = core();
    // a few a minute (more than 40 commands in one world minute is a bot)
    for i in 0..teul_core::core::MAX_LOOK_KEYS {
        let key = format!("look.k{}", "a".repeat(i % 20 + 1));
        let key = format!("{key}{}", ["x", "y", "z"][i / 20]);
        c.apply_all(teul_core::time::WorldTime(10 + i as u64), Command::SetSetting { key, value: "5".into() }).unwrap();
    }
    let now = teul_core::time::WorldTime(100);
    assert!(c.apply_all(now, Command::SetSetting { key: "look.another".into(), value: "5".into() }).is_err());
    assert!(c.apply_all(now, Command::SetSetting { key: format!("look.{}", "q".repeat(60)), value: "5".into() }).is_err());
}
