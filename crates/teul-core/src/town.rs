//! The town as it goes on over real time: everyone's birthday and what they like, the years passing (children
//! growing up, the grown-up retiring), families coming and going, babies, the old passing away, the rare day (a
//! storm that cuts the power, a wedding, a visiting fair, a musician on the square, a lost tourist), community
//! projects the town pays for together and builds over days, shops that open by the season or after what was
//! built, and friendship that turns into invitations to dinner and friends dropping by.
//!
//! Everything here is a pure function of the world's seed, the content, the real calendar and (for friendship and
//! projects) the player's state: the same on every device and on replay. Nothing is stored that could be derived.

use std::collections::{BTreeMap, BTreeSet};

use serde::{Deserialize, Serialize};

use crate::content::Content;
use crate::holidays::{self, Weekday};
use crate::life::ResidentDef;
use crate::npc::stream_of;
use crate::rng::{rand_below, Domain};
use crate::time::{civil_from_days, days_from_civil, MINUTES_PER_DAY};

/// Birthdays and tastes.
pub const TOWN: Domain = Domain(71);
/// Ages, arrivals, departures, births, passings.
pub const TOWN_PEOPLE: Domain = Domain(72);
/// The rare days.
pub const TOWN_DAYS: Domain = Domain(73);
/// Invitations and visits.
pub const TOWN_FRIENDS: Domain = Domain(74);

/// Friendship points from which someone invites the player to dinner.
pub const INVITE_POINTS: u32 = 300;
/// Friendship points from which someone drops by the player's home now and then.
pub const VISIT_POINTS: u32 = 500;
/// Dinner: from 19:00 to 21:30.
pub const DINNER: (u32, u32) = (19 * 60, 21 * 60 + 30);
/// A friend's visit: from 18:00 to 19:30.
pub const VISIT: (u32, u32) = (18 * 60, 19 * 60 + 30);
/// Where contributions to the town's projects are taken.
pub const BOARD: &str = "townhall_in";

// ---- content ----------------------------------------------------------------------------------------------

/// A stage of building: a fence and a hole, the walls, the roof…
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ProjectStage {
    pub name: String,
    pub days: u32,
}

/// Something the town builds together: the money and materials it takes, what the town itself gives each day,
/// the stages of the building, what it opens (map props and stations carry its flags).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ProjectDef {
    pub id: String,
    pub name: String,
    pub text: String,
    /// The location whose map shows it.
    pub location: String,
    pub coins: u32,
    #[serde(default)]
    pub items: Vec<(String, u32)>,
    /// Coins the town puts in by itself every day the collection is open.
    #[serde(default)]
    pub town_coins: u32,
    /// The town brings one of each material every so many days (0: never).
    #[serde(default)]
    pub town_items_every: u32,
    pub stages: Vec<ProjectStage>,
    /// Days after the world began when the board first shows it.
    #[serde(default)]
    pub opens: u32,
    /// Projects that must be finished first.
    #[serde(default)]
    pub after: Vec<String>,
    /// What the paper says when it is finished.
    pub done: String,
}

/// A shop or a stall that opens: from some day of the world's life, in some months, or after a project.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct OpeningDef {
    pub id: String,
    pub name: String,
    pub text: String,
    #[serde(default)]
    pub from_day: u32,
    #[serde(default)]
    pub months: Vec<u32>,
    #[serde(default)]
    pub after: Option<String>,
}

// ---- birthdays and tastes --------------------------------------------------------------------------------------

/// Someone's birthday (month, day), the same every year (never 29 February).
pub fn birthday(seed: u64, id: &str) -> (u32, u32) {
    let doy = rand_below(seed, TOWN, stream_of(id), 0, 365) as i64;
    let (_, m, d) = civil_from_days(days_from_civil(2025, 1, 1) + doy);
    (m, d)
}

pub fn is_birthday(seed: u64, id: &str, date: i64) -> bool {
    let (_, m, d) = civil_from_days(date);
    birthday(seed, id) == (m, d)
}

/// What gifts there are: a kind of thing someone may love or not care for.
pub const KINDS: &[&str] = &["sweet", "flower", "book", "food", "drink", "fruit", "craft", "fish", "dish", "berry"];

/// Someone's tastes: two kinds they love and one they would rather not get.
pub fn tastes(seed: u64, id: &str) -> (&'static str, &'static str, &'static str) {
    let s = stream_of(id);
    let n = KINDS.len() as u64;
    let a = rand_below(seed, TOWN, s ^ 0x1111, 1, n) as usize;
    let b = (a + 1 + rand_below(seed, TOWN, s ^ 0x2222, 2, n - 1) as usize) % KINDS.len();
    let mut c = (a + 1 + rand_below(seed, TOWN, s ^ 0x3333, 3, n - 1) as usize) % KINDS.len();
    if c == b {
        c = (c + 1) % KINDS.len();
        if c == a {
            c = (c + 1) % KINDS.len();
        }
    }
    (KINDS[a], KINDS[b], KINDS[c])
}

/// How a resident takes a gift: +1 loved, 0, -1 not wanted.
pub fn taste_of(seed: u64, id: &str, tags: &[String], category: &str) -> i8 {
    let (a, b, c) = tastes(seed, id);
    let has = |k: &str| category == k || tags.iter().any(|t| t == k);
    if has(c) {
        -1
    } else if has(a) || has(b) {
        1
    } else {
        0
    }
}

// ---- the years ---------------------------------------------------------------------------------------------

/// Someone's age in years when the world began, within what the content says they are.
pub fn age_at_start(seed: u64, r: &ResidentDef) -> u32 {
    let s = stream_of(&r.id);
    let (from, span) = match r.age.as_str() {
        "child" => (4, 11),
        "elder" => (66, 20),
        _ if r.young => (20, 9),
        _ => (31, 30),
    };
    from + rand_below(seed, TOWN_PEOPLE, s, 1, span) as u32
}

/// What changed in someone's life on a day.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Change {
    pub date: i64,
    /// arrived, left, born, passed, retired, grown
    pub kind: &'static str,
    pub who: Vec<String>,
    /// A baby's name (for a birth).
    pub name: Option<String>,
    /// "f" or "m" (a baby, or the one the change is about).
    pub gender: String,
}

/// The town's people over the years: who came when, who left, who was born, who passed away.
#[derive(Clone, Debug, Default)]
pub struct Population {
    pub first_day: i64,
    pub changes: Vec<Change>,
    /// When each resident from the content arrives (absent before), and when someone is gone for good.
    arrive: BTreeMap<String, i64>,
    gone: BTreeMap<String, i64>,
    /// Parents of a baby: from when to when they push a pram.
    prams: BTreeMap<String, (i64, i64)>,
    /// Years computed so far.
    years: u32,
    /// Who the town cannot lose (see `rooted`).
    rooted: BTreeSet<String>,
}

/// Who the town cannot lose: givers of the content's requests and helps, people whose job nobody else does,
/// those who live where they work (the priest at the church).
pub fn rooted(content: &Content) -> BTreeSet<String> {
    let mut out: BTreeSet<String> = BTreeSet::new();
    out.extend(content.quests.values().map(|q| q.giver.clone()));
    out.extend(content.helps.values().map(|h| h.giver.clone()));
    out.extend(content.jobs.values().filter_map(|j| j.giver.clone()));
    let mut staff: BTreeMap<(&str, &str), u32> = BTreeMap::new();
    for r in content.residents.values() {
        if let Some((s, role)) = &r.job {
            *staff.entry((s.as_str(), role.as_str())).or_default() += 1;
        }
    }
    for r in content.residents.values() {
        let sole = r.job.as_ref().is_some_and(|(s, role)| staff.get(&(s.as_str(), role.as_str())).copied().unwrap_or(0) <= 1);
        let lives_at_work = content.sites.get(&r.home).is_some_and(|s| s.kind != "home");
        if sole || lives_at_work {
            out.insert(r.id.clone());
        }
    }
    out
}

const BABY_NAMES_F: &[&str] = &["Софійка", "Олеся", "Марічка", "Злата", "Даринка", "Ярина", "Христинка", "Мілана"];
const BABY_NAMES_M: &[&str] = &["Михайлик", "Богдан", "Тарасик", "Андрійко", "Остапчик", "Матвійко", "Назарчик", "Данилко"];
const BABY_NAMES_F_EN: &[&str] = &["Sofiika", "Olesia", "Marichka", "Zlata", "Darynka", "Yaryna", "Khrystynka", "Milana"];
const BABY_NAMES_M_EN: &[&str] = &["Mykhailyk", "Bohdan", "Tarasyk", "Andriiko", "Ostapchyk", "Matviiko", "Nazarchyk", "Danylko"];

impl Population {
    /// The people's years from the world's first day up to (and including) the year of `until`.
    pub fn compute(content: &Content, seed: u64, first_day: i64, until: i64) -> Population {
        let years = (((until - first_day).max(0)) / 365 + 1) as u32;
        let mut p = Population { first_day, ..Population::default() };
        let rooted = rooted(content);
        for r in content.residents.values() {
            if let Some(n) = r.arrives {
                let jitter = rand_below(seed, TOWN_PEOPLE, stream_of(&r.id) ^ 0x77, 2, 15) as i64;
                p.arrive.insert(r.id.clone(), first_day + i64::from(n) + jitter);
            }
        }
        for (id, date) in p.arrive.clone() {
            let r = &content.residents[&id];
            p.changes.push(Change { date, kind: "arrived", who: vec![id], name: None, gender: r.gender.clone() });
        }
        let present = |p: &Population, id: &str, date: i64| p.arrive.get(id).is_none_or(|a| *a <= date) && p.gone.get(id).is_none_or(|g| *g > date);
        for y in 0..years {
            let start = first_day + i64::from(y) * 365;
            let yy = u64::from(y);
            // a passing: one of the old, now and then
            if rand_below(seed, TOWN_PEOPLE, 101, yy, 100) < 45 {
                let date = start + 30 + rand_below(seed, TOWN_PEOPLE, 102, yy, 300) as i64;
                let olds: Vec<&ResidentDef> = content
                    .residents
                    .values()
                    .filter(|r| !rooted.contains(&r.id) && present(&p, &r.id, date) && age_at_start(seed, r) + y >= 66 && (r.age == "elder" || age_at_start(seed, r) + y >= 70))
                    .collect();
                if !olds.is_empty() {
                    let r = olds[rand_below(seed, TOWN_PEOPLE, 103, yy, olds.len() as u64) as usize];
                    p.gone.insert(r.id.clone(), date);
                    p.changes.push(Change { date, kind: "passed", who: vec![r.id.clone()], name: None, gender: r.gender.clone() });
                }
            }
            // a family moving away (not in the first three months)
            if rand_below(seed, TOWN_PEOPLE, 111, yy, 100) < 35 {
                let date = (start + 90 + rand_below(seed, TOWN_PEOPLE, 112, yy, 240) as i64).max(first_day + 90);
                let mut homes: BTreeMap<&str, Vec<&ResidentDef>> = BTreeMap::new();
                for r in content.residents.values() {
                    if present(&p, &r.id, date) {
                        homes.entry(r.home.as_str()).or_default().push(r);
                    }
                }
                let movable: Vec<&Vec<&ResidentDef>> = homes
                    .iter()
                    .filter(|(h, rs)| content.sites.get(**h).is_some_and(|s| s.kind == "home") && rs.iter().all(|r| !rooted.contains(&r.id) && r.arrives.is_none()))
                    .map(|(_, rs)| rs)
                    .collect();
                if !movable.is_empty() {
                    let rs = movable[rand_below(seed, TOWN_PEOPLE, 113, yy, movable.len() as u64) as usize];
                    for r in rs {
                        p.gone.insert(r.id.clone(), date);
                    }
                    p.changes.push(Change { date, kind: "left", who: rs.iter().map(|r| r.id.clone()).collect(), name: None, gender: rs[0].gender.clone() });
                }
            }
            // a baby: one couple a year, often
            if rand_below(seed, TOWN_PEOPLE, 121, yy, 100) < 60 {
                let date = (start + 60 + rand_below(seed, TOWN_PEOPLE, 122, yy, 280) as i64).max(first_day + 60);
                let couples: Vec<(&ResidentDef, &ResidentDef)> = content
                    .residents
                    .values()
                    .filter_map(|r| r.partner.as_ref().and_then(|q| content.residents.get(q)).map(|q| (r, q)))
                    .filter(|(a, b)| a.id < b.id && a.age == "adult" && b.age == "adult")
                    .filter(|(a, b)| age_at_start(seed, a) + y < 44 && age_at_start(seed, b) + y < 44)
                    .filter(|(a, b)| present(&p, &a.id, date) && present(&p, &b.id, date) && !p.prams.contains_key(&a.id))
                    .collect();
                if !couples.is_empty() {
                    let (a, b) = couples[rand_below(seed, TOWN_PEOPLE, 123, yy, couples.len() as u64) as usize];
                    let girl = rand_below(seed, TOWN_PEOPLE, 124, yy, 2) == 0;
                    let names: Vec<&str> = if !content.births.is_empty() {
                        content.births.iter().map(String::as_str).collect()
                    } else if girl {
                        content.lang.pick_list(BABY_NAMES_F, BABY_NAMES_F_EN)
                    } else {
                        content.lang.pick_list(BABY_NAMES_M, BABY_NAMES_M_EN)
                    };
                    let name = names[rand_below(seed, TOWN_PEOPLE, 125, yy, names.len() as u64) as usize].to_string();
                    for r in [a, b] {
                        p.prams.insert(r.id.clone(), (date, date + 2 * 365));
                    }
                    p.changes.push(Change { date, kind: "born", who: vec![a.id.clone(), b.id.clone()], name: Some(name), gender: if girl { "f" } else { "m" }.into() });
                }
            }
            // birthdays that change a life: grown up, retired
            for r in content.residents.values() {
                let age0 = age_at_start(seed, r);
                let (bm, bd) = birthday(seed, &r.id);
                for yr in [civil_from_days(start).0, civil_from_days(start).0 + 1] {
                    let when = days_from_civil(yr, bm, bd);
                    if when < start.max(first_day) || when >= start + 365 {
                        continue;
                    }
                    let age = age0 + birthdays_between(seed, &r.id, first_day, when);
                    if r.age == "child" && age == 18 {
                        p.changes.push(Change { date: when, kind: "grown", who: vec![r.id.clone()], name: None, gender: r.gender.clone() });
                    }
                    if r.age == "adult" && r.job.is_some() && age == 65 && !rooted.contains(&r.id) {
                        p.changes.push(Change { date: when, kind: "retired", who: vec![r.id.clone()], name: None, gender: r.gender.clone() });
                    }
                }
            }
        }
        p.changes.sort_by(|a, b| (a.date, a.kind, &a.who).cmp(&(b.date, b.kind, &b.who)));
        p.years = years;
        p.rooted = rooted;
        p
    }

    pub fn covers(&self, date: i64) -> bool {
        ((date - self.first_day).max(0) / 365) < i64::from(self.years)
    }

    pub fn present(&self, id: &str, date: i64) -> bool {
        self.arrive.get(id).is_none_or(|a| *a <= date) && self.gone.get(id).is_none_or(|g| *g > date)
    }

    /// The day someone passed away, if they did.
    pub fn passed_on(&self, date: i64) -> Option<&Change> {
        self.changes.iter().find(|c| c.kind == "passed" && c.date == date)
    }

    /// The town's residents on a date, as they are then: who is here, how old (child, adult, elder; young),
    /// working or retired, with a pram if a baby came.
    pub fn people(&self, content: &Content, seed: u64, date: i64) -> Vec<ResidentDef> {
        let mut out = Vec::new();
        for r in content.residents.values() {
            if !self.present(&r.id, date) {
                continue;
            }
            let mut r = r.clone();
            let passed = birthdays_between(seed, &r.id, self.first_day, date);
            let age = age_at_start(seed, &r) + passed;
            match r.age.as_str() {
                "child" if age >= 18 => {
                    r.age = "adult".into();
                    r.young = true;
                    r.school = None;
                }
                "adult" if age >= 65 => {
                    r.age = "elder".into();
                    r.young = false;
                    if !self.rooted.contains(&r.id) {
                        r.job = None;
                    }
                }
                "adult" if r.young && age >= 30 => r.young = false,
                _ => {}
            }
            if let Some(p) = &r.partner {
                if !self.present(p, date) {
                    r.partner = None;
                }
            }
            if self.prams.get(&r.id).is_some_and(|(a, b)| *a <= date && date < *b) {
                r.pram = true;
            }
            out.push(r);
        }
        out
    }
}

/// How many of someone's birthdays fall between two dates (both included).
pub fn birthdays_between(seed: u64, id: &str, from: i64, to: i64) -> u32 {
    if to < from {
        return 0;
    }
    let (bm, bd) = birthday(seed, id);
    let (y0, _, _) = civil_from_days(from);
    let (y1, _, _) = civil_from_days(to);
    (y0..=y1).filter(|y| (from..=to).contains(&days_from_civil(*y, bm, bd))).count() as u32
}

// ---- the rare days ----------------------------------------------------------------------------------------------

/// What makes a day different in town.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
pub struct DayTown {
    pub date: i64,
    /// Whose birthday it is (residents here and the story's people).
    pub birthdays: Vec<String>,
    /// A storm, from when to when (minutes of the day).
    pub storm: Option<(u32, u32)>,
    /// The storm takes the power out: street lamps dark, candles in the windows.
    pub outage: bool,
    /// A wedding (the couple).
    pub wedding: Option<(String, String)>,
    /// A visiting fair on the square.
    pub fair: bool,
    /// A wandering musician plays on the square in the evening.
    pub musician: bool,
    /// A lost tourist asks the way.
    pub tourist: bool,
    /// A funeral at the cemetery (who passed away two days before).
    pub funeral: Option<String>,
}

/// Saturday on or after a date.
fn saturday_from(date: i64) -> i64 {
    let mut d = date;
    while holidays::weekday(d) != Weekday::Sat {
        d += 1;
    }
    d
}

/// The day in town: birthdays among `people`, the storm (from the weather), the wedding, the fair, the musician,
/// the tourist, the funeral.
pub fn day_town(content: &Content, seed: u64, first_day: i64, date: i64, people: &[&ResidentDef], pop: &Population) -> DayTown {
    let mut out = DayTown { date, ..DayTown::default() };
    for r in people.iter().copied() {
        if is_birthday(seed, &r.id, date) {
            out.birthdays.push(r.id.clone());
        }
    }
    for id in content.npcs.keys() {
        if is_birthday(seed, id, date) {
            out.birthdays.push(id.clone());
        }
    }
    let (y, m, _) = civil_from_days(date);
    let wd = holidays::weekday(date);
    let dd = date as u64;
    // the storm: when the day's weather turns stormy
    if date >= first_day {
        let world_day = (date - first_day) as u64;
        let cal = crate::time::Calendar { first_day };
        let season = cal.season(crate::time::WorldTime(world_day * MINUTES_PER_DAY));
        let mut hours = Vec::new();
        for h in 0..24u64 {
            let t = crate::time::WorldTime(world_day * MINUTES_PER_DAY + h * 60 + 30);
            if matches!(crate::daily::weather_at(seed, t, season), crate::daily::Sky::Storm) {
                hours.push(h as u32);
            }
        }
        if let (Some(a), Some(b)) = (hours.first(), hours.last()) {
            out.storm = Some((a * 60, (b + 1) * 60));
            out.outage = rand_below(seed, TOWN_DAYS, 1, dd, 100) < 40;
        }
    }
    let calm = out.storm.is_none();
    // a wedding: two young couples a year marry on a summer Saturday
    if (5..=9).contains(&m) && wd == Weekday::Sat && calm {
        let mut couples: Vec<(&ResidentDef, &ResidentDef)> = people
            .iter()
            .copied()
            .filter_map(|r| r.partner.as_ref().and_then(|q| people.iter().copied().find(|x| &x.id == q)).map(|q| (r, q)))
            .filter(|(a, b)| a.id < b.id && a.young && b.young)
            .collect();
        couples.sort_by_key(|(a, _)| rand_below(seed, TOWN_DAYS, stream_of(&a.id), 7, 1 << 30));
        let year_index = (y - civil_from_days(first_day).0).max(0) as usize;
        for k in 0..2usize {
            if let Some((a, b)) = couples.get(year_index * 2 + k) {
                let when = saturday_from(days_from_civil(y, 5, 20) + 7 * rand_below(seed, TOWN_DAYS, stream_of(&a.id) ^ 9, y as u64, 16) as i64);
                if when == date {
                    out.wedding = Some((a.id.clone(), b.id.clone()));
                }
            }
        }
    }
    // a visiting fair on a weekend from spring to autumn
    if matches!(wd, Weekday::Sat | Weekday::Sun) && (4..=10).contains(&m) && calm {
        out.fair = rand_below(seed, TOWN_DAYS, 2, dd / 2, 100) < 6;
    }
    out.musician = calm && rand_below(seed, TOWN_DAYS, 3, dd, 100) < 6;
    out.tourist = rand_below(seed, TOWN_DAYS, 4, dd, 100) < if (6..=8).contains(&m) { 6 } else { 2 };
    if let Some(c) = pop.passed_on(date - 2) {
        out.funeral = c.who.first().cloned();
    }
    let _ = content;
    out
}

// ---- projects and openings ----------------------------------------------------------------------------------------

/// Where a project stands on a world day.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct ProjectState {
    /// soon, open, building, done
    pub status: &'static str,
    /// The stage being built (1-based), 0 otherwise.
    pub stage: u32,
    pub open_day: Option<u64>,
    pub funded_day: Option<u64>,
    pub done_day: Option<u64>,
    pub coins_have: u32,
    pub items_have: Vec<(String, u32, u32)>,
}

/// The player's contributions to a project: (world day, coins, items).
pub type Given = [(u64, u32, Vec<(String, u32)>)];

/// Where a project stands on world day `day`, given what the player gave and when (and where the projects it
/// waits for stand).
pub fn project_state(content: &Content, id: &str, day: u64, given: &BTreeMap<String, Vec<(u64, u32, Vec<(String, u32)>)>>) -> ProjectState {
    project_state_depth(content, id, day, given, 0)
}

fn project_state_depth(content: &Content, id: &str, day: u64, given: &BTreeMap<String, Vec<(u64, u32, Vec<(String, u32)>)>>, depth: u32) -> ProjectState {
    let def = &content.projects[id];
    let mut open = u64::from(def.opens);
    for a in &def.after {
        if depth > 8 || !content.projects.contains_key(a) {
            continue;
        }
        // the predecessor's done day does not depend on today: ask far ahead
        let s = project_state_depth(content, a, u64::MAX / 4, given, depth + 1);
        match s.done_day {
            Some(d) => open = open.max(d + 1),
            None => open = u64::MAX / 2,
        }
    }
    let mine: &[(u64, u32, Vec<(String, u32)>)] = given.get(id).map_or(&[], |v| v.as_slice());
    let have_on = |d: u64| -> (u32, Vec<(String, u32, u32)>) {
        let days = d.saturating_sub(open) + 1;
        let mut coins = (def.town_coins as u64 * days).min(u64::from(u32::MAX)) as u32;
        coins = coins.saturating_add(mine.iter().filter(|(gd, ..)| *gd <= d).map(|(_, c, _)| *c).sum::<u32>());
        let items = def
            .items
            .iter()
            .map(|(item, need)| {
                let town = if def.town_items_every > 0 { (days / u64::from(def.town_items_every)) as u32 } else { 0 };
                let player: u32 = mine.iter().filter(|(gd, ..)| *gd <= d).flat_map(|(_, _, its)| its.iter().filter(|(i, _)| i == item).map(|(_, n)| *n)).sum();
                (item.clone(), *need, (town + player).min(*need))
            })
            .collect::<Vec<_>>();
        (coins.min(def.coins), items)
    };
    if day < open {
        return ProjectState { status: "soon", stage: 0, open_day: (open < u64::MAX / 2).then_some(open), funded_day: None, done_day: None, coins_have: 0, items_have: def.items.iter().map(|(i, n)| (i.clone(), *n, 0)).collect() };
    }
    // the first day the money and the materials were all there
    let funded = |c: u32, its: &[(String, u32, u32)]| c >= def.coins && its.iter().all(|(_, n, h)| h >= n);
    let horizon = day.min(open + 3650);
    let mut funded_day = None;
    // town giving alone finishes on a computable day; check day by day only up to today (or far ahead for
    // predecessors): a few hundred steps at most for real content
    let mut d = open;
    while d <= horizon {
        let (c, its) = have_on(d);
        if funded(c, &its) {
            funded_day = Some(d);
            break;
        }
        // jump ahead when only the town is giving now (nothing more from the player after d)
        if mine.iter().all(|(gd, ..)| *gd <= d) && def.town_coins > 0 {
            let need = def.coins.saturating_sub(c);
            let coin_days = u64::from(need).div_ceil(u64::from(def.town_coins.max(1)));
            let item_days = its
                .iter()
                .map(|(_, n, h)| if h >= n { 0 } else if def.town_items_every > 0 { u64::from(n - h) * u64::from(def.town_items_every) } else { u64::MAX / 4 })
                .max()
                .unwrap_or(0);
            let step = coin_days.max(item_days).max(1);
            if step >= u64::MAX / 8 {
                break;
            }
            d = (d + step).min(horizon.max(d + 1));
            if d > horizon {
                break;
            }
            // land exactly on the funding day
            while d > open {
                let (c, its) = have_on(d - 1);
                if funded(c, &its) {
                    d -= 1;
                } else {
                    break;
                }
            }
            continue;
        }
        d += 1;
    }
    let total: u64 = def.stages.iter().map(|s| u64::from(s.days)).sum();
    let done_day = funded_day.map(|f| f + 1 + total);
    let (coins_have, items_have) = have_on(day.min(funded_day.unwrap_or(day)));
    match funded_day {
        Some(f) if day > f => {
            let done = done_day.expect("funded");
            if day >= done {
                ProjectState { status: "done", stage: 0, open_day: Some(open), funded_day, done_day, coins_have, items_have }
            } else {
                let mut k = f + 1;
                let mut stage = 1;
                for (i, s) in def.stages.iter().enumerate() {
                    if day < k + u64::from(s.days) {
                        stage = i as u32 + 1;
                        break;
                    }
                    k += u64::from(s.days);
                }
                ProjectState { status: "building", stage, open_day: Some(open), funded_day, done_day, coins_have, items_have }
            }
        }
        _ => ProjectState { status: "open", stage: 0, open_day: Some(open), funded_day, done_day, coins_have, items_have },
    }
}

/// Whether a shop or stall is open on a world day (and calendar date).
pub fn opening_open(content: &Content, o: &OpeningDef, day: u64, date: i64, given: &BTreeMap<String, Vec<(u64, u32, Vec<(String, u32)>)>>) -> bool {
    if day < u64::from(o.from_day) {
        return false;
    }
    let (_, m, _) = civil_from_days(date);
    if !o.months.is_empty() && !o.months.contains(&m) {
        return false;
    }
    match &o.after {
        Some(p) if content.projects.contains_key(p) => project_state(content, p, day, given).status == "done",
        _ => true,
    }
}

// ---- friends -----------------------------------------------------------------------------------------------------

/// Whether two people of the town are friends (symmetric, from the seed: about one pair in twelve).
pub fn friends(seed: u64, a: &str, b: &str) -> bool {
    if a == b {
        return false;
    }
    let (x, y) = if a < b { (a, b) } else { (b, a) };
    rand_below(seed, TOWN_FRIENDS, stream_of(x) ^ (stream_of(y) << 1), 21, 100) < 8
}

/// The Monday of the week of a date.
pub fn monday_of(date: i64) -> i64 {
    date - holidays::weekday(date) as i64
}

/// This week's dinner invitation, if any: who among those who are warm enough asks, and which day.
pub fn invitation(seed: u64, week_monday: i64, friends: &[String]) -> Option<(String, i64)> {
    if friends.is_empty() {
        return None;
    }
    let w = week_monday as u64;
    if rand_below(seed, TOWN_FRIENDS, 1, w, 100) >= 45 {
        return None;
    }
    let host = &friends[rand_below(seed, TOWN_FRIENDS, 2, w, friends.len() as u64) as usize];
    let day = week_monday + rand_below(seed, TOWN_FRIENDS, 3, w, 7) as i64;
    Some((host.clone(), day))
}

/// A friend dropping by the player's home on a date, if one does.
pub fn visitor(seed: u64, date: i64, friends: &[String]) -> Option<String> {
    if friends.is_empty() || rand_below(seed, TOWN_FRIENDS, 11, date as u64, 100) >= 12 {
        return None;
    }
    Some(friends[rand_below(seed, TOWN_FRIENDS, 12, date as u64, friends.len() as u64) as usize].clone())
}

// ---- words ---------------------------------------------------------------------------------------------------------

/// The way a change of life is told in the paper and by the town.
pub fn tell_change(c: &Change, content: &Content) -> String {
    let name = |id: &str| content.residents.get(id).map(|r| r.name.clone()).unwrap_or_default();
    let f = c.gender == "f";
    if content.lang.en() {
        return match c.kind {
            "arrived" => {
                let who = name(&c.who[0]);
                let home = content.residents.get(&c.who[0]).and_then(|r| content.sites.get(&r.home)).map(|s| s.name.clone()).unwrap_or_default();
                format!("{who} has moved to Lypove{}. The neighbours are already bringing a house-warming pie.", if home.is_empty() { String::new() } else { format!(" — into “{home}”") })
            }
            "left" => {
                let names: Vec<String> = c.who.iter().map(|w| name(w)).collect();
                format!("{} {} left Lypove. The neighbours walked them all the way to the road and told them to write.", names.join(" and "), if names.len() > 1 { "have" } else { "has" })
            }
            "born" => {
                let a = name(&c.who[0]);
                let b = c.who.get(1).map(|w| name(w)).unwrap_or_default();
                let baby = c.name.clone().unwrap_or_default();
                format!("{a} and {b} have a new arrival: a little {} called {baby}! Lypove congratulates the young family.", if f { "daughter" } else { "son" })
            }
            "passed" => format!("{} has quietly passed away. The farewell will be at the cemetery in two days, at eleven. May they rest in peace.", name(&c.who[0])),
            "retired" => format!("{} has retired after a lifetime of work. Now it's the garden, the grandchildren and the bench by the house.", name(&c.who[0])),
            "grown" => format!("{}, happy coming of age! Eighteen — and grown-up life ahead.", name(&c.who[0])),
            _ => String::new(),
        };
    }
    match c.kind {
        "arrived" => {
            let who = name(&c.who[0]);
            let home = content.residents.get(&c.who[0]).and_then(|r| content.sites.get(&r.home)).map(|s| s.name.clone()).unwrap_or_default();
            format!("До Липового {} {who}{}. Сусіди вже несуть пиріг на новосілля.", if f { "переїхала" } else { "переїхав" }, if home.is_empty() { String::new() } else { format!(" — тепер це «{home}»") })
        }
        "left" => {
            let names: Vec<String> = c.who.iter().map(|w| name(w)).collect();
            format!("{} {} з Липового. Сусіди проводжали аж до дороги й наказали писати.", names.join(" і "), if names.len() > 1 { "переїхали" } else if f { "переїхала" } else { "переїхав" })
        }
        "born" => {
            let a = name(&c.who[0]);
            let b = c.who.get(1).map(|w| name(w)).unwrap_or_default();
            let baby = c.name.clone().unwrap_or_default();
            format!("У {a} і {b} поповнення: {} {baby}! Липове вітає молоду родину.", if f { "народилася донечка" } else { "народився синочок" })
        }
        "passed" => {
            let who = name(&c.who[0]);
            format!("Тихо {} з життя {who}. Прощання — на кладовищі, за два дні об одинадцятій. Світла пам'ять.", if f { "пішла" } else { "пішов" })
        }
        "retired" => format!("{} {} на заслужений відпочинок. Тепер — город, онуки й лавка біля хати.", name(&c.who[0]), if f { "вийшла" } else { "вийшов" }),
        "grown" => format!("{}, вітаємо з повноліттям! Вісімнадцять — і попереду доросле життя.", name(&c.who[0])),
        _ => String::new(),
    }
}

// ---- the town in the core: what the player sees and does ---------------------------------------------------------

use crate::core::{Core, CoreError};
use crate::event::EventKind;
use crate::storage::Storage;
use crate::time::WorldTime;

/// What the core keeps worked out about the town (derived, never stored).
#[derive(Default)]
pub struct TownCache {
    pub(crate) pop: Option<Population>,
    pub(crate) people: Option<(i64, Vec<ResidentDef>)>,
    flags: Option<((u64, u64), BTreeSet<String>)>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct PersonRef {
    pub id: String,
    pub name: String,
    pub gender: String,
}

/// The day in town, told.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
pub struct TodayView {
    pub birthdays: Vec<PersonRef>,
    pub storm: bool,
    pub storm_hours: Option<(u32, u32)>,
    pub outage: bool,
    pub wedding: Option<(PersonRef, PersonRef)>,
    pub fair: bool,
    pub musician: bool,
    pub tourist: bool,
    pub funeral: Option<PersonRef>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct ProjectView {
    pub id: String,
    pub name: String,
    pub text: String,
    pub location: String,
    pub coins_need: u32,
    pub coins_have: u32,
    /// (item, needed, there)
    pub items: Vec<(String, u32, u32)>,
    /// Coins the player gave.
    pub mine: u32,
    /// soon, open, building, done
    pub status: String,
    pub stage_index: u32,
    pub stage: Option<String>,
    pub stages: Vec<String>,
    pub done_day: Option<u64>,
    pub done: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct OpeningView {
    pub id: String,
    pub name: String,
    pub text: String,
    pub open: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct InvitationView {
    pub host: String,
    pub name: String,
    /// The world day of the dinner.
    pub day: u64,
    pub from: u32,
    pub to: u32,
    /// The door is open now.
    pub active: bool,
    pub done: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct VisitorView {
    pub id: String,
    pub name: String,
    pub from: u32,
    pub to: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct BondView {
    pub id: String,
    pub name: String,
    pub points: u32,
    /// birthday, dinner, gift, helped
    pub memories: Vec<String>,
    /// What they say about it, today.
    pub line: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct ChangeView {
    pub day: u64,
    pub kind: String,
    pub who: Vec<String>,
    pub text: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct TownView {
    pub flags: Vec<String>,
    pub today: TodayView,
    pub projects: Vec<ProjectView>,
    pub openings: Vec<OpeningView>,
    pub invitations: Vec<InvitationView>,
    pub visitor: Option<VisitorView>,
    pub bonds: Vec<BondView>,
    /// What changed in people's lives in the last month (newest last).
    pub changes: Vec<ChangeView>,
}

impl<S: Storage> Core<S> {
    fn first_day(&self) -> i64 {
        self.calendar().first_day
    }

    /// Makes sure the town's years and its people on `date` are worked out.
    pub(crate) fn town_ready(&self, date: i64) {
        let mut c = self.town_cache.borrow_mut();
        let first = self.first_day();
        if !c.pop.as_ref().is_some_and(|p| p.covers(date) && p.first_day == first) {
            c.pop = Some(Population::compute(self.content(), self.meta().seed, first, date.max(first) + 365));
            c.people = None;
        }
        if c.people.as_ref().is_none_or(|(d, _)| *d != date) {
            let people = c.pop.as_ref().expect("computed above").people(self.content(), self.meta().seed, date);
            c.people = Some((date, people));
        }
    }

    /// The town's residents as they are at `now` (who lives here, how old, with a pram…).
    pub fn town_people(&self, now: WorldTime) -> Vec<ResidentDef> {
        let date = self.calendar().date(now);
        self.town_ready(date);
        self.town_cache.borrow().people.as_ref().map(|(_, p)| p.clone()).unwrap_or_default()
    }

    /// Runs `f` with the town's people at `now` and its years (borrowed, no copies).
    pub(crate) fn with_town<R>(&self, now: WorldTime, f: impl FnOnce(&[ResidentDef], &Population) -> R) -> R {
        let date = self.calendar().date(now);
        self.town_ready(date);
        let c = self.town_cache.borrow();
        let (_, people) = c.people.as_ref().expect("ready");
        f(people, c.pop.as_ref().expect("ready"))
    }

    /// What changed in people's lives between two times, told.
    pub fn town_changes(&self, from: WorldTime, to: WorldTime) -> Vec<ChangeView> {
        let (a, b) = (self.calendar().date(from), self.calendar().date(to));
        self.town_ready(b);
        let first = self.first_day();
        let c = self.town_cache.borrow();
        c.pop
            .as_ref()
            .map(|p| {
                p.changes
                    .iter()
                    .filter(|ch| ch.date >= a && ch.date <= b && ch.date >= first)
                    .map(|ch| ChangeView { day: (ch.date - first) as u64, kind: ch.kind.to_string(), who: ch.who.clone(), text: tell_change(ch, self.content()) })
                    .collect()
            })
            .unwrap_or_default()
    }

    /// The day in town at `now`.
    pub fn town_day(&self, now: WorldTime) -> DayTown {
        let date = self.calendar().date(now);
        let first = self.first_day();
        let seed = self.meta().seed;
        self.with_town(now, |people, pop| {
            let refs: Vec<&ResidentDef> = people.iter().collect();
            day_town(self.content(), seed, first, date, &refs, pop)
        })
    }

    /// The town's flags at `now`: where each project stands, the shops open, the day's events. Map props and
    /// stations show or work by them.
    pub fn town_flags(&self, now: WorldTime) -> BTreeSet<String> {
        let key = (now.day(), self.state().events_applied);
        if let Some((k, f)) = &self.town_cache.borrow().flags {
            if *k == key {
                return f.clone();
            }
        }
        let content = self.content();
        let given = &self.state().contributions;
        let day = now.day();
        let date = self.calendar().date(now);
        let mut out = BTreeSet::new();
        for id in content.projects.keys() {
            let s = project_state(content, id, day, given);
            match s.status {
                "open" => {
                    out.insert(format!("project:{id}:open"));
                }
                "building" => {
                    out.insert(format!("project:{id}:building"));
                    out.insert(format!("project:{id}:stage{}", s.stage));
                }
                "done" => {
                    out.insert(format!("project:{id}:done"));
                }
                _ => {}
            }
        }
        for o in content.openings.values() {
            if opening_open(content, o, day, date, given) {
                out.insert(format!("open:{}", o.id));
            }
        }
        out.extend(self.growth_flags(now));
        // the full moon (the forest circle lights its fire), and the days the temple's bowls are filled: every
        // full moon and, now and then, an ordinary day (two or three a week, by the world's seed)
        // the fountain is drained and covered from mid-November to the end of March (its water would freeze)
        let (_, month, mday) = crate::time::civil_from_days(date);
        if month == 12 || month <= 3 || (month == 11 && mday >= 15) {
            out.insert("fountain_off".to_string());
        }
        let full = crate::holidays::full_moon(date);
        if full {
            out.insert("full_moon".to_string());
        }
        let mix = (day.wrapping_mul(0x9E37_79B9_7F4A_7C15) ^ self.meta().seed.rotate_left(17)).wrapping_mul(0xBF58_476D_1CE4_E5B9) >> 59;
        if full || mix < 12 {
            out.insert("offerings".to_string());
        }
        let t = self.town_day(now);
        for (on, flag) in [(t.storm.is_some(), "storm"), (t.outage, "outage"), (t.wedding.is_some(), "wedding"), (t.fair, "fair"), (t.musician, "musician"), (t.tourist, "tourist"), (t.funeral.is_some(), "funeral")] {
            if on {
                out.insert(flag.to_string());
            }
        }
        self.town_cache.borrow_mut().flags = Some((key, out.clone()));
        out
    }

    fn person_ref(&self, id: &str) -> PersonRef {
        let c = self.content();
        let (name, gender) = c
            .residents
            .get(id)
            .map(|r| (r.name.clone(), r.gender.clone()))
            .or_else(|| c.npcs.get(id).map(|n| (n.name.clone(), String::new())))
            .unwrap_or_default();
        PersonRef { id: id.to_string(), name, gender }
    }

    /// Present residents and the story's people the player is warm enough with.
    fn friends_from(&self, now: WorldTime, min: u32) -> Vec<String> {
        let rel = &self.state().relations;
        let mut out: Vec<String> = self.with_town(now, |people, _| people.iter().filter(|r| rel.get(&r.id).is_some_and(|x| x.points >= min)).map(|r| r.id.clone()).collect());
        out.extend(self.content().npcs.keys().filter(|id| rel.get(*id).is_some_and(|x| x.points >= min)).cloned());
        out.sort();
        out
    }

    /// Who the player is invited to dine with right now (the door of the dinner opens an hour early).
    pub fn dinner_now(&self, now: WorldTime) -> Option<String> {
        let date = self.calendar().date(now);
        let minute = (now.0 % MINUTES_PER_DAY) as u32;
        let friends = self.friends_from(now, INVITE_POINTS);
        let (host, day) = invitation(self.meta().seed, monday_of(date), &friends)?;
        (day == date && minute + 60 >= DINNER.0 && minute < DINNER.1).then_some(host)
    }

    /// Everything about the town the player sees at `now`.
    pub fn town_view(&self, now: WorldTime) -> TownView {
        let content = self.content();
        let seed = self.meta().seed;
        let date = self.calendar().date(now);
        let first = self.first_day();
        let day = now.day();
        let minute = (now.0 % MINUTES_PER_DAY) as u32;
        let given = &self.state().contributions;
        let today = self.town_view_today(now);
        let projects = content
            .projects
            .values()
            .map(|p| {
                let s = project_state(content, &p.id, day, given);
                ProjectView {
                    id: p.id.clone(),
                    name: p.name.clone(),
                    text: p.text.clone(),
                    location: p.location.clone(),
                    coins_need: p.coins,
                    coins_have: s.coins_have,
                    items: s.items_have.clone(),
                    mine: given.get(&p.id).map_or(0, |v| v.iter().map(|(_, c, _)| *c).sum()),
                    status: s.status.to_string(),
                    stage_index: s.stage,
                    stage: (s.stage > 0).then(|| p.stages[s.stage as usize - 1].name.clone()),
                    stages: p.stages.iter().map(|x| x.name.clone()).collect(),
                    done_day: s.done_day,
                    done: p.done.clone(),
                }
            })
            .collect();
        let openings = content.openings.values().map(|o| OpeningView { id: o.id.clone(), name: o.name.clone(), text: o.text.clone(), open: opening_open(content, o, day, date, given) }).collect();
        // dinner invitations this week and next
        let friends = self.friends_from(now, INVITE_POINTS);
        let mut invitations = Vec::new();
        for monday in [monday_of(date), monday_of(date) + 7] {
            if let Some((host, d)) = invitation(seed, monday, &friends) {
                if d >= date && d <= date + 7 && d >= first {
                    let wd = (d - first) as u64;
                    invitations.push(InvitationView {
                        name: self.person_ref(&host).name,
                        active: d == date && minute + 60 >= DINNER.0 && minute < DINNER.1,
                        done: self.state().dined.contains(&format!("{host}:{wd}")),
                        host,
                        day: wd,
                        from: DINNER.0,
                        to: DINNER.1,
                    });
                }
            }
        }
        let close = self.friends_from(now, VISIT_POINTS);
        let visitor = visitor(seed, date, &close).filter(|_| (VISIT.0..VISIT.1).contains(&minute)).map(|id| VisitorView { name: self.person_ref(&id).name, id, from: VISIT.0, to: VISIT.1 });
        let bonds = self.bonds(now);
        let changes = self.town_changes(WorldTime(now.0.saturating_sub(30 * MINUTES_PER_DAY)), now);
        TownView { flags: self.town_flags(now).into_iter().collect(), today, projects, openings, invitations, visitor, bonds, changes }
    }

    /// What people remember of the player, and what they say about it.
    fn bonds(&self, now: WorldTime) -> Vec<BondView> {
        let st = self.state();
        let content = self.content();
        let present: BTreeSet<String> = self.with_town(now, |people, _| people.iter().map(|r| r.id.clone()).collect());
        // whom the player helped: the givers of quests done
        let mut helped: BTreeSet<String> = BTreeSet::new();
        for (key, p) in &st.quests {
            if !p.done {
                continue;
            }
            let giver = if key.starts_with("job:") { self.job_by_key(key).map(|j| j.giver) } else { content.quests.get(key.split('@').next().unwrap_or(key)).map(|q| q.giver.clone()) };
            if let Some(g) = giver {
                helped.insert(g);
            }
        }
        let mut out = Vec::new();
        for (id, rel) in &st.relations {
            if rel.points == 0 || !(present.contains(id) || content.npcs.contains_key(id)) {
                continue;
            }
            let mut memories = Vec::new();
            if st.congratulated.iter().any(|k| k.rsplit_once(':').is_some_and(|(w, _)| w == id)) {
                memories.push("birthday".to_string());
            }
            if st.dined.iter().any(|k| k.rsplit_once(':').is_some_and(|(w, _)| w == id)) {
                memories.push("dinner".to_string());
            }
            if !rel.tastes.is_empty() {
                memories.push("gift".to_string());
            }
            if helped.contains(id) {
                memories.push("helped".to_string());
            }
            let line = (!memories.is_empty()).then(|| {
                let k = &memories[(now.day() as usize + stream_of(id) as usize) % memories.len()];
                let l = self.lang();
                match k.as_str() {
                    "birthday" => l.pick("Дякую за привітання з днем народження — приємно, що пам'ятаєш!", "Thank you for the birthday wishes — it's lovely that you remembered!"),
                    "dinner" => l.pick("Заходь ще на вечерю — у нас для тебе завжди знайдеться тарілка.", "Come for dinner again — there's always a plate for you at ours."),
                    "gift" => l.pick("Твій подарунок досі мене тішить щодня.", "Your present still makes me happy every day."),
                    _ => l.pick("Пам'ятаю, як ти мене виручив-виручила. Добре мати таких сусідів!", "I remember how you helped me out. It's good to have neighbours like you!"),
                }
                .to_string()
            });
            out.push(BondView { id: id.clone(), name: self.person_ref(id).name, points: rel.points, memories, line });
        }
        out
    }

    fn gift_taste(&self, who: &str, item: &str) -> Result<i8, CoreError> {
        let content = self.content();
        let item_def = content.items.get(item).ok_or_else(|| CoreError::UnknownItem(item.to_string()))?;
        if (matches!(item_def.acquire, crate::unlock::Unlock::Free) && !item_def.hidden) || item_def.key {
            return Err(CoreError::NoGift);
        }
        if self.available(item) == 0 {
            return Err(CoreError::NotOwned(item.to_string()));
        }
        Ok(match content.npcs.get(who) {
            Some(def) => crate::npc::taste(def, item, &item_def.tags, &item_def.category),
            None => taste_of(self.meta().seed, who, &item_def.tags, &item_def.category),
        })
    }

    fn is_person_here(&self, now: WorldTime, who: &str) -> bool {
        self.content().npcs.contains_key(who) || self.with_town(now, |people, _| people.iter().any(|r| r.id == who))
    }

    /// A gift to a resident of the town (the story's people have their own, in `Gift`).
    pub(crate) fn plan_gift_resident(&self, now: WorldTime, who: &str, item: &str) -> Result<Vec<EventKind>, CoreError> {
        if !self.is_person_here(now, who) {
            return Err(CoreError::UnknownNpc(who.to_string()));
        }
        let taste = self.gift_taste(who, item)?;
        if self.state().relations.get(who).is_some_and(|r| r.gift_day == Some(now.day())) {
            return Err(CoreError::TooSoon);
        }
        let delta = match taste {
            1 => crate::npc::GIFT_LIKED,
            -1 => crate::npc::GIFT_DISLIKED,
            _ => crate::npc::GIFT_NEUTRAL,
        };
        Ok(vec![EventKind::NpcGifted { npc: who.to_string(), item: item.to_string(), day: now.day(), delta, taste }])
    }

    pub(crate) fn plan_congratulate(&self, now: WorldTime, who: &str, gift: Option<String>) -> Result<Vec<EventKind>, CoreError> {
        if !self.is_person_here(now, who) {
            return Err(CoreError::UnknownNpc(who.to_string()));
        }
        if self.location() == "home" {
            return Err(CoreError::NotHere);
        }
        let date = self.calendar().date(now);
        if !is_birthday(self.meta().seed, who, date) {
            return Err(CoreError::NotToday);
        }
        let (year, _, _) = civil_from_days(date);
        if self.state().congratulated.contains(&format!("{who}:{year}")) {
            return Err(CoreError::AlreadyDone);
        }
        let taste = match &gift {
            Some(g) => self.gift_taste(who, g)?,
            None => 0,
        };
        let delta = match (&gift, taste) {
            (None, _) => 60,
            (Some(_), 1) => 160,
            (Some(_), -1) => 50,
            _ => 100,
        };
        Ok(vec![EventKind::Congratulated { who: who.to_string(), year, day: now.day(), gift, taste, delta }])
    }

    pub(crate) fn plan_contribute(&self, now: WorldTime, project: &str, coins: u32, items: Vec<(String, u32)>) -> Result<Vec<EventKind>, CoreError> {
        let content = self.content();
        let def = content.projects.get(project).ok_or(CoreError::NoRequest)?;
        let board = if content.locations.contains_key(BOARD) { BOARD } else { "village" };
        if self.location() != board {
            return Err(CoreError::NotHere);
        }
        let day = now.day();
        let s = project_state(content, project, day, &self.state().contributions);
        match s.status {
            "soon" => return Err(CoreError::Closed),
            "building" | "done" => return Err(CoreError::AlreadyDone),
            _ => {}
        }
        if s.funded_day.is_some_and(|f| f <= day) {
            return Err(CoreError::AlreadyDone);
        }
        let coins = coins.min(def.coins.saturating_sub(s.coins_have));
        if u64::from(coins) > self.wallet().coins {
            return Err(CoreError::Locked(vec![crate::unlock::Missing::Coins { have: self.wallet().coins, need: u64::from(coins) }]));
        }
        let mut given = Vec::new();
        for (item, n) in items {
            let Some((_, need, have)) = s.items_have.iter().find(|(i, ..)| *i == item) else {
                return Err(CoreError::NotEnough);
            };
            let n = n.min(need.saturating_sub(*have));
            if n == 0 {
                continue;
            }
            if self.in_pocket(&item) < n {
                return Err(CoreError::NotEnough);
            }
            given.push((item, n));
        }
        if coins == 0 && given.is_empty() {
            return Err(CoreError::NotEnough);
        }
        Ok(vec![EventKind::Contributed { project: project.to_string(), day, coins, items: given }])
    }

    /// The town in the morning paper: stories for the front page (with their weight), lines about the town
    /// today, and what is coming.
    pub(crate) fn town_paper(&self, now: WorldTime) -> (Vec<(u32, crate::economy::PaperStory)>, Vec<String>, Vec<String>) {
        let content = self.content();
        let day = now.day();
        let mut stories = Vec::new();
        let mut lines = Vec::new();
        let mut events = Vec::new();
        let l = content.lang;
        // the story's kind rides in its id (the paper picks the photo by it, whatever the language)
        let story = |kind: &str, title: &str, text: String| crate::economy::PaperStory { title: title.to_string(), text, id: kind.to_string(), ..Default::default() };
        // what changed in people's lives yesterday (and today's early news)
        if day > 0 {
            for c in self.town_changes(WorldTime((day - 1) * MINUTES_PER_DAY), WorldTime(day * MINUTES_PER_DAY - 1)) {
                let (w, title) = match c.kind.as_str() {
                    "born" => (12, l.pick("Поповнення", "A new arrival")),
                    "passed" => (12, l.pick("Світла пам'ять", "In loving memory")),
                    "arrived" => (10, l.pick("Нові сусіди", "New neighbours")),
                    "left" => (9, l.pick("Проводи", "Farewells")),
                    "retired" => (6, l.pick("На пенсію", "Retirement")),
                    _ => (6, l.pick("Вітаємо", "Congratulations")),
                };
                stories.push((w, story(c.kind.as_str(), title, c.text)));
            }
        }
        let t = self.town_view_today(now);
        if let Some((a, b)) = &t.wedding {
            let text = if l.en() { format!("{} and {} are getting married today! After the church — a party on the square, and everyone is invited.", a.name, b.name) } else { format!("Сьогодні вінчаються {} і {}! Після костелу — гуляння на площі, всі запрошені.", a.name, b.name) };
            stories.push((11, story("wedding", l.pick("Весілля", "A wedding"), text)));
        }
        if let Some(f) = &t.funeral {
            lines.push(if l.en() { format!("Today at eleven the town says goodbye to {} at the cemetery.", f.name) } else { format!("Сьогодні об одинадцятій на кладовищі прощаються з {}.", f.name) });
        }
        if !t.birthdays.is_empty() {
            let names: Vec<String> = t.birthdays.iter().map(|p| p.name.clone()).collect();
            lines.push(if l.en() { format!("Birthdays today: {}. Don't forget to wish them well!", names.join(", ")) } else { format!("Сьогодні день народження у: {}. Не забудьте привітати!", names.join(", ")) });
        }
        if t.fair {
            lines.push(l.pick("На площу приїхав ярмарок: каруселі, солодка вата й гончар з глеками.", "The fair has come to the square: merry-go-rounds, candyfloss and a potter with his jugs.").to_string());
        }
        if t.musician {
            lines.push(l.pick("Увечері на площі гратиме мандрівний музика — кажуть, грає так, що й ліхтарі підспівують.", "A travelling musician will play on the square tonight — they say he plays so well the street lamps sing along.").to_string());
        }
        if t.tourist {
            lines.push(l.pick("У місті бачили туриста з картою — якщо заблукав, підкажіть дорогу.", "A tourist with a map has been seen in town — if they look lost, point the way.").to_string());
        }
        if t.storm {
            lines.push(if t.outage { l.pick("Синоптики попереджають про бурю; може зникнути світло — свічки тримайте напохваті.", "Forecasters warn of a storm; the power may go out — keep candles handy.") } else { l.pick("Синоптики попереджають про бурю: краще перечекати вдома.", "Forecasters warn of a storm: best to wait it out at home.") }.to_string());
        }
        // the town's projects: what is collected, what is being built, what was finished yesterday
        let given = &self.state().contributions;
        for p in content.projects.values() {
            let s = project_state(content, &p.id, day, given);
            match s.status {
                "open" if l.en() => lines.push(format!("The town hall is collecting for “{}”: {} of {} coins so far.", p.name, s.coins_have, p.coins)),
                "open" => lines.push(format!("Ратуша збирає на «{}»: є {} з {} монет.", p.name, s.coins_have, p.coins)),
                "building" if l.en() => lines.push(format!("Building “{}”: {}.", p.name, p.stages[s.stage as usize - 1].name.to_lowercase())),
                "building" => lines.push(format!("Будують «{}»: {}.", p.name, p.stages[s.stage as usize - 1].name.to_lowercase())),
                "done" if s.done_day == Some(day) || s.done_day.is_some_and(|d| d + 1 == day) => stories.push((10, story("built", l.pick("Збудовано", "Built"), p.done.clone()))),
                _ => {}
            }
        }
        // shops that opened today
        let date = self.calendar().date(now);
        for o in content.openings.values() {
            let open_now = opening_open(content, o, day, date, given);
            let open_before = day > 0 && opening_open(content, o, day - 1, date - 1, given);
            if open_now && !open_before {
                stories.push((8, story("opened", l.pick("Відкриття", "Now open"), o.text.clone())));
            }
        }
        // birthdays coming in the next days
        let (soon, _) = self.with_town(now, |people, _| {
            let mut out = Vec::new();
            for d in 1..=3i64 {
                for r in people {
                    if is_birthday(self.meta().seed, &r.id, date + d) {
                        out.push((d, r.name.clone()));
                    }
                }
            }
            (out, ())
        });
        for (d, name) in soon.into_iter().take(3) {
            events.push(match (d, l.en()) {
                (1, false) => format!("Завтра день народження у: {name}"),
                (n, false) => format!("Через {n} дні — день народження у: {name}"),
                (1, true) => format!("Tomorrow — {name}'s birthday"),
                (n, true) => format!("In {n} days — {name}'s birthday"),
            });
        }
        (stories, lines, events)
    }

    /// The day in town, told (without the rest of the town view).
    fn town_view_today(&self, now: WorldTime) -> TodayView {
        let t = self.town_day(now);
        TodayView {
            birthdays: t.birthdays.iter().map(|id| self.person_ref(id)).collect(),
            storm: t.storm.is_some(),
            storm_hours: t.storm,
            outage: t.outage,
            wedding: t.wedding.as_ref().map(|(a, b)| (self.person_ref(a), self.person_ref(b))),
            fair: t.fair,
            musician: t.musician,
            tourist: t.tourist,
            funeral: t.funeral.as_ref().map(|id| self.person_ref(id)),
        }
    }

    pub(crate) fn plan_dine(&self, now: WorldTime, host: &str) -> Result<Vec<EventKind>, CoreError> {
        let content = self.content();
        if !content.locations.get(self.location()).is_some_and(|l| l.invite_only) {
            return Err(CoreError::NotHere);
        }
        if self.dinner_now(now).as_deref() != Some(host) {
            return Err(CoreError::NotInvited);
        }
        let day = now.day();
        if self.state().dined.contains(&format!("{host}:{day}")) {
            return Err(CoreError::AlreadyDone);
        }
        // what they send home with the guest: a dish of the house
        let dishes: Vec<&String> = content.items.values().filter(|d| d.carry && !d.key && d.tags.iter().any(|t| t == "dish" || t == "sweet")).map(|d| &d.id).collect();
        let gave = (!dishes.is_empty()).then(|| dishes[rand_below(self.meta().seed, TOWN_FRIENDS, stream_of(host) ^ 31, day, dishes.len() as u64) as usize].clone());
        let mut events = vec![EventKind::Dined { host: host.to_string(), day, gave: gave.clone(), delta: 90 }];
        if let Some(g) = gave {
            events.extend(self.overflow(&[g], 0));
        }
        Ok(events)
    }
}
