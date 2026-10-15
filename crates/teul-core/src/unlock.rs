use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::time::Season;

/// How something is obtained. `Coins` and `Token` are prices that are spent; `Action` and `Season`
/// are gates that stay open once passed; `All`/`Any` combine them.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Unlock {
    Free,
    Coins(u32),
    Token { kind: String, n: u32 },
    Action { kind: String, count: u32 },
    Season(Season),
    All(Vec<Unlock>),
    Any(Vec<Unlock>),
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
pub struct Wallet {
    pub coins: u64,
    pub tokens: BTreeMap<String, u64>,
    pub counters: BTreeMap<String, u64>,
}

/// What is spent when something is obtained.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
pub struct Cost {
    pub coins: u32,
    pub tokens: BTreeMap<String, u32>,
}

impl Cost {
    pub fn is_zero(&self) -> bool {
        self.coins == 0 && self.tokens.values().all(|n| *n == 0)
    }

    fn add(&mut self, other: &Cost) {
        self.coins = self.coins.saturating_add(other.coins);
        for (kind, n) in &other.tokens {
            let slot = self.tokens.entry(kind.clone()).or_insert(0);
            *slot = slot.saturating_add(*n);
        }
    }
}

/// Why something cannot be obtained yet.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Missing {
    Coins { have: u64, need: u64 },
    Token { kind: String, have: u64, need: u64 },
    Action { kind: String, have: u64, need: u64 },
    Season { need: Season },
    /// An item (a key) the player must own.
    Item { item: String },
    /// A help that must be done first.
    Help { help: String },
    Hearts { npc: String, need: u32, have: u32 },
    /// Open only on certain days: a holiday id, or "rift" (an equinox or a solstice).
    Day { day: String },
    /// A home or a plot that must be rented.
    Lease { home: String },
    /// Something the town has not got yet (a place still being built).
    Flag { flag: String },
}

/// Evaluates a rule. `Ok` carries the price to pay; `Err` lists everything that is missing.
pub fn check(unlock: &Unlock, wallet: &Wallet, season: Season) -> Result<Cost, Vec<Missing>> {
    match unlock {
        Unlock::Free => Ok(Cost::default()),
        Unlock::Coins(n) => {
            let need = u64::from(*n);
            if wallet.coins >= need {
                Ok(Cost { coins: *n, tokens: BTreeMap::new() })
            } else {
                Err(vec![Missing::Coins { have: wallet.coins, need }])
            }
        }
        Unlock::Token { kind, n } => {
            let have = wallet.tokens.get(kind).copied().unwrap_or(0);
            let need = u64::from(*n);
            if have >= need {
                Ok(Cost { coins: 0, tokens: BTreeMap::from([(kind.clone(), *n)]) })
            } else {
                Err(vec![Missing::Token { kind: kind.clone(), have, need }])
            }
        }
        Unlock::Action { kind, count } => {
            let have = wallet.counters.get(kind).copied().unwrap_or(0);
            let need = u64::from(*count);
            if have >= need {
                Ok(Cost::default())
            } else {
                Err(vec![Missing::Action { kind: kind.clone(), have, need }])
            }
        }
        Unlock::Season(need) => {
            if *need == season {
                Ok(Cost::default())
            } else {
                Err(vec![Missing::Season { need: *need }])
            }
        }
        Unlock::All(parts) => {
            let mut cost = Cost::default();
            let mut missing = Vec::new();
            for part in parts {
                match check(part, wallet, season) {
                    Ok(c) => cost.add(&c),
                    Err(m) => missing.extend(m),
                }
            }
            if missing.is_empty() {
                // Each part may be affordable alone while the sum is not.
                if u64::from(cost.coins) > wallet.coins {
                    missing.push(Missing::Coins { have: wallet.coins, need: u64::from(cost.coins) });
                }
                for (kind, n) in &cost.tokens {
                    let have = wallet.tokens.get(kind).copied().unwrap_or(0);
                    if u64::from(*n) > have {
                        missing.push(Missing::Token { kind: kind.clone(), have, need: u64::from(*n) });
                    }
                }
            }
            if missing.is_empty() {
                Ok(cost)
            } else {
                Err(missing)
            }
        }
        Unlock::Any(options) => {
            let mut missing = Vec::new();
            for option in options {
                match check(option, wallet, season) {
                    Ok(c) => return Ok(c),
                    Err(m) => missing.extend(m),
                }
            }
            Err(missing)
        }
    }
}

/// The coins a thing cost in the catalogue (all of an `All`, the least of an `Any`; 0 for what is not paid in coins).
pub fn coin_price(u: &Unlock) -> u32 {
    match u {
        Unlock::Coins(n) => *n,
        Unlock::All(v) => v.iter().map(coin_price).sum(),
        Unlock::Any(v) => v.iter().map(coin_price).min().unwrap_or(0),
        _ => 0,
    }
}
