use std::fmt;
use std::sync::Arc;

use serde::{Deserialize, Serialize};

use crate::content::Content;
use crate::event::{DecodeError, Event, EventId, EventKind, SortKey};
use crate::room::{self, PlaceError, PlacementSpec, RoomError, WallSide};
use crate::state::{DeltaState, Snapshot};
use crate::storage::{Storage, StorageError};
use crate::time::{Calendar, Season, WorldClock, WorldTime};
use crate::unlock::{self, Cost, Missing, Wallet};

pub const CURRENT_WORLD_VERSION: u32 = 1;
pub const CURRENT_RULES_VERSION: u32 = 2;
pub const MAX_NAME_CHARS: usize = 40;

const META_SEED: &str = "seed";
const META_WORLD_VERSION: &str = "world_version";
const META_EPOCH: &str = "epoch_unix_secs";
const META_REALM: &str = "realm";

/// Which world a save belongs to. A sandbox save is local and trusted by nobody else.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Realm {
    Sandbox,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Command {
    NamePlayer { name: String },
    /// Puts a carried thing into one of the nine places at hand (or empties it).
    SetHotbar { slot: u32, item: Option<String> },
    /// Puts a carried thing into the left hand (or empties it).
    SetOffhand { item: Option<String> },
    /// The thing in a place at hand and the one in the left hand change hands.
    SwapHands { slot: u32 },
    /// Puts on a piece of armour one has.
    Wear { item: String },
    /// Takes the armour off a place.
    TakeOff { slot: String },
    Acquire { item: String },
    AcquireStyle { style: String },
    Place { item: String, x: i32, y: i32, rot: u8, wall: Option<WallSide>, on: Option<u32> },
    Move { pid: u32, x: i32, y: i32, wall: Option<WallSide>, on: Option<u32> },
    Rotate { pid: u32, rot: u8 },
    Recolor { pid: u32, slot: String, color: String },
    Store { pid: u32 },
    SetStyle { kind: String, style: String },
    Expand { expansion: String },
    /// Buys floor for the home while building: `cells` more cells of area, at the pack's price per cell.
    BuyArea { cells: u32 },
    Perform { action: String, pid: Option<u32> },
    PaintCells { add: Vec<(i32, i32)>, remove: Vec<(i32, i32)> },
    SetDivider { x: i32, y: i32, side: WallSide, on: bool },
    PaintFloor { cells: Vec<(i32, i32)>, style: Option<String> },
    PaintWall { edges: Vec<(i32, i32, WallSide)>, style: Option<String> },
    SetProp { pid: u32, key: String, value: String },
    SetSetting { key: String, value: String },
    AcquireTheme { theme: String },
    ApplyTheme { theme: String },
    Talk { npc: String },
    /// Takes a one-time gift from the content (once per kit).
    ClaimKit { kit: String },
    /// Gathers what a spot gives today.
    Gather { spot: String },
    /// A fish caught at a fishing place (the catching itself is the shell's little game).
    Fish { place: String },
    /// Brings someone what they asked for today.
    Deliver { npc: String },
    /// Opens a letter (and takes what is inside).
    ClaimLetter { npc: String, letter: u32 },
    /// Plays the next chapter of someone's story.
    AdvanceStory { npc: String },
    /// Mends a worn thing at the workshop, for coins.
    Restore { item: String },
    /// Takes the taxi from where the player is (a location and a cell) to a stand or a place, for its fare. `fare`
    /// is the price the player was shown (`ride::quote` at that minute): it must be the price now. Inputs logged
    /// before the taxi priced by demand have none and are charged as they were then (`taxi_fare`).
    TakeTaxi {
        to: String,
        from: String,
        x: i32,
        y: i32,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        fare: Option<u32>,
    },
    Gift { npc: String, item: String },
    Invite { npc: String, from: u64, until: u64 },
    /// Goes somewhere: "home" or a location (some are locked until a key, a help or a friend opens them).
    Travel { to: String },
    /// Puts things from the pocket into the chest at home.
    Stash { item: String, n: u32 },
    /// Takes things from the chest at home into the pocket.
    Take { item: String, n: u32 },
    /// Sells things from the pocket to a buyer where it stands (a station that `buys`).
    SellTo { station: String, item: String, n: u32 },
    /// Sells a thing of the home that stands nowhere (the inventory) second-hand: a buyer from the paper's
    /// small ads takes it away for part of its price, a few a day.
    SellBack { item: String },
    /// Throws things out of the pocket for good (anywhere: what is not wanted need not be carried home).
    ThrowAway { item: String, n: u32 },
    /// Uses a station where it stands (buy, sell, make, gather...).
    Use { station: String },
    /// Does a help for someone (where they hand it out).
    Help { help: String },
    /// Answers a journalist's question (once a day).
    Interview { question: u32, answer: u32 },
    /// Puts food from the pocket into the fridge at home, or takes it out.
    ToFridge { item: String, n: u32 },
    FromFridge { item: String, n: u32 },
    /// Cooks a dish at the stove at home.
    Cook { recipe: String },
    /// Pays a utility's oldest unpaid bill (or that month's) at the utility office.
    PayBill { utility: String, month: Option<i64> },
    /// Pays every bill due.
    PayAll,
    /// Takes a quest: an authored one (by id; a calendar one is this year's), or a job of the day (`job:day:n`).
    QuestStart { quest: String },
    /// Does the current stage of a quest taken (being there, handing things over, deciding).
    QuestStep { quest: String, #[serde(default)] choice: Option<u32> },
    /// Asks to be taken on at a job, where it is (a word with whoever runs the place).
    TakeJob { work: String },
    /// Leaves a job (its shift going on ends first).
    LeaveJob { work: String },
    /// Takes a shift at a job where one is.
    StartShift { work: String },
    /// Answers the task asked now.
    WorkStep { choice: u32 },
    /// Ends the shift (paid for what was done).
    EndShift,
    /// Plants a seed from the pocket in a plot at home.
    Plant { pid: u32, seed: String },
    Water { pid: u32 },
    Harvest { pid: u32 },
    ClearPlot { pid: u32 },
    /// A while at an instrument at home (a piece of the repertoire, or just playing).
    Play {
        pid: u32,
        #[serde(default)]
        piece: Option<String>,
    },
    /// Plays a piece in the street on a carried instrument.
    Busk { piece: String, instrument: String },
    /// Paints a picture at an easel at home: 16×12 hex digits.
    Paint { pid: u32, title: String, pixels: String },
    /// Makes the hero at the first open (once): clothes, hair and body.
    MakeHero { set: Vec<(String, String)> },
    /// Changes into an owned garment (None: back into the first day's clothes for that slot).
    Dress { slot: String, #[serde(default)] item: Option<String> },
    /// A haircut at the salon (hair, its colour, the beard).
    Haircut { set: Vec<(String, String)> },
    Rent { home: String },
    Buy { home: String },
    MoveHome { home: String },
    EndLease { home: String },
    /// Wishes someone a happy birthday (on the day), with a gift from the pocket or without.
    Congratulate { who: String, #[serde(default)] gift: Option<String> },
    /// Gives coins and materials to one of the town's projects (at the town hall).
    Contribute { project: String, coins: u32, #[serde(default)] items: Vec<(String, u32)> },
    /// Has dinner at a friend's who invited the player (there, at the time).
    Dine { host: String },
    /// Mends a worn or broken thing at home with a repair kit from the pocket.
    Repair { pid: u32 },
    /// Calls a master to mend a thing at home (from the utility office, or by one's own phone), for coins.
    CallMaster { pid: u32 },
    /// Makes something one knows at a workbench.
    Craft { recipe: String },
    /// Tries what goes with what at a workbench (nothing is lost when nothing comes of it).
    Tinker { items: Vec<(String, u32)> },
    /// Takes the little something a close friend has for the player today.
    AcceptGift { who: String },
    /// The road (drive.rs).
    Lesson,
    Theory { answers: Vec<u32> },
    StartExam,
    EndExam { #[serde(default)] faults: Vec<String> },
    BuyCar { car: String },
    Refuel,
    Service { what: String },
    StartDrive { #[serde(default)] exam: bool },
    Park { cells: u64, x: i32, y: i32, #[serde(default)] rot: u8 },
    Violation { kind: String, cells: u64, x: i32, y: i32 },
    PayFine,
    PickCoin { x: i32, y: i32 },
    /// Orders a room built on to the house, its site next to it (builds.rs).
    OrderBuild { build: String, x: i32, y: i32 },
    /// Takes the keys of a finished room.
    FinishBuild { n: u32 },
    /// Takes an animal home (or takes the next step: food for the fox, the egg in a warm nest).
    Adopt { pet: String },
    /// Feeds, plays with, strokes, charges or mends an animal of one's own.
    PetCare { pet: String, what: String },
    /// Who goes out with the player (none: the first day's cat, dog or rabbit).
    Companion { #[serde(default)] pet: Option<String> },
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum CoreError {
    Storage(StorageError),
    Decode(DecodeError),
    InvalidName,
    ClockWentBackwards { last: WorldTime, now: WorldTime },
    /// A snapshot the shell offered does not verify or does not match its log: open the whole log instead.
    SnapshotRefused,
    MissingMeta(&'static str),
    BadMeta(&'static str),
    UnsupportedWorldVersion(u32),
    UnsupportedRealm(String),
    UnsupportedRulesVersion(u32),
    AlreadyExists,
    Place(PlaceError),
    UnknownItem(String),
    UnknownStyle(String),
    UnknownAction(String),
    UnknownExpansion(String),
    UnknownPlacement(u32),
    NotOwned(String),
    Locked(Vec<Missing>),
    InvalidColor,
    InvalidSlot,
    AlreadyExpanded,
    AlreadyOwned,
    StyleNotOwned,
    ActionNotAvailable,
    Room(RoomError),
    InvalidProp,
    InvalidSetting,
    UnknownTheme(String),
    UnknownNpc(String),
    /// Talked too often today, or already gave a gift today.
    TooSoon,
    NotFriendsYet,
    BadVisit,
    /// The taxi's price changed since it was shown (the minute moved on): this is the price now.
    FareChanged { fare: u32 },
    /// Free things are not gifts.
    NoGift,
    /// Nobody here buys that.
    NotBought,
    /// The spot gave already today, or nothing is there this season or hour; or there is no such place.
    NothingThere,
    /// Not enough of what was asked for.
    NotEnough,
    /// Nobody asked for that today, or it is done.
    NoRequest,
    /// The pocket has no room for it.
    PocketFull,
    /// The player is not where that is.
    NotHere,
    /// More commands in a world minute than a person gives.
    TooFast,
    UnknownLocation(String),
    UnknownStation(String),
    UnknownHelp(String),
    /// Out of its hours or its season.
    Closed,
    /// Done already (a help is done once).
    AlreadyDone,
    /// Something must stand at home for that: a fridge, a stove.
    Needs(String),
    /// Only food goes into the fridge.
    NotFood,
    UnknownRecipe(String),
    /// The utility (water, power, gas, garbage) is switched off for an unpaid bill.
    UtilityOff(String),
    UnknownQuest(String),
    /// A recipe one has not learned from anyone yet.
    NotLearned(String),
    /// No shift is going on.
    NoShift,
    /// Not taken on at that job.
    NotHired,
    UnknownWork(String),
    /// The hero is made: clothes are changed at the wardrobe, hair at the salon, the body stays.
    LookFixed,
    /// Not on this day (it is not their birthday).
    NotToday,
    /// Someone's home is open to the player only when invited (to dinner, at the time).
    NotInvited,
    /// The thing is broken; its own words say how.
    Broken(String),
    /// Tried at the workbench, and nothing came of it.
    Fizzled,
    /// Behind the bars until morning.
    Jailed,
    /// A tenant does not build on to a house that is not theirs.
    Tenant,
    /// The car does not go.
    CarBroken,
}

impl fmt::Display for CoreError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CoreError::Storage(e) => write!(f, "{e}"),
            CoreError::Decode(e) => write!(f, "cannot read event: {e:?}"),
            CoreError::InvalidName => write!(f, "name must be 1-{MAX_NAME_CHARS} visible characters"),
            CoreError::ClockWentBackwards { last, now } => {
                write!(f, "time went backwards: last event at {}, now {}", last.0, now.0)
            }
            CoreError::SnapshotRefused => write!(f, "the snapshot does not verify against the log"),
            CoreError::MissingMeta(k) => write!(f, "save is missing '{k}'"),
            CoreError::BadMeta(k) => write!(f, "save has an unreadable '{k}'"),
            CoreError::UnsupportedWorldVersion(v) => write!(f, "this save uses world version {v}, which this build cannot run"),
            CoreError::UnsupportedRealm(r) => write!(f, "this save belongs to the '{r}' realm, which the sandbox core cannot open"),
            CoreError::UnsupportedRulesVersion(v) => write!(f, "this save contains events written under rules version {v}, which this build cannot run"),
            CoreError::AlreadyExists => write!(f, "this storage already contains a world"),
            CoreError::Place(e) => write!(f, "cannot place: {e}"),
            CoreError::UnknownItem(i) => write!(f, "unknown item '{i}'"),
            CoreError::UnknownStyle(s) => write!(f, "unknown style '{s}'"),
            CoreError::UnknownAction(a) => write!(f, "unknown action '{a}'"),
            CoreError::UnknownExpansion(e) => write!(f, "unknown expansion '{e}'"),
            CoreError::UnknownPlacement(p) => write!(f, "nothing is placed with id {p}"),
            CoreError::NotOwned(i) => write!(f, "you have no free '{i}' to place"),
            CoreError::Locked(missing) => write!(f, "not available yet ({} requirement(s) missing)", missing.len()),
            CoreError::InvalidColor => write!(f, "that colour is not in the palette"),
            CoreError::InvalidSlot => write!(f, "this item has no such colour slot"),
            CoreError::AlreadyExpanded => write!(f, "the room already has this expansion"),
            CoreError::AlreadyOwned => write!(f, "you already own this"),
            CoreError::StyleNotOwned => write!(f, "you do not own this style yet"),
            CoreError::ActionNotAvailable => write!(f, "this item does not support that action"),
            CoreError::Room(e) => write!(f, "cannot change the room: {e}"),
            CoreError::InvalidProp => write!(f, "that setting is not valid for this item"),
            CoreError::InvalidSetting => write!(f, "that room setting is not valid"),
            CoreError::UnknownTheme(t) => write!(f, "unknown theme '{t}'"),
            CoreError::UnknownNpc(n) => write!(f, "nobody called '{n}' lives here"),
            CoreError::TooSoon => write!(f, "that will have to wait until tomorrow"),
            CoreError::NotFriendsYet => write!(f, "you need to be better friends first"),
            CoreError::NoGift => write!(f, "that is too ordinary to be a gift"),
            CoreError::NotBought => write!(f, "nobody here buys that"),
            CoreError::NothingThere => write!(f, "there is nothing to find there now"),
            CoreError::NotEnough => write!(f, "you do not have what was asked for"),
            CoreError::NoRequest => write!(f, "nobody asked for that today"),
            CoreError::BadVisit => write!(f, "a visit must start now or later and last at most four hours"),
            CoreError::FareChanged { fare } => write!(f, "the taxi's price is {fare} now"),
            CoreError::PocketFull => write!(f, "the pocket is full"),
            CoreError::NotHere => write!(f, "that is somewhere else"),
            CoreError::TooFast => write!(f, "too many actions at once"),
            CoreError::UnknownLocation(l) => write!(f, "there is no place called '{l}'"),
            CoreError::UnknownStation(s) => write!(f, "there is nothing called '{s}' to use"),
            CoreError::UnknownHelp(h) => write!(f, "nobody needs help '{h}'"),
            CoreError::Closed => write!(f, "closed now"),
            CoreError::AlreadyDone => write!(f, "that is done already"),
            CoreError::Needs(what) => write!(f, "there is no {what} at home"),
            CoreError::NotFood => write!(f, "only food goes into the fridge"),
            CoreError::UnknownRecipe(r) => write!(f, "there is no recipe '{r}'"),
            CoreError::UtilityOff(u) => write!(f, "the {u} is switched off for an unpaid bill"),
            CoreError::UnknownQuest(q) => write!(f, "there is no quest '{q}'"),
            CoreError::NotLearned(r) => write!(f, "nobody has taught you '{r}' yet"),
            CoreError::NoShift => write!(f, "no shift is going on"),
            CoreError::NotHired => write!(f, "not taken on at that job"),
            CoreError::UnknownWork(w) => write!(f, "unknown job '{w}'"),
            CoreError::LookFixed => write!(f, "clothes are changed at the wardrobe, hair at the salon"),
            CoreError::NotToday => write!(f, "not today"),
            CoreError::NotInvited => write!(f, "only when invited"),
            CoreError::Broken(w) => write!(f, "{w}"),
            CoreError::Fizzled => write!(f, "nothing came of it"),
            CoreError::Jailed => write!(f, "the cell is locked until morning"),
            CoreError::Tenant => write!(f, "only an owner builds on"),
            CoreError::CarBroken => write!(f, "the car does not go"),
        }
    }
}

impl std::error::Error for CoreError {}

impl From<StorageError> for CoreError {
    fn from(e: StorageError) -> Self {
        CoreError::Storage(e)
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NewWorld {
    pub seed: u64,
    pub epoch_unix_secs: i64,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct WorldMeta {
    pub seed: u64,
    pub world_version: u32,
    pub epoch_unix_secs: i64,
    pub realm: Realm,
}

/// Plain data for the shell to render. The shell never mutates the world through it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct WorldView {
    pub time: WorldTime,
    pub day: u64,
    pub minute_of_day: u64,
    pub season: Season,
    /// Which quarter of its season it is, 0..=3.
    pub season_phase: u8,
    pub year: u64,
    pub player_name: Option<String>,
    pub world_version: u32,
    /// One-time gifts already taken.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub kits: Vec<String>,
}

pub struct Core<S: Storage> {
    /// The simulated life of the settlement, advanced as time is asked about (derived, never stored).
    life: std::cell::RefCell<LifeCache>,
    storage: S,
    meta: WorldMeta,
    device: u32,
    state: DeltaState,
    next_seq: u64,
    last_key: Option<SortKey>,
    snapshot_day: Option<u64>,
    content: Arc<Content>,
    /// This device's secret for the chain (from the meta; 0 when the save has none).
    secret: u64,
    /// The chain of this device's latest event.
    chain_tip: u64,
    integrity: crate::economy::Integrity,
    /// Re-deriving an input made under other content: the rules added since (a shop's hours, being taken on at a
    /// job) do not hold it back — what was done then stays done.
    pub(crate) older_rules: std::cell::Cell<bool>,
    /// The town's jobs by day (derived from the day; kept so the simulation is not run again for them).
    pub(crate) jobs_cache: std::cell::RefCell<std::collections::BTreeMap<u64, Vec<crate::quests::JobInst>>>,
    /// The town's years, its flags and its people by day (derived; see `town.rs`).
    pub(crate) town_cache: std::cell::RefCell<crate::town::TownCache>,
    /// Each device's chain tip and highest sequence number, the devices that chain, whether an input was seen,
    /// how many events the log holds: what a snapshot vouches for.
    tips: std::collections::BTreeMap<u32, u64>,
    seqs: std::collections::BTreeMap<u32, u64>,
    chained: std::collections::BTreeSet<u32>,
    inputs_seen: bool,
    event_count: u64,
    /// The verified snapshot the log in storage starts after (a shell that keeps only the tail in memory).
    base: Option<Snapshot>,
    /// The latest snapshot made, and one made since the shell last took it (for it to keep).
    last_snapshot: Option<Snapshot>,
    fresh_snapshot: Option<Snapshot>,
    inputs_since_snapshot: u32,
}

/// A snapshot is made at the first command of each world day, and after this many inputs in one day.
pub const SNAPSHOT_EVERY_INPUTS: u32 = 400;

/// What vouches for a snapshot: a hash of everything in it (but the mac) with the device's secret.
pub fn snapshot_mac(snap: &Snapshot, secret: u64) -> u64 {
    let mut body = snap.clone();
    body.mac = 0;
    let mut bytes = serde_json::to_vec(&body).expect("a snapshot always serializes");
    bytes.extend_from_slice(&secret.to_le_bytes());
    bytes.extend_from_slice(b"teul-snapshot");
    let h = crate::rng::fnv1a64(&bytes) & crate::economy::MASK52;
    if h == 0 {
        1
    } else {
        h
    }
}

/// The town's simulation as last asked, with a copy kept at each midnight it passed: asking about an earlier
/// moment of the same window (the paper asks for midnight after the street asked for now) starts from the
/// nearest copy instead of simulating the whole week again.
#[derive(Default)]
struct LifeCache {
    main: Option<crate::life::Life>,
    marks: Vec<crate::life::Life>,
    /// Who lived in the town when it was simulated (a newcomer, a passing… starts it again).
    people: u64,
}

/// The meta key of the device's chain secret.
pub const META_SECRET: &str = "chain_secret";

/// How an error reads in a view: a short reason and, when locked, what is missing.
pub(crate) fn reason_of(e: &CoreError) -> (Option<String>, Vec<Missing>) {
    let r = |s: &str| Some(s.to_string());
    match e {
        CoreError::Locked(m) if m.iter().all(|x| matches!(x, Missing::Coins { .. })) => (r("coins"), m.clone()),
        CoreError::Locked(m) => (r("locked"), m.clone()),
        CoreError::Closed => (r("closed"), Vec::new()),
        CoreError::TooSoon => (r("too_soon"), Vec::new()),
        CoreError::NotEnough => (r("not_enough"), Vec::new()),
        CoreError::PocketFull => (r("pocket_full"), Vec::new()),
        CoreError::NotHere => (r("not_here"), Vec::new()),
        CoreError::AlreadyDone => (r("done"), Vec::new()),
        CoreError::NoRequest => (r("choose"), Vec::new()),
        CoreError::Jailed => (r("jailed"), Vec::new()),
        CoreError::Tenant => (r("tenant"), Vec::new()),
        CoreError::CarBroken => (r("broken"), Vec::new()),
        _ => (r("other"), Vec::new()),
    }
}

fn parse_meta<T: std::str::FromStr>(raw: Option<String>, key: &'static str) -> Result<T, CoreError> {
    raw.ok_or(CoreError::MissingMeta(key))?
        .parse()
        .map_err(|_| CoreError::BadMeta(key))
}

fn clean_name(raw: &str) -> Result<String, CoreError> {
    let name = raw.trim();
    let len = name.chars().count();
    if len == 0 || len > MAX_NAME_CHARS || name.chars().any(char::is_control) {
        return Err(CoreError::InvalidName);
    }
    Ok(name.to_string())
}

fn is_hex_color(s: &str) -> bool {
    s.len() == 7 && s.starts_with('#') && s[1..].chars().all(|c| c.is_ascii_hexdigit())
}

fn int_in(s: &str, lo: i32, hi: i32) -> bool {
    s.parse::<i32>().is_ok_and(|v| (lo..=hi).contains(&v))
}

/// Appearance settings are free-form names; these bounds keep the log small whatever a client sends.
pub const MAX_SETTING_KEY: usize = 40;
pub const MAX_LOOK_KEYS: usize = 48;

/// The kinds a part of the home can be named as (rooms, gardens and the places to spend time together).
pub const SECTION_KINDS: &[&str] = &["room", "hall", "kitchen", "bedroom", "bath", "lounge", "cinema", "games", "workshop", "garden", "farm", "orangery"];
pub const MAX_SECTION_NAME: usize = 32;
pub const MAX_SECTION_KEYS: usize = 96;

/// A key naming a part of the home: "room.<x>_<y>.name" or "room.<x>_<y>.kind", the cell being any cell of it.
fn section_key(key: &str) -> Option<&str> {
    let rest = key.strip_prefix("room.")?;
    let (cell, field) = rest.split_once('.')?;
    let (x, y) = cell.split_once('_')?;
    if !x.bytes().all(|b| b.is_ascii_digit()) || !y.bytes().all(|b| b.is_ascii_digit()) || !int_in(x, 0, room::GRID_LIMIT - 1) || !int_in(y, 0, room::GRID_LIMIT - 1) {
        return None;
    }
    matches!(field, "name" | "kind").then_some(field)
}

fn plain_name(value: &str) -> bool {
    let n = value.chars().count();
    n > 0 && n <= MAX_SECTION_NAME && !value.chars().any(char::is_control) && value.trim() == value
}

pub(crate) fn valid_setting(key: &str, value: &str) -> bool {
    if value.is_empty() {
        return matches!(key, "time_fixed" | "ambient_color" | "ambient_strength" | "home.name") || key.starts_with("look.") || section_key(key).is_some();
    }
    match key {
        "home.name" => plain_name(value),
        k if section_key(k) == Some("name") => plain_name(value),
        k if section_key(k) == Some("kind") => SECTION_KINDS.contains(&value),
        "time_mode" => matches!(value, "real" | "fixed"),
        "time_fixed" => value.split_once(':').is_some_and(|(h, m)| int_in(h, 0, 23) && int_in(m, 0, 59) && m.len() == 2),
        "ambient_color" => is_hex_color(value),
        "ambient_strength" => int_in(value, 0, 100),
        "shadows" => matches!(value, "0" | "1"),
        "wall_mode" => matches!(value, "full" | "cut" | "down"),
        k if k.starts_with("look.") && k.len() > 5 && k[5..].chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_') => {
            if k.ends_with("_color") {
                is_hex_color(value)
            } else {
                int_in(value, 0, 100)
            }
        }
        _ => false,
    }
}

impl Command {
    /// Whether the command can bring or move value (things, coins, friendship, places): these are what a bot
    /// would repeat, so only these count toward the per-minute limit. Arranging one's own home pays nothing and
    /// may be done as fast as one likes (a whole furnished house is placed in the first minute).
    pub fn counts_toward_limit(&self) -> bool {
        matches!(
            self,
            Command::Talk { .. }
                | Command::ClaimKit { .. }
                | Command::Gather { .. }
                | Command::Fish { .. }
                | Command::Deliver { .. }
                | Command::ClaimLetter { .. }
                | Command::AdvanceStory { .. }
                | Command::Restore { .. }
                | Command::TakeTaxi { .. }
                | Command::Gift { .. }
                | Command::Invite { .. }
                | Command::Travel { .. }
                | Command::Stash { .. }
                | Command::Take { .. }
                | Command::ThrowAway { .. }
                | Command::SellTo { .. }
                | Command::SellBack { .. }
                | Command::Use { .. }
                | Command::Help { .. }
                | Command::Interview { .. }
                | Command::NamePlayer { .. }
                | Command::SetHotbar { .. }
                | Command::SetOffhand { .. }
                | Command::SwapHands { .. }
                | Command::Wear { .. }
                | Command::TakeOff { .. }
                | Command::ToFridge { .. }
                | Command::FromFridge { .. }
                | Command::Cook { .. }
                | Command::PayBill { .. }
                | Command::PayAll
                | Command::QuestStart { .. }
                | Command::QuestStep { .. }
                | Command::TakeJob { .. }
                | Command::LeaveJob { .. }
                | Command::StartShift { .. }
                | Command::WorkStep { .. }
                | Command::EndShift
                | Command::Plant { .. }
                | Command::Water { .. }
                | Command::Harvest { .. }
                | Command::ClearPlot { .. }
                | Command::Play { .. }
                | Command::Busk { .. }
                | Command::Paint { .. }
                | Command::MakeHero { .. }
                | Command::Dress { .. }
                | Command::Haircut { .. }
                | Command::Rent { .. }
                | Command::Buy { .. }
                | Command::MoveHome { .. }
                | Command::EndLease { .. }
                | Command::Congratulate { .. }
                | Command::Contribute { .. }
                | Command::Dine { .. }
                | Command::Repair { .. }
                | Command::CallMaster { .. }
                | Command::Craft { .. }
                | Command::Tinker { .. }
                | Command::AcceptGift { .. }
                | Command::Lesson
                | Command::Theory { .. }
                | Command::StartExam
                | Command::EndExam { .. }
                | Command::BuyCar { .. }
                | Command::Refuel
                | Command::Service { .. }
                | Command::StartDrive { .. }
                | Command::Park { .. }
                | Command::Violation { .. }
                | Command::PayFine
                | Command::PickCoin { .. }
                | Command::OrderBuild { .. }
                | Command::FinishBuild { .. }
                | Command::Adopt { .. }
                | Command::PetCare { .. }
                | Command::Companion { .. }
        )
    }
}

impl<S: Storage> Core<S> {
    /// The latest world time the log has (0 for a new world).
    pub fn last_time(&self) -> WorldTime {
        self.last_key.map(|(t, _, _)| t).unwrap_or(WorldTime(0))
    }

    pub fn create(storage: S, device: u32, params: NewWorld) -> Result<Self, CoreError> {
        Self::create_with(storage, device, params, Arc::new(Content::empty()))
    }

    pub fn create_with(mut storage: S, device: u32, params: NewWorld, content: Arc<Content>) -> Result<Self, CoreError> {
        if storage.meta_get(META_WORLD_VERSION)?.is_some() {
            return Err(CoreError::AlreadyExists);
        }
        Self::write_meta(&mut storage, &params)?;
        Self::open_with(storage, device, content)
    }

    /// Opens the world in `storage`, creating its metadata first if the storage has none yet.
    /// For shells that keep only the event log and rebuild the rest at every start.
    pub fn bootstrap(mut storage: S, device: u32, params: NewWorld, content: Arc<Content>) -> Result<Self, CoreError> {
        if storage.meta_get(META_WORLD_VERSION)?.is_none() {
            Self::write_meta(&mut storage, &params)?;
        }
        Self::open_with(storage, device, content)
    }

    fn write_meta(storage: &mut S, params: &NewWorld) -> Result<(), CoreError> {
        storage.meta_set(META_SEED, &params.seed.to_string())?;
        storage.meta_set(META_EPOCH, &params.epoch_unix_secs.to_string())?;
        storage.meta_set(META_WORLD_VERSION, &CURRENT_WORLD_VERSION.to_string())?;
        storage.meta_set(META_REALM, "sandbox")?;
        Ok(())
    }

    /// `device` must be unique per installation; the shell generates and remembers it.
    pub fn open(storage: S, device: u32) -> Result<Self, CoreError> {
        Self::open_with(storage, device, Arc::new(Content::empty()))
    }

    pub fn open_with(storage: S, device: u32, content: Arc<Content>) -> Result<Self, CoreError> {
        let mut core = Self::open_parts(storage, device, content)?;
        core.replay()?;
        Ok(core)
    }

    /// The core over `storage` with its meta read, nothing replayed yet.
    fn open_parts(storage: S, device: u32, content: Arc<Content>) -> Result<Self, CoreError> {
        let seed = parse_meta(storage.meta_get(META_SEED)?, META_SEED)?;
        let world_version = parse_meta(storage.meta_get(META_WORLD_VERSION)?, META_WORLD_VERSION)?;
        let epoch_unix_secs = parse_meta(storage.meta_get(META_EPOCH)?, META_EPOCH)?;
        if world_version != CURRENT_WORLD_VERSION {
            return Err(CoreError::UnsupportedWorldVersion(world_version));
        }
        let realm = match storage.meta_get(META_REALM)?.ok_or(CoreError::MissingMeta(META_REALM))?.as_str() {
            "sandbox" => Realm::Sandbox,
            other => return Err(CoreError::UnsupportedRealm(other.to_string())),
        };
        let meta = WorldMeta { seed, world_version, epoch_unix_secs, realm };
        let secret = storage.meta_get(META_SECRET)?.and_then(|v| v.parse::<u64>().ok()).unwrap_or(0);
        let next_seq = storage.max_seq(device)?.map_or(0, |m| m + 1);
        let snapshot_day = storage.latest_snapshot()?.map(|s| s.through.0.day());
        let core = Self {
            life: std::cell::RefCell::new(LifeCache::default()),
            storage,
            meta,
            device,
            state: DeltaState::default(),
            next_seq,
            last_key: None,
            snapshot_day,
            content,
            secret,
            chain_tip: 0,
            integrity: crate::economy::Integrity::default(),
            jobs_cache: std::cell::RefCell::new(std::collections::BTreeMap::new()),
            older_rules: std::cell::Cell::new(false),
            town_cache: std::cell::RefCell::new(crate::town::TownCache::default()),
            tips: Default::default(),
            seqs: Default::default(),
            chained: Default::default(),
            inputs_seen: false,
            event_count: 0,
            base: None,
            last_snapshot: None,
            fresh_snapshot: None,
            inputs_since_snapshot: 0,
        };
        Ok(core)
    }

    /// Opens a world whose `storage` holds only the events after a snapshot the shell kept: `covered` is how
    /// many events the shell's log holds up to the snapshot. Refused (and the shell then opens the whole log)
    /// when the snapshot does not verify, or does not match the log.
    pub fn bootstrap_from_snapshot(mut storage: S, device: u32, params: NewWorld, content: Arc<Content>, snapshot: Snapshot, covered: u64) -> Result<Self, CoreError> {
        if storage.meta_get(META_WORLD_VERSION)?.is_none() {
            Self::write_meta(&mut storage, &params)?;
        }
        let secret = storage.meta_get(META_SECRET)?.and_then(|v| v.parse::<u64>().ok()).unwrap_or(0);
        if snapshot.mac != snapshot_mac(&snapshot, secret) || snapshot.covered != covered || storage.events_after(None)?.iter().any(|e| e.sort_key() <= snapshot.through) {
            return Err(CoreError::SnapshotRefused);
        }
        let mut core = Self::open_parts(storage, device, content)?;
        core.base = Some(snapshot);
        core.replay()?;
        Ok(core)
    }

    /// What opening the save found: events left out as forged or edited, old plain events trusted.
    pub fn integrity(&self) -> &crate::economy::Integrity {
        &self.integrity
    }

    /// Rebuilds the state from the log, trusting nothing: each device's events must chain, and every outcome must
    /// be what its input gives when run again. Plain events are trusted only from before the first input (saves
    /// made before inputs were logged). Whatever fails is left out (and counted), never fatal. It starts from a
    /// verified snapshot when there is one (the shell's, or the latest one in storage that matches the log), and
    /// then checks and replays only the events after it.
    fn replay(&mut self) -> Result<(), CoreError> {
        let base = match &self.base {
            Some(b) => Some(b.clone()),
            None => self.stored_snapshot()?,
        };
        self.replay_from(base)
    }

    /// The latest snapshot in storage, if it verifies and covers exactly the events the log has up to it.
    fn stored_snapshot(&self) -> Result<Option<Snapshot>, CoreError> {
        let Some(snap) = self.storage.latest_snapshot()? else { return Ok(None) };
        if snap.covered == 0 || snap.mac != snapshot_mac(&snap, self.secret) {
            return Ok(None);
        }
        if self.storage.count_through(snap.through)? != snap.covered {
            return Ok(None);
        }
        Ok(Some(snap))
    }

    fn replay_from(&mut self, base: Option<Snapshot>) -> Result<(), CoreError> {
        use crate::economy::link;
        let all = self.storage.events_after(base.as_ref().map(|b| b.through))?;
        if let Some(e) = all.iter().find(|e| e.rules_version > CURRENT_RULES_VERSION) {
            return Err(CoreError::UnsupportedRulesVersion(e.rules_version));
        }
        let from_snapshot = base.is_some();
        let base = base.unwrap_or_default();
        // 1. the chain, device by device in the order each wrote them (from the snapshot's tips)
        let mut by_device: std::collections::BTreeMap<u32, Vec<usize>> = std::collections::BTreeMap::new();
        for (i, e) in all.iter().enumerate() {
            by_device.entry(e.id.device).or_default().push(i);
        }
        let mut bad = vec![false; all.len()];
        let mut legacy = base.legacy;
        self.tips = base.tips.clone();
        self.seqs = base.seqs.clone();
        self.chained = base.chained.clone();
        for (device, mut idx) in by_device {
            idx.sort_by_key(|i| all[*i].id.seq);
            let mut tip = self.tips.get(&device).copied().unwrap_or(0);
            let mut chained = self.chained.contains(&device);
            for i in idx {
                let e = &all[i];
                let seq = self.seqs.entry(device).or_insert(e.id.seq);
                *seq = (*seq).max(e.id.seq);
                // what the game no longer has can no longer be re-encoded as it was written: its link is taken as
                // read (it changes nothing, and the next event's link still has to follow from it); a plain one from
                // before the chain is passed over in the replay
                if e.kind.is_retired() {
                    if e.chain != 0 {
                        tip = e.chain;
                        chained = true;
                        continue;
                    }
                    if !chained {
                        continue;
                    }
                }
                if e.chain == 0 {
                    if chained || matches!(e.kind, EventKind::Input { .. }) {
                        bad[i] = true;
                    } else {
                        legacy += 1;
                    }
                    continue;
                }
                if e.chain == link(tip, e, self.secret) {
                    tip = e.chain;
                    chained = true;
                } else {
                    bad[i] = true;
                }
            }
            if chained {
                self.chained.insert(device);
            }
            self.tips.insert(device, tip);
        }
        self.chain_tip = self.tips.get(&self.device).copied().unwrap_or(0);
        let mut dropped: Vec<EventId> = base.dropped.clone();
        dropped.extend(all.iter().zip(&bad).filter(|(_, b)| **b).map(|(e, _)| e.id));
        let kept: Vec<&Event> = all.iter().zip(&bad).filter(|(_, b)| !**b).map(|(e, _)| e).collect();
        // 2. the outcomes, input by input
        let multi = self.chained.len() > 1;
        // a snapshot made under older content holds the ids of then: read them as the current ones
        self.state = self.content.aliases.apply(&base.state).into_owned();
        let aliases = self.content.aliases.clone();
        let mut seen = base.inputs_seen;
        let mut inputs = base.inputs;
        let mut retired = base.retired;
        // out beyond the edge of a 1.x world (a place the game no longer has): what was done there is passed over
        let mut away = false;
        let mut i = 0;
        while i < kept.len() {
            let e = kept[i];
            let input = matches!(e.kind, EventKind::Input { .. }) || (e.kind.is_retired() && e.kind.retired_tag() == "Input");
            if input {
                let mut j = i + 1;
                let mut seq = e.id.seq;
                while j < kept.len()
                    && kept[j].id.device == e.id.device
                    && kept[j].time == e.time
                    && kept[j].id.seq == seq + 1
                    && !matches!(kept[j].kind, EventKind::Input { .. })
                    && !(kept[j].kind.is_retired() && kept[j].kind.retired_tag() == "Input")
                {
                    seq += 1;
                    j += 1;
                }
                let group = &kept[i..j];
                if let Some(back) = self.retired_group(group, away) {
                    // only the way back home counts: one is where one went (and nothing else of it happened)
                    away = !back;
                    for g in group {
                        if let EventKind::Travelled { to, .. } = &g.kind {
                            if back && self.live_place(to) {
                                self.state.apply(&aliases.apply(*g));
                            }
                        }
                    }
                    retired += group.len() as u32;
                    seen = true;
                    i = j;
                    continue;
                }
            } else if let Some(back) = self.retired_group(std::slice::from_ref(&e), away) {
                away = !back;
                if back && !seen && matches!(e.kind, EventKind::Travelled { .. }) {
                    self.state.apply(&aliases.apply(e));
                }
                retired += 1;
                i += 1;
                continue;
            }
            if let EventKind::Input { cmd, pack } = &e.kind {
                let mut j = i + 1;
                let mut seq = e.id.seq;
                while j < kept.len()
                    && kept[j].id.device == e.id.device
                    && kept[j].time == e.time
                    && kept[j].id.seq == seq + 1
                    && !matches!(kept[j].kind, EventKind::Input { .. })
                {
                    seq += 1;
                    j += 1;
                }
                let group = &kept[i + 1..j];
                // merged logs of several devices were each valid where they were made; this one must re-derive
                self.older_rules.set(*pack != self.content.fingerprint);
                let planned = if multi { None } else { Some(self.plan(e.time, aliases.apply(cmd).into_owned())) };
                self.older_rules.set(false);
                // under other content, a thing it names may be one the game no longer has (`Content::retired`)
                let mut gone = false;
                let ok = multi
                    || match planned.expect("planned unless merged") {
                        Ok(kinds) if *pack == self.content.fingerprint => kinds.len() == group.len() && kinds.iter().zip(group).all(|(k, g)| *k == g.kind),
                        // other content then (an update, the player's own items): the same kinds of outcome
                        Ok(kinds) => kinds.len() == group.len() && kinds.iter().zip(group).all(|(k, g)| std::mem::discriminant(k) == std::mem::discriminant(&g.kind)),
                        Err(err) => {
                            gone = *pack != self.content.fingerprint && matches!(&err, CoreError::UnknownItem(item) if self.content.retired.contains(item));
                            false
                        }
                    };
                if gone {
                    retired += 1 + group.len() as u32;
                } else if ok {
                    self.state.apply(&aliases.apply(e));
                    for g in group {
                        self.state.apply(&aliases.apply(*g));
                    }
                    inputs += 1;
                } else {
                    dropped.push(e.id);
                    dropped.extend(group.iter().map(|g| g.id));
                }
                seen = true;
                i = j;
            } else {
                if seen {
                    dropped.push(e.id);
                } else {
                    self.state.apply(&aliases.apply(e));
                }
                i += 1;
            }
        }
        dropped.sort();
        self.inputs_seen = seen;
        self.event_count = base.covered + all.len() as u64;
        self.last_key = all.iter().map(|e| e.sort_key()).max().into_iter().chain(from_snapshot.then_some(base.through)).max();
        let own_next = self.seqs.get(&self.device).map_or(0, |m| m + 1);
        self.next_seq = self.next_seq.max(own_next);
        // things the game no longer has leave the home and the inventory (whatever was done with them then stands)
        let st = &mut self.state;
        let gone: Vec<u32> = st.room.placements.iter().filter(|(_, p)| self.content.retired.contains(&p.item)).map(|(pid, _)| *pid).collect();
        for pid in &gone {
            st.room.placements.remove(pid);
        }
        for p in st.room.placements.values_mut() {
            if p.on.is_some_and(|on| gone.contains(&on)) {
                p.on = None;
            }
        }
        st.owned.retain(|item, _| !self.content.retired.contains(item));
        st.stashed.retain(|item, _| !self.content.retired.contains(item));
                self.integrity = crate::economy::Integrity { tampered: dropped.len() as u32, dropped, legacy, inputs, retired, from_snapshot };
        Ok(())
    }

    /// Whether a group of events (an input and what it did, or one plain event) is of something the game no
    /// longer has: a retired event in it, a way to a place that is gone, or anything done while out there
    /// (`away`). Then `Some(back)`: whether it came back to a place the game has (home, or a place of Lypove).
    fn retired_group(&self, group: &[&Event], away: bool) -> Option<bool> {
        let mut gone = away || group.iter().any(|g| g.kind.is_retired());
        let mut back = None;
        for g in group {
            if let EventKind::Travelled { to, .. } = &g.kind {
                let live = self.live_place(to);
                gone |= !live;
                back = Some(live);
            }
        }
        gone.then_some(back.unwrap_or(!away))
    }

    /// Home, or a place the content has (by its current id).
    fn live_place(&self, to: &str) -> bool {
        to == "home" || self.content.locations.contains_key(self.content.aliases.resolve(to))
    }

    /// The latest snapshot made (with what vouches for it).
    pub fn latest_snapshot(&self) -> Option<Snapshot> {
        self.last_snapshot.clone()
    }

    /// A snapshot made since the last call, for a shell that keeps snapshots itself (once each).
    pub fn take_new_snapshot(&mut self) -> Option<Snapshot> {
        self.fresh_snapshot.take()
    }

    /// A snapshot of now: the state, what the checks found, and its mac.
    fn make_snapshot(&self, through: SortKey) -> Snapshot {
        let mut snap = Snapshot {
            through,
            state: self.state.clone(),
            covered: self.event_count,
            tips: self.tips.clone(),
            seqs: self.seqs.clone(),
            chained: self.chained.clone(),
            legacy: self.integrity.legacy,
            inputs: self.integrity.inputs,
            dropped: self.integrity.dropped.clone(),
            retired: self.integrity.retired,
            inputs_seen: self.inputs_seen,
            mac: 0,
        };
        snap.mac = snapshot_mac(&snap, self.secret);
        snap
    }

    pub fn meta(&self) -> &WorldMeta {
        &self.meta
    }

    pub fn clock(&self) -> WorldClock {
        WorldClock { epoch_unix_secs: self.meta.epoch_unix_secs }
    }

    /// Whether the place the player is in is still open now (the Other Side closes at midnight after its day):
    /// one who stayed there finds nothing more, and can only go home.
    fn here_open(&self, now: WorldTime) -> Result<(), CoreError> {
        let req = self.content.locations.get(self.location()).and_then(|l| l.requires.as_ref());
        let missing = self.missing_for(req, now);
        if missing.is_empty() { Ok(()) } else { Err(CoreError::Locked(missing)) }
    }

    /// The world's seed (weather, climate, everything drawn by chance).
    pub(crate) fn meta_seed(&self) -> u64 {
        self.meta.seed
    }

    /// The real calendar: the world's seasons are the year's, not a game clock's.
    pub fn calendar(&self) -> Calendar {
        Calendar::from_epoch(self.meta.epoch_unix_secs)
    }

    pub fn view(&self, now: WorldTime) -> WorldView {
        WorldView {
            time: now,
            day: now.day(),
            minute_of_day: now.minute_of_day(),
            season: self.calendar().season(now),
            season_phase: self.calendar().phase(now),
            year: self.calendar().year(now),
            player_name: self.state.player_name.clone(),
            world_version: self.meta.world_version,
            kits: self.state.kits.iter().cloned().collect(),
        }
    }

    pub fn state(&self) -> &DeltaState {
        &self.state
    }

    pub fn content(&self) -> &Arc<Content> {
        &self.content
    }

    /// The language the world's words are shown in (only text: never an outcome).
    pub fn lang(&self) -> crate::content::Lang {
        self.content.lang
    }

    /// Shows the world's words in another language: the same packs (the same fingerprint) with other text.
    /// Refused for any other content, since that could change outcomes.
    pub fn retext(&mut self, content: Arc<Content>) -> bool {
        if content.fingerprint != self.content.fingerprint {
            return false;
        }
        self.content = content;
        // the derived caches hold words (names, jobs' texts): they are worked out again in the new language
        *self.life.borrow_mut() = LifeCache::default();
        self.jobs_cache.borrow_mut().clear();
        *self.town_cache.borrow_mut() = crate::town::TownCache::default();
        true
    }

    /// How many of `item` are owned but not placed in the room.
    /// The weather of the world now.
    pub fn weather(&self, now: WorldTime) -> crate::daily::Sky {
        crate::daily::weather_at(self.meta.seed, now, self.calendar().season(now))
    }

    /// The settlement at `now`: residents, damaged or burning sites, vehicles on the road, recent happenings.
    /// The simulation runs forward from where it was last asked; asking about an earlier time starts it again.
    /// A resident's plan for the day of `now` (work, school, mass, errands, or why they are off), told.
    pub fn schedule_of(&self, id: &str, now: WorldTime) -> Option<crate::life::ScheduleView> {
        self.town_ready(self.calendar().date(now));
        let tc = self.town_cache.borrow();
        let (_, people) = tc.people.as_ref().expect("ready");
        let world = crate::life::World::of_people(&self.content, people, tc.pop.as_ref().expect("ready")).with_calendar(self.calendar());
        crate::life::schedule_view(&world, self.meta.seed, id, now, self.content.lang)
    }

    /// Today in the real year: weekday, date, holiday, day off, school.
    pub fn day_view(&self, now: WorldTime) -> crate::life::DayView {
        crate::life::day_view(self.calendar(), now, self.content.lang)
    }

    /// The sky over the town now: the rift world of the day, an eclipse, a meteor night, a comet, the visitors.
    pub fn sky_view(&self, now: WorldTime) -> crate::sky::SkyView {
        crate::sky::sky_view_in(self.meta.seed, self.calendar(), now, self.content.lang)
    }

    /// The sky's stories for the paper of the day of `now`.
    pub fn sky_stories(&self, now: WorldTime) -> Vec<crate::sky::SkyStory> {
        crate::sky::stories_in(self.meta.seed, self.calendar().date(now), self.content.lang)
    }

    /// The world time of the next day (from `now`'s, within `days`) a sky event of `kind` happens, at its minute 0.
    pub fn sky_next(&self, kind: &str, now: WorldTime, days: u32) -> Option<u64> {
        let cal = self.calendar();
        let today = cal.date(now);
        crate::sky::next_date(self.meta.seed, kind, today, i64::from(days)).map(|d| (now.day() + (d - today) as u64) * crate::time::MINUTES_PER_DAY)
    }

    pub fn life_view(&self, now: WorldTime) -> crate::life::LifeView {
        self.town_ready(self.calendar().date(now));
        let tc = self.town_cache.borrow();
        let (_, people) = tc.people.as_ref().expect("ready");
        let world = crate::life::World::of_people(&self.content, people, tc.pop.as_ref().expect("ready")).with_calendar(self.calendar());
        let mut cell = self.life.borrow_mut();
        let cache = &mut *cell;
        // the people of the town changed (someone came, left, grew up): the simulation starts again
        let key = people.iter().fold(0xcbf2_9ce4_8422_2325u64, |h, r| {
            let s = format!("{}|{}|{}|{}|{:?};", r.id, r.age, r.young, r.pram, r.job);
            s.bytes().fold(h, |h, b| (h ^ u64::from(b)).wrapping_mul(0x0000_0100_0000_01b3))
        });
        if cache.people != key {
            cache.main = None;
            cache.marks.clear();
            cache.people = key;
        }
        // the simulation always runs from the start of the day a week before, so its cost stays the same
        // however old the world is, and the answer depends only on the seed, the content and the time
        let start = now.day().saturating_sub(crate::life::WINDOW_DAYS) * crate::life::TICKS_PER_DAY;
        let tick = now.0 / crate::life::TICK;
        let fits = |l: &crate::life::Life| l.start() == start && l.tick() <= tick;
        if cache.main.as_ref().is_some_and(|l| l.start() != start) {
            cache.marks.clear();
        }
        let mut earlier: Option<crate::life::Life> = None;
        if !cache.main.as_ref().is_some_and(|l| fits(l)) {
            // an earlier moment: the latest copy before it, or (a new window) from the start
            match cache.marks.iter().rev().find(|l| fits(l)) {
                Some(mark) if cache.main.as_ref().is_some_and(|l| l.start() == start) => earlier = Some(mark.clone()),
                Some(mark) => cache.main = Some(mark.clone()),
                None if cache.main.as_ref().is_some_and(|l| l.start() == start) => earlier = Some(crate::life::Life::new(&world, start)),
                None => {
                    let fresh = crate::life::Life::new(&world, start);
                    cache.marks = vec![fresh.clone()];
                    cache.main = Some(fresh);
                }
            }
        }
        let seed = self.meta.seed;
        // advance midnight by midnight, keeping a copy at each (stepping is the same however it is cut)
        let step = |life: &mut crate::life::Life, marks: Option<&mut Vec<crate::life::Life>>| {
            let mut marks = marks;
            loop {
                let next_midnight = (life.tick() / crate::life::TICKS_PER_DAY + 1) * crate::life::TICKS_PER_DAY;
                if next_midnight > tick {
                    break;
                }
                life.advance(seed, &world, WorldTime(next_midnight * crate::life::TICK));
                if let Some(m) = marks.as_deref_mut() {
                    if !m.iter().any(|x| x.tick() == life.tick()) {
                        m.push(life.clone());
                        if m.len() > 10 {
                            m.remove(0);
                        }
                    }
                }
            }
            life.advance(seed, &world, now);
        };
        let life: &mut crate::life::Life = match earlier.as_mut() {
            Some(l) => {
                step(l, None);
                l
            }
            None => {
                let main = cache.main.as_mut().expect("made above");
                step(main, Some(&mut cache.marks));
                main
            }
        };
        let mut view = life.view(&world, now);
        view.news = view
            .incidents
            .iter()
            .filter(|i| !matches!(i.kind, crate::life::IncidentKind::Delivery | crate::life::IncidentKind::Healed))
            .map(|i| crate::life::News { minute: i.minute, kind: i.kind, site: i.site.clone(), text: crate::life::tell(i, &self.content) })
            .collect();
        if self.content.sites.contains_key("dump_site") {
            view.dump = crate::life::dump_fill(self.meta.seed, now.day());
            for mut n in crate::life::dump_news(self.meta.seed, now.day().saturating_sub(crate::life::WINDOW_DAYS), now) {
                n.text = crate::life::tell(&crate::life::Incident { minute: n.minute, kind: n.kind, site: n.site.clone(), who: Vec::new() }, &self.content);
                view.news.push(n);
            }
            view.news.sort_by_key(|n| n.minute);
        }
        view
    }

    /// The real date of a world time and what kind of day it is (weekday, holiday, day off, school).
    pub fn calendar_day(&self, now: WorldTime) -> (i64, u32, u32, crate::holidays::DayInfo) {
        let date = self.calendar().date(now);
        let (y, m, d) = crate::time::civil_from_days(date);
        (y, m, d, crate::holidays::day_info(date).in_lang(self.content.lang))
    }

    /// What happened in town between two times (the town remembers a week back from `to`), in order.
    pub fn news_between(&self, from: WorldTime, to: WorldTime) -> Vec<crate::life::News> {
        if to < from {
            return Vec::new();
        }
        self.life_view(to).news.into_iter().filter(|n| n.minute >= from.0 && n.minute <= to.0).collect()
    }

    /// Every item with free (unplaced) copies, and how many.
    pub fn free_items(&self) -> std::collections::BTreeMap<String, u32> {
        self.state.owned.keys().map(|id| (id.clone(), self.free_count(id))).filter(|(_, n)| *n > 0).collect()
    }

    /// The collections that finding this item would complete.
    fn completed_by(&self, item: &str) -> Vec<EventKind> {
        self.content
            .collections
            .values()
            .filter(|c| !self.state.collections.contains(&c.id) && c.items.iter().any(|i| i == item))
            .filter(|c| c.items.iter().all(|i| i == item || self.state.collected.contains(i)))
            .map(|c| EventKind::CollectionCompleted { collection: c.id.clone(), reward: c.reward.clone() })
            .collect()
    }

    /// A find: it goes into the pocket (when it is a carried thing, there must be room); a collection it completes
    /// brings its reward, sent home when the pocket cannot take it.
    fn found(&self, event: EventKind, item: &str) -> Result<Vec<EventKind>, CoreError> {
        if self.is_carry(item) && !self.fits(&[item.to_string()], &[]) {
            return Err(CoreError::PocketFull);
        }
        let rewards = self.completed_by(item);
        let mut incoming = vec![item.to_string()];
        incoming.extend(rewards.iter().filter_map(|r| match r {
            EventKind::CollectionCompleted { reward, .. } => Some(reward.clone()),
            _ => None,
        }));
        let home = self.overflow(&incoming, 0);
        let mut events = vec![event];
        events.extend(rewards);
        events.extend(home);
        Ok(events)
    }

    pub fn free_count(&self, item: &str) -> u32 {
        let owned = self.state.owned.get(item).copied().unwrap_or(0);
        let placed = self.state.room.placements.values().filter(|p| p.item == item).count() as u32;
        owned.saturating_sub(placed)
    }

    pub fn wallet(&self) -> Wallet {
        Wallet {
            coins: (u64::from(self.content.start_coins) + self.state.earned).saturating_sub(self.state.spent),
            tokens: self.state.tokens.clone(),
            counters: self.state.counters.clone(),
        }
    }

    pub(crate) fn style_owned(&self, id: &str) -> bool {
        self.content.start_styles.values().any(|s| s == id) || self.state.room.owned_styles.contains(id)
    }

    /// Runs a command and returns its primary (first) event. Commands that produce several events
    /// (purchases, rewarded actions) report the first; use `apply_all` to see them all.
    pub fn apply(&mut self, now: WorldTime, command: Command) -> Result<Event, CoreError> {
        Ok(self.apply_all(now, command)?.remove(0))
    }

    fn guard(&self, now: WorldTime, command: &Command) -> Result<(), CoreError> {
        if let Some((last, _, _)) = self.last_key {
            if now < last {
                return Err(CoreError::ClockWentBackwards { last, now });
            }
        }
        if command.counts_toward_limit() && self.state.minute_inputs.0 == now.0 && self.state.minute_inputs.1 >= crate::economy::MAX_COMMANDS_PER_MINUTE {
            return Err(CoreError::TooFast);
        }
        Ok(())
    }

    /// Dry run: the verdict `apply_all` would give, without writing anything.
    pub fn check(&self, now: WorldTime, command: Command) -> Result<(), CoreError> {
        self.guard(now, &command)?;
        self.plan(now, command).map(|_| ())
    }

    /// Validates a command against the current state, then commits all its events atomically, and answers with
    /// what happened (the logged input left out; see `apply_logged`).
    pub fn apply_all(&mut self, now: WorldTime, command: Command) -> Result<Vec<Event>, CoreError> {
        Ok(self.apply_logged(now, command)?.into_iter().filter(|e| !matches!(e.kind, EventKind::Input { .. })).collect())
    }

    /// As `apply_all`, answering with every event written: the input first, then what it did.
    pub fn apply_logged(&mut self, now: WorldTime, command: Command) -> Result<Vec<Event>, CoreError> {
        // a command from older content (a shell of an older version) names the current ids
        let command = self.content.aliases.apply(&command).into_owned();
        self.guard(now, &command)?;
        let kinds = self.plan(now, command.clone())?;
        let input = EventKind::Input { cmd: command, pack: self.content.fingerprint };
        let mut events: Vec<Event> = std::iter::once(input)
            .chain(kinds)
            .enumerate()
            .map(|(i, kind)| Event {
                id: EventId { device: self.device, seq: self.next_seq + i as u64 },
                time: now,
                rules_version: CURRENT_RULES_VERSION,
                kind,
                chain: 0,
            })
            .collect();
        let mut tip = self.chain_tip;
        for e in &mut events {
            e.chain = crate::economy::link(tip, e, self.secret);
            tip = e.chain;
        }
        self.storage.append_batch(&events)?;
        self.chain_tip = tip;
        self.tips.insert(self.device, tip);
        self.chained.insert(self.device);
        self.seqs.insert(self.device, events.last().map_or(0, |e| e.id.seq));
        self.event_count += events.len() as u64;
        self.integrity.inputs += 1;
        self.inputs_seen = true;
        self.inputs_since_snapshot += 1;
        let first_key = events[0].sort_key();
        let out_of_order = self.last_key.is_some_and(|last| first_key <= last);
        self.next_seq += events.len() as u64;
        if out_of_order {
            // The events sort before something already folded in. Rebuild from the whole log so the
            // state is always the fold of the log in log order, whichever order events arrived in.
            self.replay()?;
        } else {
            for event in &events {
                self.state.apply(event);
            }
        }
        let newest = events.last().expect("a command yields at least one event").sort_key();
        let through = self.last_key.map_or(newest, |last| last.max(newest));
        self.last_key = Some(through);

        // A snapshot is only a cache of the log, so failing to save one must not fail a command
        // that is already committed. It is retried on the next apply.
        if out_of_order || self.snapshot_day != Some(now.day()) || self.inputs_since_snapshot >= SNAPSHOT_EVERY_INPUTS {
            let snapshot = self.make_snapshot(through);
            if self.storage.save_snapshot(&snapshot).is_ok() {
                self.snapshot_day = Some(through.0.day());
                self.inputs_since_snapshot = 0;
            }
            self.last_snapshot = Some(snapshot.clone());
            self.fresh_snapshot = Some(snapshot);
        }
        Ok(events)
    }

    fn pay(cost: &Cost) -> Vec<EventKind> {
        let mut out = Vec::new();
        if cost.coins > 0 {
            out.push(EventKind::CoinsSpent { amount: cost.coins });
        }
        for (kind, n) in &cost.tokens {
            if *n > 0 {
                out.push(EventKind::TokenSpent { kind: kind.clone(), n: *n });
            }
        }
        out
    }

    fn placement_spec(&self, pid: u32) -> Result<PlacementSpec, CoreError> {
        let p = self.state.room.placements.get(&pid).ok_or(CoreError::UnknownPlacement(pid))?;
        Ok(PlacementSpec { item: p.item.clone(), x: p.x, y: p.y, rot: p.rot, wall: p.wall, on: p.on })
    }

    fn ensure_no_children(&self, pid: u32) -> Result<(), CoreError> {
        if room::children_of(&self.state.room, pid).is_empty() {
            Ok(())
        } else {
            Err(CoreError::Place(PlaceError::HostHasItems))
        }
    }

    fn check_paint_style(&self, style: &str, kind: &str) -> Result<(), CoreError> {
        let def = self.content.styles.get(style).ok_or_else(|| CoreError::UnknownStyle(style.to_string()))?;
        if def.kind != kind {
            return Err(CoreError::UnknownStyle(style.to_string()));
        }
        if !self.style_owned(style) {
            return Err(CoreError::StyleNotOwned);
        }
        Ok(())
    }

    /// Turns a command into the events it would produce, without changing any state.
    /// What a command would do: its own events, and the quests they move on (a station used, a dish cooked,
    /// something gathered or caught).
    fn plan(&self, now: WorldTime, command: Command) -> Result<Vec<EventKind>, CoreError> {
        let hooked = matches!(command, Command::Use { .. } | Command::Cook { .. } | Command::Gather { .. } | Command::Fish { .. });
        let mut events = self.plan_command(now, command)?;
        if hooked && !self.state.quests.is_empty() {
            let more = self.quest_hooks(now, &events);
            events.extend(more);
        }
        Ok(events)
    }

    fn plan_command(&self, now: WorldTime, command: Command) -> Result<Vec<EventKind>, CoreError> {
        let content = &self.content;
        let room_state = &self.state.room;
        match command {
            Command::NamePlayer { name } => Ok(vec![EventKind::PlayerNamed { name: clean_name(&name)? }]),
            Command::SetHotbar { slot, item } => {
                if slot as usize >= crate::economy::HOTBAR {
                    return Err(CoreError::NoRequest);
                }
                if let Some(i) = &item {
                    if !self.is_carry(i) || self.in_pocket(i) == 0 {
                        return Err(CoreError::NotEnough);
                    }
                }
                Ok(vec![EventKind::HotbarSet { slot, item }])
            }
            Command::SetOffhand { item } => {
                if let Some(i) = &item {
                    if !self.is_carry(i) || self.carried(i) == 0 {
                        return Err(CoreError::NotEnough);
                    }
                }
                Ok(vec![EventKind::OffhandSet { item }])
            }
            Command::SwapHands { slot } => {
                if slot as usize >= crate::economy::HOTBAR {
                    return Err(CoreError::NoRequest);
                }
                Ok(vec![EventKind::HandsSwapped { slot }])
            }
            Command::Wear { item } => {
                let armor = content.items.get(&item).and_then(|d| d.armor.clone()).ok_or(CoreError::NoRequest)?;
                if self.carried(&item) == 0 {
                    return Err(CoreError::NotEnough);
                }
                // the piece worn there till now goes back into the inventory: its kind needs a place there
                if let Some(old) = self.state.armor.get(&armor.slot).filter(|o| **o != item) {
                    if !self.fits(&[old.clone()], &[item.clone()]) {
                        return Err(CoreError::PocketFull);
                    }
                }
                Ok(vec![EventKind::Worn { item, slot: armor.slot }])
            }
            Command::TakeOff { slot } => {
                let item = self.state.armor.get(&slot).cloned().ok_or(CoreError::NoRequest)?;
                // back into the inventory: its kind needs a place there
                if !self.fits(&[item], &[]) {
                    return Err(CoreError::PocketFull);
                }
                Ok(vec![EventKind::TakenOff { slot }])
            }
            Command::Acquire { item } => {
                let def = content.items.get(&item).filter(|d| !d.hidden || d.wear.is_some()).ok_or_else(|| CoreError::UnknownItem(item.clone()))?;
                if (def.unique || def.wear.is_some()) && self.state.owned.get(&item).copied().unwrap_or(0) > 0 {
                    return Err(CoreError::AlreadyOwned);
                }
                // clothes are bought at the clothes shop, in its hours
                if def.wear.is_some() {
                    self.garment_check(now)?;
                }
                let cost = unlock::check(&def.acquire, &self.wallet(), self.calendar().season(now)).map_err(CoreError::Locked)?;
                let mut events = Self::pay(&cost);
                events.push(EventKind::ItemAcquired { item });
                Ok(events)
            }
            Command::AcquireStyle { style } => {
                let def = content.styles.get(&style).ok_or_else(|| CoreError::UnknownStyle(style.clone()))?;
                if self.style_owned(&style) {
                    return Err(CoreError::AlreadyOwned);
                }
                let cost = unlock::check(&def.acquire, &self.wallet(), self.calendar().season(now)).map_err(CoreError::Locked)?;
                let mut events = Self::pay(&cost);
                events.push(EventKind::StyleAcquired { style });
                Ok(events)
            }
            Command::Place { item, x, y, rot, wall, on } => {
                if !content.items.contains_key(&item) {
                    return Err(CoreError::UnknownItem(item));
                }
                if self.free_count(&item) == 0 {
                    return Err(CoreError::NotOwned(item));
                }
                let spec = PlacementSpec { item: item.clone(), x, y, rot, wall, on };
                room::validate(content, room_state, &spec, None).map_err(CoreError::Place)?;
                Ok(vec![EventKind::Placed { pid: room_state.next_pid, item, x, y, rot, wall, on }])
            }
            Command::Move { pid, x, y, wall, on } => {
                let mut spec = self.placement_spec(pid)?;
                self.ensure_no_children(pid)?;
                spec.x = x;
                spec.y = y;
                spec.wall = wall;
                spec.on = on;
                room::validate(content, room_state, &spec, Some(pid)).map_err(CoreError::Place)?;
                Ok(vec![EventKind::Moved { pid, x, y, wall, on }])
            }
            Command::Rotate { pid, rot } => {
                let mut spec = self.placement_spec(pid)?;
                self.ensure_no_children(pid)?;
                spec.rot = rot;
                room::validate(content, room_state, &spec, Some(pid)).map_err(CoreError::Place)?;
                Ok(vec![EventKind::Rotated { pid, rot }])
            }
            Command::Recolor { pid, slot, color } => {
                let spec = self.placement_spec(pid)?;
                let def = content.items.get(&spec.item).ok_or_else(|| CoreError::UnknownItem(spec.item.clone()))?;
                if !def.slots.contains_key(&slot) {
                    return Err(CoreError::InvalidSlot);
                }
                if !is_hex_color(&color) {
                    return Err(CoreError::InvalidColor);
                }
                Ok(vec![EventKind::Recolored { pid, slot, color: color.to_ascii_lowercase() }])
            }
            Command::Store { pid } => {
                self.placement_spec(pid)?;
                self.ensure_no_children(pid)?;
                Ok(vec![EventKind::Stored { pid }])
            }
            Command::SetStyle { kind, style } => {
                let def = content.styles.get(&style).ok_or_else(|| CoreError::UnknownStyle(style.clone()))?;
                if def.kind != kind {
                    return Err(CoreError::UnknownStyle(style));
                }
                if !self.style_owned(&style) {
                    return Err(CoreError::StyleNotOwned);
                }
                Ok(vec![EventKind::StyleSet { kind, style }])
            }
            Command::Expand { expansion } => {
                let def = content
                    .expansions
                    .get(&expansion)
                    .ok_or_else(|| CoreError::UnknownExpansion(expansion.clone()))?;
                if room_state.expansions.contains(&expansion) {
                    return Err(CoreError::AlreadyExpanded);
                }
                let cost = unlock::check(&def.acquire, &self.wallet(), self.calendar().season(now)).map_err(CoreError::Locked)?;
                let mut events = Self::pay(&cost);
                events.push(EventKind::RoomExpanded { expansion });
                Ok(events)
            }
            Command::BuyArea { cells } => {
                let max = (room::GRID_LIMIT * room::GRID_LIMIT) as u32;
                if content.cell_price == 0 || cells == 0 || room::area_budget(content, room_state).saturating_add(cells) > max {
                    return Err(CoreError::Room(RoomError::TooManyCells));
                }
                let price = unlock::Unlock::Coins(content.cell_price.saturating_mul(cells));
                let cost = unlock::check(&price, &self.wallet(), self.calendar().season(now)).map_err(CoreError::Locked)?;
                let mut events = Self::pay(&cost);
                events.push(EventKind::AreaBought { cells });
                Ok(events)
            }
            Command::PaintCells { add, remove } => {
                if add.is_empty() && remove.is_empty() {
                    return Err(CoreError::Room(RoomError::Nothing));
                }
                room::validate_cells(content, room_state, &add, &remove).map_err(CoreError::Room)?;
                Ok(vec![EventKind::CellsChanged { add, remove }])
            }
            Command::SetDivider { x, y, side, on } => {
                room::validate_divider(content, room_state, x, y, side, on).map_err(CoreError::Room)?;
                Ok(vec![EventKind::DividerSet { x, y, side, on }])
            }
            Command::PaintFloor { cells, style } => {
                if cells.is_empty() {
                    return Err(CoreError::Room(RoomError::Nothing));
                }
                if cells.len() > room::BATCH_LIMIT {
                    return Err(CoreError::Room(RoomError::TooMany));
                }
                let room_cells = room::cells(content, room_state);
                if cells.iter().any(|c| !room_cells.contains(c)) {
                    return Err(CoreError::Room(RoomError::NotInRoom));
                }
                if let Some(s) = &style {
                    self.check_paint_style(s, "floor")?;
                }
                Ok(vec![EventKind::FloorPainted { cells, style }])
            }
            Command::PaintWall { edges, style } => {
                if edges.is_empty() {
                    return Err(CoreError::Room(RoomError::Nothing));
                }
                if edges.len() > room::BATCH_LIMIT {
                    return Err(CoreError::Room(RoomError::TooMany));
                }
                let room_cells = room::cells(content, room_state);
                if edges.iter().any(|(x, y, side)| !room::is_wall_edge(&room_cells, &room_state.dividers, *x, *y, *side)) {
                    return Err(CoreError::Room(RoomError::NotAWall));
                }
                if let Some(s) = &style {
                    self.check_paint_style(s, "wall")?;
                }
                Ok(vec![EventKind::WallPainted { edges, style }])
            }
            Command::SetProp { pid, key, value } => {
                let spec = self.placement_spec(pid)?;
                let def = content.items.get(&spec.item).ok_or_else(|| CoreError::UnknownItem(spec.item.clone()))?;
                let ok = match key.as_str() {
                    "mirror" | "lit" => matches!(value.as_str(), "0" | "1" | ""),
                    "nudge_x" | "nudge_y" => value.is_empty() || int_in(&value, -50, 50),
                    "light_color" => value.is_empty() || is_hex_color(&value),
                    "light_strength" => value.is_empty() || int_in(&value, 0, 100),
                    "art" => def.tags.iter().any(|t| t == "canvas") && (value.is_empty() || self.painting_exists(&value)),
                    // the record on a record player (one the player has), the station a radio is tuned to
                    "record" => def.tags.iter().any(|t| t == "music") && (value.is_empty() || (self.state.owned.get(&value).copied().unwrap_or(0) > 0 && content.items.get(&value).is_some_and(|r| r.tags.iter().any(|t| t == "record")))),
                    "station" => def.tags.iter().any(|t| t == "music" || t == "power") && value.len() <= 16 && value.bytes().all(|b| b.is_ascii_lowercase() || b == b'_'),
                    k if k.starts_with("finish.") => {
                        let slot = &k["finish.".len()..];
                        def.slots.contains_key(slot) && (value.is_empty() || content.materials.contains_key(&value))
                    }
                    _ => false,
                };
                if !ok {
                    return Err(CoreError::InvalidProp);
                }
                // nothing electric switches on while the electricity is off for an unpaid bill
                if key == "lit" && value == "1" {
                    if let Some(off) = self.utility_off_for(now, &spec.item).filter(|u| u == "power") {
                        return Err(CoreError::UtilityOff(off));
                    }
                    if self.location() == "home" {
                        self.check_working(pid, now)?;
                    }
                }
                Ok(vec![EventKind::PropSet { pid, key, value }])
            }
            Command::SetSetting { key, value } => {
                if crate::style::fixed_key(&key) && self.look_fixed() {
                    return Err(CoreError::LookFixed);
                }
                if !valid_setting(&key, &value) || key.len() > MAX_SETTING_KEY {
                    return Err(CoreError::InvalidSetting);
                }
                let sections = room_state.settings.keys().filter(|k| k.starts_with("room.")).count();
                if section_key(&key).is_some() && !value.is_empty() && !room_state.settings.contains_key(&key) && sections >= MAX_SECTION_KEYS {
                    return Err(CoreError::InvalidSetting);
                }
                let looks = room_state.settings.keys().filter(|k| k.starts_with("look.")).count();
                if key.starts_with("look.") && !room_state.settings.contains_key(&key) && looks >= MAX_LOOK_KEYS {
                    return Err(CoreError::InvalidSetting);
                }
                Ok(vec![EventKind::SettingSet { key, value }])
            }
            Command::AcquireTheme { theme } => {
                let def = content.themes.get(&theme).ok_or_else(|| CoreError::UnknownTheme(theme.clone()))?;
                if room_state.owned_themes.contains(&theme) {
                    return Err(CoreError::AlreadyOwned);
                }
                let cost = unlock::check(&def.acquire, &self.wallet(), self.calendar().season(now)).map_err(CoreError::Locked)?;
                let mut events = Self::pay(&cost);
                events.push(EventKind::ThemeAcquired { theme, styles: def.styles.values().cloned().collect() });
                Ok(events)
            }
            Command::Gather { spot } => {
                let def = content.spots.get(&spot).ok_or(CoreError::NothingThere)?;
                if content.spot_location.get(&spot).is_some_and(|l| l != self.location()) {
                    return Err(CoreError::NotHere);
                }
                self.here_open(now)?;
                let day = now.day();
                if self.state.gathered.get(&spot) == Some(&day) || !crate::daily::spot_has_today(self.meta.seed, def, day) {
                    return Err(CoreError::NothingThere);
                }
                let item = crate::daily::pick(self.meta.seed, crate::daily::GATHER, crate::daily::stream_of(&spot), day, &def.gives, now, self.calendar().season(now)).ok_or(CoreError::NothingThere)?;
                self.found(EventKind::Gathered { spot, day, item: item.clone() }, &item)
            }
            Command::Fish { place } => {
                let def = content.fishing.get(&place).ok_or(CoreError::NothingThere)?;
                if content.fishing_location.get(&place).is_some_and(|l| l != self.location()) {
                    return Err(CoreError::NotHere);
                }
                self.here_open(now)?;
                let day = now.day();
                let today = if self.state.catches.0 == day { self.state.catches.1 } else { 0 };
                if today >= crate::daily::CATCHES_PER_DAY {
                    return Err(CoreError::TooSoon);
                }
                let tick = now.0 * 16 + u64::from(today);
                // rare fish come a little more often to a skilled hand
                let gear: Vec<String> = ["fishing_rod_good", "fishing_lure"].iter().filter(|t| self.owns_tool(t)).map(|t| t.to_string()).collect();
                let level = crate::skills::level_of(self.practice("fishing")) + gear.len() as u32;
                let fish: Vec<crate::daily::GiveDef> = def.fish.iter().map(|g| crate::daily::GiveDef { weight: crate::skills::fish_weight(g.weight, level), ..g.clone() }).collect();
                let item = crate::daily::pick(self.meta.seed, crate::daily::FISH, crate::daily::stream_of(&place), tick, &fish, now, self.calendar().season(now)).ok_or(CoreError::NothingThere)?;
                let mut events = self.found(EventKind::Caught { place, day, item: item.clone() }, &item)?;
                events.extend(self.tools_used(&gear));
                Ok(events)
            }
            Command::Deliver { npc } => {
                let day = now.day();
                let (_, index) = crate::daily::requests_of(self.meta.seed, content, now, self.calendar().season(now)).into_iter().find(|(n, _)| *n == npc).ok_or(CoreError::NoRequest)?;
                if self.state.delivered.contains(&format!("{day}:{npc}")) {
                    return Err(CoreError::NoRequest);
                }
                let ask = &content.npcs[&npc].asks[index];
                let items = crate::daily::take_for(content, &self.pocket_items(), &ask.items).ok_or(CoreError::NotEnough)?;
                let gift = ask.gift.clone().filter(|_| !self.state.ask_gifts.contains(&format!("{npc}:{index}")));
                let leaving = items.iter().filter(|i| self.is_carry(i)).count() as u32;
                let home = self.overflow(&gift.iter().cloned().collect::<Vec<_>>(), leaving);
                let mut events = vec![EventKind::Delivered { npc, day, ask: index as u32, items, points: crate::daily::REQUEST_POINTS, coins: ask.coins, gift }];
                events.extend(home);
                Ok(events)
            }
            Command::ClaimLetter { npc, letter } => {
                let def = content.npcs.get(&npc).ok_or_else(|| CoreError::UnknownNpc(npc.clone()))?;
                let l = def.letters.get(letter as usize).ok_or(CoreError::NoRequest)?;
                let hearts = self.state.relations.get(&npc).map(|r| r.hearts()).unwrap_or(0);
                if hearts < l.hearts || self.state.letters.contains(&format!("{npc}:{letter}")) {
                    return Err(CoreError::NoRequest);
                }
                let mut events = vec![EventKind::LetterClaimed { npc, letter, gift: l.gift.clone() }];
                events.extend(self.overflow(&l.gift.iter().cloned().collect::<Vec<_>>(), 0));
                Ok(events)
            }
            Command::AdvanceStory { npc } => {
                let def = content.npcs.get(&npc).ok_or_else(|| CoreError::UnknownNpc(npc.clone()))?;
                let (done, last) = self.state.story.get(&npc).copied().unwrap_or((0, 0));
                let chapter = def.story.get(done as usize).ok_or(CoreError::NoRequest)?;
                let hearts = self.state.relations.get(&npc).map(|r| r.hearts()).unwrap_or(0);
                if hearts < chapter.hearts {
                    return Err(CoreError::NotFriendsYet);
                }
                if done > 0 && now.day() < last + chapter.after_days {
                    return Err(CoreError::TooSoon);
                }
                let items = match &chapter.ask {
                    Some(ask) => crate::daily::take_for(content, &self.pocket_items(), &ask.items).ok_or(CoreError::NotEnough)?,
                    None => Vec::new(),
                };
                let leaving = items.iter().filter(|i| self.is_carry(i)).count() as u32;
                let home = self.overflow(&chapter.gift.iter().cloned().collect::<Vec<_>>(), leaving);
                let mut events = vec![EventKind::StoryAdvanced { npc, step: done, day: now.day(), items, gift: chapter.gift.clone() }];
                events.extend(home);
                Ok(events)
            }
            Command::TakeTaxi { to, from, x, y, fare: shown } => {
                if self.jailed(now) {
                    return Err(CoreError::Jailed);
                }
                if from != self.location() {
                    return Err(CoreError::NotHere);
                }
                let dest = self.taxi_dests(now).into_iter().find(|d| d.id == to).ok_or(CoreError::NoRequest)?;
                let fare = match shown {
                    // the price of the minute (by demand) must be the one the player agreed to
                    Some(shown) => {
                        let q = self.taxi_quote(now, (&from, x, y), &dest).ok_or(CoreError::NoRequest)?;
                        if q.fare != shown {
                            return Err(CoreError::FareChanged { fare: q.fare });
                        }
                        q.fare
                    }
                    None => taxi_fare(content, (&from, x, y), &dest).ok_or(CoreError::NoRequest)?,
                };
                let have = self.wallet().coins;
                if have < u64::from(fare) {
                    return Err(CoreError::Locked(vec![crate::unlock::Missing::Coins { have, need: u64::from(fare) }]));
                }
                let mut events = vec![EventKind::CoinsSpent { amount: fare }];
                if dest.location != self.location() {
                    let missing = content.locations.get(&dest.location).map(|l| self.missing_for(l.requires.as_ref(), now)).unwrap_or_default();
                    if !missing.is_empty() {
                        return Err(CoreError::Locked(missing));
                    }
                    events.push(EventKind::Travelled { to: dest.location.clone(), day: now.day() });
                }
                Ok(events)
            }
            Command::Restore { item } => {
                let def = content.items.get(&item).ok_or_else(|| CoreError::UnknownItem(item.clone()))?;
                let into = def.restores.clone().ok_or_else(|| CoreError::UnknownItem(item.clone()))?;
                if self.available(&item) == 0 {
                    return Err(CoreError::NotEnough);
                }
                let coins = restore_price(content, &into) * (100 - crate::skills::mend_discount(crate::skills::level_of(self.practice("crafting")))) / 100;
                if self.wallet().coins < u64::from(coins) {
                    return Err(CoreError::Locked(vec![crate::unlock::Missing::Coins { have: self.wallet().coins, need: u64::from(coins) }]));
                }
                Ok(vec![EventKind::Restored { worn: item, into, coins }])
            }
            Command::ClaimKit { kit } => {
                let def = content.kits.get(&kit).ok_or_else(|| CoreError::UnknownItem(kit.clone()))?;
                if self.state.kits.contains(&kit) {
                    return Err(CoreError::AlreadyOwned);
                }
                Ok(vec![EventKind::KitClaimed { kit, items: def.items.clone(), styles: def.styles.clone() }])
            }
            Command::Talk { npc } if !content.npcs.contains_key(&npc) => self.plan_talk_resident(now, &npc),
            Command::Talk { npc } => {
                let def = content.npcs.get(&npc).ok_or_else(|| CoreError::UnknownNpc(npc.clone()))?;
                let rel = self.state.relations.get(&npc).cloned().unwrap_or_default();
                let today = now.day();
                let count = if rel.talk_day.0 == today && rel.talks > 0 { rel.talk_day.1 } else { 0 };
                if count >= crate::npc::TALKS_PER_DAY {
                    return Err(CoreError::TooSoon);
                }
                // a talk at home, while they visit, means more than one in passing
                let visiting = matches!(rel.visit, Some((from, until)) if from <= now.0 && now.0 < until);
                let delta = if count > 0 { 0 } else if visiting { 2 * crate::npc::TALK_POINTS } else { crate::npc::TALK_POINTS };
                let mut events = vec![EventKind::NpcTalked { npc: npc.clone(), day: today, delta }];
                let hearts = ((rel.points + delta).min(crate::npc::MAX_POINTS)) / crate::npc::POINTS_PER_HEART;
                if let Some(gift) = def.gifts.iter().find(|g| g.hearts <= hearts && !rel.received.contains(&g.item)) {
                    events.push(EventKind::NpcGaveGift { npc: npc.clone(), item: gift.item.clone() });
                    events.extend(self.overflow(std::slice::from_ref(&gift.item), 0));
                }
                Ok(events)
            }
            Command::Gift { npc, item } if !content.npcs.contains_key(&npc) => self.plan_gift_resident(now, &npc, &item),
            Command::Gift { npc, item } => {
                let def = content.npcs.get(&npc).ok_or_else(|| CoreError::UnknownNpc(npc.clone()))?;
                let item_def = content.items.get(&item).ok_or_else(|| CoreError::UnknownItem(item.clone()))?;
                // things free in the catalogue are no gifts; things found in the world (hidden from it) are
                if (matches!(item_def.acquire, crate::unlock::Unlock::Free) && !item_def.hidden) || item_def.key {
                    return Err(CoreError::NoGift);
                }
                if self.available(&item) == 0 {
                    return Err(CoreError::NotOwned(item));
                }
                let rel = self.state.relations.get(&npc).cloned().unwrap_or_default();
                if rel.gift_day == Some(now.day()) {
                    return Err(CoreError::TooSoon);
                }
                let taste = crate::npc::taste(def, &item, &item_def.tags, &item_def.category);
                let delta = match taste {
                    1 => crate::npc::GIFT_LIKED,
                    -1 => crate::npc::GIFT_DISLIKED,
                    _ => crate::npc::GIFT_NEUTRAL,
                };
                Ok(vec![EventKind::NpcGifted { npc, item, day: now.day(), delta, taste }])
            }
            Command::Invite { npc, from, until } => {
                content.npcs.get(&npc).ok_or_else(|| CoreError::UnknownNpc(npc.clone()))?;
                let rel = self.state.relations.get(&npc).cloned().unwrap_or_default();
                if rel.hearts() < crate::npc::INVITE_HEARTS {
                    return Err(CoreError::NotFriendsYet);
                }
                if from < now.0 || from > now.0 + crate::time::MINUTES_PER_DAY || until <= from || until - from > crate::npc::VISIT_MAX_MINUTES {
                    return Err(CoreError::BadVisit);
                }
                Ok(vec![EventKind::NpcInvited { npc, from, until }])
            }
            Command::ApplyTheme { theme } => {
                let def = content.themes.get(&theme).ok_or_else(|| CoreError::UnknownTheme(theme.clone()))?;
                if !room_state.owned_themes.contains(&theme) {
                    return Err(CoreError::StyleNotOwned);
                }
                let mut events: Vec<EventKind> = def
                    .styles
                    .iter()
                    .map(|(kind, style)| EventKind::StyleSet { kind: kind.clone(), style: style.clone() })
                    .collect();
                for (key, value) in &def.settings {
                    if !valid_setting(key, value) {
                        return Err(CoreError::InvalidSetting);
                    }
                    events.push(EventKind::SettingSet { key: key.clone(), value: value.clone() });
                }
                if events.is_empty() {
                    return Err(CoreError::InvalidSetting);
                }
                Ok(events)
            }
            Command::Travel { to } => {
                if self.jailed(now) {
                    return Err(CoreError::Jailed);
                }
                if to != "home" {
                    let def = content.locations.get(&to).ok_or_else(|| CoreError::UnknownLocation(to.clone()))?;
                    let missing = self.missing_for(def.requires.as_ref(), now);
                    if !missing.is_empty() {
                        return Err(CoreError::Locked(missing));
                    }
                    if def.invite_only && self.dinner_now(now).is_none() {
                        return Err(CoreError::NotInvited);
                    }
                    // a shut shop or office is not walked into (whoever is inside already stays)
                    if to != self.location() && !self.older_rules.get() && !self.place_open(now, def) {
                        return Err(CoreError::Closed);
                    }
                }
                // walking away from work ends the shift (paid for what was done)
                let mut events = self.end_shift_events();
                events.push(EventKind::Travelled { to, day: now.day() });
                Ok(events)
            }
            Command::Stash { item, n } => {
                if self.location() != "home" {
                    return Err(CoreError::NotHere);
                }
                if n == 0 || !self.is_carry(&item) || self.in_pocket(&item) < n {
                    return Err(CoreError::NotEnough);
                }
                Ok(vec![EventKind::Stashed { item, n }])
            }
            Command::Take { item, n } => {
                if self.location() != "home" {
                    return Err(CoreError::NotHere);
                }
                if n == 0 || self.in_chest(&item) < n {
                    return Err(CoreError::NotEnough);
                }
                if !self.fits(&vec![item.clone(); n as usize], &[]) {
                    return Err(CoreError::PocketFull);
                }
                Ok(vec![EventKind::Taken { item, n }])
            }
            Command::SellTo { station, item, n } => {
                let def = content.stations.get(&station).ok_or_else(|| CoreError::UnknownStation(station.clone()))?;
                if !self.is_here(&def.location) {
                    return Err(CoreError::NotHere);
                }
                self.here_open(now)?;
                // its hours and days first: a shut stall buys nothing
                self.station_plan(now, def)?;
                let price = self.buy_price(def, &item).ok_or(CoreError::NotBought)?;
                if n == 0 || !self.is_carry(&item) || self.in_pocket(&item) < n {
                    return Err(CoreError::NotEnough);
                }
                let used = self.state.station_uses.get(&station).filter(|(d, _)| *d == now.day()).map(|(_, k)| *k).unwrap_or(0);
                if def.per_day > 0 && used + n > def.per_day {
                    return Err(CoreError::TooSoon);
                }
                Ok(vec![EventKind::SoldTo { station, item, n, coins: price * n, day: now.day() }])
            }
            Command::SellBack { item } => {
                let def = content.items.get(&item).ok_or_else(|| CoreError::UnknownItem(item.clone()))?;
                if self.location() != "home" {
                    return Err(CoreError::NotHere);
                }
                if def.key || def.carry || def.wear.is_some() || self.free_count(&item) == 0 {
                    return Err(CoreError::NotEnough);
                }
                let coins = unlock::coin_price(&def.acquire) * crate::economy::SELL_BACK_PERCENT / 100;
                if coins == 0 {
                    return Err(CoreError::NotBought);
                }
                let used = self.state.station_uses.get(crate::economy::SELL_BACK).filter(|(d, _)| *d == now.day()).map(|(_, k)| *k).unwrap_or(0);
                if used >= crate::economy::SELL_BACK_PER_DAY {
                    return Err(CoreError::TooSoon);
                }
                Ok(vec![EventKind::SoldBack { item, coins, day: now.day() }])
            }
            Command::ThrowAway { item, n } => {
                // keys stay on the ring; only what the pocket holds can go
                if n == 0 || !self.is_carry(&item) || self.in_pocket(&item) < n {
                    return Err(CoreError::NotEnough);
                }
                Ok(vec![EventKind::ThrownAway { item, n }])
            }
            Command::Use { station } => {
                let def = content.stations.get(&station).ok_or_else(|| CoreError::UnknownStation(station.clone()))?;
                if !self.is_here(&def.location) {
                    return Err(CoreError::NotHere);
                }
                self.here_open(now)?;
                let (took, gave) = self.station_plan(now, def)?;
                let tools: Vec<String> = def.requires.iter().flat_map(|r| r.items.iter()).filter(|i| content.tools.contains_key(*i)).cloned().collect();
                let mut events = vec![EventKind::Used { station, day: now.day(), took, gave, cost: def.cost, earn: def.earn }];
                events.extend(self.tools_used(&tools));
                Ok(events)
            }
            Command::Help { help } => {
                let def = content.helps.get(&help).ok_or_else(|| CoreError::UnknownHelp(help.clone()))?;
                if self.state.helped.contains(&help) {
                    return Err(CoreError::AlreadyDone);
                }
                if !self.is_here(&def.location) {
                    return Err(CoreError::NotHere);
                }
                self.here_open(now)?;
                let missing = self.help_missing(def, now);
                if !missing.is_empty() {
                    return Err(CoreError::Locked(missing));
                }
                let took = if def.needs.is_empty() { Vec::new() } else { crate::daily::take_for(content, &self.pocket_items(), &def.needs).ok_or(CoreError::NotEnough)? };
                let leaving = took.iter().filter(|i| self.is_carry(i)).count() as u32;
                let home = self.overflow(&def.gives, leaving);
                let mut events = vec![EventKind::Helped { help, day: now.day(), took, coins: def.coins, gives: def.gives.clone(), to_chest: !home.is_empty() }];
                events.extend(home);
                Ok(events)
            }
            Command::ToFridge { item, n } => self.plan_fridge(now, &item, n, true),
            Command::FromFridge { item, n } => self.plan_fridge(now, &item, n, false),
            Command::Cook { recipe } => self.plan_cook(now, &recipe),
            Command::PayBill { utility, month } => self.plan_pay(now, Some(&utility), month),
            Command::PayAll => self.plan_pay(now, None, None),
            Command::MakeHero { set } => self.plan_make_hero(set),
            Command::Dress { slot, item } => self.plan_dress(&slot, item.as_deref()),
            Command::Haircut { set } => self.plan_haircut(now, set),
            Command::Rent { home } => self.plan_rent(now, &home),
            Command::Buy { home } => self.plan_buy(&home),
            Command::MoveHome { home } => self.plan_move_home(now, &home),
            Command::EndLease { home } => self.plan_end_lease(now, &home),
            Command::QuestStart { quest } => self.plan_quest_start(now, &quest),
            Command::QuestStep { quest, choice } => self.plan_quest_step(now, &quest, choice),
            Command::TakeJob { work } => self.plan_take_job(&work),
            Command::LeaveJob { work } => self.plan_leave_job(&work),
            Command::StartShift { work } => self.plan_start_shift(now, &work),
            Command::WorkStep { choice } => self.plan_work_step(now, choice),
            Command::EndShift => self.plan_end_shift(),
            Command::Plant { pid, seed } => self.plan_plant(now, pid, &seed),
            Command::Water { pid } => self.plan_water(now, pid),
            Command::Harvest { pid } => self.plan_harvest(now, pid),
            Command::ClearPlot { pid } => self.plan_clear_plot(pid),
            Command::Play { pid, piece } => self.plan_play(now, pid, piece),
            Command::Busk { piece, instrument } => self.plan_busk(now, &piece, &instrument),
            Command::Paint { pid, title, pixels } => self.plan_paint(now, pid, &title, &pixels),
            Command::Congratulate { who, gift } => self.plan_congratulate(now, &who, gift),
            Command::Contribute { project, coins, items } => self.plan_contribute(now, &project, coins, items),
            Command::Dine { host } => self.plan_dine(now, &host),
            Command::Repair { pid } => self.plan_repair(now, pid),
            Command::CallMaster { pid } => self.plan_call_master(now, pid),
            Command::Craft { recipe } => self.plan_craft(now, &recipe),
            Command::Tinker { items } => self.plan_tinker(now, &items),
            Command::AcceptGift { who } => self.plan_accept_gift(now, &who),
            Command::Lesson => self.plan_lesson(now),
            Command::Theory { answers } => self.plan_theory(now, &answers),
            Command::StartExam => self.plan_exam_start(now),
            Command::EndExam { faults } => self.plan_exam_end(now, faults),
            Command::BuyCar { car } => self.plan_buy_car(now, &car),
            Command::Refuel => self.plan_refuel(now),
            Command::Service { what } => self.plan_service(now, &what),
            Command::StartDrive { exam } => self.plan_start_drive(now, exam),
            Command::Park { cells, x, y, rot } => self.plan_park(now, cells, x, y, rot),
            Command::Violation { kind, cells, x, y } => self.plan_violation(now, &kind, cells, x, y),
            Command::PayFine => self.plan_pay_fine(),
            Command::PickCoin { x, y } => self.plan_pick_coin(now, x, y),
            Command::OrderBuild { build, x, y } => self.plan_order_build(now, &build, x, y),
            Command::FinishBuild { n } => self.plan_finish_build(now, n),
            Command::Adopt { pet } => self.plan_adopt(now, &pet),
            Command::PetCare { pet, what } => self.plan_pet_care(now, &pet, &what),
            Command::Companion { pet } => self.plan_companion(pet),
            Command::Interview { question, answer } => {
                let q = content.interviews.get(question as usize).ok_or(CoreError::NoRequest)?;
                if answer as usize >= q.answers.len() {
                    return Err(CoreError::NoRequest);
                }
                if self.state.interviews.contains_key(&now.day()) {
                    return Err(CoreError::TooSoon);
                }
                Ok(vec![EventKind::Interviewed { day: now.day(), question, answer }])
            }
            Command::Perform { action, pid } => {
                if !content.actions.contains_key(&action) {
                    return Err(CoreError::UnknownAction(action));
                }
                if let Some(pid) = pid {
                    let p = room_state.placements.get(&pid).ok_or(CoreError::UnknownPlacement(pid))?;
                    let supported = content.items.get(&p.item).is_some_and(|d| d.actions.contains(&action));
                    if !supported {
                        return Err(CoreError::ActionNotAvailable);
                    }
                    if let Some(off) = self.utility_off_for(now, &p.item) {
                        return Err(CoreError::UtilityOff(off));
                    }
                    self.check_working(pid, now)?;
                }
                let day = now.day();
                let used_today = match self.state.reward_days.get(&action) {
                    Some((d, n)) if *d == day => *n,
                    _ => 0,
                };
                let mut rewarded = false;
                let mut payout = Vec::new();
                for rule in content.rewards.iter().filter(|r| r.action == action) {
                    if rule.per_day_cap.map_or(true, |cap| used_today < cap) {
                        rewarded = true;
                        if rule.coins > 0 {
                            payout.push(EventKind::CoinsEarned { amount: rule.coins });
                        }
                        if let Some(token) = &rule.token {
                            if token.n > 0 {
                                payout.push(EventKind::TokenGranted { kind: token.kind.clone(), n: token.n });
                            }
                        }
                    }
                }
                let mut events = vec![EventKind::ActionPerformed { action, pid, day, rewarded }];
                events.extend(payout);
                Ok(events)
            }
        }
    }

    pub fn into_storage(self) -> S {
        self.storage
    }
}

/// What mending a worn thing costs: about a third of the new one's price, never less than 15 coins.
pub fn restore_price(content: &Content, into: &str) -> u32 {
    let new = match content.items.get(into).map(|d| &d.acquire) {
        Some(crate::unlock::Unlock::Coins(n)) => *n,
        _ => 60,
    };
    (new / 3).max(15)
}

/// A place the taxi can take one to.
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
pub struct TaxiDest {
    pub id: String,
    pub name: String,
    pub location: String,
    pub x: i32,
    pub y: i32,
}

/// Everywhere the taxi goes: its stands, and the door of every place that is not someone's home.
pub fn taxi_destinations(content: &Content) -> Vec<TaxiDest> {
    let mut out: Vec<TaxiDest> = content.taxi.values().map(|t| TaxiDest { id: t.id.clone(), name: t.name.clone(), location: t.location.clone(), x: t.x, y: t.y }).collect();
    for (id, site) in &content.sites {
        let Some(loc) = content.site_location.get(id) else { continue };
        if site.kind == "home" || content.locations.get(loc).is_none_or(|l| l.inside.is_some() || l.underground) {
            continue;
        }
        // a stand already serves it: the same name, or right by its door
        if content.taxi.values().any(|t| t.location == *loc && (t.name == site.name || (t.x - site.x).abs() + (t.y - site.y).abs() <= 4)) {
            continue;
        }
        if out.iter().any(|d| d.location == *loc && d.name == site.name) {
            continue;
        }
        out.push(TaxiDest { id: format!("site:{id}"), name: site.name.clone(), location: loc.clone(), x: site.x, y: site.y });
    }
    out
}

/// How many ways out one has to go through from one location to another (None: no way at all).
fn hops(content: &Content, from: &str, to: &str) -> Option<u32> {
    let mut seen = std::collections::BTreeSet::from([from.to_string()]);
    let mut frontier = vec![from.to_string()];
    for n in 0..32 {
        if frontier.iter().any(|l| l == to) {
            return Some(n);
        }
        let mut next = Vec::new();
        for l in &frontier {
            for e in content.locations.get(l).map(|v| v.exits.as_slice()).unwrap_or(&[]) {
                if seen.insert(e.to.clone()) {
                    next.push(e.to.clone());
                }
            }
        }
        if next.is_empty() {
            return None;
        }
        frontier = next;
    }
    None
}

/// What a ride costs: a little to get in, more for every place the taxi passes through, and by the distance
/// within one place; never more than 40 coins.
pub fn taxi_fare(content: &Content, from: (&str, i32, i32), to: &TaxiDest) -> Option<u32> {
    let n = hops(content, from.0, &to.location)?;
    // whole tiles, no floating point in the core
    let local = if n == 0 { (((from.1 - to.x).pow(2) + (from.2 - to.y).pow(2)) as u32).isqrt() / 6 } else { 0 };
    Some((6 + 9 * n + local).min(40))
}
