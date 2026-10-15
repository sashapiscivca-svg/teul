//! The animals one lives with (docs/world-economy.md §17). The cat, the dog or the rabbit are there from the first
//! day (the player's choice of look). Others come the way animals come: a turtle from the vet's shelter, a robot
//! from the «Техніка» counter once the town has laptops, a fox from the forest after it has learned to trust one
//! (food left for it on three different days), a little dragon from an egg brought back from a rift, kept warm at
//! home for a week. They are fed, played with, stroked; the robot is charged and, now and then, mended. Nothing of
//! it is counted on the screen: how they are shows in how they behave.

use std::collections::{BTreeMap, BTreeSet};

use serde::{Deserialize, Serialize};

use crate::core::{Core, CoreError};
use crate::event::EventKind;
use crate::storage::Storage;
use crate::time::WorldTime;

/// Days an egg is kept warm before it hatches.
pub const HATCH_DAYS: u64 = 7;
/// Days of food left in the forest before the fox comes along.
pub const FOX_TRUST: usize = 3;
/// Days a robot runs well after a mending.
pub const ROBOT_SERVICE: u64 = 30;
pub const EGG: &str = "dragon_egg";

/// An animal one can live with (content).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PetDef {
    pub id: String,
    pub name: String,
    /// The shell's look (0 cat, 1 dog, 2 rabbit; 4 turtle, 5 fox, 6 robot, 7 dragon).
    pub kind: u32,
    /// shelter (bought where it lives), fox (befriended in the forest), tech (the counter), egg (hatched at home).
    pub source: String,
    #[serde(default)]
    pub location: Option<String>,
    #[serde(default)]
    pub price: u32,
    /// Not before this world day.
    #[serde(default)]
    pub from_day: u64,
    /// What it eats (item ids or `#tag`); empty: it does not eat (it charges).
    #[serde(default)]
    pub food: Vec<String>,
    #[serde(default)]
    pub text: String,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct OwnedPet {
    pub since: u64,
    /// The day it last ate (or was charged), was played with, was stroked, was mended.
    pub fed: u64,
    pub played: u64,
    pub stroked: u64,
    pub fixed: u64,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct PetsState {
    pub owned: BTreeMap<String, OwnedPet>,
    /// The days food was left for the fox.
    pub fox_days: BTreeSet<u64>,
    /// The day the egg was laid in a warm nest at home.
    pub egg: Option<u64>,
    /// Who goes out with the player (None: the first day's cat, dog or rabbit).
    pub companion: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct PetView {
    pub id: String,
    pub name: String,
    pub kind: u32,
    pub since: u64,
    /// Not fed (or charged) today nor yesterday.
    pub hungry: bool,
    /// Nobody played with it or stroked it for three days.
    pub lonely: bool,
    /// Fed and played with today: it shows.
    pub happy: bool,
    /// A robot past its service: it glitches.
    pub worn: bool,
    /// How it is, in a few words (said, never counted).
    pub words: String,
    pub eats: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct PetOffer {
    pub id: String,
    pub name: String,
    pub kind: u32,
    pub price: u32,
    pub text: String,
    /// What taking it is like here and now: "adopt", "feed_fox", "nest_egg", "hatch", or why not ("owned", "later", "wait").
    pub step: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct PetsView {
    pub owned: Vec<PetView>,
    pub companion: Option<String>,
    /// The day the egg was laid and the day it hatches.
    pub egg: Option<(u64, u64)>,
    /// How the fox is with the player, in words (empty: they have not met).
    pub fox: String,
    /// What can be done about animals where the player is.
    pub here: Vec<PetOffer>,
}

impl<S: Storage> Core<S> {
    fn pet_def(&self, id: &str) -> Result<&PetDef, CoreError> {
        self.content().pets.get(id).ok_or(CoreError::NothingThere)
    }

    /// Something from the pocket it would eat (the first that answers).
    fn pet_food(&self, def: &PetDef) -> Option<String> {
        let content = self.content();
        let st = self.state();
        st.owned
            .keys()
            .filter(|id| self.in_pocket(id) > 0)
            .find(|id| def.food.iter().any(|k| crate::daily::answers(content, id, k)))
            .cloned()
    }

    fn has_egg(&self) -> bool {
        self.in_pocket(EGG) > 0 || self.in_chest(EGG) > 0
    }

    /// The next step of taking this animal home, here and now (Err: why not).
    fn adopt_step(&self, now: WorldTime, def: &PetDef) -> Result<&'static str, CoreError> {
        let st = &self.state().pets;
        if st.owned.contains_key(&def.id) {
            return Err(CoreError::AlreadyOwned);
        }
        let day = now.day();
        match def.source.as_str() {
            "egg" => {
                if self.location() != "home" {
                    return Err(CoreError::NotHere);
                }
                match st.egg {
                    Some(d) if day >= d + HATCH_DAYS => Ok("hatch"),
                    Some(_) => Err(CoreError::TooSoon),
                    None if self.has_egg() => Ok("nest_egg"),
                    None => Err(CoreError::NothingThere),
                }
            }
            _ => {
                if def.location.as_deref().is_some_and(|l| l != self.location()) {
                    return Err(CoreError::NotHere);
                }
                if day < def.from_day {
                    return Err(CoreError::Closed);
                }
                // the fox trusts by the days before today: on the third day of food it eats and goes; it follows the next time
                if def.source == "fox" && st.fox_days.iter().filter(|d| **d < day).count() < FOX_TRUST {
                    if st.fox_days.contains(&day) {
                        return Err(CoreError::TooSoon);
                    }
                    return Ok("feed_fox");
                }
                Ok("adopt")
            }
        }
    }

    pub(crate) fn plan_adopt(&self, now: WorldTime, pet: &str) -> Result<Vec<EventKind>, CoreError> {
        let def = self.pet_def(pet)?;
        let day = now.day();
        match self.adopt_step(now, def)? {
            "feed_fox" => {
                let item = self.pet_food(def).ok_or(CoreError::Needs("pet_food".into()))?;
                Ok(vec![EventKind::FoxFed { day, item }])
            }
            "nest_egg" => {
                let from_pocket = self.in_pocket(EGG) > 0;
                Ok(vec![EventKind::EggNested { day, from_pocket }])
            }
            _ => {
                let have = self.wallet().coins;
                if have < u64::from(def.price) {
                    return Err(CoreError::Locked(vec![crate::unlock::Missing::Coins { have, need: u64::from(def.price) }]));
                }
                Ok(vec![EventKind::PetAdopted { pet: pet.to_string(), day, coins: def.price }])
            }
        }
    }

    pub(crate) fn plan_pet_care(&self, now: WorldTime, pet: &str, what: &str) -> Result<Vec<EventKind>, CoreError> {
        let def = self.pet_def(pet)?;
        if !self.state().pets.owned.contains_key(pet) {
            return Err(CoreError::NothingThere);
        }
        let day = now.day();
        match what {
            "feed" => {
                if def.food.is_empty() {
                    return Err(CoreError::ActionNotAvailable);
                }
                let item = self.pet_food(def).ok_or(CoreError::Needs("pet_food".into()))?;
                Ok(vec![EventKind::PetFed { pet: pet.to_string(), day, item: Some(item) }])
            }
            "charge" => {
                if !def.food.is_empty() {
                    return Err(CoreError::ActionNotAvailable);
                }
                if self.location() != "home" {
                    return Err(CoreError::NotHere);
                }
                if !self.utility_on(now, "power") {
                    return Err(CoreError::UtilityOff("power".into()));
                }
                Ok(vec![EventKind::PetFed { pet: pet.to_string(), day, item: None }])
            }
            "fix" => {
                if !def.food.is_empty() {
                    return Err(CoreError::ActionNotAvailable);
                }
                if !self.has_tool("screwdrivers") {
                    return Err(CoreError::Needs("screwdrivers".into()));
                }
                let mut out = vec![EventKind::PetCared { pet: pet.to_string(), what: "fix".into(), day }];
                out.extend(self.tool_used("screwdrivers"));
                Ok(out)
            }
            "play" | "stroke" => Ok(vec![EventKind::PetCared { pet: pet.to_string(), what: what.to_string(), day }]),
            _ => Err(CoreError::ActionNotAvailable),
        }
    }

    pub(crate) fn plan_companion(&self, pet: Option<String>) -> Result<Vec<EventKind>, CoreError> {
        if let Some(p) = &pet {
            if !self.state().pets.owned.contains_key(p) {
                return Err(CoreError::NothingThere);
            }
        }
        Ok(vec![EventKind::CompanionSet { pet }])
    }

    pub fn pets_view(&self, now: WorldTime) -> PetsView {
        let content = self.content();
        let st = &self.state().pets;
        let day = now.day();
        let owned = st
            .owned
            .iter()
            .filter_map(|(id, o)| {
                let def = content.pets.get(id)?;
                let eats = !def.food.is_empty();
                let hungry = o.fed + 1 < day;
                let lonely = o.played.max(o.stroked) + 3 < day;
                let happy = o.fed == day && (o.played == day || o.stroked == day);
                let worn = !eats && o.fixed.max(o.since) + ROBOT_SERVICE < day;
                let l = content.lang;
                let words = if worn {
                    l.pick("поскрипує й часом зависає", "creaks and sometimes freezes")
                } else if hungry {
                    if eats { l.pick("голодний, ходить за тобою слідом", "hungry, following you around") } else { l.pick("ледь пищить: сідає батарея", "barely beeping: the battery is running low") }
                } else if lonely {
                    l.pick("скучає, сидить біля дверей", "missing you, sitting by the door")
                } else if happy {
                    l.pick("щасливий", "happy")
                } else {
                    l.pick("спокійний", "calm")
                };
                Some(PetView { id: id.clone(), name: def.name.clone(), kind: def.kind, since: o.since, hungry, lonely, happy, worn, words: words.to_string(), eats })
            })
            .collect();
        let fox = match st.fox_days.len() {
            0 => "",
            1 => content.lang.pick("лисиця підходить, коли тебе немає поруч", "the fox comes closer when you're not around"),
            2 => content.lang.pick("лисиця вже не тікає", "the fox no longer runs away"),
            _ => content.lang.pick("лисиця чекає на тебе біля нори", "the fox waits for you by its den"),
        };
        let here = content
            .pets
            .values()
            .filter(|d| match d.source.as_str() {
                "egg" => self.location() == "home" && (st.egg.is_some() || self.has_egg()),
                _ => d.location.as_deref() == Some(self.location()),
            })
            .map(|d| {
                let step = match self.adopt_step(now, d) {
                    Ok(s) => s.to_string(),
                    Err(CoreError::AlreadyOwned) => "owned".into(),
                    Err(CoreError::TooSoon) => "wait".into(),
                    Err(_) => "later".into(),
                };
                PetOffer { id: d.id.clone(), name: d.name.clone(), kind: d.kind, price: d.price, text: d.text.clone(), step }
            })
            .collect();
        PetsView { owned, companion: st.companion.clone(), egg: st.egg.map(|d| (d, d + HATCH_DAYS)), fox: fox.to_string(), here }
    }
}

/// How an event changes the animals (and what it takes from the pocket).
pub fn apply(pets: &mut PetsState, owned: &mut BTreeMap<String, u32>, kind: &EventKind) {
    let take = |owned: &mut BTreeMap<String, u32>, item: &str| {
        if let Some(n) = owned.get_mut(item) {
            *n = n.saturating_sub(1);
        }
    };
    match kind {
        EventKind::PetAdopted { pet, day, .. } => {
            pets.owned.insert(pet.clone(), OwnedPet { since: *day, fed: *day, played: *day, stroked: *day, fixed: *day });
            if pet == "dragon" {
                pets.egg = None;
            }
        }
        EventKind::FoxFed { day, item } => {
            pets.fox_days.insert(*day);
            take(owned, item);
        }
        EventKind::EggNested { day, .. } => {
            pets.egg = Some(*day);
            take(owned, EGG);
        }
        EventKind::PetFed { pet, day, item } => {
            if let Some(p) = pets.owned.get_mut(pet) {
                p.fed = *day;
            }
            if let Some(i) = item {
                take(owned, i);
            }
        }
        EventKind::PetCared { pet, what, day } => {
            if let Some(p) = pets.owned.get_mut(pet) {
                match what.as_str() {
                    "play" => p.played = *day,
                    "stroke" => p.stroked = *day,
                    "fix" => p.fixed = *day,
                    _ => {}
                }
            }
        }
        EventKind::CompanionSet { pet } => pets.companion = pet.clone(),
        _ => {}
    }
}
