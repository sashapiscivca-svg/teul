// Undo and redo for room editing, built from compensating commands. Items taken out and put back get a new id
// from the engine; every entry translates old ids to current ones, so older entries keep working.

import type { Command, CommandResult, PlacementView } from './types';

export interface Entry {
  undo(): boolean;
  redo(): boolean;
}

const LIMIT = 100;

function placedPid(r: CommandResult): number | null {
  if (!r.ok) return null;
  const ev = r.events.find((e) => e.kind.type === 'Placed');
  return ev ? (ev.kind.pid as number) : null;
}

export class History {
  private undoStack: Entry[] = [];
  private redoStack: Entry[] = [];
  private readonly pidMap = new Map<number, number>();

  constructor(
    private readonly run: (cmd: Command) => CommandResult,
    private readonly onChange: () => void = () => undefined,
  ) {}

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Forgets everything (after changes the player did not make, such as the house being built for them). */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.pidMap.clear();
    this.onChange();
  }

  push(entry: Entry): void {
    this.undoStack.push(entry);
    if (this.undoStack.length > LIMIT) this.undoStack.shift();
    this.redoStack = [];
    this.onChange();
  }

  /** The command with its item id replaced by the item's current id. */
  mapped(cmd: Command): Command {
    if (!('pid' in cmd) || typeof cmd.pid !== 'number') return cmd;
    let pid: number = cmd.pid;
    for (let i = 0; i < 50 && this.pidMap.has(pid); i++) pid = this.pidMap.get(pid) as number;
    return pid === cmd.pid ? cmd : ({ ...cmd, pid } as Command);
  }

  /** Runs commands in order (with current ids) and stops at the first failure. */
  runAll(cmds: Command[]): boolean {
    for (const c of cmds) if (!this.run(this.mapped(c)).ok) return false;
    return true;
  }

  /** Runs a command and remembers how to undo it; `inverse` is built from the room as it was before. */
  commit(cmd: Command, inverse: Command[]): CommandResult {
    const r = this.run(cmd);
    if (r.ok) this.push({ undo: () => this.runAll(inverse), redo: () => this.run(this.mapped(cmd)).ok });
    return r;
  }

  /** Several steps as one entry (for example all settings of a random look). */
  commitAll(cmds: Command[], inverse: Command[]): boolean {
    if (!this.runAll(cmds)) return false;
    this.push({ undo: () => this.runAll(inverse), redo: () => this.runAll(cmds) });
    return true;
  }

  place(cmd: Extract<Command, { type: 'place' }>): CommandResult {
    const r = this.run(cmd);
    let pid = placedPid(r);
    if (pid === null) return r;
    this.push({
      undo: () => this.run(this.mapped({ type: 'store', pid: pid as number })).ok,
      redo: () => {
        const again = this.run(cmd);
        const next = placedPid(again);
        if (next !== null) {
          this.pidMap.set(pid as number, next);
          pid = next;
        }
        return again.ok;
      },
    });
    return r;
  }

  /** Stores an item; undo puts it back where it was with its colours and settings. */
  store(p: PlacementView, defaults: Record<string, string>): CommandResult {
    const r = this.run({ type: 'store', pid: p.pid });
    if (!r.ok) return r;
    let current = p.pid;
    const restore: Command = { type: 'place', item: p.item, x: p.x, y: p.y, rot: p.rot, wall: p.wall, on: p.on === null ? null : (this.mapped({ type: 'store', pid: p.on }) as { pid: number }).pid };
    this.push({
      undo: () => {
        const back = this.run(restore);
        const next = placedPid(back);
        if (next === null) return false;
        this.pidMap.set(current, next);
        current = next;
        for (const [key, value] of Object.entries(p.props ?? {})) this.run({ type: 'set_prop', pid: current, key, value });
        for (const [slot, color] of Object.entries(p.colors)) if (color !== defaults[slot]) this.run({ type: 'recolor', pid: current, slot, color });
        return true;
      },
      redo: () => this.run({ type: 'store', pid: current }).ok,
    });
    return r;
  }

  undo(): void {
    const e = this.undoStack.pop();
    if (!e) return;
    if (e.undo()) this.redoStack.push(e);
    this.onChange();
  }

  redo(): void {
    const e = this.redoStack.pop();
    if (!e) return;
    if (e.redo()) this.undoStack.push(e);
    this.onChange();
  }
}
