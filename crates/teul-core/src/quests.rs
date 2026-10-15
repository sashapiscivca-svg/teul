//! Quests v2: things to do in the town, in stages. Authored quests (stories and the year's calendar: holidays,
//! seasons) and the town's daily jobs, drawn each morning from the day — its season, weather, who fell ill
//! yesterday, what burned — with seeded randomness, so every player of a world gets the same jobs and a replay
//! gets the same outcomes. Everything is decided here, in the core; the shell only asks.
//!
//! A stage is one thing to do: be somewhere (at some hours), bring things, use a station, cook a dish, gather at
//! a spot, wait some days, or choose. Using, cooking and gathering move a quest on by themselves (hooks in the
//! command plan); the rest the player does with `QuestStep` where it is to be done.

use std::collections::{BTreeMap, BTreeSet};

use serde::{Deserialize, Serialize};

use crate::core::{Core, CoreError};
use crate::economy::Requires;
use crate::event::EventKind;
use crate::rng::{rand_below, Domain};
use crate::storage::Storage;
use crate::time::{civil_from_days, days_from_civil, Season, WorldTime, MINUTES_PER_DAY};
use crate::unlock::Missing;

pub const JOBS: Domain = Domain(61);
pub const JOB_PEOPLE: Domain = Domain(62);
/// Promises to the town's people one keeps at once (an invisible bound against bots: people simply do not
/// hand more to someone already carrying so many).
pub const MAX_ACTIVE_JOBS: usize = 5;
/// Jobs one takes in a day (the same invisible bound).
pub const JOBS_PER_DAY: u32 = 6;

// ---- content ---------------------------------------------------------------------------------------------

/// What finishing (or choosing) brings. Coins come from the town, never from home (checked in the content).
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields, default)]
pub struct Reward {
    pub coins: u32,
    pub items: Vec<String>,
    /// Recipes learned (cooking ones marked `learn`).
    pub recipes: Vec<String>,
    pub title: Option<String>,
    /// Standing with the town.
    pub rep: i32,
    /// Friendship points with people (story NPCs or residents).
    pub hearts: Vec<(String, i32)>,
}

impl Reward {
    pub fn is_empty(&self) -> bool {
        self.coins == 0 && self.items.is_empty() && self.recipes.is_empty() && self.title.is_none() && self.rep == 0 && self.hearts.is_empty()
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Choice {
    pub label: String,
    /// What happens (said when chosen).
    #[serde(default)]
    pub text: String,
    #[serde(default)]
    pub reward: Reward,
    /// The stage to go on with (default: the next one).
    #[serde(default)]
    pub goto: Option<u32>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "do", rename_all = "snake_case", deny_unknown_fields)]
pub enum StageDo {
    /// Be at a place (in some hours) and say so.
    Go {
        location: String,
        #[serde(default)]
        hours: Option<(u32, u32)>,
    },
    /// Hand things over at a place (from the pocket: item ids or `#tag`).
    Bring { location: String, items: Vec<(String, u32)> },
    /// Use a station (moves on by itself).
    Use { station: String },
    /// Cook a dish at home (moves on by itself).
    Cook { recipe: String },
    /// Gather (or catch) something at a place, or a given thing (moves on by itself).
    Gather {
        location: String,
        #[serde(default)]
        item: Option<String>,
    },
    /// Let some days pass.
    Wait { days: u32 },
    /// Decide.
    Choose {
        #[serde(default)]
        location: Option<String>,
        options: Vec<Choice>,
    },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StageDef {
    /// What to do, said to the player.
    pub text: String,
    pub act: StageDo,
    /// Whom it is about (a person id), for the shell to point at.
    #[serde(default)]
    pub who: Option<String>,
    /// Said when the stage is done.
    #[serde(default)]
    pub done: String,
    /// Things handed to the player when the stage is done.
    #[serde(default)]
    pub gives: Vec<(String, u32)>,
}

/// When a calendar quest may be taken (and must be done by): a date range in the year, or around a holiday.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields, default)]
pub struct When {
    /// (month, day); a range may go over the new year.
    pub from: Option<(u32, u32)>,
    pub to: Option<(u32, u32)>,
    /// A holiday id (see `holidays`): the window is the holiday, `before` days before it to `after` days after.
    pub holiday: Option<String>,
    pub before: u32,
    pub after: u32,
    /// Days to finish it once taken (0: by the end of the window).
    pub days: u32,
}

fn village() -> String {
    "village".to_string()
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct QuestDef {
    pub id: String,
    pub title: String,
    /// story or calendar (calendar quests come back every year).
    #[serde(default)]
    pub kind: String,
    /// A person id, or "board" (the notice board on the square).
    pub giver: String,
    pub giver_name: String,
    /// Where it is taken (the board on the village square takes everything too).
    #[serde(default = "village")]
    pub offer: String,
    #[serde(default)]
    pub intro: String,
    pub stages: Vec<StageDef>,
    #[serde(default)]
    pub reward: Reward,
    #[serde(default)]
    pub when: Option<When>,
    /// Quests that must be done first.
    #[serde(default)]
    pub after: Vec<String>,
    #[serde(default)]
    pub requires: Option<Requires>,
    /// Said at the end.
    #[serde(default)]
    pub bye: String,
    /// Things handed over when it is taken (a parcel to carry, a letter…).
    #[serde(default)]
    pub start_gives: Vec<(String, u32)>,
}

fn one() -> u32 {
    1
}

fn ten() -> u32 {
    10
}

/// A kind of small job the town may have on a day. `{giver}`, `{who}`, `{place}`, `{t1}`…`{t3}` in its texts
/// are filled in when the day's jobs are drawn.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct JobDef {
    pub id: String,
    pub title: String,
    pub text: String,
    /// A fixed giver (a person id)…
    #[serde(default)]
    pub giver: Option<String>,
    /// …or anyone working as one of these (a resident's job role).
    #[serde(default)]
    pub giver_job: Vec<String>,
    /// Where the giver gives it (and where it is taken).
    pub location: String,
    #[serde(default)]
    pub seasons: Vec<Season>,
    /// Only in this weather (clear, cloudy, rain, storm, snow, fog).
    #[serde(default)]
    pub weather: Vec<String>,
    /// "workday", "day_off" or "" (any day).
    #[serde(default)]
    pub on: String,
    /// Only after someone fell ill yesterday ({who} is them).
    #[serde(default)]
    pub needs_ill: bool,
    /// Only after a fire yesterday ({place} is where).
    #[serde(default)]
    pub needs_fire: bool,
    /// Places to pick one from for `{place}` (and a stage location written "{place}").
    #[serde(default)]
    pub places: Vec<String>,
    #[serde(default)]
    pub start_gives: Vec<(String, u32)>,
    pub stages: Vec<StageDef>,
    #[serde(default)]
    pub reward: Reward,
    /// Days to do it (1: the same day).
    #[serde(default = "one")]
    pub days: u32,
    /// How likely it comes up on a day it fits, in percent (for each person ill, for the illness jobs).
    #[serde(default = "ten")]
    pub weight: u32,
}

/// A job of a day, drawn and filled in.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct JobInst {
    /// `job:<day>:<n>`.
    pub key: String,
    pub template: String,
    pub day: u64,
    pub giver: String,
    pub giver_name: String,
    pub location: String,
    pub title: String,
    pub text: String,
    pub stages: Vec<StageDef>,
    pub start_gives: Vec<(String, u32)>,
    pub reward: Reward,
    /// The last world day it may be done.
    pub deadline: u64,
}

// ---- state -----------------------------------------------------------------------------------------------

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct QuestProgress {
    pub stage: u32,
    /// The day the current stage began.
    pub since: u64,
    pub started: u64,
    pub done: bool,
}

// ---- views -----------------------------------------------------------------------------------------------

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct QuestView {
    pub key: String,
    pub id: String,
    pub title: String,
    /// story, calendar or job.
    pub kind: String,
    pub giver: String,
    pub giver_name: String,
    pub stage: u32,
    pub stages: u32,
    /// What to do now.
    pub text: String,
    /// What is said when it is done.
    pub done: String,
    pub act: StageDo,
    pub who: Option<String>,
    /// Where it is to be done (a location id, "home", or empty when anywhere).
    pub location: String,
    /// The player is where it is to be done.
    pub here: bool,
    /// Doing it now would work (with `QuestStep`, or by itself for use/cook/gather).
    pub ready: bool,
    /// Why not, when not: not_here, closed, too_soon, not_enough, pocket_full, other.
    pub reason: Option<String>,
    /// Days still to wait in a waiting stage.
    pub wait_left: u32,
    /// The last world day to finish it (none: no hurry).
    pub deadline: Option<u64>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct OfferView {
    /// What to pass to `QuestStart`.
    pub key: String,
    pub id: String,
    pub title: String,
    pub kind: String,
    pub giver: String,
    pub giver_name: String,
    /// Where it is taken (the board on the village square takes everything too).
    pub offer: String,
    pub intro: String,
    pub stages: Vec<String>,
    pub deadline: Option<u64>,
    pub can_start: bool,
    pub reason: Option<String>,
    pub missing: Vec<Missing>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct DoneView {
    pub key: String,
    pub title: String,
    pub kind: String,
    pub giver_name: String,
    pub day: u64,
    /// What they said at the end.
    pub bye: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct QuestsView {
    pub active: Vec<QuestView>,
    pub offers: Vec<OfferView>,
    pub done: Vec<DoneView>,
    pub missed: Vec<DoneView>,
    pub reputation: i64,
    pub titles: Vec<String>,
}

/// A quest as the engine sees it: an authored one or a job of a day.
#[derive(Clone, Debug)]
pub(crate) struct Quest {
    pub key: String,
    pub id: String,
    pub kind: String,
    pub title: String,
    pub giver: String,
    pub giver_name: String,
    pub offer: String,
    pub intro: String,
    pub stages: Vec<StageDef>,
    pub reward: Reward,
    pub start_gives: Vec<(String, u32)>,
    pub bye: String,
    /// The window it may be taken in (first and last world day), if it has one.
    pub window: Option<(u64, u64)>,
    /// Days to finish once taken (0: by the end of the window).
    pub days: u32,
    pub after: Vec<String>,
    pub requires: Option<Requires>,
}

impl Quest {
    fn from_def(def: &QuestDef, key: String, window: Option<(u64, u64)>) -> Quest {
        Quest {
            key,
            id: def.id.clone(),
            kind: if def.when.is_some() { "calendar".to_string() } else if def.kind.is_empty() { "story".to_string() } else { def.kind.clone() },
            title: def.title.clone(),
            giver: def.giver.clone(),
            giver_name: def.giver_name.clone(),
            offer: def.offer.clone(),
            intro: def.intro.clone(),
            stages: def.stages.clone(),
            reward: def.reward.clone(),
            start_gives: def.start_gives.clone(),
            bye: def.bye.clone(),
            window,
            days: def.when.as_ref().map(|w| w.days).unwrap_or(0),
            after: def.after.clone(),
            requires: def.requires.clone(),
        }
    }

    fn from_job(j: &JobInst) -> Quest {
        Quest {
            key: j.key.clone(),
            id: j.template.clone(),
            kind: "job".to_string(),
            title: j.title.clone(),
            giver: j.giver.clone(),
            giver_name: j.giver_name.clone(),
            offer: j.location.clone(),
            intro: j.text.clone(),
            stages: j.stages.clone(),
            reward: j.reward.clone(),
            start_gives: j.start_gives.clone(),
            bye: String::new(),
            window: Some((j.day, j.day)),
            days: (j.deadline - j.day + 1) as u32,
            after: Vec::new(),
            requires: None,
        }
    }

    /// The last world day it may be finished, once taken on `started`.
    pub(crate) fn deadline(&self, started: u64) -> Option<u64> {
        if self.days > 0 {
            Some(started + u64::from(self.days) - 1)
        } else {
            self.window.map(|(_, end)| end)
        }
    }
}

/// Where a stage is done (empty: anywhere).
pub(crate) fn stage_location(act: &StageDo) -> String {
    match act {
        StageDo::Go { location, .. } | StageDo::Bring { location, .. } | StageDo::Gather { location, .. } => location.clone(),
        StageDo::Choose { location, .. } => location.clone().unwrap_or_default(),
        StageDo::Cook { .. } => "home".to_string(),
        StageDo::Use { .. } | StageDo::Wait { .. } => String::new(),
    }
}

fn fill(text: &str, vars: &BTreeMap<&str, String>) -> String {
    let mut out = text.to_string();
    for (k, v) in vars {
        out = out.replace(&format!("{{{k}}}"), v);
    }
    out
}

fn fill_stage(s: &StageDef, vars: &BTreeMap<&str, String>, place: Option<&str>) -> StageDef {
    let mut s = s.clone();
    s.text = fill(&s.text, vars);
    s.done = fill(&s.done, vars);
    let loc = |l: &mut String| {
        if l == "{place}" {
            if let Some(p) = place {
                *l = p.to_string();
            }
        }
    };
    match &mut s.act {
        StageDo::Go { location, .. } | StageDo::Bring { location, .. } | StageDo::Gather { location, .. } => loc(location),
        StageDo::Choose { location: Some(location), options } => {
            loc(location);
            for o in options {
                o.text = fill(&o.text, vars);
            }
        }
        _ => {}
    }
    s
}

fn sky_id(s: crate::daily::Sky) -> &'static str {
    use crate::daily::Sky;
    match s {
        Sky::Clear => "clear",
        Sky::Cloudy => "cloudy",
        Sky::Rain => "rain",
        Sky::Storm => "storm",
        Sky::Snow => "snow",
        Sky::Fog => "fog",
    }
}

/// The window (first and last date, as day numbers) of a `When` that opens in a year.
pub fn window_in(when: &When, year: i64) -> Option<(i64, i64)> {
    if let Some(h) = &when.holiday {
        let d = crate::holidays::date_of(h, year)?;
        return Some((d - i64::from(when.before), d + i64::from(when.after)));
    }
    let (fm, fd) = when.from?;
    let (tm, td) = when.to.unwrap_or((fm, fd));
    let start = days_from_civil(year, fm, fd);
    let mut end = days_from_civil(year, tm, td);
    if end < start {
        end = days_from_civil(year + 1, tm, td);
    }
    Some((start, end))
}

// ---- the core side ---------------------------------------------------------------------------------------

impl<S: Storage> Core<S> {
    fn world_day(&self, date: i64) -> Option<u64> {
        let d = date - self.calendar().first_day;
        (d >= 0).then_some(d as u64)
    }

    /// The calendar window (in world days) of an authored quest that contains `day`, with the year it opened.
    fn window_now(&self, when: &When, day: u64) -> Option<(u64, u64, i64)> {
        let date = self.calendar().first_day + day as i64;
        let (y, _, _) = civil_from_days(date);
        for year in [y - 1, y] {
            if let Some((s, e)) = window_in(when, year) {
                if date >= s && date <= e {
                    let start = self.world_day(s).unwrap_or(0);
                    let end = self.world_day(e)?;
                    return Some((start, end, year));
                }
            }
        }
        None
    }

    /// An authored quest or a job, by the key the player passes (a quest id, `id@year`, or `job:day:n`).
    pub(crate) fn quest_by_key(&self, key: &str) -> Option<Quest> {
        let content = self.content();
        if let Some(rest) = key.strip_prefix("job:") {
            let (d, _) = rest.split_once(':')?;
            let day: u64 = d.parse().ok()?;
            let _ = day;
            return self.job_by_key(key).map(|j| Quest::from_job(&j));
        }
        if let Some((id, year)) = key.split_once('@') {
            let def = content.quests.get(id)?;
            let when = def.when.as_ref()?;
            let year: i64 = year.parse().ok()?;
            let (s, e) = window_in(when, year)?;
            let window = (self.world_day(s).unwrap_or(0), self.world_day(e)?);
            return Some(Quest::from_def(def, key.to_string(), Some(window)));
        }
        let def = content.quests.get(key)?;
        if def.when.is_some() {
            return None;
        }
        Some(Quest::from_def(def, key.to_string(), None))
    }

    /// The quest an id stands for today: an authored story quest, this year's calendar quest, or a job.
    fn quest_now(&self, key_or_id: &str, now: WorldTime) -> Option<Quest> {
        if key_or_id.contains('@') || key_or_id.starts_with("job:") {
            return self.quest_by_key(key_or_id);
        }
        let def = self.content().quests.get(key_or_id)?;
        match &def.when {
            None => Some(Quest::from_def(def, def.id.clone(), None)),
            Some(when) => {
                let (s, e, year) = self.window_now(when, now.day())?;
                Some(Quest::from_def(def, format!("{}@{year}", def.id), Some((s, e))))
            }
        }
    }

    fn done_ids(&self) -> BTreeSet<String> {
        self.state().quests.iter().filter(|(_, p)| p.done).map(|(k, _)| k.split('@').next().unwrap_or(k).to_string()).collect()
    }

    /// Why a quest cannot be taken now (None: it can).
    fn start_block(&self, q: &Quest, now: WorldTime) -> Option<(CoreError, Vec<Missing>)> {
        let st = self.state();
        if st.quests.contains_key(&q.key) {
            return Some((CoreError::AlreadyDone, Vec::new()));
        }
        let day = now.day();
        if let Some((s, e)) = q.window {
            if day < s || day > e {
                return Some((CoreError::Closed, Vec::new()));
            }
        }
        let done = self.done_ids();
        let mut missing: Vec<Missing> = q.after.iter().filter(|a| !done.contains(*a)).map(|a| Missing::Help { help: a.clone() }).collect();
        missing.extend(self.missing_for(q.requires.as_ref(), now));
        if !missing.is_empty() {
            return Some((CoreError::Locked(missing.clone()), missing));
        }
        if q.kind == "job" {
            let active = st.quests.iter().filter(|(k, p)| k.starts_with("job:") && !p.done && !self.expired(k, p, day)).count();
            let today = st.jobs_taken.get(&day).copied().unwrap_or(0);
            if active >= MAX_ACTIVE_JOBS || today >= JOBS_PER_DAY {
                return Some((CoreError::TooSoon, Vec::new()));
            }
        }
        let here = self.location();
        if here != q.offer && here != "village" {
            return Some((CoreError::NotHere, Vec::new()));
        }
        let arriving: Vec<String> = q.start_gives.iter().filter(|(i, _)| self.is_carry(i)).flat_map(|(i, n)| std::iter::repeat(i.clone()).take(*n as usize)).collect();
        if !self.fits(&arriving, &[]) {
            return Some((CoreError::PocketFull, Vec::new()));
        }
        None
    }

    /// A quest taken but not finished whose time ran out.
    fn expired(&self, key: &str, p: &QuestProgress, day: u64) -> bool {
        if p.done {
            return false;
        }
        match self.quest_by_key(key) {
            Some(q) => q.deadline(p.started).is_some_and(|d| day > d),
            None => true,
        }
    }

    pub(crate) fn plan_quest_start(&self, now: WorldTime, key: &str) -> Result<Vec<EventKind>, CoreError> {
        let q = self.quest_now(key, now).ok_or_else(|| CoreError::UnknownQuest(key.to_string()))?;
        if let Some((e, _)) = self.start_block(&q, now) {
            return Err(e);
        }
        let gave: Vec<String> = q.start_gives.iter().flat_map(|(id, n)| std::iter::repeat(id.clone()).take(*n as usize)).collect();
        Ok(vec![EventKind::QuestStarted { quest: q.key, day: now.day(), gave }])
    }

    /// Whether the current stage could be done now by the player (a plain step), and what it would take.
    fn stage_check<'q>(&self, q: &'q Quest, p: &QuestProgress, now: WorldTime, choice: Option<u32>) -> Result<(Vec<String>, Option<&'q Choice>), CoreError> {
        let stage = q.stages.get(p.stage as usize).ok_or(CoreError::NoRequest)?;
        let here = self.location();
        let at = |loc: &str| if loc.is_empty() || loc == here { Ok(()) } else { Err(CoreError::NotHere) };
        match &stage.act {
            StageDo::Go { location, hours } => {
                at(location)?;
                if let Some((from, to)) = hours {
                    let h = (now.minute_of_day() / 60) as u32;
                    if h < *from || h >= *to {
                        return Err(CoreError::Closed);
                    }
                }
                Ok((Vec::new(), None))
            }
            StageDo::Bring { location, items } => {
                at(location)?;
                let took = crate::daily::take_for(self.content(), &self.pocket_items(), items).ok_or(CoreError::NotEnough)?;
                Ok((took, None))
            }
            StageDo::Wait { days } => {
                if now.day() < p.since + u64::from(*days) {
                    return Err(CoreError::TooSoon);
                }
                Ok((Vec::new(), None))
            }
            StageDo::Choose { location, options } => {
                at(location.as_deref().unwrap_or(""))?;
                let c = choice.and_then(|c| options.get(c as usize)).ok_or(CoreError::NoRequest)?;
                Ok((Vec::new(), Some(c)))
            }
            // these move on by themselves
            StageDo::Use { .. } | StageDo::Cook { .. } | StageDo::Gather { .. } => Err(CoreError::NoRequest),
        }
    }

    /// The events of finishing a stage: the step, and the end when it was the last.
    fn advance(&self, q: &Quest, p: &QuestProgress, now: WorldTime, took: Vec<String>, choice: Option<(u32, &Choice)>) -> Vec<EventKind> {
        let stage = &q.stages[p.stage as usize];
        let mut gave: Vec<String> = stage.gives.iter().flat_map(|(id, n)| std::iter::repeat(id.clone()).take(*n as usize)).collect();
        let reward = choice.map(|(_, c)| c.reward.clone()).filter(|r| !r.is_empty());
        if let Some(r) = &reward {
            gave.extend(r.items.iter().cloned());
        }
        let next = choice.and_then(|(_, c)| c.goto).unwrap_or(p.stage + 1);
        let mut out = vec![EventKind::QuestAdvanced {
            quest: q.key.clone(),
            day: now.day(),
            stage: p.stage,
            next,
            took: took.clone(),
            gave: gave.clone(),
            choice: choice.map(|(i, _)| i),
            reward: reward.map(|mut r| {
                r.items.clear();
                r
            }),
        }];
        let leaving = took.iter().filter(|i| self.is_carry(i)).count() as u32;
        let finishing = next as usize >= q.stages.len();
        let mut incoming = gave.clone();
        if finishing {
            incoming.extend(q.reward.items.iter().cloned());
        }
        // what does not fit in the pocket is sent home to the chest
        let home = self.overflow(&incoming, leaving);
        if finishing {
            out.push(EventKind::QuestDone { quest: q.key.clone(), day: now.day(), reward: q.reward.clone(), to_chest: !home.is_empty() });
        }
        out.extend(home);
        out
    }

    fn active_quest(&self, key: &str, day: u64) -> Result<(Quest, QuestProgress), CoreError> {
        let p = self.state().quests.get(key).cloned().ok_or_else(|| CoreError::UnknownQuest(key.to_string()))?;
        if p.done {
            return Err(CoreError::AlreadyDone);
        }
        let q = self.quest_by_key(key).ok_or_else(|| CoreError::UnknownQuest(key.to_string()))?;
        if q.deadline(p.started).is_some_and(|d| day > d) {
            return Err(CoreError::Closed);
        }
        Ok((q, p))
    }

    pub(crate) fn plan_quest_step(&self, now: WorldTime, key: &str, choice: Option<u32>) -> Result<Vec<EventKind>, CoreError> {
        let (q, p) = self.active_quest(key, now.day())?;
        let (took, c) = self.stage_check(&q, &p, now, choice)?;
        let stage = &q.stages[p.stage as usize];
        let arriving: Vec<String> = stage.gives.iter().filter(|(i, _)| self.is_carry(i)).flat_map(|(i, n)| std::iter::repeat(i.clone()).take(*n as usize)).collect();
        if !self.fits(&arriving, &took) {
            return Err(CoreError::PocketFull);
        }
        Ok(self.advance(&q, &p, now, took, c.map(|c| (choice.unwrap_or(0), c))))
    }

    /// Quests moved on by what just happened (a station used, a dish cooked, something gathered or caught).
    pub(crate) fn quest_hooks(&self, now: WorldTime, events: &[EventKind]) -> Vec<EventKind> {
        let mut out = Vec::new();
        let day = now.day();
        let content = self.content();
        let active: Vec<(String, QuestProgress)> = self.state().quests.iter().filter(|(_, p)| !p.done).map(|(k, p)| (k.clone(), p.clone())).collect();
        for (key, p) in active {
            let Ok((q, p)) = self.active_quest(&key, day).map(|(q, _)| (q, p)) else { continue };
            let Some(stage) = q.stages.get(p.stage as usize) else { continue };
            let hit = events.iter().any(|e| match (&stage.act, e) {
                (StageDo::Use { station }, EventKind::Used { station: s, .. }) => s == station,
                (StageDo::Cook { recipe }, EventKind::Cooked { recipe: r, .. }) => r == recipe,
                (StageDo::Gather { location, item }, EventKind::Gathered { spot, item: got, .. }) => {
                    content.spot_location.get(spot).is_some_and(|l| l == location) && item.as_ref().is_none_or(|i| i == got)
                }
                (StageDo::Gather { location, item }, EventKind::Caught { place, item: got, .. }) => {
                    content.fishing_location.get(place).is_some_and(|l| l == location) && item.as_ref().is_none_or(|i| i == got)
                }
                _ => false,
            });
            if hit {
                out.extend(self.advance(&q, &p, now, Vec::new(), None));
            }
        }
        out
    }

    // ---- the day's jobs ----------------------------------------------------------------------------------

    /// The town's jobs of a world day (drawn the same at any moment of that day, for everyone).
    pub fn jobs_today(&self, now: WorldTime) -> Vec<JobInst> {
        self.jobs_of_day(now.day())
    }

    pub(crate) fn jobs_of_day(&self, day: u64) -> Vec<JobInst> {
        if let Some(j) = self.jobs_cache.borrow().get(&day) {
            return j.clone();
        }
        let jobs = self.draw_jobs(day);
        let mut cache = self.jobs_cache.borrow_mut();
        if cache.len() > 8 {
            cache.clear();
        }
        cache.insert(day, jobs.clone());
        jobs
    }

    /// Who fell ill and what burned the day before (from the town's simulation; only asked for the jobs that
    /// come from such things, so most jobs never run the simulation, not even when a save is checked on open).
    fn yesterday(&self, day: u64) -> (Vec<String>, Vec<String>) {
        let content = self.content();
        let (mut ill, mut fires) = (Vec::new(), Vec::new());
        if day > 0 && !content.residents.is_empty() {
            let life = self.life_view(WorldTime(day * MINUTES_PER_DAY));
            for i in life.incidents.iter().filter(|i| i.minute >= (day - 1) * MINUTES_PER_DAY && i.minute < day * MINUTES_PER_DAY) {
                match i.kind {
                    crate::life::IncidentKind::Ill => ill.extend(i.who.iter().filter(|w| content.residents.contains_key(*w)).cloned()),
                    crate::life::IncidentKind::Fire => fires.push(i.site.clone()),
                    _ => {}
                }
            }
        }
        (ill, fires)
    }

    /// One kind of need on a day, its `w`-th time (for the ill: the `w`-th person ill): there or not.
    fn job_draw(&self, j: &JobDef, day: u64, w: usize, events: &mut Option<(Vec<String>, Vec<String>)>) -> Option<JobInst> {
        let seed = self.meta().seed;
        let cal = self.calendar();
        let noon = WorldTime(day * MINUTES_PER_DAY + 720);
        let season = cal.season(noon);
        if !j.seasons.is_empty() && !j.seasons.contains(&season) {
            return None;
        }
        if !j.weather.is_empty() && !j.weather.iter().any(|x| x == sky_id(crate::daily::weather_at(seed, noon, season))) {
            return None;
        }
        let info = crate::holidays::day_info(cal.date(noon));
        let on = match j.on.as_str() {
            "workday" => !info.day_off,
            "day_off" => info.day_off,
            _ => true,
        };
        if !on || (w > 0 && !j.needs_ill) || w >= 3 {
            return None;
        }
        if rand_below(seed, JOBS, crate::daily::stream_of(&j.id) << 2 | w as u64, day, 100) >= u64::from(j.weight.min(100)) {
            return None;
        }
        self.giver_for(j, day, 0)?;
        let (ill, fires) = if j.needs_ill || j.needs_fire {
            if events.is_none() {
                *events = Some(self.yesterday(day));
            }
            events.clone().unwrap_or_default()
        } else {
            (Vec::new(), Vec::new())
        };
        if j.needs_fire && fires.is_empty() {
            return None;
        }
        let who: Vec<String> = if j.needs_ill { vec![ill.get(w)?.clone()] } else { Vec::new() };
        Some(self.fill_job(j, day, w, &who, &fires))
    }

    fn draw_jobs(&self, day: u64) -> Vec<JobInst> {
        // each kind of need comes up by its own chance, as things happen; one for each person who fell ill
        let mut events = None;
        let mut out = Vec::new();
        for j in self.content().jobs.values() {
            for w in 0..3 {
                if let Some(inst) = self.job_draw(j, day, w, &mut events) {
                    out.push(inst);
                }
            }
        }
        out
    }

    /// A job by its key (`job:<day>:<kind>:<n>`), drawn on its own.
    pub(crate) fn job_by_key(&self, key: &str) -> Option<JobInst> {
        let rest = key.strip_prefix("job:")?;
        let mut parts = rest.splitn(3, ':');
        let day: u64 = parts.next()?.parse().ok()?;
        let tid = parts.next()?;
        let w: usize = parts.next()?.parse().ok()?;
        if let Some(cached) = self.jobs_cache.borrow().get(&day) {
            return cached.iter().find(|j| j.key == key).cloned();
        }
        let j = self.content().jobs.get(tid)?;
        self.job_draw(j, day, w, &mut None)
    }

    /// Who gives a job on a day (fixed, or someone with that job), with their name.
    fn giver_for(&self, j: &JobDef, day: u64, salt: u64) -> Option<(String, String)> {
        let content = self.content();
        if let Some(g) = &j.giver {
            let name = content.residents.get(g).map(|r| r.name.clone()).or_else(|| content.npcs.get(g).map(|n| n.name.clone()))?;
            return Some((g.clone(), name));
        }
        // by what they do, or (elder, child, adult) by their age — among those living in the town that day
        let here = self.town_people(crate::time::WorldTime(day * crate::time::MINUTES_PER_DAY));
        let people: Vec<&crate::life::ResidentDef> = here
            .iter()
            .filter(|r| r.job.as_ref().is_some_and(|(_, role)| j.giver_job.contains(role)) || j.giver_job.contains(&r.age))
            .collect();
        if people.is_empty() {
            return None;
        }
        let r = people[rand_below(self.meta().seed, JOB_PEOPLE, crate::daily::stream_of(&j.id) ^ salt, day, people.len() as u64) as usize];
        Some((r.id.clone(), r.name.clone()))
    }

    fn fill_job(&self, j: &JobDef, day: u64, n: usize, ill: &[String], fires: &[String]) -> JobInst {
        let content = self.content();
        let seed = self.meta().seed;
        let (giver, giver_name) = self.giver_for(j, day, 0).unwrap_or_default();
        let mut vars: BTreeMap<&str, String> = BTreeMap::new();
        vars.insert("giver", giver_name.clone());
        let name_of = |id: &str| content.residents.get(id).map(|r| r.name.clone()).or_else(|| content.npcs.get(id).map(|n| n.name.clone())).unwrap_or_default();
        if let Some(who) = ill.get(rand_below(seed, JOB_PEOPLE, 7, day, ill.len().max(1) as u64) as usize) {
            vars.insert("who", name_of(who));
        }
        let mut place: Option<String> = None;
        if let Some(site) = fires.first() {
            let loc = content.site_location.get(site).cloned().unwrap_or_else(|| "village".to_string());
            place = Some(loc);
        }
        if !j.places.is_empty() {
            place = Some(j.places[rand_below(seed, JOB_PEOPLE, 11 + n as u64, day, j.places.len() as u64) as usize].clone());
        }
        if let Some(p) = &place {
            vars.insert("place", content.locations.get(p).map(|l| l.name.clone()).unwrap_or_else(|| p.clone()));
        }
        // neighbours to visit: grown-ups of the town, not the giver, different ones
        let here = self.town_people(crate::time::WorldTime(day * crate::time::MINUTES_PER_DAY));
        let mut folk: Vec<&crate::life::ResidentDef> = here.iter().filter(|r| r.age != "child" && r.id != giver).collect();
        let mut names = Vec::new();
        for t in 0..3u64 {
            if folk.is_empty() {
                names.push(content.npcs.values().nth(t as usize % content.npcs.len().max(1)).map(|n| n.name.clone()).unwrap_or_default());
                continue;
            }
            let i = rand_below(seed, JOB_PEOPLE, 20 + t + n as u64 * 3, day, folk.len() as u64) as usize;
            names.push(folk.remove(i).name.clone());
        }
        for (i, name) in names.iter().enumerate() {
            vars.insert(["t1", "t2", "t3"][i], name.clone());
        }
        JobInst {
            key: format!("job:{day}:{}:{n}", j.id),
            template: j.id.clone(),
            day,
            giver: giver.clone(),
            giver_name,
            location: j.location.clone(),
            title: fill(&j.title, &vars),
            text: fill(&j.text, &vars),
            stages: j.stages.iter().map(|s| fill_stage(s, &vars, place.as_deref())).collect(),
            start_gives: j.start_gives.clone(),
            // thanks from the giver themself ("{giver}" in the hearts is whoever gives it today)
            reward: {
                let mut r = j.reward.clone();
                for h in &mut r.hearts {
                    if h.0 == "{giver}" {
                        h.0 = giver.clone();
                    }
                }
                r.hearts.retain(|h| !h.0.is_empty());
                r
            },
            deadline: day + u64::from(j.days.max(1)) - 1,
        }
    }

    // ---- the journal ---------------------------------------------------------------------------------------

    pub fn quests_view(&self, now: WorldTime) -> QuestsView {
        let st = self.state();
        let day = now.day();
        let mut active = Vec::new();
        let mut done = Vec::new();
        let mut missed = Vec::new();
        for (key, p) in &st.quests {
            let Some(q) = self.quest_by_key(key) else { continue };
            let dv = |d: u64| DoneView { key: key.clone(), title: q.title.clone(), kind: q.kind.clone(), giver_name: q.giver_name.clone(), day: d, bye: q.bye.clone() };
            if p.done {
                done.push(dv(p.since));
                continue;
            }
            let deadline = q.deadline(p.started);
            if deadline.is_some_and(|d| day > d) {
                missed.push(dv(deadline.unwrap_or(day)));
                continue;
            }
            let Some(stage) = q.stages.get(p.stage as usize) else { continue };
            let location = stage_location(&stage.act);
            let check = match &stage.act {
                StageDo::Use { station } => self.content().stations.get(station).map(|d| self.station_plan(now, d).map(|_| ())).unwrap_or(Err(CoreError::NoRequest)),
                StageDo::Cook { .. } | StageDo::Gather { .. } => Ok(()),
                StageDo::Choose { .. } => self.stage_check(&q, p, now, Some(0)).map(|_| ()),
                _ => self.stage_check(&q, p, now, None).map(|_| ()),
            };
            // a station is used where it stands
            let location = match &stage.act {
                StageDo::Use { station } => self.content().stations.get(station).map(|s| s.location.clone()).unwrap_or_default(),
                _ => location,
            };
            let here = location.is_empty() || location == self.location();
            let (reason, _) = match &check {
                Ok(_) => (None, Vec::new()),
                Err(e) => crate::core::reason_of(e),
            };
            let wait_left = match &stage.act {
                StageDo::Wait { days } => (p.since + u64::from(*days)).saturating_sub(day) as u32,
                _ => 0,
            };
            active.push(QuestView {
                key: key.clone(),
                id: q.id.clone(),
                title: q.title.clone(),
                kind: q.kind.clone(),
                giver: q.giver.clone(),
                giver_name: q.giver_name.clone(),
                stage: p.stage,
                stages: q.stages.len() as u32,
                text: stage.text.clone(),
                done: stage.done.clone(),
                act: stage.act.clone(),
                who: stage.who.clone(),
                here,
                location,
                ready: check.is_ok(),
                reason,
                wait_left,
                deadline,
            });
        }
        // what may be taken today: this year's calendar quests in their window, story quests, the day's jobs
        let mut offers = Vec::new();
        let done_ids = self.done_ids();
        for def in self.content().quests.values() {
            if def.when.is_none() && done_ids.contains(&def.id) {
                continue;
            }
            let Some(q) = self.quest_now(&def.id, now) else { continue };
            if st.quests.contains_key(&q.key) {
                continue;
            }
            offers.push(self.offer_view(&q, now));
        }
        for j in self.jobs_of_day(day) {
            if st.quests.contains_key(&j.key) {
                continue;
            }
            offers.push(self.offer_view(&Quest::from_job(&j), now));
        }
        QuestsView {
            active,
            offers,
            done,
            missed,
            reputation: st.reputation,
            titles: st.titles.iter().cloned().collect(),
        }
    }

    fn offer_view(&self, q: &Quest, now: WorldTime) -> OfferView {
        let block = self.start_block(q, now);
        let (reason, missing) = match &block {
            None => (None, Vec::new()),
            Some((e, m)) => (crate::core::reason_of(e).0, m.clone()),
        };
        OfferView {
            key: q.key.clone(),
            id: q.id.clone(),
            title: q.title.clone(),
            kind: q.kind.clone(),
            giver: q.giver.clone(),
            giver_name: q.giver_name.clone(),
            offer: q.offer.clone(),
            intro: q.intro.clone(),
            stages: q.stages.iter().map(|s| s.text.clone()).collect(),
            deadline: q.deadline(now.day()),
            // only a block that the player can lift by walking (not here) still shows it as takeable
            can_start: block.as_ref().is_none_or(|(e, _)| matches!(e, CoreError::NotHere)),
            reason,
            missing,
        }
    }

    /// The days' town events to come (holidays in the next two weeks), for the paper.
    pub fn events_ahead(&self, now: WorldTime, days: u64) -> Vec<(u64, &'static str)> {
        let cal = self.calendar();
        (0..days)
            .filter_map(|d| {
                let date = cal.date(WorldTime((now.day() + d) * MINUTES_PER_DAY));
                crate::holidays::holiday(date).filter(|h| h.festive || h.day_off).map(|h| (d, crate::holidays::name_in(h.id, self.lang())))
            })
            .collect()
    }
}

/// Every month of the year has its calendar quests: the number of authored calendar quests whose window touches
/// each month (index 0 = January) in a given year.
pub fn per_month(quests: &BTreeMap<String, QuestDef>, year: i64) -> [u32; 12] {
    let mut out = [0u32; 12];
    for q in quests.values() {
        let Some(w) = &q.when else { continue };
        let Some((s, e)) = window_in(w, year) else { continue };
        let mut seen = [false; 12];
        let mut d = s;
        while d <= e {
            let (_, m, _) = civil_from_days(d);
            seen[(m - 1) as usize] = true;
            d += 1;
        }
        for (i, s) in seen.iter().enumerate() {
            if *s {
                out[i] += 1;
            }
        }
    }
    out
}
