// What the world sounds like around the hero, as plain numbers (tested without any audio): how loud each layer of
// the ambience is for the hour, the season, the sky and where one is (birds, crickets, rain on leaves or on the
// roof, wind, the hum of the town), how often the occasional sounds come (the rooster, a dog far off, a cat, the
// train, the temple's gong, the ice on the lake, fireworks, the Sunday peal), what footsteps sound like on what is
// underfoot, and how a sound from a place on the map is heard (quieter further off, on its side of the screen).

export interface Around {
  /** 0 in daylight, 1 deep night. */
  dark: number;
  /** Minute of the day. */
  minute: number;
  season?: string;
  /** The sky over the town: clear, cloudy, rain, storm, snow, fog. */
  sky: string;
  /** The place's id (village, forest, fields, temple_in…). */
  place: string;
  /** Out under the sky. */
  outdoors: boolean;
  /** Under a roof one can hear the rain on (a room of a house, a shop, the café). */
  roofed: boolean;
  underground: boolean;
  /** How near the water is (0 none .. 1 at the edge). */
  water: number;
  /** How near frozen water is (0..1). */
  ice: number;
  /** Fireworks in the sky now. */
  fireworks: boolean;
  /** Today is Sunday. */
  sunday: boolean;
  /** How near the temple's gong is (1 inside). */
  temple: number;
}

export interface Layers {
  birds: number;
  crickets: number;
  /** Rain on the leaves and the ground, out of doors. */
  leaves: number;
  /** Rain drumming on the roof above, inside. */
  roof: number;
  wind: number;
  /** The town going about its day: far traffic, voices, a door. */
  hum: number;
}

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const BIRDS: Record<string, number> = { Spring: 1, Summer: 0.85, Autumn: 0.5, Winter: 0.18 };
const CRICKETS: Record<string, number> = { Spring: 0.2, Summer: 1, Autumn: 0.35, Winter: 0 };
const TOWNS: ReadonlySet<string> = new Set(['village']);
const WILD: ReadonlySet<string> = new Set(['forest', 'fields', 'farm', 'vineyard', 'cemetery', 'hippodrome', 'dump']);

/** The ambience's layers for the moment and the place. */
export function seasonal(a: Around): Layers {
  const wet = a.sky === 'rain' || a.sky === 'storm' ? (a.sky === 'storm' ? 1 : 0.8) : 0;
  const out = a.outdoors ? 1 : 0;
  const h = a.minute / 60;
  // the dawn chorus from five to eight, quieter through the day, a little song again at dusk
  const hour = h >= 5 && h < 8 ? 1.4 : h >= 8 && h < 18 ? 0.8 : h >= 18 && h < 21 ? 0.6 : 0;
  const birds = wet || !out ? 0 : clamp((1 - a.dark) * hour * (BIRDS[a.season ?? 'Summer'] ?? 0.8) * 0.75);
  const crickets = wet || !out ? 0 : clamp(a.dark > 0.5 ? (a.dark - 0.4) * (CRICKETS[a.season ?? 'Summer'] ?? 0.6) * 0.6 : 0);
  const leaves = clamp(wet * out * 0.9);
  const roof = a.roofed && !a.outdoors && !a.underground ? clamp(wet * 0.6) : 0;
  const wind = a.underground ? 0 : clamp(out * (a.sky === 'storm' ? 0.85 : a.sky === 'snow' || a.sky === 'fog' ? 0.5 : WILD.has(a.place) ? 0.3 : 0.2) + (!out && a.sky === 'storm' ? 0.15 : 0));
  const day = h >= 7 && h < 22 ? (h >= 9 && h < 19 ? 1 : 0.5) : 0.1;
  const hum = TOWNS.has(a.place) && out ? clamp(0.35 * day) : 0;
  return { birds, crickets, leaves, roof, wind, hum };
}

export interface Rates {
  /** Each a chance per second. */
  rooster: number;
  dog: number;
  cat: number;
  train: number;
  gong: number;
  iceCrack: number;
  firework: number;
  /** The church's peal before the Sunday mass (a quarter of an hour of bells). */
  peal: boolean;
}

/** How often the occasional sounds come, now and here. */
export function rates(a: Around): Rates {
  const h = a.minute / 60;
  const out = a.outdoors;
  const country = WILD.has(a.place) || a.place === 'farm';
  return {
    rooster: out && (TOWNS.has(a.place) || a.place === 'farm') && h >= 4.75 && h < 7 ? (a.place === 'farm' ? 0.08 : 0.025) : 0,
    dog: out && TOWNS.has(a.place) ? (a.dark > 0.6 ? 0.012 : 0.006) : 0,
    cat: out && TOWNS.has(a.place) && a.dark > 0.4 ? 0.006 : 0,
    train: out && (country || TOWNS.has(a.place)) ? 1 / 420 : 0,
    gong: a.temple >= 1 ? 1 / 45 : a.temple > 0 ? (a.temple * 1) / 150 : 0,
    iceCrack: out && a.ice > 0.2 && a.season === 'Winter' ? 0.05 * a.ice : 0,
    firework: out && a.fireworks ? 1.6 : 0,
    peal: a.sunday && h >= 9.5 && h < 10,
  };
}

export type Surface = 'grass' | 'gravel' | 'wood' | 'stone' | 'snow' | 'ice' | 'water' | 'carpet' | 'sand';

/** What is underfoot, by the floor's style (and snow over the grass in winter, out of doors). */
export function surfaceOf(style: string | undefined, snowy: boolean): Surface {
  const s = style ?? '';
  if (/water|lily/.test(s)) return 'water';
  if (/ice/.test(s)) return 'ice';
  if (/grass|meadow|moss|soil|amberleaf|glassmoss/.test(s)) return snowy ? 'snow' : 'grass';
  if (/gravel|dirt|path|pagepath/.test(s)) return snowy ? 'snow' : 'gravel';
  if (/sand|salt|dune|mirage/.test(s)) return 'sand';
  if (/carpet|rug/.test(s)) return 'carpet';
  if (/oak|pine|walnut|herring|deck|wood|plank|parquet/.test(s)) return 'wood';
  return 'stone';
}

/** A footstep on each surface: a burst of noise through a band, how long, how loud, and a low thud under it. */
export const STEPS: Record<Surface, { band: number; q: number; len: number; gain: number; thud: number }> = {
  grass: { band: 1400, q: 0.6, len: 0.09, gain: 0.12, thud: 0 },
  gravel: { band: 2600, q: 0.8, len: 0.12, gain: 0.2, thud: 0.04 },
  wood: { band: 520, q: 1.4, len: 0.08, gain: 0.18, thud: 0.14 },
  stone: { band: 900, q: 1.1, len: 0.06, gain: 0.16, thud: 0.08 },
  snow: { band: 1100, q: 0.5, len: 0.16, gain: 0.16, thud: 0 },
  ice: { band: 3200, q: 2, len: 0.05, gain: 0.12, thud: 0.06 },
  water: { band: 700, q: 0.4, len: 0.22, gain: 0.22, thud: 0 },
  carpet: { band: 380, q: 0.7, len: 0.07, gain: 0.08, thud: 0.05 },
  sand: { band: 1800, q: 0.5, len: 0.12, gain: 0.12, thud: 0 },
};

/** A sound `dist` cells away, drawn at `screenX` on a screen `width` wide: its volume and its side (-1..1). */
export function heard(dist: number, screenX: number, width: number, reach = 14): { volume: number; pan: number } {
  if (dist >= reach) return { volume: 0, pan: 0 };
  // loud close by, falling off softly (the inverse square tamed), silent at the edge of hearing
  const near = 1 / (1 + (dist * dist) / 18);
  const edge = 1 - dist / reach;
  const pan = Math.max(-1, Math.min(1, (screenX / Math.max(1, width)) * 2 - 1));
  return { volume: clamp(near * edge * 1.05), pan: pan * 0.9 };
}
