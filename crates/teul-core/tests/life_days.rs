//! The town by the real calendar: everyone has a plan for the day (work by their own days and hours, school on
//! school days), with the exceptions of real life — weekends, Sunday mass, holidays when shops and offices shut,
//! vacations, illness — and a little seeded chance in it all. The same seed gives the same town everywhere.

use std::sync::Arc;
use std::time::Instant;

use teul_core::content::Content;
use teul_core::core::{Core, NewWorld};
use teul_core::life::{Activity, ResidentView};
use teul_core::storage::MemoryStorage;
use teul_core::time::{days_from_civil, WorldTime, MINUTES_PER_DAY};

/// The world below was first opened on 2023-11-15 (Wednesday).
const FIRST: i64 = 19_676;

fn content() -> Arc<Content> {
    Arc::new(Content::from_packs(&[include_str!("../../../content/base/pack.json")]).unwrap())
}

fn core(c: &Arc<Content>, seed: u64) -> Core<MemoryStorage> {
    Core::create_with(MemoryStorage::new(), 1, NewWorld { seed, epoch_unix_secs: 1_700_000_000 }, c.clone()).unwrap()
}

fn day_of(y: i64, m: u32, d: u32) -> u64 {
    (days_from_civil(y, m, d) - FIRST) as u64
}

fn at(day: u64, h: u64, m: u64) -> WorldTime {
    WorldTime(day * MINUTES_PER_DAY + h * 60 + m)
}

fn job_site(c: &Content, id: &str) -> Option<String> {
    c.residents[id].job.as_ref().map(|(s, _)| s.clone())
}

fn role(c: &Content, id: &str) -> Option<String> {
    c.residents[id].job.as_ref().map(|(_, r)| r.clone())
}

fn unwell(r: &ResidentView) -> bool {
    matches!(r.activity, Activity::Sick | Activity::Injured | Activity::Arrested | Activity::Away)
}

#[test]
fn on_a_weekday_morning_workers_are_at_work_and_children_at_school() {
    let c = content();
    let core = core(&c, 99);
    let t = at(day_of(2023, 11, 21), 10, 30); // a Tuesday
    let view = core.life_view(t);
    let mut due = 0;
    let mut there = 0;
    for r in &view.residents {
        let Some(site) = job_site(&c, &r.id) else { continue };
        let plan = core.schedule_of(&r.id, t).expect("everyone has a plan");
        if !plan.working_now || unwell(r) {
            continue;
        }
        due += 1;
        // at work, or out on the job (a round, a call, an interview)
        if r.site == site || matches!(r.activity, Activity::Work | Activity::Patrol | Activity::Firefight | Activity::Interview) {
            there += 1;
        }
    }
    assert!(due >= 30, "most grown-ups work on a Tuesday morning: {due}");
    assert!(there * 100 >= due * 90, "at work: {there}/{due}");
    let kids: Vec<&ResidentView> = view.residents.iter().filter(|r| c.residents[&r.id].age == "child" && !unwell(r)).collect();
    let at_school = kids.iter().filter(|r| r.activity == Activity::School).count();
    assert!(!kids.is_empty() && at_school * 100 >= kids.len() * 90, "at school: {at_school}/{}", kids.len());
}

#[test]
fn on_sunday_morning_many_go_to_mass() {
    let c = content();
    let core = core(&c, 99);
    let view = core.life_view(at(day_of(2023, 11, 19), 9, 50));
    let church = view.residents.iter().filter(|r| c.sites.get(&r.site).is_some_and(|s| s.kind == "church")).count();
    assert!(church >= 15, "at church on Sunday morning: {church}");
    // and nobody is at school on a Sunday
    assert!(view.residents.iter().all(|r| r.activity != Activity::School));
}

#[test]
fn on_a_holiday_shops_and_offices_are_shut_but_the_police_and_the_hospital_work() {
    let c = content();
    let core = core(&c, 99);
    let t = at(day_of(2023, 12, 25), 11, 0); // Christmas, a Monday
    assert!(core.day_view(t).day_off);
    assert_eq!(core.day_view(t).holiday.as_deref(), Some("Різдво"));
    let view = core.life_view(t);
    let shut = ["grocery", "bakery", "flowers", "post", "townhall", "library", "school", "utility", "sawmill", "workshop"];
    for r in &view.residents {
        let Some(site) = job_site(&c, &r.id) else { continue };
        let kind = c.sites[&site].kind.as_str();
        if shut.contains(&kind) {
            assert!(r.activity != Activity::Work, "{} ({}) works on Christmas at {}", r.name, kind, r.site);
        }
    }
    let essential = view.residents.iter().filter(|r| matches!(r.activity, Activity::Work | Activity::Patrol) && job_site(&c, &r.id).is_some_and(|s| matches!(c.sites[&s].kind.as_str(), "police" | "hospital" | "fire"))).count();
    assert!(essential >= 1, "someone keeps watch on Christmas");
}

#[test]
fn the_sick_stay_at_home_except_for_the_doctor_in_the_morning() {
    let c = content();
    let core = core(&c, 7);
    let mut sick_seen = 0;
    for day in 30..44 {
        for h in [8, 12, 15, 19] {
            for r in core.life_view(at(day, h, 0)).residents {
                if r.activity != Activity::Sick {
                    continue;
                }
                sick_seen += 1;
                assert_eq!(r.site, c.residents[&r.id].home, "{} is ill at {}:00 but at {}", r.name, h, r.site);
            }
        }
    }
    assert!(sick_seen > 0, "in two weeks somebody falls ill");
}

#[test]
fn everyone_who_works_has_a_vacation_and_is_not_at_work_then() {
    let c = content();
    let core = core(&c, 99);
    let workers: Vec<String> = c.residents.values().filter(|r| r.job.is_some() && r.age != "child").map(|r| r.id.clone()).collect();
    let mut with_vacation = 0;
    let mut checked = 0;
    for id in &workers {
        // look a day a week through the year
        let found = (0..53u64).map(|w| at(w * 7 + 3, 11, 0)).find(|t| core.schedule_of(id, *t).is_some_and(|s| s.absence.as_deref() == Some("vacation") || s.absence.as_deref() == Some("away")));
        if let Some(t) = found {
            with_vacation += 1;
            if checked < 6 {
                checked += 1;
                let r = core.life_view(t).residents.into_iter().find(|r| &r.id == id).unwrap();
                assert!(r.activity != Activity::Work, "{} works on vacation", r.name);
            }
        }
    }
    assert!(with_vacation * 100 >= workers.len() * 90, "vacations: {with_vacation}/{}", workers.len());
}

#[test]
fn the_same_day_is_the_same_town() {
    let c = content();
    let a = core(&c, 1234);
    let b = core(&c, 1234);
    for t in [at(12, 8, 10), at(13, 17, 40), at(40, 11, 0)] {
        assert_eq!(a.life_view(t).residents, b.life_view(t).residents);
        assert_eq!(a.life_view(t).residents, a.life_view(t).residents);
    }
    // and another seed is another town (the chance in it is real)
    let other = core(&c, 4321);
    assert_ne!(a.life_view(at(12, 8, 10)).residents, other.life_view(at(12, 8, 10)).residents);
}

#[test]
fn departures_are_spread_out_not_all_on_the_hour() {
    let c = content();
    let core = core(&c, 99);
    let day = day_of(2023, 11, 21);
    // over the morning, people set off at many different minutes
    let mut minutes = std::collections::BTreeSet::new();
    for m in (6 * 60..9 * 60).step_by(10) {
        for r in core.life_view(WorldTime(day * MINUTES_PER_DAY + m)).residents {
            if r.since >= day * MINUTES_PER_DAY && r.since < day * MINUTES_PER_DAY + 9 * 60 {
                minutes.insert(r.since % MINUTES_PER_DAY);
            }
        }
    }
    assert!(minutes.len() >= 10, "set off at only {} different times: {minutes:?}", minutes.len());
}

#[test]
fn a_schedule_reads_like_a_day() {
    let c = content();
    let core = core(&c, 99);
    let t = at(day_of(2023, 11, 21), 10, 0);
    let clerk = c.residents.values().find(|r| role(&c, &r.id).as_deref() == Some("postal_clerk")).unwrap();
    let s = core.schedule_of(&clerk.id, t).unwrap();
    assert!(s.text.starts_with("Сьогодні"), "{}", s.text);
    assert!(s.items.iter().any(|i| i.what == "work"), "{:?}", s.items);
    assert_eq!(core.day_view(t).weekday, "вівторок");
}

#[test]
fn a_week_of_the_town_is_quick_to_live() {
    let c = content();
    let core = core(&c, 99);
    let start = Instant::now();
    let _ = core.life_view(at(60, 12, 0));
    let ms = start.elapsed().as_millis();
    eprintln!("a 7-day window of {} residents: {ms} ms", c.residents.len());
    // generous for unoptimised test builds; the release build is measured separately
    assert!(ms < 6000, "{ms} ms");
}

