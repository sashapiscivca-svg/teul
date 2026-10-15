//! Cars and the road (docs/world-economy.md §15).
//!
//! The driving school teaches the rules over a few lessons (one a day, while the instructor is in), then a
//! theory exam (today's questions, drawn from the school's list) and a practical one on the town's roads; the
//! licence is a key on the ring. The car service station sells used cars, fills the tank and mends what wears
//! (oil by the road driven, tyres, the dents of a knock). A trip is started and ended by the player (`StartDrive`,
//! `Park`); what was driven is capped by the time it took, so the odometer cannot be wound.
//!
//! What happens on the road is told by the player's own device (the core cannot see the road), but what comes
//! of it is the core's: whether anyone saw (a fixed chance per kind, drawn from the world's seed), the fine, the
//! holes punched in the coupon of the licence, the night in the cell. A full coupon (or driving without a
//! licence) takes the licence away for a few days and back through the exams. All of it goes into the paper.
//!
//! Now and then a coin or a note lies on a road or a pavement: the core decides where (a pure function of the
//! seed and the day), the player only picks it up.

use std::collections::{BTreeMap, BTreeSet};

use serde::{Deserialize, Serialize};

use crate::core::{Core, CoreError};
use crate::event::EventKind;
use crate::rng::{rand_below, Domain};
use crate::storage::Storage;
use crate::time::WorldTime;
use crate::unlock::Missing;

pub const SEEN: Domain = Domain(81);
pub const ROAD_COINS: Domain = Domain(82);
pub const THEORY: Domain = Domain(83);

/// Places on the coupon of the licence: when they are all punched, the licence is taken away.
pub const COUPON: u32 = 5;
/// A hole older than this is forgiven (the coupon is renewed).
pub const HOLE_DAYS: u64 = 90;
/// A full tank.
pub const TANK: u32 = 100;
/// Cells a unit of fuel carries the car.
pub const CELLS_PER_FUEL: u64 = 30;
/// The oil wants changing after this many cells; twice as far and the engine seizes.
pub const OIL_EVERY: u64 = 4000;
/// The tyres wear smooth after this many cells.
pub const TYRES_EVERY: u64 = 15000;
/// Three dents and the car does not go any more.
pub const DENTS_BROKEN: u32 = 3;
/// More than this many cells a minute cannot have been driven (the car's top speed, with room to spare).
pub const MAX_CELLS_PER_MINUTE: u64 = 480;
/// Days without the licence before the exams may be taken again.
pub const BACK_AFTER_DAYS: u64 = 3;
/// The practical exam lasts at most this long (minutes) and at least this long.
pub const EXAM_MAX_MINUTES: u64 = 60;
pub const EXAM_MIN_MINUTES: u64 = 2;
/// The kinds of faults that fail the practical exam at once.
pub const GRAVE: [&str; 6] = ["pedestrian", "crash", "zebra", "school_zone", "no_licence", "unfinished"];

// ---- content ---------------------------------------------------------------------------------------------

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LessonDef {
    pub title: String,
    /// What the instructor says, line by line.
    pub lines: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct QuestionDef {
    pub q: String,
    pub answers: Vec<String>,
    pub right: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CarDef {
    pub id: String,
    pub name: String,
    /// The vehicle item drawn for it.
    pub item: String,
    pub price: u32,
    pub text: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FineDef {
    pub kind: String,
    /// What it is called in the officer's words («перевищення швидкості»).
    pub name: String,
    pub coins: u32,
    pub holes: u32,
    /// The chance (in percent) that someone sees it.
    pub seen: u32,
    /// Straight to the cell, whatever the coupon.
    #[serde(default)]
    pub arrest: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DrivingDef {
    /// The driving school's room, its site, and its hours.
    pub school: String,
    pub school_site: String,
    pub school_hours: (u32, u32),
    pub sto: String,
    pub sto_site: String,
    pub sto_hours: (u32, u32),
    /// Where a bought car waits (in the town): x, y, quarter turns.
    pub sto_park: (i32, i32, u8),
    /// The police station's room and site (the cell; the yard a towed car is left in).
    pub police: String,
    pub police_site: String,
    /// The location cars are driven in.
    pub town: String,
    pub lesson_price: u32,
    pub theory_price: u32,
    pub exam_price: u32,
    pub lessons: Vec<LessonDef>,
    pub questions: Vec<QuestionDef>,
    /// Questions asked at the theory exam, and how many must be right.
    pub theory_asked: u32,
    pub theory_pass: u32,
    pub cars: Vec<CarDef>,
    /// Coins for ten units of fuel at the pump.
    pub fuel_price: u32,
    /// The canister bought at the station (a carry item) and what it pours in.
    pub can_item: String,
    pub can_fuel: u32,
    pub oil_price: u32,
    pub tyres_price: u32,
    pub repair_price: u32,
    pub fines: Vec<FineDef>,
    /// The licence and the car's keys (keys on the ring).
    pub licence_item: String,
    pub keys_item: String,
    /// What the one in the next bunk says, a line a night.
    #[serde(default)]
    pub cellmate: Vec<String>,
    /// Where money may turn up on the road.
    #[serde(default)]
    pub coin_places: Vec<String>,
}

// ---- state -----------------------------------------------------------------------------------------------

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct CarState {
    pub model: String,
    pub fuel: u32,
    /// Cells driven, ever.
    pub odo: u64,
    pub oil_at: u64,
    pub tyres_at: u64,
    pub dents: u32,
    pub bought: u64,
    /// Where it stands: location, x, y, quarter turns.
    pub at: (String, i32, i32, u8),
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct Trip {
    /// The world minute it began.
    pub start: u64,
    pub licensed: bool,
    /// In the school's car, with the instructor beside (the practical exam).
    pub exam: bool,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct DriveState {
    pub lessons: u32,
    pub last_lesson: Option<u64>,
    pub theory: bool,
    pub theory_tried: Option<u64>,
    /// The practical exam going on: the minute it began.
    pub exam: Option<u64>,
    pub exam_tried: Option<u64>,
    /// The day the licence was given (None: no licence).
    pub licence: Option<u64>,
    /// Taken away: the day from which it may be earned back.
    pub taken_until: Option<u64>,
    /// Holes punched in the coupon: (day, kind).
    pub holes: Vec<(u64, String)>,
    pub fines_due: u32,
    pub car: Option<CarState>,
    pub trip: Option<Trip>,
    /// In the cell until this world minute.
    pub jailed_until: Option<u64>,
    /// Money picked up from the road: (day, which of the day's).
    pub found: BTreeSet<(u64, u32)>,
    /// What the paper may tell: (day, what).
    pub log: Vec<(u64, String)>,
    /// What nobody saw.
    pub unseen: u32,
    pub violations: u32,
}

impl DriveState {
    pub fn holes_on(&self, day: u64) -> u32 {
        self.holes.iter().filter(|(d, _)| day < d + HOLE_DAYS).count() as u32
    }

    pub fn jailed(&self, now: u64) -> bool {
        self.jailed_until.is_some_and(|u| now < u)
    }
}

impl CarState {
    pub fn broken(&self) -> bool {
        self.dents >= DENTS_BROKEN || self.odo.saturating_sub(self.oil_at) > OIL_EVERY * 2
    }

    /// What it wants: oil, tyres, a repair.
    pub fn needs(&self) -> Vec<&'static str> {
        let mut out = Vec::new();
        if self.odo.saturating_sub(self.oil_at) > OIL_EVERY {
            out.push("oil");
        }
        if self.odo.saturating_sub(self.tyres_at) > TYRES_EVERY {
            out.push("tyres");
        }
        if self.dents > 0 || self.odo.saturating_sub(self.oil_at) > OIL_EVERY * 2 {
            out.push("repair");
        }
        out
    }

    /// How it is, in the mechanic's words.
    pub fn words(&self, l: crate::content::Lang) -> Vec<String> {
        let mut out = Vec::new();
        let oil = self.odo.saturating_sub(self.oil_at);
        if oil > OIL_EVERY * 2 {
            out.push(l.pick("Мотор заклинило: олива перетворилася на смолу.", "The engine has seized: the oil has turned to tar.").to_string());
        } else if oil > OIL_EVERY {
            out.push(l.pick("Мотор стукає — давно пора міняти оливу.", "The engine is knocking — the oil should have been changed long ago.").to_string());
        } else if oil > OIL_EVERY * 3 / 4 {
            out.push(l.pick("Олива темніє, скоро заміна.", "The oil is getting dark; it will need changing soon.").to_string());
        }
        if self.odo.saturating_sub(self.tyres_at) > TYRES_EVERY {
            out.push(l.pick("Шини лисі, на мокрому кидає.", "The tyres are bald; it slides about in the wet.").to_string());
        }
        match self.dents {
            0 => {}
            1 => out.push(l.pick("Вм'ятина на крилі.", "A dent in the wing.").to_string()),
            2 => out.push(l.pick("Дві вм'ятини, фара тримається на скотчі.", "Two dents, and a headlight held on with tape.").to_string()),
            _ => out.push(l.pick("Після трьох ударів машина не їде: потрібен ремонт.", "After three knocks the car won't go: it needs repairs.").to_string()),
        }
        out.push(match self.fuel {
            0 => l.pick("Бак сухий.", "The tank is dry."),
            1..=15 => l.pick("Бензину на дні.", "Just a splash of petrol left."),
            16..=50 => l.pick("Бак напівпорожній.", "The tank is half empty."),
            51..=90 => l.pick("Бензину вистачає.", "Plenty of petrol."),
            _ => l.pick("Бак повний.", "The tank is full."),
        }.to_string());
        out
    }
}

// ---- events ----------------------------------------------------------------------------------------------

/// Folds the road's events into the state (called for every event).
pub(crate) fn apply(st: &mut crate::state::DeltaState, kind: &EventKind, minute: u64) {
    let d = &mut st.drive;
    match kind {
        EventKind::LessonTaken { day, coins, .. } => {
            d.lessons += 1;
            d.last_lesson = Some(*day);
            st.spent += u64::from(*coins);
        }
        EventKind::TheoryTaken { day, passed, coins, .. } => {
            d.theory_tried = Some(*day);
            d.theory = *passed;
            st.spent += u64::from(*coins);
        }
        EventKind::ExamStarted { coins, .. } => {
            d.exam = Some(minute);
            d.trip = None;
            st.spent += u64::from(*coins);
        }
        EventKind::ExamEnded { day, passed, licence, .. } => {
            d.exam = None;
            d.trip = None;
            d.exam_tried = Some(*day);
            if *passed {
                d.licence = Some(*day);
                d.taken_until = None;
                d.holes.clear();
                d.log.push((*day, "licence".to_string()));
                *st.owned.entry(licence.clone()).or_insert(0) += 1;
            }
        }
        EventKind::CarBought { model, price, day, at, keys } => {
            d.car = Some(CarState { model: model.clone(), fuel: TANK / 2, odo: 0, oil_at: 0, tyres_at: 0, dents: 0, bought: *day, at: at.clone() });
            d.log.push((*day, format!("car:{model}")));
            st.spent += u64::from(*price);
            if st.owned.get(keys).copied().unwrap_or(0) == 0 {
                *st.owned.entry(keys.clone()).or_insert(0) += 1;
            }
        }
        EventKind::Refuelled { units, coins, can } => {
            if let Some(car) = d.car.as_mut() {
                car.fuel = (car.fuel + units).min(TANK);
            }
            st.spent += u64::from(*coins);
            if let Some(c) = can {
                if let Some(n) = st.owned.get_mut(c) {
                    *n = n.saturating_sub(1);
                }
            }
        }
        EventKind::CarServiced { what, coins } => {
            if let Some(car) = d.car.as_mut() {
                match what.as_str() {
                    "oil" => car.oil_at = car.odo,
                    "tyres" => car.tyres_at = car.odo,
                    _ => {
                        car.dents = 0;
                        car.oil_at = car.odo;
                    }
                }
            }
            st.spent += u64::from(*coins);
        }
        EventKind::DriveStarted { licensed, exam } => {
            d.trip = Some(Trip { start: minute, licensed: *licensed, exam: *exam });
        }
        EventKind::Parked { cells, fuel, at } => {
            let exam = d.trip.as_ref().is_some_and(|t| t.exam);
            d.trip = None;
            if !exam {
                if let Some(car) = d.car.as_mut() {
                    car.odo += cells;
                    car.fuel = car.fuel.saturating_sub(*fuel);
                    car.at = at.clone();
                }
            }
        }
        EventKind::Violated { kind, day, seen, fine, paid, holes, dent } => {
            d.violations += 1;
            if *dent {
                if let Some(car) = d.car.as_mut() {
                    if !d.trip.as_ref().is_some_and(|t| t.exam) {
                        car.dents += 1;
                    }
                }
            }
            if *seen {
                for _ in 0..*holes {
                    d.holes.push((*day, kind.clone()));
                }
                if *paid {
                    st.spent += u64::from(*fine);
                } else {
                    d.fines_due += fine;
                }
                d.log.push((*day, format!("fined:{kind}")));
            } else {
                d.unseen += 1;
            }
        }
        EventKind::Arrested { day, kind, until, back, cells, fuel, at, licence } => {
            d.jailed_until = Some(*until);
            let exam = d.trip.as_ref().is_some_and(|t| t.exam);
            d.trip = None;
            if !exam {
                if let Some(car) = d.car.as_mut() {
                    car.odo += cells;
                    car.fuel = car.fuel.saturating_sub(*fuel);
                    car.at = at.clone();
                }
            }
            if d.licence.take().is_some() {
                if let Some(n) = st.owned.get_mut(licence) {
                    *n = n.saturating_sub(1);
                }
            }
            d.theory = false;
            d.taken_until = Some(*back);
            d.holes.clear();
            d.log.push((*day, format!("arrested:{kind}")));
        }
        EventKind::FinePaid { coins } => {
            d.fines_due = d.fines_due.saturating_sub(*coins);
            st.spent += u64::from(*coins);
        }
        EventKind::MoneyFound { day, index, coins } => {
            d.found.insert((*day, *index));
            d.log.push((*day, "found".to_string()));
            st.earned += u64::from(*coins);
        }
        _ => {}
    }
    // the paper only looks a day back: keep the last few weeks
    if d.log.len() > 64 {
        let cut = d.log.len() - 64;
        d.log.drain(..cut);
    }
    if d.found.len() > 64 {
        let keep: BTreeSet<(u64, u32)> = d.found.iter().rev().take(32).copied().collect();
        d.found = keep;
    }
}

// ---- money on the road -------------------------------------------------------------------------------------

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct RoadCoin {
    pub index: u32,
    pub x: i32,
    pub y: i32,
    pub coins: u32,
}

const COIN_FLOORS: [&str; 4] = ["floor.cobble", "floor.plaza", "floor.path", "floor.gravel"];

/// What lies on the roads and pavements of a location on a day (before anyone picks it up): mostly nothing,
/// now and then a few coins, rarely a note.
pub fn road_coins(seed: u64, content: &crate::content::Content, location: &str, day: u64) -> Vec<RoadCoin> {
    let Some(d) = content.driving.as_ref() else { return Vec::new() };
    if !d.coin_places.iter().any(|p| p == location) {
        return Vec::new();
    }
    let Some(loc) = content.locations.get(location) else { return Vec::new() };
    let id = crate::rng::fnv1a64(location.as_bytes());
    let roll = rand_below(seed, ROAD_COINS, id, day * 8, 100);
    let n = if roll < 50 { 0 } else if roll < 85 { 1 } else { 2 };
    if n == 0 {
        return Vec::new();
    }
    // the cells one walks or drives on, not under a thing standing there
    let mut taken: BTreeSet<(i32, i32)> = BTreeSet::new();
    for p in &loc.props {
        if p.wall.is_some() {
            continue;
        }
        let Some(def) = content.items.get(&p.item) else { continue };
        let (w, h) = if p.rot % 2 == 1 { (def.footprint.d, def.footprint.w) } else { (def.footprint.w, def.footprint.d) };
        for j in 0..i32::from(h) {
            for i in 0..i32::from(w) {
                taken.insert((p.x + i, p.y + j));
            }
        }
    }
    let mut cells: Vec<(i32, i32)> = Vec::new();
    for (y, row) in loc.tiles.iter().enumerate() {
        for (x, ch) in row.chars().enumerate() {
            let floor = loc.legend.get(&ch.to_string()).map(String::as_str).unwrap_or("");
            if COIN_FLOORS.contains(&floor) && !taken.contains(&(x as i32, y as i32)) {
                cells.push((x as i32, y as i32));
            }
        }
    }
    if cells.is_empty() {
        return Vec::new();
    }
    (0..n)
        .map(|k| {
            let at = cells[rand_below(seed, ROAD_COINS, id, day * 8 + 1 + u64::from(k) * 2, cells.len() as u64) as usize];
            let r = rand_below(seed, ROAD_COINS, id, day * 8 + 2 + u64::from(k) * 2, 100);
            let coins = if r < 70 { 1 + (r % 5) as u32 } else if r < 95 { 10 } else if r < 99 { 20 } else { 50 };
            RoadCoin { index: k, x: at.0, y: at.1, coins }
        })
        .collect()
}

// ---- the views ---------------------------------------------------------------------------------------------

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct QuestionView {
    pub q: String,
    pub answers: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct CarView {
    pub model: String,
    pub name: String,
    pub item: String,
    pub fuel: u32,
    pub at: (String, i32, i32, u8),
    pub broken: bool,
    pub needs: Vec<String>,
    pub words: Vec<String>,
    /// Cells it can still go on what is in the tank.
    pub range: u64,
    /// Standing in the yard of the service station.
    pub at_sto: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct DriveView {
    pub school: String,
    pub sto: String,
    pub police: String,
    pub town: String,
    pub school_site: String,
    pub sto_site: String,
    pub police_site: String,
    pub school_open: bool,
    pub sto_open: bool,
    pub lessons_done: u32,
    pub lessons_total: u32,
    /// The lesson to come (its title and the instructor's words).
    pub next_lesson: Option<LessonDef>,
    pub lesson_today: bool,
    pub theory: bool,
    pub theory_today: bool,
    /// Today's questions, when the theory exam is the next step.
    pub questions: Vec<QuestionView>,
    pub theory_pass: u32,
    pub exam: Option<u64>,
    pub exam_today: bool,
    pub licence: Option<u64>,
    /// Days until the licence may be earned back.
    pub back_in: Option<u64>,
    pub holes: u32,
    pub coupon: u32,
    /// What the holes were for (the officer's words), oldest first.
    pub hole_names: Vec<String>,
    pub fines_due: u32,
    pub car: Option<CarView>,
    pub trip: Option<Trip>,
    pub jailed_until: Option<u64>,
    pub cars: Vec<CarDef>,
    pub lesson_price: u32,
    pub theory_price: u32,
    pub exam_price: u32,
    pub fuel_price: u32,
    pub oil_price: u32,
    pub tyres_price: u32,
    pub repair_price: u32,
    pub can_item: String,
    pub can_fuel: u32,
    pub fines: Vec<FineDef>,
    /// Money lying about where the player is, not picked up yet.
    pub coins: Vec<RoadCoin>,
    /// Tonight's words from the next bunk.
    pub cellmate: Vec<String>,
    /// How the officer speaks to this driver.
    pub tone: String,
}

/// A story for the paper about the player on the road.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct DriverStory {
    pub headline: String,
    pub text: String,
    /// What the photo shows: a place (a location or site id) to take it at.
    pub photo: String,
    /// How weighty it is (the front page takes the weightiest).
    pub weight: u32,
    /// The paper's section («Кримінальна хроніка», «Дороги»).
    pub section: String,
}

fn hour_of(now: WorldTime) -> u32 {
    (now.minute_of_day() / 60) as u32
}

impl<S: Storage> Core<S> {
    fn driving(&self) -> Result<&DrivingDef, CoreError> {
        self.content().driving.as_ref().ok_or(CoreError::NothingThere)
    }

    pub fn jailed(&self, now: WorldTime) -> bool {
        self.state().drive.jailed(now.0)
    }

    fn open_now(&self, hours: (u32, u32), now: WorldTime) -> bool {
        let (_, _, _, info) = self.calendar_day(now);
        let h = hour_of(now);
        // closed on Sundays and on the days the whole town rests
        let rest = info.weekday == crate::holidays::Weekday::Sun || info.holiday.is_some_and(|x| x.day_off);
        !rest && h >= hours.0 && h < hours.1
    }

    fn need_coins(&self, coins: u32) -> Result<(), CoreError> {
        let have = self.wallet().coins;
        if have < u64::from(coins) {
            return Err(CoreError::Locked(vec![Missing::Coins { have, need: u64::from(coins) }]));
        }
        Ok(())
    }

    /// Today's questions at the theory exam: indexes into the school's list, a different handful each day.
    pub fn theory_questions(&self, day: u64) -> Vec<usize> {
        let Some(d) = self.content().driving.as_ref() else { return Vec::new() };
        let n = d.questions.len();
        let mut order: Vec<usize> = (0..n).collect();
        for i in (1..n).rev() {
            let j = rand_below(self.meta().seed, THEORY, day, i as u64, (i + 1) as u64) as usize;
            order.swap(i, j);
        }
        order.truncate(d.theory_asked as usize);
        order
    }

    /// Whether the licence may be studied for now (not taken away, or the days of it are over).
    fn may_earn(&self, day: u64) -> bool {
        self.state().drive.taken_until.map_or(true, |u| day >= u)
    }

    pub(crate) fn plan_lesson(&self, now: WorldTime) -> Result<Vec<EventKind>, CoreError> {
        let d = self.driving()?;
        let st = &self.state().drive;
        if self.location() != d.school {
            return Err(CoreError::NotHere);
        }
        if !self.open_now(d.school_hours, now) {
            return Err(CoreError::Closed);
        }
        if st.lessons as usize >= d.lessons.len() || st.licence.is_some() {
            return Err(CoreError::AlreadyDone);
        }
        if st.last_lesson == Some(now.day()) {
            return Err(CoreError::TooSoon);
        }
        self.need_coins(d.lesson_price)?;
        Ok(vec![EventKind::LessonTaken { n: st.lessons, day: now.day(), coins: d.lesson_price }])
    }

    pub(crate) fn plan_theory(&self, now: WorldTime, answers: &[u32]) -> Result<Vec<EventKind>, CoreError> {
        let d = self.driving()?;
        let st = &self.state().drive;
        let day = now.day();
        if self.location() != d.school {
            return Err(CoreError::NotHere);
        }
        if !self.open_now(d.school_hours, now) {
            return Err(CoreError::Closed);
        }
        if st.licence.is_some() || st.theory {
            return Err(CoreError::AlreadyDone);
        }
        if (st.lessons as usize) < d.lessons.len() || !self.may_earn(day) || st.fines_due > 0 {
            return Err(CoreError::NotToday);
        }
        if st.theory_tried == Some(day) {
            return Err(CoreError::TooSoon);
        }
        let asked = self.theory_questions(day);
        if answers.len() != asked.len() {
            return Err(CoreError::NoRequest);
        }
        self.need_coins(d.theory_price)?;
        let right = asked.iter().zip(answers).filter(|(q, a)| d.questions[**q].right == **a).count() as u32;
        Ok(vec![EventKind::TheoryTaken { day, right, passed: right >= d.theory_pass, coins: d.theory_price }])
    }

    pub(crate) fn plan_exam_start(&self, now: WorldTime) -> Result<Vec<EventKind>, CoreError> {
        let d = self.driving()?;
        let st = &self.state().drive;
        if self.location() != d.school {
            return Err(CoreError::NotHere);
        }
        if !self.open_now(d.school_hours, now) {
            return Err(CoreError::Closed);
        }
        if st.licence.is_some() {
            return Err(CoreError::AlreadyDone);
        }
        if !st.theory || st.exam.is_some() || st.trip.is_some() {
            return Err(CoreError::NotToday);
        }
        if st.exam_tried == Some(now.day()) {
            return Err(CoreError::TooSoon);
        }
        self.need_coins(d.exam_price)?;
        Ok(vec![EventKind::ExamStarted { day: now.day(), coins: d.exam_price }])
    }

    pub(crate) fn plan_exam_end(&self, now: WorldTime, faults: Vec<String>) -> Result<Vec<EventKind>, CoreError> {
        let d = self.driving()?;
        let st = &self.state().drive;
        let start = st.exam.ok_or(CoreError::NoRequest)?;
        if self.location() != d.school && self.location() != d.town {
            return Err(CoreError::NotHere);
        }
        let took = now.0.saturating_sub(start);
        if took < EXAM_MIN_MINUTES {
            return Err(CoreError::TooSoon);
        }
        if faults.len() > 16 || faults.iter().any(|f| f != "unfinished" && !d.fines.iter().any(|x| &x.kind == f)) {
            return Err(CoreError::NoRequest);
        }
        let grave = faults.iter().any(|f| GRAVE.contains(&f.as_str()));
        let passed = !grave && faults.len() <= 1 && took <= EXAM_MAX_MINUTES;
        Ok(vec![EventKind::ExamEnded { day: now.day(), faults, passed, licence: d.licence_item.clone() }])
    }

    pub(crate) fn plan_buy_car(&self, now: WorldTime, car: &str) -> Result<Vec<EventKind>, CoreError> {
        let d = self.driving()?;
        // bought from the list (the phone, the menu) as well as at the counter: the car waits at the forecourt
        if !self.open_now(d.sto_hours, now) {
            return Err(CoreError::Closed);
        }
        let def = d.cars.iter().find(|c| c.id == car).ok_or(CoreError::NoRequest)?;
        if self.state().drive.car.is_some() {
            return Err(CoreError::AlreadyOwned);
        }
        self.need_coins(def.price)?;
        let at = (d.town.clone(), d.sto_park.0, d.sto_park.1, d.sto_park.2);
        Ok(vec![EventKind::CarBought { model: def.id.clone(), price: def.price, day: now.day(), at, keys: d.keys_item.clone() }])
    }

    fn car_at_sto(&self, car: &CarState) -> bool {
        let Ok(d) = self.driving() else { return false };
        car.at.0 == d.town && (car.at.1 - d.sto_park.0).abs() <= 8 && (car.at.2 - d.sto_park.1).abs() <= 8
    }

    pub(crate) fn plan_refuel(&self, now: WorldTime) -> Result<Vec<EventKind>, CoreError> {
        let d = self.driving()?;
        let car = self.state().drive.car.as_ref().ok_or(CoreError::NothingThere)?;
        if self.state().drive.trip.is_some() {
            return Err(CoreError::NotToday);
        }
        if car.fuel >= TANK {
            return Err(CoreError::AlreadyDone);
        }
        let missing = TANK - car.fuel;
        let pump = |s: &Self| -> Result<Vec<EventKind>, CoreError> {
            if !s.open_now(d.sto_hours, now) {
                return Err(CoreError::Closed);
            }
            let coins = missing.div_ceil(10) * d.fuel_price;
            s.need_coins(coins)?;
            Ok(vec![EventKind::Refuelled { units: missing, coins, can: None }])
        };
        // at the pump of the station, with the car in its yard
        if self.location() == d.sto {
            if !self.car_at_sto(car) {
                return Err(CoreError::NotHere);
            }
            return pump(self);
        }
        if self.location() != car.at.0 {
            return Err(CoreError::NotHere);
        }
        // from a canister, by the car wherever it stands
        if self.in_pocket(&d.can_item) > 0 {
            return Ok(vec![EventKind::Refuelled { units: d.can_fuel.min(missing), coins: 0, can: Some(d.can_item.clone()) }]);
        }
        if self.car_at_sto(car) {
            return pump(self);
        }
        Err(CoreError::NotEnough)
    }

    pub(crate) fn plan_service(&self, now: WorldTime, what: &str) -> Result<Vec<EventKind>, CoreError> {
        let d = self.driving()?;
        if self.location() != d.sto {
            return Err(CoreError::NotHere);
        }
        if !self.open_now(d.sto_hours, now) {
            return Err(CoreError::Closed);
        }
        let car = self.state().drive.car.as_ref().ok_or(CoreError::NothingThere)?;
        if !self.car_at_sto(car) {
            // a car that does not go is towed in by the station's own truck (in the price of the repair)
            if !(what == "repair" && car.broken()) {
                return Err(CoreError::NotHere);
            }
        }
        let coins = match what {
            "oil" => d.oil_price,
            "tyres" => d.tyres_price,
            "repair" => d.repair_price,
            _ => return Err(CoreError::NoRequest),
        };
        if what == "repair" && car.dents == 0 && !car.broken() {
            return Err(CoreError::AlreadyDone);
        }
        self.need_coins(coins)?;
        let mut events = vec![EventKind::CarServiced { what: what.to_string(), coins }];
        if !self.car_at_sto(car) {
            events.push(EventKind::Parked { cells: 0, fuel: 0, at: (d.town.clone(), d.sto_park.0, d.sto_park.1, d.sto_park.2) });
        }
        Ok(events)
    }

    pub(crate) fn plan_start_drive(&self, now: WorldTime, exam: bool) -> Result<Vec<EventKind>, CoreError> {
        let d = self.driving()?;
        let st = &self.state().drive;
        if st.trip.is_some() {
            return Err(CoreError::AlreadyDone);
        }
        if self.jailed(now) {
            return Err(CoreError::Jailed);
        }
        if exam {
            if st.exam.is_none() {
                return Err(CoreError::NoRequest);
            }
            if self.location() != d.town {
                return Err(CoreError::NotHere);
            }
            return Ok(vec![EventKind::DriveStarted { licensed: false, exam: true }]);
        }
        let car = st.car.as_ref().ok_or(CoreError::NothingThere)?;
        if self.location() != car.at.0 {
            return Err(CoreError::NotHere);
        }
        if car.broken() {
            return Err(CoreError::CarBroken);
        }
        if car.fuel == 0 {
            return Err(CoreError::NotEnough);
        }
        Ok(vec![EventKind::DriveStarted { licensed: st.licence.is_some(), exam: false }])
    }

    /// What a trip of `cells` used (capped by the time it took), and whether it fits.
    fn trip_cost(&self, now: WorldTime, cells: u64) -> Result<(u64, u32), CoreError> {
        let trip = self.state().drive.trip.as_ref().ok_or(CoreError::NoRequest)?;
        let minutes = now.0.saturating_sub(trip.start) + 1;
        if cells > minutes * MAX_CELLS_PER_MINUTE {
            return Err(CoreError::TooFast);
        }
        let fuel = if trip.exam { 0 } else { cells.div_ceil(CELLS_PER_FUEL) as u32 };
        let fuel = fuel.min(self.state().drive.car.as_ref().map_or(0, |c| c.fuel));
        Ok((cells, fuel))
    }

    fn valid_spot(&self, x: i32, y: i32) -> Result<(), CoreError> {
        let loc = self.content().locations.get(self.location()).ok_or(CoreError::NotHere)?;
        if x < 0 || y < 0 || x >= loc.w || y >= loc.h {
            return Err(CoreError::NotHere);
        }
        Ok(())
    }

    pub(crate) fn plan_park(&self, now: WorldTime, cells: u64, x: i32, y: i32, rot: u8) -> Result<Vec<EventKind>, CoreError> {
        let d = self.driving()?;
        let (cells, fuel) = self.trip_cost(now, cells)?;
        if self.location() != d.town {
            return Err(CoreError::NotHere);
        }
        self.valid_spot(x, y)?;
        Ok(vec![EventKind::Parked { cells, fuel, at: (d.town.clone(), x, y, rot % 4) }])
    }

    /// The tow truck leaves an arrested driver's car in the police yard, by the station's door.
    fn police_yard(&self) -> (String, i32, i32, u8) {
        let content = self.content();
        let d = content.driving.as_ref().expect("checked");
        let (x, y) = content.sites.get(&d.police_site).map(|s| (s.x, s.y)).unwrap_or((d.sto_park.0, d.sto_park.1));
        (d.town.clone(), x, y, 0)
    }

    /// Until when one sits: arrested in the evening or at night, till seven in the morning; by day, three hours.
    pub fn release_at(now: WorldTime) -> u64 {
        let m = now.minute_of_day();
        let day0 = now.0 - m;
        if m >= 18 * 60 {
            day0 + 1440 + 7 * 60
        } else if m < 7 * 60 {
            day0 + 7 * 60
        } else {
            now.0 + 180
        }
    }

    pub(crate) fn plan_violation(&self, now: WorldTime, kind: &str, cells: u64, x: i32, y: i32) -> Result<Vec<EventKind>, CoreError> {
        let d = self.driving()?;
        let st = &self.state().drive;
        let trip = st.trip.as_ref().ok_or(CoreError::NoRequest)?;
        if trip.exam {
            // the instructor marks it on the sheet; it is not the police's business
            return Err(CoreError::NoRequest);
        }
        if self.location() != d.town {
            return Err(CoreError::NotHere);
        }
        self.valid_spot(x, y)?;
        let fine = d.fines.iter().find(|f| f.kind == kind).ok_or(CoreError::NoRequest)?;
        let (cells, fuel) = self.trip_cost(now, cells)?;
        let day = now.day();
        let roll = rand_below(self.meta().seed, SEEN, u64::from(st.violations), now.0, 100);
        let seen = roll < u64::from(fine.seen);
        let dent = kind == "crash";
        let licensed = trip.licensed && st.licence.is_some();
        let have = self.wallet().coins;
        let holes = if licensed { fine.holes } else { 0 };
        let paid = seen && have >= u64::from(fine.coins);
        let mut events = vec![EventKind::Violated { kind: kind.to_string(), day, seen, fine: fine.coins, paid, holes, dent }];
        let full = licensed && st.holes_on(day) + fine.holes >= COUPON;
        if seen && (fine.arrest || !licensed || full) {
            let at = self.police_yard();
            events.push(EventKind::Arrested {
                day,
                kind: if !licensed { "no_licence".to_string() } else { kind.to_string() },
                until: Self::release_at(now),
                back: day + BACK_AFTER_DAYS,
                cells,
                fuel,
                at,
                licence: d.licence_item.clone(),
            });
            events.push(EventKind::Travelled { to: d.police.clone(), day });
        }
        Ok(events)
    }

    pub(crate) fn plan_pay_fine(&self) -> Result<Vec<EventKind>, CoreError> {
        let d = self.driving()?;
        if self.location() != d.police {
            return Err(CoreError::NotHere);
        }
        let due = self.state().drive.fines_due;
        if due == 0 {
            return Err(CoreError::NothingThere);
        }
        self.need_coins(due)?;
        Ok(vec![EventKind::FinePaid { coins: due }])
    }

    pub(crate) fn plan_pick_coin(&self, now: WorldTime, x: i32, y: i32) -> Result<Vec<EventKind>, CoreError> {
        if self.location() == "home" || self.jailed(now) {
            return Err(CoreError::NothingThere);
        }
        let day = now.day();
        let coin = road_coins(self.meta().seed, self.content(), self.location(), day)
            .into_iter()
            .find(|c| c.x == x && c.y == y && !self.state().drive.found.contains(&(day, c.index)))
            .ok_or(CoreError::NothingThere)?;
        Ok(vec![EventKind::MoneyFound { day, index: coin.index, coins: coin.coins }])
    }

    pub fn drive_view(&self, now: WorldTime) -> Option<DriveView> {
        let d = self.content().driving.as_ref()?;
        let st = &self.state().drive;
        let day = now.day();
        let car = st.car.as_ref().map(|c| {
            let def = d.cars.iter().find(|x| x.id == c.model);
            CarView {
                model: c.model.clone(),
                name: def.map(|x| x.name.clone()).unwrap_or_default(),
                item: def.map(|x| x.item.clone()).unwrap_or_else(|| "car_red".to_string()),
                fuel: c.fuel,
                at: c.at.clone(),
                broken: c.broken(),
                needs: c.needs().into_iter().map(String::from).collect(),
                words: c.words(self.lang()),
                range: u64::from(c.fuel) * CELLS_PER_FUEL,
                at_sto: self.car_at_sto(c),
            }
        });
        let theory_next = st.licence.is_none() && !st.theory && st.lessons as usize >= d.lessons.len() && self.may_earn(day);
        let questions = if theory_next {
            self.theory_questions(day).into_iter().map(|i| QuestionView { q: d.questions[i].q.clone(), answers: d.questions[i].answers.clone() }).collect()
        } else {
            Vec::new()
        };
        let holes = st.holes_on(day);
        let l = self.lang();
        let tone = match (st.licence.is_some(), holes) {
            (false, _) => l.pick("Документи! …А посвідчення де?", "Papers! …And where's your licence?"),
            (true, 0) => l.pick("Добрий день. Документи, будь ласка. Ну що ж, буває.", "Good afternoon. Papers, please. Well, these things happen."),
            (true, 1..=2) => l.pick("Знову ви? Талон уже дірявий, будьте уважніші.", "You again? Your licence is already punched — be more careful."),
            _ => l.pick("Ще одна дірка — і посвідчення лишиться в мене. Останнє попередження.", "One more punch and I keep your licence. Last warning."),
        };
        let n = d.cellmate.len();
        let cellmate = if n == 0 {
            Vec::new()
        } else {
            let k = rand_below(self.meta().seed, SEEN, 7, day, n as u64) as usize;
            (0..3.min(n)).map(|i| d.cellmate[(k + i) % n].clone()).collect()
        };
        let here = self.location().to_string();
        let coins = road_coins(self.meta().seed, self.content(), &here, day).into_iter().filter(|c| !st.found.contains(&(day, c.index))).collect();
        Some(DriveView {
            school: d.school.clone(),
            sto: d.sto.clone(),
            police: d.police.clone(),
            town: d.town.clone(),
            school_site: d.school_site.clone(),
            sto_site: d.sto_site.clone(),
            police_site: d.police_site.clone(),
            school_open: self.open_now(d.school_hours, now),
            sto_open: self.open_now(d.sto_hours, now),
            lessons_done: st.lessons,
            lessons_total: d.lessons.len() as u32,
            next_lesson: d.lessons.get(st.lessons as usize).cloned(),
            lesson_today: st.last_lesson == Some(day),
            theory: st.theory,
            theory_today: st.theory_tried == Some(day),
            questions,
            theory_pass: d.theory_pass,
            exam: st.exam,
            exam_today: st.exam_tried == Some(day),
            licence: st.licence,
            back_in: st.taken_until.filter(|u| *u > day).map(|u| u - day),
            holes,
            coupon: COUPON,
            hole_names: st
                .holes
                .iter()
                .filter(|(dd, _)| day < dd + HOLE_DAYS)
                .map(|(_, k)| d.fines.iter().find(|f| &f.kind == k).map(|f| f.name.clone()).unwrap_or_else(|| k.clone()))
                .collect(),
            fines_due: st.fines_due,
            car,
            trip: st.trip.clone(),
            jailed_until: st.jailed_until.filter(|u| now.0 < *u),
            cars: d.cars.clone(),
            lesson_price: d.lesson_price,
            theory_price: d.theory_price,
            exam_price: d.exam_price,
            fuel_price: d.fuel_price,
            oil_price: d.oil_price,
            tyres_price: d.tyres_price,
            repair_price: d.repair_price,
            can_item: d.can_item.clone(),
            can_fuel: d.can_fuel,
            fines: d.fines.clone(),
            coins,
            cellmate,
            tone: tone.to_string(),
        })
    }

    /// What the paper tells of the player on the road: yesterday's licence, fines, the night in the cell, the
    /// car bought, the money found. The weightiest first.
    pub fn driver_stories(&self, day: u64) -> Vec<DriverStory> {
        let Some(d) = self.content().driving.as_ref() else { return Vec::new() };
        let Some(yesterday) = day.checked_sub(1) else { return Vec::new() };
        let st = &self.state().drive;
        let l = self.lang();
        let who = self.state().player_name.clone().unwrap_or_else(|| l.pick("Наш сусід", "A neighbour of ours").to_string());
        let (roads, crime, found) = (l.pick("Дороги", "Roads"), l.pick("Кримінальна хроніка", "Police report"), l.pick("Бюро знахідок", "Lost and found"));
        let fine_name = |k: &str| d.fines.iter().find(|f| f.kind == k).map(|f| f.name.clone()).unwrap_or_else(|| k.to_string());
        let mut out: Vec<DriverStory> = Vec::new();
        let mut fines: BTreeMap<String, u32> = BTreeMap::new();
        for (dd, what) in st.log.iter().filter(|(dd, _)| *dd == yesterday) {
            let _ = dd;
            if what == "licence" {
                out.push(DriverStory {
                    headline: l.pick("Новий водій на вулицях Липового", "A new driver on the streets of Lypove").to_string(),
                    text: if l.en() { format!("{who} now has a driving licence: the driving school exam is passed. The instructor says: “A light hand and a careful eye.”") } else { format!("{who} — тепер з посвідченням водія: іспит в автошколі здано. Інструктор каже: «Рука легка, око уважне».") },
                    photo: d.school_site.clone(),
                    weight: 40,
                    section: roads.to_string(),
                });
            } else if let Some(k) = what.strip_prefix("arrested:") {
                let why = if k == "no_licence" { l.pick("керування без посвідчення", "driving without a licence").to_string() } else { fine_name(k) };
                out.push(DriverStory {
                    headline: l.pick("Місцевий водій провів ніч у відділку", "A local driver spent the night at the station").to_string(),
                    text: if l.en() { format!("A patrol pulled over a car with {who} at the wheel. The reason: {why}. The licence was taken and the car towed to the pound.") } else { format!("Патруль зупинив машину, за кермом — {who}. Причина: {why}. Посвідчення вилучено, машину відбуксирували на штрафмайданчик.") },
                    photo: d.police_site.clone(),
                    weight: 80,
                    section: crime.to_string(),
                });
            } else if let Some(k) = what.strip_prefix("fined:") {
                *fines.entry(k.to_string()).or_insert(0) += 1;
            } else if let Some(m) = what.strip_prefix("car:") {
                let name = d.cars.iter().find(|c| c.id == m).map(|c| c.name.clone()).unwrap_or_default();
                out.push(DriverStory {
                    headline: l.pick("На СТО продали ще одну машину", "The garage has sold another car").to_string(),
                    text: if l.en() { format!("{who} now drives a “{name}”. The mechanic promises: “She's got plenty of miles left in her.”") } else { format!("{who} тепер їздить на машині «{name}». Механік обіцяє: «Ще побігає».") },
                    photo: d.sto_site.clone(),
                    weight: 20,
                    section: roads.to_string(),
                });
            } else if what == "found" && !out.iter().any(|s| s.section == found) {
                out.push(DriverStory {
                    headline: l.pick("Хтось загубив гроші", "Someone lost some money").to_string(),
                    text: l.pick("На вулиці знайшли кілька монет. Хто загубив — пишіть у редакцію, але, кажуть, шукати марно.", "A few coins were found in the street. If they're yours, write to the editors — though they say it's no use looking.").to_string(),
                    photo: d.town.clone(),
                    weight: 5,
                    section: found.to_string(),
                });
            }
        }
        if !out.iter().any(|s| s.section == crime) {
            for (k, n) in fines {
                out.push(DriverStory {
                    headline: l.pick("Патруль на вулицях", "Patrols on the streets").to_string(),
                    text: match (l.en(), n > 1) {
                        (true, true) => format!("Yesterday the police stopped drivers {n} times for {}. Fines were issued.", fine_name(&k)),
                        (true, false) => format!("Yesterday the police stopped a driver for {}. The fine was issued on the spot.", fine_name(&k)),
                        (false, true) => format!("Учора поліція {n} рази зупиняла водіїв за {}. Штрафи виписано.", fine_name(&k)),
                        (false, false) => format!("Учора поліція зупинила водія за {}. Штраф виписано на місці.", fine_name(&k)),
                    },
                    photo: d.town.clone(),
                    weight: 15,
                    section: crime.to_string(),
                });
            }
        }
        out.sort_by(|a, b| b.weight.cmp(&a.weight));
        out
    }
}
