mod common;
use teul_core::content::{Content, ContentError, Layer};
use teul_core::unlock::Unlock;

fn with(edit: impl FnOnce(&mut serde_json::Value)) -> Result<Content, ContentError> {
    let mut v: serde_json::Value = serde_json::from_str(common::PACK).unwrap();
    edit(&mut v);
    Content::from_packs(&[&v.to_string()])
}

#[test]
fn a_valid_pack_loads_with_everything_in_it() {
    let c = common::content();
    assert_eq!(c.items.len(), 10);
    assert_eq!(c.items["sofa"].layer, Layer::Floor);
    assert_eq!(c.items["sofa"].footprint.w, 3);
    assert_eq!(c.items["gold_lamp"].acquire, Unlock::Coins(50));
    assert_eq!(c.items["sofa"].acquire, Unlock::Free);
    assert_eq!(c.start_room.w, 6);
    assert_eq!(c.packs["test"], 1);
}

#[test]
fn an_empty_content_set_is_valid_and_has_nothing_in_it() {
    let c = Content::empty();
    assert!(c.items.is_empty());
}

#[test]
fn duplicate_item_ids_are_rejected() {
    let err = with(|v| {
        let first = v["items"][0].clone();
        v["items"].as_array_mut().unwrap().push(first);
    })
    .unwrap_err();
    assert!(matches!(err, ContentError::DuplicateId(id) if id == "sofa"));
}

#[test]
fn an_item_pointing_at_an_unknown_action_is_rejected() {
    let err = with(|v| v["items"][0]["actions"] = serde_json::json!(["fly"])).unwrap_err();
    assert!(matches!(err, ContentError::UnknownRef { kind: "action", ref id, .. } if id == "fly"));
}

#[test]
fn a_slot_with_an_unknown_palette_is_rejected() {
    let err = with(|v| v["items"][0]["slots"]["body"]["palette"] = serde_json::json!("missing")).unwrap_err();
    assert!(matches!(err, ContentError::UnknownRef { kind: "palette", .. }));
}

#[test]
fn a_slot_default_must_be_in_its_palette() {
    let err = with(|v| v["items"][0]["slots"]["body"]["default"] = serde_json::json!("#000000")).unwrap_err();
    assert!(matches!(err, ContentError::Invalid(_)));
}

#[test]
fn a_model_primitive_must_use_a_declared_slot() {
    let err = with(|v| v["items"][0]["model"][0]["slot"] = serde_json::json!("nope")).unwrap_err();
    assert!(matches!(err, ContentError::UnknownRef { kind: "slot", .. }));
}

#[test]
fn zero_sized_footprints_are_rejected() {
    let err = with(|v| v["items"][0]["footprint"]["w"] = serde_json::json!(0)).unwrap_err();
    assert!(matches!(err, ContentError::Invalid(_)));
}

#[test]
fn start_styles_must_exist_and_match_their_kind() {
    let missing = with(|v| v["start_styles"]["floor"] = serde_json::json!("floor.none")).unwrap_err();
    assert!(matches!(missing, ContentError::UnknownRef { kind: "style", .. }));
    let wrong_kind = with(|v| v["start_styles"]["floor"] = serde_json::json!("wall.plum")).unwrap_err();
    assert!(matches!(wrong_kind, ContentError::Invalid(_)));
}

#[test]
fn a_reward_for_an_unknown_action_is_rejected() {
    let err = with(|v| v["rewards"][0]["action"] = serde_json::json!("fly")).unwrap_err();
    assert!(matches!(err, ContentError::UnknownRef { kind: "action", .. }));
}

#[test]
fn an_unsupported_schema_is_rejected_by_number() {
    let err = with(|v| v["schema"] = serde_json::json!(99)).unwrap_err();
    assert!(matches!(err, ContentError::UnsupportedSchema(99)));
}

#[test]
fn malformed_json_gives_a_readable_error() {
    let err = Content::from_packs(&["{ not json"]).unwrap_err();
    assert!(matches!(&err, ContentError::Malformed(_)));
    assert!(!err.to_string().is_empty());
}

#[test]
fn two_packs_merge_and_clashing_ids_across_packs_are_rejected() {
    let second = r#"{ "schema": 1, "id": "extra", "version": 3, "items": [
        { "id": "stool", "name": "item.stool", "category": "seating", "footprint": { "w": 1, "d": 1 }, "layer": "floor", "acquire": "free" } ] }"#;
    let merged = Content::from_packs(&[common::PACK, second]).unwrap();
    assert!(merged.items.contains_key("stool") && merged.items.contains_key("sofa"));
    assert_eq!(merged.packs["extra"], 3);

    let clash = r#"{ "schema": 1, "id": "extra", "version": 1, "items": [
        { "id": "sofa", "name": "x", "category": "seating", "footprint": { "w": 1, "d": 1 }, "layer": "floor", "acquire": "free" } ] }"#;
    assert!(matches!(Content::from_packs(&[common::PACK, clash]).unwrap_err(), ContentError::DuplicateId(id) if id == "sofa"));
}

#[test]
fn materials_themes_and_unique_items_load() {
    let c = common::content();
    assert!(c.materials.contains_key("gloss"));
    assert_eq!(c.themes["theme.cozy"].styles["floor"], "floor.stone");
    assert!(c.items["portal"].unique);
    assert!(!c.items["sofa"].unique);
    assert_eq!(c.expansions["exp.1"].area, 12);
}

#[test]
fn a_theme_must_point_at_real_styles_of_the_right_kind() {
    let missing = with(|v| v["themes"][0]["styles"]["floor"] = serde_json::json!("floor.none")).unwrap_err();
    assert!(matches!(missing, ContentError::UnknownRef { kind: "style", .. }));
    let wrong = with(|v| v["themes"][0]["styles"]["floor"] = serde_json::json!("wall.plum")).unwrap_err();
    assert!(matches!(wrong, ContentError::Invalid(_)));
}

#[test]
fn an_expansion_must_add_area() {
    let err = with(|v| v["expansions"][0]["area"] = serde_json::json!(0)).unwrap_err();
    assert!(matches!(err, ContentError::Invalid(_)));
}

#[test]
fn duplicate_material_and_theme_ids_are_rejected() {
    let dup = with(|v| {
        let m = v["materials"][0].clone();
        v["materials"].as_array_mut().unwrap().push(m);
    })
    .unwrap_err();
    assert!(matches!(dup, ContentError::DuplicateId(id) if id == "gloss"));
}

#[test]
fn a_theme_that_changes_nothing_is_refused() {
    let mut pack: serde_json::Value = serde_json::from_str(include_str!("common/pack.json")).unwrap();
    pack["themes"] = serde_json::json!([{ "id": "theme.empty", "name": "theme.empty", "styles": {}, "settings": {}, "acquire": "free" }]);
    let err = teul_core::content::Content::from_packs(&[&pack.to_string()]);
    assert!(err.is_err(), "an empty theme must be rejected");
}

#[test]
fn model_parts_may_name_a_shape_and_unknown_shapes_are_refused() {
    let mut pack: serde_json::Value = serde_json::from_str(include_str!("common/pack.json")).unwrap();
    let first = pack["items"][0]["model"][0].clone();
    let mut round = first.clone();
    round["shape"] = serde_json::json!("cyl");
    pack["items"][0]["model"] = serde_json::json!([round]);
    let c = teul_core::content::Content::from_packs(&[&pack.to_string()]).expect("cyl is a known shape");
    let id = pack["items"][0]["id"].as_str().unwrap();
    assert_eq!(c.items[id].model[0].shape.as_deref(), Some("cyl"));
    let mut bad = first;
    bad["shape"] = serde_json::json!("torus");
    pack["items"][0]["model"] = serde_json::json!([bad]);
    assert!(teul_core::content::Content::from_packs(&[&pack.to_string()]).is_err());
}
