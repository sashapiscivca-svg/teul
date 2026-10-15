//! Plain-data views of the room engine for the shell. Nothing here changes state.

use std::collections::BTreeMap;

use serde::Serialize;

use crate::core::Core;
use crate::npc;
use crate::room::{self, parse_edge, WallSide};
use crate::storage::Storage;
use crate::time::WorldTime;
use crate::unlock::{self, Cost, Missing};

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct PlacementView {
    pub pid: u32,
    pub item: String,
    pub x: i32,
    pub y: i32,
    pub rot: u8,
    pub wall: Option<WallSide>,
    pub on: Option<u32>,
    /// Slot to colour, defaults already resolved. Empty for unknown items.
    pub colors: BTreeMap<String, String>,
    pub props: BTreeMap<String, String>,
    pub known: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct RoomView {
    pub cells: Vec<(i32, i32)>,
    /// Style kind (floor, wall...) to chosen style id.
    pub styles: BTreeMap<String, String>,
    /// Style kind to the parameters of the chosen style.
    pub style_params: BTreeMap<String, BTreeMap<String, String>>,
    pub placements: Vec<PlacementView>,
    /// Floor cells that have their own style ("x,y" to style id), and wall faces ("x,y,side") likewise.
    pub floor_paint: BTreeMap<String, String>,
    pub wall_paint: BTreeMap<String, String>,
    /// Dividers between cells, one entry per divider (canonical cell and east or south side).
    pub dividers: Vec<(i32, i32, WallSide)>,
    pub settings: BTreeMap<String, String>,
    pub area_budget: u32,
    pub area_used: u32,
    /// Coins for one more cell of floor, bought while building.
    pub cell_price: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ShopKind {
    Item,
    Style,
    Expansion,
    Theme,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum ShopStatus {
    Available { cost: Cost },
    Locked { missing: Vec<Missing> },
    Owned,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct ShopEntry {
    pub id: String,
    pub kind: ShopKind,
    pub category: String,
    pub status: ShopStatus,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct InventoryEntry {
    pub item: String,
    pub owned: u32,
    pub placed: u32,
    pub free: u32,
    pub known: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct WalletView {
    pub coins: u64,
    pub tokens: BTreeMap<String, u64>,
    pub counters: BTreeMap<String, u64>,
}

impl<S: Storage> Core<S> {
    pub fn room_view(&self) -> RoomView {
        let content = self.content();
        let state = self.state();
        let mut styles = content.start_styles.clone();
        for (kind, id) in &state.room.styles {
            styles.insert(kind.clone(), id.clone());
        }
        let style_params = styles
            .iter()
            .map(|(kind, id)| (kind.clone(), content.styles.get(id).map(|s| s.params.clone()).unwrap_or_default()))
            .collect();
        let placements = state
            .room
            .placements
            .values()
            .map(|p| {
                let def = content.items.get(&p.item);
                let mut colors = BTreeMap::new();
                if let Some(def) = def {
                    for (slot, slot_def) in &def.slots {
                        colors.insert(slot.clone(), slot_def.default.clone());
                    }
                    for (slot, color) in &p.colors {
                        colors.insert(slot.clone(), color.clone());
                    }
                }
                PlacementView {
                    pid: p.pid,
                    item: p.item.clone(),
                    x: p.x,
                    y: p.y,
                    rot: p.rot,
                    wall: p.wall,
                    on: p.on,
                    colors,
                    props: p.props.clone(),
                    known: def.is_some(),
                }
            })
            .collect();
        let cells: Vec<(i32, i32)> = room::cells(content, &state.room).into_iter().collect();
        let dividers = state.room.dividers.iter().filter_map(|k| parse_edge(k)).collect();
        RoomView {
            area_used: cells.len() as u32,
            area_budget: room::area_budget(content, &state.room),
            cell_price: content.cell_price,
            cells,
            styles,
            style_params,
            placements,
            floor_paint: state.room.floor_paint.clone(),
            wall_paint: state.room.wall_paint.clone(),
            dividers,
            settings: state.room.settings.clone(),
        }
    }

    pub fn shop_view(&self, now: WorldTime) -> Vec<ShopEntry> {
        let content = self.content();
        let wallet = self.wallet();
        let season = self.calendar().season(now);
        let status_of = |unlock: &unlock::Unlock| match unlock::check(unlock, &wallet, season) {
            Ok(cost) => ShopStatus::Available { cost },
            Err(missing) => ShopStatus::Locked { missing },
        };
        let mut out = Vec::new();
        for def in content.items.values().filter(|d| !d.hidden) {
            out.push(ShopEntry { id: def.id.clone(), kind: ShopKind::Item, category: def.category.clone(), status: status_of(&def.acquire) });
        }
        for def in content.styles.values() {
            let status = if self.style_owned(&def.id) { ShopStatus::Owned } else { status_of(&def.acquire) };
            out.push(ShopEntry { id: def.id.clone(), kind: ShopKind::Style, category: def.kind.clone(), status });
        }
        for def in content.expansions.values() {
            let status = if self.state().room.expansions.contains(&def.id) { ShopStatus::Owned } else { status_of(&def.acquire) };
            out.push(ShopEntry { id: def.id.clone(), kind: ShopKind::Expansion, category: "expansion".into(), status });
        }
        for def in content.themes.values() {
            let status = if self.state().room.owned_themes.contains(&def.id) { ShopStatus::Owned } else { status_of(&def.acquire) };
            out.push(ShopEntry { id: def.id.clone(), kind: ShopKind::Theme, category: "theme".into(), status });
        }
        out
    }

    pub fn inventory_view(&self) -> Vec<InventoryEntry> {
        let content = self.content();
        self.state()
            .owned
            .iter()
            .map(|(item, owned)| {
                let placed = self.state().room.placements.values().filter(|p| &p.item == item).count() as u32;
                InventoryEntry {
                    item: item.clone(),
                    owned: *owned,
                    placed,
                    free: owned.saturating_sub(placed),
                    known: content.items.contains_key(item),
                }
            })
            .collect()
    }

    pub fn wallet_view(&self) -> WalletView {
        let w = self.wallet();
        WalletView { coins: w.coins, tokens: w.tokens, counters: w.counters }
    }

    /// Everyone of the world at `now`: where they are (or were, while walking), and the player's friendship.
    pub fn npc_view(&self, now: WorldTime) -> Vec<NpcView> {
        let content = self.content();
        let seed = self.meta().seed;
        content
            .npcs
            .values()
            .map(|def| {
                let index = npc::stream_of(&def.id);
                let rel = self.state().relations.get(&def.id).cloned().unwrap_or_default();
                let stay = npc::stay_at(seed, index, def, &content.places, now);
                let prev = npc::previous_stay(seed, index, def, &content.places, &stay);
                let visiting = matches!(rel.visit, Some((from, until)) if from <= now.0 && now.0 < until);
                let place_def = content.places.get(&stay.place);
                let today = now.day();
                let location_of = |place: &str| content.place_location.get(place).cloned().unwrap_or_default();
                NpcView {
                    location: if visiting { "home".into() } else { location_of(&stay.place) },
                    from_location: location_of(&prev.place),
                    id: def.id.clone(),
                    name: def.name.clone(),
                    place: if visiting { "home".into() } else { stay.place.clone() },
                    place_name: place_def.map(|p| p.name.clone()).unwrap_or_default(),
                    activity: place_def.map(|p| p.activity.clone()).unwrap_or_default(),
                    x: stay.x,
                    y: stay.y,
                    from_place: prev.place.clone(),
                    from_x: prev.x,
                    from_y: prev.y,
                    since: stay.from,
                    until: stay.to,
                    arrives: (stay.from + npc::TRAVEL_MINUTES).min(stay.to),
                    visiting,
                    visit: rel.visit,
                    met: rel.met,
                    points: rel.points,
                    hearts: rel.hearts(),
                    talked_today: rel.talks > 0 && rel.talk_day.0 == today,
                    talks_today: if rel.talks > 0 && rel.talk_day.0 == today { rel.talk_day.1 } else { 0 },
                    gift_today: rel.gift_day == Some(today),
                    tastes: rel.tastes.clone(),
                    received: rel.received.iter().cloned().collect(),
                }
            })
            .collect()
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct NpcView {
    /// The location they are in (`home` while visiting the player) and the one they come from.
    pub location: String,
    pub from_location: String,
    pub id: String,
    pub name: String,
    /// A place id of the village, or `home` while visiting the player.
    pub place: String,
    pub place_name: String,
    pub activity: String,
    pub x: i32,
    pub y: i32,
    /// Where they come from at the start of this part of the day; they walk until `arrives`.
    pub from_place: String,
    pub from_x: i32,
    pub from_y: i32,
    pub since: u64,
    pub until: u64,
    pub arrives: u64,
    pub visiting: bool,
    pub visit: Option<(u64, u64)>,
    pub met: bool,
    pub points: u32,
    pub hearts: u32,
    pub talked_today: bool,
    pub talks_today: u32,
    pub gift_today: bool,
    pub tastes: BTreeMap<String, i8>,
    pub received: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct RequestView {
    pub npc: String,
    pub name: String,
    pub text: String,
    pub items: Vec<(String, u32)>,
    pub coins: u32,
    pub gift: Option<String>,
    pub thanks: String,
    pub done: bool,
    /// The player has what it takes.
    pub ready: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct LetterView {
    pub npc: String,
    pub name: String,
    pub index: u32,
    pub text: String,
    pub gift: Option<String>,
    pub opened: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct CollectionView {
    pub id: String,
    pub name: String,
    pub items: Vec<String>,
    pub found: Vec<String>,
    pub reward: String,
    pub done: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct StoryView {
    pub npc: String,
    pub step: u32,
    pub total: u32,
    /// The next chapter's title, and whether it can be played now (hearts and days).
    pub next: Option<String>,
    pub ready: bool,
    pub ask: Option<crate::daily::AskDef>,
    /// The player has what the next chapter needs (always true when it needs nothing).
    pub has_items: bool,
    pub lines: Vec<String>,
}

/// What today holds: requests, the paper, the mail, the album, stories, spots and catches.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct DailyView {
    pub day: u64,
    pub requests: Vec<RequestView>,
    pub paper: Vec<String>,
    pub note: Option<(String, String, String)>,
    pub letters: Vec<LetterView>,
    pub collections: Vec<CollectionView>,
    pub collected: Vec<String>,
    pub stories: Vec<StoryView>,
    /// Spots with nothing in them today: those that already gave, and those (like the bins) that only now and then hold something.
    pub gathered_today: Vec<String>,
    pub catches_left: u32,
}

impl<S: Storage> Core<S> {
    pub fn daily_view(&self, now: WorldTime) -> DailyView {
        use crate::daily;
        let content = self.content();
        let state = self.state();
        let seed = self.meta().seed;
        let day = now.day();
        // what is ready to hand over is what the player carries (the chest stays at home)
        let free = self.pocket_items();
        let hearts = |npc: &str| state.relations.get(npc).map(|r| r.hearts()).unwrap_or(0);
        let requests = daily::requests_of(seed, content, now, self.calendar().season(now))
            .into_iter()
            .map(|(npc, i)| {
                let def = &content.npcs[&npc];
                let ask = &def.asks[i];
                RequestView {
                    name: def.name.clone(),
                    text: ask.text.clone(),
                    items: ask.items.clone(),
                    coins: ask.coins,
                    gift: ask.gift.clone(),
                    thanks: ask.thanks.clone(),
                    done: state.delivered.contains(&format!("{day}:{npc}")),
                    ready: daily::take_for(content, &free, &ask.items).is_some(),
                    npc,
                }
            })
            .collect();
        let letters = content
            .npcs
            .values()
            .flat_map(|def| {
                def.letters.iter().enumerate().filter(|(_, l)| hearts(&def.id) >= l.hearts).map(|(i, l)| LetterView {
                    npc: def.id.clone(),
                    name: def.name.clone(),
                    index: i as u32,
                    text: l.text.clone(),
                    gift: l.gift.clone(),
                    opened: state.letters.contains(&format!("{}:{i}", def.id)),
                })
            })
            .collect();
        let collections = content
            .collections
            .values()
            .map(|c| CollectionView {
                id: c.id.clone(),
                name: c.name.clone(),
                items: c.items.clone(),
                found: c.items.iter().filter(|i| state.collected.contains(*i)).cloned().collect(),
                reward: c.reward.clone(),
                done: state.collections.contains(&c.id),
            })
            .collect();
        let stories = content
            .npcs
            .values()
            .filter(|d| !d.story.is_empty())
            .map(|d| {
                let (done, last) = state.story.get(&d.id).copied().unwrap_or((0, 0));
                let next = d.story.get(done as usize);
                StoryView {
                    npc: d.id.clone(),
                    step: done,
                    total: d.story.len() as u32,
                    next: next.map(|c| c.title.clone()),
                    ready: next.is_some_and(|c| hearts(&d.id) >= c.hearts && (done == 0 || day >= last + c.after_days)),
                    ask: next.and_then(|c| c.ask.clone()),
                    has_items: next.and_then(|c| c.ask.as_ref()).is_none_or(|a| daily::take_for(content, &free, &a.items).is_some()),
                    lines: next.map(|c| c.lines.clone()).unwrap_or_default(),
                }
            })
            .collect();
        let note = daily::note_of(seed, content, day).map(|(id, text)| (id.clone(), content.npcs[&id].name.clone(), text));
        DailyView {
            day,
            requests,
            paper: daily::paper_of(seed, content, day),
            note,
            letters,
            collections,
            collected: state.collected.iter().cloned().collect(),
            stories,
            gathered_today: content
                .spots
                .values()
                .filter(|s| state.gathered.get(&s.id) == Some(&day) || !daily::spot_has_today(seed, s, day))
                .map(|s| s.id.clone())
                .collect(),
            catches_left: daily::CATCHES_PER_DAY - if state.catches.0 == day { state.catches.1.min(daily::CATCHES_PER_DAY) } else { 0 },
        }
    }
}
