//! What the hands learn by doing (docs/world-economy.md §10): practice, levels in words, modest effects;
//! music at an instrument; a painting at an easel that hangs on the wall.

mod common;

use std::sync::Arc;

use teul_core::core::{Command, Core, CoreError, NewWorld};
use teul_core::event::EventKind;
use teul_core::skills::{level_of, level_word};
use teul_core::storage::MemoryStorage;
use teul_core::time::{WorldTime, MINUTES_PER_DAY};

fn at(day: u64, minute: u64) -> WorldTime {
    WorldTime(day * MINUTES_PER_DAY + minute)
}

fn world() -> Core<MemoryStorage> {
    Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 9, epoch_unix_secs: common::AUTUMN_EPOCH }, Arc::new(common::work())).unwrap()
}

fn placed(core: &mut Core<MemoryStorage>, item: &str, x: i32) -> u32 {
    core.apply_all(at(0, 500), Command::Acquire { item: item.into() }).unwrap();
    let ev = core.apply_all(at(0, 500), Command::Place { item: item.into(), x, y: 3, rot: 0, wall: None, on: None }).unwrap();
    ev.iter().find_map(|e| match &e.kind {
        EventKind::Placed { pid, .. } => Some(*pid),
        _ => None,
    }).unwrap()
}

#[test]
fn levels_grow_with_practice_and_are_said_in_words() {
    assert_eq!(level_of(0), 0);
    assert_eq!(level_word(0), "новачок");
    assert!(level_of(10) >= 1);
    assert!(level_of(200) == 3);
    assert_eq!(level_word(3), "майстер");
    assert!(level_of(9) <= level_of(10) && level_of(10) <= level_of(40));
}

#[test]
fn playing_an_instrument_is_practice_but_only_now_and_then() {
    let mut core = world();
    let piano = placed(&mut core, "piano_w", 1);
    let easel = placed(&mut core, "easel_w", 3);
    assert_eq!(core.apply_all(at(0, 600), Command::Play { pid: easel, piece: None }).err(), Some(CoreError::ActionNotAvailable));
    core.apply_all(at(0, 600), Command::Play { pid: piano, piece: None }).unwrap();
    // a minute later is the same sitting at the piano
    assert_eq!(core.apply_all(at(0, 601), Command::Play { pid: piano, piece: None }).err(), Some(CoreError::TooSoon));
    core.apply_all(at(0, 610), Command::Play { pid: piano, piece: None }).unwrap();
    let s = core.skills_view();
    let music = s.iter().find(|k| k.id == "music").unwrap();
    assert_eq!(music.practice, 2);
    assert_eq!(music.word, "новачок");
}

#[test]
fn a_painting_from_the_easel_becomes_a_canvas_to_hang() {
    let mut core = world();
    let easel = placed(&mut core, "easel_w", 1);
    let pixels: String = (0..192).map(|i| char::from_digit((i % 16) as u32, 16).unwrap()).collect();
    // a picture is 16×12 pixels of 16 colours
    assert!(core.apply_all(at(0, 600), Command::Paint { pid: easel, title: "Осінь".into(), pixels: "zz".into() }).is_err());
    let ev = core.apply_all(at(0, 601), Command::Paint { pid: easel, title: "Осінь у Липовому".into(), pixels: pixels.clone() }).unwrap();
    assert!(ev.iter().any(|e| matches!(&e.kind, EventKind::Painted { index: 0, .. })));
    assert_eq!(core.free_count("canvas_art"), 1);
    let p = core.paintings_view();
    assert_eq!(p.len(), 1);
    assert_eq!(p[0].title, "Осінь у Липовому");
    assert_eq!(p[0].pixels, pixels);
    // hung on the wall, it shows its picture
    let ev = core.apply_all(at(0, 602), Command::Place { item: "canvas_art".into(), x: 0, y: 0, rot: 0, wall: Some(teul_core::room::WallSide::North), on: None });
    assert!(ev.is_ok(), "the canvas hangs on a wall: {ev:?}");
    if let Ok(ev) = ev {
        let pid = ev.iter().find_map(|e| match &e.kind {
            EventKind::Placed { pid, .. } => Some(*pid),
            _ => None,
        }).unwrap();
        core.apply_all(at(0, 603), Command::SetProp { pid, key: "art".into(), value: "0".into() }).unwrap();
        assert!(core.apply_all(at(0, 604), Command::SetProp { pid, key: "art".into(), value: "7".into() }).is_err(), "no such painting");
    }
    assert_eq!(core.skills_view().iter().find(|k| k.id == "painting").unwrap().practice, 3);
}

#[test]
fn cooking_and_gardening_are_practice_too() {
    let mut core = Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 3, epoch_unix_secs: common::AUTUMN_EPOCH }, Arc::new(common::work())).unwrap();
    for (item, x) in [("fridge_h", 1), ("stove_h", 2), ("pot_plot", 4)] {
        core.apply_all(at(0, 500), Command::Acquire { item: item.into() }).unwrap();
        core.apply_all(at(0, 500), Command::Place { item: item.into(), x, y: 1, rot: 0, wall: None, on: None }).unwrap();
    }
    core.apply_all(at(0, 600), Command::Travel { to: "market".into() }).unwrap();
    for spot in ["hen1", "hen2", "cow1"] {
        core.apply_all(at(0, 601), Command::Gather { spot: spot.into() }).unwrap();
    }
    core.apply_all(at(0, 602), Command::Travel { to: "bazaar".into() }).unwrap();
    core.apply_all(at(0, 602), Command::Use { station: "st.seeds".into() }).unwrap();
    core.apply_all(at(0, 603), Command::Travel { to: "home".into() }).unwrap();
    core.apply_all(at(0, 604), Command::Cook { recipe: "rc.omelette".into() }).unwrap();
    let pot = core.state().room.placements.values().find(|p| p.item == "pot_plot").unwrap().pid;
    core.apply_all(at(0, 605), Command::Plant { pid: pot, seed: "seed_tomato".into() }).unwrap();
    let s = core.skills_view();
    assert_eq!(s.iter().find(|k| k.id == "cooking").unwrap().practice, 1);
    assert_eq!(s.iter().find(|k| k.id == "gardening").unwrap().practice, 1);
}

#[test]
fn a_rare_fish_comes_a_little_more_often_to_a_skilled_hand() {
    use teul_core::skills::fish_weight;
    // common fish keep their weight; rare ones (weight 1–2) grow with the level, modestly
    assert_eq!(fish_weight(9, 3), 9);
    assert_eq!(fish_weight(1, 0), 1);
    assert!(fish_weight(1, 3) > fish_weight(1, 1));
    assert!(fish_weight(1, 3) <= 4);
}
