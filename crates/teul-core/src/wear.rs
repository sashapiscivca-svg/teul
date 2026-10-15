//! Things at home grow old (docs/world-economy.md §14). A chair, a lamp, a fridge ages with the real days it has
//! stood in the home and with the times it was used: new, then used, then worn, then broken. Nothing of it is
//! counted aloud — it shows in the look of the thing and in what it says when touched. A broken thing does not
//! work until it is mended: by one's own hands with a repair kit (a broken one needs hands that know the craft),
//! or by a master from the utility office, for coins. Ageing is slow — weeks and months — and never cruel.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::core::{Core, CoreError};
use crate::event::EventKind;
use crate::rng::{rand_below, Domain};
use crate::storage::Storage;
use crate::time::WorldTime;

pub const WEAR: Domain = Domain(97);

/// The four ages of a thing.
pub const NEW: u32 = 0;
pub const USED: u32 = 1;
pub const WORN: u32 = 2;
pub const BROKEN: u32 = 3;

/// How a kind of thing ages (content): which things it covers, when it turns used, worn and broken, and what it
/// says at each age.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct WearDef {
    pub id: String,
    /// The items it covers by id (these win over tags and categories)…
    #[serde(default)]
    pub items: Vec<String>,
    /// …or by any of their tags…
    #[serde(default)]
    pub tags: Vec<String>,
    /// …or by category.
    #[serde(default)]
    pub categories: Vec<String>,
    /// Wear (a day of standing is 1, a use is `per_use`) at which it turns used, worn and broken.
    pub stages: [u32; 3],
    #[serde(default)]
    pub per_use: u32,
    /// How it looks at each age («як новий», «потертий», «розхитаний», «зламаний»).
    pub looks: [String; 4],
    /// What it says when one tries to use it broken.
    pub broken: String,
    /// What a master asks to mend it when it is broken (less while it is only worn).
    pub fix: u32,
    /// Tools one's own hands need to mend it (any of them), and what goes into it (an item or `#tag`; a repair kit).
    #[serde(default)]
    pub tools: Vec<String>,
    #[serde(default)]
    pub kit: Option<String>,
}

/// When a thing came into the home (or was last mended) and how often it was used since.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct WearState {
    pub since: u64,
    pub uses: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct WearView {
    pub pid: u32,
    pub item: String,
    /// 0 new, 1 used, 2 worn, 3 broken.
    pub stage: u32,
    /// How it looks now, in words.
    pub looks: String,
    pub broken: bool,
    /// What a master would ask now (0 while it is new).
    pub fix: u32,
    /// Whether one's own hands can mend it now (a kit in the pocket, and skill enough for a broken one).
    pub by_hand: bool,
}

/// Which items a kit mends with: the carried ones tagged `repair`.
pub const KIT_TAG: &str = "repair";

/// The crafting level a broken thing needs from one's own hands.
pub const BROKEN_NEEDS_LEVEL: u32 = 1;

/// The wear profile of an item: by id first, then by tag, then by category (in the content's order).
pub fn profile_of<'a>(content: &'a crate::content::Content, item: &str) -> Option<&'a WearDef> {
    let def = content.items.get(item)?;
    content
        .wear
        .values()
        .find(|w| w.items.iter().any(|i| i == item))
        .or_else(|| content.wear.values().find(|w| w.tags.iter().any(|t| def.tags.contains(t))))
        .or_else(|| content.wear.values().find(|w| w.categories.contains(&def.category)))
}

/// The age of a thing from its wear (days and uses), with a little of its own luck (±15%).
pub fn stage_of(def: &WearDef, seed: u64, pid: u32, since: u64, uses: u32, today: u64) -> u32 {
    let days = today.saturating_sub(since);
    let raw = days + u64::from(uses) * u64::from(def.per_use);
    let luck = 85 + rand_below(seed, WEAR, u64::from(pid), since, 31);
    let worn = raw * 100 / luck;
    def.stages.iter().filter(|s| worn >= u64::from(**s)).count() as u32
}

/// What a master asks for a thing at an age.
pub fn fix_price(def: &WearDef, stage: u32) -> u32 {
    match stage {
        0 => 0,
        1 => (def.fix / 4).max(5),
        2 => (def.fix / 2).max(8),
        _ => def.fix,
    }
}

impl<S: Storage> Core<S> {
    /// The age of a placed thing now (None: it does not age — a wall, a rug, a plant).
    pub fn wear_stage(&self, pid: u32, now: WorldTime) -> Option<(u32, &WearDef)> {
        let p = self.state().room.placements.get(&pid)?;
        let def = profile_of(self.content(), &p.item)?;
        let st = self.state().wear.get(&pid).cloned().unwrap_or_default();
        Some((stage_of(def, self.meta().seed, pid, st.since, st.uses, now.day()), def))
    }

    /// Every ageing thing at home, as it is now.
    pub fn wear_view(&self, now: WorldTime) -> Vec<WearView> {
        let level = crate::skills::level_of(self.practice("crafting"));
        self.state()
            .room
            .placements
            .values()
            .filter_map(|p| {
                let (stage, def) = self.wear_stage(p.pid, now)?;
                Some(WearView {
                    pid: p.pid,
                    item: p.item.clone(),
                    stage,
                    looks: def.looks[stage as usize].clone(),
                    broken: stage >= BROKEN,
                    fix: fix_price(def, stage),
                    by_hand: stage > NEW && self.hand_fix(def).is_ok() && (stage < BROKEN || level >= BROKEN_NEEDS_LEVEL),
                })
            })
            .collect()
    }

    /// What a broken thing says when one tries to use it (None: it works).
    pub fn broken_words(&self, pid: u32, now: WorldTime) -> Option<String> {
        let (stage, def) = self.wear_stage(pid, now)?;
        (stage >= BROKEN).then(|| def.broken.clone())
    }

    /// When every placed thing with this tag is broken, what the first of them says (a fridge, a stove).
    pub(crate) fn broken_tag(&self, tag: &str, now: WorldTime) -> Option<String> {
        let content = self.content();
        let pids: Vec<u32> = self
            .state()
            .room
            .placements
            .values()
            .filter(|p| content.items.get(&p.item).is_some_and(|d| d.tags.iter().any(|t| t == tag)))
            .map(|p| p.pid)
            .collect();
        if pids.is_empty() {
            return None;
        }
        let words: Vec<String> = pids.iter().filter_map(|pid| self.broken_words(*pid, now)).collect();
        (words.len() == pids.len()).then(|| words[0].clone())
    }

    /// Refuses with the thing's own words when it is broken.
    pub(crate) fn check_working(&self, pid: u32, now: WorldTime) -> Result<(), CoreError> {
        match self.broken_words(pid, now) {
            Some(w) => Err(CoreError::Broken(w)),
            None => Ok(()),
        }
    }

    /// Mends a thing at home with one's own hands: a repair kit from the pocket goes into it.
    pub(crate) fn plan_repair(&self, now: WorldTime, pid: u32) -> Result<Vec<EventKind>, CoreError> {
        if self.location() != "home" {
            return Err(CoreError::NotHere);
        }
        let (stage, _) = self.wear_stage(pid, now).ok_or(CoreError::ActionNotAvailable)?;
        if stage == NEW {
            return Err(CoreError::AlreadyDone);
        }
        if stage >= BROKEN && crate::skills::level_of(self.practice("crafting")) < BROKEN_NEEDS_LEVEL {
            return Err(CoreError::Needs("master".into()));
        }
        let (_, def) = self.wear_stage(pid, now).ok_or(CoreError::ActionNotAvailable)?;
        let (took, tool) = self.hand_fix(def)?;
        let mut events = vec![EventKind::Repaired { pid, day: now.day(), by: "hands".into(), took, coins: 0, stage }];
        events.extend(tool.and_then(|t| self.tool_used(&t)));
        Ok(events)
    }

    /// What mending with one's own hands takes (the kit) and which tool does it.
    fn hand_fix(&self, def: &WearDef) -> Result<(Vec<String>, Option<String>), CoreError> {
        let tool = if def.tools.is_empty() {
            None
        } else {
            Some(def.tools.iter().find(|t| self.owns_tool(t)).cloned().ok_or_else(|| CoreError::Needs(def.tools[0].clone()))?)
        };
        let kit = def.kit.clone().unwrap_or_else(|| format!("#{KIT_TAG}"));
        let took = crate::daily::take_for(self.content(), &self.pocket_items(), &[(kit, 1)]).ok_or(CoreError::NotEnough)?;
        Ok((took, tool))
    }

    /// Calls a master to mend a thing at home: from the utility office, or from anywhere with a phone of one's own.
    pub(crate) fn plan_call_master(&self, now: WorldTime, pid: u32) -> Result<Vec<EventKind>, CoreError> {
        if self.location() != "utility_in" && !self.has_phone() {
            return Err(CoreError::Needs("phone".into()));
        }
        let (stage, def) = self.wear_stage(pid, now).ok_or(CoreError::ActionNotAvailable)?;
        if stage == NEW {
            return Err(CoreError::AlreadyDone);
        }
        // masters work by day
        let hour = now.minute_of_day() / 60;
        if !(8..19).contains(&hour) {
            return Err(CoreError::Closed);
        }
        let coins = fix_price(def, stage);
        let have = self.wallet().coins;
        if have < u64::from(coins) {
            return Err(CoreError::Locked(vec![crate::unlock::Missing::Coins { have, need: u64::from(coins) }]));
        }
        Ok(vec![EventKind::Repaired { pid, day: now.day(), by: "master".into(), took: Vec::new(), coins, stage }])
    }
}

/// The state's side of ageing: a thing placed starts new on that day; a use wears it a little; mending makes it
/// new again; a thing put away keeps nothing.
pub(crate) fn apply(wear: &mut BTreeMap<u32, WearState>, kind: &EventKind, day: u64) {
    match kind {
        EventKind::Placed { pid, .. } => {
            wear.insert(*pid, WearState { since: day, uses: 0 });
        }
        EventKind::Stored { pid } => {
            wear.remove(pid);
        }
        EventKind::ActionPerformed { pid: Some(pid), .. } | EventKind::Played { pid, .. } => {
            wear.entry(*pid).or_insert(WearState { since: day, uses: 0 }).uses += 1;
        }
        EventKind::PropSet { pid, key, value } if key == "lit" && value == "1" => {
            wear.entry(*pid).or_insert(WearState { since: day, uses: 0 }).uses += 1;
        }
        EventKind::Repaired { pid, day, .. } => {
            wear.insert(*pid, WearState { since: *day, uses: 0 });
        }
        _ => {}
    }
}
