//! Renamed content ids. A save keeps the ids its inputs and events were made with, forever (the chain signs
//! them, so they are never rewritten). When a content update renames or merges an id, the pack lists the old id
//! in `aliases` (`"old_id": "new_id"`), and replaying an old log reads every old id as the new one: the input is
//! planned with the new id, and the stored outcome is applied with it. Without an alias an input naming a
//! vanished id no longer plans and would be left out of the world on the next opening.
//!
//! The rule (docs/architecture.md, «Сумісність збережень»): never rename or remove a command or event variant,
//! a field, or a content id without an alias (or a migration) — old saves must keep opening.

use std::borrow::Cow;
use std::collections::BTreeMap;

use serde::de::DeserializeOwned;
use serde::Serialize;
use serde_json::Value;

/// Old content id → current one (chains already resolved: every value is a current id).
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Aliases {
    map: BTreeMap<String, String>,
}

/// Whether a string has the shape of a content id (so free text such as names is never touched).
pub fn looks_like_id(s: &str) -> bool {
    !s.is_empty() && s.len() <= 96 && s.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || matches!(b, b'_' | b'-' | b'.' | b':'))
}

impl Aliases {
    /// Resolves chains (`a → b`, `b → c` reads `a` as `c`); a cycle or a malformed id is an error.
    pub fn new(raw: BTreeMap<String, String>) -> Result<Aliases, String> {
        let mut map = BTreeMap::new();
        for (from, _) in &raw {
            if !looks_like_id(from) {
                return Err(format!("alias '{from}' is not a content id"));
            }
            let mut to = from;
            let mut steps = 0;
            while let Some(next) = raw.get(to) {
                if !looks_like_id(next) {
                    return Err(format!("alias target '{next}' is not a content id"));
                }
                to = next;
                steps += 1;
                if steps > raw.len() {
                    return Err(format!("aliases of '{from}' go round in a circle"));
                }
            }
            map.insert(from.clone(), to.clone());
        }
        Ok(Aliases { map })
    }

    pub fn is_empty(&self) -> bool {
        self.map.is_empty()
    }

    pub fn len(&self) -> usize {
        self.map.len()
    }

    /// The current id for an id (itself when it was never renamed).
    pub fn resolve<'a>(&'a self, id: &'a str) -> &'a str {
        self.map.get(id).map_or(id, String::as_str)
    }

    pub fn iter(&self) -> impl Iterator<Item = (&String, &String)> {
        self.map.iter()
    }

    /// A value (a command, an event, a state) with every old id in it read as the current one. Without aliases,
    /// or when nothing in it was renamed, the value itself.
    pub fn apply<'a, T: Serialize + DeserializeOwned + Clone>(&self, value: &'a T) -> Cow<'a, T> {
        if self.map.is_empty() {
            return Cow::Borrowed(value);
        }
        let Ok(mut json) = serde_json::to_value(value) else { return Cow::Borrowed(value) };
        if !self.rewrite(&mut json) {
            return Cow::Borrowed(value);
        }
        match serde_json::from_value(json) {
            Ok(v) => Cow::Owned(v),
            Err(_) => Cow::Borrowed(value),
        }
    }

    /// Rewrites ids among the strings and map keys of a JSON value; the `type` tags of variants are left alone.
    fn rewrite(&self, v: &mut Value) -> bool {
        match v {
            Value::String(s) => match self.map.get(s.as_str()) {
                Some(to) => {
                    *s = to.clone();
                    true
                }
                None => false,
            },
            Value::Array(a) => a.iter_mut().fold(false, |any, x| self.rewrite(x) | any),
            Value::Object(o) => {
                let mut any = false;
                if o.keys().any(|k| self.map.contains_key(k)) {
                    let old = std::mem::take(o);
                    for (k, val) in old {
                        let key = match self.map.get(&k) {
                            Some(to) => {
                                any = true;
                                to.clone()
                            }
                            None => k,
                        };
                        // two ids merged into one: counts add up, anything else keeps the later one
                        let merged = match (o.get(&key).and_then(Value::as_u64), val.as_u64()) {
                            (Some(a), Some(b)) => Value::from(a.saturating_add(b)),
                            _ => val,
                        };
                        o.insert(key, merged);
                    }
                }
                for (k, x) in o.iter_mut() {
                    if k == "type" {
                        continue;
                    }
                    any |= self.rewrite(x);
                }
                any
            }
            _ => false,
        }
    }
}
