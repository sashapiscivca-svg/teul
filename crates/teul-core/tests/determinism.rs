use std::fs;
use std::path::Path;

use teul_core::core::{Command, Core, NewWorld};
use teul_core::rng::fnv1a64;
use teul_core::storage::{MemoryStorage, SqliteStorage, Storage};
use teul_core::time::{WorldTime, MINUTES_PER_DAY};

fn script() -> Vec<(u64, &'static str)> {
    vec![(0, "Орися"), (30, "Орися"), (MINUTES_PER_DAY + 7, "Тихон"), (MINUTES_PER_DAY * 40, "Ґанок")]
}

fn fingerprint<S: Storage>(storage: S, probe: WorldTime) -> u64 {
    let core = Core::open(storage, 1).unwrap();
    let json = serde_json::to_string(&core.view(probe)).unwrap();
    fnv1a64(json.as_bytes())
}

fn build<S: Storage>(storage: S) -> S {
    let mut core = Core::create(storage, 1, NewWorld { seed: 42, epoch_unix_secs: 1_700_000_000 }).unwrap();
    for (t, n) in script() {
        core.apply(WorldTime(t), Command::NamePlayer { name: n.into() }).unwrap();
    }
    core.into_storage()
}

const PROBE: WorldTime = WorldTime(MINUTES_PER_DAY * 41 + 600);
// the view carries the real calendar's season and its phase (seasons follow the year, not a 28-day game clock)
const GOLDEN: u64 = 15968089564525702481;

#[test]
fn the_same_script_gives_the_same_world_on_every_backend() {
    let mem = fingerprint(build(MemoryStorage::new()), PROBE);
    let sql = fingerprint(build(SqliteStorage::open_in_memory().unwrap()), PROBE);
    assert_eq!(mem, sql);
    assert_eq!(mem, GOLDEN, "world fingerprint changed; if intentional, this needs a new world_version");
}

fn rust_files(dir: &Path, out: &mut Vec<std::path::PathBuf>) {
    for entry in fs::read_dir(dir).unwrap() {
        let path = entry.unwrap().path();
        if path.is_dir() {
            rust_files(&path, out);
        } else if path.extension().is_some_and(|e| e == "rs") {
            out.push(path);
        }
    }
}

#[test]
fn core_sources_avoid_nondeterministic_apis() {
    // Words are assembled at runtime so this file does not trip its own check.
    let banned = [
        ["Hash", "Map"].concat(),
        ["Hash", "Set"].concat(),
        ["f", "32"].concat(),
        ["f", "64"].concat(),
        ["System", "Time"].concat(),
        ["Inst", "ant"].concat(),
    ];
    let mut files = Vec::new();
    rust_files(&Path::new(env!("CARGO_MANIFEST_DIR")).join("src"), &mut files);
    assert!(!files.is_empty());
    for file in files {
        let text = fs::read_to_string(&file).unwrap();
        for word in &banned {
            assert!(!text.contains(word.as_str()), "{} uses {word}", file.display());
        }
    }
}
