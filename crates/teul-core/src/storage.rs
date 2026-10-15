use std::collections::BTreeMap;
use std::fmt;
#[cfg(feature = "sqlite")]
use std::path::Path;

#[cfg(feature = "sqlite")]
use rusqlite::{params, Connection, ErrorCode, OpenFlags};

use crate::event::{DecodeError, Event, EventId, SortKey};
#[cfg(feature = "sqlite")]
use crate::event::{decode_kind, encode_kind, EVENT_SCHEMA};
#[cfg(feature = "sqlite")]
use crate::state::DeltaState;
use crate::state::Snapshot;
#[cfg(feature = "sqlite")]
use crate::time::WorldTime;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum StorageError {
    Duplicate(EventId),
    Corrupt(String),
    Backend(String),
}

impl fmt::Display for StorageError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            StorageError::Duplicate(id) => write!(f, "event {}/{} already exists", id.device, id.seq),
            StorageError::Corrupt(m) => write!(f, "corrupt save: {m}"),
            StorageError::Backend(m) => write!(f, "storage error: {m}"),
        }
    }
}

impl std::error::Error for StorageError {}

impl From<DecodeError> for StorageError {
    fn from(e: DecodeError) -> Self {
        StorageError::Corrupt(format!("{e:?}"))
    }
}

pub trait Storage {
    fn append(&mut self, event: &Event) -> Result<(), StorageError>;
    /// Appends all events or none. Backends override this when they can do it more cheaply or atomically.
    fn append_batch(&mut self, events: &[Event]) -> Result<(), StorageError> {
        for event in events {
            self.append(event)?;
        }
        Ok(())
    }
    /// Events strictly after `after` in log order (all events when `None`), ordered by sort key.
    fn events_after(&self, after: Option<SortKey>) -> Result<Vec<Event>, StorageError>;
    fn max_seq(&self, device: u32) -> Result<Option<u64>, StorageError>;
    fn meta_get(&self, key: &str) -> Result<Option<String>, StorageError>;
    fn meta_set(&mut self, key: &str, value: &str) -> Result<(), StorageError>;
    fn save_snapshot(&mut self, snapshot: &Snapshot) -> Result<(), StorageError>;
    fn latest_snapshot(&self) -> Result<Option<Snapshot>, StorageError>;
    /// How many events there are up to and including `key` (a snapshot must cover exactly these).
    fn count_through(&self, key: SortKey) -> Result<u64, StorageError> {
        let after = self.events_after(Some(key))?.len() as u64;
        Ok(self.events_after(None)?.len() as u64 - after)
    }
}

#[derive(Default)]
pub struct MemoryStorage {
    events: BTreeMap<SortKey, Event>,
    ids: BTreeMap<EventId, ()>,
    meta: BTreeMap<String, String>,
    snapshot: Option<Snapshot>,
}

impl MemoryStorage {
    pub fn new() -> Self {
        Self::default()
    }
}

impl Storage for MemoryStorage {
    fn append_batch(&mut self, events: &[Event]) -> Result<(), StorageError> {
        let mut seen = BTreeMap::new();
        for event in events {
            if self.ids.contains_key(&event.id) || seen.insert(event.id, ()).is_some() {
                return Err(StorageError::Duplicate(event.id));
            }
        }
        for event in events {
            self.append(event)?;
        }
        Ok(())
    }

    fn append(&mut self, event: &Event) -> Result<(), StorageError> {
        if self.ids.contains_key(&event.id) {
            return Err(StorageError::Duplicate(event.id));
        }
        self.ids.insert(event.id, ());
        self.events.insert(event.sort_key(), event.clone());
        Ok(())
    }

    fn events_after(&self, after: Option<SortKey>) -> Result<Vec<Event>, StorageError> {
        Ok(self
            .events
            .iter()
            .filter(|(k, _)| after.map_or(true, |a| **k > a))
            .map(|(_, e)| e.clone())
            .collect())
    }

    fn max_seq(&self, device: u32) -> Result<Option<u64>, StorageError> {
        Ok(self.ids.keys().filter(|id| id.device == device).map(|id| id.seq).max())
    }

    fn meta_get(&self, key: &str) -> Result<Option<String>, StorageError> {
        Ok(self.meta.get(key).cloned())
    }

    fn meta_set(&mut self, key: &str, value: &str) -> Result<(), StorageError> {
        self.meta.insert(key.to_string(), value.to_string());
        Ok(())
    }

    fn save_snapshot(&mut self, snapshot: &Snapshot) -> Result<(), StorageError> {
        self.snapshot = Some(snapshot.clone());
        Ok(())
    }

    fn latest_snapshot(&self) -> Result<Option<Snapshot>, StorageError> {
        Ok(self.snapshot.clone())
    }

    fn count_through(&self, key: SortKey) -> Result<u64, StorageError> {
        Ok(self.events.range(..=key).count() as u64)
    }
}

#[cfg(feature = "sqlite")]
pub struct SqliteStorage {
    conn: Connection,
}

#[cfg(feature = "sqlite")]
fn backend(e: rusqlite::Error) -> StorageError {
    StorageError::Backend(e.to_string())
}

#[cfg(feature = "sqlite")]
fn to_i64(v: u64) -> Result<i64, StorageError> {
    i64::try_from(v).map_err(|_| StorageError::Backend(format!("{v} does not fit a database integer")))
}

#[cfg(feature = "sqlite")]
fn to_u64(v: i64) -> Result<u64, StorageError> {
    u64::try_from(v).map_err(|_| StorageError::Corrupt(format!("negative value {v} in save")))
}

#[cfg(feature = "sqlite")]
const SCHEMA_SQL: &str = "
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS events(
    device INTEGER NOT NULL,
    seq INTEGER NOT NULL,
    time INTEGER NOT NULL,
    rules_version INTEGER NOT NULL,
    schema INTEGER NOT NULL,
    kind TEXT NOT NULL,
    chain INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY(device, seq)
);
CREATE INDEX IF NOT EXISTS events_order ON events(time, device, seq);
CREATE TABLE IF NOT EXISTS snapshots(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    through_time INTEGER NOT NULL,
    through_device INTEGER NOT NULL,
    through_seq INTEGER NOT NULL,
    state TEXT NOT NULL
);";

#[cfg(feature = "sqlite")]
impl SqliteStorage {
    pub fn open(path: &Path) -> Result<Self, StorageError> {
        Self::from_connection(Connection::open(path).map_err(backend)?)
    }

    pub fn open_read_only(path: &Path) -> Result<Self, StorageError> {
        let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(backend)?;
        Ok(Self { conn })
    }

    pub fn open_in_memory() -> Result<Self, StorageError> {
        Self::from_connection(Connection::open_in_memory().map_err(backend)?)
    }

    fn from_connection(conn: Connection) -> Result<Self, StorageError> {
        conn.execute_batch(SCHEMA_SQL).map_err(backend)?;
        // saves from before the chain: add its column (old events keep 0, "not chained")
        let has_chain: bool = conn
            .prepare("SELECT 1 FROM pragma_table_info('events') WHERE name = 'chain'")
            .and_then(|mut st| st.exists([]))
            .map_err(backend)?;
        if !has_chain {
            conn.execute_batch("ALTER TABLE events ADD COLUMN chain INTEGER NOT NULL DEFAULT 0").map_err(backend)?;
        }
        Ok(Self { conn })
    }

    /// Writes a consistent single-file copy of the save. `dest` must not exist yet.
    pub fn export_to(&self, dest: &Path) -> Result<(), StorageError> {
        let dest = dest
            .to_str()
            .ok_or_else(|| StorageError::Backend("export path is not valid UTF-8".into()))?;
        self.conn.execute("VACUUM INTO ?1", params![dest]).map_err(backend)?;
        Ok(())
    }

    pub fn integrity_ok(&self) -> Result<bool, StorageError> {
        let verdict: String = self
            .conn
            .query_row("PRAGMA integrity_check", [], |r| r.get(0))
            .map_err(backend)?;
        Ok(verdict == "ok")
    }
}

#[cfg(feature = "sqlite")]
impl Storage for SqliteStorage {
    fn append_batch(&mut self, events: &[Event]) -> Result<(), StorageError> {
        let tx = self.conn.unchecked_transaction().map_err(backend)?;
        for event in events {
            let result = tx.execute(
                "INSERT INTO events(device, seq, time, rules_version, schema, kind, chain) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    event.id.device,
                    to_i64(event.id.seq)?,
                    to_i64(event.time.0)?,
                    event.rules_version,
                    EVENT_SCHEMA,
                    encode_kind(&event.kind),
                    to_i64(event.chain)?
                ],
            );
            match result {
                Ok(_) => {}
                Err(rusqlite::Error::SqliteFailure(e, _)) if e.code == ErrorCode::ConstraintViolation => {
                    return Err(StorageError::Duplicate(event.id));
                }
                Err(e) => return Err(backend(e)),
            }
        }
        tx.commit().map_err(backend)
    }

    fn append(&mut self, event: &Event) -> Result<(), StorageError> {
        let result = self.conn.execute(
            "INSERT INTO events(device, seq, time, rules_version, schema, kind, chain) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                event.id.device,
                to_i64(event.id.seq)?,
                to_i64(event.time.0)?,
                event.rules_version,
                EVENT_SCHEMA,
                encode_kind(&event.kind),
                to_i64(event.chain)?
            ],
        );
        match result {
            Ok(_) => Ok(()),
            Err(rusqlite::Error::SqliteFailure(e, _)) if e.code == ErrorCode::ConstraintViolation => {
                Err(StorageError::Duplicate(event.id))
            }
            Err(e) => Err(backend(e)),
        }
    }

    fn events_after(&self, after: Option<SortKey>) -> Result<Vec<Event>, StorageError> {
        let (t, d, s) = match after {
            Some((t, d, s)) => (to_i64(t.0)?, i64::from(d), to_i64(s)?),
            None => (-1, 0, 0),
        };
        let mut stmt = self
            .conn
            .prepare(
                "SELECT device, seq, time, rules_version, schema, kind, chain FROM events \
                 WHERE (time, device, seq) > (?1, ?2, ?3) ORDER BY time, device, seq",
            )
            .map_err(backend)?;
        let rows = stmt
            .query_map(params![t, d, s], |r| {
                Ok((
                    r.get::<_, u32>(0)?,
                    r.get::<_, i64>(1)?,
                    r.get::<_, i64>(2)?,
                    r.get::<_, u32>(3)?,
                    r.get::<_, u32>(4)?,
                    r.get::<_, String>(5)?,
                    r.get::<_, i64>(6)?,
                ))
            })
            .map_err(backend)?;
        let mut out = Vec::new();
        for row in rows {
            let (device, seq, time, rules_version, schema, kind, chain) = row.map_err(backend)?;
            out.push(Event {
                id: EventId { device, seq: to_u64(seq)? },
                time: WorldTime(to_u64(time)?),
                rules_version,
                kind: decode_kind(schema, &kind)?,
                chain: to_u64(chain)?,
            });
        }
        Ok(out)
    }

    fn max_seq(&self, device: u32) -> Result<Option<u64>, StorageError> {
        let max: Option<i64> = self
            .conn
            .query_row("SELECT MAX(seq) FROM events WHERE device = ?1", params![device], |r| r.get(0))
            .map_err(backend)?;
        max.map(to_u64).transpose()
    }

    fn meta_get(&self, key: &str) -> Result<Option<String>, StorageError> {
        match self.conn.query_row("SELECT value FROM meta WHERE key = ?1", params![key], |r| r.get(0)) {
            Ok(v) => Ok(Some(v)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(backend(e)),
        }
    }

    fn meta_set(&mut self, key: &str, value: &str) -> Result<(), StorageError> {
        self.conn
            .execute(
                "INSERT INTO meta(key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                params![key, value],
            )
            .map_err(backend)?;
        Ok(())
    }

    fn save_snapshot(&mut self, snapshot: &Snapshot) -> Result<(), StorageError> {
        // the whole snapshot (state and what vouches for it); only the two latest are kept
        let body = serde_json::to_string(snapshot).expect("a snapshot always serializes");
        self.conn
            .execute(
                "INSERT INTO snapshots(through_time, through_device, through_seq, state) VALUES (?1, ?2, ?3, ?4)",
                params![to_i64(snapshot.through.0 .0)?, snapshot.through.1, to_i64(snapshot.through.2)?, body],
            )
            .map_err(backend)?;
        self.conn
            .execute("DELETE FROM snapshots WHERE id NOT IN (SELECT id FROM snapshots ORDER BY id DESC LIMIT 2)", [])
            .map_err(backend)?;
        Ok(())
    }

    fn latest_snapshot(&self) -> Result<Option<Snapshot>, StorageError> {
        let row = self.conn.query_row(
            "SELECT through_time, through_device, through_seq, state FROM snapshots ORDER BY id DESC LIMIT 1",
            [],
            |r| Ok((r.get::<_, i64>(0)?, r.get::<_, u32>(1)?, r.get::<_, i64>(2)?, r.get::<_, String>(3)?)),
        );
        match row {
            Ok((t, d, s, body)) => {
                let through = (WorldTime(to_u64(t)?), d, to_u64(s)?);
                // a snapshot as saved now, or an older one that held only the state (never trusted: no mac)
                if let Ok(snap) = serde_json::from_str::<Snapshot>(&body) {
                    return Ok(Some(Snapshot { through, ..snap }));
                }
                let state: DeltaState = serde_json::from_str(&body).map_err(|e| StorageError::Corrupt(e.to_string()))?;
                Ok(Some(Snapshot { through, state, ..Snapshot::default() }))
            }
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(backend(e)),
        }
    }

    fn count_through(&self, key: SortKey) -> Result<u64, StorageError> {
        let (t, d, s) = key;
        let n: i64 = self
            .conn
            .query_row(
                "SELECT COUNT(*) FROM events WHERE (time, device, seq) <= (?1, ?2, ?3)",
                params![to_i64(t.0)?, d, to_i64(s)?],
                |r| r.get(0),
            )
            .map_err(backend)?;
        Ok(n as u64)
    }
}
