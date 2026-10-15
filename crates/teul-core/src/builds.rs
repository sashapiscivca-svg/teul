//! Building on to one's own house (docs/world-economy.md §17). The town's builders take an order at the utility
//! office or the town hall: a kitchen, a bedroom, a bath, a workshop, a music room, an attic, a cellar, a second
//! floor, a terrace, a yard. It is paid when ordered and built over real days — the site stands next to the house
//! with its scaffolding and its crew — then the keys are handed over: the new room joins the house (its floor
//! counts toward what the house may have), with what the order included. Only an owner builds on; a tenant
//! cannot. One order at a time: the town has one crew.

use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};

use crate::core::{Core, CoreError};
use crate::event::EventKind;
use crate::storage::Storage;
use crate::time::WorldTime;

/// Where the builders take orders.
pub const OFFICES: [&str; 2] = ["utility_in", "townhall_in"];
/// How far from the house's first corner a room may stand (the shell's plan is 32×32).
pub const LIMIT: i32 = 32;

/// A room that can be ordered (content).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BuildDef {
    pub id: String,
    pub name: String,
    /// room, garden, farm, orangery, terrace, attic, cellar, upstairs: how the shell builds and dresses it.
    pub kind: String,
    pub w: i32,
    pub d: i32,
    pub price: u32,
    /// Real days the crew works.
    pub days: u32,
    /// What the floor and the walls are done in (styles given with the room).
    #[serde(default)]
    pub floor: Option<String>,
    #[serde(default)]
    pub wall: Option<String>,
    /// The shell's furnishing plan (homeplan.ts), if any.
    #[serde(default)]
    pub plan: Option<String>,
    /// What comes with it (furniture, a door or the stairs), given when the keys are handed over.
    #[serde(default)]
    pub items: Vec<String>,
    #[serde(default)]
    pub text: String,
}

/// An order of the player's.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct BuildOrder {
    pub build: String,
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub d: i32,
    pub day: u64,
    pub ready: u64,
    pub done: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct BuildOffer {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub w: i32,
    pub d: i32,
    pub price: u32,
    pub days: u32,
    pub text: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct OrderView {
    pub n: u32,
    pub build: String,
    pub name: String,
    pub kind: String,
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub d: i32,
    pub day: u64,
    pub ready: u64,
    /// The keys can be handed over now.
    pub due: bool,
    pub done: bool,
    /// How far along, in words (the walls are up…).
    pub words: String,
    /// 0..=3: dug, walls, roof, done (the shell draws the site by it).
    pub stage: u32,
    pub floor: Option<String>,
    pub wall: Option<String>,
    pub plan: Option<String>,
    pub items: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct BuildsView {
    /// The player stands where orders are taken.
    pub here: bool,
    /// The house is the player's own (a tenant cannot build on).
    pub owner: bool,
    pub offers: Vec<BuildOffer>,
    pub orders: Vec<OrderView>,
}

/// The words of a site on a day of its work.
pub fn stage_of(order: &BuildOrder, day: u64) -> u32 {
    if order.done {
        return 3;
    }
    let total = order.ready.saturating_sub(order.day).max(1);
    let gone = day.saturating_sub(order.day).min(total);
    ((gone * 3) / total).min(2) as u32
}

const STAGE_WORDS: [&str; 4] = ["Котлован і фундамент", "Зводять стіни", "Кладуть дах і вставляють вікна", "Готово"];
const STAGE_WORDS_EN: [&str; 4] = ["Digging the pit and laying the foundation", "The walls are going up", "Roofing and fitting the windows", "Done"];

impl<S: Storage> Core<S> {
    fn owner_of_house(&self, now: WorldTime) -> bool {
        let address = self.address(now);
        self.home_is_owned(&address)
    }

    /// Cells of the house now (the start rectangle and what was added, less what was taken away).
    fn house_cells(&self) -> BTreeSet<(i32, i32)> {
        crate::room::cells(self.content(), &self.state().room)
    }

    pub(crate) fn plan_order_build(&self, now: WorldTime, build: &str, x: i32, y: i32) -> Result<Vec<EventKind>, CoreError> {
        let def = self.content().builds.get(build).ok_or(CoreError::NothingThere)?;
        if !OFFICES.contains(&self.location()) {
            return Err(CoreError::NotHere);
        }
        if !self.owner_of_house(now) {
            return Err(CoreError::Tenant);
        }
        if self.state().builds.iter().any(|o| !o.done) {
            return Err(CoreError::TooSoon);
        }
        // the site: free, inside the plan, along the house
        if x < 0 || y < 0 || x + def.w > LIMIT || y + def.d > LIMIT {
            return Err(CoreError::Needs("site".into()));
        }
        let cells = self.house_cells();
        let mut touches = false;
        for j in 0..def.d {
            for i in 0..def.w {
                let (cx, cy) = (x + i, y + j);
                if cells.contains(&(cx, cy)) {
                    return Err(CoreError::Needs("site".into()));
                }
                touches |= [(1, 0), (-1, 0), (0, 1), (0, -1)].iter().any(|(dx, dy)| cells.contains(&(cx + dx, cy + dy)));
            }
        }
        if !touches {
            return Err(CoreError::Needs("site".into()));
        }
        let have = self.wallet().coins;
        if have < u64::from(def.price) {
            return Err(CoreError::Locked(vec![crate::unlock::Missing::Coins { have, need: u64::from(def.price) }]));
        }
        let day = now.day();
        Ok(vec![EventKind::BuildOrdered { build: build.to_string(), x, y, w: def.w, d: def.d, coins: def.price, day, ready: day + u64::from(def.days) }])
    }

    pub(crate) fn plan_finish_build(&self, now: WorldTime, n: u32) -> Result<Vec<EventKind>, CoreError> {
        let order = self.state().builds.get(n as usize).ok_or(CoreError::NothingThere)?;
        if order.done {
            return Err(CoreError::AlreadyDone);
        }
        if now.day() < order.ready {
            return Err(CoreError::TooSoon);
        }
        let def = self.content().builds.get(&order.build).ok_or(CoreError::NothingThere)?;
        let styles: Vec<String> = def.floor.iter().chain(def.wall.iter()).filter(|s| self.content().styles.contains_key(*s)).cloned().collect();
        Ok(vec![EventKind::BuildFinished { n, area: (order.w * order.d) as u32, items: def.items.clone(), styles }])
    }

    pub fn builds_view(&self, now: WorldTime) -> BuildsView {
        let content = self.content();
        let day = now.day();
        let offers = content
            .builds
            .values()
            .map(|d| BuildOffer { id: d.id.clone(), name: d.name.clone(), kind: d.kind.clone(), w: d.w, d: d.d, price: d.price, days: d.days, text: d.text.clone() })
            .collect();
        let orders = self
            .state()
            .builds
            .iter()
            .enumerate()
            .map(|(n, o)| {
                let def = content.builds.get(&o.build);
                let stage = stage_of(o, day);
                OrderView {
                    n: n as u32,
                    build: o.build.clone(),
                    name: def.map(|d| d.name.clone()).unwrap_or_default(),
                    kind: def.map(|d| d.kind.clone()).unwrap_or_default(),
                    x: o.x,
                    y: o.y,
                    w: o.w,
                    d: o.d,
                    day: o.day,
                    ready: o.ready,
                    due: !o.done && day >= o.ready,
                    done: o.done,
                    words: if !o.done && day >= o.ready { content.lang.pick("Будівельники чекають, щоб передати ключі", "The builders are waiting to hand over the keys").to_string() } else { content.lang.pick(STAGE_WORDS[stage as usize], STAGE_WORDS_EN[stage as usize]).to_string() },
                    stage,
                    floor: def.and_then(|d| d.floor.clone()),
                    wall: def.and_then(|d| d.wall.clone()),
                    plan: def.and_then(|d| d.plan.clone()),
                    items: def.map(|d| d.items.clone()).unwrap_or_default(),
                }
            })
            .collect();
        BuildsView { here: OFFICES.contains(&self.location()), owner: self.owner_of_house(now), offers, orders }
    }
}
