//! Help: one-time tasks from the town's people that open the way.

mod common;

use std::sync::Arc;

use teul_core::content::Content;
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

fn shrooms(core: &mut Core<MemoryStorage>, day: u64, n: usize) {
    for spot in ["shroom", "shroom2", "shroom3"].iter().take(n) {
        core.apply_all(at(day, 610), Command::Gather { spot: (*spot).into() }).unwrap();
    }
}

#[test]
fn help_is_given_once_and_pays_and_brings_its_present() {
    let mut core = world();
    core.apply_all(at(0, 600), Command::Travel { to: "village".into() }).unwrap();
    shrooms(&mut core, 0, 2);
    let coins = core.wallet().coins;
    let events = core.apply_all(at(0, 611), Command::Help { help: "help.miner".into() }).unwrap();
    assert!(matches!(&events[0].kind, EventKind::Helped { help, coins: 40, gives, .. } if help == "help.miner" && gives == &vec!["miner_lantern".to_string()]));
    assert_eq!(core.wallet().coins, coins + 40);
    assert_eq!(core.pocket_view().items.get("mushroom"), None);
    shrooms(&mut core, 1, 2);
    assert_eq!(core.apply_all(at(1, 611), Command::Help { help: "help.miner".into() }).err(), Some(CoreError::AlreadyDone));
}

#[test]
fn help_comes_in_order_and_only_where_the_giver_is() {
    let mut core = world();
    core.apply_all(at(0, 600), Command::Travel { to: "farm".into() }).unwrap();
    assert_eq!(core.apply_all(at(0, 601), Command::Help { help: "help.miner".into() }).err(), Some(CoreError::NotHere));
    core.apply_all(at(0, 602), Command::Travel { to: "village".into() }).unwrap();
    shrooms(&mut core, 0, 3);
    assert!(matches!(core.apply_all(at(0, 611), Command::Help { help: "help.second".into() }).err(), Some(CoreError::Locked(_))));
    core.apply_all(at(0, 612), Command::Help { help: "help.miner".into() }).unwrap();
    core.apply_all(at(0, 613), Command::Help { help: "help.second".into() }).unwrap();
    let helps = core.helps_view(at(0, 614));
    assert!(helps.iter().all(|h| h.done));
    // the backpack is the best bag now
    assert_eq!(core.pocket_view().capacity, 3 + 6);
}

#[test]
fn the_view_says_what_is_ready() {
    let mut core = world();
    core.apply_all(at(0, 600), Command::Travel { to: "village".into() }).unwrap();
    let view = core.helps_view(at(0, 600));
    let miner = view.iter().find(|h| h.id == "help.miner").unwrap();
    assert!(miner.available && !miner.ready && !miner.done);
    assert!(!view.iter().find(|h| h.id == "help.second").unwrap().available);
    shrooms(&mut core, 0, 2);
    assert!(core.helps_view(at(0, 611)).iter().find(|h| h.id == "help.miner").unwrap().ready);
}

#[test]
fn help_chains_cannot_go_round_in_circles() {
    let looped = r#"{ "schema": 1, "id": "loop", "version": 1,
      "helps": [
        { "id": "help.a", "giver": "olia", "giver_name": "Оля", "location": "village", "title": "a", "text": "", "after": ["help.b"], "gives": [] },
        { "id": "help.b", "giver": "olia", "giver_name": "Оля", "location": "village", "title": "b", "text": "", "after": ["help.a"], "gives": [] }
      ] }"#;
    assert!(Content::from_packs(&[common::PACK, common::ECONOMY, looped]).is_err());
    let stranger = r#"{ "schema": 1, "id": "s", "version": 1,
      "helps": [{ "id": "help.s", "giver": "nobody", "giver_name": "?", "location": "village", "title": "s", "text": "", "gives": [] }] }"#;
    assert!(Content::from_packs(&[common::PACK, common::ECONOMY, stranger]).is_err());
}
