//! Making things at a workbench (docs/world-economy.md §14): planks, nails, yarn, clay, cloth, scraps of metal
//! and what the fields give become a repair kit, a stool, a birdhouse, a frame for one's own picture, a mug, a
//! toy for a child. A few things one knows from the start; others one learns from the town's people as a
//! friendship grows, from a book, or by trying what goes with what. Nothing is shown to fill: a try that makes
//! nothing leaves the materials whole.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::core::{Core, CoreError};
use crate::economy::Requires;
use crate::event::EventKind;
use crate::storage::Storage;
use crate::time::WorldTime;

/// What can be made (content).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CraftDef {
    pub id: String,
    pub name: String,
    /// Taken from the pocket: item ids or `#tag`, with counts.
    pub needs: Vec<(String, u32)>,
    /// What comes of it, and how many.
    pub gives: (String, u32),
    /// Known from the start.
    #[serde(default)]
    pub known: bool,
    /// Learned once this holds (a friendship, a book on the keyring, a help done); otherwise only by trying.
    #[serde(default)]
    pub learn: Option<Requires>,
    /// How one came to know it, said in the notebook of crafts («Дід Панас показав, як…»).
    #[serde(default)]
    pub from: String,
    /// A few words of the making.
    #[serde(default)]
    pub text: String,
    /// Tools it needs at hand (not used up, but they wear): one's own at home, the master's at the workshop.
    #[serde(default)]
    pub tools: Vec<String>,
}

/// A tool (or something used up as one, like fertilizer): how many times it serves before it is worn out, and
/// what is said then.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ToolDef {
    pub item: String,
    pub uses: u32,
    pub gone: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct ToolView {
    pub item: String,
    /// How it is, in words: «новий», «у ділі», «ледь тримається».
    pub words: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct CraftView {
    pub id: String,
    pub name: String,
    pub needs: Vec<(String, u32)>,
    pub gives: (String, u32),
    /// What of each need is in the pocket now.
    pub have: Vec<u32>,
    pub from: String,
    pub text: String,
    pub tools: Vec<String>,
    /// It can be made here and now.
    pub ok: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct CraftsView {
    /// The player stands where things are made (a workbench at home, the town's workshop).
    pub bench: bool,
    /// What one knows how to make.
    pub known: Vec<CraftView>,
    /// What lies in the pocket that might go into something (for trying).
    pub materials: Vec<(String, u32)>,
}

/// The tag of things that go into making (besides any carried thing a recipe names).
pub const MATERIAL_TAG: &str = "material";

/// Several things offered at once to try: at most this many kinds, this many of each.
pub const MAX_TRY: usize = 5;

impl<S: Storage> Core<S> {
    /// Whether the player stands at a workbench: the town's workshop, or at home with a bench of one's own.
    pub fn at_bench(&self) -> bool {
        match self.location() {
            "workshop_in" => true,
            "home" => self.has_placed("workbench"),
            _ => false,
        }
    }

    pub fn knows_craft(&self, def: &CraftDef, now: WorldTime) -> bool {
        def.known || self.state().crafts_known.contains(&def.id) || def.learn.as_ref().is_some_and(|r| self.missing_for(Some(r), now).is_empty())
    }

    pub fn crafts_view(&self, now: WorldTime) -> CraftsView {
        let content = self.content();
        let pocket = self.pocket_items();
        let bench = self.at_bench();
        let known = content
            .crafts
            .values()
            .filter(|d| self.knows_craft(d, now))
            .map(|d| {
                let have = d.needs.iter().map(|(k, _)| pocket.iter().filter(|(id, _)| crate::daily::answers(content, id, k)).map(|(_, n)| *n).sum()).collect();
                CraftView {
                    id: d.id.clone(),
                    name: d.name.clone(),
                    needs: d.needs.clone(),
                    gives: d.gives.clone(),
                    have,
                    from: d.from.clone(),
                    text: d.text.clone(),
                    tools: d.tools.clone(),
                    ok: bench && self.craft_plan(d).is_ok(),
                }
            })
            .collect();
        let materials = pocket
            .iter()
            .filter(|(id, n)| **n > 0 && (content.items.get(*id).is_some_and(|d| d.tags.iter().any(|t| t == MATERIAL_TAG)) || content.crafts.values().any(|c| c.needs.iter().any(|(k, _)| crate::daily::answers(content, id, k)))))
            .map(|(id, n)| (id.clone(), *n))
            .collect();
        CraftsView { bench, known, materials }
    }

    /// Whether a tool is at hand: one's own (in the pocket or at home), or the master's at the workshop.
    pub fn has_tool(&self, item: &str) -> bool {
        self.location() == "workshop_in" || self.owns_tool(item)
    }

    pub fn owns_tool(&self, item: &str) -> bool {
        self.state().owned.get(item).copied().unwrap_or(0) > 0
    }

    /// One more use of one's own tool (None when it is not one's own or not a tool): it may wear out with it.
    pub(crate) fn tool_used(&self, item: &str) -> Option<EventKind> {
        let def = self.content().tools.get(item)?;
        if !self.owns_tool(item) || self.location() == "workshop_in" && def.uses > 1 {
            return None;
        }
        let uses = self.state().tool_uses.get(item).copied().unwrap_or(0) + 1;
        Some(EventKind::ToolUsed { item: item.to_string(), broke: uses >= def.uses })
    }

    pub(crate) fn tools_used(&self, items: &[String]) -> Vec<EventKind> {
        items.iter().filter_map(|i| self.tool_used(i)).collect()
    }

    /// One's own tools and how they are.
    pub fn tools_view(&self) -> Vec<ToolView> {
        self.content()
            .tools
            .values()
            .filter(|t| t.uses > 1 && self.owns_tool(&t.item))
            .map(|t| {
                let used = self.state().tool_uses.get(&t.item).copied().unwrap_or(0) * 3 / t.uses.max(1);
                ToolView { item: t.item.clone(), words: { let i = (used as usize).min(2); self.lang().pick(["новий", "у ділі", "ледь тримається"][i], ["new", "well used", "barely holding together"][i]).to_string() } }
            })
            .collect()
    }

    /// What making a thing would take and give (and what does not fit the pocket goes home).
    fn craft_plan(&self, def: &CraftDef) -> Result<(Vec<String>, Vec<String>, Vec<EventKind>), CoreError> {
        if let Some(t) = def.tools.iter().find(|t| !self.has_tool(t)) {
            return Err(CoreError::Needs(t.clone()));
        }
        let took = crate::daily::take_for(self.content(), &self.pocket_items(), &def.needs).ok_or(CoreError::NotEnough)?;
        let gave: Vec<String> = std::iter::repeat_n(def.gives.0.clone(), def.gives.1 as usize).collect();
        let leaving = took.iter().filter(|i| self.is_carry(i)).count() as u32;
        let home = self.overflow(&gave, leaving);
        Ok((took, gave, home))
    }

    pub(crate) fn plan_craft(&self, now: WorldTime, recipe: &str) -> Result<Vec<EventKind>, CoreError> {
        let def = self.content().crafts.get(recipe).ok_or_else(|| CoreError::UnknownRecipe(recipe.to_string()))?;
        if !self.at_bench() {
            return Err(CoreError::Needs("workbench".into()));
        }
        if !self.knows_craft(def, now) {
            return Err(CoreError::NotLearned(recipe.to_string()));
        }
        let (took, gave, home) = self.craft_plan(def)?;
        let mut events = vec![EventKind::Crafted { recipe: recipe.to_string(), day: now.day(), took, gave, to_chest: !home.is_empty(), learned: false }];
        events.extend(home);
        events.extend(self.tools_used(&def.tools));
        Ok(events)
    }

    /// Tries what goes with what: when the things offered are exactly what something takes, it is made (and
    /// remembered); when they are not, nothing happens to them.
    pub(crate) fn plan_tinker(&self, now: WorldTime, offered: &[(String, u32)]) -> Result<Vec<EventKind>, CoreError> {
        if !self.at_bench() {
            return Err(CoreError::Needs("workbench".into()));
        }
        if offered.is_empty() || offered.len() > MAX_TRY || offered.iter().any(|(_, n)| *n == 0 || *n > 9) {
            return Err(CoreError::NotEnough);
        }
        let mut given: BTreeMap<String, u32> = BTreeMap::new();
        for (id, n) in offered {
            *given.entry(id.clone()).or_insert(0) += n;
        }
        if given.iter().any(|(id, n)| self.in_pocket(id) < *n) {
            return Err(CoreError::NotEnough);
        }
        let total: u32 = given.values().sum();
        let content = self.content();
        let found = content.crafts.values().find(|d| {
            d.needs.iter().map(|(_, n)| *n).sum::<u32>() == total && crate::daily::take_for(content, &given, &d.needs).is_some_and(|t| t.len() as u32 == total)
        });
        let Some(def) = found else { return Err(CoreError::Fizzled) };
        if let Some(t) = def.tools.iter().find(|t| !self.has_tool(t)) {
            return Err(CoreError::Needs(t.clone()));
        }
        let took = crate::daily::take_for(content, &given, &def.needs).ok_or(CoreError::NotEnough)?;
        let gave: Vec<String> = std::iter::repeat_n(def.gives.0.clone(), def.gives.1 as usize).collect();
        let leaving = took.iter().filter(|i| self.is_carry(i)).count() as u32;
        let home = self.overflow(&gave, leaving);
        let learned = !self.knows_craft(def, now);
        let mut events = vec![EventKind::Crafted { recipe: def.id.clone(), day: now.day(), took, gave, to_chest: !home.is_empty(), learned }];
        events.extend(home);
        events.extend(self.tools_used(&def.tools));
        Ok(events)
    }
}
