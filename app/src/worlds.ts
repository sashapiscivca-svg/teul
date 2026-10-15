// The worlds kept on this device. Usually one; a second comes when a backup is opened beside the first
// («залишити обидва»). Each lives in its own database; which one opens is remembered here (a plain entry: it
// names databases, nothing private).
import { t } from './i18n';

const KEY = 'teul.worlds';

export interface WorldEntry {
  /** 'main' is the first world (the database `teul`); others are `teul-w<id>`. */
  id: string;
  name: string;
  made: number;
}

interface Registry {
  active: string;
  list: WorldEntry[];
}

type Web = Pick<Storage, 'getItem' | 'setItem'> | null;

const ls = (): Web => globalThis.localStorage ?? null;

function read(web: Web): Registry {
  try {
    const r = JSON.parse(web?.getItem(KEY) ?? 'null') as Registry | null;
    if (r && Array.isArray(r.list) && typeof r.active === 'string' && r.list.some((w) => w.id === r.active)) return r;
  } catch {
    // unreadable: the first world
  }
  return { active: 'main', list: [{ id: 'main', name: t('worlds.main'), made: 0 }] };
}

function write(r: Registry, web: Web): void {
  try {
    web?.setItem(KEY, JSON.stringify(r));
  } catch {
    // storage blocked: the first world opens
  }
}

export function dbName(id: string): string {
  return id === 'main' ? 'teul' : `teul-w${id}`;
}

export function worlds(web: Web = ls()): WorldEntry[] {
  return read(web).list;
}

export function activeWorld(web: Web = ls()): WorldEntry {
  const r = read(web);
  return r.list.find((w) => w.id === r.active)!;
}

/** A new entry (a world opened from a backup beside this one), made the active one if asked. */
export function addWorld(name: string, activate: boolean, web: Web = ls(), now = Date.now()): WorldEntry {
  const r = read(web);
  const id = now.toString(36) + Math.floor(Math.random() * 1296).toString(36);
  const entry = { id, name, made: now };
  write({ active: activate ? id : r.active, list: [...r.list, entry] }, web);
  return entry;
}

export function switchWorld(id: string, web: Web = ls()): void {
  const r = read(web);
  if (r.list.some((w) => w.id === id)) write({ ...r, active: id }, web);
}

export function renameWorld(id: string, name: string, web: Web = ls()): void {
  const r = read(web);
  write({ ...r, list: r.list.map((w) => (w.id === id ? { ...w, name } : w)) }, web);
}

/** Forgets a world (its database is deleted by the caller); the first one left becomes active. */
export function forgetWorld(id: string, web: Web = ls()): void {
  const r = read(web);
  const list = r.list.filter((w) => w.id !== id);
  if (list.length === 0) return;
  write({ active: r.active === id ? list[0].id : r.active, list }, web);
}
