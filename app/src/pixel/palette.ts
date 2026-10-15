// Colour ramps for pixel art: every colour becomes five tones with a hue shift (warm light, cool shade), and
// in-between brightness is dithered with a Bayer matrix instead of blended.

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: RGB): string {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/** Moves a hue toward a target by up to `deg` degrees along the shorter way round. */
function toward(h: number, target: number, deg: number): number {
  let d = target - h;
  d = ((d + 540) % 360) - 180;
  return h + Math.sign(d) * Math.min(Math.abs(d), deg);
}

const rampCache = new Map<string, RGB[]>();

/**
 * Five tones for a colour: [deep shade, shade, base, light, highlight]. Shades lean toward blue-violet and
 * highlights toward warm yellow, which is what keeps pixel art from looking flat and grey.
 */
export function ramp(hex: string): RGB[] {
  const key = hex.toLowerCase();
  let r = rampCache.get(key);
  if (r) return r;
  const [h, s, l] = rgbToHsl(hexToRgb(key));
  const grey = s < 0.08;
  const sh = (deg: number, target: number) => (grey ? h : toward(h, target, deg));
  r = [
    hslToRgb(sh(18, 255), s * 0.9 + 0.06, l * 0.52),
    hslToRgb(sh(9, 250), s * 0.95 + 0.03, l * 0.74),
    hslToRgb(h, s, l),
    hslToRgb(sh(7, 55), s * 0.92, l + (1 - l) * 0.24),
    hslToRgb(sh(14, 55), s * 0.75, l + (1 - l) * 0.5),
  ];
  if (rampCache.size > 2000) rampCache.clear();
  rampCache.set(key, r);
  return r;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Threshold in [0, 1) for a pixel, for ordered dithering. */
export function bayer(x: number, y: number): number {
  return (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
}

/** The ramp index for a brightness level at a pixel: whole tones, dithered in between. */
export function toneAt(level: number, x: number, y: number): number {
  const v = Math.max(0, Math.min(4, level));
  const lo = Math.floor(v);
  return v - lo > bayer(x, y) ? Math.min(4, lo + 1) : lo;
}
