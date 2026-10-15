use teul_core::core::{Command, Core, CoreError, NewWorld};
use teul_core::event::{Event, EventId, EventKind, SortKey};
use teul_core::state::Snapshot;
use teul_core::storage::{MemoryStorage, SqliteStorage, Storage, StorageError};
use teul_core::time::WorldTime;

fn new_world() -> NewWorld {
    NewWorld { seed: 42, epoch_unix_secs: 1_700_000_000 }
}

fn name(n: &str) -> Command {
    Command::NamePlayer { name: n.into() }
}

#[test]
fn an_event_sorting_before_the_snapshot_cannot_make_state_diverge_from_the_log() {
    let mut first = Core::create(SqliteStorage::open_in_memory().unwrap(), 7, new_world()).unwrap();
    first.apply(WorldTime(100), name("from-seven")).unwrap();

    // A second installation (lower device id) writes in the very same world minute.
    let mut second = Core::open(first.into_storage(), 3).unwrap();
    second.apply(WorldTime(100), name("from-three")).unwrap();
    let live = second.view(WorldTime(101)).player_name;

    let reopened = Core::open(second.into_storage(), 3).unwrap().view(WorldTime(101)).player_name;
    assert_eq!(live, reopened, "reopening must give the state the player just saw");
    assert_eq!(live.as_deref(), Some("from-seven"), "log order, not arrival order, decides the state");
}

#[test]
fn events_from_newer_rules_are_refused_not_misread() {
    let core = Core::create(MemoryStorage::new(), 1, new_world()).unwrap();
    let mut storage = core.into_storage();
    storage
        .append(&Event {
            id: EventId { device: 2, seq: 0 },
            time: WorldTime(5),
            rules_version: 99,
            kind: EventKind::PlayerNamed { name: "x".into() },
            chain: 0,
        })
        .unwrap();
    assert!(matches!(Core::open(storage, 1), Err(CoreError::UnsupportedRulesVersion(99))));
}

/// A storage whose snapshots always fail to save, like a nearly full disk.
struct FailingSnapshots(MemoryStorage);

impl Storage for FailingSnapshots {
    fn append(&mut self, e: &Event) -> Result<(), StorageError> {
        self.0.append(e)
    }
    fn events_after(&self, a: Option<SortKey>) -> Result<Vec<Event>, StorageError> {
        self.0.events_after(a)
    }
    fn max_seq(&self, d: u32) -> Result<Option<u64>, StorageError> {
        self.0.max_seq(d)
    }
    fn meta_get(&self, k: &str) -> Result<Option<String>, StorageError> {
        self.0.meta_get(k)
    }
    fn meta_set(&mut self, k: &str, v: &str) -> Result<(), StorageError> {
        self.0.meta_set(k, v)
    }
    fn save_snapshot(&mut self, _: &Snapshot) -> Result<(), StorageError> {
        Err(StorageError::Backend("disk full".into()))
    }
    fn latest_snapshot(&self) -> Result<Option<Snapshot>, StorageError> {
        self.0.latest_snapshot()
    }
}

#[test]
fn a_failed_snapshot_does_not_fail_a_committed_command() {
    let mut core = Core::create(FailingSnapshots(MemoryStorage::new()), 1, new_world()).unwrap();
    let event = core
        .apply(WorldTime(1), name("x"))
        .expect("the event is committed; a snapshot is only a cache");
    // the input is seq 0, the name seq 1
    assert_eq!(event.id.seq, 1);
    assert_eq!(core.view(WorldTime(1)).player_name.as_deref(), Some("x"));
    assert_eq!(core.apply(WorldTime(2), name("y")).unwrap().id.seq, 3, "the next command still works");
}
