//! The inventory: what the player carries is limited by kinds (names), not by pieces — as many of a kind as one
//! likes, but only so many kinds (64 in the town; three in these tests); a bag gives more room, never past 64; the
//! chest at home keeps the rest.

mod common;

use std::sync::Arc;

use teul_core::core::{Command, Core, CoreError, NewWorld};
use teul_core::event::EventKind;
use teul_core::storage::MemoryStorage;
use teul_core::time::{WorldTime, MINUTES_PER_DAY};

fn world() -> Core<MemoryStorage> {
    Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 3, epoch_unix_secs: common::AUTUMN_EPOCH }, Arc::new(common::economy())).unwrap()
}

fn at(day: u64, minute: u64) -> WorldTime {
    WorldTime(day * MINUTES_PER_DAY + minute)
}

fn go(core: &mut Core<MemoryStorage>, t: WorldTime, to: &str) {
    core.apply_all(t, Command::Travel { to: to.into() }).unwrap();
}

fn gather(core: &mut Core<MemoryStorage>, t: WorldTime, spot: &str) -> Result<Vec<teul_core::event::Event>, CoreError> {
    core.apply_all(t, Command::Gather { spot: spot.into() })
}

#[test]
fn many_of_a_kind_take_one_name() {
    let mut core = world();
    go(&mut core, at(0, 600), "village");
    for spot in ["shroom", "shroom2", "shroom3", "shroom4"] {
        gather(&mut core, at(0, 601), spot).unwrap();
    }
    let pocket = core.pocket_view();
    assert_eq!((pocket.used, pocket.capacity), (1, 3));
    assert_eq!(pocket.items.get("mushroom"), Some(&4));
}

#[test]
fn a_new_kind_needs_a_free_name() {
    let mut core = world();
    go(&mut core, at(0, 600), "village");
    gather(&mut core, at(0, 601), "shroom").unwrap();
    core.apply_all(at(0, 602), Command::Use { station: "st.village.bakery".into() }).unwrap();
    go(&mut core, at(0, 603), "farm");
    core.apply_all(at(0, 604), Command::Use { station: "st.farm.shear".into() }).unwrap();
    assert_eq!(core.pocket_view().used, 3);
    // a fourth kind does not fit…
    go(&mut core, at(0, 605), "village");
    assert_eq!(core.apply_all(at(0, 606), Command::Fish { place: "pond".into() }).err(), Some(CoreError::PocketFull));
    // …but more of a kind one has always does
    gather(&mut core, at(0, 607), "shroom2").unwrap();
    core.apply_all(at(0, 608), Command::Use { station: "st.village.bakery".into() }).unwrap();
    assert_eq!(core.pocket_view().items.get("bread"), Some(&2));
}

#[test]
fn never_more_than_sixty_four_names() {
    assert_eq!(teul_core::economy::INVENTORY_MAX, 64);
    let base = teul_core::content::Content::from_packs(&[include_str!("../../../content/base/pack.json")]).unwrap();
    let core = Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 3, epoch_unix_secs: common::AUTUMN_EPOCH }, Arc::new(base)).unwrap();
    assert_eq!(core.pocket_view().capacity, 64);
}

#[test]
fn the_chest_at_home_keeps_what_the_pocket_cannot() {
    let mut core = world();
    go(&mut core, at(0, 600), "village");
    for spot in ["shroom", "shroom2", "shroom3"] {
        gather(&mut core, at(0, 601), spot).unwrap();
    }
    // only at home
    assert_eq!(core.apply_all(at(0, 602), Command::Stash { item: "mushroom".into(), n: 2 }).err(), Some(CoreError::NotHere));
    go(&mut core, at(0, 603), "home");
    core.apply_all(at(0, 604), Command::Stash { item: "mushroom".into(), n: 2 }).unwrap();
    let pocket = core.pocket_view();
    assert_eq!((pocket.used, pocket.chest.get("mushroom").copied(), pocket.items.get("mushroom").copied()), (1, Some(2), Some(1)));
    // all of a kind into the chest: its name is free again
    core.apply_all(at(0, 605), Command::Stash { item: "mushroom".into(), n: 1 }).unwrap();
    assert_eq!(core.pocket_view().used, 0);
    // taking back: a kind one carries already always fits; a new kind needs a free name
    core.apply_all(at(0, 608), Command::Take { item: "mushroom".into(), n: 2 }).unwrap();
    assert_eq!(core.pocket_view().items.get("mushroom"), Some(&2));
    // never more than there is
    assert_eq!(core.apply_all(at(0, 610), Command::Stash { item: "yarn".into(), n: 1 }).err(), Some(CoreError::NotEnough));
}

#[test]
fn what_is_in_the_chest_is_not_carried_to_people() {
    let mut core = world();
    go(&mut core, at(0, 600), "village");
    gather(&mut core, at(0, 601), "shroom").unwrap();
    go(&mut core, at(0, 602), "home");
    core.apply_all(at(0, 603), Command::Stash { item: "mushroom".into(), n: 1 }).unwrap();
    go(&mut core, at(0, 604), "village");
    let help = core.apply_all(at(0, 605), Command::Help { help: "help.miner".into() });
    assert_eq!(help.err(), Some(CoreError::NotEnough));
}

#[test]
fn the_best_bag_gives_the_room_and_bags_do_not_add_up() {
    let mut core = world();
    assert_eq!(core.pocket_view().capacity, 3);
    go(&mut core, at(0, 600), "farm");
    core.apply_all(at(0, 601), Command::Use { station: "st.farm.shear".into() }).unwrap();
    core.apply_all(at(0, 602), Command::Use { station: "st.farm.pouch".into() }).unwrap();
    let pocket = core.pocket_view();
    assert_eq!(pocket.capacity, 3 + 4);
    assert_eq!(pocket.bag.as_deref(), Some("pouch"));
    // the bag itself is worn, not carried
    assert_eq!(pocket.used, 0);
}

#[test]
fn a_present_that_does_not_fit_is_sent_home() {
    let mut core = world();
    go(&mut core, at(0, 600), "village");
    gather(&mut core, at(0, 601), "shroom").unwrap();
    for i in 0..2 {
        core.apply_all(at(0, 601), Command::Fish { place: "pond".into() }).unwrap();
        let _ = i;
    }
    go(&mut core, at(0, 601), "farm");
    core.apply_all(at(0, 601), Command::Use { station: "st.farm.shear".into() }).unwrap();
    go(&mut core, at(0, 601), "village");
    // olia gives bread at the first talk; three kinds already carried, so it goes to the chest
    let events = core.apply_all(at(0, 602), Command::Talk { npc: "olia".into() }).unwrap();
    assert!(events.iter().any(|e| matches!(&e.kind, EventKind::Stashed { item, n: 1 } if item == "bread")), "{events:?}");
    let pocket = core.pocket_view();
    assert_eq!(pocket.chest.get("bread"), Some(&1));
    assert_eq!(pocket.used, 3);
}

#[test]
fn keys_ride_on_the_keyring_and_never_leave_it() {
    let mut core = world();
    go(&mut core, at(0, 600), "village");
    gather(&mut core, at(0, 601), "shroom").unwrap();
    gather(&mut core, at(0, 601), "shroom2").unwrap();
    core.apply_all(at(0, 602), Command::Help { help: "help.miner".into() }).unwrap();
    let pocket = core.pocket_view();
    assert_eq!(pocket.keys, vec!["miner_lantern".to_string()]);
    assert_eq!(pocket.used, 0);
    go(&mut core, at(0, 603), "home");
    assert_eq!(core.apply_all(at(0, 604), Command::Stash { item: "miner_lantern".into(), n: 1 }).err(), Some(CoreError::NotEnough));
    assert_eq!(core.apply_all(at(0, 605), Command::Gift { npc: "olia".into(), item: "miner_lantern".into() }).err(), Some(CoreError::NoGift));
}

#[test]
fn what_is_not_wanted_is_thrown_away_anywhere_and_makes_room() {
    let mut core = world();
    go(&mut core, at(0, 600), "village");
    for spot in ["shroom", "shroom2", "shroom3"] {
        gather(&mut core, at(0, 601), spot).unwrap();
    }
    // out in the village, not only at home
    let ev = core.apply_all(at(0, 602), Command::ThrowAway { item: "mushroom".into(), n: 2 }).unwrap();
    assert!(ev.iter().any(|e| matches!(&e.kind, EventKind::ThrownAway { item, n: 2 } if item == "mushroom")));
    let pocket = core.pocket_view();
    assert_eq!((pocket.used, pocket.items.get("mushroom").copied()), (1, Some(1)));
    gather(&mut core, at(0, 603), "shroom4").unwrap();
    // never more than the pocket holds, nothing from the chest, no keys
    assert_eq!(core.apply_all(at(0, 604), Command::ThrowAway { item: "mushroom".into(), n: 3 }).err(), Some(CoreError::NotEnough));
    assert_eq!(core.apply_all(at(0, 604), Command::ThrowAway { item: "mushroom".into(), n: 0 }).err(), Some(CoreError::NotEnough));
    go(&mut core, at(0, 605), "home");
    core.apply_all(at(0, 606), Command::Stash { item: "mushroom".into(), n: 2 }).unwrap();
    assert_eq!(core.apply_all(at(0, 607), Command::ThrowAway { item: "mushroom".into(), n: 1 }).err(), Some(CoreError::NotEnough));
    assert_eq!(core.pocket_view().chest.get("mushroom").copied(), Some(2));
}

#[test]
fn the_buyer_takes_what_it_buys_at_its_price_in_its_hours_up_to_its_day() {
    let mut core = world();
    let sell = |item: &str, n: u32| Command::SellTo { station: "st.village.buyer".into(), item: item.into(), n };
    go(&mut core, at(0, 600), "village");
    gather(&mut core, at(0, 601), "shroom").unwrap();
    // mushrooms it does not want (a price of 0)
    assert_eq!(core.apply_all(at(0, 602), sell("mushroom", 1)).err(), Some(CoreError::NotBought));
    // yarn from the farm: anything else, a coin a piece
    go(&mut core, at(0, 603), "farm");
    core.apply_all(at(0, 604), Command::Use { station: "st.farm.shear".into() }).unwrap();
    core.apply_all(at(0, 605), Command::Use { station: "st.farm.shear".into() }).unwrap();
    // not here: the buyer stands in the village
    assert_eq!(core.apply_all(at(0, 606), sell("yarn", 1)).err(), Some(CoreError::NotHere));
    go(&mut core, at(0, 607), "village");
    let had = core.wallet().coins;
    let ev = core.apply_all(at(0, 608), sell("yarn", 2)).unwrap();
    assert!(ev.iter().any(|e| matches!(&e.kind, EventKind::SoldTo { item, n: 2, coins: 2, .. } if item == "yarn")));
    assert_eq!(core.wallet().coins, had + 2);
    assert_eq!(core.pocket_view().items.get("yarn"), None);
    // never more than the pocket holds; three pieces a day, then the tin is empty
    assert_eq!(core.apply_all(at(0, 609), sell("yarn", 1)).err(), Some(CoreError::NotEnough));
    // shut in the evening
    assert_eq!(core.apply_all(at(0, 1100), sell("mushroom", 1)).err(), Some(CoreError::Closed));
    go(&mut core, at(1, 600), "farm");
    core.apply_all(at(1, 601), Command::Use { station: "st.farm.shear".into() }).unwrap();
    core.apply_all(at(1, 602), Command::Use { station: "st.farm.shear".into() }).unwrap();
    go(&mut core, at(1, 603), "village");
    core.apply_all(at(1, 604), sell("yarn", 1)).unwrap();
    // a new day: three more; two sold before would not count
    assert!(core.apply_all(at(1, 605), sell("yarn", 1)).is_ok());
}

#[test]
fn a_thing_of_the_home_that_stands_nowhere_sells_second_hand_a_few_a_day() {
    let mut core = world();
    // ten coins from mushrooms sold at the farm, then a teapot for them
    go(&mut core, at(0, 600), "village");
    gather(&mut core, at(0, 601), "shroom").unwrap();
    gather(&mut core, at(0, 601), "shroom2").unwrap();
    go(&mut core, at(0, 602), "farm");
    core.apply_all(at(0, 603), Command::Use { station: "st.farm.sell".into() }).unwrap();
    core.apply_all(at(0, 604), Command::Use { station: "st.farm.sell".into() }).unwrap();
    go(&mut core, at(0, 605), "home");
    core.apply_all(at(0, 606), Command::Acquire { item: "teapot".into() }).unwrap();
    let had = core.wallet().coins;
    // 40% of the 10 it cost
    let ev = core.apply_all(at(0, 607), Command::SellBack { item: "teapot".into() }).unwrap();
    assert!(ev.iter().any(|e| matches!(&e.kind, EventKind::SoldBack { coins: 4, .. })));
    assert_eq!(core.wallet().coins, had + 4);
    // it is gone; what was free is not bought
    assert_eq!(core.apply_all(at(0, 608), Command::SellBack { item: "teapot".into() }).err(), Some(CoreError::NotEnough));
    core.apply_all(at(0, 609), Command::Acquire { item: "sofa".into() }).unwrap();
    assert_eq!(core.apply_all(at(0, 610), Command::SellBack { item: "sofa".into() }).err(), Some(CoreError::NotBought));
    // only from home
    go(&mut core, at(0, 611), "village");
    assert_eq!(core.apply_all(at(0, 612), Command::SellBack { item: "sofa".into() }).err(), Some(CoreError::NotHere));
}

#[test]
fn nine_places_at_hand_hold_what_one_carries() {
    let mut core = world();
    go(&mut core, at(0, 600), "village");
    gather(&mut core, at(0, 601), "shroom").unwrap();
    assert_eq!(core.pocket_view().hotbar, vec![None; 9]);
    core.apply_all(at(0, 602), Command::SetHotbar { slot: 2, item: Some("mushroom".into()) }).unwrap();
    assert_eq!(core.pocket_view().hotbar[2].as_deref(), Some("mushroom"));
    // only what one carries, only nine places
    assert_eq!(core.apply_all(at(0, 603), Command::SetHotbar { slot: 0, item: Some("yarn".into()) }).err(), Some(CoreError::NotEnough));
    assert_eq!(core.apply_all(at(0, 603), Command::SetHotbar { slot: 9, item: Some("mushroom".into()) }).err(), Some(CoreError::NoRequest));
    // a kind in one place only: put elsewhere, it moves
    core.apply_all(at(0, 604), Command::SetHotbar { slot: 5, item: Some("mushroom".into()) }).unwrap();
    let bar = core.pocket_view().hotbar;
    assert_eq!((bar[2].as_deref(), bar[5].as_deref()), (None, Some("mushroom")));
    // emptied
    core.apply_all(at(0, 605), Command::SetHotbar { slot: 5, item: None }).unwrap();
    assert_eq!(core.pocket_view().hotbar, vec![None; 9]);
    // a thing no longer carried leaves its place empty in the view
    core.apply_all(at(0, 606), Command::SetHotbar { slot: 0, item: Some("mushroom".into()) }).unwrap();
    go(&mut core, at(0, 607), "home");
    core.apply_all(at(0, 608), Command::Stash { item: "mushroom".into(), n: 1 }).unwrap();
    assert_eq!(core.pocket_view().hotbar[0], None);
}
