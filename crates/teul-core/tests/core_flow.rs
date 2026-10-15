use teul_core::core::{Command, Core, CoreError, NewWorld, Realm, MAX_NAME_CHARS};
use teul_core::storage::{MemoryStorage, SqliteStorage, Storage};
use teul_core::time::{Season, WorldTime, MINUTES_PER_DAY};

fn new_world() -> NewWorld {
    NewWorld { seed: 42, epoch_unix_secs: 1_700_000_000 }
}

fn name(n: &str) -> Command {
    Command::NamePlayer { name: n.into() }
}

#[test]
fn a_new_world_has_no_player_name_and_reports_calendar_parts() {
    let core = Core::create(MemoryStorage::new(), 1, new_world()).unwrap();
    let view = core.view(WorldTime(MINUTES_PER_DAY * 30 + 125));
    assert_eq!(view.player_name, None);
    assert_eq!(view.day, 30);
    assert_eq!(view.minute_of_day, 125);
    // the epoch is 2023-11-14 (a world first opened then); 30 days on it is 2023-12-15, early winter
    assert_eq!(view.season, Season::Winter);
    assert_eq!(view.season_phase, 0);
}

#[test]
fn naming_the_player_shows_up_in_the_view_and_survives_reopening() {
    let mut core = Core::create(SqliteStorage::open_in_memory().unwrap(), 1, new_world()).unwrap();
    core.apply(WorldTime(10), name("  Орися ")).unwrap();
    assert_eq!(core.view(WorldTime(10)).player_name.as_deref(), Some("Орися"));

    let reopened = Core::open(core.into_storage(), 1).unwrap();
    assert_eq!(reopened.view(WorldTime(11)).player_name.as_deref(), Some("Орися"));
}

#[test]
fn creating_twice_in_one_storage_is_refused() {
    let mut storage = MemoryStorage::new();
    storage.meta_set("world_version", "1").unwrap();
    assert!(matches!(Core::create(storage, 1, new_world()), Err(CoreError::AlreadyExists)));
}

#[test]
fn opening_an_empty_storage_reports_what_is_missing() {
    assert!(matches!(Core::open(MemoryStorage::new(), 1), Err(CoreError::MissingMeta("seed"))));
}

#[test]
fn a_save_from_a_newer_world_version_is_refused_not_misread() {
    let mut storage = MemoryStorage::new();
    storage.meta_set("seed", "1").unwrap();
    storage.meta_set("epoch_unix_secs", "0").unwrap();
    storage.meta_set("world_version", "2").unwrap();
    assert!(matches!(Core::open(storage, 1), Err(CoreError::UnsupportedWorldVersion(2))));
}

#[test]
fn new_worlds_are_sandbox_saves() {
    let core = Core::create(MemoryStorage::new(), 1, new_world()).unwrap();
    assert_eq!(core.meta().realm, Realm::Sandbox);
}

#[test]
fn a_shared_realm_save_is_refused_by_the_sandbox_core() {
    let mut storage = MemoryStorage::new();
    storage.meta_set("seed", "1").unwrap();
    storage.meta_set("epoch_unix_secs", "0").unwrap();
    storage.meta_set("world_version", "1").unwrap();
    storage.meta_set("realm", "shared").unwrap();
    assert!(matches!(Core::open(storage, 1), Err(CoreError::UnsupportedRealm(r)) if r == "shared"));
}

#[test]
fn a_save_without_a_realm_is_refused() {
    let mut storage = MemoryStorage::new();
    storage.meta_set("seed", "1").unwrap();
    storage.meta_set("epoch_unix_secs", "0").unwrap();
    storage.meta_set("world_version", "1").unwrap();
    assert!(matches!(Core::open(storage, 1), Err(CoreError::MissingMeta("realm"))));
}

#[test]
fn unreadable_meta_is_reported() {
    let mut storage = MemoryStorage::new();
    storage.meta_set("seed", "banana").unwrap();
    assert!(matches!(Core::open(storage, 1), Err(CoreError::BadMeta("seed"))));
}

#[test]
fn time_may_not_go_backwards() {
    let mut core = Core::create(MemoryStorage::new(), 1, new_world()).unwrap();
    core.apply(WorldTime(100), name("a")).unwrap();
    assert_eq!(
        core.apply(WorldTime(99), name("b")),
        Err(CoreError::ClockWentBackwards { last: WorldTime(100), now: WorldTime(99) })
    );
    assert!(core.apply(WorldTime(100), name("c")).is_ok(), "same minute is fine");
}

#[test]
fn names_are_validated() {
    let mut core = Core::create(MemoryStorage::new(), 1, new_world()).unwrap();
    let t = WorldTime(1);
    assert_eq!(core.apply(t, name("")), Err(CoreError::InvalidName));
    assert_eq!(core.apply(t, name("   \t ")), Err(CoreError::InvalidName));
    assert_eq!(core.apply(t, name("bad\nname")), Err(CoreError::InvalidName));
    assert_eq!(core.apply(t, name(&"я".repeat(MAX_NAME_CHARS + 1))), Err(CoreError::InvalidName));
    assert!(core.apply(t, name(&"я".repeat(MAX_NAME_CHARS))).is_ok(), "limit counts characters, not bytes");
    assert_eq!(core.view(t).player_name, Some("я".repeat(MAX_NAME_CHARS)));
}

#[test]
fn a_rejected_command_leaves_no_trace() {
    let mut core = Core::create(MemoryStorage::new(), 1, new_world()).unwrap();
    let _ = core.apply(WorldTime(1), name(""));
    let ev = core.apply(WorldTime(1), name("ok")).unwrap();
    // every command is logged as its input first (seq 0), then what it did (seq 1)
    assert_eq!(ev.id.seq, 1, "failed attempts do not burn sequence numbers");
}

#[test]
fn sequence_numbers_continue_after_reopening() {
    let mut core = Core::create(SqliteStorage::open_in_memory().unwrap(), 7, new_world()).unwrap();
    core.apply(WorldTime(1), name("a")).unwrap();
    core.apply(WorldTime(2), name("b")).unwrap();
    let mut core = Core::open(core.into_storage(), 7).unwrap();
    // a: input 0, name 1; b: input 2, name 3; c: input 4, name 5
    assert_eq!(core.apply(WorldTime(3), name("c")).unwrap().id.seq, 5);
}

#[test]
fn a_new_device_starts_its_own_sequence() {
    let mut core = Core::create(SqliteStorage::open_in_memory().unwrap(), 7, new_world()).unwrap();
    core.apply(WorldTime(1), name("a")).unwrap();
    let mut other = Core::open(core.into_storage(), 8).unwrap();
    // its own input is its seq 0, the name its seq 1
    assert_eq!(other.apply(WorldTime(2), name("b")).unwrap().id.seq, 1);
}

#[test]
fn snapshots_are_taken_once_per_world_day_and_reopening_from_them_matches_full_replay() {
    let mut core = Core::create(SqliteStorage::open_in_memory().unwrap(), 1, new_world()).unwrap();
    for (i, minute) in [10, 20, MINUTES_PER_DAY + 5, MINUTES_PER_DAY * 2 + 1, MINUTES_PER_DAY * 2 + 2]
        .into_iter()
        .enumerate()
    {
        core.apply(WorldTime(minute), name(&format!("n{i}"))).unwrap();
    }
    let storage = core.into_storage();
    let snap = storage.latest_snapshot().unwrap().expect("a snapshot exists");
    assert_eq!(snap.through.0, WorldTime(MINUTES_PER_DAY * 2 + 1), "one snapshot per day, at the day's first event");

    let from_snapshot = Core::open(storage, 1).unwrap().view(WorldTime(MINUTES_PER_DAY * 3));
    assert_eq!(from_snapshot.player_name.as_deref(), Some("n4"), "events after the snapshot are replayed on top of it");
}
