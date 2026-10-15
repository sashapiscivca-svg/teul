use std::sync::Arc;

use teul_core::content::Content;
use teul_core::core::{Core, NewWorld};
use teul_core::storage::MemoryStorage;
use teul_core::time::{WorldTime, MINUTES_PER_DAY};

fn core() -> Core<MemoryStorage> {
    let content = Arc::new(Content::from_packs(&[include_str!("../../../content/base/pack.json")]).unwrap());
    Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 99, epoch_unix_secs: 1_700_000_000 }, content).unwrap()
}

/// What happened in town while the player was away: the happenings between two times, in order, within them.
#[test]
fn news_between_tells_what_happened_while_away() {
    let c = core();
    let from = WorldTime(20 * MINUTES_PER_DAY);
    let to = WorldTime(24 * MINUTES_PER_DAY);
    let news = c.news_between(from, to);
    assert!(!news.is_empty(), "four days in town and nothing happened?");
    assert!(news.iter().all(|n| n.minute >= from.0 && n.minute <= to.0));
    assert!(news.windows(2).all(|w| w[0].minute <= w[1].minute));
    assert!(news.iter().all(|n| !n.text.is_empty()));
    // the same answer every time (it is the town's history, not a draw)
    assert_eq!(news, c.news_between(from, to));
}

#[test]
fn a_long_absence_still_tells_the_last_week() {
    let c = core();
    let news = c.news_between(WorldTime(MINUTES_PER_DAY), WorldTime(40 * MINUTES_PER_DAY));
    assert!(!news.is_empty());
    // the town remembers a week back from `to`
    assert!(news.iter().all(|n| n.minute + 8 * MINUTES_PER_DAY >= 40 * MINUTES_PER_DAY));
}

#[test]
fn nothing_between_a_moment_and_itself_before_it() {
    let c = core();
    assert!(c.news_between(WorldTime(10 * MINUTES_PER_DAY), WorldTime(5 * MINUTES_PER_DAY)).is_empty());
}
