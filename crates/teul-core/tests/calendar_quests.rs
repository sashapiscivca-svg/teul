//! The base pack's year: every month has its people's requests, every one of them can be done.

mod common;

use std::sync::Arc;

use teul_core::content::Content;
use teul_core::quests::{per_month, window_in, StageDo};

fn base() -> Content {
    Content::from_packs(&[include_str!("../../../content/base/pack.json")]).expect("the base pack is valid")
}

#[test]
fn every_month_has_enough_to_do() {
    let c = base();
    for year in [2026, 2027, 2028] {
        let months = per_month(&c.quests, year);
        for (m, n) in months.iter().enumerate() {
            assert!(*n >= 4, "{year}-{:02}: only {n} calendar quests", m + 1);
        }
    }
}

#[test]
fn calendar_windows_are_real_dates_every_year() {
    let c = base();
    for q in c.quests.values() {
        let Some(w) = &q.when else { continue };
        for year in 2026..2032 {
            let (s, e) = window_in(w, year).unwrap_or_else(|| panic!("{} has no window in {year}", q.id));
            assert!(e >= s && e - s <= 75, "{}: a window of {} days", q.id, e - s);
        }
    }
}

#[test]
fn quests_never_send_anyone_through_a_locked_door() {
    let c = base();
    // a place open only on certain days (the Other Side on the rift days) may be visited by a quest of that day
    let only_on_days = |l: &teul_core::npc::LocationDef| l.requires.as_ref().is_some_and(|r| r.items.is_empty() && r.helped.is_empty() && r.hearts.is_empty() && !r.days.is_empty());
    let locked: Vec<&String> = c.locations.values().filter(|l| l.requires.is_some() && !only_on_days(l)).map(|l| &l.id).collect();
    for q in c.quests.values() {
        for s in &q.stages {
            if let StageDo::Go { location, .. } | StageDo::Gather { location, .. } = &s.act {
                if let Some(days) = c.locations.get(location).filter(|l| only_on_days(l)).and_then(|l| l.requires.as_ref()).map(|r| &r.days) {
                    let on = q.when.as_ref().and_then(|w| w.holiday.as_deref());
                    let fits = on.is_some_and(|h| days.iter().any(|d| d == h || (d == "rift" && teul_core::holidays::date_of(h, 2027).is_some_and(teul_core::holidays::rift_day)) || teul_core::holidays::date_of(h, 2027).and_then(teul_core::sky::rift_world) == Some(d.as_str())));
                    assert!(fits, "{} goes to {location}, open only on {days:?}, outside those days", q.id);
                }
            }
        }
        assert!(!locked.contains(&&q.offer), "{} is offered in a locked place", q.id);
        for s in &q.stages {
            let loc = match &s.act {
                StageDo::Go { location, .. } | StageDo::Bring { location, .. } | StageDo::Gather { location, .. } => Some(location.clone()),
                StageDo::Use { station } => Some(c.stations[station].location.clone()),
                _ => None,
            };
            if let Some(l) = loc {
                assert!(q.requires.is_some() || !locked.contains(&&l), "{} goes to the locked {l}", q.id);
            }
        }
    }
    for j in c.jobs.values() {
        for p in j.places.iter().chain(std::iter::once(&j.location)) {
            assert!(!locked.contains(&p) || j.places.len() > 1, "job {} goes to the locked {p}", j.id);
        }
    }
}

#[test]
fn the_towns_needs_come_from_the_day() {
    use teul_core::core::{Core, NewWorld};
    use teul_core::storage::MemoryStorage;
    use teul_core::time::{WorldTime, MINUTES_PER_DAY};
    let c = Arc::new(base());
    let core = Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 9, epoch_unix_secs: common::AUTUMN_EPOCH }, c.clone()).unwrap();
    let mut total = 0;
    let mut ill = 0;
    let mut kinds = std::collections::BTreeSet::new();
    for day in 0..40u64 {
        let jobs = core.jobs_today(WorldTime(day * MINUTES_PER_DAY + 600));
        assert!(jobs.len() <= 12);
        total += jobs.len();
        for j in &jobs {
            kinds.insert(j.template.clone());
            if j.template == "job.medicine" || j.template == "job.sick_soup" {
                ill += 1;
            }
            assert!(!j.text.contains('{') && !j.title.contains('{'), "{j:?}");
            assert!(!j.giver_name.is_empty());
            for s in &j.stages {
                assert!(!s.text.contains('{'), "{:?}", s.text);
            }
        }
        // the same at any moment of that day
        assert_eq!(jobs, core.jobs_today(WorldTime(day * MINUTES_PER_DAY + 1400)));
    }
    assert!(total >= 20, "a living town needs a hand often: {total} in 40 days");
    assert!(kinds.len() >= 6, "{kinds:?}");
    assert!(ill > 0, "someone falls ill in forty days, and someone brings them medicine");
}
