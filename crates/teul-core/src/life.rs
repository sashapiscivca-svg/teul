//! The life of the settlement: a deterministic simulation of its people and places. Every ten world minutes each
//! resident chooses what to do from their schedule and needs (sleep, work or school, food, money, company), and
//! the state of the world, with seeded chance, gives rise to what happens: an illness, a theft, a fight, a fire,
//! a delivery. The same seed, content and time give the same village on every device. The shell only draws it.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::content::Content;
use crate::holidays::{self, DayInfo};
use crate::rng::{rand_below, Domain};
use crate::time::{civil_from_days, days_from_civil, Calendar, Season, WorldTime, MINUTES_PER_DAY};

pub const LIFE: Domain = Domain(51);
pub const LIFE_SITE: Domain = Domain(52);
/// The draws that shape someone's day: a few minutes earlier or later, a coffee on the way, an errand, mass,
/// a vacation; seeded by person and day, so the same everywhere.
pub const LIFE_PLAN: Domain = Domain(53);
/// World minutes per step of the simulation.
pub const TICK: u64 = 10;
pub const TICKS_PER_DAY: u64 = MINUTES_PER_DAY / TICK;
/// How many days of happenings are kept (for the paper and gossip).
pub const KEEP_DAYS: u64 = 7;
/// How many days before today the simulation starts from (a fresh settlement each time the day changes).
pub const WINDOW_DAYS: u64 = 7;

/// Work at a site: how many people, which hours, which days of the week (empty: every day).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct JobDef {
    pub role: String,
    pub from: u32,
    pub to: u32,
    #[serde(default)]
    pub days: Vec<u8>,
    /// Coins a day.
    #[serde(default)]
    pub wage: u32,
}

/// A building or a place with a purpose: a home, the school, the hospital, a shop, the park...
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SiteDef {
    pub id: String,
    pub name: String,
    /// home, school, hospital, police, fire, sawmill, grocery, bakery, cafe, flowers, library, market, park,
    /// square, farm, forest...
    pub kind: String,
    /// The door: where people go in and out.
    pub x: i32,
    pub y: i32,
    /// Where people are seen while they are there (a yard, a terrace, the square); empty for indoors only.
    #[serde(default)]
    pub area: Option<(i32, i32, i32, i32)>,
    /// The building's own footprint (for fires), if it is one.
    #[serde(default)]
    pub building: Option<(i32, i32, i32, i32)>,
    #[serde(default)]
    pub jobs: Vec<JobDef>,
    /// Food it sells, a portion's price, and its stock at the start.
    #[serde(default)]
    pub price: u32,
    #[serde(default)]
    pub stock: u32,
    /// A few words about the place, for the maps (what it is like, what one goes there for).
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub about: String,
}

/// Someone living in the settlement.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ResidentDef {
    pub id: String,
    pub name: String,
    /// "f" or "m" (for how the paper speaks of them).
    pub gender: String,
    /// child, adult or elder.
    pub age: String,
    pub home: String,
    /// Where they work, and as what.
    #[serde(default)]
    pub job: Option<(String, String)>,
    #[serde(default)]
    pub school: Option<String>,
    /// 0..100.
    pub honesty: u32,
    pub temper: u32,
    pub social: u32,
    #[serde(default)]
    pub look: BTreeMap<String, String>,
    /// A grown-up in their twenties: only they (and sweethearts) are out late in the evening.
    #[serde(default)]
    pub young: bool,
    /// Who they go about with (the other half of a couple).
    #[serde(default)]
    pub partner: Option<String>,
    /// How they get about: walking (none), with a "cane", in a "wheelchair".
    #[serde(default)]
    pub mobility: Option<String>,
    /// A young parent who pushes a pram when out.
    #[serde(default)]
    pub pram: bool,
    /// Someone new: they move into the town this many days after the world began (with a little chance).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub arrives: Option<u32>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Activity {
    Sleep,
    Home,
    Work,
    School,
    Eat,
    Shop,
    Leisure,
    Sick,
    Injured,
    Arrested,
    Firefight,
    Patrol,
    /// A journalist out asking someone questions for the paper.
    Interview,
    /// On vacation away from the town (not seen until they are back).
    Away,
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct Agent {
    site: usize,
    from: usize,
    since: u64,
    activity: Activity,
    hunger: u32,
    money: i64,
    mood: i32,
    /// Until which tick they are ill, hurt or held by the police (0: free and well).
    sick_until: u64,
    /// The tick the illness began (the day of it they go to the doctor).
    sick_since: u64,
    hurt_until: u64,
    held_until: u64,
    paid_day: u64,
    pension_day: u64,
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct Site {
    stock: i64,
    cash: i64,
    fire: u32,
    damage: u32,
    restock_due: u64,
    /// Food portions in a home's pantry, shared by its household.
    pantry: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Vehicle {
    Cart,
    Car,
    Police,
    Ambulance,
    FireTruck,
    Garbage,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Trip {
    pub kind: Vehicle,
    pub from: String,
    pub to: String,
    /// World minutes.
    pub depart: u64,
    pub arrive: u64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum IncidentKind {
    Theft,
    Caught,
    Fight,
    Detained,
    Fire,
    FireOut,
    Ill,
    Healed,
    Delivery,
    Party,
    /// A journalist of the village paper interviewed someone.
    Interview,
    /// The dump is full and rubbish spills over its fence.
    DumpFull,
    /// The dump cleared: the rubbish taken away for sorting.
    DumpCleared,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Incident {
    pub minute: u64,
    pub kind: IncidentKind,
    pub site: String,
    pub who: Vec<String>,
}

/// The simulated settlement at some tick.
#[derive(Clone, Debug)]
pub struct Life {
    start: u64,
    tick: u64,
    agents: Vec<Agent>,
    sites: Vec<Site>,
    trips: Vec<Trip>,
    incidents: Vec<Incident>,
    /// Open police cases: (who, site, opened, for a theft rather than a fight).
    cases: Vec<(usize, usize, u64, bool)>,
    /// Everyone's plan for the day being lived, and for the day before (a night shift runs over midnight).
    plans: Vec<DayPlan>,
    yesterday: Vec<DayPlan>,
    plan_day: Option<u64>,
}

/// Where someone is and what they do, for the shell.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct ResidentView {
    pub id: String,
    pub name: String,
    pub gender: String,
    pub age: String,
    pub site: String,
    pub from: String,
    /// World minute they set off for the site.
    pub since: u64,
    pub activity: Activity,
    pub mood: i32,
    /// As they are now (a child grown up, a parent with a new baby in the pram).
    pub young: bool,
    pub pram: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct SiteView {
    pub id: String,
    pub fire: u32,
    pub damage: u32,
    pub stock: i64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct LifeView {
    /// How full the dump is, in percent (over 100 it spills over the fence).
    pub dump: u32,
    pub residents: Vec<ResidentView>,
    pub sites: Vec<SiteView>,
    pub trips: Vec<Trip>,
    pub incidents: Vec<Incident>,
    /// The happenings told in words, newest last.
    pub news: Vec<News>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct News {
    pub minute: u64,
    pub kind: IncidentKind,
    pub site: String,
    pub text: String,
}

/// Everything the simulation reads from the content, in index form.
pub struct World<'a> {
    /// The real calendar, for the seasons.
    pub calendar: Calendar,
    pub sites: Vec<&'a SiteDef>,
    pub people: Vec<&'a ResidentDef>,
    index: BTreeMap<&'a str, usize>,
    /// Residents by id (for partners).
    person: BTreeMap<&'a str, usize>,
    /// How many people hold each job (site, role): a job of one rests on Sundays, a job of several in turns.
    staff: BTreeMap<(&'a str, &'a str), usize>,
    kind: BTreeMap<&'a str, Vec<usize>>,
    content: &'a Content,
    /// The town's years (births, passings…), when the world knows them.
    pop: Option<&'a crate::town::Population>,
    /// The day in town (birthdays, a wedding, a storm…), by date, worked out once.
    town_days: std::cell::RefCell<BTreeMap<i64, std::rc::Rc<crate::town::DayTown>>>,
}

impl<'a> World<'a> {
    /// The same world on the calendar of a save (its seasons by the real date).
    pub fn with_calendar(mut self, calendar: Calendar) -> Self {
        self.calendar = calendar;
        self
    }

    pub fn of(content: &'a Content) -> World<'a> {
        Self::build(content, content.residents.values().collect())
    }

    /// The town with the people living in it on some date (see `town::Population::people`), and its years.
    pub fn of_people(content: &'a Content, people: &'a [ResidentDef], pop: &'a crate::town::Population) -> World<'a> {
        let mut w = Self::build(content, people.iter().collect());
        w.pop = Some(pop);
        w
    }

    fn build(content: &'a Content, people: Vec<&'a ResidentDef>) -> World<'a> {
        let sites: Vec<&SiteDef> = content.sites.values().collect();
        let index = sites.iter().enumerate().map(|(i, s)| (s.id.as_str(), i)).collect();
        let mut kind: BTreeMap<&str, Vec<usize>> = BTreeMap::new();
        for (i, s) in sites.iter().enumerate() {
            kind.entry(s.kind.as_str()).or_default().push(i);
        }
        let person = people.iter().enumerate().map(|(i, p)| (p.id.as_str(), i)).collect();
        let mut staff: BTreeMap<(&str, &str), usize> = BTreeMap::new();
        for p in &people {
            if let Some((s, r)) = &p.job {
                *staff.entry((s.as_str(), r.as_str())).or_default() += 1;
            }
        }
        World { calendar: Calendar::from_epoch(0), sites, people, index, person, kind, staff, content, pop: None, town_days: std::cell::RefCell::new(BTreeMap::new()) }
    }

    /// The day in town on a date: whose birthday, a storm, a wedding, a fair, a funeral.
    pub fn day_town(&self, seed: u64, date: i64) -> std::rc::Rc<crate::town::DayTown> {
        if let Some(d) = self.town_days.borrow().get(&date) {
            return d.clone();
        }
        let empty = crate::town::Population::default();
        let pop = self.pop.unwrap_or(&empty);
        let d = std::rc::Rc::new(crate::town::day_town(self.content, seed, self.calendar.first_day, date, &self.people, pop));
        let mut days = self.town_days.borrow_mut();
        if days.len() > 16 {
            days.clear();
        }
        days.insert(date, d.clone());
        d
    }

    fn site(&self, id: &str) -> usize {
        self.index.get(id).copied().unwrap_or(0)
    }

    fn of_kind(&self, k: &str) -> &[usize] {
        self.kind.get(k).map(|v| v.as_slice()).unwrap_or(&[])
    }

    /// The other half of someone's couple, if they have one.
    fn partner_of(&self, i: usize) -> Option<usize> {
        self.people[i].partner.as_deref().and_then(|id| self.person.get(id).copied())
    }

    /// Whether a site is open to visitors now: one with staff while someone is on shift, one without (a park, a
    /// square) always; shops and offices stay shut on the holidays that are days off.
    fn open(&self, s: usize, hour: u32, wd: u8, info: &DayInfo) -> bool {
        if info.holiday.is_some_and(|h| h.day_off) && SHUT_ON_HOLIDAYS.contains(&self.sites[s].kind.as_str()) {
            return false;
        }
        let jobs = &self.sites[s].jobs;
        jobs.is_empty()
            || jobs.iter().any(|j| (j.days.is_empty() || j.days.contains(&wd)) && ((hour >= j.from && hour < j.to) || (j.to > 24 * 60 && hour < j.to - 24 * 60)))
    }

    /// The real date of a world minute (days since 1970-01-01).
    fn date(&self, minute: u64) -> i64 {
        self.calendar.date(WorldTime(minute))
    }

    /// The real day of the week of a world minute, Monday 0 .. Sunday 6.
    fn weekday(&self, minute: u64) -> u8 {
        holidays::weekday(self.date(minute)) as u8
    }

    pub fn person(&self, id: &str) -> Option<usize> {
        self.person.get(id).copied()
    }
}

fn hours(minute: u64) -> u32 {
    (minute % MINUTES_PER_DAY) as u32
}

fn chance(seed: u64, d: Domain, id: u64, tick: u64, per_million: u64) -> bool {
    rand_below(seed, d, id, tick, 1_000_000) < per_million
}

// ---- the plan of a day ----------------------------------------------------------------------------------------

/// Kinds of places whose people rest on the holidays that are days off (shops, offices, the school, workshops).
const SHUT_ON_HOLIDAYS: &[&str] = &["grocery", "bakery", "flowers", "post", "townhall", "library", "school", "utility", "sawmill", "workshop", "vet", "newsroom", "factory", "market", "tower", "dump", "fields", "cave", "gym", "winery", "cemetery"];
/// Kinds of places that never stop (two days off a week each, in turn).
const AROUND_THE_CLOCK: &[&str] = &["police", "fire", "hospital", "hostel", "farm", "hippodrome", "radio", "power"];
/// Long days a single person does not work whole: they take the early or the late half, week about.
const LONG_SHIFT: u32 = 10 * 60;

/// A stretch of work or school: where, and from when to when (minutes of the day; `to` past 24:00 runs into the
/// next morning).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Shift {
    pub site: usize,
    pub from: u32,
    pub to: u32,
}

impl Shift {
    fn covers(&self, minute: u32) -> bool {
        minute >= self.from && (minute < self.to || self.to > MINUTES_PER_DAY as u32)
    }
}

/// Why someone is not where their week would have them.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Absence {
    /// A week or two off, spent at home and about the town.
    Vacation,
    /// A vacation away: not in town at all.
    Away,
    /// Their own day off this week.
    DayOff,
    /// A holiday their place is shut for.
    Holiday,
}

/// Someone's plan for one day: when they get up and go to bed, their work or school, mass, a coffee on the way,
/// an errand; with the reason if they are off. Everything in it is drawn from the seed, the person and the day.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DayPlan {
    pub wake: u32,
    pub bed: u32,
    pub work: Option<Shift>,
    pub school: Option<Shift>,
    pub absence: Option<Absence>,
    pub mass: Option<(u32, u32)>,
    pub coffee: Option<(usize, u32, u32)>,
    pub errand: Option<(usize, u32, u32)>,
    /// Where the town's day takes them: a birthday party, a wedding, a funeral, the fair, the musician.
    pub visits: Vec<(usize, u32, u32)>,
    /// A storm: everyone free stays in (minutes of the day).
    pub storm: Option<(u32, u32)>,
    pub info: DayInfo,
}

fn faithful(seed: u64, i: usize, age: &str) -> bool {
    let share = match age {
        "elder" => 75,
        "child" => 50,
        _ => 45,
    };
    rand_below(seed, LIFE_PLAN, i as u64 * 64 + 1, 0, 100) < share
}

/// The plan of person `i` for world day `day`.
pub fn plan_of(world: &World, seed: u64, i: usize, day: u64) -> DayPlan {
    let p = world.people[i];
    let date = world.date(day * MINUTES_PER_DAY);
    let info = holidays::day_info(date);
    let wd = info.weekday as u8;
    let r = |k: u64, n: u64| rand_below(seed, LIFE_PLAN, i as u64 * 64 + k, day, n) as u32;
    let child = p.age == "child";
    let elder = p.age == "elder";
    // couples share the draws that keep them together (their vacation, their Sunday)
    let pair = world.partner_of(i).map_or(i, |j| j.min(i)) as u64;
    let late = (i as u32 * 7) % 31;
    let (mut wake, bed) = if child {
        (7 * 60, 20 * 60 + 30)
    } else if elder {
        (6 * 60, 21 * 60)
    } else if p.young {
        (7 * 60 + 30, 23 * 60 + 45)
    } else {
        (6 * 60 + 30, 22 * 60 + late)
    };
    wake = (wake as i32 + r(1, 31) as i32 - 15).max(5 * 60) as u32;
    let bed = (bed as i32 + r(2, 21) as i32 - 10).min(24 * 60 - 5) as u32;
    // the vacation: a week or two once a year, between May and October, for everyone who works
    let (y, _, _) = civil_from_days(date);
    let doy = (date - days_from_civil(y, 1, 1)) as u32;
    let vkey = pair * 64 + 2;
    let vstart = 125 + rand_below(seed, LIFE_PLAN, vkey, y as u64, 160) as u32;
    let vlen = if rand_below(seed, LIFE_PLAN, vkey + 1, y as u64, 3) == 0 { 14 } else { 7 };
    let away = rand_below(seed, LIFE_PLAN, vkey + 2, y as u64, 100) < 40;
    let on_vacation = p.job.is_some() && !child && (vstart..vstart + vlen).contains(&doy);
    let mut absence = on_vacation.then_some(if away { Absence::Away } else { Absence::Vacation });

    let mut work = None;
    if let (Some((site, role)), false) = (&p.job, on_vacation) {
        let s = world.site(site);
        let kind = world.sites[s].kind.as_str();
        if let Some(job) = world.sites[s].jobs.iter().find(|j| &j.role == role) {
            let h = rand_below(seed, LIFE_PLAN, i as u64 * 64 + 3, 0, 7) as u8;
            let alone = world.staff.get(&(site.as_str(), role.as_str())).copied().unwrap_or(1) <= 1;
            let today = if !job.days.is_empty() {
                job.days.contains(&wd)
            } else if role == "priest" {
                wd != 0
            } else if AROUND_THE_CLOCK.contains(&kind) && !alone {
                (wd + h) % 7 >= 2
            } else if alone {
                // the only one: the place keeps its hours all week but Sunday (round-the-clock ones too)
                wd != 6 || AROUND_THE_CLOCK.contains(&kind)
            } else {
                (wd + h) % 7 != 0
            };
            if info.holiday.is_some_and(|x| x.day_off) && SHUT_ON_HOLIDAYS.contains(&kind) {
                absence = Some(Absence::Holiday);
            } else if !today {
                absence = Some(Absence::DayOff);
            } else {
                let (mut from, mut to) = (job.from, job.to);
                let span = to - from;
                // the only one at a place keeps its whole hours (a family café); several share the long day
                let keep_whole = alone || matches!(kind, "farm" | "church" | "fields" | "hippodrome") || to > MINUTES_PER_DAY as u32;
                if span > LONG_SHIFT && !keep_whole {
                    // the early half one week, the late half the next
                    let half = span / 2 + 60;
                    if ((date.div_euclid(7) as u64) + i as u64) % 2 == 0 {
                        to = from + half;
                    } else {
                        from = to - half;
                    }
                }
                // nobody comes in on the dot: a little early or a little late, and stays on a bit
                from = (from as i32 + r(4, 26) as i32 - 20).max(0) as u32;
                to += r(5, 21);
                work = Some(Shift { site: s, from, to });
            }
        }
    }
    let school = p.school.as_ref().filter(|_| info.school && child).map(|sc| Shift { site: world.site(sc), from: 8 * 60 - 5 - r(6, 15), to: 13 * 60 + 30 + r(7, 61) });
    // a lie-in on a day off
    if work.is_none() && school.is_none() && (info.day_off || absence.is_some()) {
        wake += 45 + r(8, 46);
    }
    // up in time for work
    if let Some(w) = &work {
        if w.from < MINUTES_PER_DAY as u32 && wake + 30 > w.from {
            wake = w.from.saturating_sub(40);
        }
    }
    // Sunday mass for the faithful, and a weekday evening mass for some of the old
    let mut mass = None;
    if faithful(seed, pair as usize, &p.age) && absence != Some(Absence::Away) {
        let busy = |a: u32, b: u32| work.as_ref().is_some_and(|w| w.from < b && a < w.to);
        if wd == 6 && !busy(9 * 60 + 20, 11 * 60) {
            mass = Some((9 * 60 + 20, 11 * 60));
        } else if elder && r(9, 7) < 2 && !busy(17 * 60 + 50, 18 * 60 + 45) {
            mass = Some((17 * 60 + 50, 18 * 60 + 45));
        }
    }
    // a coffee on the way to work now and then, if the café is open by then
    let mut coffee = None;
    if let Some(w) = &work {
        if !child && r(10, 100) < 12 && w.from >= 7 * 60 + 30 {
            if let Some(c) = world.of_kind("cafe").iter().copied().find(|c| world.open(*c, w.from - 30, wd, &info)) {
                coffee = Some((c, w.from - 30, w.from - 8));
            }
        }
    } else if absence.is_none() && !info.day_off && school.is_none() && crate::tech::freelancer(seed, &p.id, &p.age, day) {
        // one who works on a laptop does it from the café, with a coffee, through the late morning
        let from = 9 * 60 + 40 + r(16, 50);
        let to = 12 * 60 + 40 + r(17, 70);
        if let Some(c) = world.of_kind("cafe").iter().copied().find(|c| world.open(*c, from, wd, &info) && world.open(*c, to, wd, &info)) {
            coffee = Some((c, from, to));
        }
    }
    // an errand: the shop, the post, the chemist's at the hospital, the flower shop, the library, the bills
    let mut errand = None;
    if !child && absence != Some(Absence::Away) && r(11, 100) < 35 {
        let (_, _, dom) = civil_from_days(date);
        let mut kinds: Vec<&str> = vec!["grocery", "grocery", "post", "hospital", "flowers", "library", "bakery"];
        if dom <= 10 {
            kinds.push("utility");
        }
        let kind = kinds[r(12, kinds.len() as u64) as usize];
        if let Some(site) = world.of_kind(kind).first().copied() {
            let at = match &work {
                Some(w) if w.to < 18 * 60 => w.to + 10 + r(13, 30),
                Some(_) => 12 * 60 + r(13, 40),
                None => 10 * 60 + r(13, 6) * 60 + r(14, 30),
            };
            if at + 35 < bed && world.open(site, at, wd, &info) && world.open(site, at + 30, wd, &info) {
                errand = Some((site, at, at + 25 + r(15, 20)));
            }
        }
    }
    let visits = if absence == Some(Absence::Away) { Vec::new() } else { town_visits(world, seed, i, day, date, &work) };
    let town = world.day_town(seed, date);
    DayPlan { wake, bed, work, school, absence, mass, coffee, errand, visits, storm: town.storm, info }
}

/// Where the day in town takes someone: a friend's or a colleague's birthday party at their home in the evening
/// (and their own, at home), a wedding (the church, then the square), a funeral at the cemetery, the visiting
/// fair, the musician on the square in the evening. Seeded by the person and the day.
fn town_visits(world: &World, seed: u64, i: usize, day: u64, date: i64, work: &Option<Shift>) -> Vec<(usize, u32, u32)> {
    let town = world.day_town(seed, date);
    let p = world.people[i];
    let mut out = Vec::new();
    let busy = |a: u32, b: u32| work.as_ref().is_some_and(|w| w.from < b && a < w.to);
    let r = |k: u64, n: u64| rand_below(seed, LIFE_PLAN, i as u64 * 64 + 40 + k, day, n) as u32;
    let colleague = |q: &ResidentDef| p.job.is_some() && q.job.as_ref().map(|j| &j.0) == p.job.as_ref().map(|j| &j.0);
    let close = |q: &ResidentDef| q.home == p.home || p.partner.as_deref() == Some(q.id.as_str()) || colleague(q) || crate::town::friends(seed, &p.id, &q.id);
    // birthdays: one's own party at home; a friend's at theirs
    if town.birthdays.iter().any(|b| b == &p.id) {
        out.push((world.site(&p.home), 17 * 60 + 30, 21 * 60 + 30));
    } else if let Some(host) = town.birthdays.iter().filter_map(|b| world.person(b)).map(|h| world.people[h]).find(|q| q.home != p.home && close(q)) {
        if !busy(18 * 60, 20 * 60) {
            out.push((world.site(&host.home), 18 * 60 + 15 + r(1, 20), 20 * 60 + 30 + r(2, 30)));
        }
    }
    let square = world.of_kind("square").first().copied();
    let church = world.of_kind("church").first().copied();
    // a wedding: the couple and those close to them at the church, then everyone on the square
    if let (Some((a, b)), Some(sq)) = (&town.wedding, square) {
        let couple = p.id == *a || p.id == *b;
        let near = [a, b].iter().filter_map(|id| world.person(id)).any(|j| close(world.people[j]));
        if couple || near {
            if let Some(ch) = church {
                out.push((ch, 13 * 60 + 30, 14 * 60 + 30));
            }
            out.push((sq, 14 * 60 + 30, if couple { 19 * 60 } else { 18 * 60 + r(3, 40) }));
        } else if p.age != "child" && !busy(15 * 60, 17 * 60) && r(4, 100) < 25 {
            out.push((sq, 15 * 60 + r(5, 30), 17 * 60 + r(6, 40)));
        }
    }
    // a funeral: the family and friends of who passed away, and some of the old
    if let (Some(gone), Some(cem)) = (&town.funeral, world.of_kind("cemetery").first().copied()) {
        let theirs = world.content.residents.get(gone);
        let family = theirs.is_some_and(|g| g.home == p.home || g.partner.as_deref() == Some(p.id.as_str()));
        let friend = crate::town::friends(seed, &p.id, gone);
        if (family || friend || (p.age == "elder" && r(7, 100) < 20)) && !busy(10 * 60 + 45, 12 * 60 + 15) && p.age != "child" {
            out.push((cem, 10 * 60 + 45, 12 * 60 + 15));
        }
    }
    // the visiting fair and the musician on the square
    if let Some(sq) = square {
        if town.fair && r(8, 100) < 35 {
            let from = 11 * 60 + r(9, 6) * 30;
            if !busy(from, from + 150) {
                out.push((sq, from, from + 120 + r(10, 60)));
            }
        }
        if town.musician && p.age != "child" && r(11, 100) < 20 && !busy(18 * 60, 19 * 60 + 30) {
            out.push((sq, 18 * 60 + r(12, 20), 19 * 60 + 20));
        }
    }
    // a pair courting (or sweethearts) go out together some evenings: the same place, the same hours
    if let Some(other) = crate::feelings::evening_out(seed, world.calendar.first_day, &world.people, &p.id, date) {
        let (x, y) = (p.id.as_str().min(other.as_str()), p.id.as_str().max(other.as_str()));
        let key = crate::npc::stream_of(x) ^ (crate::npc::stream_of(y) << 1);
        let shared = |k: u64, n: u64| rand_below(seed, LIFE_PLAN, key ^ (k << 40), day, n) as u32;
        let info = holidays::day_info(date);
        let mut spots: Vec<usize> = ["park", "square", "playground"].iter().filter_map(|k| world.of_kind(k).first().copied()).collect();
        spots.extend(world.of_kind("cafe").iter().copied().filter(|c| world.open(*c, 19 * 60, info.weekday as u8, &info)));
        let from = 18 * 60 + 45 + shared(1, 4) * 10;
        let to = from + 90 + shared(2, 4) * 10;
        if !spots.is_empty() && !busy(from, to) && out.iter().all(|(_, a, b)| *b <= from || *a >= to) {
            out.push((spots[shared(3, spots.len() as u64) as usize], from, to));
        }
    }
    out
}

impl Life {
    /// The settlement as it is at the start of a day: everyone at home, a stocked pantry in every home, shops
    /// full. The life of the days after it follows from the seed alone.
    pub fn new(world: &World, start: u64) -> Life {
        let agents = world
            .people
            .iter()
            .map(|p| {
                let home = world.site(&p.home);
                Agent { site: home, from: home, since: start * TICK, activity: Activity::Sleep, hunger: 20, money: 60, mood: 0, sick_until: 0, sick_since: 0, hurt_until: 0, held_until: 0, paid_day: 0, pension_day: 0 }
            })
            .collect();
        let sites = world.sites.iter().map(|s| Site { stock: i64::from(s.stock), cash: 0, fire: 0, damage: 0, restock_due: 0, pantry: if s.kind == "home" { 8 } else { 0 } }).collect();
        Life { start, tick: start, agents, sites, trips: Vec::new(), incidents: Vec::new(), cases: Vec::new(), plans: Vec::new(), yesterday: Vec::new(), plan_day: None }
    }

    pub fn tick(&self) -> u64 {
        self.tick
    }

    /// The tick the simulation began at.
    pub fn start(&self) -> u64 {
        self.start
    }

    /// Runs the simulation up to (and including) the tick of `now`.
    pub fn advance(&mut self, seed: u64, world: &World, now: WorldTime) {
        let target = now.0 / TICK;
        while self.tick < target {
            self.tick += 1;
            self.step(seed, world);
        }
    }

    fn note(&mut self, kind: IncidentKind, site: usize, who: &[usize], world: &World) {
        let minute = self.tick * TICK;
        self.incidents.push(Incident { minute, kind, site: world.sites[site].id.clone(), who: who.iter().map(|i| world.people[*i].id.clone()).collect() });
    }

    fn travel(&mut self, kind: Vehicle, from: usize, to: usize, minutes: u64, world: &World) {
        let depart = self.tick * TICK;
        self.trips.push(Trip { kind, from: world.sites[from].id.clone(), to: world.sites[to].id.clone(), depart, arrive: depart + minutes });
    }

    fn step(&mut self, seed: u64, world: &World) {
        let t = self.tick;
        let minute = t * TICK;
        let hour = hours(minute);
        let day = minute / MINUTES_PER_DAY;
        let season = world.calendar.season(WorldTime(minute));
        // forget what is long past
        let keep_from = minute.saturating_sub(KEEP_DAYS * MINUTES_PER_DAY);
        self.incidents.retain(|i| i.minute >= keep_from);
        self.trips.retain(|tr| tr.arrive + 60 >= minute);

        if self.plan_day != Some(day) {
            let n = world.people.len();
            self.yesterday = if self.plan_day == Some(day.wrapping_sub(1)) && !self.plans.is_empty() {
                std::mem::take(&mut self.plans)
            } else {
                (0..n).map(|i| plan_of(world, seed, i, day.saturating_sub(1))).collect()
            };
            self.plans = (0..n).map(|i| plan_of(world, seed, i, day)).collect();
            self.plan_day = Some(day);
        }
        self.sites_step(seed, world, t, minute, hour, season);

        let burning: Vec<usize> = (0..self.sites.len()).filter(|i| self.sites[*i].fire > 0).collect();
        for i in 0..self.agents.len() {
            let p = world.people[i];
            let (target, activity) = self.choose(seed, world, i, t, minute, hour, day, &burning);
            let a = &mut self.agents[i];
            if target != a.site {
                a.from = a.site;
                a.site = target;
                a.since = minute;
            }
            a.activity = activity;
            a.hunger = (a.hunger + 1).min(100);
            if activity == Activity::Sleep {
                a.hunger = a.hunger.saturating_sub(1);
            }
            // wages at the end of a working day (not on days off, not when ill or held); pensions in the morning
            let job = p.job.as_ref().and_then(|(s, r)| world.sites[world.site(s)].jobs.iter().find(|j| &j.role == r));
            if let Some(job) = job {
                let worked = self.plans[i].work.is_some();
                if hour == 18 * 60 && a.paid_day != day && worked && a.sick_until <= t && a.held_until <= t {
                    a.paid_day = day;
                    a.money += i64::from(job.wage);
                }
            }
            if p.age == "elder" && hour == 9 * 60 && a.pension_day != day {
                a.pension_day = day;
                a.money += 15;
            }
            self.act(seed, world, i, t);
        }
        self.police_step(seed, world, t);
    }

    /// Where someone goes now, and why.
    #[allow(clippy::too_many_arguments)]
    fn choose(&self, seed: u64, world: &World, i: usize, t: u64, minute: u64, hour: u32, day: u64, burning: &[usize]) -> (usize, Activity) {
        let p = world.people[i];
        let a = &self.agents[i];
        let home = world.site(&p.home);
        let hospital = world.of_kind("hospital").first().copied();
        let police = world.of_kind("police").first().copied();
        if self.plans.get(i).is_some_and(|pl| pl.absence == Some(Absence::Away)) {
            return (home, Activity::Away);
        }
        if a.held_until > t {
            return (police.unwrap_or(home), Activity::Arrested);
        }
        if a.hurt_until > t {
            return (hospital.unwrap_or(home), Activity::Injured);
        }
        // the ill stay in bed at home; a grown-up sees the doctor on the morning they fall ill
        if a.sick_until > t {
            let first_day = a.sick_since / TICKS_PER_DAY == t / TICKS_PER_DAY;
            let clinic = first_day && p.age != "child" && (9 * 60..10 * 60 + 30).contains(&hour);
            return (if clinic { hospital.unwrap_or(home) } else { home }, Activity::Sick);
        }
        let child = p.age == "child";
        let elder = p.age == "elder";
        let plan = &self.plans[i];
        let info = &plan.info;
        let wd = info.weekday as u8;
        let _ = day;
        // work comes first (yesterday's night shift runs on into the morning): a fire calls the firefighters out,
        // a case the police
        let overnight = self.yesterday.get(i).and_then(|y| y.work.as_ref()).filter(|w| w.to > MINUTES_PER_DAY as u32 && hour < w.to - MINUTES_PER_DAY as u32);
        let shift = overnight.or(plan.work.as_ref().filter(|w| w.covers(hour)));
        if let (Some(w), Some((_, role))) = (shift, &p.job) {
            let s = w.site;
            // crews spread over the fires, officers over the open cases
            if world.sites[s].kind == "fire" && !burning.is_empty() {
                return (burning[i % burning.len()], Activity::Firefight);
            }
            if world.sites[s].kind == "police" && !self.cases.is_empty() {
                return (self.cases[i % self.cases.len()].1, Activity::Patrol);
            }
            // the postman goes round the houses of the village in the morning, a door every twenty minutes, in
            // another order every day, then sorts the post at the office
            if role == "postman" && (7 * 60 + 30..11 * 60).contains(&hour) {
                let round: Vec<usize> = world.of_kind("home").iter().copied().filter(|h| world.sites[*h].id.starts_with("home_")).collect();
                if !round.is_empty() {
                    let k = u64::from((hour - 7 * 60 - 30) / 20);
                    let start = rand_below(seed, LIFE, 991, day, round.len() as u64);
                    return (round[((start + k * 7) % round.len() as u64) as usize], Activity::Work);
                }
            }
            // the utility inspector reads the meters: a house every half hour, late in the morning
            if role == "utility_inspector" && (10 * 60..13 * 60).contains(&hour) {
                let round: Vec<usize> = world.of_kind("home").iter().copied().filter(|h| world.sites[*h].id.starts_with("home_")).collect();
                if !round.is_empty() {
                    let k = u64::from((hour - 10 * 60) / 30);
                    let start = rand_below(seed, LIFE, 997, day, round.len() as u64);
                    return (round[((start + k * 5) % round.len() as u64) as usize], Activity::Work);
                }
            }
            // the priest walks over to the cemetery chapel in the afternoon
            if role == "priest" && (15 * 60..16 * 60).contains(&hour) {
                if let Some(c) = world.of_kind("cemetery").first() {
                    return (*c, Activity::Work);
                }
            }
            // the paper's people go out three times a day to wherever someone is, and ask them questions
            if world.sites[s].kind == "newsroom" && role != "editor" {
                if let Some(place) = self.interview_place(seed, world, i, t, hour) {
                    return (place, Activity::Interview);
                }
            }
            return (s, Activity::Work);
        }
        // after a night shift, sleep by day
        if let Some(y) = self.yesterday.get(i).and_then(|y| y.work.as_ref()).filter(|w| w.to > MINUTES_PER_DAY as u32) {
            let end = y.to - MINUTES_PER_DAY as u32;
            if hour >= end && hour < end + 7 * 60 {
                return (home, Activity::Sleep);
            }
        }
        if hour < plan.wake || hour >= plan.bed {
            return (home, Activity::Sleep);
        }
        if let Some(sc) = &plan.school {
            if sc.covers(hour) {
                return (sc.site, Activity::School);
            }
        }
        if let Some((cafe, a, b)) = plan.coffee {
            if (a..b).contains(&hour) {
                return (cafe, Activity::Eat);
            }
        }
        if let Some((a, b)) = plan.mass {
            if (a..b).contains(&hour) {
                if let Some(church) = world.of_kind("church").first() {
                    return (*church, Activity::Leisure);
                }
            }
        }
        if let Some((site, a, b)) = plan.errand {
            if (a..b).contains(&hour) && self.sites[site].fire == 0 {
                return (site, Activity::Shop);
            }
        }
        for (site, a, b) in &plan.visits {
            if (*a..*b).contains(&hour) && self.sites[*site].fire == 0 {
                return (*site, Activity::Leisure);
            }
        }
        // meals: at home if there is food, otherwise a shop or the café
        let mealtime = matches!(hour, 450..=480 | 750..=780 | 1110..=1140);
        let pantry = self.sites[home].pantry;
        let open = (7 * 60..21 * 60).contains(&hour);
        if a.hunger > 70 || (mealtime && a.hunger > 40) {
            if pantry > 0 {
                return (home, Activity::Eat);
            }
            if let Some(cafe) = world.of_kind("cafe").first() {
                if a.money >= 12 && !child && rand_below(seed, LIFE, i as u64 * 7 + 1, t / 6, 3) == 0 {
                    return (*cafe, Activity::Eat);
                }
            }
            let shops: Vec<usize> = world.of_kind("grocery").iter().chain(world.of_kind("bakery")).copied().filter(|s| self.sites[*s].fire == 0).collect();
            if !shops.is_empty() && !child && open {
                return (shops[rand_below(seed, LIFE, i as u64 * 7 + 2, day, shops.len() as u64) as usize], Activity::Shop);
            }
            return (home, Activity::Home);
        }
        // an adult of the house goes for groceries when the pantry runs low
        if !child && open && pantry < 4 && rand_below(seed, LIFE, i as u64 * 7 + 13, t / 3, 4) == 0 {
            let shops: Vec<usize> = world.of_kind("grocery").iter().chain(world.of_kind("bakery")).copied().filter(|s| self.sites[*s].fire == 0).collect();
            if !shops.is_empty() {
                return (shops[rand_below(seed, LIFE, i as u64 * 7 + 14, day, shops.len() as u64) as usize], Activity::Shop);
            }
        }
        // a storm: whoever is free stays in
        if plan.storm.is_some_and(|(a, b)| (a..b).contains(&hour)) {
            return (home, Activity::Home);
        }
        // free time: somewhere to be, chosen anew every hour; sociable people go out more, and less in rain.
        // The evening belongs to the young and to sweethearts; everyone else heads home after an early walk.
        let partner = world.partner_of(i);
        // young parents with a baby in the pram are home early like everyone else
        let baby = p.pram || partner.is_some_and(|j| world.people[j].pram);
        let sweethearts = !baby && (p.young || partner.is_some_and(|j| world.people[j].young));
        let curfew = if child {
            20 * 60
        } else if elder {
            19 * 60 + 30
        } else if sweethearts {
            24 * 60
        } else if partner.is_some() {
            21 * 60 + 30
        } else {
            20 * 60 + 30
        };
        // a festive day keeps the town out an hour longer
        let festive = info.holiday.is_some_and(|h| h.festive);
        // (not for a baby in a pram: they are home at the usual hour)
        let curfew = if festive && !baby { (curfew + 60).min(24 * 60) } else { curfew };
        if hour >= curfew {
            return (home, Activity::Home);
        }
        // a couple decides together: the same draws, so they go to the same place at the same time
        let who = partner.map_or(i, |j| j.min(i)) as u64;
        let social = partner.map_or(p.social, |j| p.social.max(world.people[j].social));
        let block = t / 6;
        let sky = crate::daily::weather_at(seed, WorldTime(minute), world.calendar.season(WorldTime(minute)));
        let wet = matches!(sky, crate::daily::Sky::Rain | crate::daily::Sky::Storm);
        let snow = matches!(sky, crate::daily::Sky::Snow);
        let keen = (u64::from(social.clamp(20, 90)) + if festive { 30 } else { 0 }).min(95) / if wet { 3 } else { 1 };
        let out = rand_below(seed, LIFE, who * 7 + 3, block, 100) < keen;
        if !out {
            return (home, Activity::Home);
        }
        // a holiday by day: most who go out go to the square, where the fair and the music are
        if festive && !wet && (11 * 60..20 * 60).contains(&hour) && rand_below(seed, LIFE, who * 7 + 5, block, 100) < 60 {
            if let Some(sq) = world.of_kind("square").first() {
                return (*sq, Activity::Leisure);
            }
        }
        let night = hour >= 20 * 60 + 30;
        let wheelchair = p.mobility.as_deref() == Some("wheelchair");
        let can = |s: &usize| self.sites[*s].fire == 0 && world.open(*s, hour, wd, info);
        let mut options: Vec<usize> = Vec::new();
        // in the rain under a roof; otherwise the park, the square, the market…
        let kinds: &[&str] = if wet {
            &["cafe", "library", "gym", "cafe"]
        } else if night {
            &["park", "square", "cafe"]
        } else {
            &["park", "square", "market", "library", "cafe", "flowers"]
        };
        for k in kinds {
            options.extend(world.of_kind(k).iter().copied().filter(can));
        }
        // a holiday: the square, the church and the park fill up
        if festive && !wet {
            for _ in 0..3 {
                options.extend(world.of_kind("square").iter().copied());
            }
            options.extend(world.of_kind("park").iter().copied());
            if (9 * 60..13 * 60).contains(&hour) {
                options.extend(world.of_kind("church").iter().copied());
            }
        }
        if child && snow {
            // snow: sledges in the park, snowmen on the playground
            for _ in 0..3 {
                options.extend(world.of_kind("park").iter().copied());
                options.extend(world.of_kind("playground").iter().copied());
            }
        }
        if child && !wet {
            // children run to the playground most of all
            for _ in 0..3 {
                options.extend(world.of_kind("playground").iter().copied());
            }
            options.extend(world.of_kind("park").iter().copied());
            options.extend(world.of_kind("school").iter().copied().filter(can));
        }
        if elder {
            options.extend(world.of_kind("square").iter().copied());
        }
        // the graves of one's own, by day; mass at the church in the morning and the evening, and on Sunday
        if !child && (9 * 60..17 * 60).contains(&hour) {
            options.extend(world.of_kind("cemetery").iter().copied());
            if elder {
                options.extend(world.of_kind("cemetery").iter().copied());
            }
        }
        // the races: the town goes on days off, the young also after work
        if (11 * 60..18 * 60).contains(&hour) && (wd >= 5 || (p.young && hour >= 15 * 60)) {
            options.extend(world.of_kind("hippodrome").iter().copied());
        }
        if (8 * 60..19 * 60).contains(&hour) && !child && !wheelchair {
            options.extend(world.of_kind("forest").iter().copied());
        }
        if options.is_empty() {
            return (home, Activity::Home);
        }
        (options[rand_below(seed, LIFE, who * 7 + 4, block, options.len() as u64) as usize], Activity::Leisure)
    }

    /// What someone does at the site they are at this tick: eat, buy, steal, quarrel, fall ill.
    /// Where a journalist goes to interview someone now: in the first part of the hours they go out, a place
    /// (not a home) where others are about; the same place for the whole outing.
    fn interview_place(&self, seed: u64, world: &World, i: usize, t: u64, hour: u32) -> Option<usize> {
        let out = [10 * 60, 13 * 60, 16 * 60].iter().any(|h| (*h..*h + 50).contains(&hour)) || (world.people[i].job.as_ref().is_some_and(|(_, r)| r == "photographer") && (11 * 60..11 * 60 + 50).contains(&hour));
        if !out {
            return None;
        }
        let outing = t / 6;
        let mut places: Vec<usize> = self
            .agents
            .iter()
            .enumerate()
            .filter(|(j, a)| *j != i && a.site != world.site(&world.people[*j].home) && !matches!(a.activity, Activity::Sleep | Activity::Interview | Activity::Arrested))
            .map(|(_, a)| a.site)
            .filter(|s| world.sites[*s].kind != "newsroom" && world.sites[*s].kind != "home")
            .collect();
        places.sort_unstable();
        places.dedup();
        if places.is_empty() {
            return None;
        }
        // keep to the place chosen at the start of the outing, if anyone is still there
        let pick = rand_below(seed, LIFE, i as u64 * 13 + 77, outing, places.len() as u64) as usize;
        Some(places[pick])
    }

    fn act(&mut self, seed: u64, world: &World, i: usize, t: u64) {
        let p = world.people[i];
        let id = i as u64;
        let site = self.agents[i].site;
        let kind = world.sites[site].kind.as_str();
        let activity = self.agents[i].activity;
        let home = world.site(&p.home);
        // a journalist who has come to a place asks someone there a few questions, once an outing
        if activity == Activity::Interview && t % 6 == 2 {
            let mut there: Vec<usize> = (0..self.agents.len()).filter(|&j| j != i && self.agents[j].site == site && !matches!(self.agents[j].activity, Activity::Sleep | Activity::Interview)).collect();
            there.sort_unstable();
            if !there.is_empty() {
                let j = there[rand_below(seed, LIFE, id * 13 + 91, t, there.len() as u64) as usize];
                self.agents[j].mood += 1;
                self.incidents.push(Incident { minute: t * TICK, kind: IncidentKind::Interview, site: world.sites[site].id.clone(), who: vec![p.id.clone(), world.people[j].id.clone()] });
            }
        }
        if activity == Activity::Eat && site == home && self.sites[home].pantry > 0 {
            self.sites[home].pantry -= 1;
            let a = &mut self.agents[i];
            a.hunger = a.hunger.saturating_sub(55);
        } else if activity == Activity::Eat && kind == "cafe" {
            let price = i64::from(world.sites[site].price.max(10));
            if self.agents[i].money >= price {
                self.agents[i].money -= price;
                self.agents[i].hunger = self.agents[i].hunger.saturating_sub(50);
                self.agents[i].mood += 2;
                self.sites[site].cash += price;
            }
        } else if activity == Activity::Shop && (kind == "grocery" || kind == "bakery") {
            let price = i64::from(world.sites[site].price.max(4)) * 3;
            let stock = self.sites[site].stock;
            // some are tempted to take what is not theirs, more so when money runs low
            let dishonest = p.honesty < 35;
            let tempted = dishonest && chance(seed, LIFE, id * 7 + 12, t, if self.agents[i].money < 40 { 60_000 } else { 15_000 });
            if tempted && stock >= 2 {
                self.steal(seed, world, i, site, t);
            } else if stock >= 3 && self.agents[i].money >= price {
                self.agents[i].money -= price;
                self.sites[home].pantry += 4;
                self.sites[site].stock -= 3;
                self.sites[site].cash += price;
            } else if dishonest && stock >= 2 && chance(seed, LIFE, id * 7 + 5, t, 60_000) {
                self.steal(seed, world, i, site, t);
            }
        }
        self.meet_and_fare(seed, world, i, t);
    }

    fn steal(&mut self, seed: u64, world: &World, i: usize, site: usize, t: u64) {
        let id = i as u64;
        let home = world.site(&world.people[i].home);
        self.sites[home].pantry += 2;
        self.sites[site].stock -= 2;
        self.note(IncidentKind::Theft, site, &[i], world);
        // someone else in the shop may have seen it, or the shopkeeper notices later
        let seen = (0..self.agents.len()).any(|j| j != i && self.agents[j].site == site && rand_below(seed, LIFE, j as u64 * 7 + 6, t, 2) == 0);
        if seen || chance(seed, LIFE, id * 7 + 7, t, 300_000) {
            self.cases.push((i, site, t, true));
            if let Some(police) = world.of_kind("police").first() {
                self.travel(Vehicle::Police, *police, site, 15, world);
            }
        }
    }

    /// The rest of someone's tick: quarrels, illness, company.
    fn meet_and_fare(&mut self, seed: u64, world: &World, i: usize, t: u64) {
        let p = world.people[i];
        let id = i as u64;
        let site = self.agents[i].site;
        let activity = self.agents[i].activity;
        // two hot heads in one place may come to blows
        if activity == Activity::Leisure && p.temper > 70 {
            if let Some(j) = (0..self.agents.len()).find(|j| *j != i && self.agents[*j].site == site && self.agents[*j].activity == Activity::Leisure && world.people[*j].temper > 60) {
                if chance(seed, LIFE, id * 7 + 8, t, 500) {
                    self.note(IncidentKind::Fight, site, &[i, j], world);
                    for k in [i, j] {
                        self.agents[k].hurt_until = t + 6 + rand_below(seed, LIFE, k as u64 * 7 + 9, t, 12);
                        self.agents[k].mood -= 10;
                    }
                    if let Some(h) = world.of_kind("hospital").first() {
                        self.travel(Vehicle::Ambulance, *h, site, 12, world);
                    }
                    self.cases.push((i, site, t, false));
                }
            }
        }
        // illness: more often for the old and the young, more in winter
        let winter = world.calendar.season(WorldTime(t * TICK)) == Season::Winter;
        let base = match p.age.as_str() {
            "elder" => 260,
            "child" => 160,
            _ => 90,
        } * if winter { 3 } else { 1 };
        if self.agents[i].sick_until <= t && self.agents[i].hurt_until <= t && chance(seed, LIFE, id * 7 + 10, t, base) {
            self.agents[i].sick_until = t + 12 + rand_below(seed, LIFE, id * 7 + 11, t, 60);
            self.agents[i].sick_since = t;
            self.note(IncidentKind::Ill, site, &[i], world);
        }
        if self.agents[i].sick_until == t + 1 {
            self.note(IncidentKind::Healed, world.site(&p.home), &[i], world);
        }
        // company lifts the mood
        if activity == Activity::Leisure && (0..self.agents.len()).any(|j| j != i && self.agents[j].site == site) {
            self.agents[i].mood = (self.agents[i].mood + 1).min(50);
        }
    }

    fn sites_step(&mut self, seed: u64, world: &World, t: u64, minute: u64, hour: u32, season: Season) {
        let day = minute / MINUTES_PER_DAY;
        for s in 0..self.sites.len() {
            let def = world.sites[s];
            // fires: rare; the sawmill and bakery are likelier, homes more in winter (stoves)
            if def.building.is_some() && self.sites[s].fire == 0 && self.sites[s].damage == 0 {
                let per = match def.kind.as_str() {
                    "sawmill" => 90,
                    "bakery" => 60,
                    "home" if season == Season::Winter => 30,
                    "home" => 12,
                    _ => 6,
                };
                if chance(seed, LIFE_SITE, s as u64, t, per) {
                    self.sites[s].fire = 1;
                    self.note(IncidentKind::Fire, s, &[], world);
                    if let Some(fs) = world.of_kind("fire").first() {
                        self.travel(Vehicle::FireTruck, *fs, s, 10, world);
                    }
                }
            } else if self.sites[s].fire > 0 {
                // firefighters work once they have got there (the drive takes a while)
                let fighters = self.agents.iter().filter(|a| a.site == s && a.activity == Activity::Firefight && minute >= a.since + 20).count() as u32;
                let site = &mut self.sites[s];
                site.damage = (site.damage + site.fire).min(100);
                if fighters > 0 {
                    // every other tick a crew of two knocks it down a step
                    site.fire = site.fire.saturating_sub(fighters.div_ceil(2) * u32::from(t % 2 == 0));
                    if site.fire == 0 {
                        let who: Vec<usize> = (0..self.agents.len()).filter(|a| self.agents[*a].site == s && self.agents[*a].activity == Activity::Firefight).collect();
                        self.note(IncidentKind::FireOut, s, &who, world);
                        if let Some(saw) = world.of_kind("sawmill").first() {
                            self.travel(Vehicle::Cart, *saw, s, 40, world);
                        }
                    }
                } else {
                    site.fire = (site.fire + 1).min(12);
                }
            }
            // repairs, a little every hour once the fire is out
            if self.sites[s].fire == 0 && self.sites[s].damage > 0 && hour % 60 == 0 {
                self.sites[s].damage -= 1;
            }
            // shops are restocked by cart in the early morning when they run low
            if (def.kind == "grocery" || def.kind == "bakery" || def.kind == "market") && hour == 6 * 60 && self.sites[s].stock < i64::from(def.stock) / 2 && self.sites[s].restock_due != day {
                self.sites[s].restock_due = day;
                self.sites[s].stock += i64::from(def.stock);
                let from = world.of_kind("farm").first().copied().unwrap_or(s);
                self.travel(Vehicle::Cart, from, s, 50, world);
                self.note(IncidentKind::Delivery, s, &[], world);
            }
        }
        // the sawmill sends timber to the village every working morning; the police car does its rounds
        if hour == 7 * 60 && world.weekday(minute) < 5 {
            if let (Some(saw), Some(market)) = (world.of_kind("sawmill").first(), world.of_kind("market").first().or(world.of_kind("square").first())) {
                self.travel(Vehicle::Cart, *saw, *market, 60, world);
            }
        }
        if hour == 10 * 60 || hour == 16 * 60 {
            if let (Some(p), Some(sq)) = (world.of_kind("police").first(), world.of_kind("square").first()) {
                self.travel(Vehicle::Police, *p, *sq, 20, world);
            }
        }
        if hour == 8 * 60 + 30 {
            if let (Some(h), Some(sq)) = (world.of_kind("hospital").first(), world.of_kind("square").first()) {
                let _ = seed;
                self.travel(Vehicle::Car, *h, *sq, 25, world);
            }
        }
        // the garbage truck goes round the village twice on working days
        if (hour == 7 * 60 + 30 || hour == 13 * 60 + 30) && world.weekday(minute) < 6 {
            if let Some(dump) = world.of_kind("dump").first() {
                let stops: Vec<usize> = ["square", "school", "grocery", "playground", "market", "hospital"].iter().flat_map(|k| world.of_kind(k).iter().copied()).collect();
                if !stops.is_empty() {
                    let stop = stops[((day * 2 + u64::from(hour > 12 * 60)) % stops.len() as u64) as usize];
                    self.travel(Vehicle::Garbage, *dump, stop, 45, world);
                }
            }
        }
        // a party in the square on summer Saturday evenings
        if hour == 19 * 60 && world.weekday(minute) == 5 && season == Season::Summer {
            if let Some(sq) = world.of_kind("square").first() {
                self.note(IncidentKind::Party, *sq, &[], world);
            }
        }
    }

    fn police_step(&mut self, seed: u64, world: &World, t: u64) {
        let mut closed = Vec::new();
        for (n, (who, site, opened, theft)) in self.cases.iter().enumerate() {
            let officers = self.agents.iter().filter(|a| a.site == *site && a.activity == Activity::Patrol).count();
            if officers > 0 && chance(seed, LIFE, 10_000 + n as u64, t, 150_000) {
                closed.push((n, *who, *site, true, *theft));
            } else if t > opened + 3 * TICKS_PER_DAY {
                closed.push((n, *who, *site, false, *theft));
            }
        }
        for (n, who, site, caught, theft) in closed.into_iter().rev() {
            self.cases.remove(n);
            if caught {
                let a = &mut self.agents[who];
                a.held_until = t + 18;
                a.money = (a.money - 30).max(-100);
                a.mood -= 15;
                self.sites[site].cash += 30;
                self.note(if theft { IncidentKind::Caught } else { IncidentKind::Detained }, site, &[who], world);
            }
        }
    }

    pub fn view(&self, world: &World, now: WorldTime) -> LifeView {
        let minute = now.0;
        LifeView {
            dump: 0,
            residents: self
                .agents
                .iter()
                .enumerate()
                .map(|(i, a)| {
                    let p = world.people[i];
                    ResidentView {
                        id: p.id.clone(),
                        name: p.name.clone(),
                        gender: p.gender.clone(),
                        age: p.age.clone(),
                        site: world.sites[a.site].id.clone(),
                        from: world.sites[a.from].id.clone(),
                        since: a.since,
                        activity: a.activity,
                        mood: a.mood,
                        young: p.young,
                        pram: p.pram,
                    }
                })
                .collect(),
            sites: self
                .sites
                .iter()
                .enumerate()
                .filter(|(_, s)| s.fire > 0 || s.damage > 0)
                .map(|(i, s)| SiteView { id: world.sites[i].id.clone(), fire: s.fire, damage: s.damage, stock: s.stock })
                .collect(),
            trips: self.trips.iter().filter(|tr| tr.depart <= minute && tr.arrive + 30 >= minute).cloned().collect(),
            incidents: self.incidents.clone(),
            news: Vec::new(),
        }
    }
}

// ---- the day and someone's plan, told -----------------------------------------------------------------------

/// Today in the real year: the day of the week, the date, the holiday if any.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct DayView {
    pub weekday: String,
    /// The weekday by id, the same in every language: monday … sunday.
    pub weekday_id: String,
    pub date: String,
    pub holiday: Option<String>,
    pub day_off: bool,
    pub school: bool,
    pub festive: bool,
    /// Today's holiday by id (for the client's choices), and tomorrow's (its eve is tonight).
    pub holiday_id: Option<String>,
    pub tomorrow: Option<String>,
    /// An equinox or a solstice: the rifts are open all day.
    pub rift: bool,
    /// The moon is full tonight.
    pub full_moon: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct ScheduleItem {
    /// Minutes of the day (`to` past 24:00 runs into the next morning).
    pub from: u32,
    pub to: u32,
    pub site: String,
    pub place: String,
    /// sleep, work, school, coffee, mass, errand, evening
    pub what: String,
}

/// Someone's day as a plan: what they do when, why they are off, and the same told in a line.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct ScheduleView {
    pub id: String,
    pub day: DayView,
    /// vacation, away, day_off, holiday
    pub absence: Option<String>,
    /// Their work (or school) has them at it at this minute.
    pub working_now: bool,
    pub items: Vec<ScheduleItem>,
    pub text: String,
}

const WEEKDAYS: [&str; 7] = ["понеділок", "вівторок", "середа", "четвер", "пʼятниця", "субота", "неділя"];
const MONTHS: [&str; 12] = ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"];

const WEEKDAY_IDS: [&str; 7] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const WEEKDAYS_EN: [&str; 7] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS_EN: [&str; 12] = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

pub fn day_view(calendar: Calendar, now: WorldTime, l: crate::content::Lang) -> DayView {
    let date = calendar.date(now);
    let info = holidays::day_info(date).in_lang(l);
    let (_, m, d) = civil_from_days(date);
    let w = info.weekday as usize;
    DayView {
        weekday: l.pick(WEEKDAYS[w], WEEKDAYS_EN[w]).to_string(),
        weekday_id: WEEKDAY_IDS[w].to_string(),
        date: if l.en() { format!("{} {d}", MONTHS_EN[(m - 1) as usize]) } else { format!("{d} {}", MONTHS[(m - 1) as usize]) },
        holiday: info.holiday.map(|h| h.name.to_string()),
        day_off: info.day_off,
        school: info.school,
        festive: info.holiday.is_some_and(|h| h.festive),
        holiday_id: info.holiday.map(|h| h.id.to_string()),
        tomorrow: holidays::holiday(date + 1).map(|h| h.id.to_string()),
        rift: info.rift,
        full_moon: info.full_moon,
    }
}

fn clock(minute: u32) -> String {
    let m = minute % MINUTES_PER_DAY as u32;
    format!("{}:{:02}", m / 60, m % 60)
}

/// A place's name as it reads in the middle of a sentence ("Пошта «Липове»" → "пошта «Липове»").
fn lower_first(name: &str) -> String {
    let mut c = name.chars();
    match c.next() {
        Some(f) => f.to_lowercase().collect::<String>() + c.as_str(),
        None => String::new(),
    }
}

/// The plan of a resident for the day of `now`, as a view (`None` for someone unknown).
pub fn schedule_view(world: &World, seed: u64, id: &str, now: WorldTime, l: crate::content::Lang) -> Option<ScheduleView> {
    let i = world.person(id)?;
    let p = world.people[i];
    let day = now.day();
    let plan = plan_of(world, seed, i, day);
    let yesterday = plan_of(world, seed, i, day.saturating_sub(1));
    let minute = (now.0 % MINUTES_PER_DAY) as u32;
    let name = |s: usize| if l.en() { world.sites[s].name.clone() } else { lower_first(&world.sites[s].name) };
    let female = p.gender == "f";
    let mut items = vec![ScheduleItem { from: 0, to: plan.wake, site: p.home.clone(), place: name(world.site(&p.home)), what: "sleep".into() }];
    let mut parts: Vec<String> = Vec::new();
    match plan.absence {
        Some(Absence::Away) if l.en() => parts.push("on holiday, away from Lypove".into()),
        Some(Absence::Away) => parts.push(format!("у відпустці, {} з Липового", if female { "поїхала" } else { "поїхав" })),
        Some(Absence::Vacation) => parts.push(l.pick("відпустка — вдома й на прогулянках", "time off — at home and out on walks").into()),
        Some(Absence::Holiday) => {
            let feast = plan.info.holiday.map(|h| format!(" ({})", holidays::name_in(h.id, l))).unwrap_or_default();
            let shut = p.job.as_ref().map(|(s, _)| name(world.site(s))).unwrap_or_default();
            parts.push(if l.en() { format!("a holiday{feast}, {shut} is closed") } else { format!("свято{feast}, {shut} зачинено") })
        }
        Some(Absence::DayOff) => parts.push(l.pick("вихідний", "a day off").into()),
        None => {}
    }
    if let Some((c, a, b)) = plan.coffee {
        items.push(ScheduleItem { from: a, to: b, site: world.sites[c].id.clone(), place: name(c), what: "coffee".into() });
        let cafe = world.sites[c].name.trim_matches(|ch| ch == '«' || ch == '»' || ch == '“' || ch == '”');
        parts.push(if l.en() { format!("coffee at “{cafe}” on the way") } else { format!("кава в «{cafe}» дорогою") });
    }
    if let Some(w) = &plan.work {
        items.push(ScheduleItem { from: w.from, to: w.to, site: world.sites[w.site].id.clone(), place: name(w.site), what: "work".into() });
        let till = if w.to > MINUTES_PER_DAY as u32 { if l.en() { format!("{} in the morning", clock(w.to)) } else { format!("до {} ранку", clock(w.to)) } } else { clock(w.to) };
        parts.push(format!("{} {}–{}", name(w.site), clock(w.from), till));
    }
    if let Some(sc) = &plan.school {
        items.push(ScheduleItem { from: sc.from, to: sc.to, site: world.sites[sc.site].id.clone(), place: name(sc.site), what: "school".into() });
        parts.push(format!("{} {}–{}", name(sc.site), clock(sc.from), clock(sc.to)));
    }
    if let Some((a, b)) = plan.mass {
        if let Some(ch) = world.of_kind("church").first() {
            items.push(ScheduleItem { from: a, to: b, site: world.sites[*ch].id.clone(), place: name(*ch), what: "mass".into() });
            parts.push(if l.en() { format!("Mass at {}", clock(a + 10)) } else { format!("меса о {}", clock(a + 10)) });
        }
    }
    if let Some((e, a, b)) = plan.errand {
        items.push(ScheduleItem { from: a, to: b, site: world.sites[e].id.clone(), place: name(e), what: "errand".into() });
        parts.push(if l.en() { format!("{} at {}", name(e), clock(a)) } else { format!("{} о {}", name(e), clock(a)) });
    }
    if plan.absence != Some(Absence::Away) {
        let evening = if p.young { l.pick("ввечері — прогулянка", "in the evening — a walk") } else { l.pick("ввечері — дім", "in the evening — home") };
        parts.push(evening.into());
        items.push(ScheduleItem { from: plan.bed.saturating_sub(120), to: plan.bed, site: p.home.clone(), place: name(world.site(&p.home)), what: "evening".into() });
    }
    items.sort_by_key(|it| it.from);
    let overnight = yesterday.work.as_ref().is_some_and(|w| w.to > MINUTES_PER_DAY as u32 && minute < w.to - MINUTES_PER_DAY as u32);
    let working_now = overnight || plan.work.as_ref().is_some_and(|w| w.covers(minute)) || plan.school.as_ref().is_some_and(|w| w.covers(minute));
    Some(ScheduleView {
        id: p.id.clone(),
        day: day_view(world.calendar, now, l),
        absence: plan.absence.map(|a| match a {
            Absence::Vacation => "vacation",
            Absence::Away => "away",
            Absence::DayOff => "day_off",
            Absence::Holiday => "holiday",
        }.to_string()),
        working_now,
        items,
        text: if l.en() { format!("Today: {}", parts.join(", ")) } else { format!("Сьогодні: {}", parts.join(", ")) },
    })
}

/// A sentence about something that happened, for the paper and for gossip; verbs agree with who did it.
pub fn tell(incident: &Incident, content: &Content) -> String {
    let name = |id: &String| content.residents.get(id).map(|r| r.name.clone()).unwrap_or_default();
    let female = |id: &String| content.residents.get(id).is_some_and(|r| r.gender == "f");
    let v = |id: &String, m: &str, f: &str| if female(id) { f.to_string() } else { m.to_string() };
    let site = content.sites.get(&incident.site).map(|s| s.name.clone()).unwrap_or_default();
    let who = &incident.who;
    let both = |a: &String, b: &String| match (female(a), female(b)) {
        (true, true) => "Обидві",
        (false, false) => "Обидва",
        _ => "Обоє",
    };
    if content.lang.en() {
        return tell_en(incident, content);
    }
    // names stay in the nominative and sites are named as they are, so nothing needs declining
    match incident.kind {
        IncidentKind::Theft => format!("Крадіжка — {}: {} {} їжу. Поліція шукає.", site, name(&who[0]), v(&who[0], "поцупив", "поцупила")),
        IncidentKind::Caught => format!("Затримано за крадіжку: {}. Штраф — 30 монет.", name(&who[0])),
        IncidentKind::Detained => format!("Затримано за бійку: {}. Штраф — 30 монет.", name(&who[0])),
        IncidentKind::Fight => format!("Бійка — {}: {} і {}. {} в лікарні.", site, name(&who[0]), name(&who[1]), both(&who[0], &who[1])),
        IncidentKind::Fire => format!("Пожежа — {}! Пожежники виїхали.", site),
        IncidentKind::FireOut => format!("Вогонь загашено — {}. Будинок ремонтують.", site),
        IncidentKind::Ill if content.residents.get(&who[0]).is_some_and(|r| r.age == "child") => {
            format!("{} {} — лежить удома з чаєм і малиною.", name(&who[0]), v(&who[0], "захворів", "захворіла"))
        }
        IncidentKind::Ill => format!("{} {} і {} до лікаря.", name(&who[0]), v(&who[0], "захворів", "захворіла"), v(&who[0], "пішов", "пішла")),
        IncidentKind::Healed => format!("{} вже {}.", name(&who[0]), v(&who[0], "здоровий", "здорова")),
        IncidentKind::Delivery => format!("Підвода привезла свіжий товар — {}.", site),
        IncidentKind::Party => "На площі суботні танці — грає оркестр, пахне пиріжками.".to_string(),
        IncidentKind::Interview => {
            let kind = content.sites.get(&incident.site).map(|s| s.kind.as_str()).unwrap_or("");
            let about = match kind {
                "bakery" | "factory" => "про хліб і про те, з чого починається ранок",
                "grocery" | "market" => "про ціни, урожай і новини з базару",
                "school" => "про уроки й про те, ким хочеться стати",
                "hospital" | "vet" => "про здоров'я людей і звірів",
                "police" => "про порядок у селі",
                "fire" => "про те, як не допустити пожежі",
                "farm" | "winery" => "про врожай і погоду",
                "cafe" => "про каву, плітки й музику",
                "library" => "про книжки, які варто прочитати",
                "church" => "про свято, що наближається",
                "sawmill" | "workshop" => "про роботу руками",
                "square" | "park" | "playground" => "про життя в Липовому",
                _ => "про життя в Липовому",
            };
            let role = content.residents.get(&who[0]).and_then(|r| r.job.as_ref()).map(|(_, r)| r.as_str()).unwrap_or("journalist");
            let verb = if role == "photographer" { v(&who[0], "сфотографував", "сфотографувала") } else { v(&who[0], "взяв", "взяла") };
            if role == "photographer" {
                format!("«Липовий вісник»: {} {verb} {} для інтерв'ю {about} — {site}. Світлина буде в наступному числі.", name(&who[0]), name(&who[1]))
            } else {
                format!("«Липовий вісник»: {} {verb} інтерв'ю в {} {about} — {site}.", name(&who[0]), name(&who[1]))
            }
        }
        IncidentKind::DumpFull => "Звалище переповнене: сміття вже за парканом. Село чекає на велике прибирання.".to_string(),
        IncidentKind::DumpCleared => "Велике прибирання: сміття зі звалища вивезли на сортування. Знову чисто.".to_string(),
    }
}

/// `tell` in English.
fn tell_en(incident: &Incident, content: &Content) -> String {
    let name = |id: &String| content.residents.get(id).map(|r| r.name.clone()).unwrap_or_default();
    let female = |id: &String| content.residents.get(id).is_some_and(|r| r.gender == "f");
    let they = |id: &String| if female(id) { "she" } else { "he" };
    let site = content.sites.get(&incident.site).map(|s| s.name.clone()).unwrap_or_default();
    let who = &incident.who;
    match incident.kind {
        IncidentKind::Theft => format!("Theft at {}: {} pinched some food. The police are looking.", site, name(&who[0])),
        IncidentKind::Caught => format!("Arrested for theft: {}. Fined 30 coins.", name(&who[0])),
        IncidentKind::Detained => format!("Arrested for fighting: {}. Fined 30 coins.", name(&who[0])),
        IncidentKind::Fight => format!("A fight at {}: {} and {}. Both are in hospital.", site, name(&who[0]), name(&who[1])),
        IncidentKind::Fire => format!("Fire at {}! The fire brigade is on its way.", site),
        IncidentKind::FireOut => format!("The fire is out at {}. The building is being repaired.", site),
        IncidentKind::Ill if content.residents.get(&who[0]).is_some_and(|r| r.age == "child") => {
            format!("{} has fallen ill — {} is in bed at home with tea and raspberry jam.", name(&who[0]), they(&who[0]))
        }
        IncidentKind::Ill => format!("{} has fallen ill and gone to the doctor.", name(&who[0])),
        IncidentKind::Healed => format!("{} is well again.", name(&who[0])),
        IncidentKind::Delivery => format!("A cart brought fresh goods to {}.", site),
        IncidentKind::Party => "Saturday dancing on the square — the band is playing and there's a smell of pies.".to_string(),
        IncidentKind::Interview => {
            let kind = content.sites.get(&incident.site).map(|s| s.kind.as_str()).unwrap_or("");
            let about = match kind {
                "bakery" | "factory" => "about bread and how a morning begins",
                "grocery" | "market" => "about prices, the harvest and news from the market",
                "school" => "about lessons and what one wants to be",
                "hospital" | "vet" => "about the health of people and animals",
                "police" => "about keeping the peace in the village",
                "fire" => "about how to keep fires from starting",
                "farm" | "winery" => "about the harvest and the weather",
                "cafe" => "about coffee, gossip and music",
                "library" => "about books worth reading",
                "church" => "about the coming feast",
                "sawmill" | "workshop" => "about working with one's hands",
                _ => "about life in Lypove",
            };
            let role = content.residents.get(&who[0]).and_then(|r| r.job.as_ref()).map(|(_, r)| r.as_str()).unwrap_or("journalist");
            if role == "photographer" {
                format!("“The Lypove Herald”: {} photographed {} for an interview {about} — {site}. The picture will be in the next issue.", name(&who[0]), name(&who[1]))
            } else {
                format!("“The Lypove Herald”: {} interviewed {} {about} — {site}.", name(&who[0]), name(&who[1]))
            }
        }
        IncidentKind::DumpFull => "The dump is overflowing: the rubbish is already past the fence. The village is waiting for a big clean-up.".to_string(),
        IncidentKind::DumpCleared => "The big clean-up: the rubbish from the dump has been taken away for sorting. All clean again.".to_string(),
    }
}

/// Days in one round of the dump: it fills a little every day, spills over, and then is cleared all at once.
pub const DUMP_ROUND: u64 = 24;
/// Days for the dump to fill up from empty.
pub const DUMP_FILLS_IN: u64 = 18;

/// How full the dump is on a day, in percent: it grows by the day, spills over (up to 120) and is cleared at
/// the end of the round. Each world clears it on days of its own.
pub fn dump_fill(seed: u64, day: u64) -> u32 {
    let d = (day + seed % DUMP_ROUND) % DUMP_ROUND;
    (d * 100 / DUMP_FILLS_IN).min(120) as u32
}

/// The dump's news over some days: when it spilt over, and when it was cleared.
pub fn dump_news(seed: u64, from_day: u64, now: WorldTime) -> Vec<News> {
    let mut out = Vec::new();
    for day in from_day.max(1)..=now.day() {
        let (before, after) = (dump_fill(seed, day - 1), dump_fill(seed, day));
        let (kind, minute) = if after < before {
            (IncidentKind::DumpCleared, day * crate::time::MINUTES_PER_DAY + 8 * 60)
        } else if before < 100 && after >= 100 {
            (IncidentKind::DumpFull, day * crate::time::MINUTES_PER_DAY + 9 * 60)
        } else {
            continue;
        };
        if minute <= now.0 {
            out.push(News { minute, kind, site: "dump_site".into(), text: String::new() });
        }
    }
    out
}
