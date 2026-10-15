//! How one looks and where one lives (docs/world-economy.md §11).
//!
//! The hero is made once (`MakeHero`); after that the look is no longer set freely: clothes are garments the
//! player owns, bought at the clothes shop and changed at home by the wardrobe or in the shop's fitting room
//! (`Dress`); hair, its colour and the beard are cut at the salon for coins (`Haircut`); the body (skin, eyes,
//! face, cheeks) stays as it was made. The pet's look stays the player's choice.
//!
//! Homes are rented (the first month at once, then monthly with the bills) or bought; one lives at one address
//! at a time (`MoveHome`: everything at home comes along), and an unpaid rent past the due date ends the lease.
//! A plot is rented the same way and opens the stations that ask for it (`Requires.leased`).

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::core::{Core, CoreError, TaxiDest};
use crate::event::EventKind;
use crate::storage::Storage;
use crate::time::WorldTime;
use crate::unlock::Missing;

/// The look keys of each piece of clothing (a garment sets these; changing into another replaces them all).
pub const SLOTS: [(&str, &[&str]); 5] = [
    ("top", &["look.top", "look.top_color", "look.top2_color"]),
    ("bottom", &["look.bottom", "look.bottom_color"]),
    ("shoes", &["look.shoe", "look.shoes_color"]),
    ("acc", &["look.acc", "look.acc_color"]),
    // mittens and gloves (worn over whatever else)
    ("hands", &["look.mitt", "look.mitt_color"]),
];
/// Cut at the salon.
pub const HAIR_KEYS: [&str; 3] = ["look.hair", "look.hair_color", "look.beard"];
/// As one was born (made once with the hero).
pub const BODY_KEYS: [&str; 5] = ["look.skin_color", "look.eye_color", "look.face", "look.cheeks", "look.build"];

/// The slot a clothes key belongs to.
pub fn slot_of(key: &str) -> Option<&'static str> {
    SLOTS.iter().find(|(_, keys)| keys.contains(&key)).map(|(s, _)| *s)
}

pub fn slot_keys(slot: &str) -> Option<&'static [&'static str]> {
    SLOTS.iter().find(|(s, _)| *s == slot).map(|(_, k)| *k)
}

fn clothes_key(key: &str) -> bool {
    SLOTS.iter().any(|(_, keys)| keys.contains(&key))
}

/// A key of the hero that is no longer set freely once the hero is made.
pub fn fixed_key(key: &str) -> bool {
    clothes_key(key) || HAIR_KEYS.contains(&key) || BODY_KEYS.contains(&key)
}

// ---- content ---------------------------------------------------------------------------------------------

/// What wearing a garment does to the look.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct WearDef {
    /// top, bottom, shoes or acc.
    pub slot: String,
    /// The look keys of the slot and their values.
    pub set: Vec<(String, String)>,
}

/// The clothes shop and the salon.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FashionDef {
    /// Where garments are sold (and tried on).
    pub shop: String,
    pub shop_hours: (u32, u32),
    /// Other places where one may change (fitting rooms), besides home.
    #[serde(default)]
    pub fitting: Vec<String>,
    pub salon: String,
    pub salon_hours: (u32, u32),
    /// A new hairstyle, a new colour, a beard changed.
    pub price_style: u32,
    pub price_color: u32,
    pub price_beard: u32,
}

/// A home in the world: the player's first house, flats and houses to rent or buy, plots to rent.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HomeDef {
    pub id: String,
    pub name: String,
    pub location: String,
    /// The building (its item id) whose door this is.
    #[serde(default)]
    pub prop: String,
    /// The door: where one steps out (and where the taxi brings one home).
    pub x: i32,
    pub y: i32,
    /// house, flat, cottage or plot.
    pub kind: String,
    /// Coins a month (0: not to rent).
    #[serde(default)]
    pub rent: u32,
    /// Coins to buy (0: not for sale).
    #[serde(default)]
    pub price: u32,
    /// The player's own from the start.
    #[serde(default)]
    pub start: bool,
    #[serde(default)]
    pub text: String,
}

// ---- views -----------------------------------------------------------------------------------------------

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct GarmentView {
    pub item: String,
    pub slot: String,
    pub set: Vec<(String, String)>,
    pub worn: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct WardrobeView {
    /// Garments the player owns.
    pub owned: Vec<GarmentView>,
    /// The clothes of the first day, per slot (to change back into).
    pub first: BTreeMap<String, Vec<(String, String)>>,
    /// Whether one can change here and now.
    pub can_change: bool,
    /// not_here, no_wardrobe
    pub reason: Option<String>,
    /// For sale where the player is (at the shop, while it is open): (item, price).
    pub for_sale: Vec<(String, u32)>,
    pub shop_open: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct SalonView {
    pub location: String,
    pub hours: (u32, u32),
    pub open: bool,
    pub here: bool,
    pub price_style: u32,
    pub price_color: u32,
    pub price_beard: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct HomeView {
    pub id: String,
    pub name: String,
    pub location: String,
    pub prop: String,
    pub x: i32,
    pub y: i32,
    pub kind: String,
    pub rent: u32,
    pub price: u32,
    pub text: String,
    /// The player's own (the first house or bought).
    pub owned: bool,
    /// Rented now (and not lost for an unpaid rent).
    pub leased: bool,
    /// Where the player lives now.
    pub current: bool,
}

impl<S: Storage> Core<S> {
    pub(crate) fn fashion(&self) -> Option<&FashionDef> {
        self.content().fashion.as_ref()
    }

    /// The hero is made: clothes, hair and body are no longer set freely (a save from before has them set).
    pub fn look_fixed(&self) -> bool {
        self.state().room.settings.keys().any(|k| fixed_key(k))
    }

    pub(crate) fn plan_make_hero(&self, set: Vec<(String, String)>) -> Result<Vec<EventKind>, CoreError> {
        if self.look_fixed() {
            return Err(CoreError::AlreadyDone);
        }
        if set.is_empty() || set.len() > 32 || set.iter().any(|(k, v)| !fixed_key(k) || v.is_empty() || !crate::core::valid_setting(k, v)) {
            return Err(CoreError::InvalidSetting);
        }
        Ok(vec![EventKind::HeroMade { set }])
    }

    fn open_at(hours: (u32, u32), now: WorldTime) -> bool {
        let hour = (now.minute_of_day() / 60) as u32;
        hour >= hours.0 && hour < hours.1
    }

    /// Buying a garment: only at the shop, in its hours (the price is the item's own).
    pub(crate) fn garment_check(&self, now: WorldTime) -> Result<(), CoreError> {
        let f = self.fashion().ok_or(CoreError::NothingThere)?;
        if self.location() != f.shop {
            return Err(CoreError::NotHere);
        }
        if !Self::open_at(f.shop_hours, now) {
            return Err(CoreError::Closed);
        }
        Ok(())
    }

    /// Where one may change: at home by a wardrobe, or in a fitting room.
    fn change_check(&self) -> Result<(), CoreError> {
        let loc = self.location();
        if loc == "home" {
            if !self.has_placed("wardrobe") {
                return Err(CoreError::Needs("wardrobe".into()));
            }
            return Ok(());
        }
        let fits = self.fashion().is_some_and(|f| f.fitting.iter().any(|x| x == loc) || f.shop == loc);
        if fits {
            Ok(())
        } else {
            Err(CoreError::NotHere)
        }
    }

    pub(crate) fn plan_dress(&self, slot: &str, item: Option<&str>) -> Result<Vec<EventKind>, CoreError> {
        let keys = slot_keys(slot).ok_or(CoreError::InvalidSlot)?;
        let set: Vec<(String, String)> = match item {
            Some(id) => {
                let def = self.content().items.get(id).ok_or_else(|| CoreError::UnknownItem(id.to_string()))?;
                let wear = def.wear.as_ref().ok_or(CoreError::InvalidSlot)?;
                if self.state().owned.get(id).copied().unwrap_or(0) == 0 {
                    return Err(CoreError::NotOwned(id.to_string()));
                }
                if wear.slot != slot {
                    return Err(CoreError::InvalidSlot);
                }
                keys.iter().map(|k| (k.to_string(), wear.set.iter().find(|(x, _)| x == k).map(|(_, v)| v.clone()).unwrap_or_default())).collect()
            }
            None => {
                let st = self.state();
                let first = |k: &str| if st.outfit_kept { st.first_outfit.get(k).cloned() } else { st.room.settings.get(k).cloned() };
                keys.iter().map(|k| (k.to_string(), first(k).unwrap_or_default())).collect()
            }
        };
        self.change_check()?;
        Ok(vec![EventKind::Dressed { slot: slot.to_string(), item: item.map(String::from), set }])
    }

    pub(crate) fn plan_haircut(&self, now: WorldTime, set: Vec<(String, String)>) -> Result<Vec<EventKind>, CoreError> {
        let f = self.fashion().ok_or(CoreError::NothingThere)?;
        if self.location() != f.salon {
            return Err(CoreError::NotHere);
        }
        if !Self::open_at(f.salon_hours, now) {
            return Err(CoreError::Closed);
        }
        if set.is_empty() || set.iter().any(|(k, v)| !HAIR_KEYS.contains(&k.as_str()) || v.is_empty() || !crate::core::valid_setting(k, v)) {
            return Err(CoreError::InvalidSetting);
        }
        let settings = &self.state().room.settings;
        let changed: Vec<(String, String)> = set.into_iter().filter(|(k, v)| settings.get(k) != Some(v)).collect();
        if changed.is_empty() {
            return Err(CoreError::NothingThere);
        }
        let price = |key: &str, p: u32| if changed.iter().any(|(k, _)| k == key) { p } else { 0 };
        let coins = price("look.hair", f.price_style) + price("look.hair_color", f.price_color) + price("look.beard", f.price_beard);
        let have = self.wallet().coins;
        if have < u64::from(coins) {
            return Err(CoreError::Locked(vec![Missing::Coins { have, need: u64::from(coins) }]));
        }
        Ok(vec![EventKind::HairCut { set: changed, coins }])
    }

    pub fn wardrobe_view(&self, now: WorldTime) -> WardrobeView {
        let content = self.content();
        let st = self.state();
        let settings = &st.room.settings;
        let owned = content
            .items
            .values()
            .filter(|d| d.wear.is_some() && st.owned.get(&d.id).copied().unwrap_or(0) > 0)
            .map(|d| {
                let w = d.wear.as_ref().expect("filtered");
                GarmentView { item: d.id.clone(), slot: w.slot.clone(), set: w.set.clone(), worn: w.set.iter().all(|(k, v)| settings.get(k) == Some(v)) }
            })
            .collect();
        let first = SLOTS
            .iter()
            .map(|(slot, keys)| {
                let pick = |k: &str| if st.outfit_kept { st.first_outfit.get(k).cloned() } else { settings.get(k).cloned() };
                (slot.to_string(), keys.iter().filter_map(|k| pick(k).map(|v| (k.to_string(), v))).collect())
            })
            .collect();
        let check = self.change_check();
        let shop_open = self.garment_check(now).is_ok();
        let for_sale = if shop_open {
            content.items.values().filter(|d| d.wear.is_some() && st.owned.get(&d.id).copied().unwrap_or(0) == 0).map(|d| (d.id.clone(), coins_of(&d.acquire))).collect()
        } else {
            Vec::new()
        };
        WardrobeView {
            owned,
            first,
            can_change: check.is_ok(),
            reason: check.err().map(|e| if matches!(e, CoreError::Needs(_)) { "no_wardrobe".to_string() } else { "not_here".to_string() }),
            for_sale,
            shop_open,
        }
    }

    pub fn salon_view(&self, now: WorldTime) -> Option<SalonView> {
        let f = self.fashion()?;
        Some(SalonView {
            location: f.salon.clone(),
            hours: f.salon_hours,
            open: Self::open_at(f.salon_hours, now),
            here: self.location() == f.salon,
            price_style: f.price_style,
            price_color: f.price_color,
            price_beard: f.price_beard,
        })
    }

    // ---- homes ---------------------------------------------------------------------------------------------

    fn start_home(&self) -> Option<&HomeDef> {
        self.content().homes.values().find(|h| h.start)
    }

    pub(crate) fn home_is_owned(&self, id: &str) -> bool {
        self.home_owned(id)
    }

    fn home_owned(&self, id: &str) -> bool {
        self.state().homes_bought.contains(id) || self.content().homes.get(id).is_some_and(|h| h.start)
    }

    /// The rent bills of every lease issued by `now` (utility `rent:<home>`), and for each lease whether it still
    /// holds: a rent unpaid past its due date ends it (its bill stays to be paid), as does ending it.
    pub(crate) fn rent_bills(&self, now: WorldTime) -> (Vec<(String, String, i64, u32, bool)>, BTreeMap<String, bool>) {
        let content = self.content();
        let due_day = content.bills.as_ref().map(|b| b.due_day).unwrap_or(10);
        let cal = self.calendar();
        let current = cal.month_index(now);
        let (_, _, dom) = cal.ymd(now);
        let mut bills = Vec::new();
        let mut active = BTreeMap::new();
        for (home, (from, ended)) in &self.state().leases {
            let Some(def) = content.homes.get(home) else { continue };
            let mut holds = ended.is_none();
            let last = ended.map_or(current - 1, |e| e.min(current - 1));
            for month in (from + 1)..=last {
                let overdue = current > month + 1 || dom > due_day;
                let id = format!("rent:{home}");
                let paid = self.state().bills_paid.contains(&crate::home::bill_key(&id, month));
                bills.push((id, format!("{}: {}", content.lang.pick("Оренда", "Rent"), def.name), month, def.rent, overdue));
                if overdue && !paid {
                    holds = false;
                    break;
                }
            }
            active.insert(home.clone(), holds);
        }
        (bills, active)
    }

    pub fn lease_active(&self, now: WorldTime, home: &str) -> bool {
        self.rent_bills(now).1.get(home).copied().unwrap_or(false)
    }

    /// Where the player lives now (a home id): the chosen address while it is theirs, else the first house.
    pub fn address(&self, now: WorldTime) -> String {
        let start = self.start_home().map(|h| h.id.clone()).unwrap_or_default();
        match self.state().address.as_deref() {
            Some(a) if self.home_owned(a) || self.lease_active(now, a) => a.to_string(),
            _ => start,
        }
    }

    fn at_home_place(&self, def: &HomeDef) -> Result<(), CoreError> {
        if self.location() == def.location {
            Ok(())
        } else {
            Err(CoreError::NotHere)
        }
    }

    fn pay_check(&self, coins: u32) -> Result<(), CoreError> {
        let have = self.wallet().coins;
        if have < u64::from(coins) {
            return Err(CoreError::Locked(vec![Missing::Coins { have, need: u64::from(coins) }]));
        }
        Ok(())
    }

    fn home_def(&self, id: &str) -> Result<&HomeDef, CoreError> {
        self.content().homes.get(id).ok_or(CoreError::NothingThere)
    }

    pub(crate) fn plan_rent(&self, now: WorldTime, home: &str) -> Result<Vec<EventKind>, CoreError> {
        let def = self.home_def(home)?;
        if def.rent == 0 {
            return Err(CoreError::NothingThere);
        }
        self.at_home_place(def)?;
        if self.home_owned(home) || self.lease_active(now, home) {
            return Err(CoreError::AlreadyOwned);
        }
        self.pay_check(def.rent)?;
        Ok(vec![EventKind::Rented { home: home.to_string(), month: self.calendar().month_index(now), amount: def.rent }])
    }

    pub(crate) fn plan_buy(&self, home: &str) -> Result<Vec<EventKind>, CoreError> {
        let def = self.home_def(home)?;
        if def.price == 0 {
            return Err(CoreError::NothingThere);
        }
        self.at_home_place(def)?;
        if self.home_owned(home) {
            return Err(CoreError::AlreadyOwned);
        }
        self.pay_check(def.price)?;
        Ok(vec![EventKind::Bought { home: home.to_string(), amount: def.price }])
    }

    pub(crate) fn plan_move_home(&self, now: WorldTime, home: &str) -> Result<Vec<EventKind>, CoreError> {
        let def = self.home_def(home)?;
        if def.kind == "plot" {
            return Err(CoreError::NothingThere);
        }
        if !self.home_owned(home) && !self.lease_active(now, home) {
            return Err(CoreError::NotOwned(home.to_string()));
        }
        self.at_home_place(def)?;
        if self.address(now) == home {
            return Err(CoreError::AlreadyDone);
        }
        Ok(vec![EventKind::MovedHome { home: home.to_string() }])
    }

    pub(crate) fn plan_end_lease(&self, now: WorldTime, home: &str) -> Result<Vec<EventKind>, CoreError> {
        if !self.lease_active(now, home) {
            return Err(CoreError::NothingThere);
        }
        Ok(vec![EventKind::LeaseEnded { home: home.to_string(), month: self.calendar().month_index(now) }])
    }

    pub fn homes_view(&self, now: WorldTime) -> Vec<HomeView> {
        let address = self.address(now);
        let (_, active) = self.rent_bills(now);
        self.content()
            .homes
            .values()
            .map(|h| HomeView {
                id: h.id.clone(),
                name: h.name.clone(),
                location: h.location.clone(),
                prop: h.prop.clone(),
                x: h.x,
                y: h.y,
                kind: h.kind.clone(),
                rent: h.rent,
                price: h.price,
                text: h.text.clone(),
                owned: self.home_owned(&h.id),
                leased: active.get(&h.id).copied().unwrap_or(false),
                current: h.id == address,
            })
            .collect()
    }

    /// The taxi's stops, with «home» at the door of where the player lives now.
    pub fn taxi_dests(&self, now: WorldTime) -> Vec<TaxiDest> {
        let mut out = crate::core::taxi_destinations(self.content());
        let address = self.address(now);
        if let Some(h) = self.content().homes.get(&address).filter(|h| !h.start) {
            for d in out.iter_mut().filter(|d| d.id == "taxi.home") {
                d.location = h.location.clone();
                d.x = h.x;
                d.y = h.y;
            }
        }
        out
    }

    /// Why the taxi cannot take one there yet (a place still shut to the player), in the world's words; None
    /// when it can.
    pub fn taxi_shut(&self, d: &TaxiDest, now: WorldTime) -> Option<String> {
        let loc = self.content().locations.get(&d.location)?;
        let req = loc.requires.as_ref()?;
        if self.missing_for(Some(req), now).is_empty() {
            return None;
        }
        Some(if req.hint.is_empty() { self.lang().pick("Туди поки не пускають.", "They aren't letting anyone in there yet.").to_string() } else { req.hint.clone() })
    }

    /// Leases that hold (for `Requires.leased`), judged at the latest time the world has seen.
    pub(crate) fn lease_holds(&self, home: &str) -> bool {
        let now = self.last_time();
        self.state().leases.get(home).is_some_and(|(_, ended)| ended.is_none()) && self.lease_active(now, home)
    }
}

fn coins_of(u: &crate::unlock::Unlock) -> u32 {
    match u {
        crate::unlock::Unlock::Coins(n) => *n,
        _ => 0,
    }
}
