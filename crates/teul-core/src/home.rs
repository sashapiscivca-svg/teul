//! Living at home (docs/world-economy.md §8): the fridge, cooking at the stove, and the monthly bills for
//! garbage, water, electricity and gas, paid at the utility office. An unpaid bill switches its utility off
//! after the due date until it is paid. Nothing here earns: cooking only turns food into other food.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::core::{Core, CoreError};
use crate::event::EventKind;
use crate::storage::Storage;
use crate::time::WorldTime;
use crate::unlock::Missing;

/// Kinds of things the fridge keeps (an item needs one of these tags, and to be carried).
pub const FRIDGE_TAGS: [&str; 8] = ["food", "fruit", "veg", "vegetable", "fish", "drink", "dish", "dairy"];
/// Draws of a cook's luck.
pub const COOK_LUCK: crate::rng::Domain = crate::rng::Domain(72);
/// The utilities a home has; items tagged with one stop working while it is switched off.
pub const UTILITIES: [&str; 4] = ["garbage", "water", "power", "gas"];

const MONTHS: [&str; 12] = ["січень", "лютий", "березень", "квітень", "травень", "червень", "липень", "серпень", "вересень", "жовтень", "листопад", "грудень"];
const MONTHS_OF: [&str; 12] = ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"];

// ---- content ---------------------------------------------------------------------------------------------

/// A dish cooked at the stove from what one has.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RecipeDef {
    pub id: String,
    pub name: String,
    /// Item ids or `#tag`, with counts; taken from the fridge first, then the pocket.
    pub needs: Vec<(String, u32)>,
    /// The dish and how many.
    pub gives: (String, u32),
    #[serde(default)]
    pub text: String,
    /// Learned from someone (a quest's reward) before it can be cooked.
    #[serde(default)]
    pub learn: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UtilityDef {
    /// garbage, water, power or gas.
    pub id: String,
    pub name: String,
    /// Coins a month.
    pub monthly: u32,
    /// More for a winter month (December, January, February): heating, light.
    #[serde(default)]
    pub winter: u32,
}

/// The bills: where they are paid, when, and what each utility costs.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BillsDef {
    /// The location of the utility office.
    pub office: String,
    /// Its opening hours.
    pub hours: (u32, u32),
    /// A month's bills come on the 1st of the next month and are due by this day of it.
    pub due_day: u32,
    pub utilities: Vec<UtilityDef>,
}

// ---- views -----------------------------------------------------------------------------------------------

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct FridgeView {
    pub items: BTreeMap<String, u32>,
    /// Is there a fridge at home, and is it working (electricity)?
    pub has_fridge: bool,
    pub working: bool,
    /// What a broken fridge says (it keeps nothing new).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub broken: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct RecipeView {
    pub id: String,
    pub name: String,
    pub text: String,
    /// (key, need, have — in the fridge and the pocket together)
    pub needs: Vec<(String, u32, u32)>,
    pub gives: (String, u32),
    pub ok: bool,
    /// not_here, no_stove, gas, not_enough, pocket_full
    pub reason: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct BillView {
    pub utility: String,
    pub name: String,
    /// The billed month (an index: year * 12 + month - 1).
    pub month: i64,
    /// «листопад 2026»
    pub period: String,
    /// «10 грудня»
    pub due: String,
    pub amount: u32,
    pub paid: bool,
    pub overdue: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct UtilityStatus {
    pub id: String,
    pub name: String,
    pub on: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct BillsView {
    /// Bills issued so far that are unpaid, and the last month's paid ones (newest last).
    pub bills: Vec<BillView>,
    pub utilities: Vec<UtilityStatus>,
    /// Unpaid, in coins.
    pub total_due: u32,
    /// Where and when they are paid.
    pub office: String,
    pub office_name: String,
    pub hours: (u32, u32),
    /// The player is at the office while it is open.
    pub can_pay: bool,
}

fn is_winter(month: i64) -> bool {
    matches!(month.rem_euclid(12), 11 | 0 | 1)
}

const MONTHS_EN: [&str; 12] = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

fn month_name(month: i64, lang: crate::content::Lang) -> String {
    format!("{} {}", lang.pick(MONTHS[month.rem_euclid(12) as usize], MONTHS_EN[month.rem_euclid(12) as usize]), month.div_euclid(12))
}

pub(crate) fn bill_key(utility: &str, month: i64) -> String {
    format!("{utility}:{month}")
}

// ---- the core side ---------------------------------------------------------------------------------------

impl<S: Storage> Core<S> {
    /// Copies of an item kept in the fridge.
    pub fn in_fridge(&self, item: &str) -> u32 {
        let st = self.state();
        st.fridge.get(item).copied().unwrap_or(0).min(st.owned.get(item).copied().unwrap_or(0))
    }

    pub(crate) fn fridgeable(&self, item: &str) -> bool {
        self.content().items.get(item).is_some_and(|d| d.carry && d.tags.iter().any(|t| FRIDGE_TAGS.contains(&t.as_str())))
    }

    /// Whether something with this tag stands in the home (a fridge, a stove).
    pub(crate) fn has_placed(&self, tag: &str) -> bool {
        let content = self.content();
        self.state().room.placements.values().any(|p| content.items.get(&p.item).is_some_and(|d| d.tags.iter().any(|t| t == tag)))
    }

    /// The bills issued by `now`, oldest first: (utility, billed month, amount, due date passed).
    fn issued(&self, now: WorldTime) -> Vec<(&crate::home::UtilityDef, i64, u32, bool)> {
        let Some(bills) = self.content().bills.as_ref() else { return Vec::new() };
        let cal = self.calendar();
        let first = cal.month_index(WorldTime(0));
        let current = cal.month_index(now);
        let (_, _, dom) = cal.ymd(now);
        let mut out = Vec::new();
        // the month the world began is free; each later month is billed on the 1st of the next
        for month in (first + 1)..current {
            let overdue = current > month + 1 || dom > bills.due_day;
            for u in &bills.utilities {
                let amount = u.monthly + if is_winter(month) { u.winter } else { 0 };
                out.push((u, month, amount, overdue));
            }
        }
        out
    }

    /// Every bill issued by `now`: the utilities' and the rent of every lease — (id, name, month, amount, overdue).
    fn all_bills(&self, now: WorldTime) -> Vec<(String, String, i64, u32, bool)> {
        let mut out: Vec<(String, String, i64, u32, bool)> = self.issued(now).into_iter().map(|(u, m, a, o)| (u.id.clone(), u.name.clone(), m, a, o)).collect();
        out.extend(self.rent_bills(now).0);
        out
    }

    fn paid(&self, utility: &str, month: i64) -> bool {
        self.state().bills_paid.contains(&bill_key(utility, month))
    }

    /// Whether a utility works at home now: off while any of its bills is unpaid after its due date.
    pub fn utility_on(&self, now: WorldTime, utility: &str) -> bool {
        !self.issued(now).iter().any(|(u, month, _, overdue)| u.id == utility && *overdue && !self.paid(&u.id, *month))
    }

    /// The utility an item needs to work (its tag), if that one is off now.
    pub(crate) fn utility_off_for(&self, now: WorldTime, item: &str) -> Option<String> {
        let def = self.content().items.get(item)?;
        let needs = |t: &str| def.tags.iter().any(|x| x == t);
        let kind = if needs("water") {
            "water"
        } else if needs("gas") {
            "gas"
        } else if needs("power") || needs("light") || needs("switch") {
            "power"
        } else {
            return None;
        };
        (!self.utility_on(now, kind)).then(|| kind.to_string())
    }

    pub fn fridge_view(&self) -> FridgeView {
        let items = self.state().fridge.iter().map(|(k, _)| (k.clone(), self.in_fridge(k))).filter(|(_, n)| *n > 0).collect();
        FridgeView { items, has_fridge: self.has_placed("fridge"), working: true, broken: None }
    }

    pub fn fridge_view_at(&self, now: WorldTime) -> FridgeView {
        FridgeView { working: self.utility_on(now, "power"), broken: self.broken_tag("fridge", now), ..self.fridge_view() }
    }

    /// What answers a need (an item id or `#tag`), with how many are in the fridge and in the pocket.
    fn sources(&self, key: &str) -> Vec<(String, u32, u32)> {
        let content = self.content();
        let fits = |id: &str| match key.strip_prefix('#') {
            Some(tag) => content.items.get(id).is_some_and(|d| d.tags.iter().any(|t| t == tag) || d.category == tag),
            None => id == key,
        };
        self.state()
            .owned
            .keys()
            .filter(|id| fits(id))
            .map(|id| (id.clone(), self.in_fridge(id), if self.is_carry(id) { self.in_pocket(id) } else { 0 }))
            .filter(|(_, f, p)| f + p > 0)
            .collect()
    }

    /// What a recipe would take: (from the pocket, from the fridge), or what is short.
    fn ingredients(&self, def: &RecipeDef) -> Result<(Vec<String>, Vec<String>), Vec<(String, u32, u32)>> {
        let mut pocket = Vec::new();
        let mut fridge = Vec::new();
        let mut short = Vec::new();
        let mut used: BTreeMap<String, (u32, u32)> = BTreeMap::new();
        for (key, need) in &def.needs {
            let mut left = *need;
            let mut have = 0;
            for (id, f, p) in self.sources(key) {
                let (uf, up) = used.get(&id).copied().unwrap_or((0, 0));
                let (f, p) = (f - uf, p - up);
                have += f + p;
                let from_f = f.min(left);
                left -= from_f;
                let from_p = p.min(left);
                left -= from_p;
                fridge.extend(std::iter::repeat_n(id.clone(), from_f as usize));
                pocket.extend(std::iter::repeat_n(id.clone(), from_p as usize));
                used.insert(id, (uf + from_f, up + from_p));
            }
            if left > 0 {
                short.push((key.clone(), *need, have));
            }
        }
        if short.is_empty() {
            Ok((pocket, fridge))
        } else {
            Err(short)
        }
    }

    pub fn recipes_view(&self, now: WorldTime) -> Vec<RecipeView> {
        let content = self.content();
        content
            .recipes
            .values()
            // a dish someone has to teach shows once they have
            .filter(|r| !r.learn || self.state().recipes_learned.contains(&r.id))
            .map(|r| {
                let needs = r
                    .needs
                    .iter()
                    .map(|(k, n)| (k.clone(), *n, self.sources(k).iter().map(|(_, f, p)| f + p).sum()))
                    .collect();
                let reason = self.cook_check(now, r).err().map(|e| match e {
                    CoreError::NotHere => "not_here",
                    CoreError::Needs(_) => "no_stove",
                    CoreError::UtilityOff(_) => "gas",
                    CoreError::PocketFull => "pocket_full",
                    _ => "not_enough",
                });
                RecipeView { id: r.id.clone(), name: r.name.clone(), text: r.text.clone(), needs, gives: r.gives.clone(), ok: reason.is_none(), reason: reason.map(String::from) }
            })
            .collect()
    }

    /// Everything a cooking needs, and what it would do: (from the pocket, from the fridge, into the fridge).
    fn cook_check(&self, now: WorldTime, def: &RecipeDef) -> Result<(Vec<String>, Vec<String>, bool), CoreError> {
        if self.location() != "home" {
            return Err(CoreError::NotHere);
        }
        if def.learn && !self.state().recipes_learned.contains(&def.id) {
            return Err(CoreError::NotLearned(def.id.clone()));
        }
        if !self.has_placed("stove") {
            return Err(CoreError::Needs("stove".into()));
        }
        if !self.utility_on(now, "gas") {
            return Err(CoreError::UtilityOff("gas".into()));
        }
        let (pocket, fridge) = self.ingredients(def).map_err(|_| CoreError::NotEnough)?;
        let (dish, n) = &def.gives;
        let to_fridge = if self.fits(&vec![dish.clone(); *n as usize], &pocket) {
            false
        } else if self.fridgeable(dish) && self.has_placed("fridge") && self.utility_on(now, "power") {
            true
        } else {
            return Err(CoreError::PocketFull);
        };
        Ok((pocket, fridge, to_fridge))
    }

    pub(crate) fn plan_cook(&self, now: WorldTime, recipe: &str) -> Result<Vec<EventKind>, CoreError> {
        let def = self.content().recipes.get(recipe).ok_or_else(|| CoreError::UnknownRecipe(recipe.to_string()))?;
        if let Some(w) = self.broken_tag("stove", now) {
            return Err(CoreError::Broken(w));
        }
        let (took, from_fridge, to_fridge) = self.cook_check(now, def)?;
        let (gave, mut n) = def.gives.clone();
        // now and then a dish turns out double for a good cook (when there is room for it)
        let cooked = self.practice("cooking");
        let chance = crate::skills::double_dish_chance(crate::skills::level_of(cooked));
        if chance > 0 && crate::rng::chance_permille(self.meta().seed, COOK_LUCK, u64::from(cooked), now.day(), chance) && (to_fridge || self.fits(&vec![gave.clone(); n as usize + 1], &took)) {
            n += 1;
        }
        Ok(vec![EventKind::Cooked { recipe: recipe.to_string(), day: now.day(), took, from_fridge, gave, n, to_fridge }])
    }

    pub(crate) fn plan_fridge(&self, now: WorldTime, item: &str, n: u32, into: bool) -> Result<Vec<EventKind>, CoreError> {
        if self.location() != "home" {
            return Err(CoreError::NotHere);
        }
        if !self.has_placed("fridge") {
            return Err(CoreError::Needs("fridge".into()));
        }
        if !self.utility_on(now, "power") {
            return Err(CoreError::UtilityOff("power".into()));
        }
        if into {
            if !self.fridgeable(item) {
                return Err(CoreError::NotFood);
            }
            if n == 0 || self.in_pocket(item) < n {
                return Err(CoreError::NotEnough);
            }
            // a fridge that does not cool keeps nothing
            if let Some(w) = self.broken_tag("fridge", now) {
                return Err(CoreError::Broken(w));
            }
            Ok(vec![EventKind::Fridged { item: item.to_string(), n }])
        } else {
            if n == 0 || self.in_fridge(item) < n {
                return Err(CoreError::NotEnough);
            }
            if !self.fits(&vec![item.to_string(); n as usize], &[]) {
                return Err(CoreError::PocketFull);
            }
            Ok(vec![EventKind::Unfridged { item: item.to_string(), n }])
        }
    }

    /// Paying at the office: one utility's oldest unpaid bill (or a given month), or everything due.
    pub(crate) fn plan_pay(&self, now: WorldTime, utility: Option<&str>, month: Option<i64>) -> Result<Vec<EventKind>, CoreError> {
        let bills = self.content().bills.as_ref().ok_or(CoreError::NothingThere)?;
        if self.location() != bills.office {
            return Err(CoreError::NotHere);
        }
        let hour = (now.minute_of_day() / 60) as u32;
        if hour < bills.hours.0 || hour >= bills.hours.1 {
            return Err(CoreError::Closed);
        }
        let unpaid: Vec<(String, i64, u32)> = self
            .all_bills(now)
            .into_iter()
            .filter(|(id, _, m, _, _)| !self.paid(id, *m))
            .filter(|(id, _, m, _, _)| utility.is_none_or(|x| x == id) && month.is_none_or(|x| x == *m))
            .map(|(id, _, m, a, _)| (id, m, a))
            .collect();
        let chosen: Vec<(String, i64, u32)> = if utility.is_some() { unpaid.into_iter().take(1).collect() } else { unpaid };
        if chosen.is_empty() {
            return Err(CoreError::NothingThere);
        }
        let total: u32 = chosen.iter().map(|(_, _, a)| a).sum();
        let have = self.wallet().coins;
        if have < u64::from(total) {
            return Err(CoreError::Locked(vec![Missing::Coins { have, need: u64::from(total) }]));
        }
        Ok(chosen.into_iter().map(|(utility, month, amount)| EventKind::BillPaid { utility, month, amount }).collect())
    }

    pub fn bills_view(&self, now: WorldTime) -> BillsView {
        let content = self.content();
        let Some(def) = content.bills.as_ref() else {
            return BillsView { bills: Vec::new(), utilities: Vec::new(), total_due: 0, office: String::new(), office_name: String::new(), hours: (0, 0), can_pay: false };
        };
        let cal = self.calendar();
        let current = cal.month_index(now);
        let mut bills = Vec::new();
        for (id, name, month, amount, overdue) in self.all_bills(now) {
            let paid = self.paid(&id, month);
            // the paid ones only of the latest month, so the list stays short
            if paid && month + 1 < current {
                continue;
            }
            let due_month = month + 1;
            bills.push(BillView {
                utility: id,
                name,
                month,
                period: month_name(month, content.lang),
                due: if content.lang.en() { format!("{} {}", MONTHS_EN[due_month.rem_euclid(12) as usize], def.due_day) } else { format!("{} {}", def.due_day, MONTHS_OF[due_month.rem_euclid(12) as usize]) },
                amount,
                paid,
                overdue: overdue && !paid,
            });
        }
        let total_due = bills.iter().filter(|b| !b.paid).map(|b| b.amount).sum();
        let hour = (now.minute_of_day() / 60) as u32;
        BillsView {
            bills,
            utilities: def.utilities.iter().map(|u| UtilityStatus { id: u.id.clone(), name: u.name.clone(), on: self.utility_on(now, &u.id) }).collect(),
            total_due,
            office: def.office.clone(),
            office_name: content.locations.get(&def.office).map(|l| l.name.clone()).unwrap_or_default(),
            hours: def.hours,
            can_pay: self.location() == def.office && hour >= def.hours.0 && hour < def.hours.1,
        }
    }

    /// Lines for the morning paper: reminders before the due date, notices when something is switched off.
    pub(crate) fn bill_news(&self, now: WorldTime) -> Vec<String> {
        let v = self.bills_view(now);
        let mut out = Vec::new();
        let unpaid: Vec<&BillView> = v.bills.iter().filter(|b| !b.paid).collect();
        if let Some(first) = unpaid.iter().find(|b| !b.overdue) {
            let sum = unpaid.iter().filter(|b| !b.overdue).map(|b| b.amount).sum::<u32>();
            out.push(if self.lang().en() {
                format!("The utilities office reminds you: the bills for {} ({} coins) are due by {}. Open {}:00 to {}:00.", first.period, sum, first.due, v.hours.0, v.hours.1)
            } else {
                format!("Комунальна контора нагадує: рахунки за {} ({} монет) треба сплатити до {}. Працюємо з {}:00 до {}:00.", first.period, sum, first.due, v.hours.0, v.hours.1)
            });
        }
        let off: Vec<&str> = v.utilities.iter().filter(|u| !u.on).map(|u| u.name.as_str()).collect();
        if !off.is_empty() {
            out.push(if self.lang().en() {
                format!("Unpaid bills: your home has been cut off from {}. Settle up at the utilities office and it all comes back on.", off.join(", ").to_lowercase())
            } else {
                format!("Через несплату у вашому домі вимкнено: {}. Сплатіть борг у комунальній конторі — і все запрацює.", off.join(", ").to_lowercase())
            });
        }
        if v.utilities.iter().any(|u| u.id == "garbage" && !u.on) {
            out.push(self.lang().pick("Сусіди скаржаться: біля одного з будинків уже тиждень не вивозять сміття.", "Neighbours complain that the rubbish outside one of the houses hasn't been collected for a week.").to_string());
        }
        out
    }
}
