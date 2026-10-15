mod common;

use std::sync::Arc;

use teul_core::content::Content;
use teul_core::core::{Core, NewWorld};
use teul_core::life::{tell, Activity, IncidentKind};
use teul_core::storage::MemoryStorage;
use teul_core::time::{WorldTime, MINUTES_PER_DAY};

const TOWN: &str = r##"{
  "schema": 1, "id": "town", "version": 1,
  "locations": [{
    "id": "town", "name": "Містечко", "w": 20, "h": 20, "tiles": [
      "gggggggggggggggggggg","gggggggggggggggggggg","gggggggggggggggggggg","gggggggggggggggggggg","gggggggggggggggggggg",
      "gggggggggggggggggggg","gggggggggggggggggggg","gggggggggggggggggggg","gggggggggggggggggggg","gggggggggggggggggggg",
      "gggggggggggggggggggg","gggggggggggggggggggg","gggggggggggggggggggg","gggggggggggggggggggg","gggggggggggggggggggg",
      "gggggggggggggggggggg","gggggggggggggggggggg","gggggggggggggggggggg","gggggggggggggggggggg","gggggggggggggggggggg"],
    "legend": { "g": "floor.oak" }, "entry": [0, 0],
    "sites": [
      { "id": "h1", "name": "Дім 1", "kind": "home", "x": 1, "y": 1, "building": [0, 0, 2, 2] },
      { "id": "h2", "name": "Дім 2", "kind": "home", "x": 4, "y": 1, "building": [3, 0, 2, 2] },
      { "id": "h3", "name": "Дім 3", "kind": "home", "x": 7, "y": 1, "building": [6, 0, 2, 2] },
      { "id": "shop", "name": "Крамниця", "kind": "grocery", "x": 1, "y": 5, "building": [0, 4, 2, 2], "price": 5, "stock": 30,
        "jobs": [{ "role": "seller", "from": 480, "to": 1200, "wage": 30 }] },
      { "id": "cafe", "name": "Кав'ярня", "kind": "cafe", "x": 4, "y": 5, "area": [3, 6, 3, 2], "price": 12,
        "jobs": [{ "role": "cook", "from": 420, "to": 1260, "wage": 30 }] },
      { "id": "school", "name": "Школа", "kind": "school", "x": 7, "y": 5, "area": [6, 6, 3, 2], "building": [6, 4, 3, 2],
        "jobs": [{ "role": "teacher", "from": 480, "to": 900, "days": [0, 1, 2, 3, 4], "wage": 35 }] },
      { "id": "hospital", "name": "Лікарня", "kind": "hospital", "x": 10, "y": 5, "building": [9, 4, 2, 2],
        "jobs": [{ "role": "doctor", "from": 480, "to": 1200, "wage": 40 }] },
      { "id": "police", "name": "Поліція", "kind": "police", "x": 13, "y": 5, "building": [12, 4, 2, 2],
        "jobs": [{ "role": "officer", "from": 480, "to": 1320, "wage": 35 }] },
      { "id": "firehall", "name": "Пожежна частина", "kind": "fire", "x": 16, "y": 5, "building": [15, 4, 2, 2],
        "jobs": [{ "role": "firefighter", "from": 0, "to": 1440, "wage": 35 }] },
      { "id": "saw", "name": "Пилорама", "kind": "sawmill", "x": 1, "y": 10, "area": [0, 11, 4, 3], "building": [0, 9, 3, 2],
        "jobs": [{ "role": "sawyer", "from": 420, "to": 1080, "days": [0, 1, 2, 3, 4, 5], "wage": 32 }] },
      { "id": "park", "name": "Парк", "kind": "park", "x": 10, "y": 12, "area": [8, 10, 6, 6] },
      { "id": "square", "name": "Площа", "kind": "square", "x": 15, "y": 12, "area": [14, 10, 4, 4] },
      { "id": "farm", "name": "Ферма", "kind": "farm", "x": 18, "y": 18 }
    ]
  }],
  "residents": [
    { "id": "r1", "name": "Оксана", "gender": "f", "age": "adult", "home": "h1", "job": ["shop", "seller"], "honesty": 90, "temper": 20, "social": 60 },
    { "id": "r2", "name": "Петро", "gender": "m", "age": "adult", "home": "h1", "job": ["saw", "sawyer"], "honesty": 20, "temper": 90, "social": 80 },
    { "id": "r3", "name": "Мирося", "gender": "f", "age": "child", "home": "h1", "school": "school", "honesty": 70, "temper": 40, "social": 70 },
    { "id": "r4", "name": "Іван", "gender": "m", "age": "adult", "home": "h2", "job": ["firehall", "firefighter"], "honesty": 80, "temper": 50, "social": 50 },
    { "id": "r5", "name": "Галина", "gender": "f", "age": "adult", "home": "h2", "job": ["hospital", "doctor"], "honesty": 95, "temper": 10, "social": 40 },
    { "id": "r6", "name": "Степан", "gender": "m", "age": "elder", "home": "h2", "honesty": 15, "temper": 85, "social": 90 },
    { "id": "r7", "name": "Василь", "gender": "m", "age": "adult", "home": "h3", "job": ["police", "officer"], "honesty": 90, "temper": 60, "social": 50 },
    { "id": "r8", "name": "Марко", "gender": "m", "age": "child", "home": "h3", "school": "school", "honesty": 30, "temper": 75, "social": 90 },
    { "id": "r9", "name": "Лідія", "gender": "f", "age": "adult", "home": "h3", "job": ["school", "teacher"], "honesty": 85, "temper": 30, "social": 60 },
    { "id": "r10", "name": "Богдан", "gender": "m", "age": "adult", "home": "h3", "honesty": 10, "temper": 95, "social": 85 }
  ]
}"##;

fn town(seed: u64) -> Core<MemoryStorage> {
    let content = Arc::new(Content::from_packs(&[common::PACK, TOWN]).expect("the town is valid"));
    Core::create_with(MemoryStorage::new(), 1, NewWorld { seed, epoch_unix_secs: 1_700_000_000 }, content).unwrap()
}

fn at(day: u64, minute: u64) -> WorldTime {
    WorldTime(day * MINUTES_PER_DAY + minute)
}

#[test]
fn the_same_seed_and_time_give_the_same_village_and_asking_step_by_step_changes_nothing() {
    let a = town(7);
    let b = town(7);
    for day in [1, 3, 5] {
        let _ = a.life_view(at(day, 600));
    }
    assert_eq!(a.life_view(at(6, 900)), b.life_view(at(6, 900)));
    // asking about an earlier time again still gives the same answer
    assert_eq!(a.life_view(at(2, 700)), b.life_view(at(2, 700)));
    assert_ne!(town(8).life_view(at(6, 900)).incidents, a.life_view(at(6, 900)).incidents);
}

#[test]
fn at_night_people_sleep_at_home_except_the_night_shift() {
    let core = town(3);
    let v = core.life_view(at(4, 3 * 60));
    for r in &v.residents {
        if r.id == "r4" {
            continue; // the firefighter is on duty all day and night
        }
        if matches!(r.activity, Activity::Sick | Activity::Injured | Activity::Arrested) {
            continue;
        }
        assert_eq!(r.activity, Activity::Sleep, "{} at 3am: {:?} at {}", r.name, r.activity, r.site);
        assert!(r.site.starts_with('h'), "{} sleeps at {}", r.name, r.site);
    }
}

#[test]
fn on_a_weekday_morning_children_are_at_school_and_workers_at_work() {
    let core = town(3);
    // a real school day (the calendar decides which days those are), at ten
    let day = (7..21).find(|d| core.day_view(at(*d, 10 * 60)).school).expect("a school day within two weeks");
    let t = at(day, 10 * 60);
    let v = core.life_view(t);
    let who = |id: &str| v.residents.iter().find(|r| r.id == id).unwrap();
    for id in ["r3", "r8"] {
        let r = who(id);
        if r.activity == Activity::School {
            assert_eq!(r.site, "school");
        } else {
            assert!(matches!(r.activity, Activity::Sick | Activity::Injured | Activity::Arrested), "{:?}", r.activity);
        }
    }
    // everyone whose plan has them at work now is there (each has their own days off and shifts)
    let mut due = 0;
    for r in &v.residents {
        let plan = core.schedule_of(&r.id, t).unwrap();
        if !plan.working_now || r.activity == Activity::School || matches!(r.activity, Activity::Sick | Activity::Injured | Activity::Arrested | Activity::Away) {
            continue;
        }
        due += 1;
        assert!(matches!(r.activity, Activity::Work | Activity::Firefight | Activity::Patrol), "{} should be at work: {:?} at {}", r.name, r.activity, r.site);
    }
    assert!(due >= 2, "some of the town works on a weekday morning: {due}");
}

#[test]
fn the_village_makes_its_own_stories_over_a_season() {
    let core = town(11);
    let mut kinds = std::collections::BTreeSet::new();
    for day in (7..112).step_by(7) {
        for i in core.life_view(at(day, 0)).incidents {
            kinds.insert(format!("{:?}", i.kind));
        }
    }
    for k in [IncidentKind::Ill, IncidentKind::Delivery] {
        assert!(kinds.contains(&format!("{k:?}")), "no {k:?} in {kinds:?}");
    }
    let dramatic = ["Theft", "Fight", "Fire"].iter().filter(|k| kinds.contains(**k)).count();
    assert!(dramatic >= 2, "a season should bring at least two of theft, fight, fire: {kinds:?}");
}

#[test]
fn what_happened_is_told_in_words_that_agree_with_who_did_it() {
    let content = Content::from_packs(&[common::PACK, TOWN]).unwrap();
    let theft = |who: &str| teul_core::life::Incident { minute: 0, kind: IncidentKind::Theft, site: "shop".into(), who: vec![who.into()] };
    assert!(tell(&theft("r2"), &content).contains("Петро поцупив"));
    assert!(tell(&theft("r1"), &content).contains("Оксана поцупила"));
    let ill = |who: &str| teul_core::life::Incident { minute: 0, kind: IncidentKind::Ill, site: "h1".into(), who: vec![who.into()] };
    assert!(tell(&ill("r1"), &content).contains("захворіла і пішла"));
    assert!(tell(&ill("r3"), &content).contains("лежить удома"), "a sick child stays home");
    let fight = |a: &str, b: &str| teul_core::life::Incident { minute: 0, kind: IncidentKind::Fight, site: "park".into(), who: vec![a.into(), b.into()] };
    assert!(tell(&fight("r2", "r6"), &content).contains("Обидва"));
    assert!(tell(&fight("r1", "r5"), &content).contains("Обидві"));
    assert!(tell(&fight("r1", "r2"), &content).contains("Обоє"));
    assert!(!tell(&theft("r2"), &content).contains("««"), "no quotes inside quotes");
}

#[test]
fn children_eat_from_the_family_pantry_and_still_go_out_to_play() {
    let core = town(3);
    let mut out = 0;
    for day in [5, 9, 13] {
        // a Saturday afternoon or two
        for minute in [15 * 60, 16 * 60 + 30] {
            let v = core.life_view(at(day, minute));
            out += v.residents.iter().filter(|r| r.age == "child" && r.activity == Activity::Leisure).count();
        }
    }
    assert!(out > 0, "children never go out to play");
}

#[test]
fn a_season_of_life_is_quick_to_compute() {
    let core = town(5);
    let started = std::time::Instant::now();
    let _ = core.life_view(at(120, 0));
    assert!(started.elapsed().as_millis() < 3000, "took {:?}", started.elapsed());
}
