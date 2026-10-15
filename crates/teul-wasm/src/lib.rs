//! WebAssembly bridge: a thin `wasm-bindgen` layer over `engine::EngineCore`.

pub mod engine;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Engine {
    inner: engine::EngineCore,
}

#[wasm_bindgen]
impl Engine {
    #[wasm_bindgen(constructor)]
    pub fn new(packs_json: &str, device: u32, seed: u32, epoch_unix_secs: f64, events_json: &str, secret: Option<f64>, snapshot_json: Option<String>, covered: Option<f64>) -> Result<Engine, String> {
        let secret = secret.filter(|s| s.is_finite() && *s >= 0.0).map_or(0, |s| s as u64);
        match snapshot_json.filter(|s| !s.is_empty()) {
            // the snapshot the shell kept, and only the events after it
            Some(snap) => Ok(Engine {
                inner: engine::EngineCore::with_snapshot(packs_json, device, seed, epoch_unix_secs as i64, events_json, secret, &snap, covered.filter(|c| c.is_finite() && *c >= 0.0).map_or(0, |c| c as u64))?,
            }),
            None => Ok(Engine { inner: engine::EngineCore::with_secret(packs_json, device, seed, epoch_unix_secs as i64, events_json, secret)? }),
        }
    }

    /// A snapshot made since the last call (JSON), or "" when none: the shell keeps it beside its log.
    pub fn take_snapshot(&mut self) -> String {
        self.inner.take_snapshot()
    }

    pub fn command(&mut self, now: u32, command_json: &str) -> String {
        self.inner.command(now, command_json)
    }

    pub fn can(&self, now: u32, command_json: &str) -> String {
        self.inner.can(now, command_json)
    }

    pub fn drain_events(&mut self) -> String {
        self.inner.drain_events()
    }

    /// The world's words through a text overlay (none: the packs' own); only text, never an outcome.
    pub fn retext(&mut self, packs_json: &str, overlay_json: Option<String>) -> Result<bool, String> {
        self.inner.retext(packs_json, overlay_json)
    }

    pub fn pocket_view(&self) -> String {
        self.inner.pocket_view()
    }

    pub fn stations_view(&self, now: u32) -> String {
        self.inner.stations_view(now)
    }

    pub fn fridge_view(&self, now: u32) -> String {
        self.inner.fridge_view(now)
    }

    pub fn recipes_view(&self, now: u32) -> String {
        self.inner.recipes_view(now)
    }

    pub fn bills_view(&self, now: u32) -> String {
        self.inner.bills_view(now)
    }

    pub fn works_view(&self, now: u32) -> String {
        self.inner.works_view(now)
    }

    pub fn shift_view(&self, now: u32) -> String {
        self.inner.shift_view(now)
    }

    pub fn garden_view(&self, now: u32) -> String {
        self.inner.garden_view(now)
    }

    pub fn wear_view(&self, now: u32) -> String {
        self.inner.wear_view(now)
    }

    pub fn crafts_view(&self, now: u32) -> String {
        self.inner.crafts_view(now)
    }

    pub fn tools_view(&self) -> String {
        self.inner.tools_view()
    }

    pub fn tech_view(&self, now: u32) -> String {
        self.inner.tech_view(now)
    }

    pub fn builds_view(&self, now: u32) -> String {
        self.inner.builds_view(now)
    }

    pub fn pets_view(&self, now: u32) -> String {
        self.inner.pets_view(now)
    }

    pub fn skills_view(&self) -> String {
        self.inner.skills_view()
    }

    pub fn paintings_view(&self) -> String {
        self.inner.paintings_view()
    }

    pub fn repertoire_view(&self) -> String {
        self.inner.repertoire_view()
    }

    pub fn listeners(&self, now: u32) -> u32 {
        self.inner.listeners(now)
    }

    pub fn wardrobe_view(&self, now: u32) -> String {
        self.inner.wardrobe_view(now)
    }

    pub fn salon_view(&self, now: u32) -> String {
        self.inner.salon_view(now)
    }

    pub fn homes_view(&self, now: u32) -> String {
        self.inner.homes_view(now)
    }

    pub fn helps_view(&self, now: u32) -> String {
        self.inner.helps_view(now)
    }

    /// The town at `now`: the day's events, projects, openings, invitations, a visitor, bonds, changes, flags.
    pub fn town_view(&self, now: u32) -> String {
        self.inner.town_view(now)
    }

    /// How the town feels: moods, ties, how warm people are with the player, gossip.
    pub fn feelings_view(&self, now: u32) -> String {
        self.inner.feelings_view(now)
    }

    /// How the town grows and wears: building sites, what changed lately, whether the ice-cream cart is out.
    pub fn growth_view(&self, now: u32) -> String {
        self.inner.growth_view(now)
    }

    pub fn quests_view(&self, now: u32) -> String {
        self.inner.quests_view(now)
    }

    pub fn drive_view(&self, now: u32) -> String {
        self.inner.drive_view(now)
    }

    pub fn driver_stories(&self, now: u32) -> String {
        self.inner.driver_stories(now)
    }

    pub fn paper_view(&self, now: u32) -> String {
        self.inner.paper_view(now)
    }

    pub fn npp_view(&self, now: u32) -> String {
        self.inner.npp_view(now)
    }

    pub fn festival_view(&self, now: u32) -> String {
        self.inner.festival_view(now)
    }

    pub fn location_view(&self, now: u32) -> String {
        self.inner.location_view(now)
    }

    pub fn integrity(&self) -> String {
        self.inner.integrity()
    }

    pub fn world_view(&self, now: u32) -> String {
        self.inner.world_view(now)
    }

    pub fn room_view(&self) -> String {
        self.inner.room_view()
    }

    pub fn shop_view(&self, now: u32) -> String {
        self.inner.shop_view(now)
    }

    pub fn inventory_view(&self) -> String {
        self.inner.inventory_view()
    }

    pub fn weather(&self, now: u32) -> String {
        self.inner.weather(now)
    }

    pub fn comfort_view(&self, now: u32, near_heat: bool, swum_ago: i32) -> String {
        self.inner.comfort_view(now, near_heat, swum_ago)
    }

    pub fn taxi_destinations(&self, now: u32, from: &str, x: i32, y: i32) -> String {
        self.inner.taxi_destinations(now, from, x, y)
    }

    pub fn life_view(&self, now: u32) -> String {
        self.inner.life_view(now)
    }

    pub fn schedule_of(&self, id: &str, now: u32) -> String {
        self.inner.schedule_of(id, now)
    }

    pub fn day_view(&self, now: u32) -> String {
        self.inner.day_view(now)
    }

    pub fn calendar_day(&self, now: u32) -> String {
        self.inner.calendar_day(now)
    }

    pub fn sky_view(&self, now: u32) -> String {
        self.inner.sky_view(now)
    }

    pub fn sky_stories(&self, now: u32) -> String {
        self.inner.sky_stories(now)
    }

    pub fn sky_next(&self, kind: &str, now: u32, days: u32) -> String {
        self.inner.sky_next(kind, now, days)
    }

    pub fn news_between(&self, from: u32, to: u32) -> String {
        self.inner.news_between(from, to)
    }

    pub fn daily_view(&self, now: u32) -> String {
        self.inner.daily_view(now)
    }

    pub fn npc_view(&self, now: u32) -> String {
        self.inner.npc_view(now)
    }

    pub fn wallet_view(&self) -> String {
        self.inner.wallet_view()
    }

    pub fn catalog(&self) -> String {
        self.inner.catalog()
    }

    pub fn world_minutes(&self, unix_ms: f64) -> u32 {
        self.inner.world_minutes(unix_ms)
    }

}

/// The public key (hex) of a world's seed (hex).
#[wasm_bindgen]
pub fn public_key(seed_hex: &str) -> String {
    engine::public_key(seed_hex)
}

