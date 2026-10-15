// How the things at home look as they age: the core says how old each one is (new, used, worn, broken); here that
// becomes a prop the pictures read — colours fade and darken, scuffs and dust appear, a broken thing sags. No bars,
// no numbers: only the look.

import type { RoomView, WearView } from './types';

/** The room with each ageing thing marked with its age (`props.wear`), so its picture changes with it. */
export function withWear(room: RoomView, wear: WearView[]): RoomView {
  if (wear.length === 0) return room;
  const age = new Map(wear.filter((w) => w.stage > 0).map((w) => [w.pid, w.stage]));
  if (age.size === 0) return room;
  return {
    ...room,
    placements: room.placements.map((p) => (age.has(p.pid) ? { ...p, props: { ...(p.props ?? {}), wear: String(age.get(p.pid)) } } : p)),
  };
}

/** How old a placed thing looks (0: new). */
export function wearOf(props: Record<string, string> | undefined): number {
  const n = Number(props?.wear ?? 0);
  return n >= 1 && n <= 3 ? Math.floor(n) : 0;
}

function hex(c: string): [number, number, number] {
  const v = c.replace('#', '');
  const full = v.length === 3 ? v.split('').map((x) => x + x).join('') : v;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

/**
 * A colour as it looks on a thing of that age: greyer (sun and hands take the colour out, fabric most) and a little
 * darker (grime). New things keep their colour.
 */
export function agedColor(color: string, stage: number, fabric: boolean): string {
  if (stage <= 0 || !/^#[0-9a-f]{3,6}$/i.test(color)) return color;
  const [r, g, b] = hex(color);
  const grey = (r * 30 + g * 59 + b * 11) / 100;
  const fade = [0, 0.18, 0.38, 0.55][stage] * (fabric ? 1.3 : 1);
  const dark = [1, 0.95, 0.86, 0.76][stage];
  const mix = (c: number) => Math.max(0, Math.min(255, Math.round((c + (grey - c) * fade) * dark)));
  return `#${[mix(r), mix(g), mix(b)].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

/** The boxes of a thing as its age shows on them: scuffs and dust on top of a worn one; a broken one sags and cracks. */
export function agedBoxes<T extends { gx: number; gy: number; gw: number; gd: number; z: number; h: number; slot: string; shape?: string; color?: string }>(boxes: T[], stage: number, salt: number): T[] {
  if (stage < 2 || boxes.length === 0) return boxes;
  // the broadest top: where hands and cups go
  let top = boxes[0];
  for (const b of boxes) if (b.gw * b.gd * (b.z + b.h) > top.gw * top.gd * (top.z + top.h)) top = b;
  const out = boxes.map((b) => ({ ...b }));
  const k = boxes.indexOf(top);
  // a broken one: the top sags at one side and a dark crack runs across it
  if (stage >= 3) out[k].z = Math.max(0, out[k].z - 5);
  const t = out[k];
  const marks: T[] = [];
  const spots = stage >= 3 ? 4 : 2;
  for (let i = 0; i < spots; i++) {
    const fx = ((salt * 37 + i * 53) % 70) / 100 + 0.1;
    const fy = ((salt * 61 + i * 29) % 70) / 100 + 0.1;
    marks.push({ ...t, gx: t.gx + t.gw * fx, gy: t.gy + t.gd * fy, gw: Math.min(0.16, t.gw * 0.22), gd: Math.min(0.12, t.gd * 0.18), z: t.z + t.h, h: 1, slot: 'scuff', shape: undefined, color: i % 2 ? '#4a3a32' : '#6a5a4e' });
  }
  if (stage >= 3) marks.push({ ...t, gy: t.gy + t.gd * 0.45, gd: Math.max(0.03, t.gd * 0.05), z: t.z + t.h, h: 1, slot: 'scuff', shape: undefined, color: '#2a2024' });
  return [...out, ...marks];
}
