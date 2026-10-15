//! The engine behind the WebAssembly bridge. Pure Rust over JSON strings, so it is testable natively.

use std::sync::Arc;

use serde_json::{json, Value};
use teul_core::content::Content;
use teul_core::state::Snapshot;
use teul_core::core::{Command, Core, CoreError, NewWorld};
use teul_core::event::Event;
use teul_core::storage::{MemoryStorage, Storage};
use teul_core::time::WorldTime;

pub struct EngineCore {
    core: Core<MemoryStorage>,
    pending: Vec<Event>,
}

fn to_json<T: serde::Serialize>(value: &T) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| "null".to_string())
}

fn error_json(kind: &str, message: &str, extra: Value) -> String {
    let mut error = json!({ "kind": kind, "message": message });
    if let (Some(base), Some(more)) = (error.as_object_mut(), extra.as_object()) {
        for (k, v) in more {
            base.insert(k.clone(), v.clone());
        }
    }
    json!({ "ok": false, "error": error }).to_string()
}

fn core_error_json(e: &CoreError) -> String {
    let message = e.to_string();
    match e {
        CoreError::Locked(missing) => error_json("locked", &message, json!({ "missing": missing })),
        CoreError::Place(p) => error_json("place", &message, json!({ "reason": format!("{p:?}") })),
        CoreError::Room(r) => error_json("room", &message, json!({ "reason": format!("{r:?}") })),
        CoreError::InvalidProp => error_json("invalid_prop", &message, json!({})),
        CoreError::InvalidSetting => error_json("invalid_setting", &message, json!({})),
        CoreError::UnknownTheme(id) => error_json("unknown_theme", &message, json!({ "id": id })),
        CoreError::ClockWentBackwards { last, now } => {
            error_json("clock_went_backwards", &message, json!({ "last": last.0, "now": now.0 }))
        }
        CoreError::InvalidName => error_json("invalid_name", &message, json!({})),
        CoreError::UnknownItem(id) => error_json("unknown_item", &message, json!({ "id": id })),
        CoreError::UnknownStyle(id) => error_json("unknown_style", &message, json!({ "id": id })),
        CoreError::UnknownAction(id) => error_json("unknown_action", &message, json!({ "id": id })),
        CoreError::UnknownExpansion(id) => error_json("unknown_expansion", &message, json!({ "id": id })),
        CoreError::UnknownPlacement(pid) => error_json("unknown_placement", &message, json!({ "pid": pid })),
        CoreError::NotOwned(id) => error_json("not_owned", &message, json!({ "id": id })),
        CoreError::InvalidColor => error_json("invalid_color", &message, json!({})),
        CoreError::InvalidSlot => error_json("invalid_slot", &message, json!({})),
        CoreError::AlreadyExpanded => error_json("already_expanded", &message, json!({})),
        CoreError::AlreadyOwned => error_json("already_owned", &message, json!({})),
        CoreError::StyleNotOwned => error_json("style_not_owned", &message, json!({})),
        CoreError::ActionNotAvailable => error_json("action_not_available", &message, json!({})),
        CoreError::UnknownNpc(id) => error_json("unknown_npc", &message, json!({ "id": id })),
        CoreError::TooSoon => error_json("too_soon", &message, json!({})),
        CoreError::NotFriendsYet => error_json("not_friends_yet", &message, json!({})),
        CoreError::BadVisit => error_json("bad_visit", &message, json!({})),
        CoreError::NoGift => error_json("no_gift", &message, json!({})),
        CoreError::NothingThere => error_json("nothing_there", &message, json!({})),
        CoreError::NotEnough => error_json("not_enough", &message, json!({})),
        CoreError::NoRequest => error_json("no_request", &message, json!({})),
        CoreError::FareChanged { fare } => error_json("fare_changed", &message, json!({ "fare": fare })),
        CoreError::PocketFull => error_json("pocket_full", &message, json!({})),
        CoreError::NotHere => error_json("not_here", &message, json!({})),
        CoreError::TooFast => error_json("too_fast", &message, json!({})),
        CoreError::Closed => error_json("closed", &message, json!({})),
        CoreError::AlreadyDone => error_json("already_done", &message, json!({})),
        CoreError::UnknownLocation(id) => error_json("unknown_location", &message, json!({ "id": id })),
        CoreError::UnknownStation(id) => error_json("unknown_station", &message, json!({ "id": id })),
        CoreError::UnknownHelp(id) => error_json("unknown_help", &message, json!({ "id": id })),
        CoreError::Needs(what) => error_json("needs", &message, json!({ "what": what })),
        CoreError::NotFood => error_json("not_food", &message, json!({})),
        CoreError::UnknownRecipe(id) => error_json("unknown_recipe", &message, json!({ "id": id })),
        CoreError::UtilityOff(u) => error_json("utility_off", &message, json!({ "utility": u })),
        CoreError::UnknownQuest(q) => error_json("unknown_quest", &message, json!({ "id": q })),
        CoreError::NotLearned(r) => error_json("not_learned", &message, json!({ "recipe": r })),
        CoreError::NoShift => error_json("no_shift", &message, json!({})),
        CoreError::UnknownWork(w) => error_json("unknown_work", &message, json!({ "id": w })),
        CoreError::LookFixed => error_json("look_fixed", &message, json!({})),
        CoreError::NotToday => error_json("not_today", &message, json!({})),
        CoreError::NotInvited => error_json("not_invited", &message, json!({})),
        CoreError::Broken(words) => error_json("broken", &message, json!({ "words": words })),
        CoreError::Fizzled => error_json("fizzled", &message, json!({})),
        CoreError::Jailed => error_json("jailed", &message, json!({})),
        CoreError::Tenant => error_json("tenant", &message, json!({})),
        CoreError::CarBroken => error_json("car_broken", &message, json!({})),
        _ => error_json("internal", &message, json!({})),
    }
}

impl EngineCore {
    /// `packs_json` is a JSON array of pack texts; `events_json` a JSON array of previously drained events.
    pub fn new(packs_json: &str, device: u32, seed: u32, epoch_unix_secs: i64, events_json: &str) -> Result<EngineCore, String> {
        Self::with_secret(packs_json, device, seed, epoch_unix_secs, events_json, 0)
    }

    /// As `new`, with the device's chain secret (kept by the shell beside the world's meta).
    pub fn with_secret(packs_json: &str, device: u32, seed: u32, epoch_unix_secs: i64, events_json: &str, secret: u64) -> Result<EngineCore, String> {
        let packs: Vec<String> = serde_json::from_str(packs_json).map_err(|e| format!("packs: {e}"))?;
        let refs: Vec<&str> = packs.iter().map(String::as_str).collect();
        let content = Content::from_packs(&refs).map_err(|e| e.to_string())?;
        let events: Vec<Event> = serde_json::from_str(events_json).map_err(|e| format!("events: {e}"))?;
        let mut storage = MemoryStorage::new();
        storage.meta_set(teul_core::core::META_SECRET, &(secret & teul_core::economy::MASK52).to_string()).map_err(|e| e.to_string())?;
        storage.append_batch(&events).map_err(|e| e.to_string())?;
        let core = Core::bootstrap(
            storage,
            device,
            NewWorld { seed: u64::from(seed), epoch_unix_secs },
            Arc::new(content),
        )
        .map_err(|e| e.to_string())?;
        Ok(EngineCore { core, pending: Vec::new() })
    }

    /// As `with_secret`, starting from a snapshot the shell kept (`snapshot_json` as `take_snapshot` gave it):
    /// `events_json` then holds only the events after it, and `covered` how many the shell's log has up to it.
    /// `Err("snapshot_refused")` when it does not verify; the shell then opens the whole log.
    #[allow(clippy::too_many_arguments)]
    pub fn with_snapshot(packs_json: &str, device: u32, seed: u32, epoch_unix_secs: i64, events_json: &str, secret: u64, snapshot_json: &str, covered: u64) -> Result<EngineCore, String> {
        let packs: Vec<String> = serde_json::from_str(packs_json).map_err(|e| format!("packs: {e}"))?;
        let refs: Vec<&str> = packs.iter().map(String::as_str).collect();
        let content = Content::from_packs(&refs).map_err(|e| e.to_string())?;
        let snapshot: Snapshot = serde_json::from_str(snapshot_json).map_err(|_| "snapshot_refused".to_string())?;
        let events: Vec<Event> = serde_json::from_str(events_json).map_err(|e| format!("events: {e}"))?;
        let mut storage = MemoryStorage::new();
        storage.meta_set(teul_core::core::META_SECRET, &(secret & teul_core::economy::MASK52).to_string()).map_err(|e| e.to_string())?;
        storage.append_batch(&events).map_err(|e| e.to_string())?;
        let core = Core::bootstrap_from_snapshot(storage, device, NewWorld { seed: u64::from(seed), epoch_unix_secs }, Arc::new(content), snapshot, covered).map_err(|e| match e {
            CoreError::SnapshotRefused => "snapshot_refused".to_string(),
            other => other.to_string(),
        })?;
        Ok(EngineCore { core, pending: Vec::new() })
    }

    /// A snapshot made since the last call (JSON, for the shell to keep beside its log), or "" when none.
    pub fn take_snapshot(&mut self) -> String {
        match self.core.take_new_snapshot() {
            Some(s) => to_json(&s),
            None => String::new(),
        }
    }

    pub fn command(&mut self, now: u32, command_json: &str) -> String {
        let command: Command = match serde_json::from_str(command_json) {
            Ok(c) => c,
            Err(e) => return error_json("bad_command", &e.to_string(), json!({})),
        };
        match self.core.apply_logged(WorldTime(u64::from(now)), command) {
            Ok(events) => {
                // every event is kept (the input too, and the chain), the shell is told what happened
                self.pending.extend(events.iter().cloned());
                let happened: Vec<&Event> = events.iter().filter(|e| !matches!(e.kind, teul_core::event::EventKind::Input { .. })).collect();
                json!({ "ok": true, "events": happened }).to_string()
            }
            Err(e) => core_error_json(&e),
        }
    }

    /// Previews a command: `{"ok":true}` or the same structured error `command` would give.
    pub fn can(&self, now: u32, command_json: &str) -> String {
        let command: Command = match serde_json::from_str(command_json) {
            Ok(c) => c,
            Err(e) => return error_json("bad_command", &e.to_string(), json!({})),
        };
        match self.core.check(WorldTime(u64::from(now)), command) {
            Ok(()) => json!({ "ok": true }).to_string(),
            Err(e) => core_error_json(&e),
        }
    }

    pub fn drain_events(&mut self) -> String {
        to_json(&std::mem::take(&mut self.pending))
    }

    pub fn world_view(&self, now: u32) -> String {
        to_json(&self.core.view(WorldTime(u64::from(now))))
    }

    pub fn room_view(&self) -> String {
        to_json(&self.core.room_view())
    }

    pub fn shop_view(&self, now: u32) -> String {
        to_json(&self.core.shop_view(WorldTime(u64::from(now))))
    }

    pub fn inventory_view(&self) -> String {
        to_json(&self.core.inventory_view())
    }

    pub fn weather(&self, now: u32) -> String {
        to_json(&self.core.weather(WorldTime(u64::from(now))))
    }

    /// How warm the hero feels (JSON `ComfortView`): `swum_ago` minutes since out of the water, negative for not lately.
    pub fn comfort_view(&self, now: u32, near_heat: bool, swum_ago: i32) -> String {
        let near = teul_core::warmth::Near { heat: near_heat, swum_ago: u32::try_from(swum_ago).ok() };
        to_json(&self.core.comfort_view(WorldTime(u64::from(now)), near))
    }

    pub fn life_view(&self, now: u32) -> String {
        to_json(&self.core.life_view(WorldTime(u64::from(now))))
    }

    /// A resident's plan for the day (JSON `ScheduleView`, or `null` for someone unknown).
    pub fn schedule_of(&self, id: &str, now: u32) -> String {
        to_json(&self.core.schedule_of(id, WorldTime(u64::from(now))))
    }

    /// Today in the real year (JSON `DayView`).
    pub fn day_view(&self, now: u32) -> String {
        to_json(&self.core.day_view(WorldTime(u64::from(now))))
    }

    pub fn sky_view(&self, now: u32) -> String {
        to_json(&self.core.sky_view(WorldTime(u64::from(now))))
    }

    pub fn sky_stories(&self, now: u32) -> String {
        to_json(&self.core.sky_stories(WorldTime(u64::from(now))))
    }

    pub fn sky_next(&self, kind: &str, now: u32, days: u32) -> String {
        to_json(&self.core.sky_next(kind, WorldTime(u64::from(now)), days))
    }

    pub fn calendar_day(&self, now: u32) -> String {
        let (y, m, d, info) = self.core.calendar_day(WorldTime(u64::from(now)));
        to_json(&serde_json::json!({ "year": y, "month": m, "day": d, "info": info }))
    }

    pub fn news_between(&self, from: u32, to: u32) -> String {
        to_json(&self.core.news_between(WorldTime(u64::from(from)), WorldTime(u64::from(to))))
    }

    pub fn daily_view(&self, now: u32) -> String {
        to_json(&self.core.daily_view(WorldTime(u64::from(now))))
    }

    pub fn npc_view(&self, now: u32) -> String {
        to_json(&self.core.npc_view(WorldTime(u64::from(now))))
    }

    pub fn wallet_view(&self) -> String {
        to_json(&self.core.wallet_view())
    }

    pub fn pocket_view(&self) -> String {
        to_json(&self.core.pocket_view())
    }

    pub fn stations_view(&self, now: u32) -> String {
        to_json(&self.core.stations_view(WorldTime(u64::from(now))))
    }

    pub fn fridge_view(&self, now: u32) -> String {
        to_json(&self.core.fridge_view_at(WorldTime(u64::from(now))))
    }

    pub fn recipes_view(&self, now: u32) -> String {
        to_json(&self.core.recipes_view(WorldTime(u64::from(now))))
    }

    pub fn bills_view(&self, now: u32) -> String {
        to_json(&self.core.bills_view(WorldTime(u64::from(now))))
    }

    pub fn works_view(&self, now: u32) -> String {
        to_json(&self.core.works_view(WorldTime(u64::from(now))))
    }

    pub fn shift_view(&self, now: u32) -> String {
        to_json(&self.core.shift_view(WorldTime(u64::from(now))))
    }

    pub fn garden_view(&self, now: u32) -> String {
        to_json(&self.core.garden_view(WorldTime(u64::from(now))))
    }

    /// How the things at home have aged.
    pub fn wear_view(&self, now: u32) -> String {
        to_json(&self.core.wear_view(WorldTime(u64::from(now))))
    }

    /// What one knows how to make, and whether one stands at a workbench.
    pub fn crafts_view(&self, now: u32) -> String {
        to_json(&self.core.crafts_view(WorldTime(u64::from(now))))
    }

    pub fn tools_view(&self) -> String {
        to_json(&self.core.tools_view())
    }

    /// Who of the town has a smartphone and a laptop now, and what the post office sells.
    pub fn tech_view(&self, now: u32) -> String {
        to_json(&self.core.tech_view(WorldTime(u64::from(now))))
    }

    /// The builders' offers and one's orders (builds.rs).
    pub fn builds_view(&self, now: u32) -> String {
        to_json(&self.core.builds_view(WorldTime(u64::from(now))))
    }

    /// The animals one lives with and what can be done about animals here (pets.rs).
    pub fn pets_view(&self, now: u32) -> String {
        to_json(&self.core.pets_view(WorldTime(u64::from(now))))
    }

    pub fn skills_view(&self) -> String {
        to_json(&self.core.skills_view())
    }

    pub fn paintings_view(&self) -> String {
        to_json(&self.core.paintings_view())
    }

    /// The pieces one can play and which are known.
    pub fn repertoire_view(&self) -> String {
        to_json(&self.core.repertoire_view())
    }

    /// How many would stop to listen in the street now.
    pub fn listeners(&self, now: u32) -> u32 {
        self.core.listeners_at(WorldTime(u64::from(now)))
    }

    /// Clothes owned and worn, the first day's clothes, what the shop sells right here and now.
    pub fn wardrobe_view(&self, now: u32) -> String {
        to_json(&self.core.wardrobe_view(WorldTime(u64::from(now))))
    }

    pub fn salon_view(&self, now: u32) -> String {
        to_json(&self.core.salon_view(WorldTime(u64::from(now))))
    }

    /// Homes and plots: the player's, rented, for rent or for sale, and where the player lives.
    pub fn homes_view(&self, now: u32) -> String {
        let t = WorldTime(u64::from(now));
        to_json(&json!({ "address": self.core.address(t), "fixed": self.core.look_fixed(), "homes": self.core.homes_view(t) }))
    }

    pub fn helps_view(&self, now: u32) -> String {
        to_json(&self.core.helps_view(WorldTime(u64::from(now))))
    }

    /// The notebook of promises: quests taken, what may be taken, what was done.
    pub fn town_view(&self, now: u32) -> String {
        to_json(&self.core.town_view(WorldTime(u64::from(now))))
    }

    /// How the town feels: moods, ties, how warm people are with the player, gossip.
    pub fn feelings_view(&self, now: u32) -> String {
        to_json(&self.core.feelings_view(WorldTime(u64::from(now))))
    }

    pub fn growth_view(&self, now: u32) -> String {
        to_json(&self.core.growth_view(WorldTime(u64::from(now))))
    }

    pub fn quests_view(&self, now: u32) -> String {
        to_json(&self.core.quests_view(WorldTime(u64::from(now))))
    }

    /// The road: the driving school, the car, the licence and its coupon, fines, the cell, money on the road.
    pub fn drive_view(&self, now: u32) -> String {
        to_json(&self.core.drive_view(WorldTime(u64::from(now))))
    }

    /// What the paper of the day of `now` tells of the player on the road (headline, text, photo, section).
    pub fn driver_stories(&self, now: u32) -> String {
        to_json(&self.core.driver_stories(WorldTime(u64::from(now)).day()))
    }

    pub fn paper_view(&self, now: u32) -> String {
        to_json(&self.core.paper_view(WorldTime(u64::from(now))))
    }

    /// The celebration of the day of `now` (JSON `FestivalView` or `null`).
    pub fn festival_view(&self, now: u32) -> String {
        to_json(&self.core.festival_view(WorldTime(u64::from(now))))
    }

    /// The nuclear plant's story on the day of `now` (JSON `NppView` or `null`).
    pub fn npp_view(&self, now: u32) -> String {
        to_json(&self.core.npp_view(WorldTime(u64::from(now))))
    }

    pub fn location_view(&self, now: u32) -> String {
        to_json(&self.core.location_view(WorldTime(u64::from(now))))
    }

    /// What opening the save found (events left out as forged or edited).
    pub fn integrity(&self) -> String {
        to_json(self.core.integrity())
    }

    /// Where the taxi can go from a place at `now`, with the price of each ride then (by demand: the hour, the
    /// weather, the feasts, the place), how soon the car comes, and why the price is what it is.
    pub fn taxi_destinations(&self, now: u32, from: &str, x: i32, y: i32) -> String {
        let now = WorldTime(u64::from(now));
        // «home» is the door of where the player lives now
        let list: Vec<_> = self
            .core
            .taxi_dests(now)
            .into_iter()
            .filter_map(|d| {
                let shut = self.core.taxi_shut(&d, now);
                self.core.taxi_quote(now, (from, x, y), &d).map(|q| {
                    json!({ "id": d.id, "name": d.name, "location": d.location, "x": d.x, "y": d.y, "fare": q.fare, "eta": q.eta, "minutes": q.minutes, "tiles": q.tiles, "why": q.why, "trend": q.trend, "shut": shut })
                })
            })
            .collect();
        to_json(&list)
    }

    /// Shows the world's words through a text overlay (`null` for the packs' own words). The same packs as the
    /// engine was opened with; only text changes, never an outcome. False when refused.
    pub fn retext(&mut self, packs_json: &str, overlay_json: Option<String>) -> Result<bool, String> {
        let packs: Vec<String> = serde_json::from_str(packs_json).map_err(|e| format!("packs: {e}"))?;
        let refs: Vec<&str> = packs.iter().map(String::as_str).collect();
        let content = Content::from_packs_in(&refs, overlay_json.as_deref()).map_err(|e| e.to_string())?;
        Ok(self.core.retext(Arc::new(content)))
    }

    pub fn catalog(&self) -> String {
        let c = self.core.content();
        to_json(&json!({
            "items": c.items,
            "styles": c.styles,
            "actions": c.actions,
            "expansions": c.expansions,
            "materials": c.materials,
            "themes": c.themes,
            "palettes": c.palettes,
            "start_coins": c.start_coins,
            "packs": c.packs,
            "npcs": c.npcs,
            "locations": c.locations,
            "front": c.front,
            "kits": c.kits,
            "collections": c.collections,
            "sites": c.sites,
            "site_location": c.site_location,
            "residents": c.residents,
            "taxi": c.taxi,
            "pocket": c.pocket,
            "stations": c.stations,
            "helps": c.helps,
            "interviews": c.interviews,
            "work": c.work,
            "plants": c.plants,
            "tools": c.tools,
            "crafts": c.crafts,
            "builds": c.builds,
            "pets": c.pets,
            // how the town grows and wears: building sites, empty houses, wear, the ice-cream cart
            "growth": c.growth,
            // what mending each worn thing costs at the workshop
            "restore_prices": c.items.values().filter_map(|d| d.restores.as_ref().map(|into| (d.id.clone(), teul_core::core::restore_price(c, into)))).collect::<std::collections::BTreeMap<_, _>>(),
        }))
    }

    /// World minutes since the world's epoch for a `Date.now()` value; clamps to zero before the epoch.
    pub fn world_minutes(&self, unix_ms: f64) -> u32 {
        let secs = (unix_ms / 1000.0).floor() as i64;
        match self.core.clock().world_time(secs) {
            Ok(t) => t.0.min(u64::from(u32::MAX)) as u32,
            Err(_) => 0,
        }
    }
}

/// A key seed from hex (32 bytes).
pub fn seed_of(hex: &str) -> Option<[u8; 32]> {
    teul_core::keys::from_hex(hex)?.try_into().ok()
}

/// The public key (hex) of a seed (hex); empty for a bad seed.
pub fn public_key(seed_hex: &str) -> String {
    seed_of(seed_hex).map(|s| teul_core::keys::to_hex(&teul_core::keys::public_key(&s))).unwrap_or_default()
}

