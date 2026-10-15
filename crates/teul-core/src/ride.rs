//! The taxi's price, the way the ride-hailing apps price it: a little to get in, so much for every tile of the
//! road and every minute of the ride, a pickup charge when the car has far to come from its stand, and all of it
//! raised when many want a car and few cars are out (the rush hours, the night, a feast, the cinema letting out,
//! the races, the rain, the snow, the frost) or lowered a touch on a quiet clear day. Integer math only: the
//! quote the shell shows is exactly what the core charges for the same minute.

use std::collections::BTreeMap;

use crate::content::{Content, Lang};
use crate::core::TaxiDest;
use crate::daily::Sky;

/// The road between two maps (the way out of one to the way into the next), in tiles.
pub const ROAD_BETWEEN: u32 = 24;
/// Where the cars wait: the stand on the square.
pub const STAND: &str = "taxi.square";

/// What makes a car scarce or easy to get at a minute (everything the price depends on besides the route).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Demand {
    pub sky: Sky,
    /// The air out of doors, tenths of a degree.
    pub air: i32,
    /// Minute of the (local) day.
    pub minute: u32,
    /// A weekend or a day-off holiday (no rush hours then).
    pub day_off: bool,
    /// The town's feast being held today (its name).
    pub festival: Option<String>,
    /// A holiday of the calendar today (its name).
    pub holiday: Option<String>,
}

/// A ride's price and how soon the car comes.
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
pub struct TaxiQuote {
    /// Coins for the whole ride.
    pub fare: u32,
    /// Minutes until the car is there.
    pub eta: u32,
    /// Minutes of the ride itself.
    pub minutes: u32,
    /// Tiles of road from the pickup to the drop.
    pub tiles: u32,
    /// Why the price is what it is now, in the world's words (empty for an ordinary price).
    pub why: String,
    /// 1: dearer than usual, -1: cheaper, 0: usual.
    pub trend: i8,
}

/// The shortest way by road from a cell of one map to a cell of another (through the ways out between maps), in
/// tiles. Within a map it is the distance along a grid of streets (across plus along); between maps each road
/// counts `ROAD_BETWEEN` (a door into a building counts nothing). None when there is no way at all.
pub fn road_tiles(content: &Content, from: (&str, i32, i32), to: (&str, i32, i32)) -> Option<u32> {
    if from.0 == to.0 {
        return Some(manhattan((from.1, from.2), (to.1, to.2)));
    }
    // Dijkstra over points: (location, x, y); a few dozen maps, a handful of ways out each
    let mut best: BTreeMap<(String, i32, i32), u32> = BTreeMap::new();
    let mut open: Vec<(u32, String, i32, i32)> = vec![(0, from.0.to_string(), from.1, from.2)];
    best.insert((from.0.to_string(), from.1, from.2), 0);
    let mut found: Option<u32> = None;
    while let Some(i) = (0..open.len()).min_by_key(|&i| (open[i].0, open[i].1.clone(), open[i].2, open[i].3)) {
        let (d, loc, x, y) = open.swap_remove(i);
        if best.get(&(loc.clone(), x, y)).is_some_and(|b| *b < d) {
            continue;
        }
        if found.is_some_and(|f| d >= f) {
            break;
        }
        if loc == to.0 {
            let t = d + manhattan((x, y), (to.1, to.2));
            found = Some(found.map_or(t, |f| f.min(t)));
            continue;
        }
        let Some(def) = content.locations.get(&loc) else { continue };
        for e in &def.exits {
            let door = (e.x + e.w / 2, e.y + e.h / 2);
            let inside = def.inside.is_some() || content.locations.get(&e.to).is_some_and(|l| l.inside.is_some());
            let nd = d + manhattan((x, y), door) + if inside { 0 } else { ROAD_BETWEEN };
            let key = (e.to.clone(), e.at.0, e.at.1);
            if best.get(&key).is_none_or(|b| nd < *b) {
                best.insert(key, nd);
                open.push((nd, e.to.clone(), e.at.0, e.at.1));
            }
        }
    }
    found
}

fn manhattan(a: (i32, i32), b: (i32, i32)) -> u32 {
    a.0.abs_diff(b.0) + a.1.abs_diff(b.1)
}

/// What raises (or lowers) the price now, each with how much (percent) and why, the biggest first.
fn surges(demand: &Demand, from: &str, to: &TaxiDest, near_cinema: bool, l: Lang) -> Vec<(i32, String)> {
    let mut out: Vec<(i32, String)> = Vec::new();
    let say = |uk: &str, en: &str| l.pick(uk, en).to_string();
    match demand.sky {
        Sky::Storm => out.push((60, say("Гроза — таксисти їдуть обережно, машин обмаль, ціна вища", "A storm — drivers take it slow and cars are scarce, so prices are higher"))),
        Sky::Snow => out.push((40, say("Сніг — машин мало, ціна вища", "Snow — few cars about, so prices are higher"))),
        Sky::Rain => out.push((30, say("Дощ — машин мало, ціна вища", "Rain — few cars about, so prices are higher"))),
        Sky::Fog => out.push((10, say("Туман — машини їдуть повільно", "Fog — the cars are going slowly"))),
        _ => {}
    }
    if demand.air <= -80 {
        out.push((20, say("Мороз — не кожна машина заводиться, ціна вища", "A hard frost — not every car will start, so prices are higher")));
    }
    let hour = demand.minute / 60;
    if hour >= 23 || hour < 5 {
        out.push((40, say("Ніч — на лінії одна-дві машини, ціна вища", "Night — only a car or two on the road, so prices are higher")));
    } else if !demand.day_off && (7..9).contains(&hour) {
        out.push((30, say("Година пік — усі їдуть на роботу, ціна вища", "Rush hour — everyone’s heading to work, so prices are higher")));
    } else if !demand.day_off && (17..19).contains(&hour) {
        out.push((30, say("Година пік — усі їдуть додому, ціна вища", "Rush hour — everyone’s heading home, so prices are higher")));
    }
    if let Some(name) = &demand.festival {
        out.push((35, if l.en() { format!("{name} — everyone’s heading into town, so prices are higher") } else { format!("{name} — усі їдуть у місто, ціна вища") }));
    } else if let Some(name) = &demand.holiday {
        out.push((20, if l.en() { format!("{name} — lots of people want a ride, so prices are higher") } else { format!("{name} — багато охочих їхати, ціна вища") }));
    }
    // the races run from nine till eight, every half hour; the cinema's evening shows let out from six till eleven
    if (from == "hippodrome" || to.location == "hippodrome") && (9..20).contains(&hour) {
        out.push((25, say("Перегони на іподромі — до таксі черга, ціна вища", "Races at the racecourse — there’s a queue for taxis, so prices are higher")));
    }
    if near_cinema && (18..23).contains(&hour) {
        out.push((20, say("Сеанс у «Зорі» закінчується — всі роз'їжджаються, ціна вища", "A show at the Zoria is letting out — everyone’s heading off, so prices are higher")));
    }
    out.sort_by(|a, b| b.0.cmp(&a.0));
    out
}

/// The price of a ride now from a cell to a stop, and how soon the car comes. None when no road leads there.
pub fn quote(content: &Content, demand: &Demand, from: (&str, i32, i32), to: &TaxiDest) -> Option<TaxiQuote> {
    let tiles = road_tiles(content, from, (&to.location, to.x, to.y))?;
    // the car comes from its stand on the square: far out (the outskirts, the forest, the fields) costs a pickup
    let stand = content.taxi.get(STAND).map(|s| (s.location.as_str(), s.x, s.y));
    let pickup = stand.and_then(|s| road_tiles(content, s, from)).unwrap_or(0);
    let pickup_fee = pickup.saturating_sub(40) / 12;
    let minutes = 2 + tiles / 25;
    let base = 4 + tiles / 10 + minutes + pickup_fee;
    // the cinema: someone picked up or dropped by its door in the evening
    let cinema = content.locations.get("village").and_then(|v| v.landmark("cinema")).map(|l| (l.x + l.w / 2, l.y + l.h / 2));
    let by = |loc: &str, x: i32, y: i32| loc == "village" && cinema.is_some_and(|c| manhattan(c, (x, y)) <= 14);
    let near_cinema = by(from.0, from.1, from.2) || by(&to.location, to.x, to.y);
    let l = content.lang;
    let ups = surges(demand, from.0, to, near_cinema, l);
    let mut pct: i32 = 100 + ups.iter().map(|u| u.0).sum::<i32>();
    let mut why = ups.first().map(|u| u.1.clone()).unwrap_or_default();
    let hour = demand.minute / 60;
    if ups.is_empty() && demand.sky == Sky::Clear && (10..16).contains(&hour) {
        pct = 90;
        why = l.pick("Ясний день — машин вистачає, ціна нижча", "A clear day — plenty of cars, so prices are lower").to_string();
    }
    let pct = pct.clamp(85, 220) as u32;
    if why.is_empty() && pickup_fee >= 3 {
        why = l.pick("Далеко від стоянки — водію довше їхати до тебе", "Far from the taxi stand — the driver has further to come for you").to_string();
    }
    let fare = ((base * pct + 50) / 100).max(5);
    let eta = (2 + pickup / 30 + pct.saturating_sub(100) / 20).clamp(1, 25);
    let trend = if pct > 100 { 1 } else if pct < 100 { -1 } else { 0 };
    Some(TaxiQuote { fare, eta, minutes, tiles, why, trend })
}

impl<S: crate::storage::Storage> crate::core::Core<S> {
    /// What makes a car scarce or easy to get at `now`.
    pub fn taxi_demand(&self, now: crate::time::WorldTime) -> Demand {
        let date = self.calendar().date(now);
        let info = crate::holidays::day_info(date).in_lang(self.content().lang);
        let festival = self.festival_view(now).filter(|f| f.phase == crate::festival::Phase::Day).map(|f| f.name.to_string());
        Demand {
            sky: self.weather(now),
            air: self.air_now(now),
            minute: now.minute_of_day() as u32,
            day_off: info.day_off,
            festival,
            holiday: info.holiday.filter(|h| h.day_off || h.festive).map(|h| h.name.to_string()),
        }
    }

    /// The price of a ride from a cell to a stop at `now`, and how soon the car comes.
    pub fn taxi_quote(&self, now: crate::time::WorldTime, from: (&str, i32, i32), to: &TaxiDest) -> Option<TaxiQuote> {
        quote(self.content(), &self.taxi_demand(now), from, to)
    }
}
