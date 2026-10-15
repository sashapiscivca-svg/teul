//! The town by the hour: at night it sleeps (only the young and sweethearts are out late, and the night shift is
//! at work); couples go out together; and every place has its own people at the hours it is open.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

use teul_core::content::Content;
use teul_core::core::{Core, NewWorld};
use teul_core::life::{Activity, ResidentView};
use teul_core::storage::MemoryStorage;
use teul_core::time::{WorldTime, MINUTES_PER_DAY};

fn content() -> Arc<Content> {
    Arc::new(Content::from_packs(&[include_str!("../../../content/base/pack.json")]).unwrap())
}

fn core(c: &Arc<Content>) -> Core<MemoryStorage> {
    Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 99, epoch_unix_secs: 1_700_000_000 }, c.clone()).unwrap()
}

fn at(day: u64, h: u64, m: u64) -> WorldTime {
    WorldTime(day * MINUTES_PER_DAY + h * 60 + m)
}

const NIGHT_ROLES: [&str; 4] = ["night_officer", "firefighter_night", "nurse", "bartender"];

fn role(c: &Content, id: &str) -> Option<String> {
    c.residents[id].job.as_ref().map(|(_, r)| r.clone())
}

/// Up and about (not asleep or at home, not in hospital or held). The priest lives at the church and the
/// receptionist at the hostel: there they count when working.
fn out(c: &Content, r: &ResidentView) -> bool {
    let home = r.site == c.residents[&r.id].home;
    !matches!(r.activity, Activity::Sleep | Activity::Home | Activity::Sick | Activity::Injured | Activity::Arrested) && !(home && r.activity == Activity::Eat)
}

#[test]
fn at_half_past_eleven_the_town_sleeps_but_the_young_and_the_night_shift() {
    let c = content();
    let core = core(&c);
    for day in [10, 11, 12, 15] {
        let view = core.life_view(at(day, 23, 30));
        let about: Vec<&ResidentView> = view
            .residents
            .iter()
            .filter(|r| out(&c, r) && !c.residents[&r.id].young && c.residents[&r.id].partner.as_ref().is_none_or(|p| !c.residents[p].young))
            .filter(|r| !role(&c, &r.id).is_some_and(|j| NIGHT_ROLES.contains(&j.as_str())))
            .collect();
        assert!(about.len() <= 2, "day {day}: still about at 23:30: {:?}", about.iter().map(|r| (&r.name, &r.site, r.activity)).collect::<Vec<_>>());
    }
}

#[test]
fn children_are_home_by_nine_and_elders_by_half_past_nine() {
    let c = content();
    let core = core(&c);
    for day in [10, 13, 16] {
        let kids: Vec<_> = core.life_view(at(day, 21, 0)).residents.into_iter().filter(|r| c.residents[&r.id].age == "child" && out(&c, r)).map(|r| r.name).collect();
        assert!(kids.is_empty(), "day {day}: children out at 21:00: {kids:?}");
        let old: Vec<_> = core
            .life_view(at(day, 21, 30))
            .residents
            .into_iter()
            .filter(|r| c.residents[&r.id].age == "elder" && out(&c, r) && role(&c, &r.id).is_none())
            .map(|r| r.name)
            .collect();
        assert!(old.is_empty(), "day {day}: elders out at 21:30: {old:?}");
    }
}

#[test]
fn the_young_go_out_in_the_evening() {
    let c = content();
    let core = core(&c);
    let mut seen = BTreeSet::new();
    for day in 10..17 {
        for r in core.life_view(at(day, 22, 30)).residents {
            if c.residents[&r.id].young && out(&c, &r) && r.activity == Activity::Leisure {
                seen.insert(r.name);
            }
        }
    }
    assert!(seen.len() >= 3, "young people out late in a week: {seen:?}");
}

#[test]
fn parents_with_a_pram_are_home_in_the_evening() {
    let c = content();
    let core = core(&c);
    for day in 10..17 {
        for r in core.life_view(at(day, 22, 0)).residents {
            let d = &c.residents[&r.id];
            let baby = d.pram || d.partner.as_ref().is_some_and(|p| c.residents[p].pram);
            assert!(!(baby && out(&c, &r) && r.activity == Activity::Leisure), "day {day}: {} out with a baby at 22:00 ({:?} at {})", d.name, r.activity, r.site);
        }
    }
}

#[test]
fn the_night_shift_is_at_work_at_night() {
    let c = content();
    let core = core(&c);
    let t = at(15, 23, 30);
    let view = core.life_view(t);
    let mut checked = 0;
    for r in &view.residents {
        let Some((site, role)) = c.residents[&r.id].job.clone() else { continue };
        if !["night_officer", "firefighter_night", "nurse"].contains(&role.as_str()) {
            continue;
        }
        // each has two nights off a week (in turn) and a vacation: only those on tonight
        if !core.schedule_of(&r.id, t).unwrap().working_now {
            continue;
        }
        checked += 1;
        assert!(r.site == site || matches!(r.activity, Activity::Patrol | Activity::Firefight | Activity::Sick | Activity::Injured), "{} ({role}) is at {} doing {:?}", r.name, r.site, r.activity);
    }
    assert!(checked >= 2, "night workers on tonight: {checked}");
}

#[test]
fn couples_go_out_together() {
    let c = content();
    let core = core(&c);
    let (mut together, mut apart) = (0, 0);
    for day in 10..14 {
        for h in 9..21 {
            let view = core.life_view(at(day, h, 15));
            let by: BTreeMap<&String, &ResidentView> = view.residents.iter().map(|r| (&r.id, r)).collect();
            for r in &view.residents {
                let Some(p) = &c.residents[&r.id].partner else { continue };
                if r.id > *p || r.activity != Activity::Leisure || by[p].activity != Activity::Leisure {
                    continue;
                }
                if r.site == by[p].site {
                    together += 1;
                } else {
                    apart += 1;
                }
            }
        }
    }
    assert!(together > 20 && together >= apart * 5, "together {together}, apart {apart}");
}

/// Every place has its own people at the hours it is open: a table of who is where at 10:00, 15:00, 19:00 and
/// 23:00 (printed with --nocapture), and no place left empty all day.
#[test]
fn every_place_has_its_people() {
    let c = content();
    let core = core(&c);
    // the places shown: outdoor locations by their sites, interiors by the site they are the inside of
    let mut sites_of: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
    for (site, loc) in &c.site_location {
        if c.sites.get(site).is_some_and(|s| s.kind != "home") {
            sites_of.entry(loc.clone()).or_default().insert(site.clone());
        }
    }
    for l in c.locations.values() {
        // a friend's home one is invited into is no public place: nobody need be there
        if l.invite_only {
            continue;
        }
        if let Some(inside) = &l.inside {
            sites_of.entry(l.id.clone()).or_default().insert(inside.clone());
        }
    }
    let day = 15;
    let hours = [10, 15, 19, 23];
    let views: Vec<_> = hours.iter().map(|h| core.life_view(at(day, *h, 0))).collect();
    let mut empty = Vec::new();
    for (loc, sites) in &sites_of {
        let counts: Vec<usize> = views.iter().map(|v| v.residents.iter().filter(|r| sites.contains(&r.site) && out(&c, r)).count()).collect();
        eprintln!("{loc:>16}: 10:00 {:>2}  15:00 {:>2}  19:00 {:>2}  23:00 {:>2}", counts[0], counts[1], counts[2], counts[3]);
        if counts[..3].iter().all(|n| *n == 0) {
            empty.push(loc.clone());
        }
    }
    for r in &views[3].residents {
        if out(&c, r) {
            let d = &c.residents[&r.id];
            eprintln!("  23:00 {} ({}{}) {:?} at {}", d.name, d.age, if d.young { ", young" } else { "" }, r.activity, r.site);
        }
    }
    assert!(empty.is_empty(), "nobody all day at: {empty:?}");
}

#[test]
fn the_priest_says_mass_and_visits_the_cemetery() {
    let c = content();
    let core = core(&c);
    let priest = c.residents.values().find(|r| r.job.as_ref().is_some_and(|(_, j)| j == "priest")).expect("a priest");
    let at_church = core.life_view(at(15, 10, 0)).residents.into_iter().find(|r| r.id == priest.id).unwrap();
    assert_eq!(at_church.site, "church_site");
    let later = core.life_view(at(15, 15, 30)).residents.into_iter().find(|r| r.id == priest.id).unwrap();
    assert_eq!(later.site, "cemetery_site", "the afternoon walk to the cemetery chapel");
}

/// The day's rhythm, plain to see: at ten on a working day everyone whose plan has them at work is at their own
/// work (the postman and the utility inspector on their rounds, the police and the paper's people out where they
/// are needed), and at half past eleven at night the day people are at home.
#[test]
fn everyone_goes_to_their_own_work_and_home_again() {
    let c = content();
    let core = core(&c);
    let day = 15;
    let view = core.life_view(at(day, 10, 0));
    let mut working = 0;
    for r in &view.residents {
        if c.residents[&r.id].job.is_none() || !core.schedule_of(&r.id, at(day, 10, 0)).unwrap().working_now {
            continue;
        }
        working += 1;
        let (site, role) = c.residents[&r.id].job.clone().unwrap();
        let elsewhere_for_work = matches!(r.activity, Activity::Patrol | Activity::Firefight | Activity::Interview | Activity::Sick | Activity::Injured | Activity::Arrested | Activity::Away)
            || ((role == "postman" || role == "utility_inspector") && r.activity == Activity::Work && c.sites[&r.site].kind == "home");
        assert!(r.site == site || elsewhere_for_work, "{} ({role}) should be at {site} but is at {} ({:?})", r.name, r.site, r.activity);
    }
    assert!(working >= 30, "people at work at ten: {working}");
    let night = core.life_view(at(day, 23, 30));
    for r in &night.residents {
        let d = &c.residents[&r.id];
        if d.job.is_none() || core.schedule_of(&r.id, at(day, 23, 30)).unwrap().working_now {
            continue;
        }
        // a late supper in one's own kitchen is being at home too
        let ok = matches!(r.activity, Activity::Sleep | Activity::Home | Activity::Sick | Activity::Injured | Activity::Arrested)
            || (d.young && r.activity == Activity::Leisure)
            || (r.activity == Activity::Eat && r.site == d.home);
        assert!(ok, "{} ({:?}) is out at 23:30: {:?} at {}", d.name, d.job, r.activity, r.site);
    }
}

#[test]
fn the_postman_does_a_round_of_the_houses_in_the_morning() {
    let c = content();
    let core = core(&c);
    let postman = c.residents.values().find(|r| r.job.as_ref().is_some_and(|(_, j)| j == "postman")).expect("a postman");
    let mut doors = BTreeSet::new();
    for m in (7 * 60..11 * 60).step_by(20) {
        let r = core.life_view(WorldTime(15 * MINUTES_PER_DAY + m)).residents.into_iter().find(|r| r.id == postman.id).unwrap();
        if c.sites[&r.site].kind == "home" {
            doors.insert(r.site);
        }
    }
    assert!(doors.len() >= 8, "a morning round: {doors:?}");
    let after = core.life_view(at(15, 12, 0)).residents.into_iter().find(|r| r.id == postman.id).unwrap();
    assert_eq!(after.site, "post_site", "back at the post office after the round");
}
