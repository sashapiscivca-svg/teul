use serde::{Deserialize, Serialize};

use crate::room::WallSide;
use crate::time::WorldTime;

/// Schema version of the serialized `EventKind` payload. Bump it when a payload shape changes
/// and teach `decode_kind` to upgrade the old shape.
pub const EVENT_SCHEMA: u32 = 1;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct EventId {
    pub device: u32,
    pub seq: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum EventKind {
    PlayerNamed { name: String },
    /// A place at hand given a thing one carries (or emptied); a thing is in one place at most.
    HotbarSet { slot: u32, item: Option<String> },
    /// The left hand given a thing one carries (or emptied).
    OffhandSet { item: Option<String> },
    /// The thing in a place at hand and the one in the left hand change hands.
    HandsSwapped { slot: u32 },
    /// A piece of armour put on (in place of whatever was worn there).
    Worn { item: String, slot: String },
    /// Armour taken off a place.
    TakenOff { slot: String },
    ItemAcquired { item: String },
    StyleAcquired { style: String },
    CoinsEarned { amount: u32 },
    CoinsSpent { amount: u32 },
    TokenGranted { kind: String, n: u32 },
    TokenSpent { kind: String, n: u32 },
    ActionPerformed { action: String, pid: Option<u32>, day: u64, rewarded: bool },
    Placed { pid: u32, item: String, x: i32, y: i32, rot: u8, wall: Option<WallSide>, on: Option<u32> },
    Moved { pid: u32, x: i32, y: i32, wall: Option<WallSide>, on: Option<u32> },
    Rotated { pid: u32, rot: u8 },
    Recolored { pid: u32, slot: String, color: String },
    Stored { pid: u32 },
    StyleSet { kind: String, style: String },
    RoomExpanded { expansion: String },
    AreaBought { cells: u32 },
    CellsChanged { add: Vec<(i32, i32)>, remove: Vec<(i32, i32)> },
    DividerSet { x: i32, y: i32, side: WallSide, on: bool },
    FloorPainted { cells: Vec<(i32, i32)>, style: Option<String> },
    WallPainted { edges: Vec<(i32, i32, WallSide)>, style: Option<String> },
    PropSet { pid: u32, key: String, value: String },
    SettingSet { key: String, value: String },
    ThemeAcquired { theme: String, styles: Vec<String> },
    /// A talk with someone; `delta` is the friendship it brought (only the first talk of a day counts).
    NpcTalked { npc: String, day: u64, delta: u32 },
    /// An item given to someone (one free copy leaves the inventory); `taste` is +1 liked, 0, -1 disliked.
    NpcGifted { npc: String, item: String, day: u64, delta: i32, taste: i8 },
    NpcInvited { npc: String, from: u64, until: u64 },
    /// Someone gave the player an item (one copy joins the inventory).
    NpcGaveGift { npc: String, item: String },
    /// A one-time gift from the content: these items and styles are now the player's.
    KitClaimed { kit: String, items: Vec<String>, styles: Vec<String> },
    /// Something found at a spot (one a day per spot), or caught in a water.
    Gathered { spot: String, day: u64, item: String },
    Caught { place: String, day: u64, item: String },
    /// Every thing of a collection found: its reward joins the inventory.
    CollectionCompleted { collection: String, reward: String },
    /// A request answered: these items leave the inventory, the friendship grows.
    /// Coins and the gift come with it (the gift only the first time this ask is answered).
    Delivered { npc: String, day: u64, ask: u32, items: Vec<String>, points: u32, coins: u32, gift: Option<String> },
    /// A letter opened (its present, if any, joins the inventory).
    LetterClaimed { npc: String, letter: u32, gift: Option<String> },
    /// A chapter of someone's story played; what it needed leaves the inventory, a present may come.
    StoryAdvanced { npc: String, step: u32, day: u64, items: Vec<String>, gift: Option<String> },
    /// A worn thing mended at the workshop into what it once was, for coins.
    Restored { worn: String, into: String, coins: u32 },
    /// What the player asked for, logged before what it did, so every outcome can be re-derived.
    /// `pack` is the content's fingerprint at the time (outcomes are only compared exactly under the same).
    Input {
        cmd: crate::core::Command,
        #[serde(default)]
        pack: u64,
    },
    /// The player went somewhere ("home" or a location).
    Travelled { to: String, day: u64 },
    /// Things put in the chest at home (or sent there because the pocket was full).
    Stashed { item: String, n: u32 },
    /// Things taken from the chest into the pocket.
    Taken { item: String, n: u32 },
    /// Things sold from the pocket to a buyer (counted in pieces against its day).
    SoldTo { station: String, item: String, n: u32, coins: u32, day: u64 },
    /// A thing of the home sold second-hand (it leaves the inventory).
    SoldBack { item: String, coins: u32, day: u64 },
    /// Things thrown out of the pocket, gone for good.
    ThrownAway { item: String, n: u32 },
    /// A station used: what left the pocket, what came, coins paid and earned.
    Used { station: String, day: u64, took: Vec<String>, gave: Vec<String>, cost: u32, earn: u32 },
    /// A help done: what it took, the coins and things it brought (any that did not fit went home).
    Helped { help: String, day: u64, took: Vec<String>, coins: u32, gives: Vec<String>, to_chest: bool },
    /// The player answered a journalist (printed the next morning).
    Interviewed { day: u64, question: u32, answer: u32 },
    /// Food put into the fridge at home (out of the pocket), or taken out of it.
    Fridged { item: String, n: u32 },
    Unfridged { item: String, n: u32 },
    /// A dish cooked: what it took from the pocket and from the fridge, what came (into the fridge when the
    /// pocket had no room).
    Cooked { recipe: String, day: u64, took: Vec<String>, from_fridge: Vec<String>, gave: String, n: u32, to_fridge: bool },
    /// A month's bill for a utility paid at the office.
    BillPaid { utility: String, month: i64, amount: u32 },
    /// The hero made at the first open: their look (clothes, hair, body); the clothes are the first outfit.
    HeroMade { set: Vec<(String, String)> },
    /// Changed into a garment (or back into the first day's clothes, `item` None); `set` empty values clear a key.
    Dressed { slot: String, item: Option<String>, set: Vec<(String, String)> },
    /// A haircut at the salon: what changed, and what it cost.
    HairCut { set: Vec<(String, String)>, coins: u32 },
    /// A home or a plot rented: the first month paid at once.
    Rented { home: String, month: i64, amount: u32 },
    Bought { home: String, amount: u32 },
    /// The player's address is now this home (everything at home comes along).
    MovedHome { home: String },
    LeaseEnded { home: String, month: i64 },
    /// A quest taken (an authored one, this year's calendar one, or a job of the day); what it hands over.
    QuestStarted { quest: String, day: u64, gave: Vec<String> },
    /// A stage of a quest done: what it took and gave, the choice made (and what that brought), the stage next.
    QuestAdvanced { quest: String, day: u64, stage: u32, next: u32, took: Vec<String>, gave: Vec<String>, choice: Option<u32>, reward: Option<crate::quests::Reward> },
    /// A quest finished, and what it brought (what did not fit the pocket went home to the chest).
    QuestDone { quest: String, day: u64, reward: crate::quests::Reward, to_chest: bool },
    /// Taken on at a job.
    JobTaken { work: String },
    /// A job left.
    JobLeft { work: String },
    /// A shift taken at a job.
    ShiftStarted { work: String, day: u64 },
    /// A task of the shift answered (right or not).
    WorkDone { work: String, step: u32, right: bool },
    /// A shift over: what it paid (from the town) and whether it was worked through.
    ShiftEnded { work: String, day: u64, steps: u32, right: u32, pay: u32, full: bool },
    /// A seed planted in a plot at home (the seed leaves the pocket).
    Planted { pid: u32, plant: String, seed: String, day: u64 },
    /// A plot watered; from a watering can it stays moist the next day too.
    Watered {
        pid: u32,
        day: u64,
        #[serde(default, skip_serializing_if = "std::ops::Not::not")]
        can: bool,
    },
    /// Picked from a plot: a bed is cleared, a tree stays.
    Harvested { pid: u32, plant: String, day: u64, item: String, n: u32, cleared: bool },
    PlotCleared { pid: u32 },
    /// A while at an instrument.
    Played {
        pid: u32,
        day: u64,
        /// The piece played (none: just playing).
        #[serde(default, skip_serializing_if = "Option::is_none")]
        piece: Option<String>,
    },
    /// Played in the street: who stopped to listen and what they dropped in the case (paid with `CoinsEarned`).
    Busked { piece: String, instrument: String, day: u64, listeners: u32, coins: u32 },
    /// A picture painted at the easel; a canvas to hang joins the things one has.
    Painted { index: u32, title: String, day: u64, pixels: String, canvas: String },
    /// Birthday wishes (and a gift, if one was given; `taste` as for gifts) for someone, once a year.
    Congratulated { who: String, year: i64, day: u64, gift: Option<String>, taste: i8, delta: u32 },
    /// Money and materials given to one of the town's projects.
    Contributed { project: String, day: u64, coins: u32, items: Vec<(String, u32)> },
    /// A thing at home mended: by one's own hands (a kit taken from the pocket) or by a master (for coins).
    Repaired { pid: u32, day: u64, by: String, took: Vec<String>, coins: u32, stage: u32 },
    /// Something made at a workbench: what it took, what came (what did not fit the pocket went home), and whether
    /// it was found out just now by trying.
    Crafted { recipe: String, day: u64, took: Vec<String>, gave: Vec<String>, to_chest: bool, learned: bool },
    /// One's own tool used once more; worn out (and gone) when `broke`. Things used up (fertilizer) go at once.
    ToolUsed { item: String, broke: bool },
    /// Dinner at a friend's who had invited the player; what they sent home with them.
    Dined { host: String, day: u64, gave: Option<String>, delta: u32 },
    /// A close friend gave the player a little something, on a day they had one.
    ResidentGave { who: String, day: u64, item: String },
    /// The road (drive.rs): a lesson at the driving school, the theory exam, the practical one.
    LessonTaken { n: u32, day: u64, coins: u32 },
    TheoryTaken { day: u64, right: u32, passed: bool, coins: u32 },
    ExamStarted { day: u64, coins: u32 },
    /// The practical exam over: the instructor's marks, and the licence (`licence` is its item) if passed.
    ExamEnded { day: u64, faults: Vec<String>, passed: bool, licence: String },
    /// A car bought at the service station: where it waits, and its keys.
    CarBought { model: String, price: u32, day: u64, at: (String, i32, i32, u8), keys: String },
    /// Fuel in the tank: from the pump (for coins) or a canister (it leaves the pocket).
    Refuelled { units: u32, coins: u32, can: Option<String> },
    CarServiced { what: String, coins: u32 },
    DriveStarted { licensed: bool, exam: bool },
    /// The car left standing: how far it went, the fuel it burned, where.
    Parked { cells: u64, fuel: u32, at: (String, i32, i32, u8) },
    /// Something done wrong on the road: whether anyone saw, the fine (paid there and then or owed), the holes.
    Violated { kind: String, day: u64, seen: bool, fine: u32, paid: bool, holes: u32, dent: bool },
    /// Taken to the cell until `until` (a world minute); the licence (`licence`) taken away until day `back`; the
    /// car towed to `at` after a trip of `cells` that burned `fuel`.
    Arrested { day: u64, kind: String, until: u64, back: u64, cells: u64, fuel: u32, at: (String, i32, i32, u8), licence: String },
    FinePaid { coins: u32 },
    /// Money picked up from the road (the day's `index`th).
    MoneyFound { day: u64, index: u32, coins: u32 },
    /// The builders took an order (builds.rs): the site, what it cost, the day it is ready.
    BuildOrdered { build: String, x: i32, y: i32, w: i32, d: i32, coins: u32, day: u64, ready: u64 },
    /// The keys handed over: the new room's floor joins the house, with what came with it.
    BuildFinished { n: u32, area: u32, items: Vec<String>, styles: Vec<String> },
    /// The animals (pets.rs).
    PetAdopted { pet: String, day: u64, coins: u32 },
    FoxFed { day: u64, item: String },
    EggNested { day: u64, from_pocket: bool },
    PetFed { pet: String, day: u64, item: Option<String> },
    PetCared { pet: String, what: String, day: u64 },
    CompanionSet { pet: Option<String> },
    /// An event of something the game no longer has (`RETIRED_EVENTS`, or an input of a `RETIRED_COMMANDS`
    /// command), kept as it was read so the log still reads and chains; it changes nothing (see `Core::replay`).
    #[serde(skip)]
    Retired { body: serde_json::Value },
}

/// Events of version 1.x of things the game no longer has: the shared world beyond the edge (its purse, the
/// wilds, mines, the workshop, horses) and friends (keys, parcels, guests). A save that holds them still opens.
pub const RETIRED_EVENTS: &[&str] = &[
    "RealmCrossed", "Struck", "NodeBroken", "TreeFell", "TrunkSawn", "Dropped", "PickedUp", "Hurt", "Defeated", "MineOpened",
    "MineLevel", "Dug", "Propped", "CaveIn", "WalledIn", "Freed", "WorkshopBuilt", "Forged", "IdentitySet", "GuestCame",
    "GuestWent", "GuestRulesSet", "GuestWrote", "BookErased", "ParcelSent", "ParcelReceived", "HorseTamed", "HorseMounted",
    "HorseLeft",
];

/// Commands of version 1.x of things the game no longer has (as `RETIRED_EVENTS`): an input of one is retired.
pub const RETIRED_COMMANDS: &[&str] = &[
    "strike", "crushed", "drop", "pick_up", "hurt", "build_workshop", "open_mine", "enter_mine", "dig", "prop", "collapse",
    "suffocate", "forge", "set_identity", "send_parcel", "receive_parcel", "guest_came", "guest_went", "guest_rules",
    "guest_wrote", "book_erase", "tame", "mount", "dismount",
];

impl EventKind {
    /// Reads an event's payload: a retired one (of a thing no longer in the game) is kept aside as it was.
    pub fn from_json(body: serde_json::Value) -> Result<EventKind, serde_json::Error> {
        let tag = body.get("type").and_then(|t| t.as_str()).unwrap_or_default();
        let retired = RETIRED_EVENTS.contains(&tag)
            || (tag == "Input" && body.get("cmd").and_then(|c| c.get("type")).and_then(|t| t.as_str()).is_some_and(|c| RETIRED_COMMANDS.contains(&c)));
        if retired {
            Ok(EventKind::Retired { body })
        } else {
            serde_json::from_value(body)
        }
    }

    pub fn is_retired(&self) -> bool {
        matches!(self, EventKind::Retired { .. })
    }

    /// The type a retired event had ("" for any other).
    pub fn retired_tag(&self) -> &str {
        match self {
            EventKind::Retired { body } => body.get("type").and_then(|t| t.as_str()).unwrap_or_default(),
            _ => "",
        }
    }
}

/// `Event::kind` through `EventKind::from_json`, and a retired payload written back as it was read.
mod kind_serde {
    use super::EventKind;
    use serde::{Deserialize, Deserializer, Serialize, Serializer};

    pub fn serialize<S: Serializer>(kind: &EventKind, s: S) -> Result<S::Ok, S::Error> {
        match kind {
            EventKind::Retired { body } => body.serialize(s),
            other => other.serialize(s),
        }
    }

    pub fn deserialize<'de, D: Deserializer<'de>>(d: D) -> Result<EventKind, D::Error> {
        EventKind::from_json(serde_json::Value::deserialize(d)?).map_err(serde::de::Error::custom)
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Event {
    pub id: EventId,
    pub time: WorldTime,
    pub rules_version: u32,
    #[serde(with = "kind_serde")]
    pub kind: EventKind,
    /// The link to the device's previous event (see `economy::link`); 0 for events from before the chain.
    #[serde(default)]
    pub chain: u64,
}

/// Total order of the log: world time, then device, then sequence number.
pub type SortKey = (WorldTime, u32, u64);

impl Event {
    pub fn sort_key(&self) -> SortKey {
        (self.time, self.id.device, self.id.seq)
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum DecodeError {
    UnsupportedSchema(u32),
    Malformed(String),
}

pub fn encode_kind(kind: &EventKind) -> String {
    match kind {
        EventKind::Retired { body } => body.to_string(),
        other => serde_json::to_string(other).expect("EventKind always serializes"),
    }
}

pub fn decode_kind(schema: u32, json: &str) -> Result<EventKind, DecodeError> {
    match schema {
        1 => serde_json::from_str(json).and_then(EventKind::from_json).map_err(|e| DecodeError::Malformed(e.to_string())),
        other => Err(DecodeError::UnsupportedSchema(other)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn kind_round_trips_through_json() {
        let kind = EventKind::PlayerNamed { name: "Орися".into() };
        let json = encode_kind(&kind);
        assert_eq!(decode_kind(EVENT_SCHEMA, &json), Ok(kind));
    }

    #[test]
    fn unknown_schema_is_rejected_not_guessed() {
        assert_eq!(decode_kind(99, "{}"), Err(DecodeError::UnsupportedSchema(99)));
    }

    #[test]
    fn a_retired_payload_is_kept_aside_as_it_was() {
        let json = r#"{"type":"HorseTamed","horse":"h","day":3,"took":[["apple",2]],"at":[1,2],"name":"Сірко","coat":1}"#;
        let kind = decode_kind(EVENT_SCHEMA, json).unwrap();
        assert!(kind.is_retired());
        assert_eq!(kind.retired_tag(), "HorseTamed");
        assert_eq!(decode_kind(EVENT_SCHEMA, &encode_kind(&kind)), Ok(kind));
        let input = decode_kind(EVENT_SCHEMA, r#"{"type":"Input","cmd":{"type":"dig","level":0,"x":1,"y":1,"with":null,"at":[1,1]},"pack":7}"#).unwrap();
        assert_eq!(input.retired_tag(), "Input");
        // a live input still reads as one
        assert!(matches!(decode_kind(EVENT_SCHEMA, r#"{"type":"Input","cmd":{"type":"pay_all"},"pack":7}"#), Ok(EventKind::Input { .. })));
    }

    #[test]
    fn malformed_payload_is_an_error() {
        assert!(matches!(decode_kind(1, "{not json"), Err(DecodeError::Malformed(_))));
    }

    #[test]
    fn sort_key_orders_by_time_then_device_then_seq() {
        let mk = |t, d, s| Event {
            id: EventId { device: d, seq: s },
            time: WorldTime(t),
            rules_version: 1,
            kind: EventKind::PlayerNamed { name: "x".into() },
            chain: 0,
        };
        let mut keys = vec![mk(5, 2, 0).sort_key(), mk(5, 1, 9).sort_key(), mk(4, 9, 9).sort_key(), mk(5, 1, 3).sort_key()];
        keys.sort();
        assert_eq!(
            keys,
            vec![(WorldTime(4), 9, 9), (WorldTime(5), 1, 3), (WorldTime(5), 1, 9), (WorldTime(5), 2, 0)]
        );
    }
}
