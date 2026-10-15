mod common;

use std::sync::Arc;

use teul_core::content::Content;
use teul_core::core::{Command, Core, CoreError, NewWorld};
use teul_core::npc::{self, MAX_POINTS, POINTS_PER_HEART, TALKS_PER_DAY, TALK_POINTS};
use teul_core::storage::{MemoryStorage, SqliteStorage};
use teul_core::time::{WorldTime, MINUTES_PER_DAY};

const PEOPLE: &str = r##"{
  "schema": 1, "id": "people", "version": 1,
  "items": [
    { "id": "pie", "name": "item.pie", "category": "decor", "footprint": { "w": 1, "d": 1 }, "layer": "surface", "acquire": { "coins": 0 } },
    { "id": "brick", "name": "item.brick", "category": "decor", "footprint": { "w": 1, "d": 1 }, "layer": "floor", "acquire": { "coins": 0 } },
    { "id": "statue", "name": "item.statue", "category": "village", "footprint": { "w": 1, "d": 1 }, "layer": "floor", "acquire": "free", "hidden": true }
  ],
  "locations": [{
    "id": "village", "name": "Село",
    "w": 6, "h": 4,
    "tiles": ["gggggg", "gssssg", "gssssg", "gggggg"],
    "legend": { "g": "floor.oak", "s": "floor.oak" },
    "props": [{ "item": "plant", "x": 0, "y": 0 }],
    "places": [
      { "id": "square", "name": "Площа", "x": 1, "y": 1, "w": 4, "h": 2, "activity": "chat" },
      { "id": "house_a", "name": "Дім Олі", "x": 0, "y": 3, "w": 1, "h": 1, "activity": "sleep" },
      { "id": "park", "name": "Парк", "x": 5, "y": 0, "w": 1, "h": 4, "activity": "walk" }
    ],
    "entry": [0, 0]
  }],
  "npcs": [
    {
      "id": "olia", "name": "Оля", "home": "house_a",
      "likes": ["plants", "pie"], "dislikes": ["brick"],
      "routine": [
        { "from": 480, "to": 720, "places": [["square", 3], ["park", 1]] },
        { "from": 720, "to": 1080, "places": [["park", 1]] }
      ],
      "lines": [{ "text": "Привіт!" }],
      "gifts": [{ "hearts": 1, "item": "vase" }]
    },
    {
      "id": "taras", "name": "Тарас", "home": "house_a",
      "routine": [{ "from": 600, "to": 900, "places": [["square", 1]], "days": [0, 1] }]
    }
  ]
}"##;

fn content() -> Arc<Content> {
    Arc::new(Content::from_packs(&[common::PACK, PEOPLE]).expect("the people pack is valid"))
}

fn world() -> Core<MemoryStorage> {
    Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 7, epoch_unix_secs: 1_700_000_000 }, content()).unwrap()
}

fn at(day: u64, minute: u64) -> WorldTime {
    WorldTime(day * MINUTES_PER_DAY + minute)
}

fn talk(npc: &str) -> Command {
    Command::Talk { npc: npc.into() }
}

fn view_of(core: &Core<MemoryStorage>, now: WorldTime, id: &str) -> teul_core::view::NpcView {
    core.npc_view(now).into_iter().find(|n| n.id == id).unwrap()
}

#[test]
fn where_someone_is_depends_only_on_the_seed_and_the_time() {
    let a = world();
    let b = world();
    for day in 0..20 {
        for minute in [0, 500, 700, 800, 1200] {
            assert_eq!(a.npc_view(at(day, minute)), b.npc_view(at(day, minute)));
        }
    }
    let other = Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 8, epoch_unix_secs: 1_700_000_000 }, content()).unwrap();
    let morning = |c: &Core<MemoryStorage>| (0..40).map(|d| view_of(c, at(d, 500), "olia").place).collect::<Vec<_>>();
    assert_ne!(morning(&a), morning(&other), "a different seed gives different days");
}

#[test]
fn the_routine_puts_people_inside_their_places_and_home_outside_every_slot() {
    let core = world();
    let c = content();
    let mut squares = 0;
    for day in 0..60 {
        let v = view_of(&core, at(day, 600), "olia");
        assert!(v.place == "square" || v.place == "park", "{}", v.place);
        assert_eq!(v.location, "village");
        squares += usize::from(v.place == "square");
        let p = &c.places[&v.place];
        assert!(v.x >= p.x && v.x < p.x + p.w && v.y >= p.y && v.y < p.y + p.h);
        assert_eq!(v.since, day * MINUTES_PER_DAY + 480);
        assert_eq!(v.arrives, v.since + npc::TRAVEL_MINUTES);
        assert_eq!(view_of(&core, at(day, 800), "olia").place, "park");
        assert_eq!(view_of(&core, at(day, 1300), "olia").place, "house_a");
    }
    assert!((30..60).contains(&squares), "weights 3:1 should favour the square, got {squares}/60");
}

#[test]
fn weekly_slots_apply_only_on_their_days() {
    let core = world();
    for day in 0..14 {
        let place = view_of(&core, at(day, 700), "taras").place;
        let expected = if day % 7 < 2 { "square" } else { "house_a" };
        assert_eq!(place, expected, "day {day}");
    }
}

#[test]
fn walking_starts_where_they_were_before() {
    let core = world();
    let v = view_of(&core, at(3, 800), "olia");
    let before = view_of(&core, at(3, 719), "olia");
    assert_eq!((v.from_place.as_str(), v.from_x, v.from_y), (before.place.as_str(), before.x, before.y));
}

#[test]
fn only_the_first_talk_of_a_day_counts_and_talks_are_capped() {
    let mut core = world();
    core.apply_all(at(1, 500), talk("olia")).unwrap();
    core.apply_all(at(1, 501), talk("olia")).unwrap();
    let v = view_of(&core, at(1, 502), "olia");
    assert_eq!((v.points, v.talks_today, v.met, v.talked_today), (TALK_POINTS, 2, true, true));
    for i in 2..TALKS_PER_DAY {
        core.apply_all(at(1, 502 + u64::from(i)), talk("olia")).unwrap();
    }
    assert!(matches!(core.apply_all(at(1, 600), talk("olia")), Err(CoreError::TooSoon)));
    core.apply_all(at(2, 500), talk("olia")).unwrap();
    let v = view_of(&core, at(2, 501), "olia");
    assert_eq!((v.points, v.talks_today), (2 * TALK_POINTS, 1));
    assert!(matches!(core.apply_all(at(2, 600), talk("nobody")).map(|_| ()), Err(CoreError::UnknownNpc(_))));
}

#[test]
fn gifts_follow_taste_use_up_the_item_and_one_a_day() {
    let mut core = world();
    core.apply_all(at(0, 10), Command::Acquire { item: "pie".into() }).unwrap();
    core.apply_all(at(0, 11), Command::Acquire { item: "brick".into() }).unwrap();
    core.apply_all(at(0, 12), Command::Gift { npc: "olia".into(), item: "pie".into() }).unwrap();
    assert_eq!(core.free_count("pie"), 0);
    let v = view_of(&core, at(0, 13), "olia");
    assert_eq!((v.points as i32, v.tastes.get("pie").copied()), (npc::GIFT_LIKED, Some(1)));
    assert!(matches!(core.apply_all(at(0, 14), Command::Gift { npc: "olia".into(), item: "brick".into() }), Err(CoreError::TooSoon)));
    assert!(matches!(core.apply_all(at(1, 14), Command::Gift { npc: "olia".into(), item: "pie".into() }), Err(CoreError::NotOwned(_))));
    core.apply_all(at(1, 15), Command::Gift { npc: "olia".into(), item: "brick".into() }).unwrap();
    let v = view_of(&core, at(1, 16), "olia");
    assert_eq!((v.points as i32, v.tastes.get("brick").copied()), (npc::GIFT_LIKED + npc::GIFT_DISLIKED, Some(-1)));
}

#[test]
fn friendship_never_drops_below_zero_or_above_the_maximum() {
    let mut core = world();
    core.apply_all(at(0, 1), Command::Acquire { item: "brick".into() }).unwrap();
    core.apply_all(at(0, 2), Command::Gift { npc: "olia".into(), item: "brick".into() }).unwrap();
    assert_eq!(view_of(&core, at(0, 3), "olia").points, 0, "a disliked first gift cannot go below zero");
    for day in 0..80 {
        core.apply_all(at(day, 5), talk("taras")).unwrap();
    }
    let v = view_of(&core, at(80, 0), "taras");
    assert_eq!((v.points, v.hearts), (MAX_POINTS, MAX_POINTS / POINTS_PER_HEART));
}

#[test]
fn a_gift_back_comes_once_at_its_heart() {
    let mut core = world();
    let mut gifts = 0;
    for day in 0..20 {
        let events = core.apply_all(at(day, 5), talk("olia")).unwrap();
        gifts += events.iter().filter(|e| matches!(&e.kind, teul_core::event::EventKind::NpcGaveGift { item, .. } if item == "vase")).count();
        if view_of(&core, at(day, 6), "olia").hearts < 1 {
            assert_eq!(gifts, 0, "no gift before the heart");
        }
    }
    assert_eq!(gifts, 1);
    assert_eq!(core.free_count("vase"), 1);
    assert_eq!(view_of(&core, at(20, 0), "olia").received, vec!["vase".to_string()]);
}

#[test]
fn invitations_need_two_hearts_and_a_sane_visit() {
    let mut core = world();
    let invite = |from, until| Command::Invite { npc: "olia".into(), from, until };
    assert!(matches!(core.apply_all(at(0, 0), invite(at(0, 1000).0, at(0, 1100).0)), Err(CoreError::NotFriendsYet)));
    for day in 0..20 {
        core.apply_all(at(day, 5), talk("olia")).unwrap();
    }
    let now = at(20, 600);
    assert!(matches!(core.apply_all(now, invite(now.0 - 1, now.0 + 60)), Err(CoreError::BadVisit)));
    assert!(matches!(core.apply_all(now, invite(now.0, now.0)), Err(CoreError::BadVisit)));
    assert!(matches!(core.apply_all(now, invite(now.0, now.0 + npc::VISIT_MAX_MINUTES + 1)), Err(CoreError::BadVisit)));
    core.apply_all(now, invite(now.0 + 60, now.0 + 180)).unwrap();
    assert!(!view_of(&core, WorldTime(now.0 + 59), "olia").visiting);
    let v = view_of(&core, WorldTime(now.0 + 60), "olia");
    assert!(v.visiting);
    assert_eq!(v.place, "home");
    assert!(!view_of(&core, WorldTime(now.0 + 180), "olia").visiting);
}

#[test]
fn a_talk_during_a_visit_brings_twice_the_friendship() {
    let mut core = world();
    for day in 0..20 {
        core.apply_all(at(day, 5), talk("olia")).unwrap();
    }
    let now = at(20, 600);
    core.apply_all(now, Command::Invite { npc: "olia".into(), from: now.0, until: now.0 + 120 }).unwrap();
    let before = view_of(&core, now, "olia").points;
    core.apply_all(WorldTime(now.0 + 10), talk("olia")).unwrap();
    assert_eq!(view_of(&core, WorldTime(now.0 + 11), "olia").points, before + 2 * TALK_POINTS);
}

#[test]
fn friendship_survives_reopening_the_world() {
    let mut core = Core::create_with(SqliteStorage::open_in_memory().unwrap(), 1, NewWorld { seed: 7, epoch_unix_secs: 1_700_000_000 }, content()).unwrap();
    for day in 0..3 {
        core.apply_all(at(day, 5), talk("olia")).unwrap();
    }
    let before = core.npc_view(at(3, 0));
    let reopened = Core::open_with(core.into_storage(), 1, content()).unwrap();
    assert_eq!(reopened.npc_view(at(3, 0)), before);
}

#[test]
fn content_with_unknown_places_or_gifts_is_refused() {
    let bad_place = PEOPLE.replacen(r#""home": "house_a""#, r#""home": "nowhere""#, 1);
    assert!(Content::from_packs(&[common::PACK, &bad_place]).is_err());
    let bad_gift = PEOPLE.replace(r#""item": "vase" }"#, r#""item": "unicorn" }"#);
    assert!(Content::from_packs(&[common::PACK, &bad_gift]).is_err());
    let bad_place_rect = PEOPLE.replace(r#""x": 5, "y": 0, "w": 1, "h": 4"#, r#""x": 5, "y": 0, "w": 3, "h": 4"#);
    assert!(Content::from_packs(&[common::PACK, &bad_place_rect]).is_err());
    let no_weight = PEOPLE.replace(r#"[["park", 1]] }"#, r#"[["park", 0]] }"#);
    assert!(Content::from_packs(&[common::PACK, &no_weight]).is_err());
    let bad_tiles = PEOPLE.replace(r#""gggggg", "gssssg""#, r#""ggg", "gssssg""#);
    assert!(Content::from_packs(&[common::PACK, &bad_tiles]).is_err());
}

#[test]
fn going_home_between_slots_is_a_stay_bounded_by_the_slots_around_it() {
    let core = world();
    // olia's day: 480..720 and 720..1080; before 480 she is at home since midnight, after 1080 until midnight
    let morning = view_of(&core, at(4, 300), "olia");
    assert_eq!((morning.place.as_str(), morning.since, morning.until), ("house_a", at(4, 0).0, at(4, 480).0));
    let evening = view_of(&core, at(4, 1200), "olia");
    assert_eq!((evening.place.as_str(), evening.since, evening.until), ("house_a", at(4, 1080).0, at(5, 0).0));
    assert_eq!(evening.from_place, "park", "she walks home from where she was");
}

#[test]
fn a_persons_days_do_not_depend_on_who_else_lives_in_the_world() {
    let more = PEOPLE.replace(r#""npcs": ["#, r#""npcs": [ { "id": "aaa", "name": "А", "home": "house_a", "routine": [] },"#);
    let bigger = Arc::new(Content::from_packs(&[common::PACK, &more]).unwrap());
    let a = world();
    let b = Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 7, epoch_unix_secs: 1_700_000_000 }, bigger).unwrap();
    for day in 0..10 {
        assert_eq!(view_of(&a, at(day, 600), "olia").place, b.npc_view(at(day, 600)).into_iter().find(|n| n.id == "olia").unwrap().place);
    }
}

#[test]
fn free_things_are_no_gifts_and_hidden_things_cannot_be_had() {
    let mut core = world();
    core.apply_all(at(0, 1), Command::Acquire { item: "plant".into() }).unwrap();
    assert!(matches!(core.apply_all(at(0, 2), Command::Gift { npc: "olia".into(), item: "plant".into() }), Err(CoreError::NoGift)));
    assert!(matches!(core.apply_all(at(0, 3), Command::Acquire { item: "statue".into() }), Err(CoreError::UnknownItem(_))));
    assert!(core.shop_view(at(0, 4)).iter().all(|e| e.id != "statue"));
}

#[test]
fn an_invitation_is_for_today_or_tomorrow_at_most() {
    let mut core = world();
    for day in 0..20 {
        core.apply_all(at(day, 5), talk("olia")).unwrap();
    }
    let now = at(20, 600);
    assert!(matches!(core.apply_all(now, Command::Invite { npc: "olia".into(), from: now.0 + 2 * MINUTES_PER_DAY, until: now.0 + 2 * MINUTES_PER_DAY + 60 }), Err(CoreError::BadVisit)));
}

#[test]
fn a_kit_is_given_once_with_all_its_things() {
    let kit = PEOPLE.replace(r#""npcs": ["#, r#""kits": [{ "id": "house", "items": ["pie", "pie", "brick"], "styles": ["floor.oak"] }], "npcs": ["#);
    let content = Arc::new(Content::from_packs(&[common::PACK, &kit]).unwrap());
    let mut core = Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 7, epoch_unix_secs: 1_700_000_000 }, content).unwrap();
    core.apply_all(at(0, 1), Command::ClaimKit { kit: "house".into() }).unwrap();
    assert_eq!((core.free_count("pie"), core.free_count("brick")), (2, 1));
    assert_eq!(core.view(at(0, 2)).kits, vec!["house".to_string()]);
    assert!(matches!(core.apply_all(at(0, 3), Command::ClaimKit { kit: "house".into() }), Err(CoreError::AlreadyOwned)));
    assert!(matches!(core.apply_all(at(0, 3), Command::ClaimKit { kit: "castle".into() }), Err(CoreError::UnknownItem(_))));
}

#[test]
fn a_kit_claimed_twice_in_merged_logs_counts_once() {
    use teul_core::event::{Event, EventId, EventKind};
    use teul_core::state::DeltaState;
    let claim = |device: u32| Event {
        id: EventId { device, seq: 1 },
        time: WorldTime(5),
        rules_version: 2,
        kind: EventKind::KitClaimed { kit: "house".into(), items: vec!["pie".into()], styles: vec![] },
        chain: 0,
    };
    let mut state = DeltaState::default();
    state.apply(&claim(1));
    state.apply(&claim(2));
    assert_eq!(state.owned.get("pie"), Some(&1));
}
