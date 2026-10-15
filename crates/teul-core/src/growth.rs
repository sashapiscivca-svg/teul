//! The town grows and wears over real days: new houses go up on the outskirts stage by stage (a fence and a pit,
//! the foundation, the walls in scaffolding, the roof, people moving in), some building sites stall for a year or
//! more and stand as bare frames, an old house is left empty and later mended, and the buildings that stand get
//! a crack, a broken window, peeling paint or a leaking roof that the town's workers come to mend. In the warm
//! months on warm days an ice-cream cart rolls between the park, the pier and the square.
//!
//! Everything is a pure function of the world's seed, its first day, the content and the real calendar: the same
//! on every device, never stored. Builders rest in the depth of winter (December to February), on Sundays and on
//! the great holidays, so a house takes months, not days. The map's props show it through the town's flags
//! (`grow:<site>:<stage>`, `abandon:<home>`, `wear:<building>:<kind>`, `fix:<building>`…).

use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};

use crate::daily::{weather_at, Sky};
use crate::holidays;
use crate::npc::stream_of;
use crate::rng::{chance_permille, rand_below, Domain};
use crate::time::{civil_from_days, Season, WorldTime, MINUTES_PER_DAY};

/// Building sites, empty houses, wear and mending, the cart.
pub const GROWTH: Domain = Domain(131);

/// The stages of a building site, in order.
pub const STAGES: [&str; 5] = ["pit", "foundation", "walls", "roof", "built"];

/// Days after the roof is done that the moving van stands at the door.
pub const MOVING_DAYS: i64 = 3;

// ---- content ----------------------------------------------------------------------------------------------

/// A plot on the outskirts where something will be built.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GrowSiteDef {
    pub id: String,
    pub name: String,
    pub location: String,
    /// The earliest day of the world's life work may begin, and the most days it may be put off.
    pub start: u32,
    #[serde(default)]
    pub jitter: u32,
    /// Working days of the pit, the foundation, the walls and the roof.
    pub stages: [u32; 4],
    /// Per-mille chance the money runs out at the walls and the site stands for a year or more.
    #[serde(default)]
    pub stall: u32,
    /// "house" (or empty), or what kind of place opens in it ("donuts", "shop"…).
    #[serde(default)]
    pub kind: String,
    /// What the paper says when it is done.
    #[serde(default)]
    pub done: String,
    /// Where its builders work (a cell by the plot).
    pub x: i32,
    pub y: i32,
}

impl GrowSiteDef {
    /// Something that opens to everyone once built, not a family's home.
    pub fn is_shop(&self) -> bool {
        !self.kind.is_empty() && self.kind != "house"
    }
}

/// An old house that may be left empty and, years later, mended for new people.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AbandonDef {
    /// The home's site id.
    pub id: String,
    pub name: String,
    pub location: String,
    /// The earliest day of the world's life it may be left, and the most days later.
    pub from: u32,
    #[serde(default)]
    pub jitter: u32,
    /// Days it stands empty: at least, and at most this many more.
    pub empty: (u32, u32),
    /// The last days of it are mending (scaffolding, workers).
    pub mend: u32,
    /// Why it was left, and what is said when it is lived in again.
    pub why: String,
    pub back: String,
    pub x: i32,
    pub y: i32,
}

/// A building that wears: what may go wrong with it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct WearDef {
    /// The building's site id.
    pub id: String,
    pub name: String,
    pub location: String,
    /// crack, window, paint, roof, lamp
    pub kinds: Vec<String>,
    /// Where the workers stand while they mend it.
    pub x: i32,
    pub y: i32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CartSpot {
    pub name: String,
    pub x: i32,
    pub y: i32,
}

/// The ice-cream cart: the months it comes out, its hours, the stops it rolls between (three hours at each).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CartDef {
    pub location: String,
    pub months: Vec<u32>,
    pub hours: (u32, u32),
    pub spots: Vec<CartSpot>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GrowthDef {
    #[serde(default)]
    pub sites: Vec<GrowSiteDef>,
    #[serde(default)]
    pub abandon: Vec<AbandonDef>,
    #[serde(default)]
    pub wear: Vec<WearDef>,
    #[serde(default)]
    pub cart: Option<CartDef>,
}

// ---- the calendar of work ---------------------------------------------------------------------------------

/// Whether builders work on a date: not in December, January or February, not on Sundays or the great holidays.
pub fn working_day(date: i64) -> bool {
    let (_, m, _) = civil_from_days(date);
    if matches!(m, 12 | 1 | 2) {
        return false;
    }
    let info = holidays::day_info(date);
    !(info.weekday == holidays::Weekday::Sun || info.holiday.is_some_and(|h| h.day_off))
}

/// The life of a building site up to some date: when each stage was reached, and the stall if it stalled.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
pub struct SiteLife {
    /// The date each stage (STAGES) was reached; empty before work began.
    pub reached: Vec<i64>,
    /// The days it stood still: (from, until), until excluded.
    pub stalled: Option<(i64, i64)>,
}

impl SiteLife {
    /// The stage at a date (index into STAGES), if work has begun.
    pub fn stage_at(&self, date: i64) -> Option<usize> {
        self.reached.iter().rposition(|d| *d <= date)
    }

    pub fn stalled_at(&self, date: i64) -> bool {
        self.stalled.is_some_and(|(a, b)| date >= a && date < b)
    }

    pub fn built(&self) -> Option<i64> {
        self.reached.get(4).copied()
    }
}

/// The day work begins on a site.
pub fn site_begins(seed: u64, first_day: i64, def: &GrowSiteDef) -> i64 {
    first_day + i64::from(def.start) + rand_below(seed, GROWTH, stream_of(&def.id), 0, u64::from(def.jitter) + 1) as i64
}

/// How a building site went, from its first day up to `until`.
pub fn site_life(seed: u64, first_day: i64, def: &GrowSiteDef, until: i64) -> SiteLife {
    let s = stream_of(&def.id);
    let begin = site_begins(seed, first_day, def);
    let mut life = SiteLife::default();
    if until < begin {
        return life;
    }
    life.reached.push(begin);
    let stalls = chance_permille(seed, GROWTH, s, 1, u64::from(def.stall));
    let stall_after = 3 + rand_below(seed, GROWTH, s, 2, 8) as u32;
    let stall_len = 240 + rand_below(seed, GROWTH, s, 3, 300) as i64;
    let mut need: Vec<u32> = Vec::new();
    let mut sum = 0;
    for d in def.stages {
        sum += d.max(1);
        need.push(sum);
    }
    let mut work = 0u32;
    let mut walls_work = 0u32;
    let mut date = begin;
    while date < until && life.reached.len() < STAGES.len() {
        if life.stalled_at(date) {
            date += 1;
            continue;
        }
        if working_day(date) {
            work += 1;
            if life.reached.len() == 3 {
                walls_work += 1;
                if stalls && life.stalled.is_none() && walls_work == stall_after {
                    life.stalled = Some((date + 1, date + 1 + stall_len));
                }
            }
            // a stage is reached the day after the work that finished the one before
            while life.reached.len() < STAGES.len() && work >= need[life.reached.len() - 1] {
                life.reached.push(date + 1);
            }
        }
        date += 1;
    }
    life.reached.retain(|d| *d <= until);
    life
}

/// When an old house is left and when it is lived in again (excluded).
pub fn abandon_span(seed: u64, first_day: i64, def: &AbandonDef) -> (i64, i64) {
    let s = stream_of(&def.id) ^ 0xabad;
    let left = first_day + i64::from(def.from) + rand_below(seed, GROWTH, s, 0, u64::from(def.jitter) + 1) as i64;
    let back = left + i64::from(def.empty.0) + rand_below(seed, GROWTH, s, 1, u64::from(def.empty.1) + 1) as i64;
    (left, back)
}

/// A spell of wear on a building: what broke, when, and the days it is mended (the last of the spell).
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Wear {
    pub kind: String,
    pub from: i64,
    pub fix_from: i64,
    pub until: i64,
}

/// The wear a building has around a date (the spell of its cycle), if anything is broken that day.
pub fn wear_at(seed: u64, first_day: i64, def: &WearDef, date: i64) -> Option<Wear> {
    if def.kinds.is_empty() {
        return None;
    }
    let s = stream_of(&def.id) ^ 0x3ea7;
    let period = 150 + rand_below(seed, GROWTH, s, 10, 120) as i64;
    let phase = rand_below(seed, GROWTH, s, 11, period as u64) as i64;
    let t = date - first_day + phase;
    let k = t.div_euclid(period);
    let start = first_day - phase + k * period;
    let ku = k.rem_euclid(1 << 40) as u64;
    let kind = def.kinds[rand_below(seed, GROWTH, s, 100 + ku * 4, def.kinds.len() as u64) as usize].clone();
    let t0 = 10 + rand_below(seed, GROWTH, s, 101 + ku * 4, (period - 80) as u64) as i64;
    let wait = 10 + rand_below(seed, GROWTH, s, 102 + ku * 4, 35) as i64;
    let fix = 2 + rand_below(seed, GROWTH, s, 103 + ku * 4, 3) as i64;
    let w = Wear { kind, from: start + t0, fix_from: start + t0 + wait, until: start + t0 + wait + fix };
    (date >= w.from && date < w.until).then_some(w)
}

/// Whether a day is warm and dry enough for the ice-cream cart (no rain, storm or snow in its hours).
pub fn cart_day(seed: u64, first_day: i64, cart: &CartDef, day: u64) -> bool {
    let date = first_day + day as i64;
    let (_, m, _) = civil_from_days(date);
    if !cart.months.contains(&m) {
        return false;
    }
    let season = match m {
        3..=5 => Season::Spring,
        6..=8 => Season::Summer,
        9..=11 => Season::Autumn,
        _ => Season::Winter,
    };
    (cart.hours.0..cart.hours.1).all(|h| {
        let t = WorldTime(day * MINUTES_PER_DAY + u64::from(h) * 60);
        !matches!(weather_at(seed, t, season), Sky::Rain | Sky::Storm | Sky::Snow)
    })
}

/// The growth flags of a day (see the module's docs).
pub fn growth_flags(growth: &GrowthDef, seed: u64, first_day: i64, day: u64) -> BTreeSet<String> {
    let date = first_day + day as i64;
    let mut out = BTreeSet::new();
    for s in &growth.sites {
        let life = site_life(seed, first_day, s, date);
        let Some(stage) = life.stage_at(date) else { continue };
        if life.stalled_at(date) {
            out.insert(format!("grow:{}:stalled", s.id));
            continue;
        }
        out.insert(format!("grow:{}:{}", s.id, STAGES[stage]));
        if stage == 4 {
            if date - life.built().unwrap_or(date) < MOVING_DAYS {
                out.insert(format!("grow:{}:moving", s.id));
            }
        } else if working_day(date) {
            out.insert(format!("grow:{}:work", s.id));
        }
    }
    for a in &growth.abandon {
        let (left, back) = abandon_span(seed, first_day, a);
        if date >= left && date < back {
            out.insert(format!("abandon:{}", a.id));
            if date >= back - i64::from(a.mend) {
                out.insert(format!("mend:{}", a.id));
            }
        }
    }
    for w in &growth.wear {
        if let Some(x) = wear_at(seed, first_day, w, date) {
            out.insert(format!("wear:{}:{}", w.id, x.kind));
            if x.kind != "lamp" {
                out.insert(format!("worn:{}", w.id));
            }
            if date >= x.fix_from {
                out.insert(format!("fix:{}", w.id));
            }
        }
    }
    if let Some(c) = &growth.cart {
        if cart_day(seed, first_day, c, day) {
            out.insert("icecream".to_string());
        }
    }
    out
}

// ---- what the paper may tell ------------------------------------------------------------------------------

/// Something that changed in the town's buildings, told.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct GrowthNews {
    /// The world day it happened.
    pub day: i64,
    /// begun, roof, built, opened, stalled, resumed, left, mending, back, broke, mended
    pub kind: String,
    pub id: String,
    pub text: String,
}

fn site_text(s: &GrowSiteDef, kind: &str, l: crate::content::Lang) -> String {
    let shop = s.is_shop();
    if l.en() {
        return match kind {
            "begun" => format!("Building has started on the edge of town: {}. A fence went up and an excavator arrived — they're digging the foundations.", s.name),
            "walls" => format!("{}: the foundation is poured and the walls are rising. The builders say it'll have a roof by autumn.", s.name),
            "roof" => format!("{}: the rafters are up over the walls and the roof is going on.", s.name),
            "built" if !s.done.is_empty() => s.done.clone(),
            "built" if shop => format!("Now open: {}! Come and be among the first.", s.name),
            "built" => format!("{} is finished. A van full of furniture pulled up: new neighbours are moving in.", s.name),
            "stalled" => format!("{}: building has stopped — they say the developer ran out of money. Just a bare frame standing there.", s.name),
            "resumed" => format!("{}: the workers are back at the unfinished building. Construction has started again!", s.name),
            _ => String::new(),
        };
    }
    match kind {
        "begun" => format!("На околиці почали будувати: {}. Поставили паркан, приїхав екскаватор — копають котлован.", s.name),
        "walls" => format!("{}: фундамент залито, ростуть стіни. Будівельники кажуть — до осені під дахом.", s.name),
        "roof" => format!("{}: над стінами вже крокви, кладуть дах.", s.name),
        "built" if shop && !s.done.is_empty() => s.done.clone(),
        "built" if shop => format!("Відкрилося: {}! Приходьте першими.", s.name),
        "built" if !s.done.is_empty() => s.done.clone(),
        "built" => format!("{} — добудовано. Під'їхала вантажівка з меблями: нові сусіди заселяються.", s.name),
        "stalled" => format!("{}: будівництво зупинилося — кажуть, у забудовника скінчилися гроші. Стоїть голий каркас.", s.name),
        "resumed" => format!("{}: на недобудову знову приїхали робітники. Будівництво відновили!", s.name),
        _ => String::new(),
    }
}

/// What changed in the buildings between two dates (both included), oldest first.
pub fn growth_news(growth: &GrowthDef, seed: u64, first_day: i64, from: i64, to: i64, l: crate::content::Lang) -> Vec<GrowthNews> {
    let mut out = Vec::new();
    let mut push = |date: i64, kind: &str, id: &str, text: String| {
        if date >= from && date <= to && date >= first_day && !text.is_empty() {
            out.push(GrowthNews { day: date - first_day, kind: kind.to_string(), id: id.to_string(), text });
        }
    };
    for s in &growth.sites {
        let life = site_life(seed, first_day, s, to);
        for (i, d) in life.reached.iter().enumerate() {
            let kind = match i {
                0 => "begun",
                2 => "walls",
                3 => "roof",
                4 => "built",
                _ => continue,
            };
            push(*d, if i == 4 && s.is_shop() { "opened" } else { kind }, &s.id, site_text(s, kind, l));
        }
        if let Some((a, b)) = life.stalled {
            push(a, "stalled", &s.id, site_text(s, "stalled", l));
            push(b, "resumed", &s.id, site_text(s, "resumed", l));
        }
    }
    for a in &growth.abandon {
        let (left, back) = abandon_span(seed, first_day, a);
        if l.en() {
            push(left, "left", &a.id, format!("{} stands empty: {}", a.name, a.why));
            push(back - i64::from(a.mend), "mending", &a.id, format!("{}: the new owners have started on repairs — scaffolding, fresh paint, new windows.", a.name));
        } else {
            push(left, "left", &a.id, format!("{} стоїть порожній: {}", a.name, a.why));
            push(back - i64::from(a.mend), "mending", &a.id, format!("{}: нові власники взялися до ремонту — риштування, свіжа фарба, нові вікна.", a.name));
        }
        push(back, "back", &a.id, format!("{}: {}", a.name, a.back));
    }
    for w in &growth.wear {
        // the spells that touch the window
        let mut d = from;
        while d <= to {
            if let Some(x) = wear_at(seed, first_day, w, d) {
                let what = match x.kind.as_str() {
                    "crack" => l.pick("по стіні пішла тріщина", "a crack has run up the wall"),
                    "window" => l.pick("вибили шибку", "a window pane got smashed"),
                    "paint" => l.pick("облущилася фарба", "the paint is peeling"),
                    "roof" => l.pick("протікає дах", "the roof is leaking"),
                    "lamp" => l.pick("згас ліхтар біля входу", "the lamp by the door has gone out"),
                    _ => l.pick("щось зламалося", "something has broken"),
                };
                if l.en() {
                    push(x.from, "broke", &w.id, format!("{}: {}. They promise to fix it.", w.name, what));
                    push(x.until, "mended", &w.id, format!("{}: the repairmen have fixed it — good as new.", w.name));
                } else {
                    push(x.from, "broke", &w.id, format!("{}: {}. Обіцяють полагодити.", w.name, what));
                    push(x.until, "mended", &w.id, format!("{}: майстри полагодили — як нове.", w.name));
                }
                d = x.until + 1;
            } else {
                d += 1;
            }
        }
    }
    out.sort_by(|a, b| a.day.cmp(&b.day).then(a.id.cmp(&b.id)));
    out
}

// ---- in the core ----------------------------------------------------------------------------------------

use crate::core::Core;
use crate::storage::Storage;

/// A building site as it stands.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct SiteView {
    pub id: String,
    pub name: String,
    pub location: String,
    /// soon, pit, foundation, walls, roof, built, stalled
    pub stage: String,
    pub x: i32,
    pub y: i32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct GrowthView {
    pub sites: Vec<SiteView>,
    /// What changed in the last thirty days, oldest first.
    pub news: Vec<GrowthNews>,
    /// The ice-cream cart is out today.
    pub cart: bool,
}

impl<S: Storage> Core<S> {
    fn growth_def(&self) -> Option<&GrowthDef> {
        self.content().growth.as_ref()
    }

    /// The growth flags of the day of `now` (they join the town's flags).
    pub fn growth_flags(&self, now: WorldTime) -> BTreeSet<String> {
        self.growth_def().map(|g| growth_flags(g, self.meta().seed, self.calendar().first_day, now.day())).unwrap_or_default()
    }

    /// What changed in the town's buildings between two times, told (for the paper).
    pub fn growth_news(&self, from: WorldTime, to: WorldTime) -> Vec<GrowthNews> {
        let cal = self.calendar();
        self.growth_def().map(|g| growth_news(g, self.meta().seed, cal.first_day, cal.date(from), cal.date(to), self.lang())).unwrap_or_default()
    }

    pub fn growth_view(&self, now: WorldTime) -> GrowthView {
        let Some(g) = self.growth_def() else { return GrowthView { sites: Vec::new(), news: Vec::new(), cart: false } };
        let seed = self.meta().seed;
        let first = self.calendar().first_day;
        let date = self.calendar().date(now);
        let sites = g
            .sites
            .iter()
            .map(|s| {
                let life = site_life(seed, first, s, date);
                let stage = match life.stage_at(date) {
                    None => "soon",
                    Some(_) if life.stalled_at(date) => "stalled",
                    Some(i) => STAGES[i],
                };
                SiteView { id: s.id.clone(), name: s.name.clone(), location: s.location.clone(), stage: stage.to_string(), x: s.x, y: s.y }
            })
            .collect();
        let news = self.growth_news(WorldTime(now.0.saturating_sub(30 * MINUTES_PER_DAY)), now);
        let cart = g.cart.as_ref().is_some_and(|c| cart_day(seed, first, c, now.day()));
        GrowthView { sites, news, cart }
    }
}
