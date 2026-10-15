use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::event::{Event, EventKind, SortKey};
use crate::room::{cell_key, divider_key, edge_key, parse_edge, Placement, RoomState};

/// Everything derived from the change log. Always rebuildable by folding the log.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct DeltaState {
    pub player_name: Option<String>,
    /// The nine places at hand: a kind of thing one carries in each (or none). (Not written while empty: a
    /// snapshot from before them reads, and vouches, the same.)
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub hotbar: Vec<Option<String>>,
    /// What the left hand holds.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub offhand: Option<String>,
    /// Armour worn, by place (head, body, legs, feet).
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub armor: BTreeMap<String, String>,
    pub events_applied: u64,
    pub room: RoomState,
    /// How many of each item the player has acquired (placed or not).
    pub owned: BTreeMap<String, u32>,
    pub earned: u64,
    pub spent: u64,
    pub tokens: BTreeMap<String, u64>,
    pub counters: BTreeMap<String, u64>,
    /// Per action: (world day, how many performances were rewarded that day).
    pub reward_days: BTreeMap<String, (u64, u32)>,
    /// Little gifts from close friends taken, as "who:day".
    pub kindness: std::collections::BTreeSet<String>,
    /// What the player did with each person.
    pub relations: BTreeMap<String, crate::npc::Relation>,
    pub kits: std::collections::BTreeSet<String>,
    /// Per spot, the last day it gave something.
    pub gathered: BTreeMap<String, u64>,
    /// The day of the last catch and how many that day.
    pub catches: (u64, u32),
    /// Everything ever gathered or caught.
    pub collected: std::collections::BTreeSet<String>,
    pub collections: std::collections::BTreeSet<String>,
    /// Requests answered, as "day:npc".
    pub delivered: std::collections::BTreeSet<String>,
    /// Asks whose gift was given already, as "npc:index".
    pub ask_gifts: std::collections::BTreeSet<String>,
    /// Letters opened, as "npc:index".
    pub letters: std::collections::BTreeSet<String>,
    /// Per person, the chapters of their story played and the day of the last one.
    pub story: BTreeMap<String, (u32, u64)>,
    /// Where the player is (None: at home).
    pub location: Option<String>,
    /// Copies kept in the chest at home, by item (the rest of a carry item is in the pocket).
    pub stashed: BTreeMap<String, u32>,
    /// Helps done.
    pub helped: std::collections::BTreeSet<String>,
    /// Per station: (world day, uses that day).
    pub station_uses: BTreeMap<String, (u64, u32)>,
    /// The player's answers to journalists: day -> (question, answer).
    pub interviews: BTreeMap<u64, (u32, u32)>,
    /// Commands that bring or move value in the latest world minute: (minute, how many).
    pub minute_inputs: (u64, u32),
    /// Copies kept in the fridge at home, by item.
    pub fridge: BTreeMap<String, u32>,
    /// Bills paid, as "utility:month".
    pub bills_paid: std::collections::BTreeSet<String>,
    /// Quests taken, by key (an id, `id@year` for calendar ones, `job:day:n` for the town's jobs).
    pub quests: BTreeMap<String, crate::quests::QuestProgress>,
    /// Standing with the town (from quests).
    pub reputation: i64,
    pub titles: std::collections::BTreeSet<String>,
    /// Recipes learned from people.
    pub recipes_learned: std::collections::BTreeSet<String>,
    /// Jobs taken per day (only the latest few days are kept).
    pub jobs_taken: BTreeMap<u64, u32>,
    /// The shift going on at a job.
    pub shift: Option<crate::work::Shift>,
    /// What each job remembers of the player.
    pub work_record: BTreeMap<String, crate::work::WorkRecord>,
    /// What grows in each plot at home, by the plot's pid.
    pub plots: BTreeMap<u32, crate::garden::PlotState>,
    /// Practice in each skill.
    pub practice: BTreeMap<String, u32>,
    /// Pictures painted at the easel.
    pub paintings: Vec<crate::skills::Painting>,
    /// The world minute of the last while at an instrument.
    pub last_played: Option<u64>,
    /// Pieces played at least once (the hands remember them).
    pub repertoire: std::collections::BTreeSet<String>,
    /// The world minute of the last time playing in the street, and (day, coins given that day).
    pub last_busk: Option<u64>,
    pub busked: (u64, u32),
    /// The clothes of the first day (the look keys of every slot), kept once the hero is made or first changed.
    pub first_outfit: BTreeMap<String, String>,
    pub outfit_kept: bool,
    /// The home the player lives in (None: the first house).
    pub address: Option<String>,
    /// Leases: home → (the month it began, the month it was ended).
    pub leases: BTreeMap<String, (i64, Option<i64>)>,
    pub homes_bought: std::collections::BTreeSet<String>,
    /// Birthday wishes given, as "who:year".
    pub congratulated: std::collections::BTreeSet<String>,
    /// Dinners at friends', as "host:day".
    pub dined: std::collections::BTreeSet<String>,
    /// What the player gave to the town's projects: per project (day, coins, items).
    pub contributions: BTreeMap<String, Vec<(u64, u32, Vec<(String, u32)>)>>,
    /// The world minute something hot was last eaten or drunk (a cooked meal, a dinner, a coffee or cocoa).
    pub warmed_at: Option<u64>,
    /// How the things at home have aged, by pid (`wear.rs`).
    pub wear: BTreeMap<u32, crate::wear::WearState>,
    /// What one learned to make by trying.
    pub crafts_known: std::collections::BTreeSet<String>,
    /// How often each of one's tools was used since it was new.
    pub tool_uses: BTreeMap<String, u32>,
    /// The road: the licence, the car, fines, the cell (drive.rs).
    pub drive: crate::drive::DriveState,
    /// Rooms ordered from the town's builders (builds.rs).
    pub builds: Vec<crate::builds::BuildOrder>,
    /// The animals one lives with (pets.rs).
    pub pets: crate::pets::PetsState,
}

impl DeltaState {
    fn reward(&mut self, r: &crate::quests::Reward) {
        self.earned += u64::from(r.coins);
        give(&mut self.owned, &r.items);
        self.recipes_learned.extend(r.recipes.iter().cloned());
        if let Some(t) = &r.title {
            self.titles.insert(t.clone());
        }
        self.reputation += i64::from(r.rep);
        for (who, pts) in &r.hearts {
            let rel = self.relations.entry(who.clone()).or_default();
            rel.points = if *pts >= 0 { rel.points.saturating_add(*pts as u32).min(crate::npc::MAX_POINTS) } else { rel.points.saturating_sub(pts.unsigned_abs()) };
        }
    }
}

fn take(owned: &mut BTreeMap<String, u32>, items: &[String]) {
    for item in items {
        if let Some(n) = owned.get_mut(item) {
            *n = n.saturating_sub(1);
        }
    }
}

fn give(owned: &mut BTreeMap<String, u32>, items: &[String]) {
    for item in items {
        *owned.entry(item.clone()).or_insert(0) += 1;
    }
}

impl DeltaState {
    pub fn apply(&mut self, event: &Event) {
        if let Some((skill, n)) = crate::skills::practice_of(&event.kind) {
            *self.practice.entry(skill.to_string()).or_insert(0) += n;
        }
        if let Some((pay, full)) = crate::work::apply(&mut self.shift, &mut self.work_record, &event.kind, event.time.0) {
            self.earned += u64::from(pay);
            if full {
                self.reputation += 1;
            }
        }
        crate::garden::apply(&mut self.plots, &event.kind);
        crate::wear::apply(&mut self.wear, &event.kind, event.time.day());
        match &event.kind {
            EventKind::Cooked { .. } | EventKind::Dined { .. } => self.warmed_at = Some(event.time.0),
            EventKind::Used { station, gave, .. } if crate::warmth::hot_thing(station) || gave.iter().any(|g| crate::warmth::hot_thing(g)) => {
                self.warmed_at = Some(event.time.0)
            }
            _ => {}
        }
        crate::drive::apply(self, &event.kind, event.time.0);
        crate::pets::apply(&mut self.pets, &mut self.owned, &event.kind);
        match &event.kind {
            EventKind::EggNested { from_pocket: false, .. } => {
                if let Some(n) = self.stashed.get_mut(crate::pets::EGG) {
                    *n = n.saturating_sub(1);
                }
            }
            EventKind::PetAdopted { coins, .. } => self.spent += u64::from(*coins),
            EventKind::BuildOrdered { build, x, y, w, d, coins, day, ready } => {
                self.spent += u64::from(*coins);
                self.builds.push(crate::builds::BuildOrder { build: build.clone(), x: *x, y: *y, w: *w, d: *d, day: *day, ready: *ready, done: false });
                // the site is the house's from the day it is fenced off (the floor counts from then)
                self.room.built_area += (*w * *d).max(0) as u32;
            }
            EventKind::BuildFinished { n, items, styles, .. } => {
                if let Some(o) = self.builds.get_mut(*n as usize) {
                    if !o.done {
                        o.done = true;
                        give(&mut self.owned, items);
                        for s in styles {
                            self.room.owned_styles.insert(s.clone());
                        }
                    }
                }
            }
            _ => {}
        }
        match &event.kind {
            EventKind::Planted { seed, .. } => take(&mut self.owned, std::slice::from_ref(seed)),
            EventKind::Harvested { item, n, .. } => *self.owned.entry(item.clone()).or_insert(0) += n,
            EventKind::Played { piece, .. } => {
                self.last_played = Some(event.time.0);
                if let Some(p) = piece {
                    self.repertoire.insert(p.clone());
                }
            }
            EventKind::Busked { piece, day, coins, .. } => {
                self.last_busk = Some(event.time.0);
                self.repertoire.insert(piece.clone());
                self.busked = if self.busked.0 == *day { (*day, self.busked.1 + coins) } else { (*day, *coins) };
            }
            EventKind::Painted { index, title, day, pixels, canvas } => {
                self.paintings.push(crate::skills::Painting { index: *index, title: title.clone(), day: *day, pixels: pixels.clone() });
                *self.owned.entry(canvas.clone()).or_insert(0) += 1;
            }
            _ => {}
        }
        match &event.kind {
            EventKind::PlayerNamed { name } => self.player_name = Some(name.clone()),
            EventKind::OffhandSet { item } => {
                // a thing is in one hand at most
                if let Some(i) = item {
                    for s in self.hotbar.iter_mut() {
                        if s.as_deref() == Some(i.as_str()) {
                            *s = None;
                        }
                    }
                }
                self.offhand = item.clone();
            }
            EventKind::HandsSwapped { slot } => {
                let k = *slot as usize;
                if self.hotbar.len() < crate::economy::HOTBAR {
                    self.hotbar.resize(crate::economy::HOTBAR, None);
                }
                if k < self.hotbar.len() {
                    std::mem::swap(&mut self.hotbar[k], &mut self.offhand);
                }
            }
            EventKind::Worn { item, slot } => {
                self.armor.insert(slot.clone(), item.clone());
            }
            EventKind::TakenOff { slot } => {
                self.armor.remove(slot);
            }
            EventKind::HotbarSet { slot, item } => {
                let k = *slot as usize;
                if self.hotbar.len() < crate::economy::HOTBAR {
                    self.hotbar.resize(crate::economy::HOTBAR, None);
                }
                // one place for a kind: from wherever it was (the left hand too), into this one
                if let Some(i) = item {
                    for s in self.hotbar.iter_mut() {
                        if s.as_deref() == Some(i.as_str()) {
                            *s = None;
                        }
                    }
                    if self.offhand.as_deref() == Some(i.as_str()) {
                        self.offhand = None;
                    }
                }
                if k < self.hotbar.len() {
                    self.hotbar[k] = item.clone();
                }
            }
            EventKind::NpcTalked { npc, day, delta } => {
                let r = self.relations.entry(npc.clone()).or_default();
                r.met = true;
                r.talks += 1;
                r.talk_day = if r.talk_day.0 == *day && r.talks > 1 { (*day, r.talk_day.1 + 1) } else { (*day, 1) };
                r.last = Some(*day);
                r.points = (r.points + delta).min(crate::npc::MAX_POINTS);
            }
            EventKind::NpcGifted { npc, item, day, delta, taste } => {
                if let Some(n) = self.owned.get_mut(item) {
                    *n = n.saturating_sub(1);
                }
                let r = self.relations.entry(npc.clone()).or_default();
                r.met = true;
                r.gift_day = Some(*day);
                r.last = Some(*day);
                r.tastes.insert(item.clone(), *taste);
                r.points = (i64::from(r.points) + i64::from(*delta)).clamp(0, i64::from(crate::npc::MAX_POINTS)) as u32;
            }
            EventKind::NpcInvited { npc, from, until } => {
                self.relations.entry(npc.clone()).or_default().visit = Some((*from, *until));
            }
            EventKind::NpcGaveGift { npc, item } => {
                *self.owned.entry(item.clone()).or_insert(0) += 1;
                self.relations.entry(npc.clone()).or_default().received.insert(item.clone());
            }
            EventKind::ItemAcquired { item } => *self.owned.entry(item.clone()).or_insert(0) += 1,
            EventKind::StyleAcquired { style } => {
                self.room.owned_styles.insert(style.clone());
            }
            EventKind::CoinsEarned { amount } => self.earned += u64::from(*amount),
            EventKind::CoinsSpent { amount } => self.spent += u64::from(*amount),
            EventKind::TokenGranted { kind, n } => *self.tokens.entry(kind.clone()).or_insert(0) += u64::from(*n),
            EventKind::TokenSpent { kind, n } => {
                let slot = self.tokens.entry(kind.clone()).or_insert(0);
                *slot = slot.saturating_sub(u64::from(*n));
            }
            EventKind::ActionPerformed { action, day, rewarded, .. } => {
                *self.counters.entry(action.clone()).or_insert(0) += 1;
                if *rewarded {
                    let count = match self.reward_days.get(action) {
                        Some((d, c)) if d == day => c + 1,
                        _ => 1,
                    };
                    self.reward_days.insert(action.clone(), (*day, count));
                }
            }
            EventKind::Placed { pid, item, x, y, rot, wall, on } => {
                self.room.placements.insert(
                    *pid,
                    Placement { pid: *pid, item: item.clone(), x: *x, y: *y, rot: *rot, wall: *wall, on: *on, colors: BTreeMap::new(), props: BTreeMap::new() },
                );
                self.room.next_pid = self.room.next_pid.max(pid + 1);
            }
            EventKind::Moved { pid, x, y, wall, on } => {
                if let Some(p) = self.room.placements.get_mut(pid) {
                    p.x = *x;
                    p.y = *y;
                    p.wall = *wall;
                    p.on = *on;
                }
            }
            EventKind::Rotated { pid, rot } => {
                if let Some(p) = self.room.placements.get_mut(pid) {
                    p.rot = *rot;
                }
            }
            EventKind::Recolored { pid, slot, color } => {
                if let Some(p) = self.room.placements.get_mut(pid) {
                    p.colors.insert(slot.clone(), color.clone());
                }
            }
            EventKind::Stored { pid } => {
                self.room.placements.remove(pid);
            }
            EventKind::StyleSet { kind, style } => {
                self.room.styles.insert(kind.clone(), style.clone());
            }
            EventKind::RoomExpanded { expansion } => {
                self.room.expansions.insert(expansion.clone());
            }
            EventKind::AreaBought { cells } => self.room.bought_area += *cells,
            EventKind::CellsChanged { add, remove } => {
                for (x, y) in remove {
                    let k = cell_key(*x, *y);
                    self.room.added.remove(&k);
                    self.room.removed.insert(k);
                }
                for (x, y) in add {
                    let k = cell_key(*x, *y);
                    self.room.removed.remove(&k);
                    self.room.added.insert(k);
                }
                // A divider only makes sense between two cells that are both erased-free.
                let removed = self.room.removed.clone();
                self.room.dividers.retain(|d| {
                    parse_edge(d).is_none_or(|(x, y, side)| {
                        let (dx, dy) = side.delta();
                        !removed.contains(&cell_key(x, y)) && !removed.contains(&cell_key(x + dx, y + dy))
                    })
                });
            }
            EventKind::DividerSet { x, y, side, on } => {
                let k = divider_key(*x, *y, *side);
                if *on {
                    self.room.dividers.insert(k);
                } else {
                    self.room.dividers.remove(&k);
                }
            }
            EventKind::FloorPainted { cells, style } => {
                for (x, y) in cells {
                    let k = cell_key(*x, *y);
                    match style {
                        Some(s) => {
                            self.room.floor_paint.insert(k, s.clone());
                        }
                        None => {
                            self.room.floor_paint.remove(&k);
                        }
                    }
                }
            }
            EventKind::WallPainted { edges, style } => {
                for (x, y, side) in edges {
                    let k = edge_key(*x, *y, *side);
                    match style {
                        Some(s) => {
                            self.room.wall_paint.insert(k, s.clone());
                        }
                        None => {
                            self.room.wall_paint.remove(&k);
                        }
                    }
                }
            }
            EventKind::PropSet { pid, key, value } => {
                if let Some(p) = self.room.placements.get_mut(pid) {
                    if value.is_empty() {
                        p.props.remove(key);
                    } else {
                        p.props.insert(key.clone(), value.clone());
                    }
                }
            }
            EventKind::SettingSet { key, value } => {
                if value.is_empty() {
                    self.room.settings.remove(key);
                } else {
                    self.room.settings.insert(key.clone(), value.clone());
                }
            }
            EventKind::Gathered { spot, day, item } => {
                // merged logs of two devices may both have gathered it: once a day counts
                if self.gathered.get(spot) == Some(day) {
                    self.events_applied += 1;
                    return;
                }
                self.gathered.insert(spot.clone(), *day);
                *self.owned.entry(item.clone()).or_insert(0) += 1;
                self.collected.insert(item.clone());
            }
            EventKind::Caught { day, item, .. } => {
                if self.catches.0 == *day && self.catches.1 >= crate::daily::CATCHES_PER_DAY {
                    self.events_applied += 1;
                    return;
                }
                self.catches = if self.catches.0 == *day && self.catches.1 > 0 { (*day, self.catches.1 + 1) } else { (*day, 1) };
                *self.owned.entry(item.clone()).or_insert(0) += 1;
                self.collected.insert(item.clone());
            }
            EventKind::CollectionCompleted { collection, reward } => {
                if self.collections.insert(collection.clone()) {
                    *self.owned.entry(reward.clone()).or_insert(0) += 1;
                }
            }
            EventKind::Delivered { npc, day, ask, items, points, coins, gift } => {
                if self.delivered.insert(format!("{day}:{npc}")) {
                    self.earned += u64::from(*coins);
                    if let Some(g) = gift {
                        if self.ask_gifts.insert(format!("{npc}:{ask}")) {
                            *self.owned.entry(g.clone()).or_insert(0) += 1;
                        }
                    }
                    for item in items {
                        if let Some(n) = self.owned.get_mut(item) {
                            *n = n.saturating_sub(1);
                        }
                    }
                    let r = self.relations.entry(npc.clone()).or_default();
                    r.met = true;
                    r.points = (r.points + points).min(crate::npc::MAX_POINTS);
                }
            }
            EventKind::LetterClaimed { npc, letter, gift } => {
                if self.letters.insert(format!("{npc}:{letter}")) {
                    if let Some(g) = gift {
                        *self.owned.entry(g.clone()).or_insert(0) += 1;
                    }
                }
            }
            EventKind::StoryAdvanced { npc, step, day, items, gift } => {
                let done = self.story.get(npc).map(|s| s.0).unwrap_or(0);
                if *step == done {
                    self.story.insert(npc.clone(), (step + 1, *day));
                    for item in items {
                        if let Some(n) = self.owned.get_mut(item) {
                            *n = n.saturating_sub(1);
                        }
                    }
                    if let Some(g) = gift {
                        *self.owned.entry(g.clone()).or_insert(0) += 1;
                    }
                }
            }
            EventKind::Restored { worn, into, coins } => {
                // a worn thing is mended once, even when two devices both asked for it offline
                if let Some(n) = self.owned.get_mut(worn).filter(|n| **n > 0) {
                    *n -= 1;
                    *self.owned.entry(into.clone()).or_insert(0) += 1;
                    self.spent += u64::from(*coins);
                }
            }
            EventKind::KitClaimed { kit, items, styles } => {
                // two devices of one world may each claim it offline; it counts once when their logs merge
                if self.kits.insert(kit.clone()) {
                    for item in items {
                        *self.owned.entry(item.clone()).or_insert(0) += 1;
                    }
                    for s in styles {
                        self.room.owned_styles.insert(s.clone());
                    }
                }
            }
            EventKind::Input { cmd, .. } => {
                if !cmd.counts_toward_limit() {
                    self.events_applied += 1;
                    return;
                }
                let minute = event.time.0;
                self.minute_inputs = if self.minute_inputs.0 == minute { (minute, self.minute_inputs.1 + 1) } else { (minute, 1) };
            }
            EventKind::Travelled { to, .. } => {
                self.location = if to == "home" { None } else { Some(to.clone()) };
            }
            EventKind::Stashed { item, n } => *self.stashed.entry(item.clone()).or_insert(0) += n,
            EventKind::SoldTo { station, item, n, coins, day } => {
                let uses = match self.station_uses.get(station) {
                    Some((d, k)) if d == day => k + n,
                    _ => *n,
                };
                self.station_uses.insert(station.clone(), (*day, uses));
                if let Some(o) = self.owned.get_mut(item) {
                    *o = o.saturating_sub(*n);
                }
                self.earned += u64::from(*coins);
            }
            EventKind::SoldBack { item, coins, day } => {
                let uses = match self.station_uses.get(crate::economy::SELL_BACK) {
                    Some((d, k)) if d == day => k + 1,
                    _ => 1,
                };
                self.station_uses.insert(crate::economy::SELL_BACK.to_string(), (*day, uses));
                if let Some(o) = self.owned.get_mut(item) {
                    *o = o.saturating_sub(1);
                }
                self.earned += u64::from(*coins);
            }
            EventKind::ThrownAway { item, n } => {
                if let Some(o) = self.owned.get_mut(item) {
                    *o = o.saturating_sub(*n);
                }
            }
            EventKind::Taken { item, n } => {
                if let Some(s) = self.stashed.get_mut(item) {
                    *s = s.saturating_sub(*n);
                }
            }
            EventKind::Used { station, day, took, gave, cost, earn } => {
                let uses = match self.station_uses.get(station) {
                    Some((d, n)) if d == day => n + 1,
                    _ => 1,
                };
                self.station_uses.insert(station.clone(), (*day, uses));
                take(&mut self.owned, took);
                give(&mut self.owned, gave);
                self.spent += u64::from(*cost);
                self.earned += u64::from(*earn);
            }
            EventKind::Helped { help, took, coins, gives, .. } => {
                if self.helped.insert(help.clone()) {
                    take(&mut self.owned, took);
                    give(&mut self.owned, gives);
                    self.earned += u64::from(*coins);
                }
            }
            EventKind::Fridged { item, n } => *self.fridge.entry(item.clone()).or_insert(0) += n,
            EventKind::Unfridged { item, n } => {
                if let Some(f) = self.fridge.get_mut(item) {
                    *f = f.saturating_sub(*n);
                }
            }
            EventKind::Cooked { took, from_fridge, gave, n, to_fridge, .. } => {
                take(&mut self.owned, took);
                take(&mut self.owned, from_fridge);
                for i in from_fridge {
                    if let Some(f) = self.fridge.get_mut(i) {
                        *f = f.saturating_sub(1);
                    }
                }
                *self.owned.entry(gave.clone()).or_insert(0) += n;
                if *to_fridge {
                    *self.fridge.entry(gave.clone()).or_insert(0) += n;
                }
            }
            EventKind::HeroMade { set } => {
                for (k, v) in set {
                    self.room.settings.insert(k.clone(), v.clone());
                }
                self.first_outfit = set.iter().filter(|(k, _)| crate::style::slot_of(k).is_some()).cloned().collect();
                self.outfit_kept = true;
            }
            EventKind::Dressed { set, .. } => {
                if !self.outfit_kept {
                    // a save from before: what one wore then is the first outfit
                    self.first_outfit = self.room.settings.iter().filter(|(k, _)| crate::style::slot_of(k).is_some()).map(|(k, v)| (k.clone(), v.clone())).collect();
                    self.outfit_kept = true;
                }
                for (k, v) in set {
                    if v.is_empty() {
                        self.room.settings.remove(k);
                    } else {
                        self.room.settings.insert(k.clone(), v.clone());
                    }
                }
            }
            EventKind::HairCut { set, coins } => {
                for (k, v) in set {
                    self.room.settings.insert(k.clone(), v.clone());
                }
                self.spent += u64::from(*coins);
            }
            EventKind::Rented { home, month, amount } => {
                self.leases.insert(home.clone(), (*month, None));
                self.spent += u64::from(*amount);
            }
            EventKind::Bought { home, amount } => {
                self.homes_bought.insert(home.clone());
                self.leases.remove(home);
                self.spent += u64::from(*amount);
            }
            EventKind::MovedHome { home } => self.address = Some(home.clone()),
            EventKind::LeaseEnded { home, month } => {
                if let Some(l) = self.leases.get_mut(home) {
                    l.1 = Some(*month);
                }
            }
            EventKind::BillPaid { utility, month, amount } => {
                if self.bills_paid.insert(crate::home::bill_key(utility, *month)) {
                    self.spent += u64::from(*amount);
                }
            }
            EventKind::Interviewed { day, question, answer } => {
                self.interviews.insert(*day, (*question, *answer));
                // only yesterday's is ever printed
                let keep = day.saturating_sub(2);
                self.interviews.retain(|d, _| *d >= keep);
            }
            EventKind::QuestStarted { quest, day, gave } => {
                self.quests.insert(quest.clone(), crate::quests::QuestProgress { stage: 0, since: *day, started: *day, done: false });
                give(&mut self.owned, gave);
                if quest.starts_with("job:") {
                    *self.jobs_taken.entry(*day).or_insert(0) += 1;
                    let keep = day.saturating_sub(3);
                    self.jobs_taken.retain(|d, _| *d >= keep);
                }
            }
            EventKind::QuestAdvanced { quest, day, next, took, gave, reward, .. } => {
                take(&mut self.owned, took);
                give(&mut self.owned, gave);
                if let Some(p) = self.quests.get_mut(quest) {
                    p.stage = *next;
                    p.since = *day;
                }
                if let Some(r) = reward {
                    self.reward(r);
                }
            }
            EventKind::QuestDone { quest, day, reward, .. } => {
                if let Some(p) = self.quests.get_mut(quest) {
                    if !p.done {
                        p.done = true;
                        p.since = *day;
                        let r = reward.clone();
                        self.reward(&r);
                    }
                }
            }
            // work, the garden and skills are folded above
            EventKind::JobTaken { .. }
            | EventKind::JobLeft { .. }
            | EventKind::ShiftStarted { .. }
            | EventKind::WorkDone { .. }
            | EventKind::ShiftEnded { .. }
            | EventKind::Planted { .. }
            | EventKind::Watered { .. }
            | EventKind::Harvested { .. }
            | EventKind::PlotCleared { .. }
            | EventKind::Played { .. }
            | EventKind::Busked { .. }
            | EventKind::Painted { .. } => {}
            // the road is folded above
            EventKind::LessonTaken { .. }
            | EventKind::TheoryTaken { .. }
            | EventKind::ExamStarted { .. }
            | EventKind::ExamEnded { .. }
            | EventKind::CarBought { .. }
            | EventKind::Refuelled { .. }
            | EventKind::CarServiced { .. }
            | EventKind::DriveStarted { .. }
            | EventKind::Parked { .. }
            | EventKind::Violated { .. }
            | EventKind::Arrested { .. }
            | EventKind::FinePaid { .. }
            | EventKind::MoneyFound { .. } => {}
            // building on and the animals are folded above
            EventKind::BuildOrdered { .. }
            | EventKind::BuildFinished { .. }
            | EventKind::PetAdopted { .. }
            | EventKind::FoxFed { .. }
            | EventKind::EggNested { .. }
            | EventKind::PetFed { .. }
            | EventKind::PetCared { .. }
            | EventKind::CompanionSet { .. } => {}
            // what the game no longer has changes nothing
            EventKind::Retired { .. } => {}
            EventKind::Congratulated { who, year, day, gift, taste, delta } => {
                self.congratulated.insert(format!("{who}:{year}"));
                let r = self.relations.entry(who.clone()).or_default();
                r.met = true;
                r.last = Some(*day);
                r.points = (r.points + delta).min(crate::npc::MAX_POINTS);
                if let Some(g) = gift {
                    r.tastes.insert(g.clone(), *taste);
                    if let Some(n) = self.owned.get_mut(g) {
                        *n = n.saturating_sub(1);
                    }
                }
            }
            EventKind::Contributed { project, day, coins, items } => {
                self.spent += u64::from(*coins);
                for (item, n) in items {
                    if let Some(have) = self.owned.get_mut(item) {
                        *have = have.saturating_sub(*n);
                    }
                }
                self.contributions.entry(project.clone()).or_default().push((*day, *coins, items.clone()));
            }
            EventKind::Repaired { took, coins, .. } => {
                take(&mut self.owned, took);
                self.spent += u64::from(*coins);
            }
            EventKind::ToolUsed { item, broke } => {
                if *broke {
                    self.tool_uses.remove(item);
                    if let Some(n) = self.owned.get_mut(item) {
                        *n = n.saturating_sub(1);
                        // the one that wore out may have been the one in the chest
                        let left = *n;
                        if let Some(s) = self.stashed.get_mut(item) {
                            *s = (*s).min(left);
                        }
                    }
                } else {
                    *self.tool_uses.entry(item.clone()).or_insert(0) += 1;
                }
            }
            EventKind::Crafted { recipe, took, gave, learned, .. } => {
                take(&mut self.owned, took);
                give(&mut self.owned, gave);
                if *learned {
                    self.crafts_known.insert(recipe.clone());
                }
            }
            EventKind::Dined { host, day, gave, delta } => {
                self.dined.insert(format!("{host}:{day}"));
                let r = self.relations.entry(host.clone()).or_default();
                r.met = true;
                r.last = Some(*day);
                r.points = (r.points + delta).min(crate::npc::MAX_POINTS);
                if let Some(g) = gave {
                    *self.owned.entry(g.clone()).or_insert(0) += 1;
                }
            }
            EventKind::ResidentGave { who, day, item } => {
                self.kindness.insert(format!("{who}:{day}"));
                *self.owned.entry(item.clone()).or_insert(0) += 1;
                let r = self.relations.entry(who.clone()).or_default();
                r.met = true;
                r.last = Some(*day);
            }
            EventKind::ThemeAcquired { theme, styles } => {
                self.room.owned_themes.insert(theme.clone());
                for s in styles {
                    self.room.owned_styles.insert(s.clone());
                }
            }
        }
        self.events_applied += 1;
    }
}

/// A saved `DeltaState` that covers the log up to and including `through`, with what the checks of the log
/// had found by then, vouched for by `mac` (made with the device's secret): opening a save starts from it
/// and verifies and replays only what came after. A snapshot that does not verify is ignored.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Snapshot {
    pub through: SortKey,
    pub state: DeltaState,
    /// How many events the log held up to and including `through` (all of them, kept or left out).
    #[serde(default)]
    pub covered: u64,
    /// Each device's chain tip and highest sequence number at `through`.
    #[serde(default)]
    pub tips: BTreeMap<u32, u64>,
    #[serde(default)]
    pub seqs: BTreeMap<u32, u64>,
    /// Devices whose events were chained.
    #[serde(default)]
    pub chained: std::collections::BTreeSet<u32>,
    /// What the checks had found: plain old events trusted, inputs replayed, events left out.
    #[serde(default)]
    pub legacy: u32,
    #[serde(default)]
    pub inputs: u32,
    #[serde(default)]
    pub dropped: Vec<crate::event::EventId>,
    /// Events of things the game no longer has, passed over (not written while none: a snapshot from before
    /// reads, and vouches, the same).
    #[serde(default, skip_serializing_if = "is_zero")]
    pub retired: u32,
    /// Whether an input had been seen (after one, plain events are no longer trusted).
    #[serde(default)]
    pub inputs_seen: bool,
    #[serde(default)]
    pub mac: u64,
}

fn is_zero(n: &u32) -> bool {
    *n == 0
}
