//! Caches must never change an answer: the life of the town asked in any order, and a save opened from a
//! verified snapshot, give exactly what a fresh core rebuilding everything gives.

use std::sync::Arc;

use teul_core::content::Content;
use teul_core::core::{Command, Core, NewWorld};
use teul_core::storage::{MemoryStorage, Storage};
use teul_core::time::WorldTime;

fn content() -> Arc<Content> {
    Arc::new(Content::from_packs(&[include_str!("../../../content/base/pack.json")]).expect("the base pack is valid"))
}

fn world(c: Arc<Content>) -> Core<MemoryStorage> {
    let mut storage = MemoryStorage::new();
    storage.meta_set(teul_core::core::META_SECRET, "987654321").unwrap();
    Core::bootstrap(storage, 1, NewWorld { seed: 11, epoch_unix_secs: 20_513 * 86_400 }, c).unwrap()
}

#[test]
fn the_town_asked_out_of_order_answers_as_a_fresh_one() {
    let c = content();
    let core = world(c.clone());
    let day = 9u64;
    let late = WorldTime(day * 1440 + 17 * 60 + 30);
    let midnight = WorldTime(day * 1440);
    let morning = WorldTime(day * 1440 + 9 * 60);
    // late first, then earlier moments of the same day (the paper asks for midnight after the street asked for now)
    let _ = core.life_view(late);
    let a = core.life_view(midnight);
    let b = core.life_view(morning);
    let again = core.life_view(late);
    let fresh = |t: WorldTime| world(c.clone()).life_view(t);
    assert_eq!(a, fresh(midnight));
    assert_eq!(b, fresh(morning));
    assert_eq!(again, fresh(late));
    // and the next day, then back
    let next = WorldTime((day + 1) * 1440 + 600);
    assert_eq!(core.life_view(next), fresh(next));
    assert_eq!(core.life_view(morning), fresh(morning));
}

#[test]
fn the_paper_is_the_same_whenever_it_is_read() {
    let c = content();
    let mut core = world(c.clone());
    let day = 5u64;
    let later = WorldTime(day * 1440 + 15 * 60);
    let _ = core.life_view(later);
    let p1 = serde_json::to_string(&core.paper_view(later)).unwrap();
    let p2 = serde_json::to_string(&world(c.clone()).paper_view(later)).unwrap();
    assert_eq!(p1, p2);
    let _ = core.apply_logged(WorldTime(later.0 + 1), Command::Travel { to: "village".into() });
}

// ---- verified snapshots -------------------------------------------------------------------------------------

use teul_core::rng::fnv1a64;

/// A little random play (seeded): travel, gathering, stations, talks, home edits, over several days.
fn script(core: &mut Core<MemoryStorage>, c: &Content, seed: u64, days: u64) {
    let mut r = seed.wrapping_mul(0x9E37_79B9_7F4A_7C15) | 1;
    let mut next = |n: usize| {
        r ^= r << 13;
        r ^= r >> 7;
        r ^= r << 17;
        (r % n.max(1) as u64) as usize
    };
    let places: Vec<String> = c.locations.keys().cloned().collect();
    let spots: Vec<String> = c.spots.keys().cloned().collect();
    let stations: Vec<String> = c.stations.keys().cloned().collect();
    let npcs: Vec<String> = c.npcs.keys().cloned().collect();
    for d in 0..days {
        let mut t = d * 1440 + 7 * 60 + next(60) as u64;
        for _ in 0..(20 + next(30)) {
            let cmd = match next(9) {
                0 => Command::Travel { to: places[next(places.len())].clone() },
                1 => Command::Travel { to: "home".into() },
                2 | 3 => Command::Gather { spot: spots[next(spots.len())].clone() },
                4 => Command::Use { station: stations[next(stations.len())].clone() },
                5 => Command::Talk { npc: npcs[next(npcs.len())].clone() },
                6 => Command::SetSetting { key: "time_mode".into(), value: if next(2) == 0 { "real".into() } else { "fixed".into() } },
                7 => {
                    let room = core.room_view();
                    match room.placements.get(next(room.placements.len().max(1))) {
                        Some(p) => Command::Rotate { pid: p.pid, rot: next(4) as u8 },
                        None => Command::PayAll,
                    }
                }
                _ => Command::PayAll,
            };
            let _ = core.apply_logged(WorldTime(t), cmd);
            t += 1 + next(3) as u64;
        }
    }
}

fn open_full(events: &[teul_core::event::Event], c: Arc<Content>) -> Core<MemoryStorage> {
    let mut s = MemoryStorage::new();
    s.meta_set(teul_core::core::META_SECRET, "987654321").unwrap();
    s.append_batch(events).unwrap();
    Core::bootstrap(s, 1, NewWorld { seed: 11, epoch_unix_secs: 20_513 * 86_400 }, c).unwrap()
}

#[test]
fn a_save_opened_from_its_snapshot_is_the_save_rebuilt_from_the_whole_log() {
    let c = content();
    for seed in 1..=6u64 {
        let mut core = world(c.clone());
        script(&mut core, &c, seed, 4 + seed % 3);
        let snap = core.latest_snapshot().expect("a snapshot is made as days pass");
        let storage = core.into_storage();
        let all = storage.events_after(None).unwrap();
        let full = open_full(&all, c.clone());
        // the shell keeps only what came after the snapshot in memory, and says how many came before
        let tail: Vec<_> = all.iter().filter(|e| e.sort_key() > snap.through).cloned().collect();
        let covered = (all.len() - tail.len()) as u64;
        let mut s = MemoryStorage::new();
        s.meta_set(teul_core::core::META_SECRET, "987654321").unwrap();
        s.append_batch(&tail).unwrap();
        let mut fast = Core::bootstrap_from_snapshot(s, 1, NewWorld { seed: 11, epoch_unix_secs: 20_513 * 86_400 }, c.clone(), snap, covered).expect("a valid snapshot is used");
        assert_eq!(fast.state(), full.state(), "seed {seed}");
        assert_eq!(fast.integrity().tampered, full.integrity().tampered);
        assert_eq!(fast.integrity().inputs, full.integrity().inputs);
        assert!(fast.integrity().from_snapshot);
        // and it goes on the same way
        let end = WorldTime(20 * 1440);
        let a = fast.apply_logged(end, Command::Travel { to: "village".into() }).map(|v| v.len()).unwrap_or(0);
        let mut full = full;
        let b = full.apply_logged(end, Command::Travel { to: "village".into() }).map(|v| v.len()).unwrap_or(0);
        assert_eq!(a, b);
        assert_eq!(fast.state(), full.state());
    }
}

#[test]
fn an_edited_snapshot_is_refused() {
    let c = content();
    let mut core = world(c.clone());
    script(&mut core, &c, 42, 5);
    let mut snap = core.latest_snapshot().unwrap();
    let all = core.into_storage().events_after(None).unwrap();
    let tail: Vec<_> = all.iter().filter(|e| e.sort_key() > snap.through).cloned().collect();
    let covered = (all.len() - tail.len()) as u64;
    snap.state.earned += 1_000_000; // a rich player, by hand
    let mut s = MemoryStorage::new();
    s.meta_set(teul_core::core::META_SECRET, "987654321").unwrap();
    s.append_batch(&tail).unwrap();
    assert!(Core::bootstrap_from_snapshot(s, 1, NewWorld { seed: 11, epoch_unix_secs: 20_513 * 86_400 }, c.clone(), snap.clone(), covered).is_err());
    // a snapshot that claims to cover more (or fewer) events than the log has is refused too
    let mut snap2 = core_snapshot(&c);
    snap2.1 += 1;
    let mut s = MemoryStorage::new();
    s.meta_set(teul_core::core::META_SECRET, "987654321").unwrap();
    s.append_batch(&snap2.2).unwrap();
    assert!(Core::bootstrap_from_snapshot(s, 1, NewWorld { seed: 11, epoch_unix_secs: 20_513 * 86_400 }, c, snap2.0, snap2.1).is_err());
}

fn core_snapshot(c: &Arc<Content>) -> (teul_core::state::Snapshot, u64, Vec<teul_core::event::Event>) {
    let mut core = world(c.clone());
    script(&mut core, c, 7, 4);
    let snap = core.latest_snapshot().unwrap();
    let all = core.into_storage().events_after(None).unwrap();
    let tail: Vec<_> = all.iter().filter(|e| e.sort_key() > snap.through).cloned().collect();
    let covered = (all.len() - tail.len()) as u64;
    (snap, covered, tail)
}

#[test]
fn a_full_log_with_an_edited_snapshot_falls_back_to_the_whole_log() {
    // a store that keeps everything (sqlite on a computer): a bad snapshot is just ignored
    let c = content();
    let mut core = world(c.clone());
    script(&mut core, &c, 9, 5);
    let reference = core.state().clone();
    let mut storage = core.into_storage();
    let mut snap = storage.latest_snapshot().unwrap().unwrap();
    snap.state.earned += 999;
    storage.save_snapshot(&snap).unwrap();
    let reopened = Core::open_with(storage, 1, c).unwrap();
    assert_eq!(reopened.state(), &reference);
    assert!(!reopened.integrity().from_snapshot);
}

#[test]
fn a_snapshot_mac_depends_on_everything_it_vouches_for() {
    let c = content();
    let (snap, _, _) = core_snapshot(&c);
    let mac = teul_core::core::snapshot_mac(&snap, 987654321);
    assert_eq!(snap.mac, mac);
    let mut other = snap.clone();
    other.covered += 1;
    assert_ne!(teul_core::core::snapshot_mac(&other, 987654321), mac);
    assert_ne!(teul_core::core::snapshot_mac(&snap, 1), mac);
    let _ = fnv1a64(b"");
}

#[test]
fn opening_from_a_snapshot_after_an_edited_tail_drops_the_edit_as_before() {
    let c = content();
    let (snap, covered, mut tail) = core_snapshot(&c);
    let mut core = world(c.clone());
    script(&mut core, &c, 7, 4);
    // there is a tail after the latest snapshot only if play went on after it; make one
    let _ = core.apply_logged(WorldTime(10 * 1440), Command::Travel { to: "village".into() });
    let _ = core.apply_logged(WorldTime(10 * 1440 + 1), Command::Travel { to: "home".into() });
    let all = core.into_storage().events_after(None).unwrap();
    tail = all.iter().filter(|e| e.sort_key() > snap.through).cloned().collect();
    let covered2 = (all.len() - tail.len()) as u64;
    assert_eq!(covered, covered2);
    if let Some(e) = tail.iter_mut().find(|e| !matches!(e.kind, teul_core::event::EventKind::Input { .. })) {
        e.kind = teul_core::event::EventKind::CoinsEarned { amount: 5000 };
    }
    let mut s = MemoryStorage::new();
    s.meta_set(teul_core::core::META_SECRET, "987654321").unwrap();
    s.append_batch(&tail).unwrap();
    let fast = Core::bootstrap_from_snapshot(s, 1, NewWorld { seed: 11, epoch_unix_secs: 20_513 * 86_400 }, c, snap, covered).unwrap();
    assert!(fast.integrity().tampered > 0);
}
