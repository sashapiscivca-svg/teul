//! The world fills up (docs/world-economy.md): the pocket and the chest at home, places to use, help that
//! opens the way, locked places, the morning paper, and the honest log (inputs and the chain).

use std::collections::{BTreeMap, BTreeSet};

use serde::{Deserialize, Serialize};

use crate::content::Lang;
use crate::core::Core;
use crate::event::{Event, EventId, EventKind};
use crate::storage::Storage;
use crate::time::{Season, WorldTime, MINUTES_PER_DAY};
use crate::unlock::Missing;

/// The room of an empty pocket when the content does not say.
pub const DEFAULT_POCKET: u32 = 8;
/// More commands that bring or move value than this in one world minute is not a person playing.
pub const MAX_COMMANDS_PER_MINUTE: u32 = 40;
/// Chains and fingerprints fit in 52 bits, so they survive JavaScript numbers on the way to the save.
pub const MASK52: u64 = (1 << 52) - 1;

// ---- content ---------------------------------------------------------------------------------------------

/// What a place, a station or a help needs before it opens. Every listed condition must hold.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields, default)]
pub struct Requires {
    /// Items (keys usually) the player must own.
    pub items: Vec<String>,
    /// Helps that must be done.
    pub helped: Vec<String>,
    /// Friendship levels: (npc, hearts).
    pub hearts: Vec<(String, u32)>,
    /// Homes or plots that must be rented (and not lost for an unpaid rent).
    pub leased: Vec<String>,
    /// What to tell the player while it is closed.
    pub hint: String,
    /// Open only on these days (any of them): holiday ids, or "rift" for the equinoxes and the solstices.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub days: Vec<String>,
    /// Town flags that must hold (a place that is built: `grow:donuts:built`).
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub flags: Vec<String>,
}

/// Something in the world that does something: buy, sell, make, gather, play...
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StationDef {
    pub id: String,
    /// A location id, or "home".
    pub location: String,
    /// The item of a prop standing in that location; the player uses the station at such a prop.
    pub prop: String,
    pub label: String,
    #[serde(default)]
    pub text: String,
    /// Taken from the pocket: item ids or `#tag`, with counts.
    #[serde(default)]
    pub needs: Vec<(String, u32)>,
    /// Coins paid.
    #[serde(default)]
    pub cost: u32,
    #[serde(default)]
    pub gives: Vec<(String, u32)>,
    /// Coins earned.
    #[serde(default)]
    pub earn: u32,
    /// Uses a day (0: any number).
    #[serde(default)]
    pub per_day: u32,
    /// Seasons it works in (empty: all year).
    #[serde(default)]
    pub seasons: Vec<Season>,
    /// Open from this hour to that one (`[6, 20]`), or always.
    #[serde(default)]
    pub hours: Option<(u32, u32)>,
    #[serde(default)]
    pub requires: Option<Requires>,
    /// buy, sell, make, gather, play, wish, read, ride, rest — for the shell's icon and sound.
    #[serde(default)]
    pub kind: String,
    /// Which days it works: "daily" (even on holidays), "weekdays", "weekends", or a holiday id (a fair: that day
    /// only). Unset: every day, but shops (buy, sell, make in town) rest on the days off of the great holidays.
    #[serde(default)]
    pub days: Option<String>,
    /// What the world says when it has given all it has today ("Корову вже подоїли зранку").
    #[serde(default)]
    pub spent: String,
    /// Open only while the town has this flag (a shop that opened, something built: `town::flags`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub flag: Option<String>,
    /// A buyer of what the pocket holds (the market's second-hand stall): a price a piece for an item id, a
    /// `#tag`, or `*` for anything else; the first that fits is paid. `per_day` then counts pieces, not visits.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub buys: Vec<(String, u32)>,
}

/// Things of the home sold second-hand (`Command::SellBack`): the share of the catalogue price paid, how many a
/// day the small ads find buyers for, and the key their day is counted under.
pub const SELL_BACK_PERCENT: u32 = 40;
pub const SELL_BACK_PER_DAY: u32 = 10;
pub const SELL_BACK: &str = "sell_back";

/// A one-time task from someone of the town.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HelpDef {
    pub id: String,
    /// A story NPC or a resident.
    pub giver: String,
    pub giver_name: String,
    /// Where it is handed in: a location id or "home".
    pub location: String,
    pub title: String,
    #[serde(default)]
    pub text: String,
    #[serde(default)]
    pub needs: Vec<(String, u32)>,
    /// Helps that must be done first.
    #[serde(default)]
    pub after: Vec<String>,
    #[serde(default)]
    pub requires: Option<Requires>,
    #[serde(default)]
    pub coins: u32,
    #[serde(default)]
    pub gives: Vec<String>,
    #[serde(default)]
    pub thanks: String,
}

/// A journalist's question and the answers the player may give.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct InterviewDef {
    pub q: String,
    pub answers: Vec<String>,
}

// ---- views -----------------------------------------------------------------------------------------------

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct PocketView {
    pub capacity: u32,
    pub used: u32,
    /// What is carried (carry items only).
    pub items: BTreeMap<String, u32>,
    /// What waits in the chest at home.
    pub chest: BTreeMap<String, u32>,
    /// The keyring: guide items, taking no room.
    pub keys: Vec<String>,
    /// The bag that gives the room, if any.
    pub bag: Option<String>,
    /// The nine places at hand (the bar at the bottom): what each holds, if it is still carried.
    pub hotbar: Vec<Option<String>>,
    /// What the left hand holds, if it is still carried.
    pub offhand: Option<String>,
    /// Armour worn, by place (head, body, legs, feet).
    pub armor: BTreeMap<String, String>,
    /// How much the armour worn shields, all together.
    pub defense: u32,
}

/// Places at hand, at the bottom of the screen.
pub const HOTBAR: usize = 9;

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Access {
    pub open: bool,
    pub missing: Vec<Missing>,
    pub hint: String,
    /// Shut now for its hours (or its day): nobody goes in until it opens.
    pub shut: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct LocationView {
    pub location: String,
    pub places: BTreeMap<String, Access>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct StationView {
    pub id: String,
    pub location: String,
    pub prop: String,
    pub label: String,
    pub text: String,
    pub kind: String,
    pub needs: Vec<(String, u32)>,
    pub cost: u32,
    pub gives: Vec<(String, u32)>,
    pub earn: u32,
    pub per_day: u32,
    pub used_today: u32,
    pub hours: Option<(u32, u32)>,
    /// What the world says when it has given all it has today.
    pub spent: String,
    /// Whether using it now would work (the player's place aside).
    pub ok: bool,
    /// Why not: `locked`, `closed`, `too_soon`, `coins`, `not_enough`, `pocket_full`.
    pub reason: Option<String>,
    pub missing: Vec<Missing>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct HelpView {
    pub id: String,
    pub giver: String,
    pub giver_name: String,
    pub location: String,
    pub title: String,
    pub text: String,
    pub needs: Vec<(String, u32)>,
    pub coins: u32,
    pub gives: Vec<String>,
    pub thanks: String,
    pub done: bool,
    /// The help before it is done and its requirements are met.
    pub available: bool,
    /// Available and the pocket holds what it needs.
    pub ready: bool,
    pub missing: Vec<Missing>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct PaperWeather {
    pub today: String,
    pub tomorrow: String,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
pub struct PaperStory {
    pub title: String,
    pub text: String,
    /// Where its photo is taken (see `paper::PhotoHint`); none: no photo.
    pub photo: Option<crate::paper::PhotoHint>,
    /// Stable within the day (see `paper::Story::id`).
    pub id: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct PaperInterview {
    pub question: String,
    pub answer: String,
}

/// The morning paper of a world day.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct PaperView {
    pub day: u64,
    pub title: String,
    pub number: u64,
    pub date: String,
    pub weather: PaperWeather,
    pub headline: PaperStory,
    pub stories: Vec<PaperStory>,
    pub interview: Option<PaperInterview>,
    pub town: Vec<String>,
    pub asks: Vec<String>,
    pub ads: Vec<String>,
    /// The year's days coming: today's and the next fortnight's holidays and feasts.
    pub events: Vec<String>,
}

/// What opening the save found.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
pub struct Integrity {
    /// Events left out: forged, edited, or not what their input would give.
    pub tampered: u32,
    pub dropped: Vec<EventId>,
    /// Plain events from before this build (no inputs, no chain), trusted as they are.
    pub legacy: u32,
    /// Inputs replayed.
    pub inputs: u32,
    /// Events of things the game no longer has (the shared world beyond the edge, friends), passed over.
    pub retired: u32,
    /// The save was opened from a verified snapshot: only what came after it was checked and replayed.
    pub from_snapshot: bool,
}

// ---- the chain -------------------------------------------------------------------------------------------

/// The link of an event to the one before it (of the same device): a 52-bit FNV-1a over the previous link,
/// the event's id, time, rules and payload, and the device's secret. Never zero (zero means "not chained").
pub fn link(prev: u64, e: &Event, secret: u64) -> u64 {
    let mut bytes = Vec::with_capacity(96);
    bytes.extend_from_slice(&prev.to_le_bytes());
    bytes.extend_from_slice(&e.id.device.to_le_bytes());
    bytes.extend_from_slice(&e.id.seq.to_le_bytes());
    bytes.extend_from_slice(&e.time.0.to_le_bytes());
    bytes.extend_from_slice(&e.rules_version.to_le_bytes());
    bytes.extend_from_slice(crate::event::encode_kind(&e.kind).as_bytes());
    bytes.extend_from_slice(&secret.to_le_bytes());
    let h = crate::rng::fnv1a64(&bytes) & MASK52;
    if h == 0 {
        1
    } else {
        h
    }
}

// ---- words -----------------------------------------------------------------------------------------------

const MONTHS: [&str; 12] = ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"];

const MONTHS_EN: [&str; 12] = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

pub fn sky_words(sky: crate::daily::Sky, l: Lang) -> &'static str {
    use crate::daily::Sky;
    match sky {
        Sky::Clear => l.pick("ясно", "clear"),
        Sky::Cloudy => l.pick("хмарно", "cloudy"),
        Sky::Rain => l.pick("дощ", "rain"),
        Sky::Storm => l.pick("гроза", "thunderstorm"),
        Sky::Snow => l.pick("сніг", "snow"),
        Sky::Fog => l.pick("туман", "fog"),
    }
}

pub(crate) fn news_title(kind: crate::life::IncidentKind, l: Lang) -> &'static str {
    use crate::life::IncidentKind as K;
    match kind {
        K::Fire => l.pick("Пожежа", "Fire"),
        K::FireOut => l.pick("Вогонь приборкано", "Fire put out"),
        K::Theft => l.pick("Крадіжка", "Theft"),
        K::Caught => l.pick("Злодія спіймано", "Thief caught"),
        K::Fight => l.pick("Сварка на вулиці", "A row in the street"),
        K::Detained => l.pick("Затримання", "Arrest"),
        K::Ill => l.pick("Здоров'я", "Health"),
        K::Healed => l.pick("Одужання", "On the mend"),
        K::Delivery => l.pick("Доставка", "Delivery"),
        K::Party => l.pick("Свято", "Celebration"),
        K::Interview => l.pick("Інтерв'ю", "Interview"),
        K::DumpFull => l.pick("Звалище переповнене", "The dump is overflowing"),
        K::DumpCleared => l.pick("Звалище прибрано", "The dump is cleared"),
    }
}

/// How much a happening matters for the front page.
pub(crate) fn news_weight(kind: crate::life::IncidentKind) -> u32 {
    use crate::life::IncidentKind as K;
    match kind {
        K::Fire => 9,
        K::Theft => 8,
        K::Caught | K::Detained => 7,
        K::Party => 6,
        K::Fight => 5,
        K::DumpFull => 5,
        K::FireOut => 4,
        K::Interview => 3,
        K::Ill => 2,
        K::DumpCleared => 2,
        K::Healed | K::Delivery => 1,
    }
}

// ---- the core side ---------------------------------------------------------------------------------------

/// The most kinds one carries (the inventory's names).
pub const INVENTORY_MAX: u32 = 64;

impl<S: Storage> Core<S> {
    /// Where the player is: a location id, or "home".
    pub fn location(&self) -> &str {
        self.state().location.as_deref().unwrap_or("home")
    }

    /// Whether a place's things are at hand: one is in it.
    pub fn is_here(&self, location: &str) -> bool {
        self.location() == location
    }

    fn placed(&self, item: &str) -> u32 {
        self.state().room.placements.values().filter(|p| p.item == item).count() as u32
    }

    pub(crate) fn is_carry(&self, item: &str) -> bool {
        self.content().items.get(item).is_some_and(|d| d.carry)
    }

    pub(crate) fn is_key(&self, item: &str) -> bool {
        self.content().items.get(item).is_some_and(|d| d.key)
    }

    /// Copies of a carry item in the pocket (owned, neither in the chest nor placed).
    pub fn in_pocket(&self, item: &str) -> u32 {
        let st = self.state();
        let owned = st.owned.get(item).copied().unwrap_or(0);
        owned
            .saturating_sub(st.stashed.get(item).copied().unwrap_or(0))
            .saturating_sub(st.fridge.get(item).copied().unwrap_or(0))
            .saturating_sub(self.placed(item))
    }

    pub fn in_chest(&self, item: &str) -> u32 {
        let st = self.state();
        st.stashed.get(item).copied().unwrap_or(0).min(st.owned.get(item).copied().unwrap_or(0))
    }

    /// What can be handed over now: carry items from the pocket only, other things when not placed.
    pub fn available(&self, item: &str) -> u32 {
        if self.is_carry(item) {
            self.carried(item)
        } else {
            self.free_count(item)
        }
    }

    /// Everything that can be handed over now, by item.
    pub fn pocket_items(&self) -> BTreeMap<String, u32> {
        self.state().owned.keys().map(|id| (id.clone(), self.available(id))).filter(|(id, n)| *n > 0 && !self.is_key(id)).collect()
    }

    /// How many kinds the inventory holds: the content's own room and the best bag, never past 64.
    pub fn capacity(&self) -> u32 {
        let content = self.content();
        let best = self.state().owned.iter().filter(|(_, n)| **n > 0).filter_map(|(id, _)| content.items.get(id)).map(|d| d.bag).max().unwrap_or(0);
        // (re-deriving what was done before the inventory: the old pocket's room, in pieces)
        if self.older_rules.get() {
            return content.pocket + best;
        }
        (content.inventory + best).min(INVENTORY_MAX)
    }

    /// The kinds carried now (as many of a kind as one likes; a kind takes one name).
    pub fn pocket_used(&self) -> u32 {
        self.state().owned.keys().filter(|id| self.takes_room(id) && self.carried(id) > 0).count() as u32
    }

    /// Armour worn now (a piece still had), by place.
    pub fn worn_armor(&self) -> BTreeMap<String, String> {
        self.state().armor.iter().filter(|(_, id)| self.in_pocket(id) > 0).map(|(s, id)| (s.clone(), id.clone())).collect()
    }

    /// Copies of a thing worn (a piece of armour on one).
    fn worn(&self, item: &str) -> u32 {
        self.state().armor.values().filter(|id| id.as_str() == item).count() as u32
    }

    /// Copies of a carry thing in the inventory, what is worn aside.
    pub fn carried(&self, item: &str) -> u32 {
        self.in_pocket(item).saturating_sub(self.worn(item).min(self.in_pocket(item)))
    }

    /// Pieces carried (the old pocket's measure, kept for re-deriving what was done before the inventory came).
    fn pieces_carried(&self) -> u32 {
        self.state().owned.keys().filter(|id| self.takes_room(id)).map(|id| self.in_pocket(id)).sum()
    }

    /// Whether `arriving` fits once `leaving` is gone. By kinds: a kind one carries already always fits, a new one
    /// needs a free name. (Re-deriving an input made before the inventory: by pieces, as the pocket counted.)
    pub(crate) fn fits(&self, arriving: &[String], leaving: &[String]) -> bool {
        if self.older_rules.get() {
            let gone = leaving.iter().filter(|i| self.is_carry(i)).count() as u32;
            let come = arriving.iter().filter(|i| self.takes_room(i)).count() as u32;
            return come <= self.capacity().saturating_sub(self.pieces_carried().saturating_sub(gone));
        }
        let mut have: BTreeMap<&str, i64> = BTreeMap::new();
        for id in self.state().owned.keys().filter(|id| self.takes_room(id)) {
            let n = i64::from(self.carried(id));
            if n > 0 {
                have.insert(id.as_str(), n);
            }
        }
        for i in leaving.iter().filter(|i| self.takes_room(i)) {
            if let Some(n) = have.get_mut(i.as_str()) {
                *n -= 1;
            }
        }
        for i in arriving.iter().filter(|i| self.takes_room(i)) {
            *have.entry(i.as_str()).or_insert(0) += 1;
        }
        have.values().filter(|n| **n > 0).count() as u32 <= self.capacity()
    }

    /// Whether a carried thing takes room in the pocket: tools hang on the belt and take none.
    pub(crate) fn takes_room(&self, item: &str) -> bool {
        self.is_carry(item) && !self.content().tools.get(item).is_some_and(|t| t.uses > 1)
    }


    /// Presents from people that do not fit in the pocket are sent home to the chest.
    pub(crate) fn overflow(&self, incoming: &[String], leaving: u32) -> Vec<EventKind> {
        let mut out = Vec::new();
        if self.older_rules.get() {
            let mut room = self.capacity().saturating_sub(self.pieces_carried().saturating_sub(leaving));
            for item in incoming.iter().filter(|i| self.takes_room(i)) {
                if room > 0 {
                    room -= 1;
                } else {
                    out.push(EventKind::Stashed { item: item.clone(), n: 1 });
                }
            }
            return out;
        }
        // by kinds: what one carries already always fits; a new kind while a name is free; else home to the chest
        let mut kinds: std::collections::BTreeSet<String> = self.state().owned.keys().filter(|id| self.takes_room(id) && self.carried(id) > 0).cloned().collect();
        for item in incoming.iter().filter(|i| self.takes_room(i)) {
            if kinds.contains(item) || (kinds.len() as u32) < self.capacity() {
                kinds.insert(item.clone());
            } else {
                out.push(EventKind::Stashed { item: item.clone(), n: 1 });
            }
        }
        out
    }

    /// What is missing for a requirement (empty: it holds).
    pub fn missing_for(&self, req: Option<&Requires>, now: WorldTime) -> Vec<Missing> {
        let Some(req) = req else { return Vec::new() };
        let st = self.state();
        let mut out = Vec::new();
        if !req.days.is_empty() {
            let date = self.calendar().date(now);
            let info = crate::holidays::day_info(date);
            // "rift" is any rift day; a rift world's id ("rift_winter") is the day the rifts open into it
            let world = crate::sky::rift_world(date);
            let today = |d: &String| if d == "rift" { info.rift } else if d.starts_with("rift_") { world == Some(d.as_str()) } else { info.holiday.is_some_and(|h| h.id == d) };
            if !req.days.iter().any(today) {
                out.extend(req.days.iter().map(|d| Missing::Day { day: d.clone() }));
            }
        }
        if !req.flags.is_empty() {
            let flags = self.town_flags(now);
            out.extend(req.flags.iter().filter(|f| !flags.contains(*f)).map(|f| Missing::Flag { flag: f.clone() }));
        }
        for item in &req.items {
            if st.owned.get(item).copied().unwrap_or(0) == 0 {
                out.push(Missing::Item { item: item.clone() });
            }
        }
        for help in &req.helped {
            if !st.helped.contains(help) {
                out.push(Missing::Help { help: help.clone() });
            }
        }
        for home in &req.leased {
            if !self.lease_holds(home) {
                out.push(Missing::Lease { home: home.clone() });
            }
        }
        for (npc, need) in &req.hearts {
            let have = st.relations.get(npc).map(|r| r.hearts()).unwrap_or(0);
            if have < *need {
                out.push(Missing::Hearts { npc: npc.clone(), need: *need, have });
            }
        }
        out
    }

    pub fn pocket_view(&self) -> PocketView {
        let content = self.content();
        let st = self.state();
        let mut items = BTreeMap::new();
        let mut chest = BTreeMap::new();
        let mut keys = Vec::new();
        for (id, n) in &st.owned {
            if *n == 0 {
                continue;
            }
            if self.is_key(id) {
                keys.push(id.clone());
            } else if self.is_carry(id) {
                // (what is worn is on one, not in the inventory)
                let p = self.carried(id);
                if p > 0 {
                    items.insert(id.clone(), p);
                }
            }
            let c = self.in_chest(id);
            if c > 0 {
                chest.insert(id.clone(), c);
            }
        }
        let bag = st.owned.iter().filter(|(_, n)| **n > 0).filter_map(|(id, _)| content.items.get(id)).filter(|d| d.bag > 0).max_by(|a, b| a.bag.cmp(&b.bag).then(b.id.cmp(&a.id))).map(|d| d.id.clone());
        let hotbar = (0..HOTBAR).map(|k| st.hotbar.get(k).cloned().flatten().filter(|id| self.carried(id) > 0)).collect();
        let offhand = st.offhand.clone().filter(|id| self.carried(id) > 0);
        let armor: BTreeMap<String, String> = self.worn_armor();
        let defense = armor.values().filter_map(|id| content.items.get(id).and_then(|d| d.armor.as_ref())).map(|a| a.defense).sum();
        PocketView { capacity: self.capacity(), used: self.pocket_used(), items, chest, keys, bag, hotbar, offhand, armor, defense }
    }

    /// Whether a place lets people in now, by its hours and its days.
    pub fn place_open(&self, now: WorldTime, def: &crate::npc::LocationDef) -> bool {
        let day_ok = match def.days.as_deref() {
            Some("weekdays") => !crate::holidays::day_info(self.calendar().date(now)).day_off,
            Some("weekends") => crate::holidays::day_info(self.calendar().date(now)).day_off,
            _ => true,
        };
        let Some((open, close)) = def.hours else { return day_ok };
        let hour = (now.minute_of_day() / 60) as u32;
        let in_hours = if open <= close { hour >= open && hour < close } else { hour >= open || hour < close };
        day_ok && in_hours
    }

    pub fn location_view(&self, now: WorldTime) -> LocationView {
        let places = self
            .content()
            .locations
            .values()
            .map(|l| {
                let missing = self.missing_for(l.requires.as_ref(), now);
                (l.id.clone(), Access { open: missing.is_empty(), missing, hint: l.requires.as_ref().map(|r| r.hint.clone()).unwrap_or_default(), shut: !self.place_open(now, l) })
            })
            .collect();
        LocationView { location: self.location().to_string(), places }
    }

    /// Whether a station can be used now (where it stands), and what it would take and give.
    /// What a buyer pays for one piece of `item` (None: it does not take it; a price of 0 refuses it).
    pub fn buy_price(&self, def: &StationDef, item: &str) -> Option<u32> {
        let tags = self.content().items.get(item).map(|d| d.tags.clone()).unwrap_or_default();
        def.buys
            .iter()
            .find(|(k, _)| k == "*" || k == item || k.strip_prefix('#').is_some_and(|t| tags.iter().any(|x| x == t)))
            .map(|(_, p)| *p)
            .filter(|p| *p > 0)
    }

    pub(crate) fn station_plan(&self, now: WorldTime, def: &StationDef) -> Result<(Vec<String>, Vec<String>), crate::core::CoreError> {
        use crate::core::CoreError;
        let missing = self.missing_for(def.requires.as_ref(), now);
        if !missing.is_empty() {
            return Err(CoreError::Locked(missing));
        }
        if def.flag.as_ref().is_some_and(|f| !self.town_flags(now).contains(f)) {
            return Err(CoreError::Closed);
        }
        if !def.seasons.is_empty() && !def.seasons.contains(&self.calendar().season(now)) {
            return Err(CoreError::Closed);
        }
        let info = crate::holidays::day_info(self.calendar().date(now));
        let open_today = match def.days.as_deref() {
            Some("daily") => true,
            Some("weekdays") => !info.day_off,
            Some("weekends") => info.day_off,
            // the full-moon night: from the evening of the full moon to the small hours after it
            Some("full_moon") => info.full_moon || (now.minute_of_day() < 4 * 60 && crate::holidays::full_moon(self.calendar().date(now) - 1)),
            Some(holiday) => info.holiday.is_some_and(|h| h.id == holiday),
            None => !(matches!(def.kind.as_str(), "buy" | "sell" | "make") && def.location != "home" && info.holiday.is_some_and(|h| h.day_off)),
        };
        if !open_today {
            return Err(CoreError::Closed);
        }
        if let Some((from, to)) = def.hours {
            let hour = (now.minute_of_day() / 60) as u32;
            if hour < from || hour >= to {
                return Err(CoreError::Closed);
            }
        }
        let day = now.day();
        let used = self.state().station_uses.get(&def.id).filter(|(d, _)| *d == day).map(|(_, n)| *n).unwrap_or(0);
        if def.per_day > 0 && used >= def.per_day {
            return Err(CoreError::TooSoon);
        }
        let have = self.wallet().coins;
        if have < u64::from(def.cost) {
            return Err(CoreError::Locked(vec![Missing::Coins { have, need: u64::from(def.cost) }]));
        }
        let took = if def.needs.is_empty() { Vec::new() } else { crate::daily::take_for(self.content(), &self.pocket_items(), &def.needs).ok_or(CoreError::NotEnough)? };
        let gave: Vec<String> = def.gives.iter().flat_map(|(id, n)| std::iter::repeat(id.clone()).take(*n as usize)).collect();
        if !self.fits(&gave, &took) {
            return Err(CoreError::PocketFull);
        }
        Ok((took, gave))
    }

    pub fn stations_view(&self, now: WorldTime) -> Vec<StationView> {
        let day = now.day();
        self.content()
            .stations
            .values()
            .map(|def| {
                let result = self.station_plan(now, def);
                let (reason, missing) = match &result {
                    Ok(_) => (None, Vec::new()),
                    Err(e) => crate::core::reason_of(e),
                };
                StationView {
                    id: def.id.clone(),
                    location: def.location.clone(),
                    prop: def.prop.clone(),
                    label: def.label.clone(),
                    text: def.text.clone(),
                    kind: def.kind.clone(),
                    needs: def.needs.clone(),
                    cost: def.cost,
                    gives: def.gives.clone(),
                    earn: def.earn,
                    per_day: def.per_day,
                    used_today: self.state().station_uses.get(&def.id).filter(|(d, _)| *d == day).map(|(_, n)| *n).unwrap_or(0),
                    hours: def.hours,
                    spent: def.spent.clone(),
                    ok: result.is_ok(),
                    reason,
                    missing,
                }
            })
            .collect()
    }

    /// What blocks a help (besides the pocket): its order and its requirements.
    pub(crate) fn help_missing(&self, def: &HelpDef, now: WorldTime) -> Vec<Missing> {
        let mut missing: Vec<Missing> = def.after.iter().filter(|h| !self.state().helped.contains(*h)).map(|h| Missing::Help { help: h.clone() }).collect();
        missing.extend(self.missing_for(def.requires.as_ref(), now));
        missing
    }

    pub fn helps_view(&self, now: WorldTime) -> Vec<HelpView> {
        let pocket = self.pocket_items();
        self.content()
            .helps
            .values()
            .map(|def| {
                let done = self.state().helped.contains(&def.id);
                let missing = self.help_missing(def, now);
                let available = !done && missing.is_empty();
                let has = def.needs.is_empty() || crate::daily::take_for(self.content(), &pocket, &def.needs).is_some();
                HelpView {
                    id: def.id.clone(),
                    giver: def.giver.clone(),
                    giver_name: def.giver_name.clone(),
                    location: def.location.clone(),
                    title: def.title.clone(),
                    text: def.text.clone(),
                    needs: def.needs.clone(),
                    coins: def.coins,
                    gives: def.gives.clone(),
                    thanks: def.thanks.clone(),
                    done,
                    available,
                    ready: available && has,
                    missing,
                }
            })
            .collect()
    }

    /// The paper of the world day of `now`: the same all that day.
    pub fn paper_view(&self, now: WorldTime) -> PaperView {
        let content = self.content();
        let seed = self.meta().seed;
        let day = now.day();
        let cal = self.calendar();
        let (_, month, dom) = crate::time::civil_from_days(cal.first_day + day as i64);
        let noon = |d: u64| WorldTime(d * MINUTES_PER_DAY + 720);
        let l = content.lang;
        let weather = PaperWeather {
            today: sky_words(crate::daily::weather_at(seed, noon(day), cal.season(noon(day))), content.lang).to_string(),
            tomorrow: sky_words(crate::daily::weather_at(seed, noon(day + 1), cal.season(noon(day + 1))), content.lang).to_string(),
        };
        // the day's stories from every source (paper.rs), the weightiest on the front page
        let mut stories: Vec<PaperStory> = crate::paper::stories_of(self, now).into_iter().map(crate::paper::Story::into_paper).collect();
        let (_, town_lines, town_events) = self.town_paper(now);
        let mut town = town_lines;
        town.extend(crate::daily::paper_of(seed, content, day));
        let headline = if stories.is_empty() {
            PaperStory {
                title: l.pick("Тихий день у Липовому", "A quiet day in Lypove").to_string(),
                text: town.first().cloned().unwrap_or_else(|| l.pick("Нічого особливого не сталося, і це теж добра новина.", "Nothing much happened, and that is good news too.").to_string()),
                photo: Some(crate::paper::PhotoHint::at("village").with(&["fountain"])),
                id: "quiet".to_string(),
            }
        } else {
            stories.remove(0)
        };
        // short: a front page and three more; a few lines of each kind
        stories.truncate(3);
        town.truncate(3);
        let interview = day.checked_sub(1).and_then(|y| self.state().interviews.get(&y)).and_then(|(q, a)| {
            let def = content.interviews.get(*q as usize)?;
            Some(PaperInterview { question: def.q.clone(), answer: def.answers.get(*a as usize)?.clone() })
        });
        let mut asks: Vec<String> = crate::daily::requests_of(seed, content, now, cal.season(now))
            .into_iter()
            .map(|(npc, i)| if l.en() { format!("{} asks: {}", content.npcs[&npc].name, content.npcs[&npc].asks[i].text) } else { format!("{} просить: {}", content.npcs[&npc].name, content.npcs[&npc].asks[i].text) })
            .collect();
        for h in self.helps_view(now).into_iter().filter(|h| h.available) {
            asks.push(if l.en() { format!("{} is looking for a helper: “{}”", h.giver_name, h.title) } else { format!("{} шукає помічника: «{}»", h.giver_name, h.title) });
        }
        // what the town needs today, as people say it
        for j in self.jobs_today(now) {
            asks.push(j.text.clone());
        }
        let days_word = |n: u64| if n % 10 >= 2 && n % 10 <= 4 && !(12..=14).contains(&(n % 100)) { "дні" } else { "днів" };
        let mut events: Vec<String> = self
            .events_ahead(now, 15)
            .into_iter()
            .map(|(d, name)| match (d, l.en()) {
                (0, false) => format!("Сьогодні — {name}"),
                (1, false) => format!("Завтра — {name}"),
                (n, false) => format!("Через {n} {} — {name}", days_word(n)),
                (0, true) => format!("Today — {name}"),
                (1, true) => format!("Tomorrow — {name}"),
                (n, true) => format!("In {n} days — {name}"),
            })
            .collect();
        events.extend(town_events);
        for o in self.quests_view(now).offers.into_iter().filter(|o| o.kind == "calendar") {
            events.push(if l.en() { format!("{}: “{}”", o.giver_name, o.title) } else { format!("{}: «{}»", o.giver_name, o.title) });
        }
        // the utility office's reminders and notices come first: they are about the player's own home
        let mut bills = self.bill_news(now);
        bills.append(&mut asks);
        let mut asks = bills;
        asks.truncate(4);
        events.truncate(3);
        let mut ads: Vec<String> = content
            .stations
            .values()
            .filter(|s| matches!(s.kind.as_str(), "buy" | "sell" | "make") && self.missing_for(s.requires.as_ref(), now).is_empty())
            .map(|s| {
                let place = content.locations.get(&s.location).map(|l| l.name.clone()).unwrap_or_else(|| l.pick("вдома", "at home").to_string());
                let price = match (s.cost > 0, s.earn > 0, l.en()) {
                    (true, _, false) => format!(" — {} монет", s.cost),
                    (false, true, false) => format!(" — платять {} монет", s.earn),
                    (true, _, true) => format!(" — {} coins", s.cost),
                    (false, true, true) => format!(" — pays {} coins", s.earn),
                    _ => String::new(),
                };
                format!("{}{price} ({place})", s.label)
            })
            .collect();
        // a few a day, turning with the days
        if ads.len() > 3 {
            let start = (day as usize * 3) % ads.len();
            ads.rotate_left(start);
            ads.truncate(3);
        }
        PaperView {
            day,
            title: l.pick("Липовий вісник", "The Lypove Herald").to_string(),
            number: day + 1,
            date: if l.en() { format!("{} {dom}", MONTHS_EN[(month - 1) as usize]) } else { format!("{dom} {}", MONTHS[(month - 1) as usize]) },
            weather,
            headline,
            stories,
            interview,
            town,
            asks,
            ads,
            events,
        }
    }
}

/// Helps whose `after` chains go round in a circle.
pub(crate) fn help_cycle(helps: &BTreeMap<String, HelpDef>) -> Option<String> {
    fn visit(id: &str, helps: &BTreeMap<String, HelpDef>, path: &mut BTreeSet<String>, done: &mut BTreeSet<String>) -> bool {
        if done.contains(id) {
            return false;
        }
        if !path.insert(id.to_string()) {
            return true;
        }
        if let Some(h) = helps.get(id) {
            for a in &h.after {
                if visit(a, helps, path, done) {
                    return true;
                }
            }
        }
        path.remove(id);
        done.insert(id.to_string());
        false
    }
    let mut done = BTreeSet::new();
    for id in helps.keys() {
        if visit(id, helps, &mut BTreeSet::new(), &mut done) {
            return Some(id.clone());
        }
    }
    None
}
