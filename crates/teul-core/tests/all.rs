//! All the core's tests in one program: each file in `tests/` is a module here, so the core is linked once,
//! not once per file. A new test file must be listed below; `every_file_is_here` checks it.

#[path = "aliases.rs"]
mod aliases;
#[path = "armor.rs"]
mod armor;
#[path = "base_content.rs"]
mod base_content;
#[path = "bills.rs"]
mod bills;
#[path = "bootstrap.rs"]
mod bootstrap;
#[path = "calendar_days.rs"]
mod calendar_days;
#[path = "calendar_quests.rs"]
mod calendar_quests;
#[path = "content.rs"]
mod content;
#[path = "content_ids_kept.rs"]
mod content_ids_kept;
#[path = "cooking.rs"]
mod cooking;
#[path = "core_flow.rs"]
mod core_flow;
#[path = "core_hardening.rs"]
mod core_hardening;
#[path = "craft.rs"]
mod craft;
#[path = "daily.rs"]
mod daily;
#[path = "determinism.rs"]
mod determinism;
#[path = "drive.rs"]
mod drive;
#[path = "dump.rs"]
mod dump;
#[path = "energy.rs"]
mod energy;
#[path = "feelings.rs"]
mod feelings;
#[path = "fridge.rs"]
mod fridge;
#[path = "garden.rs"]
mod garden;
#[path = "golden_saves.rs"]
mod golden_saves;
#[path = "growth.rs"]
mod growth;
#[path = "helps.rs"]
mod helps;
#[path = "home_more.rs"]
mod home_more;
#[path = "honesty.rs"]
mod honesty;
#[path = "hours.rs"]
mod hours;
#[path = "lang.rs"]
mod lang;
#[path = "life.rs"]
mod life;
#[path = "life_base.rs"]
mod life_base;
#[path = "life_days.rs"]
mod life_days;
#[path = "life_night.rs"]
mod life_night;
#[path = "media.rs"]
mod media;
#[path = "news_between.rs"]
mod news_between;
#[path = "npc.rs"]
mod npc;
#[path = "paper.rs"]
mod paper;
#[path = "perf.rs"]
mod perf;
#[path = "pocket.rs"]
mod pocket;
#[path = "quests.rs"]
mod quests;
#[path = "retired.rs"]
mod retired;
#[path = "rift.rs"]
mod rift;
#[path = "room_engine.rs"]
mod room_engine;
#[path = "room_rules.rs"]
mod room_rules;
#[path = "room_state.rs"]
mod room_state;
#[path = "room_v2.rs"]
mod room_v2;
#[path = "skills.rs"]
mod skills;
#[path = "sky.rs"]
mod sky;
#[path = "snapshots.rs"]
mod snapshots;
#[path = "stations.rs"]
mod stations;
#[path = "storage_contract.rs"]
mod storage_contract;
#[path = "style.rs"]
mod style;
#[path = "taxi_pricing.rs"]
mod taxi_pricing;
#[path = "town.rs"]
mod town;
#[path = "transfer.rs"]
mod transfer;
#[path = "travel.rs"]
mod travel;
#[path = "unlock.rs"]
mod unlock;
#[path = "variants_kept.rs"]
mod variants_kept;
#[path = "views.rs"]
mod views;
#[path = "warmth.rs"]
mod warmth;
#[path = "wider_world.rs"]
mod wider_world;
#[path = "work.rs"]
mod work;
#[path = "workshop.rs"]
mod workshop;

#[test]
fn every_file_is_here() {
    let me = include_str!("all.rs");
    let dir = concat!(env!("CARGO_MANIFEST_DIR"), "/tests");
    for e in std::fs::read_dir(dir).unwrap() {
        let name = e.unwrap().file_name().into_string().unwrap();
        if let Some(stem) = name.strip_suffix(".rs") {
            if stem != "all" {
                assert!(me.contains(&format!("\nmod {stem};\n")), "tests/{name} is not a module of tests/all.rs");
            }
        }
    }
}
