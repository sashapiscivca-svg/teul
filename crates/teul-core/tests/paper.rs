//! The morning paper: made fresh each world day from what happened, the same for everyone.

mod common;

use std::sync::Arc;

use teul_core::core::{Command, Core, CoreError, NewWorld};
use teul_core::storage::MemoryStorage;
use teul_core::time::{WorldTime, MINUTES_PER_DAY};

fn world() -> Core<MemoryStorage> {
    Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 3, epoch_unix_secs: common::AUTUMN_EPOCH }, Arc::new(common::economy())).unwrap()
}

fn at(day: u64, minute: u64) -> WorldTime {
    WorldTime(day * MINUTES_PER_DAY + minute)
}

#[test]
fn the_paper_has_a_name_a_number_and_the_real_date() {
    let core = world();
    let paper = core.paper_view(at(1, 420));
    assert_eq!(paper.title, "Липовий вісник");
    assert_eq!(paper.day, 1);
    assert_eq!(paper.number, 2);
    assert_eq!(paper.date, "11 жовтня");
    assert!(!paper.headline.title.is_empty());
    // the same paper for the same morning, however often it is asked for
    assert_eq!(paper, core.paper_view(at(1, 900)));
    assert_eq!(paper, world().paper_view(at(1, 420)));
}

#[test]
fn the_paper_tells_of_help_wanted_and_the_weather() {
    let core = world();
    let paper = core.paper_view(at(0, 420));
    assert!(paper.asks.iter().any(|l| l.contains("Ліхтар")), "{:?}", paper.asks);
    assert!(paper.asks.iter().all(|l| !l.contains("Ще раз")), "a help that is not open yet is not advertised");
    assert_ne!(paper.weather.today, "");
    assert_ne!(paper.weather.tomorrow, "");
    assert!(paper.ads.iter().any(|l| l.contains("Купити хліб")), "{:?}", paper.ads);
}

#[test]
fn what_the_player_tells_a_journalist_is_printed_the_next_morning() {
    let mut core = world();
    assert!(core.paper_view(at(1, 420)).interview.is_none());
    core.apply_all(at(0, 700), Command::Interview { question: 0, answer: 1 }).unwrap();
    assert_eq!(core.apply_all(at(0, 701), Command::Interview { question: 1, answer: 0 }).err(), Some(CoreError::TooSoon));
    assert_eq!(core.apply_all(at(1, 700), Command::Interview { question: 9, answer: 0 }).err(), Some(CoreError::NoRequest));
    let interview = core.paper_view(at(1, 420)).interview.expect("printed");
    assert_eq!(interview.question, "Як вам осінь у Липовому?");
    assert_eq!(interview.answer, "Холодно, але гарно");
    // only the next morning
    assert!(core.paper_view(at(0, 900)).interview.is_none());
    assert!(core.paper_view(at(2, 420)).interview.is_none());
}

#[test]
fn the_plant_story_unfolds_by_the_real_calendar() {
    use teul_core::npp::{npp_at, npp_day};
    use teul_core::time::days_from_civil;
    assert!(npp_at(days_from_civil(2026, 9, 30)).is_none(), "nothing before the rumour");
    assert_eq!(npp_at(days_from_civil(2026, 10, 11)).unwrap().id, "rumour");
    assert_eq!(npp_at(days_from_civil(2026, 10, 26)).unwrap().id, "announced");
    let hearing = npp_at(days_from_civil(2026, 11, 14)).unwrap();
    assert_eq!((hearing.id, hearing.event), ("hearing", Some("hearing")));
    assert_eq!(npp_at(days_from_civil(2026, 12, 5)).unwrap().event, Some("protest"));
    assert_eq!(npp_at(days_from_civil(2026, 12, 6)).unwrap().event, None);
    // the building on the horizon grows between the site and the launch, never back
    let mut last = 0;
    for d in (npp_day("rumour").unwrap()..days_from_civil(2032, 1, 1)).step_by(17) {
        let b = npp_at(d).unwrap().built;
        assert!(b >= last);
        last = b;
    }
    assert_eq!(npp_at(days_from_civil(2027, 2, 1)).unwrap().built, 0);
    assert!(npp_at(days_from_civil(2028, 6, 1)).unwrap().built > 200);
    assert_eq!(last, 1000);
}

#[test]
fn the_paper_carries_the_plant_news_with_a_photo_on_its_day() {
    let core = world();
    // 26 October 2026 is the sixteenth world day of this world (day 0 is 10 October)
    let paper = core.paper_view(at(16, 420));
    let all: Vec<_> = std::iter::once(&paper.headline).chain(paper.stories.iter()).collect();
    let npp = all.iter().find(|s| s.id == "npp:announced").expect("the announcement is in the paper");
    assert!(npp.title.contains("атомну"));
    assert!(npp.photo.is_some());
    assert!(npp.text.len() < 300, "short");
}

#[test]
fn every_story_has_a_photo_and_the_paper_is_short() {
    let core = world();
    for day in 0..40 {
        let p = core.paper_view(at(day, 420));
        assert!(p.headline.photo.is_some(), "day {day}: the front page has a photo");
        assert!(p.stories.len() <= 3 && p.town.len() <= 3 && p.asks.len() <= 4 && p.ads.len() <= 3 && p.events.len() <= 3);
    }
}

#[test]
fn a_feast_makes_the_front_page() {
    use teul_core::paper::feast_story;
    let core = world();
    // 11 November: the lantern night (day 32)
    let p = core.paper_view(at(32, 420));
    let all: Vec<_> = std::iter::once(&p.headline).chain(p.stories.iter()).collect();
    assert!(all.iter().any(|s| s.id == "feast:lantern_night"), "{:?}", all.iter().map(|s| &s.id).collect::<Vec<_>>());
    // every festive day of the calendar has its story
    for id in teul_core::holidays::ids() {
        let d = teul_core::holidays::date_of(id, 2027).unwrap();
        // (the rift days are their own story, told elsewhere)
        if teul_core::holidays::holiday(d).is_some_and(|h| h.festive && h.id == id && !teul_core::holidays::rift_day(d)) {
            assert!(feast_story(id).is_some(), "{id} has no story");
        }
    }
}

#[test]
fn the_paper_tells_of_the_getting_ready_and_the_clean_up() {
    let core = world();
    // the lantern night is on 11 November (day 32): getting ready on the days before, clearing up after
    let prep = core.paper_view(at(31, 420));
    let all: Vec<_> = std::iter::once(&prep.headline).chain(prep.stories.iter()).map(|s| s.id.clone()).collect();
    assert!(all.iter().any(|id| id.starts_with("prep:lantern_night")), "{all:?}");
    let after = core.paper_view(at(33, 420));
    let all: Vec<_> = std::iter::once(&after.headline).chain(after.stories.iter()).map(|s| s.id.clone()).collect();
    assert!(all.iter().any(|id| id == "after:lantern_night"), "{all:?}");
}
