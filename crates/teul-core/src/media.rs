//! Music the player plays: the pieces of the town's repertoire (scores live in the shell), how one comes to know
//! them, and playing in the street for whoever stops to listen. A piece is known from the start, from its sheet
//! music (bought, given, found) or once it has been played; the hands get better with practice (`skills.rs`).
//! Playing at home pays nothing, ever; in town a few passers-by may drop a coin into the open case.

use serde::{Deserialize, Serialize};

use crate::core::{Core, CoreError};
use crate::event::EventKind;
use crate::rng::{rand_below, Domain};
use crate::storage::Storage;
use crate::time::WorldTime;

pub const BUSK: Domain = Domain(81);

/// World minutes between two times playing in the street.
pub const BUSK_GAP: u64 = 20;
/// What the street gives a day at most (it is never said: the town simply has only so many coins to spare).
pub const BUSK_DAY_COINS: u32 = 14;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PieceDef {
    pub id: String,
    pub name: String,
    /// The composer, or "народна".
    #[serde(default)]
    pub by: String,
    /// The sheet music that teaches it (an item); none: everyone knows it.
    #[serde(default)]
    pub sheet: Option<String>,
    /// How hard it is (0..3): above the hands' level it comes out slower and with slips.
    #[serde(default)]
    pub level: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct PieceView {
    pub id: String,
    pub name: String,
    pub by: String,
    pub level: u32,
    /// Played at least once (the hands remember it, the sheet is no longer needed).
    pub learned: bool,
    /// Can be played now (known by heart, or the sheet is at hand).
    pub known: bool,
    pub sheet: Option<String>,
}

impl<S: Storage> Core<S> {
    fn knows_piece(&self, def: &PieceDef) -> bool {
        self.state().repertoire.contains(&def.id) || def.sheet.as_ref().map_or(true, |s| self.state().owned.get(s).copied().unwrap_or(0) > 0)
    }

    pub fn repertoire_view(&self) -> Vec<PieceView> {
        self.content()
            .pieces
            .values()
            .map(|d| PieceView {
                id: d.id.clone(),
                name: d.name.clone(),
                by: d.by.clone(),
                level: d.level,
                learned: self.state().repertoire.contains(&d.id),
                known: self.knows_piece(d),
                sheet: d.sheet.clone(),
            })
            .collect()
    }

    pub(crate) fn check_piece(&self, piece: &str) -> Result<(), CoreError> {
        let def = self.content().pieces.get(piece).ok_or(CoreError::NoRequest)?;
        if self.knows_piece(def) {
            Ok(())
        } else {
            Err(CoreError::Needs(def.sheet.clone().unwrap_or_default()))
        }
    }

    /// How many stop to listen in the street at this moment (before the day's coins run out).
    pub fn listeners_at(&self, now: WorldTime) -> u32 {
        let hour = (now.minute_of_day() / 60) as u32;
        let base: u64 = match hour {
            8..=10 => 2,
            11..=16 => 3,
            17..=20 => 5,
            21 => 2,
            _ => 0,
        };
        if base == 0 {
            return 0;
        }
        let info = crate::holidays::day_info(self.calendar().date(now));
        let festive = info.holiday.is_some_and(|h| h.festive) || info.weekend;
        let sky = self.weather(now);
        let wet = matches!(sky, crate::daily::Sky::Rain | crate::daily::Sky::Storm | crate::daily::Sky::Snow);
        let level = u64::from(crate::skills::level_of(self.practice("music")));
        let span = base + level + u64::from(festive) * 2;
        let n = rand_below(self.meta().seed, BUSK, now.day(), now.0 / BUSK_GAP, span + 1);
        if wet {
            (n / 2) as u32
        } else {
            n as u32
        }
    }

    pub(crate) fn plan_busk(&self, now: WorldTime, piece: &str, instrument: &str) -> Result<Vec<EventKind>, CoreError> {
        if self.location() == "home" {
            return Err(CoreError::NotHere);
        }
        let def = self.content().items.get(instrument).ok_or_else(|| CoreError::UnknownItem(instrument.to_string()))?;
        if !(def.tags.iter().any(|t| t == "instrument") && def.tags.iter().any(|t| t == "portable")) {
            return Err(CoreError::ActionNotAvailable);
        }
        if self.state().owned.get(instrument).copied().unwrap_or(0) == 0 {
            return Err(CoreError::NotOwned(instrument.to_string()));
        }
        self.check_piece(piece)?;
        let hour = now.minute_of_day() / 60;
        if !(8..22).contains(&hour) {
            return Err(CoreError::Closed);
        }
        if self.state().last_busk.is_some_and(|m| now.0 < m + BUSK_GAP) {
            return Err(CoreError::TooSoon);
        }
        let day = now.day();
        let given = if self.state().busked.0 == day { self.state().busked.1 } else { 0 };
        let listeners = self.listeners_at(now);
        let level = crate::skills::level_of(self.practice("music"));
        let coins = (listeners * (1 + level) / 2).min(BUSK_DAY_COINS.saturating_sub(given));
        let mut out = vec![EventKind::Busked { piece: piece.to_string(), instrument: instrument.to_string(), day, listeners, coins }];
        if coins > 0 {
            out.push(EventKind::CoinsEarned { amount: coins });
        }
        Ok(out)
    }
}
