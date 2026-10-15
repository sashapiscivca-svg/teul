use std::sync::Arc;

use teul_core::content::Content;
use teul_core::core::{Core, NewWorld};
use teul_core::life::{dump_fill, IncidentKind, DUMP_ROUND};
use teul_core::storage::MemoryStorage;
use teul_core::time::{WorldTime, MINUTES_PER_DAY};

fn base() -> Arc<Content> {
    Arc::new(Content::from_packs(&[include_str!("../../../content/base/pack.json")]).expect("the base pack is valid"))
}

#[test]
fn the_dump_fills_day_by_day_spills_over_and_is_cleared() {
    for seed in [1, 7, 99] {
        let fills: Vec<u32> = (0..DUMP_ROUND * 2).map(|d| dump_fill(seed, d)).collect();
        let drops = fills.windows(2).filter(|w| w[1] < w[0]).count();
        assert_eq!(drops, 2, "cleared once a round: {fills:?}");
        assert!(fills.iter().any(|&f| f > 100), "it spills over before the clean-up: {fills:?}");
        assert!(fills.windows(2).all(|w| w[1] >= w[0] || w[1] == 0), "between clean-ups it only grows");
    }
    assert_ne!((0..DUMP_ROUND).map(|d| dump_fill(1, d)).collect::<Vec<_>>(), (0..DUMP_ROUND).map(|d| dump_fill(2, d)).collect::<Vec<_>>(), "each world on its own days");
}

#[test]
fn the_village_hears_when_the_dump_is_full_and_when_it_is_cleared() {
    let c = Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 5, epoch_unix_secs: 0 }, base()).unwrap();
    let mut kinds = std::collections::BTreeSet::new();
    for day in (8..8 + DUMP_ROUND * 2).step_by(5) {
        let v = c.life_view(WorldTime(day * MINUTES_PER_DAY + 20 * 60));
        assert_eq!(v.dump, dump_fill(5, day));
        assert!(v.news.windows(2).all(|w| w[0].minute <= w[1].minute), "news in order");
        for n in v.news.iter().filter(|n| matches!(n.kind, IncidentKind::DumpFull | IncidentKind::DumpCleared)) {
            assert!(!n.text.is_empty());
            kinds.insert(format!("{:?}", n.kind));
        }
    }
    assert_eq!(kinds.len(), 2, "{kinds:?}");
}

#[test]
fn the_dump_has_heaps_for_every_stage_and_rubbish_over_the_fence() {
    let c = base();
    let dump = &c.locations["dump"];
    let stages: std::collections::BTreeSet<u32> = dump.props.iter().map(|p| p.min_fill).collect();
    assert!(stages.len() >= 6, "{stages:?}");
    assert!(dump.props.iter().filter(|p| p.min_fill >= 100).count() >= 8, "an overfull dump spills over");
}
