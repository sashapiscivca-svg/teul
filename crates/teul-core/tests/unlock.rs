use std::collections::BTreeMap;
use teul_core::time::Season;
use teul_core::unlock::{check, Cost, Missing, Unlock, Wallet};

fn wallet(coins: u64, tokens: &[(&str, u64)], counters: &[(&str, u64)]) -> Wallet {
    Wallet {
        coins,
        tokens: tokens.iter().map(|(k, v)| (k.to_string(), *v)).collect(),
        counters: counters.iter().map(|(k, v)| (k.to_string(), *v)).collect(),
    }
}

#[test]
fn free_costs_nothing() {
    assert_eq!(check(&Unlock::Free, &Wallet::default(), Season::Spring), Ok(Cost::default()));
}

#[test]
fn coins_are_a_price_and_report_what_is_missing() {
    let ok = check(&Unlock::Coins(50), &wallet(50, &[], &[]), Season::Spring).unwrap();
    assert_eq!(ok.coins, 50);
    assert_eq!(
        check(&Unlock::Coins(50), &wallet(20, &[], &[]), Season::Spring),
        Err(vec![Missing::Coins { have: 20, need: 50 }])
    );
}

#[test]
fn tokens_are_a_price_by_kind() {
    let u = Unlock::Token { kind: "leaf".into(), n: 2 };
    let ok = check(&u, &wallet(0, &[("leaf", 2)], &[]), Season::Spring).unwrap();
    assert_eq!(ok.tokens, BTreeMap::from([("leaf".to_string(), 2)]));
    assert_eq!(
        check(&u, &wallet(0, &[("leaf", 1)], &[]), Season::Spring),
        Err(vec![Missing::Token { kind: "leaf".into(), have: 1, need: 2 }])
    );
}

#[test]
fn an_action_gate_is_not_spent() {
    let u = Unlock::Action { kind: "water".into(), count: 3 };
    let ok = check(&u, &wallet(0, &[], &[("water", 3)]), Season::Spring).unwrap();
    assert!(ok.is_zero());
    assert_eq!(
        check(&u, &wallet(0, &[], &[("water", 1)]), Season::Spring),
        Err(vec![Missing::Action { kind: "water".into(), have: 1, need: 3 }])
    );
}

#[test]
fn a_season_gate_depends_on_the_season() {
    let u = Unlock::Season(Season::Winter);
    assert!(check(&u, &Wallet::default(), Season::Winter).is_ok());
    assert_eq!(check(&u, &Wallet::default(), Season::Summer), Err(vec![Missing::Season { need: Season::Winter }]));
}

#[test]
fn all_sums_prices_and_collects_every_missing_piece() {
    let u = Unlock::All(vec![Unlock::Token { kind: "leaf".into(), n: 2 }, Unlock::Coins(10)]);
    let ok = check(&u, &wallet(10, &[("leaf", 2)], &[]), Season::Spring).unwrap();
    assert_eq!((ok.coins, ok.tokens["leaf"]), (10, 2));
    let err = check(&u, &wallet(0, &[], &[]), Season::Spring).unwrap_err();
    assert_eq!(err.len(), 2);
}

#[test]
fn any_takes_the_first_option_that_passes() {
    let u = Unlock::Any(vec![Unlock::Coins(500), Unlock::Coins(5)]);
    assert_eq!(check(&u, &wallet(10, &[], &[]), Season::Spring).unwrap().coins, 5);
    let none = check(&u, &wallet(1, &[], &[]), Season::Spring).unwrap_err();
    assert_eq!(none.len(), 2);
}

#[test]
fn unlock_json_shapes_are_stable() {
    assert_eq!(serde_json::from_str::<Unlock>(r#""free""#).unwrap(), Unlock::Free);
    assert_eq!(serde_json::from_str::<Unlock>(r#"{"coins":7}"#).unwrap(), Unlock::Coins(7));
    assert_eq!(
        serde_json::from_str::<Unlock>(r#"{"any":[{"coins":1},"free"]}"#).unwrap(),
        Unlock::Any(vec![Unlock::Coins(1), Unlock::Free])
    );
}

#[test]
fn all_checks_the_combined_price_not_each_part_alone() {
    let u = Unlock::All(vec![Unlock::Coins(10), Unlock::Coins(10)]);
    assert_eq!(
        check(&u, &wallet(10, &[], &[]), Season::Spring),
        Err(vec![Missing::Coins { have: 10, need: 20 }]),
        "two prices of 10 cannot be paid with 10 coins"
    );
    assert_eq!(check(&u, &wallet(20, &[], &[]), Season::Spring).unwrap().coins, 20);
}
