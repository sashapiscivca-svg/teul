//! The garden (docs/world-economy.md §10): a bought seed and care turn into food over real days. Growth is
//! never stored — it is read from the planting day, the days watered and the days it rained. A few dry days in a
//! row wilt a plant, more kill it; trees fruit in their season, again and again. Nothing here earns coins.

use std::collections::{BTreeMap, BTreeSet};

use serde::{Deserialize, Serialize};

use crate::core::{Core, CoreError};
use crate::event::EventKind;
use crate::storage::Storage;
use crate::time::{Season, WorldTime, MINUTES_PER_DAY};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PlantDef {
    pub id: String,
    pub name: String,
    /// The seed (or sapling) it grows from: a carried item, spent at planting.
    pub seed: String,
    #[serde(default)]
    pub tree: bool,
    /// Growth days needed for each stage (the first 0): seed, sprout, young, ripe…
    pub stages: Vec<u32>,
    /// The look of each stage (item ids, drawn on the plot).
    pub models: Vec<String>,
    /// The look of a plant that died.
    pub dead_model: String,
    /// What a ripe plant gives, and how many.
    pub harvest: (String, u32),
    /// Seasons it grows in out of doors (empty: spring, summer and autumn).
    #[serde(default)]
    pub seasons: Vec<Season>,
    /// Dry days in a row before it wilts, and before it dies.
    pub thirst: u32,
    pub die: u32,
    /// A tree fruits again this many days after a harvest…
    #[serde(default)]
    pub fruit_every: u32,
    /// …in these seasons (empty: whenever it grows).
    #[serde(default)]
    pub fruit_seasons: Vec<Season>,
}

/// What is planted in a plot (a placed item tagged `plot`).
#[derive(Clone, Debug, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct PlotState {
    pub plant: String,
    pub planted: u64,
    /// The days it was watered.
    pub watered: BTreeSet<u64>,
    /// The day of the last harvest (trees).
    pub harvested: Option<u64>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PlotView {
    pub pid: u32,
    pub item: String,
    pub indoor: bool,
    pub plant: Option<String>,
    pub name: String,
    pub growth: u32,
    pub stage: u32,
    pub stages: u32,
    /// What to draw on the plot.
    pub model: Option<String>,
    pub ripe: bool,
    /// Something to pick now (a ripe bed; a tree with fruit).
    pub ready: bool,
    pub wilting: bool,
    pub dead: bool,
    /// Not watered today and not rained on: it would like water.
    pub thirsty: bool,
    pub watered_today: bool,
    /// A few warm words about it: «молоді кущики», «просить пити»…
    pub words: String,
}

/// What reading a plot's days found.
struct Growth {
    growth: u32,
    wilting: bool,
    dead: bool,
    wet_today: bool,
}

fn grows_in(def: &PlantDef, indoor: bool, season: Season) -> bool {
    indoor || if def.seasons.is_empty() { season != Season::Winter } else { def.seasons.contains(&season) }
}

impl<S: Storage> Core<S> {
    /// Whether it rained (or stormed) on the world day of `t`.
    pub fn rained(&self, t: WorldTime) -> bool {
        let noon = WorldTime(t.day() * MINUTES_PER_DAY + 13 * 60);
        let season = self.calendar().season(noon);
        matches!(crate::daily::weather_at(self.meta().seed, noon, season), crate::daily::Sky::Rain | crate::daily::Sky::Storm)
    }

    fn plot_item(&self, pid: u32) -> Result<(&str, bool), CoreError> {
        let p = self.state().room.placements.get(&pid).ok_or(CoreError::UnknownPlacement(pid))?;
        let def = self.content().items.get(&p.item).ok_or_else(|| CoreError::UnknownItem(p.item.clone()))?;
        if !def.tags.iter().any(|t| t == "plot") {
            return Err(CoreError::ActionNotAvailable);
        }
        Ok((p.item.as_str(), def.tags.iter().any(|t| t == "indoor")))
    }

    fn grow(&self, def: &PlantDef, plot: &PlotState, indoor: bool, now: WorldTime) -> Growth {
        let today = now.day();
        let mut growth = 0u32;
        let mut dry = 0u32;
        let mut wilting = false;
        let mut dead = false;
        let ripe_at = def.stages.last().copied().unwrap_or(0);
        for day in plot.planted + 1..=today {
            let t = WorldTime(day * MINUTES_PER_DAY + 12 * 60);
            let growing = grows_in(def, indoor, self.calendar().season(t));
            let wet = plot.watered.contains(&day) || (!indoor && self.rained(t));
            if !growing {
                // resting through the cold: thirst does not count
                dry = 0;
                wilting = false;
                continue;
            }
            if wet {
                dry = 0;
            } else {
                dry += 1;
            }
            if dry >= def.die {
                dead = true;
                break;
            }
            wilting = dry >= def.thirst;
            if !wilting && growth < ripe_at {
                growth += 1;
            }
        }
        let wet_today = today == plot.planted || plot.watered.contains(&today) || (!indoor && self.rained(now));
        Growth { growth, wilting: wilting && !dead, dead, wet_today }
    }

    fn plot_view(&self, pid: u32, now: WorldTime) -> Option<PlotView> {
        let (item, indoor) = self.plot_item(pid).ok()?;
        let content = self.content();
        let Some(plot) = self.state().plots.get(&pid) else {
            return Some(PlotView { pid, item: item.to_string(), indoor, plant: None, name: String::new(), growth: 0, stage: 0, stages: 0, model: None, ripe: false, ready: false, wilting: false, dead: false, thirsty: false, watered_today: false, words: self.lang().pick("порожня грядка", "an empty bed").into() });
        };
        let def = content.plants.get(&plot.plant)?;
        let g = self.grow(def, plot, indoor, now);
        let stage = def.stages.iter().rposition(|need| g.growth >= *need).unwrap_or(0) as u32;
        let ripe = !g.dead && g.growth >= def.stages.last().copied().unwrap_or(0);
        let season = self.calendar().season(now);
        let fruiting = def.fruit_seasons.is_empty() || def.fruit_seasons.contains(&season);
        let ready = ripe && if def.tree { fruiting && plot.harvested.is_none_or(|h| now.day() >= h + u64::from(def.fruit_every.max(1))) } else { true };
        let model = if g.dead { Some(def.dead_model.clone()) } else { def.models.get(stage as usize).cloned() };
        let l = self.lang();
        let growing = l.pick(["щойно посіяне", "проклюнулося", "росте", "наливається"][stage.min(3) as usize], ["just sown", "sprouting", "growing", "filling out"][stage.min(3) as usize]);
        let words = if g.dead {
            l.pick("засохло — треба прибрати", "dried out — needs clearing").to_string()
        } else if g.wilting {
            l.pick("в'яне — просить пити", "wilting — wants water").to_string()
        } else if ready {
            if def.tree { l.pick("можна збирати плоди", "the fruit can be picked").into() } else { l.pick("достигло — можна збирати", "ripe — ready to harvest").into() }
        } else if !g.wet_today && grows_in(def, indoor, season) {
            growing.to_string() + l.pick(" — хоче пити", " — wants water")
        } else {
            growing.to_string()
        };
        Some(PlotView {
            pid,
            item: item.to_string(),
            indoor,
            plant: Some(plot.plant.clone()),
            name: def.name.clone(),
            growth: g.growth,
            stage,
            stages: def.stages.len() as u32,
            model,
            ripe,
            ready,
            wilting: g.wilting,
            dead: g.dead,
            thirsty: !g.dead && !g.wet_today,
            watered_today: plot.watered.contains(&now.day()) || now.day() == plot.planted,
            words,
        })
    }

    /// Every plot at home with what grows in it.
    pub fn garden_view(&self, now: WorldTime) -> Vec<PlotView> {
        let content = self.content();
        let mut out: Vec<PlotView> = self
            .state()
            .room
            .placements
            .values()
            .filter(|p| content.items.get(&p.item).is_some_and(|d| d.tags.iter().any(|t| t == "plot")))
            .filter_map(|p| self.plot_view(p.pid, now))
            .collect();
        out.sort_by_key(|p| p.pid);
        out
    }

    pub(crate) fn plan_plant(&self, now: WorldTime, pid: u32, seed: &str) -> Result<Vec<EventKind>, CoreError> {
        self.plot_item(pid)?;
        if self.location() != "home" {
            return Err(CoreError::NotHere);
        }
        if self.state().plots.contains_key(&pid) {
            return Err(CoreError::AlreadyDone);
        }
        let plant = self.content().plants.values().find(|p| p.seed == seed).ok_or(CoreError::NotEnough)?;
        if self.in_pocket(seed) == 0 {
            return Err(CoreError::NotEnough);
        }
        Ok(vec![EventKind::Planted { pid, plant: plant.id.clone(), seed: seed.to_string(), day: now.day() }])
    }

    pub(crate) fn plan_water(&self, now: WorldTime, pid: u32) -> Result<Vec<EventKind>, CoreError> {
        let (_, _) = self.plot_item(pid)?;
        if self.location() != "home" {
            return Err(CoreError::NotHere);
        }
        let view = self.plot_view(pid, now).ok_or(CoreError::NothingThere)?;
        if view.plant.is_none() || view.dead {
            return Err(CoreError::NothingThere);
        }
        if view.watered_today {
            return Err(CoreError::AlreadyDone);
        }
        // with the tap off, a bucket from the rain barrel still does
        let bucket = !self.utility_on(now, "water");
        if bucket && !self.owns_tool("bucket") {
            return Err(CoreError::UtilityOff("water".into()));
        }
        let can = self.owns_tool("hand_watering_can");
        let mut events = vec![EventKind::Watered { pid, day: now.day(), can }];
        events.extend(self.tool_used(if bucket { "bucket" } else { "hand_watering_can" }));
        Ok(events)
    }

    pub(crate) fn plan_harvest(&self, now: WorldTime, pid: u32) -> Result<Vec<EventKind>, CoreError> {
        self.plot_item(pid)?;
        if self.location() != "home" {
            return Err(CoreError::NotHere);
        }
        let view = self.plot_view(pid, now).ok_or(CoreError::NothingThere)?;
        if !view.ready {
            return Err(CoreError::NothingThere);
        }
        let plot = &self.state().plots[&pid];
        let def = &self.content().plants[&plot.plant];
        let (item, n) = def.harvest.clone();
        let mut n = n + crate::skills::harvest_bonus(crate::skills::level_of(self.practice("gardening")));
        // a spade digs out what hands would miss; fertilizer under the bed gives more (and is used up)
        let mut tools = Vec::new();
        for t in ["shovel", "fertilizer"] {
            if self.owns_tool(t) {
                n += 1;
                tools.push(t.to_string());
            }
        }
        if !self.fits(&vec![item.clone(); n as usize], &[]) {
            return Err(CoreError::PocketFull);
        }
        let mut events = vec![EventKind::Harvested { pid, plant: plot.plant.clone(), day: now.day(), item, n, cleared: !def.tree }];
        events.extend(self.tools_used(&tools));
        Ok(events)
    }

    pub(crate) fn plan_clear_plot(&self, pid: u32) -> Result<Vec<EventKind>, CoreError> {
        self.plot_item(pid)?;
        if self.location() != "home" {
            return Err(CoreError::NotHere);
        }
        if !self.state().plots.contains_key(&pid) {
            return Err(CoreError::NothingThere);
        }
        Ok(vec![EventKind::PlotCleared { pid }])
    }
}

/// The state's side of the garden's events.
pub(crate) fn apply(plots: &mut BTreeMap<u32, PlotState>, kind: &EventKind) {
    match kind {
        EventKind::Planted { pid, plant, day, .. } => {
            plots.insert(*pid, PlotState { plant: plant.clone(), planted: *day, watered: BTreeSet::new(), harvested: None });
        }
        EventKind::Watered { pid, day, can } => {
            if let Some(p) = plots.get_mut(pid) {
                p.watered.insert(*day);
                if *can {
                    p.watered.insert(*day + 1);
                }
            }
        }
        EventKind::Harvested { pid, day, cleared, .. } => {
            if *cleared {
                plots.remove(pid);
            } else if let Some(p) = plots.get_mut(pid) {
                p.harvested = Some(*day);
            }
        }
        EventKind::PlotCleared { pid } | EventKind::Stored { pid } => {
            plots.remove(pid);
        }
        _ => {}
    }
}
