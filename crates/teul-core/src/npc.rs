//! People of the world. Where someone is and what they do is a pure function of the world seed and the time,
//! so the world goes on while nobody plays; what the player did with them (talks, gifts, invitations) is
//! recorded as events.

use std::collections::{BTreeMap, BTreeSet};

use serde::{Deserialize, Serialize};

use crate::rng::{rand_below, Domain};
use crate::time::{WorldTime, MINUTES_PER_DAY};

pub const NPC_PLAN: Domain = Domain(31);
pub const NPC_SPOT: Domain = Domain(32);

/// Minutes an NPC spends walking from one place to the next at the start of a part of the day.
pub const TRAVEL_MINUTES: u64 = 20;
/// Friendship points per heart, and the most there can be.
pub const POINTS_PER_HEART: u32 = 200;
pub const MAX_POINTS: u32 = 1000;
pub const TALK_POINTS: u32 = 20;
pub const GIFT_LIKED: i32 = 80;
pub const GIFT_NEUTRAL: i32 = 30;
pub const GIFT_DISLIKED: i32 = -20;
pub const TALKS_PER_DAY: u32 = 12;
pub const INVITE_HEARTS: u32 = 2;
pub const VISIT_MAX_MINUTES: u64 = 240;

/// A place of the village: a rectangle of cells where an NPC can be.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PlaceDef {
    pub id: String,
    pub name: String,
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
    /// What people tend to do there (`chat`, `read`, `shop`, `sit`, `walk`, `garden`, `sleep`...).
    #[serde(default)]
    pub activity: String,
}

/// One part of the day in a routine: from minute `from` to `to`, at one of `places` (weighted).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RoutineSlot {
    pub from: u32,
    pub to: u32,
    pub places: Vec<(String, u32)>,
    /// Days of the week (0..7) this slot applies to; empty means every day.
    #[serde(default)]
    pub days: Vec<u8>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NpcGift {
    pub hearts: u32,
    pub item: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NpcLine {
    pub text: String,
    /// Least hearts needed to say it.
    #[serde(default)]
    pub hearts: u32,
    /// Part of the day: `morning`, `day`, `evening`, `night`, or empty for any.
    #[serde(default)]
    pub when: String,
    /// Where they say it: a place id, `home` (visiting the player), or empty for anywhere.
    #[serde(default)]
    pub at: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NpcDef {
    pub id: String,
    pub name: String,
    /// The same keys as the player's `look.*` settings, without the prefix.
    #[serde(default)]
    pub look: BTreeMap<String, String>,
    /// Personality from 0 to 100: `warmth`, `energy`, `curiosity`, `calm`.
    #[serde(default)]
    pub traits: BTreeMap<String, u32>,
    pub home: String,
    /// Item ids, item tags or item categories they like or dislike as gifts.
    #[serde(default)]
    pub likes: Vec<String>,
    #[serde(default)]
    pub dislikes: Vec<String>,
    pub routine: Vec<RoutineSlot>,
    #[serde(default)]
    pub lines: Vec<NpcLine>,
    #[serde(default)]
    pub gifts: Vec<NpcGift>,
    /// A short description for the people panel.
    #[serde(default)]
    pub about: String,
    /// Small talk shown over their heads when they meet someone.
    #[serde(default)]
    pub chatter: Vec<String>,
    /// What they say to the player passing by.
    #[serde(default)]
    pub greet: Vec<String>,
    /// Things they may ask the player for, one request on a day they ask.
    #[serde(default)]
    pub asks: Vec<crate::daily::AskDef>,
    /// Letters they write as the friendship grows.
    #[serde(default)]
    pub letters: Vec<crate::daily::LetterDef>,
    /// Their own story, chapter by chapter.
    #[serde(default)]
    pub story: Vec<crate::daily::ChapterDef>,
}

/// A fixed map of the world outside the home (the village, the forest...).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LocationDef {
    pub id: String,
    pub name: String,
    pub w: i32,
    pub h: i32,
    /// One string per row; each character picks a floor style from `legend`.
    pub tiles: Vec<String>,
    pub legend: BTreeMap<String, String>,
    #[serde(default)]
    pub props: Vec<LocationProp>,
    #[serde(default)]
    pub places: Vec<PlaceDef>,
    /// Where the player arrives from home, for the one location the front door opens onto.
    #[serde(default)]
    pub entry: Option<(i32, i32)>,
    /// Ways to other locations: stepping into the rectangle takes one to `at` in location `to`.
    #[serde(default)]
    pub exits: Vec<ExitDef>,
    /// Places to gather from once a day.
    #[serde(default)]
    pub spots: Vec<crate::daily::SpotDef>,
    /// Shores and piers to fish from.
    #[serde(default)]
    pub fishing: Vec<crate::daily::FishingDef>,
    /// Buildings and places with a purpose, for the life of the settlement.
    #[serde(default)]
    pub sites: Vec<crate::life::SiteDef>,
    /// Animals living here: what, where, how many, when they are about.
    #[serde(default)]
    pub animals: Vec<AnimalDef>,
    /// For a room inside a building: the site whose building it is (entering the building leads here).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub inside: Option<String>,
    /// The wall style of a room inside a building.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub wall: Option<String>,
    /// Where the people of the site stand or sit inside: those at work first, then the visitors.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub posts: Vec<(i32, i32)>,
    /// Under the ground (a cave): no sky, no weather, its own dark.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub underground: bool,
    /// The still water (lakes and ponds, not rivers) that freezes in a frosty winter: runs of cells (y, x0, x1).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub ice: Vec<(i32, i32, i32)>,
    /// Overhead wires (power lines) from pole to pole.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub wires: Vec<WireDef>,
    /// What it takes to go there (a key, some help, a friend); open to all when absent.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub requires: Option<crate::economy::Requires>,
    /// Someone's home one goes to only when invited (to dinner).
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub invite_only: bool,
    /// When a shop or an office lets people in: from the first hour to the second (past midnight when the second
    /// is the smaller); open at all hours when absent (the hospital, the police).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hours: Option<(u32, u32)>,
    /// On which days, as stations: "weekdays", "weekends"; every day when absent.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub days: Option<String>,
    /// Named places of the map (the square's centre, the main street, the park, the pond, the forest edge, each
    /// building's door as `door:<site>`…), so features can stand somewhere by name instead of by coordinates.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub landmarks: BTreeMap<String, LandmarkDef>,
}

/// A named place on a map: a cell (w = h = 1) or an area.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LandmarkDef {
    pub name: String,
    pub x: i32,
    pub y: i32,
    #[serde(default = "one")]
    pub w: i32,
    #[serde(default = "one")]
    pub h: i32,
}

fn one() -> i32 {
    1
}

impl LocationDef {
    /// A named place of this map.
    pub fn landmark(&self, id: &str) -> Option<&LandmarkDef> {
        self.landmarks.get(id)
    }
}

/// A wire hung between two points: x and y in hundredths of a tile, z (height) in hundredths of a tile.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct WireDef {
    pub a: (i32, i32, i32),
    pub b: (i32, i32, i32),
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AnimalDef {
    /// The item that draws it.
    pub kind: String,
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
    pub count: u32,
    /// Parts of the day it is about (empty: always).
    #[serde(default)]
    pub when: Vec<String>,
    /// It lives on the water.
    #[serde(default)]
    pub swims: bool,
    /// Cells a second it moves at.
    #[serde(default)]
    pub speed: Option<u32>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ExitDef {
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
    pub to: String,
    pub at: (i32, i32),
    /// What the way is called on its sign.
    #[serde(default)]
    pub name: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LocationProp {
    pub item: String,
    pub x: i32,
    pub y: i32,
    #[serde(default)]
    pub rot: u8,
    #[serde(default)]
    pub wall: Option<crate::room::WallSide>,
    #[serde(default)]
    pub colors: BTreeMap<String, String>,
    /// Shown only once the dump is this full (in percent): heaps that pile up over the days.
    #[serde(default, skip_serializing_if = "is_zero")]
    pub min_fill: u32,
    /// Shown only from this day of the world's life on: graves added over the years.
    #[serde(default, skip_serializing_if = "is_zero")]
    pub min_day: u32,
    /// Shown only on the days of the rift (the equinoxes and the solstices): a crack to the Other Side.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub rift: bool,
    /// Shown only while the town has this flag (a stage of building, a shop open, a storm…: `town::flags`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub flag: Option<String>,
    /// Hidden while the town has this flag (the old thing a project replaces).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unflag: Option<String>,
}

fn is_zero(n: &u32) -> bool {
    *n == 0
}

/// What the player did with someone so far.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct Relation {
    pub points: u32,
    pub met: bool,
    pub talks: u64,
    /// The day of the last talk that counted, and how many talks happened that day.
    pub talk_day: (u64, u32),
    pub gift_day: Option<u64>,
    /// Items given to them and how they took it (+1 liked, 0 neutral, -1 disliked), so their taste becomes known.
    pub tastes: BTreeMap<String, i8>,
    pub received: BTreeSet<String>,
    pub visit: Option<(u64, u64)>,
    /// The day of the last time the player and they had something to do with each other (a talk, a gift…).
    pub last: Option<u64>,
}

impl Relation {
    pub fn hearts(&self) -> u32 {
        self.points / POINTS_PER_HEART
    }
}

/// Where an NPC is during one part of the day.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Stay {
    pub place: String,
    pub x: i32,
    pub y: i32,
    pub from: u64,
    pub to: u64,
}

/// The slot index used for the RNG: one per part of the day, distinct across days.
fn slot_tick(day: u64, slot: usize) -> u64 {
    day * 64 + slot as u64
}

fn pick_place(seed: u64, npc_index: u64, day: u64, slot_index: usize, slot: &RoutineSlot) -> Option<String> {
    let total: u64 = slot.places.iter().map(|(_, w)| u64::from(*w)).sum();
    if total == 0 {
        return None;
    }
    let mut r = rand_below(seed, NPC_PLAN, npc_index, slot_tick(day, slot_index), total);
    for (place, w) in &slot.places {
        if r < u64::from(*w) {
            return Some(place.clone());
        }
        r -= u64::from(*w);
    }
    None
}

/// The routine slots that apply on a day, in order.
fn slots_of(def: &NpcDef, day: u64) -> Vec<(usize, &RoutineSlot)> {
    let weekday = (day % 7) as u8;
    let mut out: Vec<(usize, &RoutineSlot)> = def.routine.iter().enumerate().filter(|(_, s)| s.days.is_empty() || s.days.contains(&weekday)).collect();
    out.sort_by_key(|(_, s)| s.from);
    out
}

/// A person's own stream of the world's randomness, from their id alone, so adding people never changes anyone else.
pub fn stream_of(id: &str) -> u64 {
    // FNV-1a, folded to 32 bits so derived streams (twice it, plus one) stay in range
    let h = id.bytes().fold(0xcbf2_9ce4_8422_2325u64, |h, b| (h ^ u64::from(b)).wrapping_mul(0x0000_0100_0000_01b3));
    (h ^ (h >> 32)) & 0xffff_ffff
}

/// Where someone is at `time` by their routine (ignoring visits). Outside every slot they are at home, from the
/// end of the slot before to the start of the next (or the day's edges).
pub fn stay_at(seed: u64, npc_index: u64, def: &NpcDef, places: &BTreeMap<String, PlaceDef>, time: WorldTime) -> Stay {
    let day = time.day();
    let minute = time.minute_of_day();
    let day_start = day * MINUTES_PER_DAY;
    let mut chosen: Option<(String, u64, u64, usize)> = None;
    let mut home_from = 0u64;
    let mut home_to = MINUTES_PER_DAY;
    for (index, slot) in slots_of(def, day) {
        let (f, t) = (u64::from(slot.from), u64::from(slot.to));
        if f <= minute && minute < t {
            if let Some(place) = pick_place(seed, npc_index, day, index, slot) {
                chosen = Some((place, day_start + f, day_start + t, index));
            }
        }
        if t <= minute {
            home_from = home_from.max(t);
        }
        if f > minute {
            home_to = home_to.min(f);
        }
    }
    let (place, from, to, index) = chosen.unwrap_or_else(|| (def.home.clone(), day_start + home_from, day_start + home_to, 63));
    let (x, y) = match places.get(&place) {
        Some(p) => {
            let tick = slot_tick(day, index);
            (p.x + rand_below(seed, NPC_SPOT, npc_index * 2, tick, p.w.max(1) as u64) as i32, p.y + rand_below(seed, NPC_SPOT, npc_index * 2 + 1, tick, p.h.max(1) as u64) as i32)
        }
        None => (0, 0),
    };
    Stay { place, x, y, from, to }
}

/// Where someone was just before the current part of the day began (to walk from there).
pub fn previous_stay(seed: u64, npc_index: u64, def: &NpcDef, places: &BTreeMap<String, PlaceDef>, current: &Stay) -> Stay {
    if current.from == 0 {
        return current.clone();
    }
    stay_at(seed, npc_index, def, places, WorldTime(current.from - 1))
}

/// How an item suits someone's taste: +1 liked, -1 disliked, 0 neither. Ids, tags and categories all count.
pub fn taste(def: &NpcDef, item: &str, tags: &[String], category: &str) -> i8 {
    let hit = |list: &Vec<String>| list.iter().any(|k| k == item || k == category || tags.contains(k));
    if hit(&def.dislikes) {
        -1
    } else if hit(&def.likes) {
        1
    } else {
        0
    }
}
