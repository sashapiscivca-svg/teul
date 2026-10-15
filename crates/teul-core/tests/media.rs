//! Pieces of music: known by heart, from sheet music, or once played; playing in the street pays a little, the
//! home never.

mod common;

use std::sync::Arc;

use teul_core::core::{Command, Core, CoreError, NewWorld};
use teul_core::event::EventKind;
use teul_core::storage::MemoryStorage;
use teul_core::time::{WorldTime, MINUTES_PER_DAY};

fn at(day: u64, minute: u64) -> WorldTime {
    WorldTime(day * MINUTES_PER_DAY + minute)
}

fn world() -> Core<MemoryStorage> {
    Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 5, epoch_unix_secs: common::AUTUMN_EPOCH }, Arc::new(common::media())).unwrap()
}

fn placed(core: &mut Core<MemoryStorage>, item: &str, x: i32) -> u32 {
    core.apply_all(at(0, 500), Command::Acquire { item: item.into() }).unwrap();
    let ev = core.apply_all(at(0, 500), Command::Place { item: item.into(), x, y: 3, rot: 0, wall: None, on: None }).unwrap();
    ev.iter().find_map(|e| match &e.kind {
        EventKind::Placed { pid, .. } => Some(*pid),
        _ => None,
    }).unwrap()
}

fn coins(core: &Core<MemoryStorage>) -> u64 {
    core.wallet().coins
}

#[test]
fn a_piece_is_known_by_heart_from_its_sheet_or_once_played() {
    let mut core = world();
    let piano = placed(&mut core, "piano_w", 1);
    let r = core.repertoire_view();
    assert!(r.iter().find(|p| p.id == "lullaby").unwrap().known);
    assert!(!r.iter().find(|p| p.id == "ode").unwrap().known);
    assert_eq!(core.apply_all(at(0, 600), Command::Play { pid: piano, piece: Some("ode".into()) }).err(), Some(CoreError::Needs("sheet_ode".into())));
    assert!(core.apply_all(at(0, 600), Command::Play { pid: piano, piece: Some("nope".into()) }).is_err());
    let before = coins(&core);
    core.apply_all(at(0, 600), Command::Play { pid: piano, piece: Some("lullaby".into()) }).unwrap();
    // nothing at home pays
    assert_eq!(coins(&core), before);
    core.apply_all(at(0, 605), Command::Travel { to: "bazaar".into() }).unwrap();
    core.apply_all(at(0, 606), Command::Use { station: "st.sheet_ode".into() }).unwrap();
    core.apply_all(at(0, 607), Command::Travel { to: "home".into() }).unwrap();
    core.apply_all(at(0, 620), Command::Play { pid: piano, piece: Some("ode".into()) }).unwrap();
    let ode = core.repertoire_view().into_iter().find(|p| p.id == "ode").unwrap();
    assert!(ode.known && ode.learned);
    assert_eq!(core.skills_view().iter().find(|k| k.id == "music").unwrap().practice, 2);
}

#[test]
fn playing_in_the_street_needs_the_town_a_carried_instrument_and_daylight() {
    let mut core = world();
    let t = at(0, 18 * 60);
    assert_eq!(core.apply_all(t, Command::Busk { piece: "lullaby".into(), instrument: "violin_m".into() }).err(), Some(CoreError::NotHere));
    core.apply_all(t, Command::Travel { to: "bazaar".into() }).unwrap();
    assert_eq!(core.apply_all(t, Command::Busk { piece: "lullaby".into(), instrument: "violin_m".into() }).err(), Some(CoreError::NotOwned("violin_m".into())));
    core.apply_all(t, Command::Acquire { item: "violin_m".into() }).unwrap();
    assert_eq!(core.apply_all(t, Command::Busk { piece: "lullaby".into(), instrument: "piano_w".into() }).err(), Some(CoreError::ActionNotAvailable));
    assert_eq!(core.apply_all(at(0, 23 * 60), Command::Busk { piece: "lullaby".into(), instrument: "violin_m".into() }).err(), Some(CoreError::Closed));
    let ev = core.apply_all(t, Command::Busk { piece: "lullaby".into(), instrument: "violin_m".into() }).unwrap();
    assert!(ev.iter().any(|e| matches!(e.kind, EventKind::Busked { .. })));
    assert_eq!(core.apply_all(at(0, 18 * 60 + 5), Command::Busk { piece: "lullaby".into(), instrument: "violin_m".into() }).err(), Some(CoreError::TooSoon));
}

#[test]
fn the_street_gives_only_so_much_a_day() {
    let mut core = world();
    core.apply_all(at(0, 8 * 60), Command::Acquire { item: "violin_m".into() }).unwrap();
    core.apply_all(at(0, 8 * 60), Command::Travel { to: "bazaar".into() }).unwrap();
    let start = coins(&core);
    let mut heard = 0;
    for k in 0..40u64 {
        let t = at(0, 8 * 60 + k * 21);
        if let Ok(ev) = core.apply_all(t, Command::Busk { piece: "lullaby".into(), instrument: "violin_m".into() }) {
            for e in ev {
                if let EventKind::Busked { listeners, .. } = e.kind {
                    heard += listeners;
                }
            }
        }
    }
    assert!(heard > 0, "someone stops to listen in a whole day");
    let got = coins(&core) - start;
    assert!(got > 0 && got <= u64::from(teul_core::media::BUSK_DAY_COINS), "got {got}");
    // the next day the town listens again
    let before = coins(&core);
    for k in 0..12u64 {
        let _ = core.apply_all(at(1, 17 * 60 + k * 21), Command::Busk { piece: "lullaby".into(), instrument: "violin_m".into() });
    }
    assert!(coins(&core) >= before);
}

#[test]
fn a_picture_can_be_printed_at_the_computer() {
    let mut core = world();
    let pc = placed(&mut core, "pc_m", 1);
    let pixels = "0".repeat(192);
    core.apply_all(at(0, 600), Command::Paint { pid: pc, title: "Кіт".into(), pixels }).unwrap();
    assert_eq!(core.paintings_view().len(), 1);
}

#[test]
fn the_same_world_hears_the_same_street() {
    let a = world();
    let b = world();
    for m in [9 * 60, 12 * 60, 18 * 60, 21 * 60 + 30] {
        assert_eq!(a.listeners_at(at(3, m)), b.listeners_at(at(3, m)));
    }
    assert_eq!(a.listeners_at(at(3, 3 * 60)), 0);
}

#[test]
fn a_record_goes_on_the_player_only_if_it_is_ones_own() {
    let mut core = world();
    let player = placed(&mut core, "gramophone_m", 1);
    assert_eq!(core.apply_all(at(0, 600), Command::SetProp { pid: player, key: "record".into(), value: "rec_m".into() }).err(), Some(CoreError::InvalidProp));
    core.apply_all(at(0, 600), Command::Travel { to: "bazaar".into() }).unwrap();
    core.apply_all(at(0, 601), Command::Use { station: "st.rec_m".into() }).unwrap();
    core.apply_all(at(0, 602), Command::Travel { to: "home".into() }).unwrap();
    core.apply_all(at(0, 603), Command::SetProp { pid: player, key: "record".into(), value: "rec_m".into() }).unwrap();
    core.apply_all(at(0, 604), Command::SetProp { pid: player, key: "station".into(), value: "classic".into() }).unwrap();
    assert_eq!(core.apply_all(at(0, 605), Command::SetProp { pid: player, key: "station".into(), value: "<script>".into() }).err(), Some(CoreError::InvalidProp));
}
