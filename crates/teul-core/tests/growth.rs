use teul_core::growth::*;
use teul_core::time::days_from_civil;

fn d(y: i64, m: u32, day: u32) -> i64 {
    days_from_civil(y, m, day)
}

fn site(id: &str, stall: u32) -> GrowSiteDef {
    GrowSiteDef {
        id: id.into(),
        name: "Дім на Новобудовній, 1".into(),
        location: "village".into(),
        start: 10,
        jitter: 20,
        stages: [8, 15, 30, 20],
        stall,
        kind: "house".into(),
        done: String::new(),
        x: 3,
        y: 4,
    }
}

#[test]
fn builders_rest_in_winter_on_sundays_and_great_holidays() {
    assert!(!working_day(d(2027, 1, 12)));
    assert!(!working_day(d(2026, 12, 3)));
    assert!(!working_day(d(2026, 10, 11))); // a Sunday
    assert!(!working_day(d(2026, 8, 24))); // Independence Day
    assert!(working_day(d(2026, 10, 13)));
}

#[test]
fn a_house_goes_up_stage_by_stage_over_months() {
    let first = d(2026, 3, 2);
    let s = site("new1", 0);
    let life = site_life(7, first, &s, first + 1000);
    assert_eq!(life.reached.len(), 5, "built within three years");
    for w in life.reached.windows(2) {
        assert!(w[1] > w[0], "stages come one after another");
    }
    let begin = site_begins(7, first, &s);
    assert!(begin >= first + 10 && begin <= first + 30);
    assert_eq!(life.reached[0], begin);
    // 73 working days and no work on Sundays: at least three calendar months
    assert!(life.built().unwrap() - begin >= 84);
    // the stage at a date agrees with what was reached
    assert_eq!(life.stage_at(begin - 1), None);
    assert_eq!(life.stage_at(begin), Some(0));
    assert_eq!(life.stage_at(life.reached[2]), Some(2));
    assert_eq!(life.stage_at(life.built().unwrap() + 400), Some(4));
    // the life up to an earlier date is the start of the same life
    let part = site_life(7, first, &s, life.reached[2]);
    assert_eq!(part.reached, life.reached[..3]);
}

#[test]
fn nothing_is_built_in_the_depth_of_winter() {
    let first = d(2026, 11, 25);
    let mut s = site("winter", 0);
    s.start = 0;
    s.jitter = 0;
    let life = site_life(3, first, &s, first + 600);
    for r in &life.reached[1..] {
        let (_, m, _) = teul_core::time::civil_from_days(*r - 1);
        assert!(!matches!(m, 12 | 1 | 2), "a stage finished on a winter day: {r}");
    }
}

#[test]
fn some_sites_stall_and_stand_as_frames_then_go_on() {
    let first = d(2026, 4, 1);
    let s = site("stall", 1000);
    let life = site_life(11, first, &s, first + 3000);
    let (a, b) = life.stalled.expect("it stalls");
    assert!(b - a >= 240);
    assert_eq!(life.stage_at(a), Some(2), "it stalls at the walls");
    assert!(life.stalled_at(a) && !life.stalled_at(b));
    assert_eq!(life.reached.len(), 5, "and is finished in the end");
    assert!(life.reached[3] > b);
    let flags = growth_flags(&GrowthDef { sites: vec![s], ..Default::default() }, 11, first, (a + 5 - first) as u64);
    assert!(flags.contains("grow:stall:stalled"));
    assert!(!flags.iter().any(|f| f.ends_with(":work")), "nobody works at a stalled site");
}

#[test]
fn the_same_world_grows_the_same_and_another_differently() {
    let first = d(2026, 3, 2);
    let g = GrowthDef { sites: (0..6).map(|i| site(&format!("s{i}"), 250)).collect(), ..Default::default() };
    let a: Vec<_> = (0..400).step_by(7).map(|day| growth_flags(&g, 42, first, day)).collect();
    let b: Vec<_> = (0..400).step_by(7).map(|day| growth_flags(&g, 42, first, day)).collect();
    assert_eq!(a, b);
    let c: Vec<_> = (0..400).step_by(7).map(|day| growth_flags(&g, 43, first, day)).collect();
    assert_ne!(a, c);
}

#[test]
fn buildings_wear_and_are_mended_then_wear_again() {
    let first = d(2026, 1, 1);
    let w = WearDef { id: "bakery".into(), name: "Пекарня".into(), location: "village".into(), kinds: vec!["crack".into(), "window".into(), "roof".into()], x: 1, y: 1 };
    let mut spells = Vec::new();
    let mut date = first;
    while date < first + 1500 {
        if let Some(x) = wear_at(5, first, &w, date) {
            assert!(x.from <= date && date < x.until);
            assert!(x.fix_from > x.from && x.fix_from < x.until, "mending comes after the breaking, and ends it");
            assert!((2..=4).contains(&(x.until - x.fix_from)));
            spells.push(x.clone());
            date = x.until;
        } else {
            date += 1;
        }
    }
    assert!(spells.len() >= 5, "something breaks a few times a year at most: {}", spells.len());
    assert!(spells.len() <= 12);
    // flags: the kind while broken, `fix` while being mended
    let g = GrowthDef { wear: vec![w], ..Default::default() };
    let s = &spells[0];
    let at = |date: i64| growth_flags(&g, 5, first, (date - first) as u64);
    assert!(at(s.from).contains(&format!("wear:bakery:{}", s.kind)));
    assert!(at(s.from).contains("worn:bakery") && !at(s.from).contains("fix:bakery"));
    assert!(at(s.fix_from).contains("fix:bakery"));
    assert!(at(s.until).is_empty(), "mended: it looks fresh");
}

#[test]
fn an_empty_house_is_mended_before_it_is_lived_in_again() {
    let first = d(2026, 5, 1);
    let a = AbandonDef {
        id: "home_7".into(),
        name: "Дім на Садовій, 7".into(),
        location: "village".into(),
        from: 30,
        jitter: 60,
        empty: (300, 200),
        mend: 25,
        why: "господарі поїхали до доньки в Польщу.".into(),
        back: "у дім заселилася молода родина.".into(),
        x: 0,
        y: 0,
    };
    let (left, back) = abandon_span(9, first, &a);
    assert!(left >= first + 30 && left <= first + 90);
    assert!(back - left >= 300 && back - left <= 500);
    let g = GrowthDef { abandon: vec![a], ..Default::default() };
    let at = |date: i64| growth_flags(&g, 9, first, (date - first) as u64);
    assert!(at(left - 1).is_empty());
    assert!(at(left).contains("abandon:home_7") && !at(left).contains("mend:home_7"));
    assert!(at(back - 3).contains("mend:home_7"));
    assert!(at(back).is_empty());
    let news = growth_news(&g, 9, first, first, back + 1, teul_core::content::Lang::Uk);
    let kinds: Vec<_> = news.iter().map(|n| n.kind.as_str()).collect();
    assert_eq!(kinds, ["left", "mending", "back"]);
}

#[test]
fn the_ice_cream_cart_comes_out_only_on_warm_dry_days_of_its_months() {
    let first = d(2026, 1, 1);
    let cart = CartDef { location: "village".into(), months: vec![5, 6, 7, 8, 9], hours: (11, 19), spots: vec![CartSpot { name: "Парк".into(), x: 1, y: 1 }] };
    let days = |m: u32| (0..400u64).filter(|day| teul_core::time::civil_from_days(first + *day as i64).1 == m).filter(|day| cart_day(4, first, &cart, *day)).count();
    assert_eq!(days(1), 0);
    assert_eq!(days(11), 0);
    let july = days(7);
    assert!(july >= 12 && july < 31, "most of July, not every day: {july}");
}

#[test]
fn the_paper_hears_of_a_house_begun_roofed_and_lived_in() {
    let first = d(2026, 3, 2);
    let s = site("new1", 0);
    let life = site_life(7, first, &s, first + 1000);
    let g = GrowthDef { sites: vec![s], ..Default::default() };
    let news = growth_news(&g, 7, first, first, first + 1000, teul_core::content::Lang::Uk);
    let kinds: Vec<_> = news.iter().map(|n| n.kind.as_str()).collect();
    assert_eq!(kinds, ["begun", "walls", "roof", "built"]);
    assert_eq!(news[3].day, life.built().unwrap() - first);
    assert!(news.iter().all(|n| !n.text.is_empty()));
    // the van stands at the door for the first days only
    let at = |date: i64| growth_flags(&g, 7, first, (date - first) as u64);
    let built = life.built().unwrap();
    assert!(at(built).contains("grow:new1:moving") && at(built).contains("grow:new1:built"));
    assert!(!at(built + MOVING_DAYS).contains("grow:new1:moving"));
}

mod common;

#[test]
fn the_donut_shop_opens_its_door_only_once_it_stands_and_the_town_flags_show_the_building() {
    use std::sync::Arc;
    use teul_core::content::Content;
    use teul_core::core::{Command, Core, CoreError, NewWorld};
    use teul_core::storage::MemoryStorage;
    use teul_core::time::{WorldTime, MINUTES_PER_DAY};
    use teul_core::unlock::Missing;
    let c = Content::from_packs(&[include_str!("../../../content/base/pack.json")]).expect("the base pack is valid");
    let mut core = Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 5, epoch_unix_secs: common::AUTUMN_EPOCH }, Arc::new(c)).unwrap();
    let at = |day: u64| WorldTime(day * MINUTES_PER_DAY + 12 * 60);
    let stage = |core: &Core<MemoryStorage>, day: u64| core.growth_view(at(day)).sites.into_iter().find(|s| s.id == "donut_site").unwrap().stage;
    let built = (0..900u64).find(|d| stage(&core, *d) == "built").expect("the donut shop is built within a few seasons");
    assert!(built > 30, "it takes its time: {built} days");
    assert!(core.town_flags(at(built)).contains("grow:donut_site:built"));
    assert!(!core.town_flags(at(built - 1)).contains("grow:donut_site:built"));
    assert!(core.growth_view(at(built)).news.iter().any(|n| n.kind == "opened" && n.text.contains("Пончикова")));
    core.apply_all(at(1), Command::Travel { to: "village".into() }).unwrap();
    match core.apply_all(at(1), Command::Travel { to: "donuts_in".into() }) {
        Err(CoreError::Locked(m)) => assert!(m.iter().any(|x| matches!(x, Missing::Flag { flag } if flag == "grow:donut_site:built"))),
        other => panic!("the door of a building site opened: {other:?}"),
    }
    core.apply_all(at(built), Command::Travel { to: "village".into() }).unwrap();
    core.apply_all(at(built), Command::Travel { to: "donuts_in".into() }).expect("the donut shop is open");
    core.apply_all(at(built), Command::Use { station: "st.donuts.donut_glazed".into() }).expect("a donut can be bought");
}
