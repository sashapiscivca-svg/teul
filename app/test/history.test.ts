import { describe, expect, it } from 'vitest';
import { History } from '../src/history';
import type { Command, CommandResult } from '../src/types';

/** A tiny fake engine: items by pid with a position, new pids on every place. */
function fake() {
  const items = new Map<number, { item: string; x: number; y: number; rot: number }>();
  let next = 0;
  const log: string[] = [];
  const run = (c: Command): CommandResult => {
    log.push(`${c.type}${'pid' in c ? c.pid : ''}`);
    const fail: CommandResult = { ok: false, error: { kind: 'unknown_placement', message: 'no' } };
    switch (c.type) {
      case 'place': {
        const pid = next++;
        items.set(pid, { item: c.item, x: c.x, y: c.y, rot: c.rot });
        return { ok: true, events: [{ id: { device: 1, seq: pid }, time: 0, rules_version: 2, kind: { type: 'Placed', pid } }] };
      }
      case 'move': {
        const it = items.get(c.pid);
        if (!it) return fail;
        it.x = c.x;
        it.y = c.y;
        return { ok: true, events: [] };
      }
      case 'rotate': {
        const it = items.get(c.pid);
        if (!it) return fail;
        it.rot = c.rot;
        return { ok: true, events: [] };
      }
      case 'store':
        return items.delete(c.pid) ? { ok: true, events: [] } : fail;
      default:
        return { ok: true, events: [] };
    }
  };
  return { items, run, log };
}

describe('History', () => {
  it('undoes and redoes a move', () => {
    const f = fake();
    const h = new History(f.run);
    h.place({ type: 'place', item: 'a', x: 0, y: 0, rot: 0 });
    h.commit({ type: 'move', pid: 0, x: 3, y: 3 }, [{ type: 'move', pid: 0, x: 0, y: 0 }]);
    h.undo();
    expect(f.items.get(0)).toMatchObject({ x: 0, y: 0 });
    h.redo();
    expect(f.items.get(0)).toMatchObject({ x: 3, y: 3 });
  });

  it('keeps later entries working after an item is put back under a new id', () => {
    const f = fake();
    const h = new History(f.run);
    h.place({ type: 'place', item: 'a', x: 0, y: 0, rot: 0 }); // pid 0
    h.commit({ type: 'move', pid: 0, x: 2, y: 2 }, [{ type: 'move', pid: 0, x: 0, y: 0 }]);
    h.commit({ type: 'rotate', pid: 0, rot: 1 }, [{ type: 'rotate', pid: 0, rot: 0 }]);
    h.undo(); // rotate
    h.undo(); // move
    h.undo(); // place -> store 0
    expect(f.items.size).toBe(0);
    h.redo(); // place again -> pid 1
    h.redo(); // move must now address pid 1
    h.redo(); // rotate too
    expect([...f.items.keys()]).toEqual([1]);
    expect(f.items.get(1)).toMatchObject({ x: 2, y: 2, rot: 1 });
    expect(h.canRedo).toBe(false);
  });

  it('undo of a store puts the item back and later commands follow it', () => {
    const f = fake();
    const h = new History(f.run);
    h.place({ type: 'place', item: 'a', x: 1, y: 1, rot: 0 });
    const p = { pid: 0, item: 'a', x: 1, y: 1, rot: 0, wall: null, on: null, colors: {}, props: {}, known: true };
    h.store(p, {});
    h.undo();
    expect([...f.items.keys()]).toEqual([1]);
    h.redo();
    expect(f.items.size).toBe(0);
  });

  it('a new action clears the redo stack', () => {
    const f = fake();
    const h = new History(f.run);
    h.place({ type: 'place', item: 'a', x: 0, y: 0, rot: 0 });
    h.undo();
    expect(h.canRedo).toBe(true);
    h.place({ type: 'place', item: 'b', x: 0, y: 0, rot: 0 });
    expect(h.canRedo).toBe(false);
  });
});
