//! Room geometry and placement rules. Pure functions over `Content` and `RoomState`.
//!
//! The room is a set of floor cells. Walls stand on every cell edge that has no neighbouring cell, and on
//! edges where the player placed a divider. Wall items hang on such edges.

use std::collections::{BTreeMap, BTreeSet};
use std::fmt;

use serde::{Deserialize, Serialize};

use crate::content::{Content, ItemDef, Layer};

/// The four sides of a cell. A wall on `North` of cell (x, y) stands on the line y; on `East` on the line x + 1.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WallSide {
    North,
    East,
    South,
    West,
}

impl WallSide {
    pub const ALL: [WallSide; 4] = [WallSide::North, WallSide::East, WallSide::South, WallSide::West];

    /// The neighbouring cell's offset across this side.
    pub fn delta(self) -> (i32, i32) {
        match self {
            WallSide::North => (0, -1),
            WallSide::East => (1, 0),
            WallSide::South => (0, 1),
            WallSide::West => (-1, 0),
        }
    }

    /// The direction a multi-cell wall item extends in.
    pub fn along(self) -> (i32, i32) {
        match self {
            WallSide::North | WallSide::South => (1, 0),
            WallSide::East | WallSide::West => (0, 1),
        }
    }

    pub fn letter(self) -> char {
        match self {
            WallSide::North => 'n',
            WallSide::East => 'e',
            WallSide::South => 's',
            WallSide::West => 'w',
        }
    }

    pub fn from_letter(c: &str) -> Option<WallSide> {
        match c {
            "n" => Some(WallSide::North),
            "e" => Some(WallSide::East),
            "s" => Some(WallSide::South),
            "w" => Some(WallSide::West),
            _ => None,
        }
    }
}

pub fn cell_key(x: i32, y: i32) -> String {
    format!("{x},{y}")
}

pub fn edge_key(x: i32, y: i32, side: WallSide) -> String {
    format!("{x},{y},{}", side.letter())
}

pub fn parse_cell(key: &str) -> Option<(i32, i32)> {
    let (x, y) = key.split_once(',')?;
    Some((x.parse().ok()?, y.parse().ok()?))
}

pub fn parse_edge(key: &str) -> Option<(i32, i32, WallSide)> {
    let mut parts = key.split(',');
    let x = parts.next()?.parse().ok()?;
    let y = parts.next()?.parse().ok()?;
    let side = WallSide::from_letter(parts.next()?)?;
    Some((x, y, side))
}

/// A divider between two cells is stored once, on the east or south side of the cell with the smaller coordinate.
pub fn divider_key(x: i32, y: i32, side: WallSide) -> String {
    match side {
        WallSide::East => edge_key(x, y, WallSide::East),
        WallSide::South => edge_key(x, y, WallSide::South),
        WallSide::West => edge_key(x - 1, y, WallSide::East),
        WallSide::North => edge_key(x, y - 1, WallSide::South),
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Placement {
    pub pid: u32,
    pub item: String,
    pub x: i32,
    pub y: i32,
    pub rot: u8,
    pub wall: Option<WallSide>,
    pub on: Option<u32>,
    pub colors: BTreeMap<String, String>,
    /// Free-form per-item settings (mirror, nudge, light, finish per slot). Validated when set.
    #[serde(default)]
    pub props: BTreeMap<String, String>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct RoomState {
    pub placements: BTreeMap<u32, Placement>,
    pub next_pid: u32,
    /// Expansions bought: each one adds floor area to the budget.
    pub expansions: BTreeSet<String>,
    /// Chosen style per kind (floor, wall, backdrop, weather, outfit.*, pet).
    pub styles: BTreeMap<String, String>,
    pub owned_styles: BTreeSet<String>,
    pub owned_themes: BTreeSet<String>,
    /// Cells added to / removed from the start rectangle, as "x,y".
    pub added: BTreeSet<String>,
    pub removed: BTreeSet<String>,
    /// Dividers between cells, canonical keys from `divider_key`.
    pub dividers: BTreeSet<String>,
    /// Style override per floor cell ("x,y") and per wall face ("x,y,side").
    pub floor_paint: BTreeMap<String, String>,
    pub wall_paint: BTreeMap<String, String>,
    /// Room-wide settings (time mode, ambient light, shadows, colours of the player's look...).
    pub settings: BTreeMap<String, String>,
    /// Floor the builders added (rooms built on to the house, builds.rs).
    pub built_area: u32,
    /// Floor bought cell by cell while building. Left out of the JSON while 0, so saves made before it still
    /// verify against their logs.
    #[serde(skip_serializing_if = "is_zero")]
    pub bought_area: u32,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PlacementSpec {
    pub item: String,
    pub x: i32,
    pub y: i32,
    pub rot: u8,
    pub wall: Option<WallSide>,
    pub on: Option<u32>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
pub enum PlaceError {
    UnknownItem,
    BadRotation,
    OutOfBounds,
    Overlap,
    NeedsWall,
    NotAWallItem,
    NoWallThere,
    WallOccupied,
    NeedsHost,
    NotASurfaceItem,
    HostMissing,
    HostNotSurface,
    OutsideHost,
    SurfaceOccupied,
    HostHasItems,
}

impl fmt::Display for PlaceError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let text = match self {
            PlaceError::UnknownItem => "unknown item",
            PlaceError::BadRotation => "rotation must be 0 to 3",
            PlaceError::OutOfBounds => "does not fit inside the room",
            PlaceError::Overlap => "overlaps another item",
            PlaceError::NeedsWall => "must be hung on a wall",
            PlaceError::NotAWallItem => "is not a wall item",
            PlaceError::NoWallThere => "there is no wall there",
            PlaceError::WallOccupied => "that part of the wall is taken",
            PlaceError::NeedsHost => "must stand on a surface",
            PlaceError::NotASurfaceItem => "is not a surface item",
            PlaceError::HostMissing => "the item to stand on does not exist",
            PlaceError::HostNotSurface => "that item has no surface",
            PlaceError::OutsideHost => "is outside the surface",
            PlaceError::SurfaceOccupied => "that spot on the surface is taken",
            PlaceError::HostHasItems => "other items stand on it",
        };
        f.write_str(text)
    }
}

/// Why a change of the room's shape was refused.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
pub enum RoomError {
    OutOfRange,
    Empty,
    TooManyCells,
    Disconnected,
    CellOccupied,
    WallItemAttached,
    NotInRoom,
    NotAWall,
    DividerBusy,
    TooMany,
    /// A paint or shape command that lists nothing.
    Nothing,
}

impl fmt::Display for RoomError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let text = match self {
            RoomError::OutOfRange => "outside the buildable area",
            RoomError::Empty => "the room cannot be empty",
            RoomError::TooManyCells => "more floor than your area allows",
            RoomError::Disconnected => "the room must stay in one piece",
            RoomError::CellOccupied => "something stands on that floor",
            RoomError::WallItemAttached => "a wall item hangs there",
            RoomError::NotInRoom => "that is outside the room",
            RoomError::NotAWall => "there is no wall there",
            RoomError::DividerBusy => "a wall item hangs on that divider",
            RoomError::TooMany => "too many at once",
            RoomError::Nothing => "nothing to change",
        };
        f.write_str(text)
    }
}

/// The buildable area is a square of this many cells.
pub const GRID_LIMIT: i32 = 32;
/// The most cells or edges one command may touch.
pub const BATCH_LIMIT: usize = 1024;

fn start_cells(content: &Content) -> BTreeSet<(i32, i32)> {
    let r = &content.start_room;
    let mut out = BTreeSet::new();
    for x in r.x..r.x + r.w {
        for y in r.y..r.y + r.h {
            out.insert((x, y));
        }
    }
    out
}

/// All floor cells: the start rectangle, plus painted cells, minus erased ones.
pub fn cells(content: &Content, state: &RoomState) -> BTreeSet<(i32, i32)> {
    let mut out = start_cells(content);
    for key in &state.added {
        if let Some(c) = parse_cell(key) {
            out.insert(c);
        }
    }
    for key in &state.removed {
        if let Some(c) = parse_cell(key) {
            out.remove(&c);
        }
    }
    out
}

fn is_zero(n: &u32) -> bool {
    *n == 0
}

/// How many floor cells the room may have: the start room plus the area of every bought expansion.
pub fn area_budget(content: &Content, state: &RoomState) -> u32 {
    let start = ((content.start_room.w.max(0) * content.start_room.h.max(0)) as u32).max(content.start_area);
    let extra: u32 = state.expansions.iter().filter_map(|id| content.expansions.get(id)).map(|e| e.area).sum();
    start + extra + state.built_area + state.bought_area
}

/// Whether a wall stands on this side of this cell.
pub fn is_wall_edge(cells: &BTreeSet<(i32, i32)>, dividers: &BTreeSet<String>, x: i32, y: i32, side: WallSide) -> bool {
    if !cells.contains(&(x, y)) {
        return false;
    }
    let (dx, dy) = side.delta();
    if !cells.contains(&(x + dx, y + dy)) {
        return true;
    }
    dividers.contains(&divider_key(x, y, side))
}

/// Width and depth in cells after rotating by `rot` quarter turns.
pub fn footprint(def: &ItemDef, rot: u8) -> (i32, i32) {
    let (w, d) = (i32::from(def.footprint.w), i32::from(def.footprint.d));
    if rot % 2 == 1 {
        (d, w)
    } else {
        (w, d)
    }
}

pub fn children_of(state: &RoomState, pid: u32) -> Vec<u32> {
    state.placements.values().filter(|p| p.on == Some(pid)).map(|p| p.pid).collect()
}

/// The wall faces a wall item occupies.
pub fn wall_edges(def: &ItemDef, x: i32, y: i32, side: WallSide) -> Vec<(i32, i32, WallSide)> {
    let (ax, ay) = side.along();
    (0..i32::from(def.footprint.w)).map(|i| (x.saturating_add(ax * i), y.saturating_add(ay * i), side)).collect()
}

pub fn validate(content: &Content, state: &RoomState, spec: &PlacementSpec, ignore: Option<u32>) -> Result<(), PlaceError> {
    let def = content.items.get(&spec.item).ok_or(PlaceError::UnknownItem)?;
    if spec.rot > 3 {
        return Err(PlaceError::BadRotation);
    }
    let others = || state.placements.values().filter(move |p| Some(p.pid) != ignore);
    match def.layer {
        Layer::Floor | Layer::Rug => {
            if spec.wall.is_some() {
                return Err(PlaceError::NotAWallItem);
            }
            if spec.on.is_some() {
                return Err(PlaceError::NotASurfaceItem);
            }
            let room = cells(content, state);
            let (w, d) = footprint(def, spec.rot);
            let mut mine = BTreeSet::new();
            for dx in 0..w {
                for dy in 0..d {
                    let cell = (spec.x + dx, spec.y + dy);
                    if !room.contains(&cell) {
                        return Err(PlaceError::OutOfBounds);
                    }
                    mine.insert(cell);
                }
            }
            for p in others() {
                let Some(other) = content.items.get(&p.item) else { continue };
                // Floor items collide with floor items; rugs collide only with rugs.
                if other.layer != def.layer {
                    continue;
                }
                let (ow, od) = footprint(other, p.rot);
                for dx in 0..ow {
                    for dy in 0..od {
                        if mine.contains(&(p.x + dx, p.y + dy)) {
                            return Err(PlaceError::Overlap);
                        }
                    }
                }
            }
            Ok(())
        }
        Layer::Wall => {
            let side = spec.wall.ok_or(PlaceError::NeedsWall)?;
            if spec.on.is_some() {
                return Err(PlaceError::NotASurfaceItem);
            }
            let room = cells(content, state);
            let mine = wall_edges(def, spec.x, spec.y, side);
            for (ex, ey, es) in &mine {
                if !room.contains(&(*ex, *ey)) {
                    return Err(PlaceError::OutOfBounds);
                }
                if !is_wall_edge(&room, &state.dividers, *ex, *ey, *es) {
                    return Err(PlaceError::NoWallThere);
                }
            }
            for p in others() {
                let (Some(pside), Some(other)) = (p.wall, content.items.get(&p.item)) else { continue };
                for e in wall_edges(other, p.x, p.y, pside) {
                    if mine.contains(&e) {
                        return Err(PlaceError::WallOccupied);
                    }
                }
            }
            Ok(())
        }
        Layer::Surface => {
            if spec.wall.is_some() {
                return Err(PlaceError::NotAWallItem);
            }
            let host_pid = spec.on.ok_or(PlaceError::NeedsHost)?;
            let host = state.placements.get(&host_pid).ok_or(PlaceError::HostMissing)?;
            let host_def = content.items.get(&host.item).ok_or(PlaceError::HostMissing)?;
            if !host_def.rules.provides_surface {
                return Err(PlaceError::HostNotSurface);
            }
            let (hw, hd) = footprint(host_def, host.rot);
            let inside = spec.x >= host.x && spec.x < host.x + hw && spec.y >= host.y && spec.y < host.y + hd;
            if !inside {
                return Err(PlaceError::OutsideHost);
            }
            if others().any(|p| p.on == Some(host_pid) && p.x == spec.x && p.y == spec.y) {
                return Err(PlaceError::SurfaceOccupied);
            }
            Ok(())
        }
    }
}

fn connected(cells: &BTreeSet<(i32, i32)>) -> bool {
    let Some(&start) = cells.iter().next() else { return true };
    let mut seen = BTreeSet::new();
    let mut stack = vec![start];
    while let Some((x, y)) = stack.pop() {
        if !seen.insert((x, y)) {
            continue;
        }
        for side in WallSide::ALL {
            let (dx, dy) = side.delta();
            let n = (x + dx, y + dy);
            if cells.contains(&n) && !seen.contains(&n) {
                stack.push(n);
            }
        }
    }
    seen.len() == cells.len()
}

/// Do all placed items still fit a (possibly changed) geometry?
fn placements_fit(content: &Content, state: &RoomState, room: &BTreeSet<(i32, i32)>, dividers: &BTreeSet<String>) -> Result<(), RoomError> {
    for p in state.placements.values() {
        let Some(def) = content.items.get(&p.item) else { continue };
        match def.layer {
            Layer::Floor | Layer::Rug => {
                let (w, d) = footprint(def, p.rot);
                for dx in 0..w {
                    for dy in 0..d {
                        if !room.contains(&(p.x + dx, p.y + dy)) {
                            return Err(RoomError::CellOccupied);
                        }
                    }
                }
            }
            Layer::Wall => {
                if let Some(side) = p.wall {
                    for (ex, ey, es) in wall_edges(def, p.x, p.y, side) {
                        if !is_wall_edge(room, dividers, ex, ey, es) {
                            return Err(RoomError::WallItemAttached);
                        }
                    }
                }
            }
            Layer::Surface => {}
        }
    }
    Ok(())
}

/// Checks a change of the floor plan: the result stays inside the buildable area, within the budget, in one
/// piece, and every placed item still fits.
pub fn validate_cells(content: &Content, state: &RoomState, add: &[(i32, i32)], remove: &[(i32, i32)]) -> Result<(), RoomError> {
    if add.len() > BATCH_LIMIT || remove.len() > BATCH_LIMIT {
        return Err(RoomError::TooMany);
    }
    let mut next = cells(content, state);
    for c in remove {
        next.remove(c);
    }
    for c in add {
        if c.0 < 0 || c.1 < 0 || c.0 >= GRID_LIMIT || c.1 >= GRID_LIMIT {
            return Err(RoomError::OutOfRange);
        }
        next.insert(*c);
    }
    if next.is_empty() {
        return Err(RoomError::Empty);
    }
    if next.len() as u32 > area_budget(content, state) {
        return Err(RoomError::TooManyCells);
    }
    if !connected(&next) {
        return Err(RoomError::Disconnected);
    }
    // Dividers whose cells disappear are dropped by the fold, so they are not a reason to refuse.
    let dividers: BTreeSet<String> = state
        .dividers
        .iter()
        .filter(|k| {
            parse_edge(k).is_some_and(|(x, y, side)| {
                let (dx, dy) = side.delta();
                next.contains(&(x, y)) && next.contains(&(x + dx, y + dy))
            })
        })
        .cloned()
        .collect();
    placements_fit(content, state, &next, &dividers)
}

/// Checks adding or removing a divider on one cell side.
pub fn validate_divider(content: &Content, state: &RoomState, x: i32, y: i32, side: WallSide, on: bool) -> Result<(), RoomError> {
    let room = cells(content, state);
    let (dx, dy) = side.delta();
    if !room.contains(&(x, y)) || !room.contains(&(x + dx, y + dy)) {
        return Err(RoomError::NotInRoom);
    }
    let key = divider_key(x, y, side);
    let mut dividers = state.dividers.clone();
    if on {
        dividers.insert(key);
    } else {
        dividers.remove(&key);
    }
    placements_fit(content, state, &room, &dividers).map_err(|e| match e {
        RoomError::WallItemAttached => RoomError::DividerBusy,
        other => other,
    })
}
