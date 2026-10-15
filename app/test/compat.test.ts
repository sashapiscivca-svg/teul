// Golden saves: worlds saved by version 1.0 (crates/teul-core/tests/fixtures/saves/*.json, made once by this
// file and never regenerated). Every later version must open them whole — no event left out, the same money,
// things and home. If one of these tests fails after a change, the change broke old saves: add a migration
// step (savefmt.ts) or an alias (pack "aliases"), never edit the fixture. See docs/architecture.md,
// «Сумісність збережень». The same files are opened by the core directly (crates/teul-core/tests/golden_saves.rs).
// `friends_a` and `friends_b` were made by 1.0 with its network world (a key, contacts, parcels between two
// worlds); that world is gone, and they must still open with everything else they held.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { collect, exportBundle, importBundle, restore, type WorldBundle } from '../src/backup';
import { loadEngine, type GameEngine } from '../src/engine';
import { SAVE_FORMAT, migrateWorld } from '../src/savefmt';
import { newDataKey } from '../src/secure/seal';
import { openStore, sortKey, type StoredSnapshot, type WorldMeta } from '../src/storage';
import type { Command, EventRecord } from '../src/types';

const pack = readFileSync(new URL('../../content/base/pack.json', import.meta.url), 'utf8');
const wasm = readFileSync(new URL('../src/wasm/teul_wasm_bg.wasm', import.meta.url));
const DIR = new URL('../../crates/teul-core/tests/fixtures/saves/', import.meta.url);
/** 2026-10-10, local midnight in Kyiv: world day 0 (as the core's tests). */
const EPOCH = 20_736 * 86_400 - 3 * 3_600;

interface Expect {
  inputs: number;
  coins: number;
  placements: string[];
  inventory: [string, number][];
  name: string;
}

interface Golden extends WorldBundle {
  /** What the world held when it was saved. */
  expect: Expect;
  note: string;
}

function facts(e: GameEngine, now: number): Expect {
  return {
    inputs: e.integrity().inputs,
    coins: e.wallet().coins,
    placements: e.room().placements.map((p) => p.item).sort(),
    inventory: e.inventory().map((i) => [i.item, i.owned] as [string, number]).sort((a, b) => a[0].localeCompare(b[0])),
    name: e.world(now).player_name ?? '',
  };
}

// ---- making the golden saves (once) -------------------------------------------------------------------------

/** Things on sale now for a few coins (cheapest first). */
function buyable(e: GameEngine, now: number, most: number): string[] {
  return e
    .shop(now)
    .filter((s) => s.kind === 'item' && s.status.state === 'available' && s.status.cost.coins > 0 && s.status.cost.coins <= most && Object.keys(s.status.cost.tokens).length === 0)
    .sort((a, b) => (a.status.state === 'available' && b.status.state === 'available' ? a.status.cost.coins - b.status.cost.coins : 0))
    .map((s) => s.id);
}

class Play {
  log: EventRecord[] = [];
  snapshots: StoredSnapshot[] = [];
  ok = 0;
  now = 9 * 60;
  private constructor(public e: GameEngine, public meta: WorldMeta) {}
  static async start(meta: WorldMeta): Promise<Play> {
    return new Play(await loadEngine({ packs: [pack], device: meta.device, seed: meta.seed, epochUnixSecs: meta.epochUnixSecs, events: [], secret: meta.secret, wasm }), meta);
  }
  last: unknown = null;
  run(cmd: Command, step = 2): boolean {
    this.now += step;
    const r = this.e.command(cmd, this.now);
    this.last = r;
    if (!r.ok && process.env.TEUL_GOLDEN_DEBUG) console.log(cmd.type, JSON.stringify(r.error).slice(0, 120));
    this.log.push(...this.e.drain());
    const snap = this.e.takeSnapshot();
    if (snap) this.snapshots = [...this.snapshots, snap].slice(-2);
    if (r.ok) this.ok++;
    return r.ok;
  }
  nextDay(hour = 9): void {
    this.now = (Math.floor(this.now / 1440) + 1) * 1440 + hour * 60;
  }
  bundle(note: string, local: [string, string][] = []): Golden {
    return { kind: 'teul-world', format: SAVE_FORMAT, app: '1.0.0', made: '2026-10-11T12:00:00.000Z', world: { meta: this.meta, events: this.log, snapshots: this.snapshots, userItems: [] }, local, expect: facts(this.e, this.now), note };
  }
}

const meta = (device: number, seed: number, idByte: string): WorldMeta => ({ device, seed, epochUnixSecs: EPOCH, secret: 100_000_007 * device, idSeed: idByte.repeat(32), format: SAVE_FORMAT, content: 'base@1', app: '1.0.0' });

async function makeFresh(): Promise<Golden> {
  const p = await Play.start(meta(1001, 7, '11'));
  p.run({ type: 'name_player', name: 'Оксана' });
  p.run({ type: 'make_hero', set: [['look.hair', '3'], ['look.hair_color', '#d86a3a']] });
  return p.bundle('A new world: the hero named and dressed, nothing else.');
}

async function makePlayed(): Promise<Golden> {
  const p = await Play.start(meta(2002, 11, '22'));
  const c = p.e.catalog;
  p.run({ type: 'name_player', name: 'Тарас' });
  p.run({ type: 'make_hero', set: [['look.hair', '5'], ['look.skin_color', '#c98f65']] });
  for (const kit of Object.keys(c.kits ?? {})) p.run({ type: 'claim_kit', kit });
  // things bought and set out at home
  const cheap = buyable(p.e, p.now, 40).slice(0, 6);
  for (const id of cheap) p.run({ type: 'acquire', item: id });
  for (const id of cheap) {
    for (let k = 0; k < 30; k++) if (p.run({ type: 'place', item: id, x: 1 + (k % 6), y: 1 + Math.floor(k / 6), rot: 0, wall: null, on: null }, 1)) break;
  }
  const placed = p.e.room().placements;
  if (placed[0]) p.run({ type: 'rotate', pid: placed[0].pid, rot: 1 });
  p.run({ type: 'set_setting', key: 'time_mode', value: 'real' });
  // the town: walking about, talking, the stations that ask nothing, gathering
  p.nextDay(10);
  const places = Object.keys(c.locations ?? {}).filter((l) => l !== 'home').slice(0, 14);
  for (const loc of places) {
    if (!p.run({ type: 'travel', to: loc }, 5)) continue;
    const here = p.e.npcs(p.now).filter((n) => n.location === loc).slice(0, 2);
    for (const n of here) p.run({ type: 'talk', npc: n.id });
    const st = Object.values(c.stations ?? {}).filter((s) => s.location === loc && s.needs.length === 0 && s.cost <= 20).slice(0, 2);
    for (const s of st) p.run({ type: 'use', station: s.id }, 3);
    const spots = (c.locations?.[loc]?.spots ?? []).slice(0, 2);
    for (const s of spots) p.run({ type: 'gather', spot: (s as { id: string }).id }, 3);
  }
  for (const day of [11, 12]) {
    p.nextDay(day);
    for (const loc of places.slice(0, 6)) {
      if (!p.run({ type: 'travel', to: loc }, 5)) continue;
      for (const n of p.e.npcs(p.now).filter((x) => x.location === loc).slice(0, 2)) p.run({ type: 'talk', npc: n.id });
    }
  }
  p.run({ type: 'travel', to: 'home' }, 5);
  return p.bundle('A world played over four days: kits, shopping, a furnished room, walks, talks, stations, gathering.');
}

async function goldens(): Promise<Record<string, Golden>> {
  const want = ['fresh', 'played', 'friends_a', 'friends_b'];
  const have = want.every((n) => existsSync(new URL(`${n}.json`, DIR)));
  if (!have) {
    // made once (the first run of this suite); afterwards these files are history and are never rewritten (the
    // friends' worlds cannot be made again: the network world that made them is gone)
    mkdirSync(DIR, { recursive: true });
    const made: Record<string, Golden> = { fresh: await makeFresh(), played: await makePlayed() };
    for (const [n, g] of Object.entries(made)) if (!existsSync(new URL(`${n}.json`, DIR))) writeFileSync(new URL(`${n}.json`, DIR), JSON.stringify(g, null, 1) + '\n');
  }
  return Object.fromEntries(want.map((n) => [n, JSON.parse(readFileSync(new URL(`${n}.json`, DIR), 'utf8')) as Golden]));
}

/** Opens a world the way the app does: the latest snapshot and the events after it (or the whole log). */
async function open(w: WorldBundle['world'], fromSnapshot: boolean): Promise<GameEngine> {
  const m = w.meta;
  const snap = fromSnapshot ? w.snapshots.at(-1) : undefined;
  const after = (e: EventRecord, t: [number, number, number]) => {
    const k = sortKey(e);
    return k[0] !== t[0] ? k[0] > t[0] : k[1] !== t[1] ? k[1] > t[1] : k[2] > t[2];
  };
  const events = snap ? w.events.filter((e) => after(e, snap.through)) : w.events;
  return loadEngine({ packs: [pack], device: m.device, seed: m.seed, epochUnixSecs: m.epochUnixSecs, secret: m.secret, events, snapshot: snap?.json, covered: snap ? w.events.length - events.length : undefined, fullEvents: async () => w.events, wasm });
}

describe('golden saves of version 1.0 keep opening', async () => {
  const all = await goldens();

  it('the played world is a real one (40 commands or more, across the systems)', () => {
    expect(all.played.expect.inputs).toBeGreaterThanOrEqual(40);
    expect(all.played.world.snapshots.length).toBeGreaterThan(0);
  });

  it('the friends\' worlds hold what the network world of 1.0 left in a save', () => {
    const kinds = (g: Golden) => new Set(g.world.events.map((e) => e.kind.type));
    for (const g of [all.friends_a, all.friends_b]) {
      expect(kinds(g).has('IdentitySet')).toBe(true);
      expect(g.local.some(([k]) => k.endsWith('.teul.net.contacts'))).toBe(true);
    }
    expect(kinds(all.friends_a).has('ParcelSent') || kinds(all.friends_a).has('ParcelReceived')).toBe(true);
  });

  /** What a golden save held that the game no longer has (friends: the world's key, parcels), passed over as retired:
   * the inputs among it and all its events (as crates/teul-core/tests/golden_saves.rs). */
  const RETIRED: Record<string, [number, number]> = { fresh: [0, 0], played: [0, 0], friends_a: [3, 6], friends_b: [3, 6] };
  for (const name of ['fresh', 'played', 'friends_a', 'friends_b']) {
    for (const fromSnapshot of [false, true]) {
      it(`${name}${fromSnapshot ? ' (from its snapshot)' : ''}: opens whole, with what it held`, async () => {
        const g = all[name];
        const w = migrateWorld(g.world);
        const e = await open(w, fromSnapshot && w.snapshots.length > 0);
        const [goneInputs, retired] = RETIRED[name];
        expect(e.integrity().tampered).toBe(0);
        expect(e.integrity().retired).toBe(retired);
        const now = Math.max(...w.events.map((x) => x.time), 0) + 1;
        const f = facts(e, now);
        expect(f.inputs).toBe(g.expect.inputs - goneInputs);
        expect(f.coins).toBe(g.expect.coins);
        expect(f.placements).toEqual(g.expect.placements);
        // a parcel's thing comes back to the one who sent it and is gone from the one who got it
        const moved = new Map<string, number>();
        for (const ev of w.events) {
          const item = ev.kind.item as string | null | undefined;
          if (!item) continue;
          if (ev.kind.type === 'ParcelSent') moved.set(item, (moved.get(item) ?? 0) + 1);
          if (ev.kind.type === 'ParcelReceived') moved.set(item, (moved.get(item) ?? 0) - 1);
        }
        const held = (inv: [string, number][]) => inv.filter(([, n]) => n > 0);
        if (moved.size === 0) expect(f.inventory).toEqual(g.expect.inventory);
        else expect(held(f.inventory)).toEqual(held(g.expect.inventory.map(([item, n]) => [item, n + (moved.get(item) ?? 0)])));
        expect(f.name).toBe(g.expect.name);
      });
    }
  }

  it('a golden save goes through a sealed store and a backup file and comes back the same', async () => {
    const g = all.friends_a;
    const key = await newDataKey();
    const factory = new IDBFactory();
    const s = await openStore('golden', factory, IDBKeyRange, key);
    await restore(s, g, null);
    const file = await exportBundle(await collect(s, { entries: (match) => g.local.filter(([k]) => match(k)) }, 'w'), 'фраза для тесту');
    const back = await importBundle(file, 'фраза для тесту');
    expect(back.world).toEqual(migrateWorld(g.world));
    // (the network world's contacts it carried do not travel any more; its preferences do)
    expect(back.local).toEqual(g.local.filter(([k]) => !k.includes('.teul.net.')));
  });

  it('a save from before the format field (format 1) is brought up to this format', () => {
    const old = { ...all.fresh.world, meta: { ...all.fresh.world.meta } };
    delete (old.meta as Partial<WorldMeta>).format;
    expect(migrateWorld(old).meta.format).toBe(SAVE_FORMAT);
  });

  it('a save from a newer format is refused, not opened', () => {
    expect(() => migrateWorld({ ...all.fresh.world, meta: { ...all.fresh.world.meta, format: SAVE_FORMAT + 1 } })).toThrow();
  });
});
