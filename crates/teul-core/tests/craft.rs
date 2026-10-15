//! Things at home grow old and are mended; things are made at a workbench with tools that wear; new things come to
//! the town over real time (docs/world-economy.md §14).

mod common;

use std::sync::Arc;

use teul_core::core::{Command, Core, CoreError, NewWorld};
use teul_core::event::EventKind;
use teul_core::storage::MemoryStorage;
use teul_core::time::{WorldTime, MINUTES_PER_DAY};

fn at(day: u64, minute: u64) -> WorldTime {
    WorldTime(day * MINUTES_PER_DAY + minute)
}

fn place(core: &mut Core<MemoryStorage>, t: WorldTime, item: &str, x: i32) -> u32 {
    let ev = core.apply_all(t, Command::Place { item: item.into(), x, y: 2, rot: 0, wall: None, on: None }).unwrap();
    ev.iter().find_map(|e| match &e.kind {
        EventKind::Placed { pid, .. } => Some(*pid),
        _ => None,
    }).unwrap()
}

/// A home with materials and a hammer, a stool and a lamp placed on day 0 (pids: stool, lamp, bench or 0).
fn world(bench: bool) -> (Core<MemoryStorage>, u32, u32, u32) {
    let mut core = Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 9, epoch_unix_secs: common::AUTUMN_EPOCH }, Arc::new(common::craft())).unwrap();
    core.apply_all(at(0, 500), Command::ClaimKit { kit: "mats".into() }).unwrap();
    let stool = place(&mut core, at(0, 501), "stool_c", 1);
    let lamp = place(&mut core, at(0, 502), "lamp_c", 3);
    let b = if bench { place(&mut core, at(0, 503), "bench_c", 5) } else { 0 };
    (core, stool, lamp, b)
}

fn stage(core: &Core<MemoryStorage>, t: WorldTime, pid: u32) -> u32 {
    core.wear_view(t).into_iter().find(|w| w.pid == pid).unwrap().stage
}

#[test]
fn things_age_by_the_real_days_and_by_use() {
    let (mut core, stool, lamp, _) = world(false);
    assert_eq!(stage(&core, at(0, 600), stool), 0);
    // by the days alone it turns used, worn, broken (with a little luck of its own either way)
    let day_of = |core: &Core<MemoryStorage>, pid: u32, s: u32| (0..200).find(|d| stage(core, at(*d, 600), pid) >= s).unwrap();
    let (used, worn, broken) = (day_of(&core, stool, 1), day_of(&core, stool, 2), day_of(&core, stool, 3));
    assert!(used >= 17 && used <= 24 && worn > used && broken > worn && broken <= 72, "{used} {worn} {broken}");
    let w = core.wear_view(at(broken, 600)).into_iter().find(|w| w.pid == stool).unwrap();
    assert!(w.broken && w.looks == "зламаний" && w.fix == 40, "{w:?}");
    // sitting on it wears it faster: a few sits a day bring the day nearer
    for k in 0..4 {
        core.apply_all(at(1, 600 + k * 30), Command::Perform { action: "sit".into(), pid: Some(stool) }).unwrap();
    }
    assert!(day_of(&core, stool, 1) < used);
    // the lamp ages on its own schedule; a wall or a rug never ages (they have no profile)
    assert!(day_of(&core, lamp, 1) < used);
}

#[test]
fn a_broken_thing_refuses_in_its_own_words() {
    let (mut core, stool, _, _) = world(false);
    let late = at(90, 600);
    assert_eq!(stage(&core, late, stool), 3);
    assert_eq!(core.apply_all(late, Command::Perform { action: "sit".into(), pid: Some(stool) }).err(), Some(CoreError::Broken("Сісти страшно".into())));
}

#[test]
fn hands_mend_with_a_kit_and_a_tool_but_a_broken_one_needs_skill_or_a_master() {
    let (mut core, stool, lamp, _) = world(false);
    core.apply_all(at(0, 510), Command::ClaimKit { kit: "kits".into() }).unwrap();
    // the lamp dims first: it needs a ladder (and a bulb, not a kit)
    let dim = (0..200).find(|d| stage(&core, at(*d, 600), lamp) == 1).unwrap();
    assert_eq!(core.apply_all(at(dim, 602), Command::Repair { pid: lamp }).err(), Some(CoreError::Needs("ladder".into())));
    core.apply_all(at(dim, 603), Command::ClaimKit { kit: "ladder".into() }).unwrap();
    core.apply_all(at(dim, 604), Command::Repair { pid: lamp }).unwrap();
    assert_eq!(core.pocket_view().items.get("bulb"), None);
    assert_eq!(stage(&core, at(dim, 605), lamp), 0);
    let worn = (0..200).find(|d| stage(&core, at(*d, 600), stool) == 2).unwrap();
    let t = at(worn, 600);
    // a worn stool: a kit from the pocket and the hammer make it new again
    let ev = core.apply_all(t, Command::Repair { pid: stool }).unwrap();
    assert!(ev.iter().any(|e| matches!(&e.kind, EventKind::Repaired { by, coins: 0, .. } if by == "hands")), "{ev:?}");
    assert!(ev.iter().any(|e| matches!(&e.kind, EventKind::ToolUsed { item, broke: false } if item == "hammer")));
    assert_eq!(stage(&core, at(worn, 601), stool), 0);
    assert_eq!(core.pocket_view().items.get("kit_r"), Some(&1));
    // broken, and the hands are new to it: only a master will do — called by phone, paid in coins
    let gone = (worn..400).find(|d| stage(&core, at(*d, 600), stool) == 3).unwrap();
    let t = at(gone, 600);
    assert_eq!(core.apply_all(t, Command::Repair { pid: stool }).err(), Some(CoreError::Needs("master".into())));
    assert_eq!(core.apply_all(t, Command::CallMaster { pid: stool }).err(), Some(CoreError::Needs("phone".into())));
    core.apply_all(t, Command::ClaimKit { kit: "phone".into() }).unwrap();
    // masters come by day
    assert_eq!(core.apply_all(at(gone, 22 * 60), Command::CallMaster { pid: stool }).err(), Some(CoreError::Closed));
    let before = core.wallet().coins;
    core.apply_all(t, Command::CallMaster { pid: stool }).unwrap();
    assert_eq!(core.wallet().coins, before - 40);
    assert_eq!(stage(&core, at(gone, 601), stool), 0);
}

#[test]
fn tools_wear_out_and_go() {
    let (mut core, _, _, _) = world(true);
    // the hammer serves three times: the third use is its last
    core.apply_all(at(0, 600), Command::Craft { recipe: "c.kit".into() }).unwrap();
    assert_eq!(core.tools_view()[0].words, "у ділі");
    let ev = core.apply_all(at(0, 601), Command::Craft { recipe: "c.stool".into() }).unwrap();
    assert!(ev.iter().any(|e| matches!(&e.kind, EventKind::ToolUsed { broke: false, .. })));
    assert_eq!(core.tools_view()[0].words, "ледь тримається");
    // one more plank and nails: the third use is the hammer's last
    core.apply_all(at(0, 602), Command::ClaimKit { kit: "more".into() }).unwrap();
    let ev = core.apply_all(at(0, 603), Command::Craft { recipe: "c.kit".into() }).unwrap();
    assert!(ev.iter().any(|e| matches!(&e.kind, EventKind::ToolUsed { item, broke: true } if item == "hammer")), "{ev:?}");
    assert!(core.tools_view().is_empty());
    // without a hammer nothing more is made with one
    core.apply_all(at(0, 604), Command::ClaimKit { kit: "kits".into() }).unwrap();
    assert_eq!(core.apply_all(at(0, 605), Command::Craft { recipe: "c.kit".into() }).err(), Some(CoreError::Needs("hammer".into())));
}

#[test]
fn a_workbench_makes_what_one_knows_and_trying_finds_the_rest() {
    let (mut core, _, _, _) = world(false);
    // no bench at home: nothing is made
    assert_eq!(core.apply_all(at(0, 600), Command::Craft { recipe: "c.stool".into() }).err(), Some(CoreError::Needs("workbench".into())));
    place(&mut core, at(0, 601), "bench_c", 5);
    assert!(core.crafts_view(at(0, 602)).bench);
    // the stool is known from the start; the stool made goes home as furniture
    let ev = core.apply_all(at(0, 603), Command::Craft { recipe: "c.stool".into() }).unwrap();
    assert!(ev.iter().any(|e| matches!(&e.kind, EventKind::Crafted { gave, learned: false, .. } if gave == &vec!["stool_c".to_string()])));
    assert_eq!(core.inventory_view().into_iter().find(|i| i.item == "stool_c").unwrap().free, 1);
    // the mug nobody taught: unknown, and not made by name
    let known: Vec<String> = core.crafts_view(at(0, 604)).known.into_iter().map(|c| c.id).collect();
    assert!(!known.contains(&"c.mug".to_string()));
    assert_eq!(core.apply_all(at(0, 604), Command::Craft { recipe: "c.mug".into() }).err(), Some(CoreError::NotLearned("c.mug".into())));
    // a try that is nothing: the clay stays whole
    assert_eq!(core.apply_all(at(0, 605), Command::Tinker { items: vec![("clay".into(), 1)] }).err(), Some(CoreError::Fizzled));
    assert_eq!(core.pocket_view().items.get("clay"), Some(&2));
    // two lumps of clay: a mug, and now it is known
    let ev = core.apply_all(at(0, 606), Command::Tinker { items: vec![("clay".into(), 2)] }).unwrap();
    assert!(ev.iter().any(|e| matches!(&e.kind, EventKind::Crafted { recipe, learned: true, .. } if recipe == "c.mug")));
    assert!(core.crafts_view(at(0, 607)).known.iter().any(|c| c.id == "c.mug"));
    assert_eq!(core.pocket_view().items.get("mug_c"), Some(&1));
    // a book on the keyring teaches what is in it
    assert!(!core.crafts_view(at(0, 608)).known.iter().any(|c| c.id == "c.book"));
    core.apply_all(at(0, 608), Command::ClaimKit { kit: "book".into() }).unwrap();
    assert!(core.crafts_view(at(0, 609)).known.iter().any(|c| c.id == "c.book"));
    // one cannot offer what one does not have
    assert_eq!(core.apply_all(at(0, 610), Command::Tinker { items: vec![("feather".into(), 1)] }).err(), Some(CoreError::NotEnough));
}

#[test]
fn the_same_world_replays_to_the_same_wear_and_crafts() {
    let (mut core, stool, _, _) = world(true);
    core.apply_all(at(3, 600), Command::Craft { recipe: "c.kit".into() }).unwrap();
    core.apply_all(at(30, 600), Command::Repair { pid: stool }).unwrap();
    let view = core.wear_view(at(40, 600));
    let storage = core.into_storage();
    let again = Core::open_with(storage, 1, Arc::new(common::craft())).unwrap();
    assert_eq!(again.wear_view(at(40, 600)), view);
}

#[test]
fn smartphones_spread_through_the_town_young_first_old_last_some_never() {
    use teul_core::tech::{has_laptop, has_phone, phone_day, PHONES_FROM};
    let people: Vec<(String, &str)> = (0..300).map(|i| (format!("res_{i}"), ["adult", "adult", "elder", "child"][i % 4])).collect();
    let share = |age: &str, day: u64| {
        let of: Vec<_> = people.iter().filter(|(_, a)| *a == age).collect();
        of.iter().filter(|(id, a)| has_phone(7, id, a, day)).count() * 100 / of.len()
    };
    // nobody before the counter opens
    assert_eq!(share("adult", PHONES_FROM - 1), 0);
    // the grown-ups first, the old last
    assert!(share("adult", 90) > share("elder", 90), "{} {}", share("adult", 90), share("elder", 90));
    assert!(share("adult", 200) >= 80);
    // some never
    assert!(share("elder", 2000) < 90 && share("elder", 2000) > 30);
    // the same on every device
    assert_eq!(phone_day(7, "res_5", "adult"), phone_day(7, "res_5", "adult"));
    assert_ne!((0..50).map(|i| phone_day(7, &format!("res_{i}"), "adult")).collect::<Vec<_>>(), (0..50).map(|i| phone_day(8, &format!("res_{i}"), "adult")).collect::<Vec<_>>());
    // laptops: grown-ups only, about a third
    let laptops = people.iter().filter(|(id, a)| has_laptop(7, id, a, 400)).count();
    assert!(people.iter().filter(|(id, a)| *a != "adult" && has_laptop(7, id, a, 400)).count() == 0);
    assert!(laptops > 30 && laptops < 80, "{laptops}");
}
