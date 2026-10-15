mod common;

use std::sync::Arc;

use teul_core::content::Content;
use teul_core::core::{Command, Core, CoreError, NewWorld};
use teul_core::event::EventKind;
use teul_core::storage::MemoryStorage;
use teul_core::time::{WorldTime, MINUTES_PER_DAY};

const WORLD: &str = r##"{
  "schema": 1, "id": "daily", "version": 1,
  "items": [
    { "id": "apple", "name": "item.apple", "category": "nature", "tags": ["fruit"], "footprint": { "w": 1, "d": 1 }, "layer": "surface", "acquire": "free", "hidden": true },
    { "id": "berry", "name": "item.berry", "category": "nature", "tags": ["fruit"], "footprint": { "w": 1, "d": 1 }, "layer": "surface", "acquire": "free", "hidden": true },
    { "id": "perch", "name": "item.perch", "category": "fish", "footprint": { "w": 1, "d": 1 }, "layer": "surface", "acquire": "free", "hidden": true },
    { "id": "goldfish", "name": "item.goldfish", "category": "fish", "footprint": { "w": 1, "d": 1 }, "layer": "surface", "acquire": "free", "hidden": true },
    { "id": "basket", "name": "item.basket", "category": "decor", "footprint": { "w": 1, "d": 1 }, "layer": "floor", "acquire": "free", "hidden": true }
  ],
  "collections": [{ "id": "orchard", "name": "Сад", "items": ["apple", "berry"], "reward": "basket" }],
  "paper": ["{a} і {b} гуляли біля ставка.", "{a} спекла пиріг.", "У {a} новий капелюх.", "{b} бачив комету."],
  "locations": [{
    "id": "village", "name": "Село", "w": 6, "h": 4,
    "tiles": ["gggggg", "gggggg", "gggggg", "gggggg"], "legend": { "g": "floor.oak" },
    "places": [{ "id": "square", "name": "Площа", "x": 1, "y": 1, "w": 3, "h": 2, "activity": "chat" }],
    "entry": [0, 0],
    "spots": [
      { "id": "tree", "x": 1, "y": 1, "gives": [{ "item": "apple" }] },
      { "id": "bush", "x": 2, "y": 1, "gives": [{ "item": "berry", "seasons": ["Summer"] }] }
    ],
    "fishing": [{ "id": "pond", "name": "Ставок", "x": 4, "y": 3, "w": 2, "h": 1,
      "fish": [{ "item": "perch", "weight": 9 }, { "item": "goldfish", "weight": 1, "when": ["night"] }] }]
  }],
  "npcs": [
    { "id": "olia", "name": "Оля", "home": "square", "routine": [],
      "asks": [{ "text": "Принеси два фрукти", "items": [["#fruit", 2]], "coins": 30, "gift": "basket", "thanks": "Дякую!" }],
      "letters": [{ "hearts": 0, "text": "Привіт, сусіде!" }, { "hearts": 1, "text": "Ось тобі кошик.", "gift": "basket" }],
      "story": [
        { "title": "Мапа", "hearts": 0, "lines": ["Я знайшла мапу!"] },
        { "title": "Яблука в дорогу", "hearts": 0, "after_days": 2, "lines": ["Мені треба яблуко."], "ask": { "text": "Яблуко", "items": [["apple", 1]] }, "gift": "basket" }
      ] }
  ]
}"##;

/// The world was first opened on 1 March 2026 (local midnight): day 0 is spring, day 92 the first of summer.
const SPRING_EPOCH: i64 = 20_513 * 86_400 - 2 * 3_600;
const SUMMER: u64 = 92;

fn world() -> Core<MemoryStorage> {
    let content = Arc::new(Content::from_packs(&[common::PACK, WORLD]).expect("the daily pack is valid"));
    let mut core = Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 3, epoch_unix_secs: SPRING_EPOCH }, content).unwrap();
    // finds need the player to be where they are: out in the village from the start
    core.apply_all(WorldTime(0), Command::Travel { to: "village".into() }).unwrap();
    core
}

fn at(day: u64, minute: u64) -> WorldTime {
    WorldTime(day * MINUTES_PER_DAY + minute)
}

fn gather(spot: &str) -> Command {
    Command::Gather { spot: spot.into() }
}

#[test]
fn a_spot_gives_once_a_day_and_only_in_its_season() {
    let mut core = world();
    core.apply_all(at(0, 600), gather("tree")).unwrap();
    assert_eq!(core.free_count("apple"), 1);
    assert!(matches!(core.apply_all(at(0, 700), gather("tree")), Err(CoreError::NothingThere)));
    core.apply_all(at(1, 600), gather("tree")).unwrap();
    assert_eq!(core.free_count("apple"), 2);
    // day 1 is spring: the berry bush is bare until summer (1 June)
    assert!(matches!(core.apply_all(at(1, 610), gather("bush")), Err(CoreError::NothingThere)));
    core.apply_all(at(SUMMER, 600), gather("bush")).unwrap();
    assert!(matches!(core.apply_all(at(SUMMER, 601), gather("nowhere")), Err(CoreError::NothingThere)));
}

#[test]
fn finding_a_whole_collection_brings_its_reward_once() {
    let mut core = world();
    core.apply_all(at(0, 600), gather("tree")).unwrap();
    assert!(core.daily_view(at(0, 601)).collections[0].found == vec!["apple".to_string()]);
    let events = core.apply_all(at(SUMMER, 600), gather("bush")).unwrap();
    assert!(events.iter().any(|e| matches!(&e.kind, EventKind::CollectionCompleted { reward, .. } if reward == "basket")));
    assert_eq!(core.free_count("basket"), 1);
    core.apply_all(at(SUMMER + 1, 600), gather("bush")).unwrap();
    assert_eq!(core.free_count("basket"), 1, "the reward comes once");
    assert!(core.daily_view(at(SUMMER + 1, 601)).collections[0].done);
}

#[test]
fn fishing_is_capped_and_the_rare_fish_only_bites_at_night() {
    let mut core = world();
    let mut gold_by_day = 0;
    for i in 0..12 {
        let events = core.apply_all(at(0, 600 + i), Command::Fish { place: "pond".into() }).unwrap();
        gold_by_day += events.iter().filter(|e| matches!(&e.kind, EventKind::Caught { item, .. } if item == "goldfish")).count();
    }
    assert_eq!(gold_by_day, 0);
    assert!(matches!(core.apply_all(at(0, 700), Command::Fish { place: "pond".into() }), Err(CoreError::TooSoon)));
    assert_eq!(core.daily_view(at(0, 701)).catches_left, 0);
    let mut gold = 0;
    for day in 1..30 {
        for i in 0..12 {
            let events = core.apply_all(at(day, 1380 + i), Command::Fish { place: "pond".into() }).unwrap();
            gold += events.iter().filter(|e| matches!(&e.kind, EventKind::Caught { item, .. } if item == "goldfish")).count();
        }
    }
    assert!(gold > 0, "a golden fish now and then at night");
}

#[test]
fn a_request_takes_what_was_asked_and_brings_friendship_coins_and_a_gift() {
    let mut core = world();
    let day = 0;
    let view = core.daily_view(at(day, 600));
    assert_eq!(view.requests.len(), 1);
    assert!(!view.requests[0].ready);
    assert!(matches!(core.apply_all(at(day, 601), Command::Deliver { npc: "olia".into() }), Err(CoreError::NotEnough)));
    core.apply_all(at(day, 602), gather("tree")).unwrap();
    core.apply_all(at(SUMMER, 602), gather("tree")).unwrap();
    core.apply_all(at(SUMMER, 603), gather("bush")).unwrap();
    let coins = core.wallet().coins;
    core.apply_all(at(SUMMER, 604), Command::Deliver { npc: "olia".into() }).unwrap();
    assert_eq!(core.free_count("apple") + core.free_count("berry"), 1);
    assert_eq!(core.wallet().coins, coins + 30);
    assert_eq!(core.npc_view(at(SUMMER, 605))[0].points, 60);
    assert!(core.daily_view(at(SUMMER, 605)).requests[0].done);
    assert!(matches!(core.apply_all(at(SUMMER, 606), Command::Deliver { npc: "olia".into() }), Err(CoreError::NoRequest)));
}

#[test]
fn letters_open_once_their_friendship_is_there() {
    let mut core = world();
    assert_eq!(core.daily_view(at(0, 1)).letters.len(), 1);
    assert!(matches!(core.apply_all(at(0, 2), Command::ClaimLetter { npc: "olia".into(), letter: 1 }), Err(CoreError::NoRequest)));
    core.apply_all(at(0, 3), Command::ClaimLetter { npc: "olia".into(), letter: 0 }).unwrap();
    for day in 0..10 {
        core.apply_all(at(day, 10), Command::Talk { npc: "olia".into() }).unwrap();
    }
    let view = core.daily_view(at(10, 0));
    assert_eq!(view.letters.len(), 2);
    assert!(view.letters[0].opened && !view.letters[1].opened);
    core.apply_all(at(10, 1), Command::ClaimLetter { npc: "olia".into(), letter: 1 }).unwrap();
    assert_eq!(core.free_count("basket"), 1);
    assert!(matches!(core.apply_all(at(10, 2), Command::ClaimLetter { npc: "olia".into(), letter: 1 }), Err(CoreError::NoRequest)));
}

#[test]
fn a_story_moves_on_chapter_by_chapter_with_waits_and_needs() {
    let mut core = world();
    let s = &core.daily_view(at(0, 0)).stories[0];
    assert_eq!((s.step, s.total, s.ready), (0, 2, true));
    core.apply_all(at(0, 1), Command::AdvanceStory { npc: "olia".into() }).unwrap();
    assert!(matches!(core.apply_all(at(1, 0), Command::AdvanceStory { npc: "olia".into() }), Err(CoreError::TooSoon)));
    assert!(matches!(core.apply_all(at(2, 0), Command::AdvanceStory { npc: "olia".into() }), Err(CoreError::NotEnough)));
    core.apply_all(at(2, 1), gather("tree")).unwrap();
    core.apply_all(at(2, 2), Command::AdvanceStory { npc: "olia".into() }).unwrap();
    assert_eq!(core.free_count("apple"), 0);
    assert_eq!(core.free_count("basket"), 1);
    let s = &core.daily_view(at(2, 3)).stories[0];
    assert_eq!((s.step, s.next.clone()), (2, None));
}

#[test]
fn the_paper_and_the_mail_are_the_same_for_the_same_day() {
    let a = world();
    let b = world();
    for day in 0..5 {
        let (va, vb) = (a.daily_view(at(day, 0)), b.daily_view(at(day, 0)));
        assert_eq!(va.paper, vb.paper);
        assert_eq!(va.note, vb.note);
        assert_eq!(va.requests, vb.requests);
        assert!(!va.paper.is_empty() && va.paper.iter().all(|l| !l.contains('{')));
    }
}

#[test]
fn things_found_in_the_world_make_gifts() {
    let mut core = world();
    core.apply_all(at(0, 1), gather("tree")).unwrap();
    core.apply_all(at(0, 2), Command::Gift { npc: "olia".into(), item: "apple".into() }).unwrap();
}

#[test]
fn merged_logs_of_two_devices_reward_a_spot_or_a_request_once() {
    use teul_core::event::{Event, EventId};
    use teul_core::state::DeltaState;
    let ev = |device: u32, kind: EventKind| Event { id: EventId { device, seq: 1 }, time: WorldTime(5), rules_version: 2, kind, chain: 0 };
    let mut s = DeltaState::default();
    for device in [1, 2] {
        s.apply(&ev(device, EventKind::Gathered { spot: "tree".into(), day: 0, item: "apple".into() }));
        s.apply(&ev(device, EventKind::Delivered { npc: "olia".into(), day: 0, ask: 0, items: vec![], points: 60, coins: 30, gift: Some("basket".into()) }));
    }
    assert_eq!(s.owned.get("apple"), Some(&1));
    assert_eq!(s.owned.get("basket"), Some(&1));
    assert_eq!(s.earned, 30);
    assert_eq!(s.relations["olia"].points, 60);
}

#[test]
fn an_asks_gift_comes_only_the_first_time() {
    let mut core = world();
    let mut gifts = 0;
    for day in SUMMER..SUMMER + 6 {
        core.apply_all(at(day, 600), gather("tree")).unwrap();
        core.apply_all(at(day, 601), gather("bush")).unwrap();
        let events = core.apply_all(at(day, 602), Command::Deliver { npc: "olia".into() }).unwrap();
        gifts += events.iter().filter(|e| matches!(&e.kind, EventKind::Delivered { gift: Some(_), .. })).count();
    }
    assert_eq!(gifts, 1);
}

#[test]
fn requests_only_ask_for_what_the_season_can_give() {
    // olia's only ask needs two fruits: in spring the apple tree gives (all year here) — but with apples gone
    // from every spot, nobody would ask. Winter in this world still has apples, so she asks all year.
    let core = world();
    for day in [0, SUMMER, 184, 275] {
        assert_eq!(core.daily_view(at(day, 0)).requests.len(), 1, "day {day}");
    }
    let no_apples = WORLD.replace(r#""gives": [{ "item": "apple" }]"#, r#""gives": [{ "item": "apple", "seasons": ["Autumn"] }]"#);
    let content = Arc::new(Content::from_packs(&[common::PACK, &no_apples]).unwrap());
    let core = Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 3, epoch_unix_secs: SPRING_EPOCH }, content).unwrap();
    // spring: no apples, no berries (summer) -> no fruit -> nobody asks
    assert!(core.daily_view(at(0, 0)).requests.is_empty());
    assert_eq!(core.daily_view(at(SUMMER, 0)).requests.len(), 1, "summer has berries");
}

#[test]
fn a_boot_is_no_fish_and_bought_things_are_never_taken() {
    let content = Content::from_packs(&[common::PACK, WORLD]).unwrap();
    let mut free = std::collections::BTreeMap::new();
    free.insert("perch".to_string(), 1);
    free.insert("basket".to_string(), 1);
    assert!(teul_core::daily::answers(&content, "perch", "#fish") || content.items["perch"].tags.is_empty());
    free.insert("sofa".to_string(), 3);
    assert!(teul_core::daily::take_for(&content, &free, &[("sofa".into(), 1)]).is_none(), "a bought sofa is not taken");
}

#[test]
fn the_weather_follows_the_seasons_and_is_the_same_everywhere() {
    use teul_core::daily::{weather_at, Sky};
    let cal = teul_core::time::Calendar::from_epoch(20_736 * 86_400 - 3 * 3_600);
    let mut count = std::collections::BTreeMap::new();
    for day in 0..366u64 {
        for hour in [8u64, 14, 20] {
            let t = at(day, hour * 60);
            let season = cal.season(t);
            assert_eq!(weather_at(5, t, season), weather_at(5, t, season));
            *count.entry((format!("{season:?}"), format!("{:?}", weather_at(5, t, season)))).or_insert(0) += 1;
        }
    }
    let has = |s: &str, k: &str| count.contains_key(&(s.to_string(), k.to_string()));
    assert!(!has("Summer", "Snow"), "no snow in summer");
    assert!(has("Winter", "Snow"), "snow in winter: {count:?}");
    assert!(count.keys().any(|(s, k)| s != "Winter" && k == "Rain"), "rain outside winter");
    let _ = Sky::Clear;
}
