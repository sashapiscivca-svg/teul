use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use crate::core::{Core, CoreError, WorldMeta};
use crate::storage::{SqliteStorage, StorageError};

#[derive(Debug)]
pub enum TransferError {
    DestinationExists(PathBuf),
    Invalid(String),
    Io(std::io::Error),
    Storage(StorageError),
}

impl std::fmt::Display for TransferError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TransferError::DestinationExists(p) => write!(f, "{} already exists", p.display()),
            TransferError::Invalid(m) => write!(f, "not a usable teul save: {m}"),
            TransferError::Io(e) => write!(f, "file error: {e}"),
            TransferError::Storage(e) => write!(f, "{e}"),
        }
    }
}

impl std::error::Error for TransferError {}

impl From<std::io::Error> for TransferError {
    fn from(e: std::io::Error) -> Self {
        TransferError::Io(e)
    }
}

impl From<StorageError> for TransferError {
    fn from(e: StorageError) -> Self {
        TransferError::Storage(e)
    }
}

/// `path` with `suffix` appended to the whole file name (`a.teul` -> `a.teul.importing`).
fn sibling(path: &Path, suffix: &str) -> PathBuf {
    let mut name = path.as_os_str().to_owned();
    name.push(suffix);
    PathBuf::from(name)
}

/// Writes a backup without ever leaving a half-written file under the final name: the copy is
/// made next to `dest`, flushed to disk, and only then renamed into place.
pub fn export_save(storage: &SqliteStorage, dest: &Path) -> Result<(), TransferError> {
    if dest.exists() {
        return Err(TransferError::DestinationExists(dest.to_path_buf()));
    }
    let staging = sibling(dest, ".exporting");
    if staging.exists() {
        return Err(TransferError::DestinationExists(staging));
    }
    let result = (|| -> Result<(), TransferError> {
        storage.export_to(&staging)?;
        fs::OpenOptions::new().write(true).open(&staging)?.sync_all()?;
        if dest.exists() {
            return Err(TransferError::DestinationExists(dest.to_path_buf()));
        }
        fs::rename(&staging, dest)?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&staging);
    }
    result
}

/// Validates `src` completely and only then places it at `dest`. A bad file leaves nothing behind,
/// and no file that already exists (the destination, the source, or a leftover staging file) is
/// ever overwritten or deleted.
pub fn import_save(src: &Path, dest: &Path) -> Result<WorldMeta, TransferError> {
    if dest.exists() {
        return Err(TransferError::DestinationExists(dest.to_path_buf()));
    }
    let staging = sibling(dest, ".importing");
    let mut input = fs::File::open(src)?;
    // `create_new` fails if the staging path exists, so we never touch a file we did not create.
    // A fresh file also gets default permissions, so a read-only backup yields a writable world.
    let mut output = fs::OpenOptions::new().write(true).create_new(true).open(&staging)?;
    let copied = io::copy(&mut input, &mut output).and_then(|_| output.sync_all());
    drop(output);
    if let Err(e) = copied {
        let _ = fs::remove_file(&staging);
        return Err(e.into());
    }

    let placed = check_save(&staging).and_then(|meta| {
        if dest.exists() {
            return Err(TransferError::DestinationExists(dest.to_path_buf()));
        }
        fs::rename(&staging, dest)?;
        Ok(meta)
    });
    if placed.is_err() {
        let _ = fs::remove_file(&staging);
    }
    placed
}

fn check_save(path: &Path) -> Result<WorldMeta, TransferError> {
    let invalid = |e: &dyn std::fmt::Display| TransferError::Invalid(e.to_string());
    let storage = SqliteStorage::open_read_only(path).map_err(|e| invalid(&e))?;
    if !storage.integrity_ok().map_err(|e| invalid(&e))? {
        return Err(TransferError::Invalid("integrity check failed".into()));
    }
    let core = Core::open(storage, 0).map_err(|e: CoreError| invalid(&e))?;
    Ok(core.meta().clone())
}
