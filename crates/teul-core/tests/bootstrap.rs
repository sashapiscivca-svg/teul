mod common;
use std::sync::Arc;
use teul_core::core::{Command, Core, NewWorld};
use teul_core::storage::MemoryStorage;
use teul_core::time::WorldTime;

#[test]
fn commands_parse_from_tagged_json() {
    let c: Command = serde_json::from_str(r#"{"type":"place","item":"sofa","x":1,"y":2,"rot":0}"#).unwrap();
    assert_eq!(c, Command::Place { item: "sofa".into(), x: 1, y: 2, rot: 0, wall: None, on: None });
    let c: Command = serde_json::from_str(r#"{"type":"place","item":"cup","x":1,"y":1,"rot":0,"wall":"west","on":3}"#).unwrap();
    assert!(matches!(c, Command::Place { on: Some(3), .. }));
    let c: Command = serde_json::from_str(r#"{"type":"perform","action":"sit","pid":null}"#).unwrap();
    assert_eq!(c, Command::Perform { action: "sit".into(), pid: None });
    let c: Command = serde_json::from_str(r#"{"type":"set_style","kind":"floor","style":"floor.oak"}"#).unwrap();
    assert!(matches!(c, Command::SetStyle { .. }));
}

#[test]
fn unknown_or_malformed_commands_are_errors() {
    assert!(serde_json::from_str::<Command>(r#"{"type":"explode"}"#).is_err());
    assert!(serde_json::from_str::<Command>(r#"{"type":"place","item":"sofa"}"#).is_err());
    assert!(serde_json::from_str::<Command>("nonsense").is_err());
}

#[test]
fn bootstrap_creates_a_missing_world_and_reopens_an_existing_one() {
    let params = NewWorld { seed: 5, epoch_unix_secs: 100 };
    let mut c = Core::bootstrap(MemoryStorage::new(), 1, params.clone(), Arc::new(common::content())).unwrap();
    c.apply_all(WorldTime(1), Command::Acquire { item: "sofa".into() }).unwrap();
    let again = Core::bootstrap(c.into_storage(), 1, params, Arc::new(common::content())).unwrap();
    assert_eq!(again.free_count("sofa"), 1, "an existing world is reopened, not recreated");
    assert_eq!(again.meta().seed, 5);
}
