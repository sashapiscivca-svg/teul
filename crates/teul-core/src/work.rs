//! Shifts at the town's places (docs/world-economy.md §10): the player works for the town like anyone else —
//! at the place, in its hours, once a day; each task is the world's (drawn by the seed, the day, the job and the
//! task's number), answered not faster than a person; the town pays at the end, and remembers.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::core::{Core, CoreError};
use crate::event::EventKind;
use crate::rng::{rand_below, Domain};
use crate::storage::Storage;
use crate::time::WorldTime;

pub const WORK: Domain = Domain(71);

/// A job one can take a shift at.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct WorkDef {
    pub id: String,
    pub location: String,
    /// The prop where the shift is taken (the counter, the sorting table).
    pub prop: String,
    pub name: String,
    /// Who is in charge, as people call them.
    pub boss: String,
    /// The resident who runs the place, when there is one.
    #[serde(default)]
    pub employer: Option<String>,
    /// The hours shifts are worked in.
    pub hours: (u32, u32),
    /// As stations: "daily", "weekdays", "weekends"; unset: not on the great holidays' days off.
    #[serde(default)]
    pub days: Option<String>,
    /// Tasks in a whole shift.
    pub steps: u32,
    /// World minutes at least between two tasks (a guest comes in, the dough rises…).
    pub gap: u32,
    /// Coins for a task done right; one more for a whole shift, as thanks.
    pub pay: u32,
    /// How a task is put: `{what}` is the option asked, `{who}` someone there.
    pub ask: String,
    pub options: Vec<String>,
    /// Said when the shift begins and at the end of a whole one.
    #[serde(default)]
    pub start: String,
    #[serde(default)]
    pub thanks: String,
    /// People who come with the tasks (guests, senders…), for `{who}`.
    #[serde(default)]
    pub who: Vec<String>,
}

/// A shift going on.
#[derive(Clone, Debug, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct Shift {
    pub work: String,
    pub day: u64,
    /// Tasks answered so far.
    pub step: u32,
    pub right: u32,
    /// The world minute of the start or the last task.
    pub last: u64,
}

/// What a place remembers of the player.
#[derive(Clone, Debug, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct WorkRecord {
    pub shifts: u32,
    /// Shifts worked through to the end.
    pub whole: u32,
    pub tasks: u32,
    pub right: u32,
    /// The last day a shift was taken here.
    pub last_day: Option<u64>,
    /// Taken on here (unset in a record kept from before one was taken on: whoever worked here was).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hired: Option<bool>,
}

impl WorkRecord {
    /// Whether one works here now.
    pub fn is_hired(&self) -> bool {
        self.hired.unwrap_or(self.shifts > 0)
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct WorkView {
    pub id: String,
    pub location: String,
    pub prop: String,
    pub name: String,
    pub boss: String,
    pub hours: (u32, u32),
    pub pay: u32,
    /// Taken on here.
    pub hired: bool,
    /// Can a shift be taken here now?
    pub ok: bool,
    /// not_here, not_hired, closed, done_today, busy
    pub reason: Option<String>,
    pub shifts: u32,
    pub whole: u32,
    pub tasks: u32,
    pub right: u32,
    /// How the place speaks of the player: «новенька людина», «надійна людина», «своя людина».
    pub standing: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ShiftView {
    pub work: String,
    pub name: String,
    pub boss: String,
    pub start: String,
    /// The task asked now (one of `options`), and who asks.
    pub asks: String,
    pub who: String,
    /// The whole line: «Олена просить: какао».
    pub line: String,
    pub options: Vec<String>,
    pub step: u32,
    pub steps: u32,
    pub right: u32,
    /// The world minute from which the next task can be done.
    pub ready_at: u64,
    /// Earned so far (right answers).
    pub earned: u32,
    /// The shift is over by itself (closing time, or another day): ending it pays.
    pub over: bool,
}

pub(crate) fn work_key(id: &str) -> u64 {
    crate::npc::stream_of(id)
}

/// The task number `step` of a shift on `day`: an index into the options.
pub(crate) fn task(seed: u64, def: &WorkDef, day: u64, step: u32) -> usize {
    rand_below(seed, WORK, work_key(&def.id), day * 64 + u64::from(step), def.options.len().max(1) as u64) as usize
}

fn who(seed: u64, def: &WorkDef, day: u64, step: u32) -> String {
    if def.who.is_empty() {
        return String::new();
    }
    def.who[rand_below(seed, WORK, work_key(&def.id) ^ 0x5bd1, day * 64 + u64::from(step), def.who.len() as u64) as usize].clone()
}

fn standing(r: &WorkRecord, lang: crate::content::Lang) -> &'static str {
    if r.whole >= 12 && r.right * 10 >= r.tasks * 9 {
        lang.pick("своя людина", "one of the team")
    } else if r.whole >= 3 {
        lang.pick("надійна людина", "someone to rely on")
    } else {
        lang.pick("новенька людина", "the new one")
    }
}

/// Pay for a shift ending now: right tasks, and one more as thanks for a whole one.
pub(crate) fn pay_for(def: &WorkDef, shift: &Shift) -> (u32, bool) {
    let full = shift.step >= def.steps;
    (shift.right * def.pay + if full { def.pay } else { 0 }, full)
}

impl<S: Storage> Core<S> {
    fn work_open(&self, now: WorldTime, def: &WorkDef) -> bool {
        let info = crate::holidays::day_info(self.calendar().date(now));
        match def.days.as_deref() {
            Some("daily") => true,
            Some("weekdays") => !info.day_off,
            Some("weekends") => info.day_off,
            Some(holiday) => info.holiday.is_some_and(|h| h.id == holiday),
            None => !info.holiday.is_some_and(|h| h.day_off),
        }
    }

    fn hour(now: WorldTime) -> u32 {
        (now.minute_of_day() / 60) as u32
    }

    /// The shift going on, if it is still a shift (the same day, before closing).
    fn live_shift(&self, _now: WorldTime) -> Option<(&Shift, &WorkDef)> {
        let s = self.state().shift.as_ref()?;
        let def = self.content().work.get(&s.work)?;
        Some((s, def))
    }

    fn shift_over(now: WorldTime, s: &Shift, def: &WorkDef) -> bool {
        s.day != now.day() || Self::hour(now) >= def.hours.1
    }

    /// The end of the shift going on (if any), for a command that comes after it.
    pub(crate) fn end_shift_events(&self) -> Vec<EventKind> {
        match self.state().shift.as_ref().and_then(|s| self.content().work.get(&s.work).map(|d| (s, d))) {
            Some((s, def)) => {
                let (pay, full) = pay_for(def, s);
                vec![EventKind::ShiftEnded { work: s.work.clone(), day: s.day, steps: s.step, right: s.right, pay, full }]
            }
            None => Vec::new(),
        }
    }

    pub(crate) fn plan_start_shift(&self, now: WorldTime, work: &str) -> Result<Vec<EventKind>, CoreError> {
        let def = self.content().work.get(work).ok_or_else(|| CoreError::UnknownWork(work.to_string()))?;
        if self.location() != def.location {
            return Err(CoreError::NotHere);
        }
        // (a shift from before one was taken on at jobs stays a shift)
        if !self.hired_at(work) && !self.older_rules.get() {
            return Err(CoreError::NotHired);
        }
        let mut events = Vec::new();
        if let Some((s, sdef)) = self.live_shift(now) {
            if Self::shift_over(now, s, sdef) {
                events.extend(self.end_shift_events());
            } else {
                // one shift at a time
                return Err(CoreError::AlreadyDone);
            }
        }
        let hour = Self::hour(now);
        // there must be time for a shift before closing
        if !self.work_open(now, def) || hour < def.hours.0 || hour + 1 >= def.hours.1 {
            return Err(CoreError::Closed);
        }
        if self.state().work_record.get(work).and_then(|r| r.last_day) == Some(now.day()) {
            return Err(CoreError::AlreadyDone);
        }
        events.push(EventKind::ShiftStarted { work: work.to_string(), day: now.day() });
        Ok(events)
    }

    fn hired_at(&self, work: &str) -> bool {
        self.state().work_record.get(work).is_some_and(WorkRecord::is_hired)
    }

    /// Taken on where the job is, at any hour one is there (the shifts keep the hours).
    pub(crate) fn plan_take_job(&self, work: &str) -> Result<Vec<EventKind>, CoreError> {
        let def = self.content().work.get(work).ok_or_else(|| CoreError::UnknownWork(work.to_string()))?;
        if self.location() != def.location {
            return Err(CoreError::NotHere);
        }
        if self.hired_at(work) {
            return Err(CoreError::AlreadyDone);
        }
        Ok(vec![EventKind::JobTaken { work: work.to_string() }])
    }

    /// Leaves a job from anywhere; its shift going on ends (and is paid) first.
    pub(crate) fn plan_leave_job(&self, work: &str) -> Result<Vec<EventKind>, CoreError> {
        if !self.content().work.contains_key(work) {
            return Err(CoreError::UnknownWork(work.to_string()));
        }
        if !self.hired_at(work) {
            return Err(CoreError::NotHired);
        }
        let mut events = Vec::new();
        if self.state().shift.as_ref().is_some_and(|s| s.work == work) {
            events.extend(self.end_shift_events());
        }
        events.push(EventKind::JobLeft { work: work.to_string() });
        Ok(events)
    }

    pub(crate) fn plan_work_step(&self, now: WorldTime, choice: u32) -> Result<Vec<EventKind>, CoreError> {
        let (s, def) = self.live_shift(now).ok_or(CoreError::NoShift)?;
        if Self::shift_over(now, s, def) {
            return Err(CoreError::NoShift);
        }
        if self.location() != def.location {
            return Err(CoreError::NotHere);
        }
        if s.step >= def.steps {
            return Err(CoreError::AlreadyDone);
        }
        if now.0 < s.last + u64::from(def.gap) {
            return Err(CoreError::TooSoon);
        }
        if choice as usize >= def.options.len() {
            return Err(CoreError::NoRequest);
        }
        let right = task(self.meta().seed, def, s.day, s.step) == choice as usize;
        Ok(vec![EventKind::WorkDone { work: s.work.clone(), step: s.step, right }])
    }

    pub(crate) fn plan_end_shift(&self) -> Result<Vec<EventKind>, CoreError> {
        let events = self.end_shift_events();
        if events.is_empty() {
            return Err(CoreError::NoShift);
        }
        Ok(events)
    }

    pub fn works_view(&self, now: WorldTime) -> Vec<WorkView> {
        self.content()
            .work
            .values()
            .map(|def| {
                let r = self.state().work_record.get(&def.id).cloned().unwrap_or_default();
                let reason = match self.plan_start_shift(now, &def.id) {
                    Ok(_) => None,
                    Err(CoreError::NotHere) => Some("not_here"),
                    Err(CoreError::NotHired) => Some("not_hired"),
                    Err(CoreError::Closed) => Some("closed"),
                    Err(CoreError::AlreadyDone) if self.state().shift.is_some() => Some("busy"),
                    Err(_) => Some("done_today"),
                };
                WorkView {
                    id: def.id.clone(),
                    location: def.location.clone(),
                    prop: def.prop.clone(),
                    name: def.name.clone(),
                    boss: def.boss.clone(),
                    hours: def.hours,
                    pay: def.pay,
                    hired: r.is_hired(),
                    ok: reason.is_none(),
                    reason: reason.map(String::from),
                    shifts: r.shifts,
                    whole: r.whole,
                    tasks: r.tasks,
                    right: r.right,
                    standing: standing(&r, self.lang()).to_string(),
                }
            })
            .collect()
    }

    pub fn shift_view(&self, now: WorldTime) -> Option<ShiftView> {
        let (s, def) = self.live_shift(now)?;
        let seed = self.meta().seed;
        let asks = def.options.get(task(seed, def, s.day, s.step)).cloned().unwrap_or_default();
        let who = who(seed, def, s.day, s.step);
        let line = def.ask.replace("{what}", &asks).replace("{who}", if who.is_empty() { self.lang().pick("Гість", "A guest") } else { &who });
        Some(ShiftView {
            work: s.work.clone(),
            name: def.name.clone(),
            boss: def.boss.clone(),
            start: def.start.clone(),
            asks,
            who,
            line,
            options: def.options.clone(),
            step: s.step,
            steps: def.steps,
            right: s.right,
            ready_at: s.last + u64::from(def.gap),
            earned: s.right * def.pay,
            over: Self::shift_over(now, s, def) || s.step >= def.steps,
        })
    }
}

/// The state's side: what the events of work do.
pub(crate) fn apply(shift: &mut Option<Shift>, records: &mut BTreeMap<String, WorkRecord>, kind: &EventKind, minute: u64) -> Option<(u32, bool)> {
    match kind {
        EventKind::JobTaken { work } => {
            records.entry(work.clone()).or_default().hired = Some(true);
            None
        }
        EventKind::JobLeft { work } => {
            records.entry(work.clone()).or_default().hired = Some(false);
            None
        }
        EventKind::ShiftStarted { work, day } => {
            *shift = Some(Shift { work: work.clone(), day: *day, step: 0, right: 0, last: minute });
            let r = records.entry(work.clone()).or_default();
            r.shifts += 1;
            r.last_day = Some(*day);
            None
        }
        EventKind::WorkDone { work, right, .. } => {
            if let Some(s) = shift.as_mut().filter(|s| s.work == *work) {
                s.step += 1;
                s.last = minute;
                if *right {
                    s.right += 1;
                }
            }
            let r = records.entry(work.clone()).or_default();
            r.tasks += 1;
            if *right {
                r.right += 1;
            }
            None
        }
        EventKind::ShiftEnded { work, pay, full, .. } => {
            *shift = None;
            if *full {
                records.entry(work.clone()).or_default().whole += 1;
            }
            Some((*pay, *full))
        }
        _ => None,
    }
}
