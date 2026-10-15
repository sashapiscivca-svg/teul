//! New things come to Lypove over real time (docs/world-economy.md §14). A few weeks after the world began the
//! post office opens a counter «Техніка» with smartphones; laptops follow. Then the town takes them up the way a
//! town does: the young and busy first, the old last, some never. People look at their phones on the benches, talk
//! on them walking, take pictures at the feasts; those with laptops and no office sit in the café with a coffee
//! and work. All of it is drawn from the seed, the person and the day — the same on every device.

use serde::Serialize;

use crate::core::Core;
use crate::rng::{rand_below, Domain};
use crate::storage::Storage;
use crate::time::WorldTime;

pub const TECH: Domain = Domain(98);

/// The world day the counter «Техніка» opens with smartphones, and the day laptops come to it.
pub const PHONES_FROM: u64 = 21;
pub const LAPTOPS_FROM: u64 = 45;

/// The player's own things.
pub const PHONE: &str = "smartphone";
pub const LAPTOP: &str = "laptop";

fn draw(seed: u64, id: &str, k: u64, n: u64) -> u64 {
    rand_below(seed, TECH, crate::npc::stream_of(id) * 8 + k, 0, n)
}

/// The world day someone of the town gets a smartphone (None: never — some keep their old phone for good).
pub fn phone_day(seed: u64, id: &str, age: &str) -> Option<u64> {
    let never = draw(seed, id, 0, 100);
    let (share_never, from, spread) = match age {
        "elder" => (35, 60, 330),
        "child" => (45, 75, 260),
        _ => (6, PHONES_FROM + 2, 150),
    };
    if never < share_never {
        return None;
    }
    // the curve: most come early, the rest trail off (the earlier of two draws)
    let a = draw(seed, id, 1, spread);
    let b = draw(seed, id, 2, spread);
    Some(from + a.min(b))
}

/// The world day someone gets a laptop (grown-ups only; about one in three).
pub fn laptop_day(seed: u64, id: &str, age: &str) -> Option<u64> {
    if age != "adult" || draw(seed, id, 3, 100) >= 34 {
        return None;
    }
    Some(LAPTOPS_FROM + 3 + draw(seed, id, 4, 200))
}

pub fn has_phone(seed: u64, id: &str, age: &str, day: u64) -> bool {
    phone_day(seed, id, age).is_some_and(|d| day >= d)
}

pub fn has_laptop(seed: u64, id: &str, age: &str, day: u64) -> bool {
    laptop_day(seed, id, age).is_some_and(|d| day >= d)
}

/// Someone who works on a laptop, from the café on a weekday (when they have no shift of their own that day).
pub fn freelancer(seed: u64, id: &str, age: &str, day: u64) -> bool {
    has_laptop(seed, id, age, day) && draw(seed, id, 5, 100) < 70
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct TechView {
    /// The counter «Техніка» at the post office sells phones; and laptops.
    pub phones_sold: bool,
    pub laptops_sold: bool,
    /// Who of the town has a smartphone, a laptop now.
    pub phones: Vec<String>,
    pub laptops: Vec<String>,
    /// The player's own.
    pub my_phone: bool,
    pub my_laptop: bool,
}

impl<S: Storage> Core<S> {
    pub fn has_phone(&self) -> bool {
        self.state().owned.get(PHONE).copied().unwrap_or(0) > 0
    }

    pub fn tech_view(&self, now: WorldTime) -> TechView {
        let seed = self.meta().seed;
        let day = now.day();
        let people = &self.content().residents;
        TechView {
            phones_sold: day >= PHONES_FROM,
            laptops_sold: day >= LAPTOPS_FROM,
            phones: people.values().filter(|r| has_phone(seed, &r.id, &r.age, day)).map(|r| r.id.clone()).collect(),
            laptops: people.values().filter(|r| has_laptop(seed, &r.id, &r.age, day)).map(|r| r.id.clone()).collect(),
            my_phone: self.has_phone(),
            my_laptop: self.state().owned.get(LAPTOP).copied().unwrap_or(0) > 0,
        }
    }

    /// What the paper could say of it today (for the morning paper; empty most days).
    pub fn tech_news(&self, now: WorldTime) -> Vec<String> {
        let seed = self.meta().seed;
        let day = now.day();
        let people = &self.content().residents;
        let mut out = Vec::new();
        if day == PHONES_FROM {
            out.push(self.lang().pick("На пошті відкрили прилавок «Техніка»: смартфони з камерою, мапою й прогнозом погоди. На пошті кажуть, що листів від цього менше не стане.", "The post office has opened a “Tekhnika” counter: smartphones with a camera, a map and the weather forecast. The post office says there will be no fewer letters for it.").to_string());
        }
        if day == LAPTOPS_FROM {
            out.push(self.lang().pick("На прилавку «Техніка» з'явилися ноутбуки. У кав'ярні вже питають, чи можна сидіти з ними до обіду.", "Laptops have appeared on the “Tekhnika” counter. The café is already being asked whether one may sit with them until lunch.").to_string());
        }
        let total = people.len().max(1);
        let share = |d: u64| people.values().filter(|r| has_phone(seed, &r.id, &r.age, d)).count() * 100 / total;
        if day > PHONES_FROM && share(day) >= 50 && share(day - 1) < 50 {
            out.push(self.lang().pick("Половина Липового вже має смартфони. На лавках біля фонтану тепер сидять мовчки — і всміхаються екранам.", "Half of Lypove has a smartphone now. On the benches by the fountain people sit in silence — smiling at their screens.").to_string());
        }
        out
    }
}
