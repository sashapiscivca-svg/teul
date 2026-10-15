//! What the hands learn by doing (docs/world-economy.md §10). Practice grows from the things themselves —
//! a catch, a dish, a harvest, a mended thing, music played, a picture painted — never from counters to fill.
//! Levels are said in words; their effects are modest. Music is played at an instrument at home; a picture is
//! painted at an easel and becomes a canvas to hang.

use serde::{Deserialize, Serialize};

use crate::core::{Core, CoreError};
use crate::event::EventKind;
use crate::storage::Storage;
use crate::time::WorldTime;

/// The skills, in the order they are shown, with their names.
pub const SKILLS: [(&str, &str); 6] = [("fishing", "Рибальство"), ("cooking", "Кухня"), ("gardening", "Город і сад"), ("crafting", "Майстрування"), ("music", "Музика"), ("painting", "Малювання")];

/// Practice needed for each level after the first.
const LEVELS: [u32; 3] = [10, 40, 120];
const WORDS: [&str; 4] = ["новачок", "вже вміє", "знається", "майстер"];
const WORDS_EN: [&str; 4] = ["beginner", "getting the hang of it", "knows the craft", "master"];
/// The skills' names in English, in the same order as `SKILLS`.
const SKILLS_EN: [&str; 6] = ["Fishing", "Cooking", "Garden and orchard", "Crafting", "Music", "Painting"];

/// A painting is 16×12 pixels, each one of 16 colours (a hex digit).
pub const ART_W: usize = 16;
pub const ART_H: usize = 12;
/// World minutes between two times at the instrument that count as practice.
const PLAY_GAP: u64 = 5;

pub fn level_of(practice: u32) -> u32 {
    LEVELS.iter().filter(|need| practice >= **need).count() as u32
}

pub fn level_word(level: u32) -> &'static str {
    WORDS[(level as usize).min(WORDS.len() - 1)]
}

/// The word for a level in the given language.
pub fn level_word_in(level: u32, lang: crate::content::Lang) -> &'static str {
    let i = (level as usize).min(WORDS.len() - 1);
    lang.pick(WORDS[i], WORDS_EN[i])
}

/// The weight of a fish in the catch for a skilled hand: rare ones (weight 1–2) come a little more often.
pub fn fish_weight(weight: u32, level: u32) -> u32 {
    if weight <= 2 {
        weight + level.min(3)
    } else {
        weight
    }
}

/// More from a harvest for one who knows a garden.
pub fn harvest_bonus(level: u32) -> u32 {
    match level {
        0 | 1 => 0,
        2 => 1,
        _ => 2,
    }
}

/// Mending costs a little less for skilled hands (in percent off).
pub fn mend_discount(level: u32) -> u32 {
    level.min(3) * 10
}

/// Now and then a dish turns out double for a good cook: in permille.
pub fn double_dish_chance(level: u32) -> u64 {
    [0, 80, 180, 300][(level as usize).min(3)]
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct SkillView {
    pub id: String,
    pub name: String,
    pub practice: u32,
    pub level: u32,
    pub word: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Painting {
    pub index: u32,
    pub title: String,
    pub day: u64,
    /// 192 hex digits, row by row.
    pub pixels: String,
}

/// How much practice an event brings, and to what.
pub(crate) fn practice_of(kind: &EventKind) -> Option<(&'static str, u32)> {
    match kind {
        EventKind::Caught { .. } => Some(("fishing", 1)),
        EventKind::Cooked { .. } => Some(("cooking", 1)),
        EventKind::Planted { .. } => Some(("gardening", 1)),
        EventKind::Harvested { .. } => Some(("gardening", 3)),
        EventKind::Restored { .. } => Some(("crafting", 2)),
        EventKind::Crafted { .. } => Some(("crafting", 2)),
        EventKind::Repaired { by, .. } if by == "hands" => Some(("crafting", 1)),
        EventKind::Played { .. } => Some(("music", 1)),
        EventKind::Busked { .. } => Some(("music", 2)),
        EventKind::Painted { .. } => Some(("painting", 3)),
        _ => None,
    }
}

fn valid_pixels(p: &str) -> bool {
    p.len() == ART_W * ART_H && p.bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
}

impl<S: Storage> Core<S> {
    pub fn practice(&self, skill: &str) -> u32 {
        self.state().practice.get(skill).copied().unwrap_or(0)
    }

    pub fn skills_view(&self) -> Vec<SkillView> {
        let lang = self.lang();
        SKILLS
            .iter()
            .zip(SKILLS_EN)
            .map(|((id, name), en)| {
                let practice = self.practice(id);
                let level = level_of(practice);
                SkillView { id: id.to_string(), name: lang.pick(name, en).to_string(), practice, level, word: level_word_in(level, lang).to_string() }
            })
            .collect()
    }

    pub fn paintings_view(&self) -> Vec<Painting> {
        self.state().paintings.clone()
    }

    fn placed_with(&self, pid: u32, tag: &str) -> Result<(), CoreError> {
        let p = self.state().room.placements.get(&pid).ok_or(CoreError::UnknownPlacement(pid))?;
        let ok = self.content().items.get(&p.item).is_some_and(|d| d.tags.iter().any(|t| t == tag));
        if ok {
            Ok(())
        } else {
            Err(CoreError::ActionNotAvailable)
        }
    }

    pub(crate) fn plan_play(&self, now: WorldTime, pid: u32, piece: Option<String>) -> Result<Vec<EventKind>, CoreError> {
        self.placed_with(pid, "instrument")?;
        if let Some(p) = &piece {
            self.check_piece(p)?;
        }
        if self.location() != "home" {
            return Err(CoreError::NotHere);
        }
        self.check_working(pid, now)?;
        if self.state().last_played.is_some_and(|m| now.0 < m + PLAY_GAP) {
            return Err(CoreError::TooSoon);
        }
        Ok(vec![EventKind::Played { pid, day: now.day(), piece }])
    }

    pub(crate) fn plan_paint(&self, now: WorldTime, pid: u32, title: &str, pixels: &str) -> Result<Vec<EventKind>, CoreError> {
        self.placed_with(pid, "easel").or_else(|_| self.placed_with(pid, "printer"))?;
        if self.location() != "home" {
            return Err(CoreError::NotHere);
        }
        let title = title.trim();
        if title.is_empty() || title.chars().count() > 40 || !valid_pixels(pixels) {
            return Err(CoreError::InvalidProp);
        }
        let canvas = self.content().items.values().find(|d| d.tags.iter().any(|t| t == "canvas")).map(|d| d.id.clone()).ok_or(CoreError::Needs("canvas".into()))?;
        let index = self.state().paintings.len() as u32;
        Ok(vec![EventKind::Painted { index, title: title.to_string(), day: now.day(), pixels: pixels.to_string(), canvas }])
    }

    /// Whether `value` names a painting (for the `art` prop of a canvas).
    pub(crate) fn painting_exists(&self, value: &str) -> bool {
        value.parse::<u32>().is_ok_and(|i| (i as usize) < self.state().paintings.len())
    }
}
