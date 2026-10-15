// The save's format, and the steps that bring an older save up to it. A new version of the app must open every
// save an older one made: never change what a save holds without a step here (and the golden saves in
// crates/teul-core/tests/fixtures must keep opening — see docs/architecture.md, "Save integrity and compatibility").
//
// Formats:
//  1 — the event log, snapshots and meta in IndexedDB, as they are (every version before 1.0);
//  2 — the meta knows its format, the content and the app it was last opened with; the store is sealed at rest
//      with the device's data key (the store seals a plain save itself, `storage.ts::sealAtRest`).

import type { WorldData, WorldMeta } from './storage';

export const SAVE_FORMAT = 2;

/** The app's version (package.json), set at build time. */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';

/** A save made by a newer version than this one: it is not opened (and never written over). */
export class SaveTooNew extends Error {
  constructor(readonly format: number) {
    super(`save format ${format} is newer than ${SAVE_FORMAT}`);
  }
}

type Step = (w: WorldData) => WorldData;

/** `STEPS[n]` brings a format-n save to format n + 1. Steps are never removed or changed once released. */
const STEPS: Record<number, Step> = {
  1: (w) => ({ ...w, meta: { ...w.meta, format: 2 } }),
};

export function formatOf(meta: WorldMeta): number {
  return typeof meta.format === 'number' && meta.format >= 1 ? meta.format : 1;
}

/** A whole world brought up to this version's format (unchanged when it already is). */
export function migrateWorld(w: WorldData): WorldData {
  let f = formatOf(w.meta);
  if (f > SAVE_FORMAT) throw new SaveTooNew(f);
  let out = w;
  while (f < SAVE_FORMAT) {
    const step = STEPS[f];
    if (!step) throw new Error(`no step from save format ${f}`);
    out = step(out);
    f = formatOf(out.meta);
  }
  return out;
}

/** The meta brought up to this version's format (a step that only touches the meta). */
export function migrateMeta(meta: WorldMeta): WorldMeta {
  return migrateWorld({ meta, events: [], snapshots: [], userItems: [] }).meta;
}

/** What content a world is opened with: `id@version` of each pack, read from the pack texts' heads. */
export function contentVersion(packs: string[]): string {
  return packs
    .map((p) => {
      const head = p.slice(0, 400);
      const id = /"id"\s*:\s*"([^"]+)"/.exec(head)?.[1] ?? '?';
      const v = /"version"\s*:\s*(\d+)/.exec(head)?.[1] ?? '?';
      return `${id}@${v}`;
    })
    .join(',');
}
