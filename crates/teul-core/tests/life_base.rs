use std::sync::Arc;

use teul_core::content::Content;
use teul_core::core::{Core, NewWorld};
use teul_core::storage::MemoryStorage;
use teul_core::time::{WorldTime, MINUTES_PER_DAY};

/// The real village over a season: the life engine makes stories of every kind, quickly enough for a phone.
#[test]
fn the_base_village_lives_a_season_with_every_kind_of_story() {
    let content = Arc::new(Content::from_packs(&[include_str!("../../../content/base/pack.json")]).unwrap());
    let core = Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 99, epoch_unix_secs: 1_700_000_000 }, content).unwrap();
    let started = std::time::Instant::now();
    let mut kinds = std::collections::BTreeMap::new();
    for day in (7..=91).step_by(7) {
        for i in core.life_view(WorldTime(day * MINUTES_PER_DAY)).incidents {
            if i.minute >= (day - 7) * MINUTES_PER_DAY {
                *kinds.entry(format!("{:?}", i.kind)).or_insert(0) += 1;
            }
        }
    }
    eprintln!("a season: {kinds:?} in {:?}", started.elapsed());
    for k in ["Ill", "Delivery", "Fire", "Theft"] {
        assert!(kinds.contains_key(k), "no {k}: {kinds:?}");
    }
}

/// The journalists of «Липовий вісник» go out on working days and interview people where they are: the stuff
/// of the paper to come.
#[test]
fn journalists_interview_the_villagers_where_they_are() {
    let content = Arc::new(Content::from_packs(&[include_str!("../../../content/base/pack.json")]).unwrap());
    let core = Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 7, epoch_unix_secs: 1_700_000_000 }, content.clone()).unwrap();
    let view = core.life_view(WorldTime(14 * MINUTES_PER_DAY));
    let interviews: Vec<_> = view.incidents.iter().filter(|i| format!("{:?}", i.kind) == "Interview").collect();
    assert!(interviews.len() >= 10, "a week of interviews: {}", interviews.len());
    let journalist = |id: &String| content.residents[id].job.as_ref().is_some_and(|(_, r)| r == "journalist" || r == "photographer");
    for i in &interviews {
        assert_eq!(i.who.len(), 2);
        assert!(journalist(&i.who[0]), "{} is no journalist", i.who[0]);
        assert_ne!(i.who[0], i.who[1], "nobody interviews themselves");
    }
    let people: std::collections::BTreeSet<_> = interviews.iter().map(|i| i.who[1].clone()).collect();
    let places: std::collections::BTreeSet<_> = interviews.iter().map(|i| i.site.clone()).collect();
    assert!(people.len() >= 6 && places.len() >= 3, "all sorts of people in all sorts of places: {people:?} {places:?}");
    let told = view.news.iter().find(|n| format!("{:?}", n.kind) == "Interview").expect("interviews are in the news");
    assert!(told.text.contains("«Липовий вісник»") && told.text.contains("інтерв'ю"), "{}", told.text);
}
