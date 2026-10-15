//! Every command and event variant a released version wrote is in a save somewhere: none may be renamed or
//! removed (a renamed one no longer reads, and the save loses what it did), except one of a thing the game no
//! longer has, which is retired (`event::RETIRED_EVENTS`, `event::RETIRED_COMMANDS`: still read, passed over).
//! These lists are the variants of version 1.0; add new ones at will, never take one out. See
//! docs/architecture.md, «Сумісність збережень».

fn variants(source: &str, head: &str) -> Vec<String> {
    let start = source.find(head).unwrap_or_else(|| panic!("{head} not found"));
    let body = &source[start..];
    let end = body.find("\n}").unwrap();
    body[..end]
        .lines()
        .filter_map(|l| {
            let t = l.strip_prefix("    ")?;
            if !t.starts_with(|c: char| c.is_ascii_uppercase()) {
                return None;
            }
            Some(t.split(|c: char| !c.is_ascii_alphanumeric()).next()?.to_string())
        })
        .collect()
}

/// `NamePlayer` → `name_player`, as commands are tagged.
fn snake(v: &str) -> String {
    let mut out = String::new();
    for (i, c) in v.chars().enumerate() {
        if c.is_ascii_uppercase() && i > 0 {
            out.push('_');
        }
        out.push(c.to_ascii_lowercase());
    }
    out
}

fn kept(list: &str, now: &[String], retired: &[String], what: &str) {
    let missing: Vec<&str> = list.lines().map(str::trim).filter(|v| !v.is_empty() && !now.iter().any(|n| n == v) && !retired.iter().any(|r| r == v)).collect();
    assert!(missing.is_empty(), "{what} variants of released saves are gone (renamed or removed): {missing:?}");
}

#[test]
fn no_command_variant_of_a_release_is_gone() {
    let retired: Vec<String> = include_str!("fixtures/command_variants.txt").lines().map(str::trim).filter(|v| teul_core::event::RETIRED_COMMANDS.contains(&snake(v).as_str())).map(str::to_string).collect();
    kept(include_str!("fixtures/command_variants.txt"), &variants(include_str!("../src/core.rs"), "pub enum Command {"), &retired, "command");
}

#[test]
fn no_event_variant_of_a_release_is_gone() {
    let retired: Vec<String> = teul_core::event::RETIRED_EVENTS.iter().map(|v| v.to_string()).collect();
    kept(include_str!("fixtures/event_variants.txt"), &variants(include_str!("../src/event.rs"), "pub enum EventKind {"), &retired, "event");
}

#[test]
fn a_retired_variant_is_not_also_live() {
    let events = variants(include_str!("../src/event.rs"), "pub enum EventKind {");
    let commands: Vec<String> = variants(include_str!("../src/core.rs"), "pub enum Command {").iter().map(|v| snake(v)).collect();
    for r in teul_core::event::RETIRED_EVENTS {
        assert!(!events.iter().any(|e| e == r), "{r} is retired and live at once");
    }
    for r in teul_core::event::RETIRED_COMMANDS {
        assert!(!commands.iter().any(|c| c == r), "{r} is retired and live at once");
    }
}
