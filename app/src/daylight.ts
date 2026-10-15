// Sky colour and lighting for a minute of the day. Piecewise-linear between key times.

export interface Daylight {
  sky: string;
  tint: string;
  /** How strongly the tint is laid over the scene, 0 to 1. */
  tintAlpha: number;
  /** 0 in full daylight, 1 in deep night; drives lamp glow and stars. */
  dark: number;
}

interface Key {
  at: number; // minute of the day
  sky: string;
  tint: string;
  tintAlpha: number;
  dark: number;
}

const KEYS: Key[] = [
  { at: 0, sky: '#1c2a54', tint: '#0a1240', tintAlpha: 0.42, dark: 1 },
  { at: 3 * 60 + 30, sky: '#1c2a54', tint: '#0a1240', tintAlpha: 0.42, dark: 1 },
  { at: 5 * 60, sky: '#3a3f7a', tint: '#1a2060', tintAlpha: 0.3, dark: 0.7 },
  { at: 7 * 60, sky: '#ffd9a0', tint: '#ffc88a', tintAlpha: 0.1, dark: 0.2 },
  { at: 11 * 60, sky: '#8fd0ff', tint: '#ffffff', tintAlpha: 0, dark: 0 },
  { at: 16 * 60, sky: '#8fd0ff', tint: '#ffffff', tintAlpha: 0, dark: 0 },
  { at: 18 * 60 + 30, sky: '#ff9a6a', tint: '#ff8a50', tintAlpha: 0.18, dark: 0.25 },
  { at: 20 * 60 + 30, sky: '#4a3a7a', tint: '#1a1a60', tintAlpha: 0.32, dark: 0.7 },
  { at: 22 * 60, sky: '#1c2a54', tint: '#0a1240', tintAlpha: 0.42, dark: 1 },
  { at: 24 * 60, sky: '#1c2a54', tint: '#0a1240', tintAlpha: 0.42, dark: 1 },
];

function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function lerpColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = channels(a);
  const [br, bg, bb] = channels(b);
  const mix = (x: number, y: number) => Math.round(x + (y - x) * t);
  return '#' + [mix(ar, br), mix(ag, bg), mix(ab, bb)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function daylight(minuteOfDay: number): Daylight {
  const m = ((minuteOfDay % 1440) + 1440) % 1440;
  let i = KEYS.length - 2;
  for (let k = 0; k < KEYS.length - 1; k++) {
    if (m < KEYS[k + 1].at) {
      i = k;
      break;
    }
  }
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = (m - a.at) / (b.at - a.at);
  return {
    sky: lerpColor(a.sky, b.sky, t),
    tint: lerpColor(a.tint, b.tint, t),
    tintAlpha: a.tintAlpha + (b.tintAlpha - a.tintAlpha) * t,
    dark: a.dark + (b.dark - a.dark) * t,
  };
}
