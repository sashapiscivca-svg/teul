//! What people feel: moods, ties between residents that change over real days, and how warm people are with the
//! player — all from the seed, the date and what the player did.

mod common;

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

use teul_core::content::Content;
use teul_core::core::{Command, Core, CoreError, NewWorld};
use teul_core::daily::Sky;
use teul_core::feelings::{self, effective_points, mood_of, romance_on, spat, ties_on, Mood, MoodInput, TieKind, TieState, Warmth};
use teul_core::holidays::day_info;
use teul_core::life::{Activity, ResidentDef};
use teul_core::npc::Relation;
use teul_core::storage::MemoryStorage;
use teul_core::time::{Season, WorldTime, MINUTES_PER_DAY};

const FIRST_DAY: i64 = 20_736;

fn base() -> Content {
    Content::from_packs(&[include_str!("../../../content/base/pack.json")]).expect("the base pack is valid")
}

fn people(c: &Content) -> Vec<&ResidentDef> {
    c.residents.values().filter(|r| r.arrives.is_none()).collect()
}

fn world(seed: u64) -> Core<MemoryStorage> {
    Core::create_with(MemoryStorage::new(), 1, NewWorld { seed, epoch_unix_secs: common::AUTUMN_EPOCH }, Arc::new(base())).unwrap()
}

fn at(day: u64, minute: u64) -> WorldTime {
    WorldTime(day * MINUTES_PER_DAY + minute)
}

#[test]
fn the_ties_are_the_same_for_the_same_seed_and_day() {
    let c = base();
    let p = people(&c);
    let a = ties_on(7, FIRST_DAY, &p, FIRST_DAY + 40);
    let b = ties_on(7, FIRST_DAY, &p, FIRST_DAY + 40);
    assert_eq!(a, b);
    let other = ties_on(8, FIRST_DAY, &p, FIRST_DAY + 40);
    assert_ne!(a, other, "another world, other ties");
}

#[test]
fn couples_families_friends_and_neighbours_are_all_there() {
    let c = base();
    let p = people(&c);
    let ties = ties_on(7, FIRST_DAY, &p, FIRST_DAY + 10);
    let kinds: BTreeSet<TieKind> = ties.iter().map(|t| t.kind).collect();
    for k in [TieKind::Couple, TieKind::Family, TieKind::Friends, TieKind::Colleagues] {
        assert!(kinds.contains(&k), "missing {k:?}");
    }
    assert!(kinds.contains(&TieKind::Neighbours) || kinds.contains(&TieKind::Rivals));
    // every couple of the content is a couple here, and nobody is tied twice
    for r in &p {
        if let Some(q) = &r.partner {
            assert!(ties.iter().any(|t| t.kind == TieKind::Couple && t.has(&r.id) && t.has(q)), "{} and {q}", r.id);
        }
    }
    let pairs: BTreeSet<(&str, &str)> = ties.iter().map(|t| (t.a.as_str(), t.b.as_str())).collect();
    assert_eq!(pairs.len(), ties.len());
}

#[test]
fn quarrels_come_and_pass_and_end_in_making_up() {
    let mut quarrels = 0;
    let mut made_up = 0;
    for key in 0..200u64 {
        let mut was = spat(3, key, TieKind::Friends, FIRST_DAY - 1);
        for date in FIRST_DAY..FIRST_DAY + 120 {
            let s = spat(3, key, TieKind::Friends, date);
            if s == TieState::Quarrel && was != TieState::Quarrel {
                quarrels += 1;
            }
            if s == TieState::MadeUp {
                assert_eq!(was, TieState::Quarrel, "making up follows a quarrel");
                made_up += 1;
            }
            was = s;
        }
    }
    assert!(quarrels > 50, "quarrels happen: {quarrels}");
    assert!(made_up > 40, "and people make up: {made_up}");
    // rivals squabble far more often than colleagues
    let count = |k: TieKind| (0..300u64).flat_map(|key| (0..96).map(move |d| (key, d))).filter(|(key, d)| spat(5, *key, k, FIRST_DAY + d) == TieState::Quarrel).count();
    assert!(count(TieKind::Rivals) > 3 * count(TieKind::Colleagues));
}

#[test]
fn a_crush_turns_into_courting_and_then_a_couple_or_parting() {
    let c = base();
    let p = people(&c);
    let rs = feelings::romances(7, FIRST_DAY, &p);
    assert!(rs.len() >= 3, "a few romances in the town: {}", rs.len());
    let by_id: BTreeMap<&str, &&ResidentDef> = p.iter().map(|r| (r.id.as_str(), r)).collect();
    let mut someone: BTreeSet<&str> = BTreeSet::new();
    for r in &rs {
        let (a, b) = (by_id[r.a.as_str()], by_id[r.b.as_str()]);
        assert_ne!(a.gender, b.gender);
        assert_eq!(a.age, b.age);
        assert_ne!(a.home, b.home);
        assert!(a.partner.is_none() && b.partner.is_none());
        assert!(someone.insert(&r.a) && someone.insert(&r.b), "one romance each");
        assert_eq!(romance_on(r, r.start - 1), None);
        assert_eq!(romance_on(r, r.start).map(|x| x.0), Some(TieKind::Crush));
        assert_eq!(romance_on(r, r.start + feelings::CRUSH_DAYS).map(|x| x.0), Some(TieKind::Courting));
        let after = romance_on(r, r.start + feelings::CRUSH_DAYS + feelings::COURTING_DAYS).map(|x| x.0);
        assert!(matches!(after, Some(TieKind::Sweethearts) | Some(TieKind::Parted)));
    }
    // over the first months they show up among the ties
    let r = &rs[0];
    let later = ties_on(7, FIRST_DAY, &p, r.start + feelings::CRUSH_DAYS + 3);
    let t = later.iter().find(|t| t.has(&r.a) && t.has(&r.b)).expect("the pair is tied");
    assert_eq!(t.kind, TieKind::Courting);
}

#[test]
fn courting_pairs_go_out_together_in_the_evening() {
    let c = base();
    let p = people(&c);
    let rs = feelings::romances(7, FIRST_DAY, &p);
    let r = &rs[0];
    let start = r.start + feelings::CRUSH_DAYS;
    let nights: Vec<i64> = (start..start + feelings::COURTING_DAYS).filter(|d| feelings::evening_out(7, FIRST_DAY, &p, &r.a, *d).is_some()).collect();
    assert!(nights.len() >= 8, "several evenings out: {}", nights.len());
    for d in &nights {
        assert_eq!(feelings::evening_out(7, FIRST_DAY, &p, &r.a, *d).as_deref(), Some(r.b.as_str()));
        assert_eq!(feelings::evening_out(7, FIRST_DAY, &p, &r.b, *d).as_deref(), Some(r.a.as_str()), "both of them");
    }
}

fn input<'a>(info: &'a teul_core::holidays::DayInfo, ties: &'a [&'a feelings::Tie], sky: Sky, activity: Activity, minute: u32) -> MoodInput<'a> {
    MoodInput { id: "res_1", age: "adult", temper: 40, social: 50, activity, life_mood: 0, sky, season: Season::Autumn, info, birthday: false, minute, ties, warmth: Warmth::Stranger }
}

#[test]
fn moods_follow_the_day_the_weather_and_the_heart() {
    let date = FIRST_DAY + 5;
    let info = day_info(date);
    let none: Vec<&feelings::Tie> = Vec::new();
    assert_eq!(mood_of(1, date, &input(&info, &none, Sky::Clear, Activity::Sick, 600)).0, Mood::Unwell);
    assert_eq!(mood_of(1, date, &input(&info, &none, Sky::Clear, Activity::Sleep, 600)).0, Mood::Sleepy);
    // over many people, storms make for more sad and cross faces than sunshine
    let mut sad_storm = 0;
    let mut sad_sun = 0;
    for d in 0..300 {
        let dd = FIRST_DAY + d;
        let info = day_info(dd);
        let low = |m: Mood| matches!(m, Mood::Sad | Mood::Cross | Mood::Tired);
        if low(mood_of(1, dd, &input(&info, &none, Sky::Storm, Activity::Leisure, 600)).0) {
            sad_storm += 1;
        }
        if low(mood_of(1, dd, &input(&info, &none, Sky::Clear, Activity::Leisure, 600)).0) {
            sad_sun += 1;
        }
    }
    assert!(sad_storm > sad_sun, "{sad_storm} vs {sad_sun}");
    // someone courting is in love; someone in a quarrel is not
    let love = feelings::Tie { a: "res_1".into(), b: "res_9".into(), kind: TieKind::Courting, state: TieState::Fine, admirer: None, days: 3 };
    let fight = feelings::Tie { a: "res_1".into(), b: "res_7".into(), kind: TieKind::Friends, state: TieState::Quarrel, admirer: None, days: 0 };
    let ties = [&love];
    let m = mood_of(1, date, &input(&info, &ties, Sky::Cloudy, Activity::Leisure, 600));
    assert_eq!(m, (Mood::InLove, "love"));
    let ties = [&fight];
    let n = (0..60).filter(|d| matches!(mood_of(1, FIRST_DAY + d, &input(&day_info(FIRST_DAY + d), &ties, Sky::Cloudy, Activity::Leisure, 600)).0, Mood::Cross | Mood::Sad)).count();
    assert!(n > 40, "a quarrel spoils most days: {n}");
}

#[test]
fn warmth_fades_when_people_are_left_alone_and_promises_are_remembered() {
    let rel = Relation { points: 600, met: true, last: Some(10), ..Default::default() };
    assert_eq!(effective_points(&rel, 20, 0), 600);
    assert_eq!(effective_points(&rel, 31, 0), 600);
    assert!(effective_points(&rel, 60, 0) < 600);
    assert_eq!(effective_points(&rel, 10_000, 0), 240, "never below two fifths");
    assert_eq!(effective_points(&rel, 20, 2), 480);
    assert_eq!(feelings::warmth_of(None, 0), Warmth::Stranger);
    assert_eq!(feelings::warmth_of(Some(&rel), 600), Warmth::Close);
    assert_eq!(feelings::warmth_of(Some(&rel), 800), Warmth::Dear);
}

#[test]
fn talking_to_a_resident_warms_them_and_the_view_tells_it_in_words() {
    let mut core = world(11);
    let t = at(1, 11 * 60);
    core.apply_all(t, Command::Travel { to: "village".into() }).unwrap();
    let who = core.town_people(t)[0].id.clone();
    core.apply_all(t, Command::Talk { npc: who.clone() }).unwrap();
    let rel = core.state().relations.get(&who).cloned().unwrap();
    assert!(rel.met && rel.points > 0 && rel.last == Some(1));
    // a second word the same day is fine but warms no more
    core.apply_all(WorldTime(t.0 + 1), Command::Talk { npc: who.clone() }).unwrap();
    assert_eq!(core.state().relations[&who].points, rel.points);
    let v = core.feelings_view(WorldTime(t.0 + 2));
    let w = v.warmth.iter().find(|w| w.id == who).expect("someone met is in the view");
    assert_eq!(w.level, Warmth::Known);
    assert!(!w.words.is_empty() && !w.greet.is_empty());
    assert!(!w.words.chars().any(|c| c.is_ascii_digit()), "words, not numbers: {}", w.words);
    assert!(w.confide.is_none(), "a stranger keeps their secrets");
    assert!(!v.residents.is_empty());
    assert!(v.residents.iter().all(|r| !r.why.is_empty()));
}

#[test]
fn a_close_friend_has_a_little_something_now_and_then_and_gives_it_once() {
    let mut core = world(12);
    let t0 = at(1, 11 * 60);
    core.apply_all(t0, Command::Travel { to: "village".into() }).unwrap();
    let who = core.town_people(t0).iter().find(|r| r.age == "adult").unwrap().id.clone();
    // a friendship grown over many days of talks
    for d in 1..40u64 {
        core.apply_all(at(d, 11 * 60 + d % 7), Command::Talk { npc: who.clone() }).unwrap();
    }
    assert!(core.warmth(at(40, 600), &who) >= Warmth::Close);
    let mut gave = 0;
    for d in 40..120u64 {
        let t = at(d, 12 * 60);
        core.apply_all(t, Command::Talk { npc: who.clone() }).unwrap();
        let v = core.feelings_view(t);
        let w = v.warmth.iter().find(|w| w.id == who).unwrap();
        assert!(w.confide.is_some(), "a close friend shares a secret");
        match core.apply_all(t, Command::AcceptGift { who: who.clone() }) {
            Ok(_) => {
                assert!(w.gift, "the view said so");
                gave += 1;
                assert_eq!(core.apply_all(WorldTime(t.0 + 1), Command::AcceptGift { who: who.clone() }).unwrap_err(), CoreError::AlreadyDone);
            }
            Err(e) => {
                assert!(!w.gift, "{e:?}");
                assert_eq!(e, CoreError::NotToday);
            }
        }
    }
    assert!(gave >= 2 && gave <= 20, "now and then: {gave}");
}

#[test]
fn the_feelings_are_the_same_on_every_device() {
    let a = world(21);
    let b = world(21);
    let t = at(3, 17 * 60);
    assert_eq!(a.feelings_view(t), b.feelings_view(t));
}
