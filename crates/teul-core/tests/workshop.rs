use std::sync::Arc;

use teul_core::content::Content;
use teul_core::core::{restore_price, Command, Core, CoreError, NewWorld};
use teul_core::daily::spot_has_today;
use teul_core::event::EventKind;
use teul_core::storage::MemoryStorage;
use teul_core::time::{WorldTime, MINUTES_PER_DAY};

fn base() -> Arc<Content> {
    Arc::new(Content::from_packs(&[include_str!("../../../content/base/pack.json")]).expect("the base pack is valid"))
}

fn noon(day: u64) -> WorldTime {
    WorldTime(day * MINUTES_PER_DAY + 12 * 60)
}

#[test]
fn a_bin_holds_a_worn_thing_only_now_and_then() {
    let content = base();
    let bins: Vec<_> = content.spots.values().filter(|s| s.id.contains(".bin.")).collect();
    assert!(bins.len() >= 20, "the streets have bins to look into: {}", bins.len());
    let mut full = 0;
    let mut days = 0;
    for bin in &bins {
        assert!(bin.gives.iter().all(|g| content.items[&g.item].restores.is_some()), "a bin gives worn things");
        for day in 0..60 {
            days += 1;
            full += u32::from(spot_has_today(7, bin, day));
        }
    }
    let share = f64::from(full) / f64::from(days);
    assert!((0.04..0.2).contains(&share), "bins should hold something now and then, not always: {share}");
}

#[test]
fn a_worn_thing_found_by_a_bin_is_mended_at_the_workshop_for_coins() {
    let content = base();
    let mut c = Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 3, epoch_unix_secs: 0 }, content.clone()).unwrap();
    // the bins are in the village's streets
    c.apply_all(WorldTime(0), Command::Travel { to: "village".into() }).unwrap();
    // find a bin with something in it today, and an empty one
    let bins: Vec<_> = content.spots.values().filter(|s| s.id.contains(".bin.")).cloned().collect();
    let (day, full) = (1..200).find_map(|d| bins.iter().find(|b| spot_has_today(3, b, d)).map(|b| (d, b.clone()))).expect("some bin fills up");
    let empty = bins.iter().find(|b| !spot_has_today(3, b, day)).unwrap();
    assert!(matches!(c.apply_all(noon(day), Command::Gather { spot: empty.id.clone() }), Err(CoreError::NothingThere)));
    assert!(c.daily_view(noon(day)).gathered_today.contains(&empty.id), "an empty bin is not shown as holding something");

    let found = c.apply_all(noon(day), Command::Gather { spot: full.id.clone() }).unwrap();
    let worn = match &found[0].kind {
        EventKind::Gathered { item, .. } => item.clone(),
        other => panic!("{other:?}"),
    };
    let into = content.items[&worn].restores.clone().unwrap();
    assert_eq!(c.free_count(&worn), 1);

    let price = restore_price(&content, &into);
    assert!(price >= 15);
    let coins = c.wallet().coins;
    c.apply_all(noon(day), Command::Restore { item: worn.clone() }).unwrap();
    assert_eq!(c.free_count(&worn), 0);
    assert_eq!(c.free_count(&into), 1, "the mended thing is ready to put in the house");
    assert_eq!(c.wallet().coins, coins - u64::from(price));
    // nothing left to mend
    assert!(matches!(c.apply_all(noon(day), Command::Restore { item: worn }), Err(CoreError::NotEnough)));
    // only worn things can be mended
    assert!(c.apply_all(noon(day), Command::Restore { item: into }).is_err());
}

#[test]
fn mending_needs_the_coins() {
    let content = base();
    let mut c = Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 3, epoch_unix_secs: 0 }, content.clone()).unwrap();
    let bins: Vec<_> = content.spots.values().filter(|s| s.id.contains(".bin.")).cloned().collect();
    c.apply_all(WorldTime(0), Command::Travel { to: "village".into() }).unwrap();
    // spend the money first (a little at a time: forty a minute is the most a person does)
    let mut t = noon(0).0;
    while c.apply_all(WorldTime(t), Command::Acquire { item: "stool".into() }).is_ok() {
        t += 1;
    }
    let (day, full) = (1..200).find_map(|d| bins.iter().find(|b| spot_has_today(3, b, d)).map(|b| (d, b.clone()))).unwrap();
    let found = c.apply_all(noon(day), Command::Gather { spot: full.id }).unwrap();
    let EventKind::Gathered { item, .. } = &found[0].kind else { panic!() };
    if restore_price(&content, content.items[item].restores.as_ref().unwrap()) > c.wallet().coins as u32 {
        assert!(matches!(c.apply_all(noon(day), Command::Restore { item: item.clone() }), Err(CoreError::Locked(_))));
    }
}
