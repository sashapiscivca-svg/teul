//! Cold and warmth: the air of the day (a climate like central Ukraine's, by the real date, with spells of
//! warmer and colder days), the ice on the lakes (it grows through a run of frosty days and melts in a thaw;
//! rivers keep flowing), and how warm the hero feels — from the air, the clothes, being indoors (and whether the
//! gas is on at home), a fire or a stove nearby, something hot eaten or drunk lately, getting wet.
//!
//! None of this is shown as a number: the client turns `feel` into frost at the screen's edges, breath in the
//! air, a shiver, or a golden glow by the stove. Integer arithmetic only (tenths of a degree), the same
//! everywhere.

use serde::Serialize;

use crate::daily::Sky;
use crate::rng::{rand_below, Domain};
use crate::time::{civil_from_days, days_from_civil};

pub const CLIMATE: Domain = Domain(121);

/// The mean air of the middle of each month, tenths of a degree (Jan..Dec).
const MONTH_MEAN: [i32; 12] = [-45, -35, 15, 95, 155, 190, 210, 200, 145, 85, 25, -20];

/// The climate's mean for a date (interpolated between the middles of the months).
fn climate(date: i64) -> i32 {
    let (y, m, d) = civil_from_days(date);
    let mid = |y: i64, m: u32| days_from_civil(y, m, 15);
    let (a, b) = if d >= 15 {
        let (ny, nm) = if m == 12 { (y + 1, 1) } else { (y, m + 1) };
        ((mid(y, m), MONTH_MEAN[m as usize - 1]), (mid(ny, nm), MONTH_MEAN[nm as usize - 1]))
    } else {
        let (py, pm) = if m == 1 { (y - 1, 12) } else { (y, m - 1) };
        ((mid(py, pm), MONTH_MEAN[pm as usize - 1]), (mid(y, m), MONTH_MEAN[m as usize - 1]))
    };
    let span = (b.0 - a.0).max(1);
    a.1 + ((b.1 - a.1) as i64 * (date - a.0) / span) as i32
}

/// Spells: every five days the weather leans warmer or colder, and the days between slide from one to the next.
fn spell(seed: u64, block: i64, winter: bool) -> i32 {
    let range = if winter { 161 } else { 121 };
    rand_below(seed, CLIMATE, 0, block.rem_euclid(1 << 40) as u64, range) as i32 - range as i32 / 2
}

/// The mean air of a day (tenths of a degree): the climate and the spell it falls in.
pub fn day_mean(seed: u64, date: i64) -> i32 {
    let (_, m, _) = civil_from_days(date);
    let winter = matches!(m, 11 | 12 | 1 | 2 | 3);
    let block = date.div_euclid(5);
    let k = date.rem_euclid(5) as i32;
    let a = spell(seed, block, winter);
    let b = spell(seed, block + 1, winter);
    climate(date) + a + (b - a) * k / 5
}

/// The air at a minute of a day: coldest before dawn, warmest mid-afternoon; clouds keep the day and night
/// closer; rain and storms cool it; snow falls only at a frost or near it.
pub fn air(seed: u64, date: i64, minute: u32, sky: Sky) -> i32 {
    let mean = day_mean(seed, date);
    let amp = match sky {
        Sky::Clear => 45,
        Sky::Cloudy | Sky::Snow => 25,
        Sky::Fog => 20,
        Sky::Rain | Sky::Storm => 15,
    };
    // a triangle: the low at 05:00, the high at 15:00
    let m = minute as i32 % 1440;
    let lo = 300;
    let hi = 900;
    let t = if m >= lo && m < hi {
        -amp + 2 * amp * (m - lo) / (hi - lo)
    } else {
        let since = (m - hi).rem_euclid(1440);
        amp - 2 * amp * since / (1440 - (hi - lo))
    };
    let mut a = mean + t;
    match sky {
        Sky::Rain => a -= 15,
        Sky::Storm => a -= 30,
        Sky::Snow => a = a.min(10),
        _ => {}
    }
    a
}

/// How thick the ice of the still waters is on a date (tenths of degree-days of frost gathered since the autumn,
/// less what the thaws took): frosts build it slowly, warm days take it fast.
pub fn ice(seed: u64, date: i64) -> i32 {
    let (y, m, _) = civil_from_days(date);
    if (5..=10).contains(&m) {
        return 0;
    }
    let start = days_from_civil(if m >= 11 { y } else { y - 1 }, 11, 1);
    let mut ice = 0i32;
    for d in start..date {
        let t = day_mean(seed, d);
        ice = if t < 0 { ice - t } else { (ice - 3 * t).max(0) };
        ice = ice.min(1000);
    }
    ice
}

/// The lakes and ponds are frozen hard enough to walk on (the rivers never: they keep flowing).
pub const ICE_HOLDS: i32 = 250;

pub fn frozen(seed: u64, date: i64) -> bool {
    ice(seed, date) >= ICE_HOLDS
}

/// How warm a set of clothes is (from the hero's look keys).
pub fn clothes_warmth(get: impl Fn(&str) -> Option<String>) -> i32 {
    let n = |k: &str| get(k).and_then(|v| v.parse::<i32>().ok());
    let top = match n("look.top") {
        Some(0 | 3 | 15) => 0,
        Some(1 | 5 | 6) => 1,
        Some(4) => 2,
        Some(2 | 10 | 14) => 3,
        Some(7 | 8) => 4,
        Some(13) => 5,
        Some(9) => 7,
        Some(11) => 9,
        Some(12) => 10,
        Some(16) => -1,
        _ => 2,
    };
    let bottom = match n("look.bottom") {
        Some(0 | 3) => 2,
        Some(4) => 1,
        Some(5) => -1,
        Some(_) => 0,
        None => 2,
    };
    let shoes = match n("look.shoe") {
        Some(1) => 2,
        Some(2) => 0,
        Some(3) => 4,
        _ => 1,
    };
    let acc = match n("look.acc") {
        Some(2 | 8) => 2,
        Some(14) => 3,
        _ => 0,
    };
    let hands = match n("look.mitt") {
        Some(1 | 2) => 2,
        _ => 0,
    };
    top + bottom + shoes + acc + hands
}

/// Keeps the rain off: a raincoat, an umbrella.
pub fn keeps_dry(get: impl Fn(&str) -> Option<String>) -> bool {
    get("look.top").as_deref() == Some("10") || get("look.acc").as_deref() == Some("12")
}

/// Keeps the sun off the head: a straw hat, a panama, a cap, an umbrella.
pub fn shades(get: impl Fn(&str) -> Option<String>) -> bool {
    matches!(get("look.acc").as_deref(), Some("3" | "4" | "12" | "13"))
}

/// Where the hero is, as far as warmth goes.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Shelter {
    Outdoors,
    /// At home: warm while the gas is on (heating), the air of the street leaking in when it is off.
    Home { heated: bool },
    /// A shop, the school, a café: always heated.
    Indoors,
    /// A cave: the same cool all year.
    Underground,
    /// The Other Side: a mild night that never changes.
    Dream,
}

/// What the client knows that the core does not: the hero's place among things.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Near {
    /// A stove, a fireplace, a bonfire within a few steps.
    pub heat: bool,
    /// Minutes since the hero came out of the water (None: not lately).
    pub swum_ago: Option<u32>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct ComfortView {
    /// The air here, tenths of a degree (never shown as a number).
    pub air: i32,
    /// The air out of doors (what the town dresses for).
    pub out: i32,
    /// -3 freezing .. 0 fine .. +3 too hot.
    pub feel: i8,
    /// Wet through: rain without a raincoat or an umbrella, or just out of the water.
    pub wet: bool,
    /// Cold enough out of doors to see one's breath.
    pub breath: bool,
    /// By a stove or a fire.
    pub hearth: bool,
    /// Strong sun on the head (summer, clear, midday, out of doors, no hat).
    pub sun: bool,
    /// The still waters of the world are frozen today.
    pub ice: bool,
}

pub struct ComfortIn {
    pub air_out: i32,
    pub sky: Sky,
    pub minute: u32,
    pub month: u32,
    pub shelter: Shelter,
    pub clothes: i32,
    pub dry_kept: bool,
    pub shaded: bool,
    /// Minutes since something hot was eaten or drunk (None: not today).
    pub hot_ago: Option<u64>,
    pub near: Near,
    pub ice: bool,
}

/// How warm the hero feels.
pub fn comfort(c: &ComfortIn) -> ComfortView {
    let outdoors = c.shelter == Shelter::Outdoors;
    let air = match c.shelter {
        Shelter::Outdoors => c.air_out,
        Shelter::Home { heated: true } | Shelter::Indoors => 200 + (c.air_out - 260).max(0) / 2,
        // unheated: the street's air comes in, tempered by the walls (and never warmer than a cool room)
        Shelter::Home { heated: false } => (c.air_out + 60).min(if c.air_out > 160 { c.air_out } else { 120 }),
        Shelter::Underground => 90,
        Shelter::Dream => 170,
    };
    // indoors one opens the coat: the clothes count only so far
    let clothes = if outdoors { c.clothes } else { c.clothes.min(2) };
    let mut felt = air + clothes * 12;
    let rain = matches!(c.sky, Sky::Rain | Sky::Storm);
    // out of the water one dries in a few minutes in the open air, sooner under a roof or by a fire
    let dries_in = if outdoors && !c.near.heat { 10 } else { 3 };
    let wet = (outdoors && rain && !c.dry_kept) || c.near.swum_ago.is_some_and(|m| m < dries_in);
    if wet {
        felt -= 60;
    }
    if outdoors && c.sky == Sky::Storm {
        felt -= 30;
    }
    let daytime = (600..1080).contains(&c.minute);
    let sun = outdoors && c.sky == Sky::Clear && daytime && (6..=8).contains(&c.month) && !c.shaded;
    if sun {
        felt += 30;
    }
    if c.near.heat {
        felt += 180;
    }
    if let Some(m) = c.hot_ago.filter(|m| *m < 60) {
        felt += 60 * (60 - m as i32) / 60;
    }
    let feel = match felt {
        i32::MIN..=-1 => -3,
        0..=79 => -2,
        80..=149 => -1,
        150..=274 => 0,
        275..=314 => 1,
        315..=354 => 2,
        _ => 3,
    };
    ComfortView { air, out: c.air_out, feel, wet, breath: outdoors && air < 50, hearth: c.near.heat, sun, ice: c.ice }
}

impl<S: crate::storage::Storage> crate::core::Core<S> {
    /// The still waters are frozen on the day of `now`.
    pub fn ice_holds(&self, now: crate::time::WorldTime) -> bool {
        frozen(self.meta_seed(), self.calendar().date(now))
    }

    /// The air out of doors now, tenths of a degree.
    pub fn air_now(&self, now: crate::time::WorldTime) -> i32 {
        air(self.meta_seed(), self.calendar().date(now), (now.minute_of_day()) as u32, self.weather(now))
    }

    /// How warm the hero feels where they are now.
    pub fn comfort_view(&self, now: crate::time::WorldTime, near: Near) -> ComfortView {
        let loc = self.location();
        let def = self.content().locations.get(loc);
        let shelter = if loc == "home" {
            Shelter::Home { heated: self.utility_on(now, "gas") }
        } else if loc == "otherside" {
            Shelter::Dream
        } else if def.is_some_and(|d| d.underground) {
            Shelter::Underground
        } else if def.is_some_and(|d| d.inside.is_some() || d.invite_only) {
            Shelter::Indoors
        } else {
            Shelter::Outdoors
        };
        let settings = &self.state().room.settings;
        let get = |k: &str| settings.get(k).cloned();
        let (_, month, _) = self.calendar().ymd(now);
        comfort(&ComfortIn {
            air_out: self.air_now(now),
            sky: self.weather(now),
            minute: now.minute_of_day() as u32,
            month,
            shelter,
            clothes: clothes_warmth(get),
            dry_kept: keeps_dry(get),
            shaded: shades(get),
            hot_ago: self.state().warmed_at.filter(|m| *m <= now.0).map(|m| now.0 - m),
            near,
            ice: self.ice_holds(now),
        })
    }
}

/// Something hot to eat or drink (by its id: a coffee, a cocoa, tea, soup, borscht, varenyky...).
pub fn hot_thing(id: &str) -> bool {
    ["coffee", "cocoa", "tea", "soup", "borscht", "varenyky", "porridge", "uzvar", "mulled", "pancake", "syrnyk"].iter().any(|h| id.contains(h))
}
