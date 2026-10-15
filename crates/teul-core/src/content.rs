//! Data-driven content: items, styles, actions, rewards and room expansions loaded from JSON packs.

use std::collections::BTreeMap;
use std::fmt;

use serde::{Deserialize, Serialize};

use crate::unlock::Unlock;

pub const PACK_SCHEMA: u32 = 1;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ContentError {
    Malformed(String),
    UnsupportedSchema(u32),
    DuplicateId(String),
    UnknownRef { from: String, kind: &'static str, id: String },
    Invalid(String),
}

impl fmt::Display for ContentError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ContentError::Malformed(m) => write!(f, "content pack is not valid JSON: {m}"),
            ContentError::UnsupportedSchema(s) => write!(f, "content pack schema {s} is not supported"),
            ContentError::DuplicateId(id) => write!(f, "duplicate content id '{id}'"),
            ContentError::UnknownRef { from, kind, id } => write!(f, "'{from}' refers to unknown {kind} '{id}'"),
            ContentError::Invalid(m) => write!(f, "invalid content: {m}"),
        }
    }
}

impl std::error::Error for ContentError {}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Footprint {
    pub w: u8,
    pub d: u8,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Layer {
    Floor,
    Wall,
    Surface,
    /// A flat floor covering: furniture stands on it, only other rugs collide with it.
    Rug,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields, default)]
pub struct PlacementRules {
    pub provides_surface: bool,
}

/// One isometric box of a model: `[x, y, z, w, d, h]` in hundredths of a tile, coloured by `slot`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Primitive {
    #[serde(rename = "box")]
    pub bx: [i32; 6],
    pub slot: String,
    /// How the box is drawn: `box` (default), `cyl`, `ball`, `cone` or `round`. Only the look changes; the
    /// footprint rules always use the box.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shape: Option<String>,
}

pub const SHAPES: [&str; 6] = ["box", "cyl", "ball", "cone", "round", "gable"];

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SlotDef {
    pub default: String,
    pub palette: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ItemDef {
    pub id: String,
    pub name: String,
    pub category: String,
    #[serde(default)]
    pub tags: Vec<String>,
    pub footprint: Footprint,
    pub layer: Layer,
    #[serde(default)]
    pub rules: PlacementRules,
    #[serde(default)]
    pub model: Vec<Primitive>,
    #[serde(default)]
    pub slots: BTreeMap<String, SlotDef>,
    #[serde(default)]
    pub actions: Vec<String>,
    /// Only one may exist at a time (the portal, for example).
    #[serde(default)]
    pub unique: bool,
    /// Scenery of the world (the village's buildings): never sold, never owned.
    #[serde(default)]
    pub hidden: bool,
    /// A worn thing: what the workshop mends it back into.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub restores: Option<String>,
    pub acquire: Unlock,
    /// Carried in the pocket (finds, fish, food, goods) rather than kept as furniture.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub carry: bool,
    /// A guide or key: kept on the keyring, takes no pocket room, never given, sold or stashed.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub key: bool,
    /// A bag: the pocket holds this many more while it is owned (only the best bag counts).
    #[serde(default, skip_serializing_if = "is_zero")]
    pub bag: u32,
    /// A garment: the slot it is worn in and the look it gives (bought at the clothes shop).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub wear: Option<crate::style::WearDef>,
    /// A piece of armour: where it is worn (head, body, legs, feet) and how much it shields.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub armor: Option<ArmorDef>,
    /// Bound to its owner: never falls, never given.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub bound: bool,
}

/// Where a piece of armour is worn and how much it shields.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ArmorDef {
    pub slot: String,
    pub defense: u32,
    /// How many blows it takes before it is worn through.
    #[serde(default = "armor_durability")]
    pub durability: u32,
}

fn armor_durability() -> u32 {
    100
}

/// The places armour is worn.
pub const ARMOR_SLOTS: [&str; 4] = ["head", "body", "legs", "feet"];

fn is_zero(n: &u32) -> bool {
    *n == 0
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StyleDef {
    pub id: String,
    pub kind: String,
    pub name: String,
    #[serde(default)]
    pub params: BTreeMap<String, String>,
    pub acquire: Unlock,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ExpansionDef {
    pub id: String,
    pub name: String,
    /// Floor cells this expansion adds to the room's area budget.
    pub area: u32,
    pub acquire: Unlock,
}

/// A surface finish for an item slot (gloss, pattern...). `kind` tells the renderer how to draw it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MaterialDef {
    pub id: String,
    pub name: String,
    pub kind: String,
    #[serde(default)]
    pub params: BTreeMap<String, String>,
}

/// A bundle of styles and settings applied together.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ThemeDef {
    pub id: String,
    pub name: String,
    /// Style kind to style id.
    pub styles: BTreeMap<String, String>,
    #[serde(default)]
    pub settings: BTreeMap<String, String>,
    pub acquire: Unlock,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ActionDef {
    pub id: String,
    pub name: String,
    pub minutes: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TokenGrant {
    pub kind: String,
    pub n: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RewardRule {
    pub action: String,
    #[serde(default)]
    pub coins: u32,
    #[serde(default)]
    pub token: Option<TokenGrant>,
    #[serde(default)]
    pub per_day_cap: Option<u32>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct StartRoom {
    rect: Rect,
    /// Floor area the home may have from the start (at least the rectangle's).
    #[serde(default)]
    area: u32,
    /// Coins for each cell of floor bought while building (the home grows as it is built).
    #[serde(default)]
    cell_price: u32,
}

/// A one-time gift of things (a furnished house for a new home, for example).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct KitDef {
    pub id: String,
    /// Item ids; an id given twice is two copies.
    #[serde(default)]
    pub items: Vec<String>,
    #[serde(default)]
    pub styles: Vec<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Pack {
    schema: u32,
    id: String,
    version: u32,
    #[serde(default)]
    start_coins: u32,
    /// Renamed content ids: old → current (see `alias.rs`). Never remove an entry.
    #[serde(default)]
    aliases: BTreeMap<String, String>,
    /// Items of a released version the game no longer has (with nothing to stand for them): a save that owns or
    /// placed one opens without it. Never remove an entry.
    #[serde(default)]
    retired: Vec<String>,
    #[serde(default)]
    start_room: Option<StartRoom>,
    #[serde(default)]
    start_styles: BTreeMap<String, String>,
    #[serde(default)]
    palettes: BTreeMap<String, Vec<String>>,
    #[serde(default)]
    items: Vec<ItemDef>,
    #[serde(default)]
    styles: Vec<StyleDef>,
    #[serde(default)]
    actions: Vec<ActionDef>,
    #[serde(default)]
    rewards: Vec<RewardRule>,
    #[serde(default)]
    expansions: Vec<ExpansionDef>,
    #[serde(default)]
    materials: Vec<MaterialDef>,
    #[serde(default)]
    themes: Vec<ThemeDef>,
    #[serde(default)]
    npcs: Vec<crate::npc::NpcDef>,
    #[serde(default)]
    kits: Vec<KitDef>,
    #[serde(default)]
    collections: Vec<crate::daily::CollectionDef>,
    /// Templates for the village paper (`{a}` and `{b}` are people's names).
    #[serde(default)]
    paper: Vec<String>,
    #[serde(default)]
    residents: Vec<crate::life::ResidentDef>,
    #[serde(default)]
    locations: Vec<crate::npc::LocationDef>,
    #[serde(default)]
    taxi: Vec<TaxiStop>,
    /// The room of an empty pocket.
    #[serde(default)]
    pocket: Option<u32>,
    /// How many kinds the inventory holds (it took the pocket's place); the pocket's room when absent.
    #[serde(default)]
    inventory: Option<u32>,
    #[serde(default)]
    stations: Vec<crate::economy::StationDef>,
    #[serde(default)]
    helps: Vec<crate::economy::HelpDef>,
    #[serde(default)]
    interviews: Vec<crate::economy::InterviewDef>,
    #[serde(default)]
    recipes: Vec<crate::home::RecipeDef>,
    #[serde(default)]
    bills: Option<crate::home::BillsDef>,
    #[serde(default)]
    quests: Vec<crate::quests::QuestDef>,
    #[serde(default)]
    jobs: Vec<crate::quests::JobDef>,
    /// Jobs the player can take shifts at.
    #[serde(default)]
    work: Vec<crate::work::WorkDef>,
    /// What grows in the garden.
    #[serde(default)]
    plants: Vec<crate::garden::PlantDef>,
    /// How things at home age, and what can be made at a workbench.
    #[serde(default)]
    wear: Vec<crate::wear::WearDef>,
    #[serde(default)]
    crafts: Vec<crate::craft::CraftDef>,
    /// Rooms the builders build on, and the animals one can live with.
    #[serde(default)]
    builds: Vec<crate::builds::BuildDef>,
    #[serde(default)]
    pets: Vec<crate::pets::PetDef>,
    #[serde(default)]
    tools: Vec<crate::craft::ToolDef>,
    #[serde(default)]
    fashion: Option<crate::style::FashionDef>,
    #[serde(default)]
    homes: Vec<crate::style::HomeDef>,
    #[serde(default)]
    projects: Vec<crate::town::ProjectDef>,
    #[serde(default)]
    openings: Vec<crate::town::OpeningDef>,
    /// Names for the town's babies.
    #[serde(default)]
    births: Vec<String>,
    /// Pieces of music one can play (their scores are the shell's).
    #[serde(default)]
    pieces: Vec<crate::media::PieceDef>,
    /// The driving school, the service station, the road's rules (drive.rs).
    #[serde(default)]
    driving: Option<crate::drive::DrivingDef>,
    /// How the town grows and wears (`growth.rs`).
    #[serde(default)]
    growth: Option<crate::growth::GrowthDef>,
}

/// A taxi stand: where it is and what a ride to it costs.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TaxiStop {
    pub id: String,
    pub name: String,
    pub location: String,
    pub x: i32,
    pub y: i32,
    pub fare: u32,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Content {
    pub packs: BTreeMap<String, u32>,
    pub start_coins: u32,
    pub start_room: Rect,
    pub start_area: u32,
    /// Coins per cell of floor bought while building; 0 means floor is not sold.
    pub cell_price: u32,
    pub kits: BTreeMap<String, KitDef>,
    pub collections: BTreeMap<String, crate::daily::CollectionDef>,
    pub paper: Vec<String>,
    /// Every gathering spot and fishing place of every location, by id.
    pub spots: BTreeMap<String, crate::daily::SpotDef>,
    pub fishing: BTreeMap<String, crate::daily::FishingDef>,
    /// Every site of every location, and the location it lies in.
    pub sites: BTreeMap<String, crate::life::SiteDef>,
    pub site_location: BTreeMap<String, String>,
    pub residents: BTreeMap<String, crate::life::ResidentDef>,
    /// The taxi's stands, by id.
    pub taxi: BTreeMap<String, TaxiStop>,
    pub start_styles: BTreeMap<String, String>,
    pub palettes: BTreeMap<String, Vec<String>>,
    pub items: BTreeMap<String, ItemDef>,
    pub styles: BTreeMap<String, StyleDef>,
    pub actions: BTreeMap<String, ActionDef>,
    pub expansions: BTreeMap<String, ExpansionDef>,
    pub rewards: Vec<RewardRule>,
    pub materials: BTreeMap<String, MaterialDef>,
    pub themes: BTreeMap<String, ThemeDef>,
    pub npcs: BTreeMap<String, crate::npc::NpcDef>,
    pub locations: BTreeMap<String, crate::npc::LocationDef>,
    /// The location the home's front door opens onto (the one with an entry).
    pub front: Option<String>,
    /// Which location each place lies in.
    pub place_location: BTreeMap<String, String>,
    /// Places of the village by id (empty without a village).
    pub places: BTreeMap<String, crate::npc::PlaceDef>,
    /// Which location each gathering spot and fishing place lies in.
    pub spot_location: BTreeMap<String, String>,
    pub fishing_location: BTreeMap<String, String>,
    /// The room of an empty pocket (in pieces: what was done before the inventory is re-derived by it).
    pub pocket: u32,
    /// How many kinds the inventory holds (never past 64).
    pub inventory: u32,
    pub stations: BTreeMap<String, crate::economy::StationDef>,
    pub helps: BTreeMap<String, crate::economy::HelpDef>,
    pub interviews: Vec<crate::economy::InterviewDef>,
    pub recipes: BTreeMap<String, crate::home::RecipeDef>,
    /// The monthly bills (none: the home has no bills).
    pub bills: Option<crate::home::BillsDef>,
    /// Quests: stories and the year's calendar.
    pub quests: BTreeMap<String, crate::quests::QuestDef>,
    /// The kinds of small jobs the town may have on a day.
    pub jobs: BTreeMap<String, crate::quests::JobDef>,
    /// Jobs with shifts, by id.
    pub work: BTreeMap<String, crate::work::WorkDef>,
    /// Plants of the garden, by id.
    pub plants: BTreeMap<String, crate::garden::PlantDef>,
    /// How things at home age (`wear.rs`), in the order given; what can be made at a workbench (`craft.rs`).
    pub wear: BTreeMap<String, crate::wear::WearDef>,
    pub crafts: BTreeMap<String, crate::craft::CraftDef>,
    pub builds: BTreeMap<String, crate::builds::BuildDef>,
    pub pets: BTreeMap<String, crate::pets::PetDef>,
    /// Tools and how long they serve, by item.
    pub tools: BTreeMap<String, crate::craft::ToolDef>,
    /// The clothes shop and the salon (none: the look stays as made).
    pub fashion: Option<crate::style::FashionDef>,
    /// Homes: the first house, flats and houses to rent or buy, plots to rent.
    pub homes: BTreeMap<String, crate::style::HomeDef>,
    /// What the town builds together, and the shops that open (`town.rs`).
    pub projects: BTreeMap<String, crate::town::ProjectDef>,
    pub openings: BTreeMap<String, crate::town::OpeningDef>,
    pub births: Vec<String>,
    /// Pieces of music, by id.
    pub pieces: BTreeMap<String, crate::media::PieceDef>,
    /// The driving school, the service station and the road's fines (none: no cars for the player).
    pub driving: Option<crate::drive::DrivingDef>,
    /// How the town grows and wears: building sites, empty houses, wear, the ice-cream cart.
    pub growth: Option<crate::growth::GrowthDef>,
    /// A hash of the pack texts: the same content gives the same outcomes for the same inputs.
    pub fingerprint: u64,
    /// Renamed content ids, read as the current ones when an old log is replayed (`alias.rs`).
    pub aliases: crate::alias::Aliases,
    /// Items of a released version the game no longer has: a save opens without them.
    pub retired: std::collections::BTreeSet<String>,
    /// The language the words are shown in. Only text: it never takes part in an outcome, and the fingerprint
    /// is always that of the packs as written (`from_packs_in`).
    pub lang: Lang,
}

/// The language of the words the world shows. Ukrainian is the world's own; others come as text overlays.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Lang {
    #[default]
    Uk,
    En,
}

impl Lang {
    pub fn en(self) -> bool {
        self == Lang::En
    }

    /// Picks one of two lists of the same length for this language.
    pub fn pick_list<'a>(self, uk: &[&'a str], en: &[&'a str]) -> Vec<&'a str> {
        if self.en() { en.to_vec() } else { uk.to_vec() }
    }

    /// Picks the words for this language.
    pub fn pick<'a>(self, uk: &'a str, en: &'a str) -> &'a str {
        if self.en() { en } else { uk }
    }
}

/// A text overlay: `{"lang": "en", "pack": "base", "text": {...}}`, where `text` mirrors the pack's shape and
/// holds only the strings it replaces. Lists are keyed by their elements' `id` (or by position when they have none).
#[derive(Deserialize)]
struct Overlay {
    lang: Lang,
    pack: String,
    text: serde_json::Value,
}

fn overlay_text(target: &mut serde_json::Value, text: &serde_json::Value) {
    use serde_json::Value;
    match (target, text) {
        (Value::String(s), Value::String(t)) => *s = t.clone(),
        (Value::Object(m), Value::Object(o)) => {
            for (k, v) in o {
                if let Some(t) = m.get_mut(k) {
                    overlay_text(t, v);
                }
            }
        }
        (Value::Array(a), Value::Object(o)) => {
            for (i, el) in a.iter_mut().enumerate() {
                let key = el.get("id").and_then(Value::as_str).map(str::to_string).unwrap_or_else(|| i.to_string());
                if let Some(v) = o.get(&key) {
                    overlay_text(el, v);
                }
            }
        }
        _ => {}
    }
}

fn insert_unique<T>(map: &mut BTreeMap<String, T>, id: &str, value: T) -> Result<(), ContentError> {
    if map.insert(id.to_string(), value).is_some() {
        return Err(ContentError::DuplicateId(id.to_string()));
    }
    Ok(())
}

impl Content {
    pub fn empty() -> Content {
        Content {
            packs: BTreeMap::new(),
            start_coins: 0,
            start_room: Rect { x: 0, y: 0, w: 0, h: 0 },
            start_styles: BTreeMap::new(),
            palettes: BTreeMap::new(),
            items: BTreeMap::new(),
            styles: BTreeMap::new(),
            actions: BTreeMap::new(),
            expansions: BTreeMap::new(),
            rewards: Vec::new(),
            materials: BTreeMap::new(),
            themes: BTreeMap::new(),
            npcs: BTreeMap::new(),
            kits: BTreeMap::new(),
            collections: BTreeMap::new(),
            paper: Vec::new(),
            spots: BTreeMap::new(),
            fishing: BTreeMap::new(),
            sites: BTreeMap::new(),
            site_location: BTreeMap::new(),
            residents: BTreeMap::new(),
            taxi: BTreeMap::new(),
            start_area: 0,
            cell_price: 0,
            locations: BTreeMap::new(),
            front: None,
            place_location: BTreeMap::new(),
            places: BTreeMap::new(),
            spot_location: BTreeMap::new(),
            fishing_location: BTreeMap::new(),
            pocket: crate::economy::DEFAULT_POCKET,
            inventory: crate::economy::DEFAULT_POCKET,
            stations: BTreeMap::new(),
            helps: BTreeMap::new(),
            interviews: Vec::new(),
            recipes: BTreeMap::new(),
            bills: None,
            quests: BTreeMap::new(),
            jobs: BTreeMap::new(),
            work: BTreeMap::new(),
            pieces: BTreeMap::new(),
            plants: BTreeMap::new(),
            wear: BTreeMap::new(),
            crafts: BTreeMap::new(),
            builds: BTreeMap::new(),
            pets: BTreeMap::new(),
            tools: BTreeMap::new(),
            fashion: None,
            homes: BTreeMap::new(),
            projects: BTreeMap::new(),
            openings: BTreeMap::new(),
            births: Vec::new(),
            driving: None,
            growth: None,
            fingerprint: 0,
            aliases: crate::alias::Aliases::default(),
            retired: std::collections::BTreeSet::new(),
            lang: Lang::Uk,
        }
    }

    /// As `from_packs`, with the words of one pack shown in another language (`overlay`, see `Overlay`).
    /// The fingerprint stays that of the packs as written, so outcomes never depend on the language.
    pub fn from_packs_in(json: &[&str], overlay: Option<&str>) -> Result<Content, ContentError> {
        let Some(overlay) = overlay else { return Content::from_packs(json) };
        let overlay: Overlay = serde_json::from_str(overlay).map_err(|e| ContentError::Malformed(format!("overlay: {e}")))?;
        let mut texts = Vec::with_capacity(json.len());
        for text in json {
            let mut value: serde_json::Value = serde_json::from_str(text).map_err(|e| ContentError::Malformed(e.to_string()))?;
            if value.get("id").and_then(serde_json::Value::as_str) == Some(overlay.pack.as_str()) {
                overlay_text(&mut value, &overlay.text);
                texts.push(value.to_string());
            } else {
                texts.push(text.to_string());
            }
        }
        let refs: Vec<&str> = texts.iter().map(String::as_str).collect();
        let mut c = Content::from_packs(&refs)?;
        c.fingerprint = Content::from_packs_fingerprint(json);
        c.lang = overlay.lang;
        Ok(c)
    }

    fn from_packs_fingerprint(json: &[&str]) -> u64 {
        let mut whole = Vec::new();
        for text in json {
            whole.extend_from_slice(text.as_bytes());
            whole.push(0);
        }
        crate::rng::fnv1a64(&whole) & crate::economy::MASK52
    }

    /// Loads, merges and validates packs. Any problem rejects the whole set.
    pub fn from_packs(json: &[&str]) -> Result<Content, ContentError> {
        let mut c = Content::empty();
        let mut room_set = false;
        let mut whole = Vec::new();
        let mut aliases: BTreeMap<String, String> = BTreeMap::new();
        for text in json {
            whole.extend_from_slice(text.as_bytes());
            whole.push(0);
            let pack: Pack = serde_json::from_str(text).map_err(|e| ContentError::Malformed(e.to_string()))?;
            if pack.schema != PACK_SCHEMA {
                return Err(ContentError::UnsupportedSchema(pack.schema));
            }
            insert_unique(&mut c.packs, &pack.id, pack.version)?;
            if let (false, Some(room)) = (room_set, pack.start_room) {
                c.start_room = room.rect;
                c.start_area = room.area;
                c.cell_price = room.cell_price;
                room_set = true;
            }
            if c.start_coins == 0 {
                c.start_coins = pack.start_coins;
            }
            for (from, to) in pack.aliases {
                if aliases.insert(from.clone(), to).is_some() {
                    return Err(ContentError::DuplicateId(from));
                }
            }
            c.retired.extend(pack.retired);
            for (kind, id) in pack.start_styles {
                c.start_styles.entry(kind).or_insert(id);
            }
            for (name, colors) in pack.palettes {
                insert_unique(&mut c.palettes, &name, colors)?;
            }
            for item in pack.items {
                let id = item.id.clone();
                insert_unique(&mut c.items, &id, item)?;
            }
            for style in pack.styles {
                let id = style.id.clone();
                insert_unique(&mut c.styles, &id, style)?;
            }
            for action in pack.actions {
                let id = action.id.clone();
                insert_unique(&mut c.actions, &id, action)?;
            }
            for expansion in pack.expansions {
                let id = expansion.id.clone();
                insert_unique(&mut c.expansions, &id, expansion)?;
            }
            c.rewards.extend(pack.rewards);
            for material in pack.materials {
                let id = material.id.clone();
                insert_unique(&mut c.materials, &id, material)?;
            }
            for theme in pack.themes {
                let id = theme.id.clone();
                insert_unique(&mut c.themes, &id, theme)?;
            }
            for col in pack.collections {
                let id = col.id.clone();
                insert_unique(&mut c.collections, &id, col)?;
            }
            c.paper.extend(pack.paper);
            if let Some(p) = pack.pocket {
                c.pocket = p;
                c.inventory = pack.inventory.unwrap_or(p);
            }
            if let Some(i) = pack.inventory {
                c.inventory = i;
            }
            for st in pack.stations {
                let id = st.id.clone();
                insert_unique(&mut c.stations, &id, st)?;
            }
            for h in pack.helps {
                let id = h.id.clone();
                insert_unique(&mut c.helps, &id, h)?;
            }
            c.interviews.extend(pack.interviews);
            for r in pack.recipes {
                let id = r.id.clone();
                insert_unique(&mut c.recipes, &id, r)?;
            }
            if pack.bills.is_some() {
                c.bills = pack.bills;
            }
            for q in pack.quests {
                let id = q.id.clone();
                insert_unique(&mut c.quests, &id, q)?;
            }
            if pack.fashion.is_some() {
                c.fashion = pack.fashion;
            }
            if pack.driving.is_some() {
                c.driving = pack.driving;
            }
            for h in pack.homes {
                let id = h.id.clone();
                insert_unique(&mut c.homes, &id, h)?;
            }
            for j in pack.jobs {
                let id = j.id.clone();
                insert_unique(&mut c.jobs, &id, j)?;
            }
            for w in pack.work {
                let id = w.id.clone();
                insert_unique(&mut c.work, &id, w)?;
            }
            for pl in pack.plants {
                let id = pl.id.clone();
                insert_unique(&mut c.plants, &id, pl)?;
            }
            for w in pack.wear {
                let id = w.id.clone();
                insert_unique(&mut c.wear, &id, w)?;
            }
            for t in pack.tools {
                let id = t.item.clone();
                insert_unique(&mut c.tools, &id, t)?;
            }
            for cr in pack.crafts {
                let id = cr.id.clone();
                insert_unique(&mut c.crafts, &id, cr)?;
            }
            for bd in pack.builds {
                let id = bd.id.clone();
                insert_unique(&mut c.builds, &id, bd)?;
            }
            for pd in pack.pets {
                let id = pd.id.clone();
                insert_unique(&mut c.pets, &id, pd)?;
            }
            for p in pack.projects {
                let id = p.id.clone();
                insert_unique(&mut c.projects, &id, p)?;
            }
            for o in pack.openings {
                let id = o.id.clone();
                insert_unique(&mut c.openings, &id, o)?;
            }
            c.births.extend(pack.births);
            for p in pack.pieces {
                let id = p.id.clone();
                insert_unique(&mut c.pieces, &id, p)?;
            }
            if let Some(g) = pack.growth {
                let have = c.growth.get_or_insert_with(Default::default);
                have.sites.extend(g.sites);
                have.abandon.extend(g.abandon);
                have.wear.extend(g.wear);
                if g.cart.is_some() {
                    have.cart = g.cart;
                }
            }
            for t in pack.taxi {
                let id = t.id.clone();
                insert_unique(&mut c.taxi, &id, t)?;
            }
            for r in pack.residents {
                let id = r.id.clone();
                insert_unique(&mut c.residents, &id, r)?;
            }
            for kit in pack.kits {
                let id = kit.id.clone();
                insert_unique(&mut c.kits, &id, kit)?;
            }
            for npc in pack.npcs {
                let id = npc.id.clone();
                insert_unique(&mut c.npcs, &id, npc)?;
            }
            for location in pack.locations {
                for spot in &location.spots {
                    insert_unique(&mut c.spots, &spot.id, spot.clone())?;
                    c.spot_location.insert(spot.id.clone(), location.id.clone());
                }
                for site in &location.sites {
                    insert_unique(&mut c.sites, &site.id, site.clone())?;
                    c.site_location.insert(site.id.clone(), location.id.clone());
                }
                for f in &location.fishing {
                    insert_unique(&mut c.fishing, &f.id, f.clone())?;
                    c.fishing_location.insert(f.id.clone(), location.id.clone());
                }
                for place in &location.places {
                    insert_unique(&mut c.places, &place.id, place.clone())?;
                    c.place_location.insert(place.id.clone(), location.id.clone());
                }
                if location.entry.is_some() {
                    if c.front.is_some() {
                        return Err(ContentError::Invalid("two locations open onto the front door".into()));
                    }
                    c.front = Some(location.id.clone());
                }
                let id = location.id.clone();
                insert_unique(&mut c.locations, &id, location)?;
            }
        }
        c.fingerprint = crate::rng::fnv1a64(&whole) & crate::economy::MASK52;
        c.aliases = crate::alias::Aliases::new(aliases).map_err(ContentError::Invalid)?;
        c.validate_aliases()?;
        c.validate()?;
        c.validate_economy()?;
        c.validate_work_garden()?;
        c.validate_growth()?;
        Ok(c)
    }

    /// Every content id a save can name (items, styles, places, people, stations…), for the alias table and
    /// for the test that keeps the ids of released versions (`tests/content_ids_kept.rs`).
    pub fn ids(&self) -> std::collections::BTreeSet<String> {
        let mut out = std::collections::BTreeSet::new();
        out.extend(self.items.keys().cloned());
        out.extend(self.styles.keys().cloned());
        out.extend(self.actions.keys().cloned());
        out.extend(self.recipes.keys().cloned());
        out.extend(self.npcs.keys().cloned());
        out.extend(self.locations.keys().cloned());
        out.extend(self.places.keys().cloned());
        out.extend(self.sites.keys().cloned());
        out.extend(self.residents.keys().cloned());
        out.extend(self.stations.keys().cloned());
        out.extend(self.helps.keys().cloned());
        out.extend(self.quests.keys().cloned());
        out.extend(self.jobs.keys().cloned());
        out.extend(self.plants.keys().cloned());
        out.extend(self.crafts.keys().cloned());
        out.extend(self.tools.keys().cloned());
        out.extend(self.pets.keys().cloned());
        out.extend(self.pieces.keys().cloned());
        out.extend(self.homes.keys().cloned());
        out.extend(self.materials.keys().cloned());
        out.extend(self.themes.keys().cloned());
        out.extend(self.expansions.keys().cloned());
        out.extend(self.kits.keys().cloned());
        out.extend(self.spots.keys().cloned());
        out.extend(self.fishing.keys().cloned());
        out.extend(self.taxi.keys().cloned());
        out.extend(self.projects.keys().cloned());
        out.extend(self.openings.keys().cloned());
        out.extend(self.collections.keys().cloned());
        out
    }

    /// Whether an id is a live content id (of any kind).
    pub fn has_id(&self, id: &str) -> bool {
        self.items.contains_key(id)
            || self.styles.contains_key(id)
            || self.actions.contains_key(id)
            || self.recipes.contains_key(id)
            || self.npcs.contains_key(id)
            || self.locations.contains_key(id)
            || self.places.contains_key(id)
            || self.sites.contains_key(id)
            || self.residents.contains_key(id)
            || self.stations.contains_key(id)
            || self.helps.contains_key(id)
            || self.quests.contains_key(id)
            || self.jobs.contains_key(id)
            || self.plants.contains_key(id)
            || self.crafts.contains_key(id)
            || self.tools.contains_key(id)
            || self.pets.contains_key(id)
            || self.pieces.contains_key(id)
            || self.homes.contains_key(id)
            || self.materials.contains_key(id)
            || self.themes.contains_key(id)
            || self.expansions.contains_key(id)
            || self.kits.contains_key(id)
            || self.spots.contains_key(id)
            || self.fishing.contains_key(id)
            || self.taxi.contains_key(id)
            || self.projects.contains_key(id)
            || self.openings.contains_key(id)
            || self.collections.contains_key(id)
    }

    /// An old id must be gone (a live id cannot also be an alias), and what it stands for must exist.
    fn validate_aliases(&self) -> Result<(), ContentError> {
        let live = |id: &str| self.has_id(id);
        for (from, to) in self.aliases.iter() {
            if live(from) {
                return Err(ContentError::Invalid(format!("'{from}' is both a live id and an alias")));
            }
            if !live(to) {
                return Err(ContentError::UnknownRef { from: from.clone(), kind: "alias target", id: to.clone() });
            }
        }
        if let Some(id) = self.retired.iter().find(|id| live(id) || self.aliases.resolve(id) != id.as_str()) {
            return Err(ContentError::Invalid(format!("'{id}' is retired and live (or an alias) at once")));
        }
        Ok(())
    }

    fn validate(&self) -> Result<(), ContentError> {
        if self.start_room != (Rect { x: 0, y: 0, w: 0, h: 0 }) && (self.start_room.w < 1 || self.start_room.h < 1) {
            return Err(ContentError::Invalid("the start room must be at least 1x1".into()));
        }
        for item in self.items.values() {
            if item.footprint.w < 1 || item.footprint.d < 1 {
                return Err(ContentError::Invalid(format!("item '{}' has an empty footprint", item.id)));
            }
            for action in &item.actions {
                if !self.actions.contains_key(action) {
                    return Err(ContentError::UnknownRef { from: item.id.clone(), kind: "action", id: action.clone() });
                }
            }
            for (slot, def) in &item.slots {
                let palette = self.palettes.get(&def.palette).ok_or_else(|| ContentError::UnknownRef {
                    from: item.id.clone(),
                    kind: "palette",
                    id: def.palette.clone(),
                })?;
                if !palette.contains(&def.default) {
                    return Err(ContentError::Invalid(format!(
                        "item '{}' slot '{slot}' default {} is not in palette '{}'",
                        item.id, def.default, def.palette
                    )));
                }
            }
            for prim in &item.model {
                if !item.slots.contains_key(&prim.slot) {
                    return Err(ContentError::UnknownRef { from: item.id.clone(), kind: "slot", id: prim.slot.clone() });
                }
                if let Some(shape) = &prim.shape {
                    if !SHAPES.contains(&shape.as_str()) {
                        return Err(ContentError::Invalid(format!("item '{}' uses unknown shape '{shape}'", item.id)));
                    }
                }
            }
        }
        for reward in &self.rewards {
            if !self.actions.contains_key(&reward.action) {
                return Err(ContentError::UnknownRef { from: "rewards".into(), kind: "action", id: reward.action.clone() });
            }
        }
        let item_ref = |from: &str, id: &str| -> Result<(), ContentError> {
            if self.items.contains_key(id) {
                Ok(())
            } else {
                Err(ContentError::UnknownRef { from: from.to_string(), kind: "item", id: id.to_string() })
            }
        };
        for spot in self.spots.values() {
            for g in &spot.gives {
                item_ref(&spot.id, &g.item)?;
            }
        }
        for f in self.fishing.values() {
            for g in &f.fish {
                item_ref(&f.id, &g.item)?;
            }
        }
        for col in self.collections.values() {
            item_ref(&col.id, &col.reward)?;
            for i in &col.items {
                item_ref(&col.id, i)?;
            }
        }
        for npc in self.npcs.values() {
            let asks = npc.asks.iter().chain(npc.story.iter().filter_map(|c| c.ask.as_ref()));
            for ask in asks {
                if let Some(g) = &ask.gift {
                    item_ref(&npc.id, g)?;
                }
                for (key, n) in &ask.items {
                    if *n == 0 || (!key.starts_with('#') && !self.items.contains_key(key)) {
                        return Err(ContentError::UnknownRef { from: npc.id.clone(), kind: "item", id: key.clone() });
                    }
                }
            }
            for g in npc.letters.iter().filter_map(|l| l.gift.as_ref()).chain(npc.story.iter().filter_map(|c| c.gift.as_ref())) {
                item_ref(&npc.id, g)?;
            }
        }
        for r in self.residents.values() {
            let site = |id: &str| -> Result<(), ContentError> {
                if self.sites.contains_key(id) {
                    Ok(())
                } else {
                    Err(ContentError::UnknownRef { from: r.id.clone(), kind: "site", id: id.to_string() })
                }
            };
            site(&r.home)?;
            if let Some((s, role)) = &r.job {
                site(s)?;
                if !self.sites[s].jobs.iter().any(|j| &j.role == role) {
                    return Err(ContentError::Invalid(format!("{} works as {role} at {s}, which has no such job", r.id)));
                }
            }
            if let Some(s) = &r.school {
                site(s)?;
            }
        }
        for kit in self.kits.values() {
            for item in &kit.items {
                if !self.items.contains_key(item) {
                    return Err(ContentError::UnknownRef { from: kit.id.clone(), kind: "item", id: item.clone() });
                }
            }
            for style in &kit.styles {
                if !self.styles.contains_key(style) {
                    return Err(ContentError::UnknownRef { from: kit.id.clone(), kind: "style", id: style.clone() });
                }
            }
        }
        for npc in self.npcs.values() {
            let known = |place: &str| self.places.contains_key(place);
            if !known(&npc.home) {
                return Err(ContentError::UnknownRef { from: npc.id.clone(), kind: "place", id: npc.home.clone() });
            }
            for slot in &npc.routine {
                if slot.from >= slot.to || slot.to > 1440 {
                    return Err(ContentError::Invalid(format!("npc '{}' has a routine slot {}..{}", npc.id, slot.from, slot.to)));
                }
                if slot.places.iter().all(|(_, w)| *w == 0) {
                    return Err(ContentError::Invalid(format!("npc '{}' has a routine slot with nowhere to be", npc.id)));
                }
                for (place, _) in &slot.places {
                    if !known(place) {
                        return Err(ContentError::UnknownRef { from: npc.id.clone(), kind: "place", id: place.clone() });
                    }
                }
            }
            for gift in &npc.gifts {
                if !self.items.contains_key(&gift.item) {
                    return Err(ContentError::UnknownRef { from: npc.id.clone(), kind: "item", id: gift.item.clone() });
                }
            }
        }
        for def in self.items.values() {
            if let Some(into) = &def.restores {
                if !self.items.contains_key(into) {
                    return Err(ContentError::UnknownRef { from: def.id.clone(), kind: "item", id: into.clone() });
                }
            }
        }
        for v in self.locations.values() {
            if v.tiles.len() != v.h as usize || v.tiles.iter().any(|row| row.chars().count() != v.w as usize) {
                return Err(ContentError::Invalid(format!("the tiles of '{}' do not match its size", v.id)));
            }
            let inside = |x: i32, y: i32| x >= 0 && y >= 0 && x < v.w && y < v.h;
            if let Some((x, y)) = v.entry {
                if !inside(x, y) {
                    return Err(ContentError::Invalid(format!("the entry of '{}' is outside the map", v.id)));
                }
            }
            for place in &v.places {
                if place.w < 1 || place.h < 1 || !inside(place.x, place.y) || !inside(place.x + place.w - 1, place.y + place.h - 1) {
                    return Err(ContentError::Invalid(format!("place '{}' is not inside '{}'", place.id, v.id)));
                }
            }
            for prop in &v.props {
                if !self.items.contains_key(&prop.item) {
                    return Err(ContentError::UnknownRef { from: v.id.clone(), kind: "item", id: prop.item.clone() });
                }
            }
            for a in &v.animals {
                if !self.items.contains_key(&a.kind) {
                    return Err(ContentError::UnknownRef { from: v.id.clone(), kind: "item", id: a.kind.clone() });
                }
            }
            if let Some(site) = &v.inside {
                if !self.locations.values().any(|l| l.sites.iter().any(|s| &s.id == site)) {
                    return Err(ContentError::UnknownRef { from: v.id.clone(), kind: "site", id: site.clone() });
                }
                if self.locations.values().filter(|l| l.inside.as_ref() == Some(site)).count() > 1 {
                    return Err(ContentError::Invalid(format!("two rooms are inside the building of '{site}'")));
                }
            }
            if let Some(wall) = &v.wall {
                if self.styles.get(wall).map(|s| s.kind.as_str()) != Some("wall") {
                    return Err(ContentError::UnknownRef { from: v.id.clone(), kind: "wall style", id: wall.clone() });
                }
            }
            let on_map = |(x, y, z): (i32, i32, i32)| (0..=v.w * 100).contains(&x) && (0..=v.h * 100).contains(&y) && (0..2000).contains(&z);
            if v.wires.iter().any(|w| !on_map(w.a) || !on_map(w.b)) {
                return Err(ContentError::Invalid(format!("a wire in '{}' hangs off the map", v.id)));
            }
            if v.posts.iter().any(|&(x, y)| !inside(x, y)) {
                return Err(ContentError::Invalid(format!("a post in '{}' is outside the map", v.id)));
            }
            for exit in &v.exits {
                let to = self.locations.get(&exit.to).ok_or_else(|| ContentError::UnknownRef { from: v.id.clone(), kind: "location", id: exit.to.clone() })?;
                let (ax, ay) = exit.at;
                let lands = ax >= 0 && ay >= 0 && ax < to.w && ay < to.h;
                if exit.w < 1 || exit.h < 1 || !inside(exit.x, exit.y) || !inside(exit.x + exit.w - 1, exit.y + exit.h - 1) || ax < 0 || ay < 0 || !lands {
                    return Err(ContentError::Invalid(format!("a way out of '{}' leads off a map", v.id)));
                }
            }
        }
        for t in self.taxi.values() {
            let v = self.locations.get(&t.location).ok_or_else(|| ContentError::UnknownRef { from: t.id.clone(), kind: "location", id: t.location.clone() })?;
            if t.x < 0 || t.y < 0 || t.x >= v.w || t.y >= v.h {
                return Err(ContentError::Invalid(format!("taxi stand '{}' is off its map", t.id)));
            }
        }
        for theme in self.themes.values() {
            if theme.styles.is_empty() && theme.settings.is_empty() {
                return Err(ContentError::Invalid(format!("theme '{}' changes nothing", theme.id)));
            }
            for (kind, id) in &theme.styles {
                let style = self.styles.get(id).ok_or_else(|| ContentError::UnknownRef { from: theme.id.clone(), kind: "style", id: id.clone() })?;
                if &style.kind != kind {
                    return Err(ContentError::Invalid(format!("theme '{}' uses {} style '{}' as {kind}", theme.id, style.kind, id)));
                }
            }
        }
        for expansion in self.expansions.values() {
            if expansion.area < 1 {
                return Err(ContentError::Invalid(format!("expansion '{}' adds no area", expansion.id)));
            }
        }
        for (kind, id) in &self.start_styles {
            let style = self.styles.get(id).ok_or_else(|| ContentError::UnknownRef {
                from: "start_styles".into(),
                kind: "style",
                id: id.clone(),
            })?;
            if &style.kind != kind {
                return Err(ContentError::Invalid(format!("start style '{id}' is a {} style, not a {kind} style", style.kind)));
            }
        }
        Ok(())
    }

    /// The pocket, keys, stations, helps, locked places and interviews.
    /// Jobs happen at real places with real props; plants grow from carried seeds into carried food.
    /// Building sites, empty houses and wear stand in places that exist, the cart has stops.
    fn validate_growth(&self) -> Result<(), ContentError> {
        let Some(g) = &self.growth else { return Ok(()) };
        let bad = |m: String| Err(ContentError::Invalid(m));
        let mut ids = std::collections::BTreeSet::new();
        for s in &g.sites {
            if !ids.insert(format!("site:{}", s.id)) {
                return Err(ContentError::DuplicateId(s.id.clone()));
            }
            if !self.locations.contains_key(&s.location) {
                return bad(format!("building site {} is in no place", s.id));
            }
            if s.stages.iter().any(|d| *d == 0) || s.stall > 1000 {
                return bad(format!("building site {} has an empty stage", s.id));
            }
        }
        for a in &g.abandon {
            let site = self.locations.get(&a.location).and_then(|l| l.sites.iter().find(|x| x.id == a.id));
            if site.is_none() || a.mend > a.empty.0 {
                return bad(format!("empty house {} is not a home of {}", a.id, a.location));
            }
        }
        for w in &g.wear {
            if !self.locations.get(&w.location).is_some_and(|l| l.sites.iter().any(|x| x.id == w.id)) {
                return bad(format!("worn building {} is not in {}", w.id, w.location));
            }
            if w.kinds.iter().any(|k| !["crack", "window", "paint", "roof", "lamp"].contains(&k.as_str())) {
                return bad(format!("worn building {} has an unknown wear", w.id));
            }
        }
        if let Some(c) = &g.cart {
            if c.spots.is_empty() || c.hours.0 >= c.hours.1 || c.hours.1 > 24 || !self.locations.contains_key(&c.location) {
                return bad("the ice-cream cart has nowhere to go".into());
            }
        }
        Ok(())
    }

    fn validate_work_garden(&self) -> Result<(), ContentError> {
        let invalid = |m: String| Err(ContentError::Invalid(m));
        for w in self.work.values() {
            let Some(loc) = self.locations.get(&w.location) else { return invalid(format!("work '{}': no location '{}'", w.id, w.location)) };
            if !loc.props.iter().any(|p| p.item == w.prop) {
                return invalid(format!("work '{}': no '{}' stands in '{}'", w.id, w.prop, w.location));
            }
            if w.options.len() < 2 || w.steps == 0 || w.gap == 0 || w.hours.0 >= w.hours.1 || w.hours.1 > 24 {
                return invalid(format!("work '{}': needs options to choose from, tasks, a pace and hours", w.id));
            }
            if w.employer.as_ref().is_some_and(|e| !self.residents.contains_key(e) && !self.npcs.contains_key(e)) {
                return invalid(format!("work '{}': nobody called '{}'", w.id, w.employer.as_deref().unwrap_or("")));
            }
        }
        let carried = |id: &str| self.items.get(id).is_some_and(|d| d.carry);
        for p in self.plants.values() {
            if !carried(&p.seed) || !carried(&p.harvest.0) || p.harvest.1 == 0 {
                return invalid(format!("plant '{}': a carried seed must turn into carried food", p.id));
            }
            if p.stages.is_empty() || p.stages[0] != 0 || p.stages.windows(2).any(|w| w[0] >= w[1]) || p.models.len() != p.stages.len() {
                return invalid(format!("plant '{}': stages start at 0, grow, and each has a model", p.id));
            }
            if p.models.iter().chain(std::iter::once(&p.dead_model)).any(|m| !self.items.contains_key(m)) {
                return invalid(format!("plant '{}': a model is not an item", p.id));
            }
            if p.thirst == 0 || p.die <= p.thirst || (p.tree && p.fruit_every == 0) {
                return invalid(format!("plant '{}': thirst before death, and a tree fruits again after some days", p.id));
            }
            if self.plants.values().filter(|q| q.seed == p.seed).count() > 1 {
                return invalid(format!("seed '{}' grows into more than one plant", p.seed));
            }
        }
        for p in self.pieces.values() {
            if p.sheet.as_ref().is_some_and(|s| !self.items.contains_key(s)) || p.level > 3 || p.name.is_empty() {
                return invalid(format!("piece '{}': a name, a level up to 3, and sheet music that is an item", p.id));
            }
        }
        Ok(())
    }

    fn validate_economy(&self) -> Result<(), ContentError> {
        let invalid = |m: String| Err(ContentError::Invalid(m));
        for item in self.items.values() {
            if item.key && (!item.hidden || item.carry || item.bag > 0) {
                return invalid(format!("key '{}' must be hidden, and neither carried nor a bag", item.id));
            }
        }
        let item = |from: &str, id: &str| -> Result<&ItemDef, ContentError> {
            self.items.get(id).ok_or_else(|| ContentError::UnknownRef { from: from.to_string(), kind: "item", id: id.to_string() })
        };
        let wants = |from: &str, needs: &[(String, u32)]| -> Result<(), ContentError> {
            for (key, n) in needs {
                if *n == 0 {
                    return Err(ContentError::Invalid(format!("'{from}' wants none of '{key}'")));
                }
                if !key.starts_with('#') && item(from, key)?.key {
                    return Err(ContentError::Invalid(format!("'{from}' would take the key '{key}': keys never leave the keyring")));
                }
            }
            Ok(())
        };
        let requires = |from: &str, r: &crate::economy::Requires| -> Result<(), ContentError> {
            for i in &r.items {
                item(from, i)?;
            }
            for h in &r.helped {
                if !self.helps.contains_key(h) {
                    return Err(ContentError::UnknownRef { from: from.to_string(), kind: "help", id: h.clone() });
                }
            }
            for (npc, _) in &r.hearts {
                if !self.npcs.contains_key(npc) {
                    return Err(ContentError::UnknownRef { from: from.to_string(), kind: "npc", id: npc.clone() });
                }
            }
            for d in &r.days {
                if d != "rift" && !crate::sky::RIFT_WORLDS.contains(&d.as_str()) && !crate::holidays::ids().contains(&d.as_str()) {
                    return Err(ContentError::UnknownRef { from: from.to_string(), kind: "day", id: d.clone() });
                }
            }
            for h in &r.leased {
                if !self.homes.get(h).is_some_and(|x| x.rent > 0) {
                    return Err(ContentError::UnknownRef { from: from.to_string(), kind: "home to rent", id: h.clone() });
                }
            }
            Ok(())
        };
        let place = |from: &str, loc: &str| -> Result<(), ContentError> {
            if loc == "home" || self.locations.contains_key(loc) {
                Ok(())
            } else {
                Err(ContentError::UnknownRef { from: from.to_string(), kind: "location", id: loc.to_string() })
            }
        };
        for l in self.locations.values() {
            if let Some(r) = &l.requires {
                requires(&l.id, r)?;
            }
        }
        for st in self.stations.values() {
            place(&st.id, &st.location)?;
            item(&st.id, &st.prop)?;
            if st.location != "home" && !self.locations[&st.location].props.iter().any(|p| p.item == st.prop) {
                return invalid(format!("station '{}' stands at a '{}', and there is none in '{}'", st.id, st.prop, st.location));
            }
            wants(&st.id, &st.needs)?;
            for (id, n) in &st.gives {
                item(&st.id, id)?;
                if *n == 0 {
                    return invalid(format!("station '{}' gives none of '{id}'", st.id));
                }
            }
            if st.location == "home" && (st.earn > 0 || (!st.gives.is_empty() && st.needs.is_empty())) {
                return invalid(format!("station '{}' would pay at home: nothing done at home pays, nothing comes from nothing", st.id));
            }
            if st.earn > 0 && st.per_day == 0 {
                return invalid(format!("station '{}' pays with no daily limit", st.id));
            }
            if let Some((from, to)) = st.hours {
                if from >= to || to > 24 {
                    return invalid(format!("station '{}' has hours {from}..{to}", st.id));
                }
            }
            if let Some(r) = &st.requires {
                requires(&st.id, r)?;
            }
        }
        for h in self.helps.values() {
            if !self.npcs.contains_key(&h.giver) && !self.residents.contains_key(&h.giver) {
                return Err(ContentError::UnknownRef { from: h.id.clone(), kind: "person", id: h.giver.clone() });
            }
            place(&h.id, &h.location)?;
            wants(&h.id, &h.needs)?;
            for g in &h.gives {
                item(&h.id, g)?;
            }
            for a in &h.after {
                if !self.helps.contains_key(a) {
                    return Err(ContentError::UnknownRef { from: h.id.clone(), kind: "help", id: a.clone() });
                }
            }
            if let Some(r) = &h.requires {
                requires(&h.id, r)?;
            }
        }
        if let Some(id) = crate::economy::help_cycle(&self.helps) {
            return invalid(format!("help '{id}' waits for itself through its 'after' chain"));
        }
        for r in self.recipes.values() {
            wants(&r.id, &r.needs)?;
            if r.needs.is_empty() || r.gives.1 == 0 {
                return invalid(format!("recipe '{}' must take something and give something: nothing comes from nothing", r.id));
            }
            let dish = item(&r.id, &r.gives.0)?;
            if !dish.carry {
                return invalid(format!("recipe '{}' gives '{}', which is not carried", r.id, r.gives.0));
            }
        }
        if let Some(b) = &self.bills {
            place("bills", &b.office)?;
            if b.hours.0 >= b.hours.1 || b.hours.1 > 24 || b.due_day == 0 || b.due_day > 28 {
                return invalid("bills: bad hours or due day".to_string());
            }
            for u in &b.utilities {
                if !crate::home::UTILITIES.contains(&u.id.as_str()) {
                    return invalid(format!("bills: unknown utility '{}'", u.id));
                }
            }
        }
        if let Some(d) = &self.driving {
            for l in [&d.school, &d.sto, &d.police, &d.town] {
                place("driving", l)?;
            }
            for l in &d.coin_places {
                place("driving", l)?;
            }
            for s in [&d.school_site, &d.sto_site, &d.police_site] {
                if !self.sites.contains_key(s) {
                    return invalid(format!("driving: unknown site '{s}'"));
                }
            }
            for h in [d.school_hours, d.sto_hours] {
                if h.0 >= h.1 || h.1 > 24 {
                    return invalid("driving: bad hours".to_string());
                }
            }
            for item in [&d.licence_item, &d.keys_item, &d.can_item] {
                if !self.items.contains_key(item) {
                    return invalid(format!("driving: unknown item '{item}'"));
                }
            }
            for car in &d.cars {
                if !self.items.contains_key(&car.item) {
                    return invalid(format!("driving: car '{}' has no item '{}'", car.id, car.item));
                }
            }
            if d.lessons.is_empty() || d.questions.len() < d.theory_asked as usize || d.theory_pass > d.theory_asked || d.questions.iter().any(|q| q.right as usize >= q.answers.len()) {
                return invalid("driving: lessons or questions".to_string());
            }
        }
        if let Some(f) = &self.fashion {
            place("fashion", &f.shop)?;
            place("fashion", &f.salon)?;
            for l in &f.fitting {
                place("fashion", l)?;
            }
            for h in [f.shop_hours, f.salon_hours] {
                if h.0 >= h.1 || h.1 > 24 {
                    return invalid("fashion: bad hours".to_string());
                }
            }
        }
        for d in self.items.values() {
            if let Some(w) = &d.wear {
                let Some(keys) = crate::style::slot_keys(&w.slot) else {
                    return invalid(format!("garment '{}': unknown slot '{}'", d.id, w.slot));
                };
                if w.set.is_empty() || w.set.iter().any(|(k, _)| !keys.contains(&k.as_str())) {
                    return invalid(format!("garment '{}' sets keys outside its slot", d.id));
                }
                if !matches!(d.acquire, Unlock::Coins(_)) {
                    return invalid(format!("garment '{}' must have a price in coins", d.id));
                }
            }
        }
        if self.homes.values().filter(|h| h.start).count() > 1 {
            return invalid("homes: more than one first house".to_string());
        }
        for h in self.homes.values() {
            place(&h.id, &h.location)?;
            if !matches!(h.kind.as_str(), "house" | "flat" | "cottage" | "plot") {
                return invalid(format!("home '{}': unknown kind '{}'", h.id, h.kind));
            }
            if h.kind == "plot" && (h.start || h.price > 0) {
                return invalid(format!("home '{}': a plot is only rented", h.id));
            }
        }
        for (i, q) in self.interviews.iter().enumerate() {
            if q.q.is_empty() || q.answers.is_empty() {
                return invalid(format!("interview {i} has no question or no answers"));
            }
        }
        self.validate_quests()?;
        self.validate_crafts()?;
        self.validate_home_more()?;
        self.validate_town()
    }

    /// Rooms the builders build on: their things and finishes exist, they have a size; the animals eat real
    /// things and live where there is such a place.
    fn validate_home_more(&self) -> Result<(), ContentError> {
        let invalid = |m: String| Err(ContentError::Invalid(m));
        for b in self.builds.values() {
            if b.w < 2 || b.d < 2 || b.days == 0 {
                return invalid(format!("build '{}': no size or no days", b.id));
            }
            if let Some(i) = b.items.iter().find(|i| !self.items.contains_key(*i)) {
                return invalid(format!("build '{}': unknown item '{i}'", b.id));
            }
            if let Some(st) = b.floor.iter().chain(b.wall.iter()).find(|st| !self.styles.contains_key(*st)) {
                return invalid(format!("build '{}': unknown style '{st}'", b.id));
            }
        }
        for p in self.pets.values() {
            if let Some(f) = p.food.iter().find(|f| !f.starts_with('#') && !self.items.contains_key(*f)) {
                return invalid(format!("pet '{}': unknown food '{f}'", p.id));
            }
            if p.location.as_ref().is_some_and(|l| !self.locations.contains_key(l)) {
                return invalid(format!("pet '{}': unknown place", p.id));
            }
            if !matches!(p.source.as_str(), "shelter" | "fox" | "tech" | "egg") {
                return invalid(format!("pet '{}': unknown source '{}'", p.id, p.source));
            }
        }
        Ok(())
    }

    /// The town's projects and openings: places and materials exist, chains end, nothing is built at home.
    /// Ageing covers real things and keeps its order; what is made comes from carried things into real items.
    fn validate_crafts(&self) -> Result<(), ContentError> {
        let invalid = |m: String| Err(ContentError::Invalid(m));
        for w in self.wear.values() {
            if w.stages[0] == 0 || w.stages.windows(2).any(|p| p[0] >= p[1]) {
                return invalid(format!("wear '{}': it turns used, worn and broken in that order", w.id));
            }
            if let Some(i) = w.items.iter().find(|i| !self.items.contains_key(*i)) {
                return invalid(format!("wear '{}': no item '{i}'", w.id));
            }
            if w.looks.iter().any(String::is_empty) || w.broken.is_empty() {
                return invalid(format!("wear '{}': every age has its words", w.id));
            }
        }
        let tagged = |key: &str| match key.strip_prefix('#') {
            Some(tag) => self.items.values().any(|d| d.carry && d.tags.iter().any(|t| t == tag)),
            None => self.items.get(key).is_some_and(|d| d.carry),
        };
        for t in self.tools.values() {
            if !self.items.get(&t.item).is_some_and(|d| d.carry || d.bag > 0) || t.uses == 0 || t.gone.is_empty() {
                return invalid(format!("tool '{}': a thing one carries, that serves a while and says when it is gone", t.item));
            }
        }
        let is_tool = |t: &String| self.tools.contains_key(t);
        for w in self.wear.values() {
            if let Some(t) = w.tools.iter().find(|t| !is_tool(t)) {
                return invalid(format!("wear '{}': '{t}' is not a tool", w.id));
            }
            if w.kit.as_deref().is_some_and(|k| !tagged(k)) {
                return invalid(format!("wear '{}': its kit is not a carried thing", w.id));
            }
        }
        for c in self.crafts.values() {
            if let Some(t) = c.tools.iter().find(|t| !is_tool(t)) {
                return invalid(format!("craft '{}': '{t}' is not a tool", c.id));
            }
            if c.needs.is_empty() || c.needs.iter().any(|(k, n)| *n == 0 || !tagged(k)) {
                return invalid(format!("craft '{}': it is made of carried things", c.id));
            }
            if !self.items.contains_key(&c.gives.0) || c.gives.1 == 0 {
                return invalid(format!("craft '{}': it makes a real thing", c.id));
            }
            if let Some(i) = c.learn.iter().flat_map(|r| r.items.iter()).find(|i| !self.items.contains_key(*i)) {
                return invalid(format!("craft '{}': learned from an unknown '{i}'", c.id));
            }
            if let Some((n, _)) = c.learn.iter().flat_map(|r| r.hearts.iter()).find(|(n, _)| !self.npcs.contains_key(n)) {
                return invalid(format!("craft '{}': nobody called '{n}' teaches it", c.id));
            }
        }
        Ok(())
    }

    fn validate_town(&self) -> Result<(), ContentError> {
        let invalid = |m: String| ContentError::Invalid(m);
        for p in self.projects.values() {
            if !self.locations.contains_key(&p.location) {
                return Err(ContentError::UnknownRef { from: p.id.clone(), kind: "location", id: p.location.clone() });
            }
            for (item, n) in &p.items {
                if !self.items.get(item).is_some_and(|d| d.carry) || *n == 0 {
                    return Err(invalid(format!("project {} needs '{item}', which is not something one carries", p.id)));
                }
            }
            if p.stages.is_empty() || p.stages.iter().any(|s| s.days == 0) {
                return Err(invalid(format!("project {} has no stages or a stage of no days", p.id)));
            }
            if p.coins == 0 && p.items.is_empty() {
                return Err(invalid(format!("project {} needs nothing", p.id)));
            }
            // the town must be able to finish it alone (people need not wait on one player for ever)
            if p.coins > 0 && p.town_coins == 0 || !p.items.is_empty() && p.town_items_every == 0 {
                return Err(invalid(format!("project {} cannot be finished by the town alone", p.id)));
            }
            for a in &p.after {
                if !self.projects.contains_key(a) {
                    return Err(ContentError::UnknownRef { from: p.id.clone(), kind: "project", id: a.clone() });
                }
            }
        }
        // no project waits for itself
        for p in self.projects.values() {
            let mut seen = std::collections::BTreeSet::new();
            let mut todo = p.after.clone();
            while let Some(a) = todo.pop() {
                if a == p.id {
                    return Err(invalid(format!("project {} waits for itself", p.id)));
                }
                if seen.insert(a.clone()) {
                    todo.extend(self.projects[&a].after.iter().cloned());
                }
            }
        }
        for o in self.openings.values() {
            if let Some(a) = &o.after {
                if !self.projects.contains_key(a) {
                    return Err(ContentError::UnknownRef { from: o.id.clone(), kind: "project", id: a.clone() });
                }
            }
            if o.months.iter().any(|m| !(1..=12).contains(m)) {
                return Err(invalid(format!("opening {} has a month out of the year", o.id)));
            }
        }
        for r in self.residents.values() {
            if r.arrives.is_some() && r.job.as_ref().is_some_and(|(s, role)| self.residents.values().filter(|q| q.job.as_ref() == Some(&(s.clone(), role.clone()))).count() == 1) {
                return Err(invalid(format!("{} arrives later but is the only one doing their job", r.id)));
            }
        }
        Ok(())
    }

    /// Quests and jobs: every reference exists, every stage can be done somewhere, nothing pays at home.
    fn validate_quests(&self) -> Result<(), ContentError> {
        use crate::quests::{Reward, StageDef, StageDo};
        let invalid = |m: String| ContentError::Invalid(m);
        let unknown = |from: &str, kind: &'static str, id: &str| ContentError::UnknownRef { from: from.to_string(), kind, id: id.to_string() };
        let person = |id: &str| self.npcs.contains_key(id) || self.residents.contains_key(id);
        let place = |l: &str| l == "home" || self.locations.contains_key(l);
        let item_ok = |k: &str| k.starts_with('#') || self.items.contains_key(k);
        let reward = |from: &str, r: &Reward| -> Result<(), ContentError> {
            for i in &r.items {
                if !self.items.contains_key(i) {
                    return Err(unknown(from, "item", i));
                }
            }
            for rc in &r.recipes {
                if !self.recipes.contains_key(rc) {
                    return Err(unknown(from, "recipe", rc));
                }
            }
            for (who, _) in &r.hearts {
                if !person(who) {
                    return Err(unknown(from, "person", who));
                }
            }
            Ok(())
        };
        let stages = |from: &str, stages: &[StageDef], job: bool| -> Result<bool, ContentError> {
            if stages.is_empty() {
                return Err(invalid(format!("'{from}' has no stages")));
            }
            let mut away = false;
            for (i, s) in stages.iter().enumerate() {
                let loc_ok = |l: &str| place(l) || (job && l == "{place}");
                match &s.act {
                    StageDo::Go { location, hours } => {
                        if !loc_ok(location) {
                            return Err(unknown(from, "location", location));
                        }
                        if let Some((a, b)) = hours {
                            if a >= b || *b > 24 {
                                return Err(invalid(format!("'{from}' stage {i} has hours {a}..{b}")));
                            }
                        }
                        away |= location != "home";
                    }
                    StageDo::Bring { location, items } => {
                        if !loc_ok(location) {
                            return Err(unknown(from, "location", location));
                        }
                        for (k, n) in items {
                            if *n == 0 || !item_ok(k) {
                                return Err(invalid(format!("'{from}' stage {i} wants '{k}' ×{n}")));
                            }
                        }
                        away |= location != "home";
                    }
                    StageDo::Use { station } => {
                        let Some(st) = self.stations.get(station) else { return Err(unknown(from, "station", station)) };
                        away |= st.location != "home";
                    }
                    StageDo::Cook { recipe } => {
                        if !self.recipes.contains_key(recipe) {
                            return Err(unknown(from, "recipe", recipe));
                        }
                    }
                    StageDo::Gather { location, item } => {
                        if !loc_ok(location) {
                            return Err(unknown(from, "location", location));
                        }
                        if let Some(it) = item {
                            if !self.items.contains_key(it) {
                                return Err(unknown(from, "item", it));
                            }
                        }
                        away = true;
                    }
                    StageDo::Wait { .. } => {}
                    StageDo::Choose { location, options } => {
                        if let Some(l) = location {
                            if !loc_ok(l) {
                                return Err(unknown(from, "location", l));
                            }
                            away |= l != "home";
                        }
                        if options.is_empty() {
                            return Err(invalid(format!("'{from}' stage {i} offers no choice")));
                        }
                        for o in options {
                            reward(from, &o.reward)?;
                            if o.reward.coins > 0 && location.as_deref().is_none_or(|l| l == "home") {
                                return Err(invalid(format!("'{from}' would pay at home")));
                            }
                            if o.goto.is_some_and(|g| g as usize > stages.len()) {
                                return Err(invalid(format!("'{from}' stage {i} goes to a stage that is not there")));
                            }
                        }
                    }
                }
                if let Some(w) = &s.who {
                    if !person(w) && !(job && w.starts_with('{')) {
                        return Err(unknown(from, "person", w));
                    }
                }
                for (g, n) in &s.gives {
                    if *n == 0 || !self.items.contains_key(g) {
                        return Err(unknown(from, "item", g));
                    }
                }
            }
            Ok(away)
        };
        let holidays = crate::holidays::ids();
        for q in self.quests.values() {
            if q.giver != "board" && !person(&q.giver) {
                return Err(unknown(&q.id, "person", &q.giver));
            }
            if !place(&q.offer) {
                return Err(unknown(&q.id, "location", &q.offer));
            }
            let away = stages(&q.id, &q.stages, false)?;
            reward(&q.id, &q.reward)?;
            if q.reward.coins > 0 && !away {
                return Err(invalid(format!("quest '{}' would pay for staying at home: coins come from the town", q.id)));
            }
            for a in &q.after {
                if !self.quests.contains_key(a) {
                    return Err(unknown(&q.id, "quest", a));
                }
            }
            for (g, _) in &q.start_gives {
                if !self.items.contains_key(g) {
                    return Err(unknown(&q.id, "item", g));
                }
            }
            if let Some(w) = &q.when {
                match (&w.holiday, w.from) {
                    (Some(h), _) if !holidays.contains(&h.as_str()) => return Err(unknown(&q.id, "holiday", h)),
                    (None, None) => return Err(invalid(format!("calendar quest '{}' has neither dates nor a holiday", q.id))),
                    _ => {}
                }
            }
        }
        for j in self.jobs.values() {
            match &j.giver {
                Some(g) if !person(g) => return Err(unknown(&j.id, "person", g)),
                None if j.giver_job.is_empty() => return Err(invalid(format!("job '{}' has no giver", j.id))),
                _ => {}
            }
            if !place(&j.location) {
                return Err(unknown(&j.id, "location", &j.location));
            }
            for p in &j.places {
                if !place(p) {
                    return Err(unknown(&j.id, "location", p));
                }
            }
            let away = stages(&j.id, &j.stages, true)?;
            let mut r = j.reward.clone();
            r.hearts.retain(|h| h.0 != "{giver}");
            reward(&j.id, &r)?;
            if j.reward.coins > 0 && !away {
                return Err(invalid(format!("job '{}' would pay for staying at home", j.id)));
            }
            if !matches!(j.on.as_str(), "" | "workday" | "day_off") {
                return Err(invalid(format!("job '{}' is on '{}'", j.id, j.on)));
            }
        }
        for st in self.stations.values() {
            if let Some(d) = &st.days {
                if !matches!(d.as_str(), "daily" | "weekdays" | "weekends" | "full_moon") && !holidays.contains(&d.as_str()) {
                    return Err(invalid(format!("station '{}' keeps unknown days '{d}'", st.id)));
                }
            }
        }
        Ok(())
    }
}
