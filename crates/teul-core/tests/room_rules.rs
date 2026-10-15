mod common;
use teul_core::content::Content;
use teul_core::room::{self, PlaceError, Placement, PlacementSpec, RoomState, WallSide};

fn spec(item: &str, x: i32, y: i32, rot: u8) -> PlacementSpec {
    PlacementSpec { item: item.into(), x, y, rot, wall: None, on: None }
}

fn put(state: &mut RoomState, item: &str, x: i32, y: i32, rot: u8, wall: Option<WallSide>, on: Option<u32>) -> u32 {
    let pid = state.next_pid;
    state.next_pid += 1;
    state.placements.insert(pid, Placement { pid, item: item.into(), x, y, rot, wall, on, colors: Default::default(), props: Default::default() });
    pid
}

fn setup() -> (Content, RoomState) {
    (common::content(), RoomState::default())
}

#[test]
fn the_start_room_is_the_declared_rectangle() {
    let (c, s) = setup();
    let cells = room::cells(&c, &s);
    assert_eq!(cells.len(), 36);
    assert!(cells.contains(&(0, 0)) && cells.contains(&(5, 5)) && !cells.contains(&(6, 0)));
}

#[test]
fn expansions_raise_the_area_budget_not_the_cells() {
    let (c, mut s) = setup();
    assert_eq!(room::area_budget(&c, &s), 36);
    s.expansions.insert("exp.1".into());
    assert_eq!(room::area_budget(&c, &s), 48);
    assert_eq!(room::cells(&c, &s).len(), 36, "the player decides where the new floor goes");
}

#[test]
fn rotation_swaps_the_footprint() {
    let c = common::content();
    assert_eq!(room::footprint(&c.items["sofa"], 0), (3, 1));
    assert_eq!(room::footprint(&c.items["sofa"], 1), (1, 3));
    assert_eq!(room::footprint(&c.items["sofa"], 2), (3, 1));
    assert_eq!(room::footprint(&c.items["sofa"], 3), (1, 3));
}

#[test]
fn a_floor_item_must_fit_inside_the_room() {
    let (c, s) = setup();
    assert!(room::validate(&c, &s, &spec("sofa", 3, 0, 0), None).is_ok());
    assert_eq!(room::validate(&c, &s, &spec("sofa", 4, 0, 0), None), Err(PlaceError::OutOfBounds));
    assert_eq!(room::validate(&c, &s, &spec("sofa", -1, 0, 0), None), Err(PlaceError::OutOfBounds));
    assert_eq!(room::validate(&c, &s, &spec("sofa", 0, 4, 1), None), Err(PlaceError::OutOfBounds), "rotated 1x3 at y=4 sticks out");
    assert!(room::validate(&c, &s, &spec("sofa", 0, 3, 1), None).is_ok());
}

#[test]
fn bad_rotation_and_unknown_items_are_refused() {
    let (c, s) = setup();
    assert_eq!(room::validate(&c, &s, &spec("sofa", 0, 0, 4), None), Err(PlaceError::BadRotation));
    assert_eq!(room::validate(&c, &s, &spec("ghost", 0, 0, 0), None), Err(PlaceError::UnknownItem));
}

#[test]
fn floor_items_cannot_overlap_but_can_touch() {
    let (c, mut s) = setup();
    put(&mut s, "sofa", 0, 0, 0, None, None);
    assert_eq!(room::validate(&c, &s, &spec("plant", 2, 0, 0), None), Err(PlaceError::Overlap));
    assert!(room::validate(&c, &s, &spec("plant", 3, 0, 0), None).is_ok());
    assert!(room::validate(&c, &s, &spec("plant", 0, 1, 0), None).is_ok());
}

#[test]
fn moving_an_item_may_overlap_its_own_old_position() {
    let (c, mut s) = setup();
    let pid = put(&mut s, "sofa", 0, 0, 0, None, None);
    assert!(room::validate(&c, &s, &spec("sofa", 1, 0, 0), Some(pid)).is_ok());
    assert_eq!(room::validate(&c, &s, &spec("sofa", 1, 0, 0), None), Err(PlaceError::Overlap));
}

#[test]
fn wall_items_need_a_wall_and_a_free_stretch_of_it() {
    let (c, mut s) = setup();
    let mut p = spec("painting", 0, 1, 0);
    assert_eq!(room::validate(&c, &s, &p, None), Err(PlaceError::NeedsWall));
    p.wall = Some(WallSide::West);
    assert!(room::validate(&c, &s, &p, None).is_ok());
    put(&mut s, "painting", 0, 1, 0, Some(WallSide::West), None);
    assert_eq!(room::validate(&c, &s, &p, None), Err(PlaceError::WallOccupied));
    p.y = 3;
    assert!(room::validate(&c, &s, &p, None).is_ok());
    let mut other_wall = spec("painting", 1, 0, 0);
    other_wall.wall = Some(WallSide::North);
    assert!(room::validate(&c, &s, &other_wall, None).is_ok(), "the other wall is independent");
}

#[test]
fn wall_items_must_stay_within_the_wall() {
    let (c, s) = setup();
    let mut p = spec("painting", 0, 5, 0);
    p.wall = Some(WallSide::West);
    assert_eq!(room::validate(&c, &s, &p, None), Err(PlaceError::OutOfBounds), "2-wide painting at y=5 passes the corner");
    let mut floor_with_wall = spec("sofa", 0, 0, 0);
    floor_with_wall.wall = Some(WallSide::West);
    assert_eq!(room::validate(&c, &s, &floor_with_wall, None), Err(PlaceError::NotAWallItem));
}

#[test]
fn only_surface_items_may_name_a_host() {
    let (c, s) = setup();
    let mut p = spec("plant", 0, 0, 0);
    p.on = Some(0);
    assert_eq!(room::validate(&c, &s, &p, None), Err(PlaceError::NotASurfaceItem));
}

#[test]
fn surface_items_need_a_surface_host_and_a_free_spot_on_it() {
    let (c, mut s) = setup();
    let table = put(&mut s, "table", 1, 1, 0, None, None);
    let sofa = put(&mut s, "sofa", 0, 5, 0, None, None);
    let mut cup = spec("cup", 1, 1, 0);
    assert_eq!(room::validate(&c, &s, &cup, None), Err(PlaceError::NeedsHost));
    cup.on = Some(99);
    assert_eq!(room::validate(&c, &s, &cup, None), Err(PlaceError::HostMissing));
    cup.on = Some(sofa);
    assert_eq!(room::validate(&c, &s, &cup, None), Err(PlaceError::HostNotSurface));
    cup.on = Some(table);
    assert!(room::validate(&c, &s, &cup, None).is_ok());
    cup.x = 3;
    assert_eq!(room::validate(&c, &s, &cup, None), Err(PlaceError::OutsideHost));
    cup.x = 1;
    put(&mut s, "cup", 1, 1, 0, None, Some(table));
    assert_eq!(room::validate(&c, &s, &cup, None), Err(PlaceError::SurfaceOccupied));
    cup.x = 2;
    assert!(room::validate(&c, &s, &cup, None).is_ok(), "the table is 2x2: another spot is free");
}

#[test]
fn children_are_listed_for_a_host() {
    let (_, mut s) = setup();
    let table = put(&mut s, "table", 1, 1, 0, None, None);
    let cup = put(&mut s, "cup", 1, 1, 0, None, Some(table));
    assert_eq!(room::children_of(&s, table), vec![cup]);
    assert!(room::children_of(&s, cup).is_empty());
}

#[test]
fn rugs_lie_under_furniture_and_only_collide_with_other_rugs() {
    let (c, mut s) = setup();
    assert!(room::validate(&c, &s, &spec("rug", 0, 0, 0), None).is_ok());
    put(&mut s, "rug", 0, 0, 0, None, None);
    assert!(room::validate(&c, &s, &spec("sofa", 0, 0, 0), None).is_ok(), "furniture stands on a rug");
    assert_eq!(room::validate(&c, &s, &spec("rug", 1, 1, 0), None), Err(PlaceError::Overlap));
    assert!(room::validate(&c, &s, &spec("rug", 2, 0, 0), None).is_ok());
    assert_eq!(room::validate(&c, &s, &spec("rug", 5, 5, 0), None), Err(PlaceError::OutOfBounds));
    put(&mut s, "sofa", 3, 3, 0, None, None);
    assert!(room::validate(&c, &s, &spec("rug", 3, 3, 0), None).is_ok(), "a rug may go under existing furniture");
    let mut wall = spec("rug", 0, 0, 0);
    wall.wall = Some(WallSide::West);
    assert_eq!(room::validate(&c, &s, &wall, None), Err(PlaceError::NotAWallItem));
}

#[test]
fn walls_stand_on_every_boundary_edge_and_on_dividers() {
    let (c, mut s) = setup();
    let cells = room::cells(&c, &s);
    assert!(room::is_wall_edge(&cells, &s.dividers, 0, 0, WallSide::North));
    assert!(room::is_wall_edge(&cells, &s.dividers, 0, 0, WallSide::West));
    assert!(room::is_wall_edge(&cells, &s.dividers, 5, 5, WallSide::South));
    assert!(room::is_wall_edge(&cells, &s.dividers, 5, 5, WallSide::East));
    assert!(!room::is_wall_edge(&cells, &s.dividers, 2, 2, WallSide::East), "an interior edge is open");
    s.dividers.insert(room::divider_key(2, 2, WallSide::East));
    assert!(room::is_wall_edge(&cells, &s.dividers, 2, 2, WallSide::East));
    assert!(room::is_wall_edge(&cells, &s.dividers, 3, 2, WallSide::West), "both faces of a divider are walls");
    assert!(!room::is_wall_edge(&cells, &s.dividers, 9, 9, WallSide::North), "outside the room there is nothing");
}

#[test]
fn wall_items_hang_on_any_side_of_the_room() {
    let (c, s) = setup();
    for (side, x, y) in [(WallSide::North, 1, 0), (WallSide::West, 0, 1), (WallSide::South, 1, 5), (WallSide::East, 5, 1)] {
        let mut p = spec("painting", x, y, 0);
        p.wall = Some(side);
        assert!(room::validate(&c, &s, &p, None).is_ok(), "{side:?}");
    }
    let mut inner = spec("painting", 2, 2, 0);
    inner.wall = Some(WallSide::North);
    assert_eq!(room::validate(&c, &s, &inner, None), Err(PlaceError::NoWallThere), "an interior edge has no wall");
}

#[test]
fn a_divider_gives_wall_items_a_place_inside_the_room() {
    let (c, mut s) = setup();
    let mut p = spec("painting", 2, 2, 0);
    p.wall = Some(WallSide::East);
    assert_eq!(room::validate(&c, &s, &p, None), Err(PlaceError::NoWallThere));
    s.dividers.insert(room::divider_key(2, 2, WallSide::East));
    assert_eq!(room::validate(&c, &s, &p, None), Err(PlaceError::NoWallThere), "a 2-wide item needs 2 cells of divider");
    s.dividers.insert(room::divider_key(2, 3, WallSide::East));
    assert!(room::validate(&c, &s, &p, None).is_ok());
    let mut other_face = spec("painting", 3, 2, 0);
    other_face.wall = Some(WallSide::West);
    assert!(room::validate(&c, &s, &other_face, None).is_ok(), "the far face of the divider is a separate wall");
}

#[test]
fn wall_items_cannot_overlap_on_any_side() {
    let (c, mut s) = setup();
    put(&mut s, "painting", 1, 5, 0, Some(WallSide::South), None);
    let mut p = spec("painting", 2, 5, 0);
    p.wall = Some(WallSide::South);
    assert_eq!(room::validate(&c, &s, &p, None), Err(PlaceError::WallOccupied));
    p.x = 3;
    assert!(room::validate(&c, &s, &p, None).is_ok());
}

#[test]
fn a_wall_item_must_fit_along_the_wall() {
    let (c, s) = setup();
    let mut p = spec("painting", 5, 0, 0);
    p.wall = Some(WallSide::North);
    assert_eq!(room::validate(&c, &s, &p, None), Err(PlaceError::OutOfBounds), "2-wide painting at x=5 sticks past the corner");
}
