//! Quests v2: stages (go, bring, use, cook, gather, wait, choose), calendar quests by the real year, the town's
//! daily jobs drawn from the day (the same for everyone, on replay too), and stations that keep the calendar.

mod common;

use std::sync::Arc;

use teul_core::content::Content;
use teul_core::core::{Command, Core, CoreError, NewWorld};
use teul_core::event::EventKind;
use teul_core::storage::MemoryStorage;
use teul_core::time::{WorldTime, MINUTES_PER_DAY};

const QUESTS: &str = include_str!("common/quests.json");

fn content() -> Content {
    Content::from_packs(&[common::PACK, common::ECONOMY, QUESTS]).expect("the quests pack is valid")
}

fn world() -> Core<MemoryStorage> {
    Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 3, epoch_unix_secs: common::AUTUMN_EPOCH }, Arc::new(content())).unwrap()
}

fn at(day: u64, minute: u64) -> WorldTime {
    WorldTime(day * MINUTES_PER_DAY + minute)
}

fn go(core: &mut Core<MemoryStorage>, t: WorldTime, to: &str) {
    core.apply_all(t, Command::Travel { to: to.into() }).unwrap();
}

fn start(core: &mut Core<MemoryStorage>, t: WorldTime, quest: &str) -> Result<Vec<teul_core::event::Event>, CoreError> {
    core.apply_all(t, Command::QuestStart { quest: quest.into() })
}

fn step(core: &mut Core<MemoryStorage>, t: WorldTime, quest: &str, choice: Option<u32>) -> Result<Vec<teul_core::event::Event>, CoreError> {
    core.apply_all(t, Command::QuestStep { quest: quest.into(), choice })
}

fn stage_of(core: &Core<MemoryStorage>, t: WorldTime, key: &str) -> Option<u32> {
    core.quests_view(t).active.iter().find(|q| q.key == key).map(|q| q.stage)
}

#[test]
fn a_quest_goes_through_its_stages_and_pays_at_the_end() {
    let mut core = world();
    // offered in the village
    assert_eq!(start(&mut core, at(0, 400), "q.story").err(), Some(CoreError::NotHere));
    go(&mut core, at(0, 401), "village");
    start(&mut core, at(0, 402), "q.story").unwrap();
    assert_eq!(start(&mut core, at(0, 403), "q.story").err(), Some(CoreError::AlreadyDone));
    // stage 0: be at the farm in the morning
    assert_eq!(step(&mut core, at(0, 404), "q.story", None).err(), Some(CoreError::NotHere));
    go(&mut core, at(0, 405), "farm");
    step(&mut core, at(0, 406), "q.story", None).unwrap();
    assert_eq!(stage_of(&core, at(0, 407), "q.story"), Some(1));
    // stage 1: shearing the sheep moves it on by itself
    let events = core.apply_all(at(0, 408), Command::Use { station: "st.farm.shear".into() }).unwrap();
    assert!(events.iter().any(|e| matches!(&e.kind, EventKind::QuestAdvanced { quest, stage: 1, .. } if quest == "q.story")));
    assert_eq!(stage_of(&core, at(0, 409), "q.story"), Some(2));
    // stage 2: bring the yarn to the village; a parcel comes back
    go(&mut core, at(0, 410), "village");
    step(&mut core, at(0, 411), "q.story", None).unwrap();
    assert_eq!(core.pocket_view().items.get("parcel"), Some(&1));
    assert_eq!(core.pocket_view().items.get("yarn"), None);
    // stage 3: a choice; the second option skips ahead to the waiting
    assert_eq!(step(&mut core, at(0, 412), "q.story", None).err(), Some(CoreError::NoRequest), "a choice needs a choice");
    let events = step(&mut core, at(0, 413), "q.story", Some(1)).unwrap();
    assert!(events.iter().any(|e| matches!(&e.kind, EventKind::QuestAdvanced { choice: Some(1), next: 4, .. })));
    assert_eq!(core.pocket_view().items.get("bread"), Some(&1));
    // stage 4: wait a day
    assert_eq!(step(&mut core, at(0, 414), "q.story", None).err(), Some(CoreError::TooSoon));
    let coins = core.wallet().coins;
    let events = step(&mut core, at(1, 600), "q.story", None).unwrap();
    assert!(events.iter().any(|e| matches!(&e.kind, EventKind::QuestDone { quest, .. } if quest == "q.story")));
    assert_eq!(core.wallet().coins, coins + 20);
    assert_eq!(core.pocket_view().items.get("bread"), Some(&2));
    let view = core.quests_view(at(1, 601));
    assert!(view.done.iter().any(|d| d.key == "q.story"));
    assert_eq!(view.reputation, 3);
    assert!(view.titles.contains(&"Друг Олі".to_string()));
    assert_eq!(core.npc_view(at(1, 602)).iter().find(|n| n.id == "olia").map(|n| n.points), Some(50));
}

#[test]
fn a_quest_waits_for_the_one_before_it() {
    let mut core = world();
    go(&mut core, at(0, 400), "village");
    assert!(matches!(start(&mut core, at(0, 401), "q.after").err(), Some(CoreError::Locked(_))));
    let offers = core.quests_view(at(0, 402)).offers;
    assert!(!offers.iter().any(|o| o.key == "q.after" && o.can_start));
}

#[test]
fn gathering_moves_a_gathering_stage_on() {
    let mut core = world();
    go(&mut core, at(0, 400), "village");
    start(&mut core, at(0, 401), "q.october@2026").unwrap();
    let events = core.apply_all(at(0, 402), Command::Gather { spot: "shroom".into() }).unwrap();
    assert!(events.iter().any(|e| matches!(&e.kind, EventKind::QuestDone { quest, .. } if quest == "q.october@2026")));
}

#[test]
fn calendar_quests_keep_to_their_dates() {
    let mut core = world();
    go(&mut core, at(0, 400), "village");
    let keys = |core: &Core<MemoryStorage>, t| core.quests_view(t).offers.iter().filter(|o| o.can_start).map(|o| o.key.clone()).collect::<Vec<_>>();
    // 10 October: October's mushrooms yes, Halloween not yet
    assert!(keys(&core, at(0, 401)).contains(&"q.october@2026".to_string()));
    assert!(!keys(&core, at(0, 401)).contains(&"q.halloween@2026".to_string()));
    assert!(start(&mut core, at(0, 402), "q.halloween@2026").is_err());
    // three days before Halloween it opens (day 18 = 28 October)
    assert!(keys(&core, at(18, 600)).contains(&"q.halloween@2026".to_string()));
    // the October window closed after the 15th
    assert!(!keys(&core, at(6, 600)).contains(&"q.october@2026".to_string()));
    // started and not done in time: missed, kindly
    start(&mut core, at(18, 601), "q.halloween@2026").unwrap();
    let late = core.quests_view(at(22, 600));
    assert!(late.missed.iter().any(|m| m.key == "q.halloween@2026"));
    assert!(late.active.iter().all(|q| q.key != "q.halloween@2026"));
    go(&mut core, at(22, 1100), "village");
    assert!(step(&mut core, at(22, 1101), "q.halloween@2026", None).is_err());
}

#[test]
fn the_days_jobs_are_drawn_the_same_for_everyone() {
    let a = world();
    let b = world();
    let mut any = 0;
    for day in 0..20 {
        let ja = a.jobs_today(at(day, 30));
        any += ja.len();
        let jb = b.jobs_today(at(day, 1300));
        assert_eq!(ja, jb, "day {day}");
        assert!(ja.len() <= 12, "day {day}: {} jobs", ja.len());
        // the sick-neighbour job needs someone ill: there are no residents here, so it never comes
        assert!(ja.iter().all(|j| j.template != "job.sick"));
        for j in &ja {
            assert!(j.key.starts_with(&format!("job:{day}:")));
            assert!(!j.title.contains('{') && !j.text.contains('{'), "{j:?}");
        }
    }
    assert!(any > 0, "things happen in town some days");
}

#[test]
fn a_job_is_taken_and_finished_by_its_deadline() {
    let mut core = world();
    go(&mut core, at(0, 400), "village");
    // find a day with the parcels job
    let (day, key) = (0..200)
        .find_map(|d| core.jobs_today(at(d, 0)).into_iter().find(|j| j.template == "job.parcels").map(|j| (d, j.key)))
        .expect("parcels come some day");
    let t = |m: u64| at(day, 400 + m);
    // only on its day
    if day > 0 {
        assert!(start(&mut core, at(day - 1, 500), &key).is_err());
    }
    start(&mut core, t(1), &key).unwrap();
    assert_eq!(core.pocket_view().items.get("parcel"), Some(&2));
    step(&mut core, t(2), &key, None).unwrap();
    go(&mut core, t(3), "farm");
    let coins = core.wallet().coins;
    let events = step(&mut core, t(4), &key, None).unwrap();
    assert!(events.iter().any(|e| matches!(&e.kind, EventKind::QuestDone { .. })));
    assert_eq!(core.wallet().coins, coins + 8);
    assert_eq!(core.pocket_view().items.get("parcel"), None);
}

#[test]
fn jobs_have_a_daily_limit_and_a_deadline() {
    let mut core = world();
    go(&mut core, at(0, 400), "village");
    let mut taken = 0;
    for day in 0..30u64 {
        for j in core.jobs_today(at(day, 0)) {
            if start(&mut core, at(day, 500 + taken), &j.key).is_ok() {
                taken += 1;
            }
        }
        if taken >= 7 {
            break;
        }
    }
    let view = core.quests_view(at(29, 600));
    // nobody hands more to someone already carrying so many promises (an invisible bound against bots)
    assert!(view.active.iter().filter(|q| q.kind == "job").count() <= teul_core::quests::MAX_ACTIVE_JOBS);
    // the deadline passes: they are missed
    let later = core.quests_view(at(40, 600));
    assert!(later.active.iter().all(|q| q.kind != "job"));
    assert!(!later.missed.is_empty());
}

#[test]
fn quests_replay_to_the_same_state() {
    let mut core = world();
    go(&mut core, at(0, 400), "village");
    start(&mut core, at(0, 401), "q.story").unwrap();
    go(&mut core, at(0, 402), "farm");
    step(&mut core, at(0, 403), "q.story", None).unwrap();
    core.apply_all(at(0, 404), Command::Use { station: "st.farm.shear".into() }).unwrap();
    let before = core.quests_view(at(0, 405));
    let reopened = Core::open_with(core.into_storage(), 1, Arc::new(content())).unwrap();
    assert_eq!(reopened.integrity().tampered, 0);
    assert_eq!(reopened.quests_view(at(0, 405)), before);
}

#[test]
fn stations_keep_the_calendar() {
    let mut core = world();
    go(&mut core, at(0, 400), "village");
    // 10 October 2026 is a Saturday: the weekday post is shut
    assert_eq!(core.apply_all(at(0, 600), Command::Use { station: "st.village.weekday".into() }).err(), Some(CoreError::Closed));
    core.apply_all(at(2, 600), Command::Use { station: "st.village.weekday".into() }).unwrap();
    // the fair is there on Halloween only
    assert_eq!(core.apply_all(at(20, 600), Command::Use { station: "st.village.fair".into() }).err(), Some(CoreError::Closed));
    core.apply_all(at(21, 600), Command::Use { station: "st.village.fair".into() }).unwrap();
    // on Christmas (day 76) the shops rest; the day after they open
    assert_eq!(core.apply_all(at(76, 600), Command::Use { station: "st.village.bakery".into() }).err(), Some(CoreError::Closed));
    core.apply_all(at(77, 600), Command::Use { station: "st.village.bakery".into() }).unwrap();
}

#[test]
fn coins_never_come_from_home() {
    let bad = r#"{ "schema": 1, "id": "bad", "version": 1, "quests": [ { "id": "q.home", "title": "x", "giver": "olia", "giver_name": "Оля", "offer": "home", "intro": "x",
      "stages": [{ "text": "x", "act": { "do": "go", "location": "home" } }], "reward": { "coins": 50 } } ] }"#;
    assert!(Content::from_packs(&[common::PACK, common::ECONOMY, bad]).is_err());
}

#[test]
fn a_job_taken_replays_the_same_on_open() {
    let mut core = world();
    go(&mut core, at(0, 400), "village");
    let (day, key) = (0..200)
        .find_map(|d| core.jobs_today(at(d, 0)).into_iter().find(|j| j.template == "job.parcels").map(|j| (d, j.key)))
        .expect("parcels come some day");
    assert!(key.starts_with(&format!("job:{day}:job.parcels:")));
    start(&mut core, at(day, 500), &key).unwrap();
    step(&mut core, at(day, 501), &key, None).unwrap();
    let before = core.quests_view(at(day, 502));
    let reopened = Core::open_with(core.into_storage(), 1, Arc::new(content())).unwrap();
    assert_eq!(reopened.integrity().tampered, 0);
    assert_eq!(reopened.quests_view(at(day, 502)), before);
}
