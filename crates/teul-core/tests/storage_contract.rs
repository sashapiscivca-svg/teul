use teul_core::event::{Event, EventId, EventKind};
use teul_core::state::{DeltaState, Snapshot};
use teul_core::storage::{MemoryStorage, SqliteStorage, Storage, StorageError};
use teul_core::time::WorldTime;

fn ev(device: u32, seq: u64, time: u64, name: &str) -> Event {
    Event {
        id: EventId { device, seq },
        time: WorldTime(time),
        rules_version: 1,
        kind: EventKind::PlayerNamed { name: name.into() },
        chain: 0,
    }
}

fn contract<S: Storage>(mut s: S) {
    // Events come back in log order no matter the insertion order.
    s.append(&ev(2, 0, 10, "c")).unwrap();
    s.append(&ev(1, 0, 10, "b")).unwrap();
    s.append(&ev(1, 1, 5, "a")).unwrap();
    s.append(&ev(1, 2, 0, "zero")).unwrap();
    let names: Vec<String> = s
        .events_after(None)
        .unwrap()
        .into_iter()
        .map(|e| match e.kind {
            EventKind::PlayerNamed { name } => name,
            other => panic!("unexpected event {other:?}"),
        })
        .collect();
    assert_eq!(names, ["zero", "a", "b", "c"]);

    // events_after is strictly after the given key.
    let tail = s.events_after(Some((WorldTime(5), 1, 1))).unwrap();
    assert_eq!(tail.len(), 2);
    assert_eq!(tail[0].id, EventId { device: 1, seq: 0 });

    // Re-appending the same id is refused and changes nothing.
    assert_eq!(s.append(&ev(1, 0, 99, "dup")), Err(StorageError::Duplicate(EventId { device: 1, seq: 0 })));
    assert_eq!(s.events_after(None).unwrap().len(), 4);

    // Sequence numbers are tracked per device.
    assert_eq!(s.max_seq(1).unwrap(), Some(2));
    assert_eq!(s.max_seq(2).unwrap(), Some(0));
    assert_eq!(s.max_seq(3).unwrap(), None);

    // A batch is all-or-nothing: one duplicate rejects the whole batch.
    let before = s.events_after(None).unwrap().len();
    let batch = vec![ev(5, 0, 50, "n1"), ev(1, 0, 51, "dup-of-existing"), ev(5, 1, 52, "n2")];
    assert_eq!(s.append_batch(&batch), Err(StorageError::Duplicate(EventId { device: 1, seq: 0 })));
    assert_eq!(s.events_after(None).unwrap().len(), before, "a rejected batch leaves nothing behind");
    s.append_batch(&[ev(5, 0, 50, "n1"), ev(5, 1, 52, "n2")]).unwrap();
    assert_eq!(s.events_after(None).unwrap().len(), before + 2);

    // Meta is an upsert.
    assert_eq!(s.meta_get("k").unwrap(), None);
    s.meta_set("k", "1").unwrap();
    s.meta_set("k", "2").unwrap();
    assert_eq!(s.meta_get("k").unwrap(), Some("2".to_string()));

    // The latest snapshot wins.
    assert_eq!(s.latest_snapshot().unwrap(), None);
    let first = Snapshot { through: (WorldTime(1), 1, 0), state: DeltaState::default(), ..Default::default() };
    let second = Snapshot {
        through: (WorldTime(2), 1, 1),
        state: DeltaState { player_name: Some("n".into()), events_applied: 2, ..Default::default() },
        covered: 2,
        mac: 77,
        ..Default::default()
    };
    s.save_snapshot(&first).unwrap();
    s.save_snapshot(&second).unwrap();
    assert_eq!(s.latest_snapshot().unwrap(), Some(second));
    // and the count of events up to a key is exact (a snapshot must cover exactly these)
    let all = s.events_after(None).unwrap();
    for (i, e) in all.iter().enumerate() {
        assert_eq!(s.count_through(e.sort_key()).unwrap(), i as u64 + 1);
    }
}

#[test]
fn memory_storage_honours_the_contract() {
    contract(MemoryStorage::new());
}

#[test]
fn sqlite_storage_honours_the_contract() {
    contract(SqliteStorage::open_in_memory().unwrap());
}

#[test]
fn sqlite_accepts_time_zero_event_when_reading_everything() {
    let mut s = SqliteStorage::open_in_memory().unwrap();
    s.append(&ev(0, 0, 0, "origin")).unwrap();
    assert_eq!(s.events_after(None).unwrap().len(), 1);
}

#[test]
fn sqlite_refuses_times_it_cannot_store() {
    let mut s = SqliteStorage::open_in_memory().unwrap();
    assert!(matches!(s.append(&ev(0, 0, u64::MAX, "far")), Err(StorageError::Backend(_))));
}
