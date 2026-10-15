//! The content ids of a released version are named by saves (bought things, places, people, stations): an
//! update may rename or merge one only with an alias in the pack (`"aliases": {"old": "new"}`), never just drop
//! it; an item the game no longer has at all is listed as `retired` (a save opens without it).
//! `fixtures/content_ids.txt` holds the ids of version 1.0; ids may be added freely.
//! (To extend the list after a release: `TEUL_WRITE_IDS=1 cargo test -p teul-core --test content_ids_kept`.)

use teul_core::content::Content;

#[test]
fn every_released_content_id_is_live_or_aliased() {
    let c = Content::from_packs(&[include_str!("../../../content/base/pack.json")]).unwrap();
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/fixtures/content_ids.txt");
    if std::env::var_os("TEUL_WRITE_IDS").is_some() {
        let mut ids: std::collections::BTreeSet<String> = std::fs::read_to_string(path).unwrap_or_default().lines().map(str::to_string).filter(|l| !l.is_empty()).collect();
        ids.extend(c.ids());
        std::fs::write(path, ids.into_iter().collect::<Vec<_>>().join("\n") + "\n").unwrap();
    }
    let released = std::fs::read_to_string(path).expect("the released ids are kept");
    let gone: Vec<&str> = released.lines().filter(|id| !id.is_empty() && !c.has_id(id) && !c.has_id(c.aliases.resolve(id)) && !c.retired.contains(*id)).collect();
    assert!(gone.is_empty(), "content ids of a released version are gone without an alias or retirement: {gone:?}");
}
