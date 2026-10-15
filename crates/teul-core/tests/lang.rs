//! The language of the words never changes the world: the same inputs give the same events, chains and state
//! in Ukrainian and in English; and in English the core's own words carry no Cyrillic.

use std::sync::Arc;

use teul_core::content::{Content, Lang};
use teul_core::core::{Command, Core, NewWorld};
use teul_core::storage::{MemoryStorage, Storage};
use teul_core::time::{days_from_civil, WorldTime, MINUTES_PER_DAY};

const PACK: &str = include_str!("../../../content/base/pack.json");
const EN: &str = include_str!("../../../content/base/en.json");

fn uk() -> Content {
    Content::from_packs(&[PACK]).expect("the base pack is valid")
}

fn en() -> Content {
    Content::from_packs_in(&[PACK], Some(EN)).expect("the English overlay fits the base pack")
}

/// Midnight (Kyiv) of 1 October 2026: the plant's story, autumn feasts and the winter ahead.
fn epoch() -> i64 {
    days_from_civil(2026, 10, 1) * 86_400 - 3 * 3_600
}

fn world(content: Content) -> Core<MemoryStorage> {
    Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 11, epoch_unix_secs: epoch() }, Arc::new(content)).unwrap()
}

fn at(day: u64, minute: u64) -> WorldTime {
    WorldTime(day * MINUTES_PER_DAY + minute)
}

/// A long, varied play: travelling, stations, helps, quests, work, gathering, fishing, the garden, talk.
/// Every command is tried; failures are part of the outcome too (only their kind, not their words).
fn play(core: &mut Core<MemoryStorage>) -> Vec<String> {
    let c = core.content().clone();
    let mut out = Vec::new();
    let mut run = |core: &mut Core<MemoryStorage>, t: WorldTime, cmd: Command| {
        let r = core.apply_all(t, cmd);
        out.push(match r {
            Ok(events) => serde_json::to_string(&events).unwrap(),
            Err(e) => format!("err:{:?}", std::mem::discriminant(&e)),
        });
    };
    run(core, at(0, 8 * 60), Command::NamePlayer { name: "Orysia".into() });
    let locations: Vec<String> = c.locations.keys().cloned().collect();
    let stations: Vec<(String, String)> = c.stations.values().map(|s| (s.id.clone(), s.location.clone())).collect();
    let helps: Vec<String> = c.helps.keys().cloned().collect();
    let npcs: Vec<String> = c.npcs.keys().cloned().collect();
    let works: Vec<String> = c.work.keys().cloned().collect();
    for day in 0..6u64 {
        let mut minute = 8 * 60 + day;
        let tick = |m: &mut u64| {
            *m += 2;
            at(day, *m)
        };
        for loc in locations.iter().filter(|l| ["village", "forest", "lake", "home"].contains(&l.as_str())) {
            run(core, tick(&mut minute), Command::Travel { to: loc.clone() });
            for (st, _) in stations.iter().filter(|(_, sl)| sl == loc).take(12) {
                run(core, tick(&mut minute), Command::Use { station: st.clone() });
            }
            for spot in c.spots.keys().filter(|s| c.spot_location.get(*s) == Some(loc)).take(6) {
                run(core, tick(&mut minute), Command::Gather { spot: spot.clone() });
            }
            for place in c.fishing.keys().filter(|s| c.fishing_location.get(*s) == Some(loc)).take(2) {
                run(core, tick(&mut minute), Command::Fish { place: place.clone() });
            }
        }
        run(core, tick(&mut minute), Command::Travel { to: "village".into() });
        for h in helps.iter().take(10) {
            run(core, tick(&mut minute), Command::Help { help: h.clone() });
        }
        for n in npcs.iter() {
            run(core, tick(&mut minute), Command::Talk { npc: n.clone() });
            run(core, tick(&mut minute), Command::Deliver { npc: n.clone() });
        }
        let offers: Vec<String> = core.quests_view(tick(&mut minute)).offers.iter().map(|o| o.id.clone()).collect();
        for q in offers.iter().take(3) {
            run(core, tick(&mut minute), Command::QuestStart { quest: q.clone() });
            run(core, tick(&mut minute), Command::QuestStep { quest: q.clone(), choice: Some(0) });
        }
        for w in works.iter().take(2) {
            run(core, tick(&mut minute), Command::StartShift { work: w.clone() });
            for k in 0..4 {
                run(core, tick(&mut minute), Command::WorkStep { choice: k % 3 });
            }
            run(core, tick(&mut minute), Command::EndShift);
        }
        run(core, tick(&mut minute), Command::Interview { question: 0, answer: (day % 3) as u32 });
        run(core, tick(&mut minute), Command::Lesson);
        run(core, tick(&mut minute), Command::PayAll);
    }
    out
}

fn log_of(core: Core<MemoryStorage>) -> String {
    serde_json::to_string(&core.into_storage().events_after(None).unwrap()).unwrap()
}

#[test]
fn the_language_never_changes_an_outcome() {
    let (u, e) = (uk(), en());
    assert_eq!(u.fingerprint, e.fingerprint, "the overlay must not change the fingerprint");
    assert_eq!(e.lang, Lang::En);
    let (mut a, mut b) = (world(u), world(e));
    let (ra, rb) = (play(&mut a), play(&mut b));
    assert!(ra.iter().filter(|r| !r.starts_with("err:")).count() > 20, "the play does things");
    for (i, (x, y)) in ra.iter().zip(&rb).enumerate() {
        assert_eq!(x, y, "outcome {i} differs between the languages");
    }
    assert_eq!(serde_json::to_string(a.state()).unwrap(), serde_json::to_string(b.state()).unwrap());
    assert_eq!(log_of(a), log_of(b), "the same events and chains");
}

#[test]
fn switching_the_words_keeps_the_world_and_refuses_other_packs() {
    let mut core = world(uk());
    let before = serde_json::to_string(core.state()).unwrap();
    assert!(core.retext(Arc::new(en())));
    assert_eq!(core.lang(), Lang::En);
    assert_eq!(serde_json::to_string(core.state()).unwrap(), before);
    let other = Content::from_packs(&[&PACK.replace("\"start_coins\": 300", "\"start_coins\": 301")]).unwrap();
    assert!(!core.retext(Arc::new(other)), "different packs are refused");
}

fn cyrillic(s: &str) -> bool {
    s.chars().any(|c| ('\u{0400}'..='\u{04ff}').contains(&c))
}

fn check(what: &str, day: u64, json: String) {
    assert!(!cyrillic(&json), "{what} on day {day} has Cyrillic: …{}", snippet(&json));
}

fn snippet(json: &str) -> String {
    let i = json.char_indices().find(|(_, c)| ('\u{0400}'..='\u{04ff}').contains(c)).map(|(i, _)| i).unwrap_or(0);
    let start = json[..i].char_indices().rev().nth(80).map(|(k, _)| k).unwrap_or(0);
    json[start..].chars().take(200).collect()
}

#[test]
fn in_english_the_core_speaks_english() {
    assert!(!cyrillic(&en_overlay_gaps()), "the overlay leaves Cyrillic in the pack: {}", en_overlay_gaps());
    let core = world(en());
    let residents: Vec<String> = core.content().residents.keys().take(12).cloned().collect();
    // a year and a quarter, day by day: feasts, the sky, the plant, the town's changes
    for day in 0..460u64 {
        let noon = at(day, 12 * 60);
        let j = |v: &dyn erased::Ser| v.json();
        // the paper on feast days (the day before, the day, the clean-up), the plant's new steps, every fortnight
        let feast = core.festival_view(noon).is_some_and(|f| f.days_left <= 1);
        if day % 15 == 0 || feast || core.npp_view(noon).is_some_and(|v| core.calendar().date(noon) == v.since) {
            check("paper", day, j(&core.paper_view(at(day, 7 * 60))));
        }
        check("day", day, j(&core.day_view(noon)));
        check("calendar", day, j(&core.calendar_day(noon)));
        check("sky", day, j(&core.sky_view(at(day, 22 * 60))));
        check("sky stories", day, j(&core.sky_stories(noon)));
        check("plant", day, j(&core.npp_view(noon)));
        check("festival", day, j(&core.festival_view(noon)));
        check("driver stories", day, j(&core.driver_stories(day)));
        if day % 46 == 0 {
            check("feelings", day, j(&core.feelings_view(noon)));
            check("news", day, j(&core.news_between(at(day.saturating_sub(5), 0), noon)));
            check("growth", day, j(&core.growth_view(noon)));
            check("town", day, j(&core.town_view(noon)));
            check("bills", day, j(&core.bills_view(noon)));
            check("skills", day, j(&core.skills_view()));
            check("pets", day, j(&core.pets_view(noon)));
            check("garden", day, j(&core.garden_view(noon)));
            check("builds", day, j(&core.builds_view(noon)));
            check("works", day, j(&core.works_view(noon)));
            check("drive", day, j(&core.drive_view(noon)));
            for r in &residents {
                check("schedule", day, j(&core.schedule_of(r, noon)));
            }
        }
    }
}

/// Cyrillic left in the pack after the overlay (none when the English is complete).
fn en_overlay_gaps() -> String {
    let mut v: serde_json::Value = serde_json::from_str(PACK).unwrap();
    let o: serde_json::Value = serde_json::from_str(EN).unwrap();
    fn lay(t: &mut serde_json::Value, x: &serde_json::Value) {
        use serde_json::Value;
        match (t, x) {
            (Value::String(s), Value::String(e)) => *s = e.clone(),
            (Value::Object(m), Value::Object(o)) => {
                for (k, v) in o {
                    if let Some(t) = m.get_mut(k) {
                        lay(t, v);
                    }
                }
            }
            (Value::Array(a), Value::Object(o)) => {
                for (i, el) in a.iter_mut().enumerate() {
                    let key = el.get("id").and_then(Value::as_str).map(str::to_string).unwrap_or_else(|| i.to_string());
                    if let Some(v) = o.get(&key) {
                        lay(el, v);
                    }
                }
            }
            _ => {}
        }
    }
    lay(&mut v, &o["text"]);
    let s = v.to_string();
    if cyrillic(&s) { snippet(&s) } else { String::new() }
}

mod erased {
    pub trait Ser {
        fn json(&self) -> String;
    }
    impl<T: serde::Serialize> Ser for T {
        fn json(&self) -> String {
            serde_json::to_string(self).unwrap()
        }
    }
}
