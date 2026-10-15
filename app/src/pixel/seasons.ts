// The year outdoors, in the models themselves: not only colours but what grows. Broad-leaved trees go bare in
// winter (snow on their branches), turn and thin out in autumn and drop their leaves round them, bud and blossom
// in spring; flowers bloom in their season and are gone under the snow; crops sprout, ripen and are cut.
// A season is told as "Autumn:2": its name and which of its four weeks it is.

import type { ItemDef } from '../types';
import type { WorldBox } from '../models';

export interface SeasonBox extends WorldBox {
  /** A colour the season gives it (otherwise the model's own). */
  color?: string;
  snow?: boolean;
}

export interface SeasonNow {
  name: string;
  /** The week of the season, 0..3. */
  phase: number;
}

export function parseSeason(s: string | undefined): SeasonNow | null {
  if (!s) return null;
  const [name, phase] = s.split(':');
  return { name, phase: Math.max(0, Math.min(3, Number(phase ?? 1) || 0)) };
}

const BROADLEAF = /^(tree_(oak|birch|apple|maple|willow|sakura|ancient)|tree_w_(oak|oak_old|pear|willow|poplar|elm|birch|weeping_willow|alder|bog_birch|willow_stump|orchard_cherry|orchard_apple|orchard_pear)_[a-z]|bush_round|bush_flowering|berry_bush|rose_bush)$/;
const CROWN = /^(leaf|leafy|crown|crown2|bush)$/;
const BLOOM = /^(flower|f1|f2|f3|bloom|petal|center|berry|fruit|head|grape)$/;
const STEM = /^(stem|reed)$/;
const FLOWERS = /^(flower_bed|tulips|rose_bush|bush_flowering|sunflowers|berry_bush|reeds|lavender_pot|hydrangea_pot|sunflower_vase)$/;
const TWIG = '#5e4a3a';
const AUTUMN = ['#d9662e', '#e8a23a', '#c8423a', '#d4a72c', '#b8552a'];
const EARLY_AUTUMN = ['#8ab84a', '#c9b040', '#e8a23a', '#7aa84a'];

function hash(a: number, b: number): number {
  let h = (a * 2654435761) ^ (b * 40503);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

/** Bare branches in place of a crown: a few sticks rising and forking inside it, maybe with snow on top. */
function twigs(b: WorldBox, seed: number, snow: boolean, leaves?: string): SeasonBox[] {
  const out: SeasonBox[] = [];
  const cx = b.gx + b.gw / 2;
  const cy = b.gy + b.gd / 2;
  const r = Math.min(b.gw, b.gd) / 2;
  const n = r > 0.5 ? 6 : 4;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + hash(seed, k) * 0.8;
    const d = r * (0.35 + hash(seed, k + 9) * 0.45);
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d;
    const z = b.z + b.h * (0.05 + hash(seed, k + 3) * 0.2);
    const h = b.h * (0.45 + hash(seed, k + 5) * 0.35);
    const t = Math.max(0.03, r * 0.07);
    out.push({ gx: x - t / 2, gy: y - t / 2, gw: t, gd: t, z, h, slot: 'trunk', color: TWIG });
    if (snow) out.push({ gx: x - t, gy: y - t, gw: t * 2, gd: t * 2, z: z + h, h: 3, slot: 'snow', color: '#f4f8fc' });
    if (leaves && k % 2 === 0) out.push({ gx: x - t * 2, gy: y - t * 2, gw: t * 4, gd: t * 4, z: z + h - 4, h: 6, slot: 'leaf', shape: 'ball', color: leaves });
  }
  // the middle stem up through the crown
  const t = Math.max(0.04, r * 0.1);
  out.push({ gx: cx - t / 2, gy: cy - t / 2, gw: t, gd: t, z: b.z, h: b.h * 0.85, slot: 'trunk', color: TWIG });
  if (snow) out.push({ gx: cx - t, gy: cy - t, gw: t * 2, gd: t * 2, z: b.z + b.h * 0.85, h: 3, slot: 'snow', color: '#f4f8fc' });
  return out;
}

/** A box shrunk round its centre (a thinning crown, a short sprout). */
function shrink(b: SeasonBox, k: number, kh = k): SeasonBox {
  return { ...b, gx: b.gx + (b.gw * (1 - k)) / 2, gy: b.gy + (b.gd * (1 - k)) / 2, gw: b.gw * k, gd: b.gd * k, h: b.h * kh };
}

/** Fallen leaves on the ground round a tree. */
function litter(boxes: WorldBox[], seed: number, sparse: boolean): SeasonBox[] {
  const crowns = boxes.filter((b) => CROWN.test(b.slot));
  if (crowns.length === 0) return [];
  const x0 = Math.min(...crowns.map((b) => b.gx));
  const y0 = Math.min(...crowns.map((b) => b.gy));
  const x1 = Math.max(...crowns.map((b) => b.gx + b.gw));
  const y1 = Math.max(...crowns.map((b) => b.gy + b.gd));
  const out: SeasonBox[] = [];
  const n = sparse ? 5 : 9;
  for (let k = 0; k < n; k++) {
    const x = x0 + hash(seed, k + 40) * (x1 - x0);
    const y = y0 + hash(seed, k + 50) * (y1 - y0);
    out.push({ gx: x - 0.08, gy: y - 0.06, gw: 0.16, gd: 0.12, z: 0, h: 1, slot: 'litter', shape: 'round', color: AUTUMN[k % AUTUMN.length] });
  }
  return out;
}

/** The model of a thing outdoors in a season. Things the year does not touch come back as they are. */
export function seasonBoxes(def: ItemDef, boxes: WorldBox[], season: SeasonNow | null, seed: number): SeasonBox[] {
  if (!season) return boxes;
  const { name, phase } = season;
  const id = def.id;
  const winter = name === 'Winter';
  const spring = name === 'Spring';
  const autumn = name === 'Autumn';

  // crops: wheat sprouts in spring, stands gold in summer, is cut to stubble in autumn and lies under snow
  if (id.startsWith('wheat')) {
    if (winter) return boxes.filter((b) => b.slot === 'stalk').map((b) => ({ ...shrink(b, 1, 0.25), color: '#c8ccd0', snow: true }));
    if (autumn && phase >= 1) return boxes.filter((b) => b.slot === 'stalk').map((b) => shrink(b, 1, 0.3));
    if (spring) return boxes.filter((b) => phase >= 2 || b.slot === 'stalk').map((b) => shrink(b, 1, 0.3 + phase * 0.2));
    return boxes;
  }
  if (id === 'grapevine') {
    if (winter) return boxes.filter((b) => b.slot !== 'leaf' && b.slot !== 'grape').map((b) => ({ ...b, snow: b.slot === 'wire' || b.slot === 'post' }));
    if (spring) return boxes.filter((b) => b.slot !== 'grape').map((b) => (b.slot === 'leaf' ? shrink(b, 0.4 + phase * 0.2) : b));
    if (autumn && phase >= 2) return boxes.filter((b) => b.slot !== 'grape').map((b) => (b.slot === 'leaf' ? shrink(b, 1 - (phase - 1) * 0.3) : b));
    return boxes;
  }
  if (def.category === 'farm' && boxes.some((b) => b.slot === 'soil')) {
    if (winter) return boxes.filter((b) => b.slot === 'soil' || b.slot === 'border' || b.slot === 'wood').map((b) => ({ ...b, snow: true }));
    if (spring) return boxes.map((b) => (b.slot === 'soil' || b.slot === 'border' || b.slot === 'wood' ? b : shrink(b, 0.5 + phase * 0.15)));
    return boxes;
  }
  if (id === 'mushrooms' && (winter || (spring && phase < 2))) return [];

  // flowers: bloom in their season, fade in autumn, gone under the snow in winter
  if (FLOWERS.test(id)) {
    const isBush = boxes.some((b) => CROWN.test(b.slot));
    const blooms = (show: boolean, dull = false) => (b: SeasonBox) => {
      if (BLOOM.test(b.slot)) return show ? [dull ? { ...b, color: '#8a6a4a' } : b] : [];
      return [b];
    };
    let out: SeasonBox[] = boxes;
    if (winter) {
      out = boxes.filter((b) => !BLOOM.test(b.slot) && !STEM.test(b.slot) && !CROWN.test(b.slot)).map((b) => ({ ...b, snow: true }));
      if (isBush) out = [...out, ...boxes.filter((b) => CROWN.test(b.slot)).flatMap((b, i) => twigs(b, seed + i, phase >= 1))];
      return out;
    }
    if (spring) {
      const tulip = id === 'tulips' || id === 'flower_bed';
      const open = tulip ? phase >= 1 : id === 'sunflowers' ? false : phase >= 2;
      out = boxes.flatMap(blooms(open)).map((b) => (STEM.test(b.slot) && !open ? shrink(b, 1, 0.5) : CROWN.test(b.slot) ? { ...shrink(b, 0.6 + phase * 0.13), color: '#8ccc6a' } : b));
      return out;
    }
    if (autumn) {
      out = boxes.flatMap(blooms(phase < 2 || id === 'sunflowers', phase >= 1)).map((b) => (STEM.test(b.slot) ? { ...b, color: '#8a7a4a' } : b));
      if (isBush) out = out.map((b, i) => (CROWN.test(b.slot) ? { ...shrink(b, 1 - phase * 0.12), color: AUTUMN[(i + seed) % AUTUMN.length] } : b));
      return out;
    }
    // summer: berries and fruit come in after the first week
    return phase === 0 ? boxes.filter((b) => b.slot !== 'berry') : boxes;
  }

  // broad-leaved trees and bushes
  if (BROADLEAF.test(id)) {
    const crowns = boxes.filter((b) => CROWN.test(b.slot));
    const rest = boxes.filter((b) => !CROWN.test(b.slot) && b.slot !== 'fruit');
    const fruit = boxes.filter((b) => b.slot === 'fruit');
    if (winter) return [...rest.map((b) => ({ ...b, snow: phase >= 1 && b.slot === 'trunk' })), ...crowns.flatMap((b, i) => twigs(b, seed + i, phase >= 1))];
    if (autumn) {
      if (phase === 3) return [...rest, ...crowns.flatMap((b, i) => twigs(b, seed + i, false, AUTUMN[(seed + i) % AUTUMN.length])), ...litter(boxes, seed, false)];
      const k = phase === 2 ? 0.7 : 1;
      const colours = phase === 0 ? EARLY_AUTUMN : AUTUMN;
      return [...rest, ...(phase === 0 ? fruit : []), ...crowns.map((b, i) => ({ ...shrink(b, k), color: colours[(seed + i * 3) % colours.length] })), ...(phase >= 1 ? litter(boxes, seed, phase === 1) : [])];
    }
    if (spring) {
      if (phase === 0) return [...rest, ...crowns.flatMap((b, i) => twigs(b, seed + i, false, '#a8d870'))];
      const blossom = id === 'tree_apple' || id === 'tree_sakura' || id.startsWith('tree_w_pear') || id.startsWith('tree_w_orchard_');
      if (phase === 1 && blossom) return [...rest, ...crowns.map((b, i) => ({ ...shrink(b, 0.85), color: id === 'tree_sakura' || i % 2 ? '#f6c8dc' : '#fbf2f6' }))];
      return [...rest, ...crowns.map((b) => ({ ...shrink(b, 0.75 + phase * 0.08), color: '#7cc46a' }))];
    }
    // summer: apples ripen from the middle of it
    return [...rest, ...crowns, ...(phase >= 2 ? fruit : [])];
  }
  return boxes;
}
