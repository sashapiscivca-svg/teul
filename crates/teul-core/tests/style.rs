//! How one looks and where one lives: the hero is made once; after that clothes come from the shop and are
//! changed at home (by the wardrobe) or in the fitting room, hair is cut at the salon; homes are rented or bought,
//! one moves between them, rent comes with the monthly bills, and a plot can be rented for its station.

mod common;

use std::sync::Arc;

use teul_core::core::{Command, Core, CoreError, NewWorld};
use teul_core::storage::MemoryStorage;
use teul_core::time::{WorldTime, MINUTES_PER_DAY};
use teul_core::unlock::Missing;

fn at(day: u64, minute: u64) -> WorldTime {
    WorldTime(day * MINUTES_PER_DAY + minute)
}

// day 0 is Saturday 2026-10-10; 1 December is day 52, 10 December day 61
const DEC_1: u64 = 52;
const DEC_10: u64 = 61;
const TEN: u64 = 10 * 60;

fn s(k: &str, v: &str) -> (String, String) {
    (k.to_string(), v.to_string())
}

fn world() -> Core<MemoryStorage> {
    let mut core = Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 3, epoch_unix_secs: common::AUTUMN_EPOCH }, Arc::new(common::style())).unwrap();
    core.apply_all(at(0, 500), Command::MakeHero { set: vec![s("look.hair", "3"), s("look.hair_color", "#4a2f27"), s("look.top", "2"), s("look.top_color", "#3fb8b0"), s("look.skin_color", "#f1c9a5")] }).unwrap();
    core
}

fn setting(core: &Core<MemoryStorage>, key: &str) -> Option<String> {
    core.room_view().settings.get(key).cloned()
}

fn go(core: &mut Core<MemoryStorage>, t: WorldTime, to: &str) {
    core.apply_all(t, Command::Travel { to: to.into() }).unwrap();
}

#[test]
fn the_hero_is_made_once_and_then_the_look_is_fixed() {
    let mut core = world();
    assert_eq!(setting(&core, "look.top_color").as_deref(), Some("#3fb8b0"));
    assert_eq!(core.apply_all(at(0, 600), Command::MakeHero { set: vec![s("look.hair", "1")] }).err(), Some(CoreError::AlreadyDone));
    // clothes, hair and the body are no longer set freely
    for key in ["look.top_color", "look.hair", "look.skin_color", "look.acc"] {
        assert_eq!(core.apply_all(at(0, 601), Command::SetSetting { key: key.into(), value: "1".into() }).err(), Some(CoreError::LookFixed), "{key}");
    }
    // the pet is still the player's to choose
    core.apply_all(at(0, 602), Command::SetSetting { key: "look.pet".into(), value: "1".into() }).unwrap();
}

#[test]
fn a_hero_may_only_be_made_of_look_keys() {
    let mut core = Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 3, epoch_unix_secs: common::AUTUMN_EPOCH }, Arc::new(common::style())).unwrap();
    assert_eq!(core.apply_all(at(0, 500), Command::MakeHero { set: vec![s("time_mode", "fixed")] }).err(), Some(CoreError::InvalidSetting));
    assert_eq!(core.apply_all(at(0, 500), Command::MakeHero { set: vec![s("look.top_color", "red")] }).err(), Some(CoreError::InvalidSetting));
}

#[test]
fn clothes_are_bought_at_the_shop_in_its_hours() {
    let mut core = world();
    assert_eq!(core.apply_all(at(0, TEN), Command::Acquire { item: "scarf_red".into() }).err(), Some(CoreError::NotHere));
    go(&mut core, at(0, TEN), "shop_in");
    assert_eq!(core.apply_all(at(0, 20 * 60), Command::Acquire { item: "scarf_red".into() }).err(), Some(CoreError::Closed));
    let coins = core.wallet().coins;
    core.apply_all(at(1, TEN), Command::Acquire { item: "scarf_red".into() }).unwrap();
    assert_eq!(core.wallet().coins, coins - 20);
    assert_eq!(core.apply_all(at(1, TEN + 1), Command::Acquire { item: "scarf_red".into() }).err(), Some(CoreError::AlreadyOwned));
}

#[test]
fn only_owned_clothes_are_worn_at_home_by_the_wardrobe_or_in_the_fitting_room() {
    let mut core = world();
    go(&mut core, at(1, TEN), "shop_in");
    assert_eq!(core.apply_all(at(1, TEN), Command::Dress { slot: "acc".into(), item: Some("scarf_red".into()) }).err(), Some(CoreError::NotOwned("scarf_red".into())));
    core.apply_all(at(1, TEN), Command::Acquire { item: "scarf_red".into() }).unwrap();
    core.apply_all(at(1, TEN + 1), Command::Acquire { item: "coat_navy".into() }).unwrap();
    // tried on in the fitting room
    core.apply_all(at(1, TEN + 2), Command::Dress { slot: "acc".into(), item: Some("scarf_red".into()) }).unwrap();
    assert_eq!(setting(&core, "look.acc").as_deref(), Some("2"));
    assert_eq!(setting(&core, "look.acc_color").as_deref(), Some("#d9534f"));
    // a garment fits its own slot only
    assert_eq!(core.apply_all(at(1, TEN + 3), Command::Dress { slot: "shoes".into(), item: Some("coat_navy".into()) }).err(), Some(CoreError::InvalidSlot));
    // not in the street
    go(&mut core, at(1, TEN + 4), "town");
    assert_eq!(core.apply_all(at(1, TEN + 5), Command::Dress { slot: "top".into(), item: Some("coat_navy".into()) }).err(), Some(CoreError::NotHere));
    // at home only by a wardrobe
    go(&mut core, at(1, TEN + 6), "home");
    assert_eq!(core.apply_all(at(1, TEN + 7), Command::Dress { slot: "top".into(), item: Some("coat_navy".into()) }).err(), Some(CoreError::Needs("wardrobe".into())));
    core.apply_all(at(1, TEN + 8), Command::Acquire { item: "wardrobe_s".into() }).unwrap();
    core.apply_all(at(1, TEN + 8), Command::Place { item: "wardrobe_s".into(), x: 1, y: 1, rot: 0, wall: None, on: None }).unwrap();
    core.apply_all(at(1, TEN + 9), Command::Dress { slot: "top".into(), item: Some("coat_navy".into()) }).unwrap();
    assert_eq!(setting(&core, "look.top").as_deref(), Some("9"));
    // back into the clothes of the first day
    core.apply_all(at(1, TEN + 10), Command::Dress { slot: "top".into(), item: None }).unwrap();
    assert_eq!(setting(&core, "look.top").as_deref(), Some("2"));
    assert_eq!(setting(&core, "look.top_color").as_deref(), Some("#3fb8b0"));
    // the first day had no accessory: taking the scarf off leaves none
    core.apply_all(at(1, TEN + 11), Command::Dress { slot: "acc".into(), item: None }).unwrap();
    assert_eq!(setting(&core, "look.acc"), None);
    let w = core.wardrobe_view(at(1, TEN + 12));
    assert!(w.owned.iter().any(|g| g.item == "coat_navy" && g.slot == "top"));
}

#[test]
fn hair_is_cut_at_the_salon_for_coins() {
    let mut core = world();
    let cut = |set: Vec<(String, String)>| Command::Haircut { set };
    assert_eq!(core.apply_all(at(1, TEN), cut(vec![s("look.hair", "5")])).err(), Some(CoreError::NotHere));
    go(&mut core, at(1, TEN), "salon_in");
    assert_eq!(core.apply_all(at(1, 19 * 60), cut(vec![s("look.hair", "5")])).err(), Some(CoreError::Closed));
    assert_eq!(core.apply_all(at(1, TEN), cut(vec![s("look.top", "5")])).err(), Some(CoreError::InvalidSetting));
    // the same hair is no haircut
    assert_eq!(core.apply_all(at(1, TEN), cut(vec![s("look.hair", "3")])).err(), Some(CoreError::NothingThere));
    let coins = core.wallet().coins;
    core.apply_all(at(1, TEN + 1), cut(vec![s("look.hair", "5"), s("look.hair_color", "#c9a050")])).unwrap();
    assert_eq!(core.wallet().coins, coins - 40 - 25);
    assert_eq!(setting(&core, "look.hair").as_deref(), Some("5"));
    core.apply_all(at(1, TEN + 2), cut(vec![s("look.beard", "2")])).unwrap();
    assert_eq!(core.wallet().coins, coins - 40 - 25 - 15);
}

#[test]
fn a_flat_is_rented_moved_into_and_its_rent_comes_with_the_bills() {
    let mut core = world();
    assert_eq!(core.address(at(1, TEN)), "home.main");
    assert_eq!(core.apply_all(at(1, TEN), Command::Rent { home: "flat.1".into() }).err(), Some(CoreError::NotHere));
    go(&mut core, at(1, TEN), "town");
    let coins = core.wallet().coins;
    core.apply_all(at(1, TEN + 1), Command::Rent { home: "flat.1".into() }).unwrap();
    assert_eq!(core.wallet().coins, coins - 50, "the first month is paid at once");
    assert_eq!(core.apply_all(at(1, TEN + 2), Command::Rent { home: "flat.1".into() }).err(), Some(CoreError::AlreadyOwned));
    core.apply_all(at(1, TEN + 3), Command::MoveHome { home: "flat.1".into() }).unwrap();
    assert_eq!(core.address(at(1, TEN + 3)), "flat.1");
    // November's rent comes on 1 December with the bills
    let v = core.bills_view(at(DEC_1, TEN));
    let rent: Vec<_> = v.bills.iter().filter(|b| b.utility == "rent:flat.1").collect();
    assert_eq!(rent.len(), 1, "{v:?}");
    assert_eq!(rent[0].amount, 50);
    assert!(rent[0].name.contains("Квартира на Садовій"));
    // unpaid past the due date: the lease is over and home is the house again
    assert_eq!(core.address(at(DEC_10, TEN)), "flat.1");
    assert_eq!(core.address(at(DEC_10 + 1, TEN)), "home.main");
    assert!(core.homes_view(at(DEC_10 + 1, TEN)).iter().any(|h| h.id == "flat.1" && !h.leased));
}

#[test]
fn paying_the_rent_keeps_the_flat_and_a_lease_can_be_ended() {
    let mut core = world();
    go(&mut core, at(1, TEN), "town");
    core.apply_all(at(1, TEN), Command::Rent { home: "flat.1".into() }).unwrap();
    core.apply_all(at(1, TEN + 1), Command::MoveHome { home: "flat.1".into() }).unwrap();
    go(&mut core, at(DEC_1, TEN), "utility_in");
    core.apply_all(at(DEC_1, TEN + 1), Command::PayBill { utility: "rent:flat.1".into(), month: None }).unwrap();
    assert_eq!(core.address(at(DEC_10 + 5, TEN)), "flat.1");
    core.apply_all(at(DEC_10 + 5, TEN), Command::EndLease { home: "flat.1".into() }).unwrap();
    assert_eq!(core.address(at(DEC_10 + 5, TEN + 1)), "home.main");
}

#[test]
fn a_house_is_bought_once_for_its_price() {
    let mut core = world();
    go(&mut core, at(1, TEN), "town");
    let coins = core.wallet().coins;
    core.apply_all(at(1, TEN), Command::Buy { home: "house.2".into() }).unwrap();
    assert_eq!(core.wallet().coins, coins - 250);
    assert_eq!(core.apply_all(at(1, TEN + 1), Command::Buy { home: "house.2".into() }).err(), Some(CoreError::AlreadyOwned));
    core.apply_all(at(1, TEN + 2), Command::MoveHome { home: "house.2".into() }).unwrap();
    assert_eq!(core.address(at(DEC_10 + 1, TEN)), "house.2", "a bought house has no rent to lose it by");
    assert!(core.bills_view(at(DEC_1, TEN)).bills.iter().all(|b| !b.utility.starts_with("rent:")));
    // too dear: the flat is not for sale, the plot is no home
    assert_eq!(core.apply_all(at(1, TEN + 3), Command::Buy { home: "flat.1".into() }).err(), Some(CoreError::NothingThere));
}

#[test]
fn not_enough_coins_to_buy() {
    let mut core = world();
    go(&mut core, at(1, TEN), "shop_in");
    for item in ["coat_navy", "boots_brown"] {
        core.apply_all(at(1, TEN), Command::Acquire { item: item.into() }).unwrap();
    }
    go(&mut core, at(1, TEN + 1), "town");
    let have = core.wallet().coins;
    assert_eq!(core.apply_all(at(1, TEN + 2), Command::Buy { home: "house.2".into() }).err(), Some(CoreError::Locked(vec![Missing::Coins { have, need: 250 }])));
}

#[test]
fn a_rented_plot_opens_its_station() {
    let mut core = world();
    go(&mut core, at(1, TEN), "plots");
    assert!(matches!(core.apply_all(at(1, TEN), Command::Use { station: "st.plot.dig".into() }).err(), Some(CoreError::Locked(_))));
    core.apply_all(at(1, TEN + 1), Command::Rent { home: "plot.1".into() }).unwrap();
    core.apply_all(at(1, TEN + 2), Command::Use { station: "st.plot.dig".into() }).unwrap();
    // a plot is not a home to move into
    assert_eq!(core.apply_all(at(1, TEN + 3), Command::MoveHome { home: "plot.1".into() }).err(), Some(CoreError::NothingThere));
    core.apply_all(at(2, TEN), Command::EndLease { home: "plot.1".into() }).unwrap();
    assert!(matches!(core.apply_all(at(2, TEN + 1), Command::Use { station: "st.plot.dig".into() }).err(), Some(CoreError::Locked(_))));
}
