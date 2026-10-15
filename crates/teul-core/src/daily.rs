//! The daily rhythm: things to gather and fish, the album of everything found, villagers' requests, letters,
//! the village paper and personal stories. What a day offers is a pure function of the world seed and the day;
//! what the player did is recorded as events.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::content::Content;
use crate::rng::{rand_below, Domain};
use crate::time::{Season, WorldTime};

pub const GATHER: Domain = Domain(41);
pub const FISH: Domain = Domain(42);
pub const REQUESTS: Domain = Domain(43);
pub const PAPER: Domain = Domain(44);
pub const NOTES: Domain = Domain(45);
pub const SPOT_TODAY: Domain = Domain(47);

/// Catches a day, people asking for something a day, and what a done request brings.
pub const CATCHES_PER_DAY: u32 = 12;
pub const REQUESTS_PER_DAY: usize = 3;
pub const REQUEST_POINTS: u32 = 60;
pub const PAPER_LINES: usize = 3;

/// One thing a spot or a water can give, with its weight and when.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GiveDef {
    pub item: String,
    #[serde(default = "one")]
    pub weight: u32,
    /// Seasons it can be found in; empty means all year.
    #[serde(default)]
    pub seasons: Vec<Season>,
    /// Parts of the day (`morning`, `day`, `evening`, `night`); empty means any time.
    #[serde(default)]
    pub when: Vec<String>,
}

fn one() -> u32 {
    1
}

/// A place to gather from once a day (by a berry bush, under an apple tree...).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SpotDef {
    pub id: String,
    pub x: i32,
    pub y: i32,
    pub gives: Vec<GiveDef>,
    /// How likely (in percent) there is something here on a given day; a bin holds something only now and then.
    #[serde(default = "always", skip_serializing_if = "is_always")]
    pub chance: u32,
}

fn always() -> u32 {
    100
}

fn is_always(n: &u32) -> bool {
    *n >= 100
}

/// Whether a spot has anything today (most have every day; some only now and then).
pub fn spot_has_today(seed: u64, spot: &SpotDef, day: u64) -> bool {
    spot.chance >= 100 || rand_below(seed, SPOT_TODAY, stream_of(&spot.id), day, 100) < u64::from(spot.chance)
}

/// A stretch of shore or a pier to fish from.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FishingDef {
    pub id: String,
    pub name: String,
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
    pub fish: Vec<GiveDef>,
}

/// A set of things to find; finding them all brings a reward once.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CollectionDef {
    pub id: String,
    pub name: String,
    pub items: Vec<String>,
    pub reward: String,
}

/// Something a villager may ask for: items by id or by tag (`#fish`), how many, and what it brings.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AskDef {
    pub text: String,
    pub items: Vec<(String, u32)>,
    #[serde(default)]
    pub coins: u32,
    #[serde(default)]
    pub gift: Option<String>,
    /// What they say when it is brought.
    #[serde(default)]
    pub thanks: String,
}

/// A letter someone writes once the friendship reaches its hearts, maybe with something inside.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LetterDef {
    pub hearts: u32,
    pub text: String,
    #[serde(default)]
    pub gift: Option<String>,
}

/// A chapter of someone's own story.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ChapterDef {
    pub title: String,
    pub hearts: u32,
    /// World days after the previous chapter before this one can happen.
    #[serde(default)]
    pub after_days: u64,
    pub lines: Vec<String>,
    /// Something they need for it (brought when the chapter is played).
    #[serde(default)]
    pub ask: Option<AskDef>,
    #[serde(default)]
    pub gift: Option<String>,
}

pub fn part_of_day(minute_of_day: u64) -> &'static str {
    match minute_of_day {
        300..=659 => "morning",
        660..=1019 => "day",
        1020..=1319 => "evening",
        _ => "night",
    }
}

fn fits(g: &GiveDef, time: WorldTime, season: Season) -> bool {
    (g.seasons.is_empty() || g.seasons.contains(&season)) && (g.when.is_empty() || g.when.iter().any(|w| w == part_of_day(time.minute_of_day())))
}

/// A weighted pick among the things that can be found now.
pub fn pick(seed: u64, domain: Domain, id: u64, tick: u64, gives: &[GiveDef], time: WorldTime, season: Season) -> Option<String> {
    let now: Vec<&GiveDef> = gives.iter().filter(|g| fits(g, time, season)).collect();
    let total: u64 = now.iter().map(|g| u64::from(g.weight)).sum();
    if total == 0 {
        return None;
    }
    let mut r = rand_below(seed, domain, id, tick, total);
    for g in now {
        if r < u64::from(g.weight) {
            return Some(g.item.clone());
        }
        r -= u64::from(g.weight);
    }
    None
}

/// A stable number for a string id (FNV-1a folded to 32 bits).
pub fn stream_of(id: &str) -> u64 {
    crate::npc::stream_of(id)
}

/// Everything that can be found (gathered or fished) in a season.
pub fn findable(content: &Content, season: Season) -> std::collections::BTreeSet<String> {
    let gives = content.spots.values().flat_map(|s| s.gives.iter()).chain(content.fishing.values().flat_map(|f| f.fish.iter()));
    gives.filter(|g| g.seasons.is_empty() || g.seasons.contains(&season)).map(|g| g.item.clone()).collect()
}

/// Whether an ask can be answered with things found this season.
fn possible(content: &Content, ask: &AskDef, found: &std::collections::BTreeSet<String>) -> bool {
    ask.items.iter().all(|(key, _)| found.iter().any(|i| answers(content, i, key)))
}

/// Who asks for what today: a few villagers, each with one of their asks that can be answered this season.
pub fn requests_of(seed: u64, content: &Content, now: WorldTime, season: Season) -> Vec<(String, usize)> {
    let day = now.day();
    let found = findable(content, season);
    let can: BTreeMap<&String, Vec<usize>> = content
        .npcs
        .iter()
        .map(|(id, d)| (id, (0..d.asks.len()).filter(|i| possible(content, &d.asks[*i], &found)).collect::<Vec<_>>()))
        .filter(|(_, v)| !v.is_empty())
        .collect();
    let askers: Vec<&String> = can.keys().copied().collect();
    let mut out: Vec<(String, usize)> = Vec::new();
    let mut tries = 0;
    while out.len() < REQUESTS_PER_DAY.min(askers.len()) && tries < 64 {
        let who = askers[rand_below(seed, REQUESTS, tries, day, askers.len() as u64) as usize];
        tries += 1;
        if out.iter().any(|(n, _)| n == who) {
            continue;
        }
        let asks = &can[who];
        out.push((who.clone(), asks[rand_below(seed, REQUESTS, 1000 + stream_of(who), day, asks.len() as u64) as usize]));
    }
    out
}

/// Whether an item answers a wanted key: its id, or `#tag` (tags only, so a boot is no fish).
pub fn answers(content: &Content, item: &str, key: &str) -> bool {
    match key.strip_prefix('#') {
        Some(tag) => content.items.get(item).is_some_and(|d| d.tags.iter().any(|t| t == tag)),
        None => item == key,
    }
}

/// Which free items (by id) would be taken for an ask, or `None` when there are not enough. Only things found in
/// the world are taken (never bought ones); for a tag, the most plentiful common things go first, rare ones last.
pub fn take_for(content: &Content, free: &BTreeMap<String, u32>, items: &[(String, u32)]) -> Option<Vec<String>> {
    let mut left: BTreeMap<String, u32> = free.iter().filter(|(id, _)| content.items.get(*id).is_some_and(|d| d.hidden)).map(|(k, v)| (k.clone(), *v)).collect();
    let rare = |id: &str| content.items.get(id).is_some_and(|d| d.tags.iter().any(|t| t == "rare"));
    let mut out = Vec::new();
    for (key, n) in items {
        for _ in 0..*n {
            let found = left
                .iter()
                .filter(|(id, c)| **c > 0 && answers(content, id, key))
                .min_by(|a, b| rare(a.0).cmp(&rare(b.0)).then(b.1.cmp(a.1)).then(a.0.cmp(b.0)))
                .map(|(id, _)| id.clone())?;
            if let Some(c) = left.get_mut(&found) {
                *c -= 1;
            }
            out.push(found);
        }
    }
    Some(out)
}

/// Lines of the village paper for a day: templates with people's names filled in.
pub fn paper_of(seed: u64, content: &Content, day: u64) -> Vec<String> {
    let names: Vec<&String> = content.npcs.values().map(|d| &d.name).collect();
    if content.paper.is_empty() || names.is_empty() {
        return Vec::new();
    }
    let mut out = Vec::new();
    let mut used = Vec::new();
    for i in 0..(PAPER_LINES as u64 * 4) {
        if out.len() >= PAPER_LINES {
            break;
        }
        let t = rand_below(seed, PAPER, i, day, content.paper.len() as u64) as usize;
        if used.contains(&t) {
            continue;
        }
        used.push(t);
        let a = rand_below(seed, PAPER, 100 + i, day, names.len() as u64) as usize;
        // someone else for {b}, when there is anyone else
        let mut b = rand_below(seed, PAPER, 200 + i, day, (names.len() as u64 - 1).max(1)) as usize;
        if names.len() > 1 && b >= a {
            b += 1;
        }
        let b = b.min(names.len() - 1);
        out.push(content.paper[t].replace("{a}", names[a]).replace("{b}", names[b]));
    }
    out
}

/// A short note from someone in the morning mail (who, and which of their small-talk lines).
pub fn note_of(seed: u64, content: &Content, day: u64) -> Option<(String, String)> {
    let people: Vec<(&String, &crate::npc::NpcDef)> = content.npcs.iter().filter(|(_, d)| !d.chatter.is_empty()).collect();
    if people.is_empty() {
        return None;
    }
    let (id, def) = people[rand_below(seed, NOTES, 0, day, people.len() as u64) as usize];
    let line = &def.chatter[rand_below(seed, NOTES, 1, day, def.chatter.len() as u64) as usize];
    Some((id.clone(), line.clone()))
}

// ---- weather ------------------------------------------------------------------------------------------------

pub const WEATHER: Domain = Domain(46);

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Sky {
    Clear,
    Cloudy,
    Rain,
    Storm,
    Snow,
    Fog,
}

/// The weather of the whole world at a time: each day has a character drawn from its season, and within the day
/// a spell of rain, snow or fog comes for some hours. The same for everyone everywhere.
pub fn weather_at(seed: u64, time: WorldTime, season: Season) -> Sky {
    let day = time.day();
    let hour = time.minute_of_day() / 60;
    // what kind of day: weights of clear, cloudy, rain, storm, snow, fog per season
    let weights: [u64; 6] = match season {
        Season::Spring => [40, 25, 25, 4, 0, 6],
        Season::Summer => [55, 18, 12, 10, 0, 5],
        Season::Autumn => [25, 28, 25, 4, 3, 15],
        Season::Winter => [25, 25, 0, 0, 40, 10],
    };
    let total: u64 = weights.iter().sum();
    let mut r = rand_below(seed, WEATHER, 0, day, total);
    let mut kind = 0;
    for (i, w) in weights.iter().enumerate() {
        if r < *w {
            kind = i;
            break;
        }
        r -= w;
    }
    let sky = [Sky::Clear, Sky::Cloudy, Sky::Rain, Sky::Storm, Sky::Snow, Sky::Fog][kind];
    // the spell: a few hours of it, the rest of the day only cloudy (fog keeps to the morning)
    let start = rand_below(seed, WEATHER, 1, day, 18);
    let length = 3 + rand_below(seed, WEATHER, 2, day, 7);
    match sky {
        Sky::Clear | Sky::Cloudy => sky,
        Sky::Fog if hour < 10 => Sky::Fog,
        Sky::Fog => Sky::Cloudy,
        _ if hour >= start && hour < start + length => sky,
        _ => Sky::Cloudy,
    }
}
