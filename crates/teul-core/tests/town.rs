//! A town that lives on: birthdays and gifts, dinner invitations and friends dropping by, people who remember,
//! families that come and go, babies, the old passing away, community projects built over real days, shops that
//! open, and the rare day (a storm, a wedding, a fair). Everything from the seed and the calendar.

mod common;

use std::collections::BTreeSet;
use std::sync::Arc;

use teul_core::content::Content;
use teul_core::core::{Command, Core, CoreError, NewWorld};
use teul_core::event::EventKind;
use teul_core::storage::MemoryStorage;
use teul_core::time::{days_from_civil, WorldTime, MINUTES_PER_DAY};
use teul_core::town;

const TOWN: &str = include_str!("common/town.json");
/// 2026-10-10 (world day 0).
const FIRST_DAY: i64 = 20_736;

fn content() -> Content {
    Content::from_packs(&[common::PACK, TOWN]).expect("the town pack is valid")
}

fn world(seed: u64) -> Core<MemoryStorage> {
    Core::create_with(MemoryStorage::new(), 1, NewWorld { seed, epoch_unix_secs: common::AUTUMN_EPOCH }, Arc::new(content())).unwrap()
}

fn at(day: u64, minute: u64) -> WorldTime {
    WorldTime(day * MINUTES_PER_DAY + minute)
}

/// The world day of the next (month, day) from the world's first day on.
fn day_of(month: u32, d: u32) -> u64 {
    for year in 2026..2030 {
        let date = days_from_civil(year, month, d);
        if date >= FIRST_DAY {
            return (date - FIRST_DAY) as u64;
        }
    }
    unreachable!()
}

fn go(core: &mut Core<MemoryStorage>, t: WorldTime, to: &str) {
    core.apply_all(t, Command::Travel { to: to.into() }).unwrap();
}

fn buy(core: &mut Core<MemoryStorage>, t: WorldTime, station: &str) {
    core.apply_all(t, Command::Use { station: station.into() }).unwrap();
}

fn points(core: &Core<MemoryStorage>, who: &str) -> u32 {
    core.state().relations.get(who).map_or(0, |r| r.points)
}

#[test]
fn everyone_has_a_birthday_of_their_own_and_it_stays_put() {
    let c = content();
    let mut dates = BTreeSet::new();
    for id in c.residents.keys() {
        let (m, d) = town::birthday(3, id);
        assert!((1..=12).contains(&m) && (1..=31).contains(&d), "{id}: {m}-{d}");
        assert_eq!(town::birthday(3, id), (m, d), "the same every time");
        dates.insert((m, d));
    }
    assert!(dates.len() >= c.residents.len() - 2, "birthdays spread over the year: {dates:?}");
}

#[test]
fn on_a_birthday_the_player_wishes_them_well_once_with_a_gift() {
    let mut core = world(3);
    let (m, d) = town::birthday(3, "r.olha");
    let day = day_of(m, d);
    // not today: not her birthday the day before
    if day > 0 {
        go(&mut core, at(day - 1, 600), "village");
        assert!(matches!(core.apply_all(at(day - 1, 601), Command::Congratulate { who: "r.olha".into(), gift: None }), Err(CoreError::NotToday)));
    }
    let t = at(day, 11 * 60);
    go(&mut core, t, "village");
    buy(&mut core, t, "st.cakes");
    let today = core.town_view(t);
    assert!(today.today.birthdays.iter().any(|p| p.id == "r.olha"), "her birthday shows in the town today");
    let before = points(&core, "r.olha");
    let events = core.apply_all(t, Command::Congratulate { who: "r.olha".into(), gift: Some("cake".into()) }).unwrap();
    assert!(events.iter().any(|e| matches!(&e.kind, EventKind::Congratulated { who, gift: Some(g), .. } if who == "r.olha" && g == "cake")));
    assert!(points(&core, "r.olha") > before, "the wish warms the friendship");
    assert_eq!(core.free_count("cake"), 0, "the cake was given");
    assert!(matches!(core.apply_all(at(day, 11 * 60 + 5), Command::Congratulate { who: "r.olha".into(), gift: None }), Err(CoreError::AlreadyDone)));
    // she remembers it
    let bond = core.town_view(at(day, 12 * 60)).bonds.into_iter().find(|b| b.id == "r.olha").expect("a bond with her");
    assert!(bond.memories.iter().any(|m| m == "birthday"), "{:?}", bond.memories);
}

#[test]
fn gifts_go_to_anyone_in_town_and_tastes_differ() {
    let mut core = world(3);
    let t = at(1, 11 * 60);
    go(&mut core, t, "village");
    buy(&mut core, t, "st.cakes");
    let before = points(&core, "r.stepan");
    core.apply_all(t, Command::Gift { npc: "r.stepan".into(), item: "cake".into() }).unwrap();
    assert!(points(&core, "r.stepan") > before);
    // one gift a day to the same person
    buy(&mut core, t, "st.cakes");
    assert!(matches!(core.apply_all(at(1, 11 * 60 + 2), Command::Gift { npc: "r.stepan".into(), item: "cake".into() }), Err(CoreError::TooSoon)));
    let tastes: BTreeSet<_> = content().residents.keys().map(|id| town::tastes(3, id).0).collect();
    assert!(tastes.len() > 1, "not everyone likes the same things");
}

/// Makes a warm friend of someone: a gift every day for a fortnight.
fn befriend(core: &mut Core<MemoryStorage>, who: &str, days: u64) {
    for day in 0..days {
        let t = at(day, 10 * 60);
        go(core, t, "village");
        buy(core, t, "st.cakes");
        core.apply_all(at(day, 10 * 60 + 1), Command::Gift { npc: who.into(), item: "cake".into() }).unwrap();
    }
}

#[test]
fn friends_invite_the_player_to_dinner_and_the_door_opens_only_then() {
    let mut core = world(5);
    let nina = cake_lover(5);
    let nina = nina.as_str();
    befriend(&mut core, nina, 12);
    assert!(points(&core, nina) >= town::INVITE_POINTS);
    // the guest's house is shut without an invitation
    assert!(matches!(core.apply_all(at(12, 600), Command::Travel { to: "guest_home".into() }), Err(CoreError::NotInvited)));
    // an invitation comes within some weeks
    let mut found = None;
    for day in 12..80 {
        if let Some(inv) = core.town_view(at(day, 8 * 60)).invitations.into_iter().find(|i| i.host == nina && i.day == day) {
            found = Some(inv);
            break;
        }
    }
    let inv = found.expect("an invitation to dinner within ten weeks");
    let t = at(inv.day, u64::from(inv.from) + 10);
    go(&mut core, t, "guest_home");
    let before = points(&core, nina);
    let events = core.apply_all(t, Command::Dine { host: nina.into() }).unwrap();
    assert!(events.iter().any(|e| matches!(&e.kind, EventKind::Dined { host, .. } if host == nina)));
    assert!(points(&core, nina) > before);
    assert!(matches!(core.apply_all(at(inv.day, u64::from(inv.from) + 20), Command::Dine { host: nina.into() }), Err(CoreError::AlreadyDone)));
    let view = core.town_view(at(inv.day, u64::from(inv.from) + 30));
    assert!(view.invitations.iter().any(|i| i.host == nina && i.day == inv.day && i.done));
}

/// Someone of the town who does not mind cake (gifts of it warm them up).
fn cake_lover(seed: u64) -> String {
    content()
        .residents
        .keys()
        .find(|id| !["sweet", "food"].contains(&town::tastes(seed, id).2) && !id.contains("priest") && !id.contains("clerk") && *id != "r.ostap")
        .cloned()
        .expect("someone who does not mind cake")
}

#[test]
fn warm_friends_drop_by_now_and_then() {
    let mut core = world(7);
    let friend = cake_lover(7);
    befriend(&mut core, &friend, 18);
    assert!(points(&core, &friend) >= town::VISIT_POINTS);
    let mut visits = 0;
    for day in 18..90 {
        if let Some(v) = core.town_view(at(day, 18 * 60 + 40)).visitor {
            assert_eq!(v.id, friend);
            visits += 1;
        }
    }
    assert!(visits >= 2 && visits <= 20, "a friend comes round now and then, not every day: {visits}");
}

#[test]
fn people_come_and_go_over_the_years_the_same_way_every_time() {
    let a = world(11);
    let b = world(11);
    let ids = |core: &Core<MemoryStorage>, day: u64| core.town_people(at(day, 600)).into_iter().map(|r| (r.id, r.age, r.pram)).collect::<Vec<_>>();
    for day in [0, 30, 100, 400, 800, 1200] {
        assert_eq!(ids(&a, day), ids(&b, day), "day {day}");
    }
    // the newcomers arrive a few weeks in
    assert!(!ids(&a, 10).iter().any(|(id, ..)| id == "r.ostap"));
    assert!(ids(&a, 80).iter().any(|(id, ..)| id == "r.ostap"));
    // the priest and the clerk are rooted: they stay
    for day in [400, 800, 1200] {
        let now = ids(&a, day);
        assert!(now.iter().any(|(id, ..)| id == "r.priest") && now.iter().any(|(id, ..)| id == "r.clerk"));
    }
    // children grow up
    let grown = a.town_people(at(20 * 366, 600)).into_iter().find(|r| r.id == "r.mykola");
    assert!(grown.is_none_or(|r| r.age != "child"), "after twenty years Mykolka is no child");
    // what changed is told
    let changes = a.town_changes(at(0, 0), at(1100, 0));
    assert!(changes.iter().any(|c| c.kind == "arrived"));
    let passed = changes.iter().filter(|c| c.kind == "passed").count();
    assert!(passed <= 4, "the old pass away rarely: {passed} in three years");
}

#[test]
fn a_community_project_is_funded_built_in_stages_and_stays() {
    let mut core = world(3);
    let t = at(0, 10 * 60);
    go(&mut core, t, "village");
    for _ in 0..3 {
        buy(&mut core, t, "st.planks");
    }
    // only at the town hall
    assert!(matches!(
        core.apply_all(t, Command::Contribute { project: "proj.playground".into(), coins: 50, items: vec![] }),
        Err(CoreError::NotHere)
    ));
    let t2 = at(0, 10 * 60 + 5);
    go(&mut core, t2, "townhall_in");
    let events = core.apply_all(t2, Command::Contribute { project: "proj.playground".into(), coins: 250, items: vec![("plank".into(), 3)] }).unwrap();
    assert!(events.iter().any(|e| matches!(&e.kind, EventKind::Contributed { project, coins: 250, .. } if project == "proj.playground")));
    assert_eq!(core.free_count("plank"), 0);
    let v = core.town_view(t2);
    let p = v.projects.iter().find(|p| p.id == "proj.playground").unwrap();
    assert_eq!(p.status, "open");
    assert!(p.coins_have >= 250);
    // the town brings the rest; then a fence, then the building, then it is there for good
    let mut seen = Vec::new();
    for day in 1..30 {
        let v = core.town_view(at(day, 12 * 60));
        let p = v.projects.iter().find(|p| p.id == "proj.playground").unwrap();
        let tag = format!("{}:{}", p.status, p.stage_index);
        if seen.last() != Some(&tag) {
            seen.push(tag);
        }
        if p.status == "building" {
            assert!(v.flags.iter().any(|f| f == "project:proj.playground:building"));
        }
    }
    assert_eq!(seen, vec!["open:0", "building:1", "building:2", "done:0"], "{seen:?}");
    let v = core.town_view(at(40, 600));
    assert!(v.flags.iter().any(|f| f == "project:proj.playground:done"));
    // the next project opens after this one
    assert!(v.projects.iter().any(|p| p.id == "proj.lights" && p.status != "soon"));
    // a funded project takes nothing more
    assert!(matches!(core.apply_all(at(40, 610), Command::Contribute { project: "proj.playground".into(), coins: 10, items: vec![] }), Err(CoreError::AlreadyDone)));
}

#[test]
fn shops_open_by_the_season_and_after_what_the_town_built() {
    let core = world(3);
    let june = day_of(6, 15);
    let flags = |day: u64| core.town_view(at(day, 600)).flags;
    assert!(flags(june).iter().any(|f| f == "open:open.icecream"));
    assert!(!flags(day_of(11, 15)).iter().any(|f| f == "open:open.icecream"));
    // the ice-cream stall sells only while it is open
    let mut core = world(3);
    let t = at(day_of(11, 15), 600);
    go(&mut core, t, "village");
    assert!(core.apply_all(t, Command::Use { station: "st.icecream".into() }).is_err());
}

#[test]
fn rare_days_come_by_chance_and_the_season() {
    let core = world(13);
    let mut storms = 0;
    let mut weddings = Vec::new();
    let mut fairs = 0;
    for day in 0..730u64 {
        let v = core.town_view(at(day, 12 * 60));
        if v.today.storm {
            storms += 1;
        }
        if v.today.wedding.is_some() {
            weddings.push(day);
        }
        if v.today.fair {
            fairs += 1;
        }
    }
    assert!(storms > 0 && storms < 120, "storms now and then: {storms}");
    assert!(fairs > 0 && fairs < 40, "a visiting fair a few times a year: {fairs}");
    for day in &weddings {
        let date = FIRST_DAY + *day as i64;
        let (_, m, _) = teul_core::time::civil_from_days(date);
        assert!((5..=9).contains(&m), "weddings in the warm months");
        assert_eq!(teul_core::holidays::weekday(date), teul_core::holidays::Weekday::Sat);
    }
    // the same seed, the same year
    let again = world(13);
    for day in [3u64, 100, 400] {
        assert_eq!(core.town_view(at(day, 600)).today, again.town_view(at(day, 600)).today);
    }
}

#[test]
fn on_a_birthday_evening_friends_gather_at_the_house() {
    let core = world(3);
    let (m, d) = town::birthday(3, "r.petro");
    let day = day_of(m, d);
    let life = core.life_view(at(day, 19 * 60));
    let there = life.residents.iter().filter(|r| r.site == "home_b").count();
    let guests = life.residents.iter().filter(|r| r.site == "home_b" && r.id != "r.petro" && r.id != "r.hanna").count();
    assert!(there >= 2 && guests >= 1, "the host and some guests at home_b: {there} there, {guests} guests");
}

#[test]
fn the_paper_tells_the_town_s_news() {
    let core = world(3);
    let (m, d) = town::birthday(3, "r.hanna");
    let day = day_of(m, d);
    let paper = core.paper_view(at(day, 7 * 60));
    assert!(paper.town.iter().any(|l| l.contains("день народження") && l.contains("Ганна")), "{:?}", paper.town);
    // the playground, built by the town alone, is in the paper the morning after it is finished
    let view = core.town_view(at(200, 600));
    let done = view.projects.iter().find(|p| p.id == "proj.playground").and_then(|p| p.done_day).expect("finished by then");
    let paper = core.paper_view(at(done + 1, 7 * 60));
    let all: Vec<String> = std::iter::once(paper.headline.text.clone()).chain(paper.stories.iter().map(|s| s.text.clone())).collect();
    assert!(all.iter().any(|t| t.contains("Майданчик відкрито")), "{all:?}");
}

#[test]
fn the_full_moon_and_the_temple_offerings_show_in_the_town_flags() {
    let core = world(5);
    // 26 October 2026 is a full moon: the grove's fire is laid and the temple gets its offerings
    let full = day_of(10, 26);
    let flags = core.town_flags(at(full, 20 * 60));
    assert!(flags.contains("full_moon"), "{flags:?}");
    assert!(flags.contains("offerings"));
    assert!(!core.town_flags(at(day_of(10, 18), 12 * 60)).contains("full_moon"));
    // offerings now and then: on some days of every fortnight, never every day, the same for the same world
    let days: Vec<bool> = (0..28).map(|d| core.town_flags(at(d, 9 * 60)).contains("offerings")).collect();
    let n = days.iter().filter(|x| **x).count();
    assert!((5..=14).contains(&n), "{n} days of offerings in four weeks");
    assert_eq!(days, (0..28).map(|d| world(5).town_flags(at(d, 9 * 60)).contains("offerings")).collect::<Vec<_>>());
}

#[test]
fn the_fountain_is_taken_down_for_the_winter() {
    let core = world(5);
    assert!(core.town_flags(at(day_of(1, 10), 12 * 60)).contains("fountain_off"));
    assert!(core.town_flags(at(day_of(12, 1), 12 * 60)).contains("fountain_off"));
    assert!(!core.town_flags(at(day_of(5, 10), 12 * 60)).contains("fountain_off"));
    assert!(!core.town_flags(at(day_of(10, 20), 12 * 60)).contains("fountain_off"));
}
