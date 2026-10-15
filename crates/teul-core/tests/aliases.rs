//! Renamed content ids: an old save keeps opening, whole, after an update renames what it holds (`alias.rs`).

mod common;

use std::sync::Arc;

use teul_core::alias::Aliases;
use teul_core::content::Content;
use teul_core::core::{Command, Core, NewWorld};
use teul_core::storage::MemoryStorage;
use teul_core::time::WorldTime;

fn renamed(pack: &str) -> String {
    // the update: «sofa» is now «sofa_old_oak», and the pack says so
    let v = pack.replace("\"id\": \"sofa\"", "\"id\": \"sofa_old_oak\"");
    v.replacen("\"version\":", "\"aliases\": { \"sofa\": \"sofa_old_oak\" },\n \"version\":", 1)
}

fn played() -> MemoryStorage {
    let mut core = Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 3, epoch_unix_secs: common::AUTUMN_EPOCH }, Arc::new(common::content())).unwrap();
    core.apply_all(WorldTime(500), Command::Acquire { item: "sofa".into() }).unwrap();
    core.apply_all(WorldTime(501), Command::Place { item: "sofa".into(), x: 1, y: 1, rot: 0, wall: None, on: None }).unwrap();
    core.into_storage()
}

#[test]
fn an_old_save_opens_whole_after_an_id_is_renamed() {
    let storage = played();
    let pack = renamed(common::PACK);
    assert!(pack.contains("sofa_old_oak") && pack.contains("\"aliases\""));
    let content = Arc::new(Content::from_packs(&[&pack]).expect("the renamed pack is valid"));
    let core = Core::open_with(storage, 1, content).unwrap();
    assert_eq!(core.integrity().tampered, 0, "nothing of the old save is left out: {:?}", core.integrity());
    let room = core.room_view();
    assert!(room.placements.iter().any(|p| p.item == "sofa_old_oak"), "the sofa stands, under its new id");
    assert!(room.placements.iter().all(|p| p.item != "sofa"));
}

#[test]
fn without_the_alias_the_renamed_input_is_left_out() {
    let storage = played();
    let pack = common::PACK.replace("\"id\": \"sofa\"", "\"id\": \"sofa_old_oak\"");
    let content = Arc::new(Content::from_packs(&[&pack]).unwrap());
    let core = Core::open_with(storage, 1, content).unwrap();
    assert!(core.integrity().tampered > 0, "this is what the alias table is for");
}

#[test]
fn new_commands_with_an_old_id_name_the_current_one() {
    let pack = renamed(common::PACK);
    let content = Arc::new(Content::from_packs(&[&pack]).unwrap());
    let mut core = Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 3, epoch_unix_secs: common::AUTUMN_EPOCH }, content).unwrap();
    core.apply_all(WorldTime(500), Command::Acquire { item: "sofa".into() }).unwrap();
    core.apply_all(WorldTime(501), Command::Place { item: "sofa".into(), x: 1, y: 1, rot: 0, wall: None, on: None }).unwrap();
    assert!(core.room_view().placements.iter().any(|p| p.item == "sofa_old_oak"));
}

#[test]
fn aliases_resolve_chains_and_refuse_circles_and_live_ids() {
    let a = Aliases::new([("a_1".to_string(), "b_1".to_string()), ("b_1".to_string(), "c_1".to_string())].into()).unwrap();
    assert_eq!(a.resolve("a_1"), "c_1");
    assert_eq!(a.resolve("b_1"), "c_1");
    assert_eq!(a.resolve("zz"), "zz");
    assert!(Aliases::new([("a".to_string(), "b".to_string()), ("b".to_string(), "a".to_string())].into()).is_err());
    assert!(Aliases::new([("Ім'я".to_string(), "b".to_string())].into()).is_err());
    // an alias of an id that still exists, or to one that does not
    let live = common::PACK.replacen("\"version\":", "\"aliases\": { \"sofa\": \"table\" },\n \"version\":", 1);
    assert!(Content::from_packs(&[&live]).is_err());
    let nowhere = common::PACK.replacen("\"version\":", "\"aliases\": { \"old_thing\": \"no_such_thing\" },\n \"version\":", 1);
    assert!(Content::from_packs(&[&nowhere]).is_err());
}

#[test]
fn counts_of_merged_ids_add_up() {
    let a = Aliases::new([("old_cup".to_string(), "cup".to_string())].into()).unwrap();
    let v: std::collections::BTreeMap<String, u32> = [("old_cup".to_string(), 2), ("cup".to_string(), 3)].into();
    assert_eq!(a.apply(&v).get("cup"), Some(&5));
    let name = "old_cup is my nickname".to_string();
    assert_eq!(*a.apply(&name), name, "free text is never touched");
}
