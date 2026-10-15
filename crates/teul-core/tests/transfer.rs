use std::fs;

use teul_core::core::{Command, Core, NewWorld};
use teul_core::storage::SqliteStorage;
use teul_core::time::WorldTime;
use teul_core::transfer::{export_save, import_save, TransferError};

fn seeded_save(path: &std::path::Path) -> SqliteStorage {
    let storage = SqliteStorage::open(path).unwrap();
    let mut core = Core::create(storage, 1, NewWorld { seed: 9, epoch_unix_secs: 0 }).unwrap();
    core.apply(WorldTime(5), Command::NamePlayer { name: "Орися".into() }).unwrap();
    core.into_storage()
}

#[test]
fn export_then_import_gives_the_same_world() {
    let dir = tempfile::tempdir().unwrap();
    let storage = seeded_save(&dir.path().join("a.teul"));
    export_save(&storage, &dir.path().join("backup.teul")).unwrap();

    let meta = import_save(&dir.path().join("backup.teul"), &dir.path().join("b.teul")).unwrap();
    assert_eq!(meta.seed, 9);

    let restored = Core::open(SqliteStorage::open(&dir.path().join("b.teul")).unwrap(), 2).unwrap();
    assert_eq!(restored.view(WorldTime(6)).player_name.as_deref(), Some("Орися"));
}

#[test]
fn export_refuses_to_overwrite() {
    let dir = tempfile::tempdir().unwrap();
    let storage = seeded_save(&dir.path().join("a.teul"));
    fs::write(dir.path().join("x.teul"), b"precious").unwrap();
    assert!(matches!(export_save(&storage, &dir.path().join("x.teul")), Err(TransferError::DestinationExists(_))));
    assert_eq!(fs::read(dir.path().join("x.teul")).unwrap(), b"precious");
}

#[test]
fn importing_garbage_fails_and_leaves_nothing_behind() {
    let dir = tempfile::tempdir().unwrap();
    fs::write(dir.path().join("junk.teul"), b"this is not a database at all").unwrap();
    let err = import_save(&dir.path().join("junk.teul"), &dir.path().join("dest.teul")).unwrap_err();
    assert!(matches!(err, TransferError::Invalid(_)), "{err}");
    assert!(!dir.path().join("dest.teul").exists());
    assert!(!dir.path().join("dest.importing").exists());
}

#[test]
fn importing_a_truncated_save_fails_cleanly() {
    let dir = tempfile::tempdir().unwrap();
    let storage = seeded_save(&dir.path().join("a.teul"));
    export_save(&storage, &dir.path().join("full.teul")).unwrap();
    let bytes = fs::read(dir.path().join("full.teul")).unwrap();
    fs::write(dir.path().join("cut.teul"), &bytes[..bytes.len() / 2]).unwrap();
    assert!(import_save(&dir.path().join("cut.teul"), &dir.path().join("dest.teul")).is_err());
    assert!(!dir.path().join("dest.teul").exists());
}

#[test]
fn importing_a_valid_database_that_is_not_a_world_fails() {
    let dir = tempfile::tempdir().unwrap();
    drop(SqliteStorage::open(&dir.path().join("empty.teul")).unwrap());
    let err = import_save(&dir.path().join("empty.teul"), &dir.path().join("dest.teul")).unwrap_err();
    assert!(matches!(err, TransferError::Invalid(_)));
}

#[test]
fn import_never_overwrites_an_existing_world() {
    let dir = tempfile::tempdir().unwrap();
    let storage = seeded_save(&dir.path().join("a.teul"));
    export_save(&storage, &dir.path().join("backup.teul")).unwrap();
    fs::write(dir.path().join("mine.teul"), b"my world").unwrap();
    assert!(matches!(
        import_save(&dir.path().join("backup.teul"), &dir.path().join("mine.teul")),
        Err(TransferError::DestinationExists(_))
    ));
    assert_eq!(fs::read(dir.path().join("mine.teul")).unwrap(), b"my world");
}

fn set_read_only(path: &std::path::Path) {
    let mut perms = fs::metadata(path).unwrap().permissions();
    perms.set_readonly(true);
    fs::set_permissions(path, perms).unwrap();
}

#[test]
fn importing_a_read_only_backup_gives_a_playable_world() {
    let dir = tempfile::tempdir().unwrap();
    let storage = seeded_save(&dir.path().join("a.teul"));
    export_save(&storage, &dir.path().join("backup.teul")).unwrap();
    set_read_only(&dir.path().join("backup.teul"));

    import_save(&dir.path().join("backup.teul"), &dir.path().join("b.teul")).unwrap();
    let mut world = Core::open(SqliteStorage::open(&dir.path().join("b.teul")).unwrap(), 2).unwrap();
    world
        .apply(WorldTime(10), Command::NamePlayer { name: "Тихон".into() })
        .expect("an imported world must be writable");
}

#[test]
fn import_does_not_clobber_unrelated_files_next_to_the_destination() {
    let dir = tempfile::tempdir().unwrap();
    let storage = seeded_save(&dir.path().join("a.teul"));
    export_save(&storage, &dir.path().join("backup.teul")).unwrap();
    fs::write(dir.path().join("dest.importing"), b"user file").unwrap();

    import_save(&dir.path().join("backup.teul"), &dir.path().join("dest.teul")).unwrap();
    assert_eq!(fs::read(dir.path().join("dest.importing")).unwrap(), b"user file");
}

#[test]
fn import_refuses_to_reuse_an_existing_staging_file() {
    let dir = tempfile::tempdir().unwrap();
    let storage = seeded_save(&dir.path().join("a.teul"));
    export_save(&storage, &dir.path().join("backup.teul")).unwrap();
    fs::write(dir.path().join("dest.teul.importing"), b"leftover").unwrap();

    assert!(import_save(&dir.path().join("backup.teul"), &dir.path().join("dest.teul")).is_err());
    assert_eq!(fs::read(dir.path().join("dest.teul.importing")).unwrap(), b"leftover");
    assert!(!dir.path().join("dest.teul").exists());
}

#[test]
fn importing_from_the_staging_path_does_not_destroy_the_source() {
    let dir = tempfile::tempdir().unwrap();
    let storage = seeded_save(&dir.path().join("a.teul"));
    let source = dir.path().join("dest.teul.importing");
    export_save(&storage, &source).unwrap();
    let before = fs::read(&source).unwrap();

    assert!(import_save(&source, &dir.path().join("dest.teul")).is_err());
    assert_eq!(fs::read(&source).unwrap(), before, "the user's file must survive a refused import");
}

#[test]
fn export_leaves_no_temp_file_and_refuses_to_clobber_one() {
    let dir = tempfile::tempdir().unwrap();
    let storage = seeded_save(&dir.path().join("a.teul"));
    export_save(&storage, &dir.path().join("backup.teul")).unwrap();
    assert!(dir.path().join("backup.teul").exists());
    assert!(!dir.path().join("backup.teul.exporting").exists(), "no temp file after success");

    fs::write(dir.path().join("second.teul.exporting"), b"mine").unwrap();
    assert!(export_save(&storage, &dir.path().join("second.teul")).is_err());
    assert_eq!(fs::read(dir.path().join("second.teul.exporting")).unwrap(), b"mine");
    assert!(!dir.path().join("second.teul").exists());
}
