// The hero: tall and slim with a small head, a traveller of today: a t-shirt or a hoodie, a field jacket, trousers with pockets, trainers
// or boots, a backpack. Everything the player chooses (`look.*`, character.ts: the build, the skin, the hair and its
// colour, the face, the clothes and their colours, the shoes, a hat or glasses or a scarf) is drawn here, in every
// pose the hero takes: walking the four ways, standing, sitting on a chair and on the ground, in the lotus, lying,
// praying, washing, at work, eating, squatting, playing an instrument, swimming (the renderer shows the top of the
// figure), on a bicycle.
//
// The grid is 40 pixels a side (the citizens' 32 scaled by their Pen, but drawn pixel by pixel here, so the face is
// even and every part sits where it should); the figure stands with its feet on row 38 (the shadow on 39) and is
// symmetric about the line between columns 19 and 20. From the front: the head x 16..23, y 5..12; the neck y 13; the
// body x 15..24, y 14..26; the arms x 13..14 and 25..26, the hands at y 25..26; the legs x 16..18 and 21..23,
// y 26..36; the feet y 37..38. From the side (facing right): the head x 17..23 and the nose at 24, the body x 17..22.

import { Canvas, finish, HOLDS, layersOf, mix, remember, shade, type Dir, type Expression, type Fx, type HoldName, type Look, type PoseName } from '../character';
import { sizedLayers } from '../layers';
import type { Layer } from '../sprites';

export const HERO_PX = 40;

const N = HERO_PX;
const MOUTH = '#a8505a';
const OPEN_MOUTH = '#6a2a38';
const LOVE = '#e0607a';
const ROSY = '#e0607a';
const WHITE = '#ffffff';
const LENS = '#dff3ff';
const WOOD = '#9a6230';
const WOOD_DARK = '#5e3b1c';
const WOOD_LIGHT = '#d8a868';
const STRING = '#e8e0c8';
const IVORY = '#f4f0e6';
const EBONY = '#2a2438';
const ACC_RED = '#c0392b';

/** Long hair, as an older hero's look tells a woman's build from a man's when none was chosen. */
const LONG_HAIR = new Set([1, 3, 5, 8, 9, 12, 13]);

/** 0 a woman's build (narrower shoulders, a waist), 1 a man's. */
export function buildOf(L: Look): number {
  if (L.build !== undefined) return L.build;
  if (L.beard > 0) return 1;
  return LONG_HAIR.has(L.hairStyle) || L.topStyle === 3 || L.topStyle === 15 || L.bottomStyle === 2 || L.bottomStyle === 4 ? 0 : 1;
}

// ---- poses ---------------------------------------------------------------------------------------------------

type Kind = 'stand' | 'walk' | 'sit' | 'crouch' | 'ground' | 'pedal';
type Arms = 'down' | 'knees' | 'lap' | 'wash' | 'work' | 'eat' | 'pray' | 'bars' | 'hold';

interface Pose {
  kind: Kind;
  /** Walk phase 0..3, −1 standing. */
  step: number;
  /** Rows the head and the body are lowered (sitting) or raised (a step's bounce). */
  dy: number;
  /** From the side: pixels the head and shoulders lean forward. */
  lean: number;
  arms: Arms;
  /** The moment of the movement: the hammer, the pedals, the instrument. */
  f: number;
  hold?: HoldName;
}

const SEATED_HOLDS = new Set<HoldName>(['piano', 'bandura']);

function poseOf(name: PoseName, frame: number): Pose {
  const f2 = ((frame % 2) + 2) % 2;
  const f4 = ((frame % 4) + 4) % 4;
  const P = (kind: Kind, dy: number, arms: Arms, extra: Partial<Pose> = {}): Pose => ({ kind, step: -1, dy, lean: 0, arms, f: 0, ...extra });
  switch (name) {
    case 'walk':
      return P('walk', f4 % 2 === 1 ? -1 : 0, 'down', { step: f4 });
    case 'sit':
      return P('sit', 7, 'knees');
    case 'crouch':
      return P('crouch', 9, 'knees', { lean: 1 });
    case 'ground':
      return P('ground', 11, 'lap');
    case 'lotus':
      return P('ground', 11, 'pray');
    case 'wash':
      return P('stand', f2, 'wash');
    case 'work':
      return P('stand', 0, 'work', { f: f2 });
    case 'eat':
      return P('stand', f2, 'eat');
    case 'pray':
      return P('stand', 0, 'pray');
    case 'pedal':
      return P('pedal', 5, 'bars', { f: f4, lean: 2 });
    case 'idle':
      return P('stand', f2, 'down');
  }
  if ((HOLDS as readonly string[]).includes(name)) {
    const hold = name as HoldName;
    const seated = SEATED_HOLDS.has(hold);
    const dy = seated ? 7 : hold === 'accordion' || hold === 'violin' ? (f4 === 1 || f4 === 2 ? 1 : 0) : f4 === 2 ? 1 : 0;
    return P(seated ? 'sit' : 'stand', dy, 'hold', { f: f4, hold });
  }
  return P('stand', f2, 'down');
}

// ---- drawing helpers ------------------------------------------------------------------------------------------

type Pt = readonly [number, number];

/** A limb `w` pixels thick along the points (its left column, or its top row where it runs sideways), coloured by
 * how far along it is (0 at the first point, 1 at the last). */
function limb(c: Canvas, pts: readonly Pt[], w: number, col: (t: number) => string): void {
  const segs = pts.length - 1;
  for (let s = 0; s < segs; s++) {
    const [x0, y0] = pts[s];
    const [x1, y1] = pts[s + 1];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const n = Math.max(Math.abs(dx), Math.abs(dy), 1);
    for (let i = s === 0 ? 0 : 1; i <= n; i++) {
      const k = i / n;
      const t = (s + k) / segs;
      const x = Math.round(x0 + dx * k);
      const y = Math.round(y0 + dy * k);
      if (Math.abs(dy) >= Math.abs(dx)) c.r(x, y, w, 1, col(t));
      else c.r(x, y, 1, w, col(t));
    }
  }
}

const LONG_SLEEVES = new Set([1, 2, 4, 7, 8, 9, 10, 11, 12, 13, 14, 17]);
const COATS = new Set([9, 10, 11, 12, 13]);
const BARE_ARMS = new Set([5, 15, 16]);
const isDress = (L: Look) => L.topStyle === 3 || L.topStyle === 15;

/** How far down the arm the sleeve reaches (0 bare, 1 to the wrist). */
function sleeveOf(L: Look): number {
  return LONG_SLEEVES.has(L.topStyle) ? 1 : BARE_ARMS.has(L.topStyle) ? 0 : 0.38;
}

function handOf(L: Look): string {
  return L.mitt ? (L.mittColor ?? '#d9534f') : L.skin;
}

/** What a leg is in at `t` (0 the hip, 1 the ankle): trousers, shorts, a boot's shaft, or bare skin. */
function legCol(L: Look, t: number): string {
  const b = L.bottomStyle;
  if (L.shoeStyle === 1 && t >= 0.7) return L.shoes;
  if (L.shoeStyle === 3 && t >= 0.48) return L.shoes;
  if (isDress(L) || b === 2 || b === 4) return L.skin;
  if (b === 1) return t <= 0.42 ? L.bottom : L.skin;
  if (b === 5) return t <= 0.2 ? L.bottom : L.skin;
  return L.bottom;
}

/** A shoe from the front (4 wide) or from the side (pointing right, 5 long), its top row at `y`. */
function shoe(c: Canvas, L: Look, x: number, y: number, side: boolean, tint = 1): void {
  const s = shade(L.shoes, tint);
  const w = side ? 5 : 4;
  if (L.shoeStyle === 2) {
    // sandals: the bare foot and a strap over it
    c.r(x, y, w - 1, 1, shade(L.skin, tint));
    c.r(x + 1, y, 2, 1, s);
    c.r(x, y + 1, w, 1, shade(L.shoes, 0.7 * tint));
    return;
  }
  c.r(x, y, side ? 4 : w, 1, s);
  if (side) c.p(x + 4, y + 1, s);
  // trainers on a white sole; boots and felt boots on a dark one
  const sole = L.shoeStyle === 0 ? shade('#ece6da', tint) : shade(L.shoes, 0.62 * tint);
  c.r(x, y + 1, w, 1, sole);
  if (L.shoeStyle === 0 && !side) c.p(x + 1, y, shade(mix(L.shoes, '#ffffff', 0.45), tint));
}

// ---- the head -----------------------------------------------------------------------------------------------

function faceFront(c: Canvas, L: Look, hy: number, blink: boolean, squint: boolean): void {
  const e = L.eye;
  const y = hy + 3;
  const mouthC = MOUTH;
  if (blink) {
    c.p(18, y + 1, e);
    c.p(21, y + 1, e);
    c.r(19, y + 3, 2, 1, mouthC);
    return;
  }
  if (!exprFront(c, L, y) && !squint) {
    switch (L.face) {
      case 1:
        // bright, wide-open eyes with a light in them
        c.r(17, y, 2, 2, e);
        c.r(21, y, 2, 2, e);
        c.p(17, y, WHITE);
        c.p(21, y, WHITE);
        break;
      case 2:
        // smiling eyes and a smile
        c.p(17, y + 1, e);
        c.p(18, y, e);
        c.p(21, y, e);
        c.p(22, y + 1, e);
        c.r(19, y + 3, 2, 1, mouthC);
        c.p(18, y + 2, mouthC);
        c.p(21, y + 2, mouthC);
        return;
      case 3:
        // calm, half-closed
        c.r(17, y + 1, 2, 1, e);
        c.r(21, y + 1, 2, 1, e);
        break;
      default:
        c.r(18, y, 1, 2, e);
        c.r(21, y, 1, 2, e);
    }
    c.r(19, y + 3, 2, 1, mouthC);
  } else if (squint) {
    c.r(17, y + 1, 2, 1, e);
    c.r(21, y + 1, 2, 1, e);
    c.r(19, y + 3, 2, 1, mouthC);
  }
}

function exprFront(c: Canvas, L: Look, y: number): boolean {
  const e = L.eye;
  const brow = shade(L.hair, 0.75);
  switch (L.expr as Expression | undefined) {
    case 'smile':
      c.r(18, y, 1, 2, e);
      c.r(21, y, 1, 2, e);
      c.r(19, y + 3, 2, 1, MOUTH);
      c.p(18, y + 2, MOUTH);
      c.p(21, y + 2, MOUTH);
      return true;
    case 'grin':
      c.p(17, y + 1, e);
      c.p(18, y, e);
      c.p(21, y, e);
      c.p(22, y + 1, e);
      c.r(18, y + 3, 4, 1, OPEN_MOUTH);
      c.p(17, y + 2, MOUTH);
      c.p(22, y + 2, MOUTH);
      return true;
    case 'sad':
      c.r(18, y + 1, 1, 1, e);
      c.r(21, y + 1, 1, 1, e);
      c.p(18, y - 1, brow);
      c.p(21, y - 1, brow);
      c.p(17, y, brow);
      c.p(22, y, brow);
      c.r(19, y + 3, 2, 1, MOUTH);
      c.p(18, y + 4, MOUTH);
      c.p(21, y + 4, MOUTH);
      return true;
    case 'angry':
      c.p(17, y - 1, brow);
      c.p(18, y, brow);
      c.p(22, y - 1, brow);
      c.p(21, y, brow);
      c.p(18, y + 1, e);
      c.p(21, y + 1, e);
      c.r(18, y + 3, 4, 1, MOUTH);
      return true;
    case 'sleepy':
      c.r(17, y + 1, 2, 1, e);
      c.r(21, y + 1, 2, 1, e);
      c.r(19, y + 3, 2, 1, MOUTH);
      return true;
    case 'surprised':
      c.r(18, y - 1, 1, 3, e);
      c.r(21, y - 1, 1, 3, e);
      c.p(18, y - 2, brow);
      c.p(21, y - 2, brow);
      c.r(19, y + 3, 2, 2, OPEN_MOUTH);
      return true;
    case 'love':
      c.p(17, y, LOVE);
      c.p(19, y, LOVE);
      c.p(18, y + 1, LOVE);
      c.p(20, y, LOVE);
      c.p(22, y, LOVE);
      c.p(21, y + 1, LOVE);
      c.r(19, y + 3, 2, 1, MOUTH);
      c.p(18, y + 2, MOUTH);
      c.p(21, y + 2, MOUTH);
      return true;
    default:
      return false;
  }
}

/** The face from the side (looking right): the eye at x 21, the nose at 24, the mouth at 22..23. */
function faceSide(c: Canvas, L: Look, hy: number, x: number, blink: boolean, squint: boolean): void {
  const e = L.eye;
  const y = hy + 3;
  const ex = 21 + x;
  if (blink || squint || L.face === 3 || L.expr === 'sleepy') c.r(ex, y + 1, 2, 1, e);
  else if (L.expr === 'love') {
    c.p(ex, y, LOVE);
    c.p(ex + 1, y + 1, LOVE);
  } else if (L.face === 2 || L.expr === 'grin') {
    c.p(ex - 1, y + 1, e);
    c.p(ex, y, e);
    c.p(ex + 1, y + 1, e);
  } else if (L.face === 1 || L.expr === 'surprised') {
    c.r(ex, y, 1, 2, e);
    c.p(ex + 1, y, e);
    c.p(ex, y, WHITE);
  } else c.r(ex, y, 1, 2, e);
  if (L.expr === 'angry' || L.expr === 'sad') c.r(ex - 1, y - 1, 2, 1, shade(L.hair, 0.75));
  const open = L.expr === 'grin' || L.expr === 'surprised';
  c.p(22 + x, y + 3, open ? OPEN_MOUTH : MOUTH);
  if (open || L.expr === 'smile' || L.face === 2) c.p(23 + x, y + 3, open ? OPEN_MOUTH : MOUTH);
}

function cheeksFront(c: Canvas, L: Look, hy: number): void {
  const y = hy + 5;
  if (L.cheeks === 1) {
    const f = shade(L.skin, 0.74);
    c.p(17, y, f);
    c.p(16, y - 1, f);
    c.p(22, y, f);
    c.p(23, y - 1, f);
  } else if (L.cheeks === 2) {
    const r = mix(L.skin, ROSY, 0.42);
    c.p(17, y, r);
    c.p(22, y, r);
  } else {
    const b = mix(L.skin, ROSY, 0.18);
    c.p(17, y, b);
    c.p(22, y, b);
  }
}

function beardFront(c: Canvas, L: Look, hy: number): void {
  const h = L.hair;
  const y = hy + 5;
  if (L.beard === 1) {
    const st = mix(L.skin, h, 0.32);
    c.r(16, y, 8, 3, st);
    c.r(19, y + 1, 2, 1, MOUTH);
  } else if (L.beard === 2) {
    c.r(18, y, 4, 1, h);
    c.p(18, y + 1, h);
    c.p(21, y + 1, h);
    c.r(19, y + 1, 2, 1, MOUTH);
  } else if (L.beard === 3) {
    c.r(16, y - 1, 1, 4, h);
    c.r(23, y - 1, 1, 4, h);
    c.r(16, y + 1, 8, 2, h);
    c.r(17, y + 3, 6, 1, h);
    c.r(18, y, 4, 1, shade(h, 0.85));
    c.r(19, y + 1, 2, 1, MOUTH);
  }
}

function beardSide(c: Canvas, L: Look, hy: number, x: number): void {
  const h = L.hair;
  const y = hy + 5;
  if (L.beard === 1) c.r(19 + x, y, 5, 3, mix(L.skin, h, 0.32));
  else if (L.beard === 2) c.r(22 + x, y, 2, 1, h);
  else if (L.beard === 3) {
    c.r(18 + x, y - 1, 2, 2, h);
    c.r(19 + x, y + 1, 5, 2, h);
    c.r(20 + x, y + 3, 3, 1, h);
    c.r(22 + x, y, 2, 1, shade(h, 0.85));
  }
  if (L.beard) c.p(22 + x, y + 1, MOUTH);
}

/** Close-cropped hair over skin. */
function shaved(L: Look): string {
  return mix(L.skin, L.hair, 0.55);
}

/** A plait: strands crossing every row, tied at the end. */
function braid(c: Canvas, x: number, y: number, len: number, hair: string): void {
  const dark = shade(hair, 0.78);
  for (let i = 0; i < len; i++) {
    c.r(x, y + i, 2, 1, hair);
    c.p(x + (i % 2), y + i, dark);
  }
  c.r(x, y + len, 2, 1, shade(hair, 1.35));
}

/** The top of the head: the hair over the crown, two rows above the brow and the brow row itself. */
function cap(c: Canvas, h: string, hy: number): void {
  c.r(17, hy - 2, 6, 1, h);
  c.r(16, hy - 1, 8, 2, h);
}

/** Hair that hangs behind the head and the shoulders (drawn before the body). */
function hairBehind(c: Canvas, L: Look, hy: number, view: 'front' | 'back' | 'side', x = 0): void {
  const h = L.hair;
  const s = L.hairStyle;
  if (view === 'side') {
    if (s === 1) c.r(15 + x, hy + 2, 4, 11, h);
    else if (s === 12) for (let i = 0; i < 12; i++) c.r(15 + x - (i % 4 < 2 ? 0 : 1), hy + 2 + i, 4, 1, h);
    else if (s === 5) c.r(16 + x, hy + 2, 3, 7, h);
    else if (s === 10) {
      c.r(14 + x, hy - 3, 10, 2, h);
      c.r(13 + x, hy - 1, 9, 9, h);
    }
    return;
  }
  if (s === 1) c.r(15, hy + 4, 10, 10, h);
  else if (s === 12) c.r(14, hy + 4, 12, 12, h);
  else if (s === 5) c.r(15, hy + 4, 10, 5, h);
  else if (s === 10) {
    c.r(15, hy - 4, 10, 1, h);
    c.r(14, hy - 3, 12, 1, h);
    c.r(13, hy - 2, 14, 9, h);
    c.r(14, hy + 7, 12, 1, h);
  } else if (s === 3) c.r(15, hy + 2, 10, 5, h);
}

function hairFront(c: Canvas, L: Look, hy: number): void {
  const h = L.hair;
  const dark = shade(h, 0.8);
  switch (L.hairStyle) {
    case 0: // short, swept to one side
      cap(c, h, hy);
      c.r(16, hy + 1, 3, 1, h);
      c.r(15, hy, 1, 3, h);
      c.r(24, hy, 1, 3, h);
      break;
    case 1: // long and straight, parted in the middle, down over the shoulders
      cap(c, h, hy);
      c.p(19, hy - 1, dark);
      c.r(16, hy + 1, 2, 1, h);
      c.r(22, hy + 1, 2, 1, h);
      c.r(15, hy, 1, 12, h);
      c.r(24, hy, 1, 12, h);
      c.r(14, hy + 6, 1, 6, h);
      c.r(25, hy + 6, 1, 6, h);
      c.r(15, hy + 7, 1, 4, dark);
      break;
    case 2: // a knot on top
      cap(c, h, hy);
      c.r(18, hy - 5, 4, 3, h);
      c.r(19, hy - 6, 2, 1, h);
      c.r(18, hy - 2, 4, 1, dark);
      c.r(15, hy, 1, 2, h);
      c.r(24, hy, 1, 2, h);
      break;
    case 3: // a thick bob to the jaw, a straight fringe
      c.r(16, hy - 3, 8, 1, h);
      c.r(15, hy - 2, 10, 4, h);
      c.r(14, hy, 2, 7, h);
      c.r(24, hy, 2, 7, h);
      c.r(16, hy + 2, 8, 1, dark);
      c.p(14, hy + 6, dark);
      c.p(25, hy + 6, dark);
      break;
    case 4: // cropped close
      c.r(17, hy - 2, 6, 1, h);
      c.r(16, hy - 1, 8, 1, h);
      c.r(16, hy, 8, 1, shaved(L));
      break;
    case 5: // to the chin, tucked behind the ears
      cap(c, h, hy);
      c.r(16, hy + 1, 4, 1, h);
      c.r(15, hy, 1, 7, h);
      c.r(24, hy, 1, 7, h);
      c.p(15, hy + 6, dark);
      c.p(24, hy + 6, dark);
      break;
    case 6: // spiky
      cap(c, h, hy);
      for (const x of [16, 18, 20, 22]) c.r(x, hy - 3, 2, 1, h);
      for (const x of [17, 21]) c.p(x, hy - 4, h);
      c.r(15, hy, 1, 2, h);
      c.r(24, hy, 1, 2, h);
      c.p(18, hy + 1, h);
      c.p(21, hy + 1, h);
      break;
    case 7: // shaven
      c.p(18, hy, shade(L.skin, 1.12));
      break;
    case 8: // two tails high at the sides
      cap(c, h, hy);
      c.p(19, hy - 1, dark);
      c.r(15, hy, 1, 3, h);
      c.r(24, hy, 1, 3, h);
      c.r(13, hy + 1, 2, 6, h);
      c.r(25, hy + 1, 2, 6, h);
      c.p(13, hy + 7, h);
      c.p(26, hy + 7, h);
      c.r(14, hy, 1, 1, L.accColor);
      c.r(25, hy, 1, 1, L.accColor);
      break;
    case 9: // two plaits over the shoulders
      cap(c, h, hy);
      c.p(19, hy - 1, dark);
      c.r(15, hy, 1, 5, h);
      c.r(24, hy, 1, 5, h);
      braid(c, 14, hy + 5, 9, h);
      braid(c, 24, hy + 5, 9, h);
      break;
    case 10: // a round afro (the cloud is behind the head)
      c.r(16, hy - 1, 8, 2, h);
      c.p(19, hy + 1, h);
      c.r(16, hy + 1, 2, 1, h);
      c.r(22, hy + 1, 2, 1, h);
      for (const [x, y] of [[15, hy - 3], [19, hy - 4], [23, hy - 2], [14, hy + 1], [25, hy + 3], [13, hy + 4], [17, hy - 2], [21, hy - 3], [26, hy]] as Pt[]) c.p(x, y, dark);
      for (const [x, y] of [[16, hy - 3], [20, hy - 2], [14, hy - 1]] as Pt[]) c.p(x, y, shade(h, 1.22));
      break;
    case 11: // a crest over shaven sides
      c.r(16, hy - 1, 8, 2, shaved(L));
      c.r(19, hy - 5, 2, 6, h);
      c.p(19, hy - 6, h);
      c.p(19, hy - 4, shade(h, 1.2));
      break;
    case 12: // long waves
      cap(c, h, hy);
      c.r(16, hy + 1, 4, 1, h);
      c.r(16, hy + 2, 1, 1, h);
      for (let i = 0; i < 13; i++) {
        const w = i % 4 < 2 ? 0 : 1;
        c.r(14 - w, hy + i, 2, 1, h);
        c.r(24 + w, hy + i, 2, 1, h);
      }
      c.r(14, hy + 8, 1, 3, dark);
      break;
    case 13: // two buns
      cap(c, h, hy);
      c.p(19, hy - 1, dark);
      c.r(14, hy - 4, 4, 3, h);
      c.r(22, hy - 4, 4, 3, h);
      c.p(14, hy - 4, null);
      c.p(25, hy - 4, null);
      c.r(15, hy, 1, 3, h);
      c.r(24, hy, 1, 3, h);
      break;
  }
}

function hairBack(c: Canvas, L: Look, hy: number): void {
  const h = L.hair;
  const s = L.hairStyle;
  if (s === 7) return;
  if (s === 4) {
    c.r(17, hy - 2, 6, 1, h);
    c.r(16, hy - 1, 8, 6, shaved(L));
    c.r(16, hy - 1, 8, 1, h);
    return;
  }
  if (s === 11) {
    c.r(16, hy - 1, 8, 6, shaved(L));
    c.r(19, hy - 5, 2, 12, h);
    return;
  }
  // the back of the head covered, down to the nape
  c.r(17, hy - 2, 6, 1, h);
  c.r(16, hy - 1, 8, 7, h);
  c.r(15, hy, 1, 4, h);
  c.r(24, hy, 1, 4, h);
  if (s === 2) {
    c.r(18, hy - 5, 4, 3, h);
    c.r(19, hy - 6, 2, 1, h);
  }
  if (s === 6) for (const x of [16, 18, 20, 22]) c.r(x, hy - 3, 2, 1, h);
  if (s === 8) {
    c.r(13, hy + 1, 2, 6, h);
    c.r(25, hy + 1, 2, 6, h);
  }
  if (s === 9) {
    braid(c, 16, hy + 6, 9, h);
    braid(c, 22, hy + 6, 9, h);
  }
  if (s === 13) {
    c.r(14, hy - 4, 4, 3, h);
    c.r(22, hy - 4, 4, 3, h);
  }
  if (s === 1 || s === 12) {
    c.r(15, hy + 4, 10, s === 12 ? 12 : 10, h);
    c.r(19, hy + 3, 1, 8, shade(h, 0.82));
  }
  if (s === 5) c.r(15, hy + 4, 10, 4, h);
  if (s === 3) c.r(14, hy - 1, 12, 8, h);
  if (s === 10) {
    hairBehind(c, L, hy, 'front');
    const dark = shade(h, 0.78);
    for (const [x, y] of [[15, hy - 3], [19, hy - 4], [23, hy - 2], [14, hy + 1], [25, hy + 3], [17, hy + 2], [21, hy + 4], [16, hy + 5], [24, hy + 6], [20, hy], [13, hy + 4], [22, hy - 1]] as Pt[]) c.p(x, y, dark);
    for (const [x, y] of [[16, hy - 3], [20, hy - 2], [14, hy - 1], [18, hy + 1]] as Pt[]) c.p(x, y, shade(h, 1.25));
  }
}

function hairSide(c: Canvas, L: Look, hy: number, x: number): void {
  const h = L.hair;
  const s = L.hairStyle;
  const dark = shade(h, 0.8);
  if (s === 7) return;
  if (s === 11) {
    c.r(17 + x, hy - 1, 4, 3, shaved(L));
    for (let i = 0; i < 5; i++) c.r(17 + x + i, hy - 3 - (i % 2), 1, 2 + (i % 2), h);
    return;
  }
  if (s === 4) {
    c.r(18 + x, hy - 2, 5, 1, h);
    c.r(17 + x, hy - 1, 6, 1, h);
    c.r(17 + x, hy, 2, 3, shaved(L));
    return;
  }
  // the crown and the back of the head, the ear left showing
  c.r(18 + x, hy - 2, 5, 1, h);
  c.r(17 + x, hy - 1, 7, 2, h);
  c.r(16 + x, hy, 2, 5, h);
  c.r(18 + x, hy + 1, 1, 2, h);
  if (s !== 3 && s !== 10) c.r(21 + x, hy + 1, 2, 1, h);
  switch (s) {
    case 2:
      c.r(18 + x, hy - 5, 4, 3, h);
      c.r(18 + x, hy - 2, 4, 1, dark);
      break;
    case 3:
      c.r(17 + x, hy - 3, 6, 1, h);
      c.r(15 + x, hy - 1, 3, 8, h);
      c.r(18 + x, hy + 1, 5, 1, h);
      c.r(18 + x, hy + 2, 2, 4, h);
      break;
    case 6:
      for (const k of [0, 2, 4]) c.r(17 + x + k, hy - 3 - (k === 2 ? 1 : 0), 2, 1 + (k === 2 ? 1 : 0), h);
      break;
    case 8:
      c.r(14 + x, hy + 1, 3, 6, h);
      break;
    case 9:
      braid(c, 15 + x, hy + 5, 9, h);
      break;
    case 13:
      c.r(15 + x, hy - 4, 4, 3, h);
      c.r(19 + x, hy - 4, 3, 2, h);
      break;
    case 10:
      c.r(17 + x, hy - 1, 7, 2, h);
      c.r(16 + x, hy + 1, 3, 4, h);
      for (const [px, py] of [[15, hy - 2], [19, hy - 3], [14, hy + 2], [22, hy - 2]] as Pt[]) c.p(px + x, py, dark);
      break;
  }
}

/** The head from the front (or the back), its top row of skin at `hy`. */
function headFront(c: Canvas, L: Look, hy: number, back: boolean, blink: boolean, squint: boolean): void {
  c.r(18, hy + 8, 4, 2, shade(L.skin, 0.86));
  c.r(15, hy + 3, 1, 2, L.skin);
  c.r(24, hy + 3, 1, 2, L.skin);
  c.r(16, hy, 8, 8, L.skin);
  c.p(16, hy + 7, null);
  c.p(23, hy + 7, null);
  c.p(17, hy + 7, shade(L.skin, 0.9));
  c.p(22, hy + 7, shade(L.skin, 0.9));
  if (back) {
    hairBack(c, L, hy);
    return;
  }
  cheeksFront(c, L, hy);
  faceFront(c, L, hy, blink, squint);
  beardFront(c, L, hy);
  hairFront(c, L, hy);
}

/** The head in profile (looking right), shifted `x` forward. */
function headSide(c: Canvas, L: Look, hy: number, x: number, blink: boolean, squint: boolean): void {
  c.r(19 + x, hy + 8, 3, 2, shade(L.skin, 0.86));
  c.r(17 + x, hy, 7, 8, L.skin);
  c.p(23 + x, hy + 7, null);
  c.p(17 + x, hy + 7, null);
  c.r(24 + x, hy + 3, 1, 2, L.skin);
  c.p(18 + x, hy + 3, shade(L.skin, 0.84));
  c.p(18 + x, hy + 4, shade(L.skin, 0.84));
  const ck = L.cheeks === 2 ? mix(L.skin, ROSY, 0.42) : L.cheeks === 1 ? shade(L.skin, 0.74) : mix(L.skin, ROSY, 0.18);
  c.p(21 + x, hy + 5, ck);
  faceSide(c, L, hy, x, blink, squint);
  beardSide(c, L, hy, x);
  hairSide(c, L, hy, x);
}

// ---- accessories ----------------------------------------------------------------------------------------------

type View = 'front' | 'back' | 'side';

function accessory(c: Canvas, L: Look, view: View, hy: number, x = 0): void {
  const col = L.accColor;
  const dark = shade(col, 0.7);
  const front = view === 'front';
  const side = view === 'side';
  const X = (v: number) => v + (side ? x : 0);
  switch (L.acc) {
    case 1: { // glasses: thin rims round the eyes, a bridge, light in the lenses (the rims dark, of the colour)
      const col = mix(L.accColor, '#2a2438', 0.45);
      if (front) {
        c.r(17, hy + 2, 2, 1, col);
        c.r(21, hy + 2, 2, 1, col);
        c.r(19, hy + 3, 2, 1, col);
        c.p(16, hy + 3, col);
        c.p(23, hy + 3, col);
        c.r(17, hy + 3, 1, 2, LENS);
        c.r(22, hy + 3, 1, 2, LENS);
      } else if (side) {
        c.r(X(21), hy + 2, 2, 1, col);
        c.p(X(22), hy + 3, LENS);
        c.r(X(18), hy + 3, 3, 1, col);
      }
      break;
    }
    case 11: // dark glasses
      if (front) {
        c.r(17, hy + 3, 2, 2, col);
        c.r(21, hy + 3, 2, 2, col);
        c.r(19, hy + 3, 2, 1, dark);
        c.p(16, hy + 3, dark);
        c.p(23, hy + 3, dark);
      } else if (side) {
        c.r(X(20), hy + 3, 3, 2, col);
        c.r(X(17), hy + 3, 3, 1, dark);
      }
      break;
    case 2: { // a scarf round the neck, its end hanging
      const y = hy + 8;
      if (side) {
        c.r(X(18), y, 5, 2, col);
        c.r(X(17), y + 2, 2, 5, col);
        c.r(X(17), y + 6, 2, 1, dark);
      } else {
        c.r(16, y, 8, 2, col);
        c.r(16, y + 1, 8, 1, dark);
        if (front) {
          c.r(21, y + 2, 2, 6, col);
          c.r(21, y + 7, 2, 1, dark);
        } else c.r(17, y + 2, 2, 4, col);
      }
      break;
    }
    case 3: // a straw sun hat with a ribbon
      if (side) {
        c.r(X(17), hy - 4, 7, 3, '#e0c070');
        c.r(X(17), hy - 2, 7, 1, col);
        c.r(X(13), hy - 1, 14, 1, '#e0c070');
      } else {
        c.r(16, hy - 4, 8, 3, '#e0c070');
        c.r(16, hy - 2, 8, 1, col);
        c.r(11, hy - 1, 18, 1, '#e0c070');
        c.r(13, hy, 3, 1, shade('#e0c070', 0.85));
        c.r(24, hy, 3, 1, shade('#e0c070', 0.85));
      }
      break;
    case 4: // a cap with a peak
      if (side) {
        c.r(X(17), hy - 3, 7, 3, col);
        c.r(X(18), hy - 4, 5, 1, col);
        c.r(X(23), hy - 1, 4, 1, dark);
      } else {
        c.r(17, hy - 4, 6, 1, col);
        c.r(16, hy - 3, 8, 3, col);
        c.p(19, hy - 3, shade(col, 1.25));
        if (front) c.r(15, hy, 10, 1, dark);
        else c.r(16, hy, 8, 1, dark);
      }
      break;
    case 5: // headphones
      if (side) {
        c.r(X(18), hy - 3, 4, 1, '#2a2438');
        c.r(X(18), hy + 2, 3, 4, col);
        c.r(X(19), hy - 2, 1, 4, '#2a2438');
      } else {
        c.r(16, hy - 3, 8, 1, '#2a2438');
        c.r(15, hy - 2, 1, 4, '#2a2438');
        c.r(24, hy - 2, 1, 4, '#2a2438');
        c.r(14, hy + 2, 2, 4, col);
        c.r(24, hy + 2, 2, 4, col);
      }
      break;
    case 6: // a bow in the hair
      if (side) c.r(X(16), hy - 2, 3, 3, col);
      else {
        c.r(20, hy - 3, 2, 2, col);
        c.r(23, hy - 3, 2, 2, col);
        c.p(22, hy - 2, dark);
      }
      break;
    case 7: // a backpack (the pack itself drawn with the body)
      break;
    case 8: // a knitted hat with a pompom
      if (side) {
        c.r(X(17), hy - 3, 7, 3, col);
        c.r(X(18), hy - 4, 5, 1, col);
        c.r(X(17), hy - 1, 7, 1, dark);
        c.r(X(19), hy - 6, 2, 2, IVORY);
      } else {
        c.r(17, hy - 4, 6, 1, col);
        c.r(16, hy - 3, 8, 2, col);
        c.r(16, hy - 1, 8, 1, dark);
        for (const v of [16, 18, 20, 22]) c.p(v, hy - 1, col);
        c.r(19, hy - 6, 2, 2, IVORY);
      }
      break;
    case 9: { // a flower behind the ear
      const fx = front ? 23 : view === 'back' ? 16 : X(17);
      const fy = hy;
      for (const [px, py] of [[fx - 1, fy], [fx + 1, fy], [fx, fy - 1], [fx, fy + 1]] as Pt[]) c.p(px, py, col);
      c.p(fx, fy, '#f4d35e');
      break;
    }
    case 10: // earrings
      if (side) c.r(X(18), hy + 5, 1, 2, col);
      else {
        c.r(15, hy + 5, 1, 2, col);
        c.r(24, hy + 5, 1, 2, col);
      }
      break;
    case 12: { // an umbrella over the head, its handle down to the hand
      const sx = side ? x : 0;
      c.r(14 + sx, hy - 7, 12, 1, col);
      c.r(11 + sx, hy - 6, 18, 2, col);
      for (let v = 11 + sx; v < 29 + sx; v += 3) c.p(v, hy - 4, dark);
      c.r(19 + sx, hy - 8, 2, 1, dark);
      const hx = side ? 24 + x : 26;
      c.r(hx, hy - 4, 1, front || side ? 18 : 18, '#5a3a28');
      break;
    }
    case 13: // a panama
      if (side) {
        c.r(X(17), hy - 4, 7, 3, col);
        c.r(X(17), hy - 2, 7, 1, dark);
        c.r(X(14), hy - 1, 12, 1, col);
      } else {
        c.r(16, hy - 4, 8, 3, col);
        c.r(16, hy - 2, 8, 1, dark);
        c.r(13, hy - 1, 14, 1, col);
      }
      break;
    case 14: { // a fur hat with ear flaps
      const fur = shade(col, 1.45);
      if (side) {
        c.r(X(17), hy - 4, 7, 4, col);
        c.r(X(16), hy - 1, 8, 1, fur);
        c.r(X(17), hy, 3, 5, fur);
      } else {
        c.r(16, hy - 4, 8, 4, col);
        c.r(15, hy - 1, 10, 1, fur);
        c.r(15, hy, 2, 5, fur);
        c.r(23, hy, 2, 5, fur);
      }
      break;
    }
    case 15: { // a helmet (armour worn)
      const shine = shade(col, 1.35);
      if (side) {
        c.r(X(17), hy - 3, 7, 4, col);
        c.r(X(18), hy - 4, 5, 1, col);
        c.r(X(17), hy + 1, 7, 1, dark);
        c.r(X(18), hy - 3, 2, 1, shine);
      } else {
        c.r(17, hy - 4, 6, 1, col);
        c.r(16, hy - 3, 8, 4, col);
        c.r(15, hy, 10, 2, dark);
        c.r(17, hy - 3, 2, 1, shine);
        if (front) c.r(19, hy + 1, 2, 3, dark);
      }
      break;
    }
  }
}

// ---- the body from the front -----------------------------------------------------------------------------------

/** The legs, hips and feet from the front (or back), by the pose. */
function legsFront(c: Canvas, L: Look, P: Pose, fx: Fx): void {
  const y0 = 14 + P.dy;
  const leg = (pts: readonly Pt[], w = 3) => limb(c, pts, w, (t) => legCol(L, t));
  const wide = L.bottomStyle === 3 && !isDress(L) ? 1 : 0;
  switch (P.kind) {
    case 'stand':
    case 'walk': {
      for (const right of [false, true]) {
        const lift = (P.step === 1 && !right) || (P.step === 3 && right) ? 1 : 0;
        const x = right ? (fx.skate ? 22 : 21) : fx.skate ? 15 : 16;
        const bottom = 36 - lift;
        leg([[x - (right ? 0 : wide), 24], [x - (right ? 0 : wide), bottom]], 3 + wide);
        if (L.bottomStyle === 6 && !isDress(L)) {
          // cargo trousers: a pocket on the outer thigh, the hems rolled
          c.r(right ? x + 2 : x, 29, 1, 3, shade(L.bottom, 0.82));
          c.p(right ? x + 2 : x, 29, shade(L.bottom, 1.15));
          if (L.shoeStyle !== 1 && L.shoeStyle !== 3) c.r(x, bottom - 1, 3, 1, shade(L.bottom, 1.18));
        }
        if (wide && L.shoeStyle !== 1 && L.shoeStyle !== 3) c.r(right ? x : x - 2, bottom, 5, 1, shade(L.bottom, 0.86));
        shoe(c, L, right ? x : x - 1, bottom + 1, false);
        if (fx.skate) c.r(right ? x - 1 : x - 1, 39, 5, 1, '#cfd8e4');
      }
      // the hips
      c.r(15, y0 + 11, 10, 2, legCol(L, 0));
      break;
    }
    case 'sit': {
      // the thighs towards the eye, the knees, the shins down to the floor
      const hy = y0 + 11;
      c.r(15, hy, 10, 2, legCol(L, 0));
      for (const right of [false, true]) {
        const x = right ? 21 : 15;
        c.r(x, hy + 1, 4, 3, legCol(L, 0.35));
        c.r(x, hy + 1, 4, 1, shade(legCol(L, 0.35), 1.1));
        leg([[right ? 21 : 16, hy + 4], [right ? 21 : 16, 36]]);
        shoe(c, L, right ? 21 : 15, 37, false);
      }
      break;
    }
    case 'crouch': {
      // squatting: the knees up by the shoulders' width, the shins down, the heels under the body
      const hy = y0 + 11;
      c.r(15, hy, 10, 2, legCol(L, 0));
      for (const right of [false, true]) {
        const x = right ? 22 : 14;
        leg([[x, hy - 4], [x, hy + 1]], 4);
        leg([[right ? 22 : 15, hy + 2], [right ? 22 : 15, 36]]);
        shoe(c, L, right ? 22 : 14, 37, false);
      }
      break;
    }
    case 'ground': {
      // cross-legged: the knees out to the sides, the shins crossed in front, the soles showing
      const lap = isDress(L) ? L.top : L.bottomStyle === 4 ? L.bottom : legCol(L, 0.2);
      c.r(12, 34, 16, 2, lap);
      c.r(11, 35, 2, 1, lap);
      c.r(27, 35, 2, 1, lap);
      const shin = isDress(L) || L.bottomStyle === 4 ? L.skin : legCol(L, 0.8);
      c.r(14, 36, 12, 1, shade(shin, 0.9));
      c.r(19, 35, 2, 2, shade(shin, 0.78));
      c.r(12, 36, 3, 1, L.shoeStyle === 2 ? L.skin : shade(L.shoes, 0.9));
      c.r(25, 36, 3, 1, L.shoeStyle === 2 ? L.skin : shade(L.shoes, 0.9));
      c.r(12, 37, 16, 1, shade(lap, 0.7));
      break;
    }
    case 'pedal': {
      // on the saddle, one knee up and the other down as the pedals go round
      const hy = y0 + 11;
      c.r(15, hy, 10, 2, legCol(L, 0));
      const up = [0, -1, 1, -1][P.f];
      for (const right of [false, true]) {
        const high = (up === 0 && !right) || (up === 1 && right);
        const x = right ? 21 : 16;
        if (high) {
          c.r(right ? 21 : 15, hy, 4, 3, legCol(L, 0.3));
          leg([[x, hy + 3], [x, 34]]);
          shoe(c, L, right ? x : x - 1, 35, false);
        } else {
          leg([[x, hy + 1], [x, 36]]);
          shoe(c, L, right ? x : x - 1, 37, false);
        }
      }
      break;
    }
  }
}

/** Over the legs: a skirt, the lower part of a dress or a coat. */
function skirtFront(c: Canvas, L: Look, P: Pose, back: boolean): void {
  const y0 = 14 + P.dy;
  const seated = P.kind !== 'stand' && P.kind !== 'walk';
  const wy = y0 + 11;
  const flare = (len: number, col: string) => {
    if (seated) {
      // over the lap and the knees
      const h = P.kind === 'ground' ? 3 : Math.min(len, 5);
      c.r(14, wy, 12, h, col);
      c.r(14, wy + h - 1, 12, 1, shade(col, 0.8));
      return;
    }
    c.r(15, wy, 10, 2, col);
    c.r(14, wy + 2, 12, len - 2, col);
    c.r(14, wy + len - 1, 12, 1, shade(col, 0.8));
  };
  if (isDress(L)) {
    flare(7, L.top);
    if (L.topStyle === 15 && !seated) for (let x = 15; x < 25; x += 3) c.p(x, wy + 3 + (x % 2), L.top2);
    if (L.topStyle === 3) c.r(15, wy - 1, 10, 1, L.top2);
  } else if (L.bottomStyle === 2) flare(5, L.bottom);
  else if (L.bottomStyle === 4) {
    flare(seated ? 5 : 12, L.bottom);
    if (!seated) {
      c.r(17, wy + 3, 1, 8, shade(L.bottom, 0.86));
      c.r(22, wy + 3, 1, 8, shade(L.bottom, 0.86));
    }
  }
  if (COATS.has(L.topStyle)) coatFront(c, L, P, back);
}

/** The long part of a coat seen from the front or the back: over the hips, a row of buttons, a collar, a belt. */
function coatFront(c: Canvas, L: Look, P: Pose, back: boolean): void {
  const y0 = 14 + P.dy;
  const { top, top2 } = L;
  const seated = P.kind !== 'stand' && P.kind !== 'walk';
  const wy = y0 + 11;
  if (L.topStyle === 11) {
    // the down coat: puffed out, quilted, to the hips
    c.r(14, y0 + 1, 12, 13, top);
    for (let y = y0 + 3; y < y0 + 14; y += 3) c.r(14, y, 12, 1, shade(top, 0.82));
    c.r(15, y0 - 1, 10, 2, top2);
    if (!back) c.r(19, y0 + 1, 1, 13, shade(top, 0.75));
    else c.r(16, y0 - 2, 8, 2, top);
    return;
  }
  const hem = seated ? 3 : L.topStyle === 13 ? 9 : 7;
  c.r(14, wy, 12, hem, top);
  c.r(14, wy + hem - 1, 12, 1, shade(top, 0.78));
  c.r(14, y0 + 2, 1, 9, top);
  c.r(25, y0 + 2, 1, 9, top);
  if (!back) {
    // the opening and its buttons, the collar turned down
    c.r(19, y0 + 1, 1, 10 + hem, shade(top, 0.78));
    for (let y = y0 + 2; y < wy + hem - 1; y += 3) c.p(20, y, top2);
    c.r(17, y0, 2, 2, shade(top, 1.15));
    c.r(21, y0, 2, 2, shade(top, 1.15));
  } else c.r(19, wy, 2, hem, shade(top, 0.8));
  c.r(15, y0 + 9, 10, 1, shade(top, 0.72));
  if (L.topStyle === 10) {
    // the raincoat: the hood lying behind the neck (over the back from behind), a shine
    if (back) {
      c.r(16, y0 - 1, 8, 4, top);
      c.r(17, y0 - 1, 6, 1, shade(top, 1.15));
    } else {
      c.r(16, y0 - 1, 2, 2, shade(top, 0.9));
      c.r(22, y0 - 1, 2, 2, shade(top, 0.9));
    }
    c.r(16, y0 + 2, 1, 6, shade(top, 1.25));
  }
  if (L.topStyle === 12) {
    // a sheepskin: the fleece at the collar, down the opening, at the hem
    c.r(16, y0 - 1, 8, 2, top2);
    if (!back) c.r(18, y0 + 1, 1, 10 + hem, top2);
    c.r(14, wy + hem - 1, 12, 1, top2);
  }
  if (L.topStyle === 13) {
    // a trench: lapels, two rows of buttons, a belt with a buckle
    if (!back) {
      for (let y = y0 + 3; y < y0 + 9; y += 2) c.p(17, y, top2);
      c.r(16, y0, 2, 3, shade(top, 1.15));
      c.r(22, y0, 2, 3, shade(top, 1.15));
      c.r(19, y0 + 9, 2, 1, top2);
    }
    c.r(14, y0 + 9, 12, 1, shade(top, 0.6));
  }
}

/** The body: the top and its details, from the front or the back. */
function torsoFront(c: Canvas, L: Look, P: Pose, back: boolean): void {
  const y0 = 14 + P.dy;
  const { top, top2, skin } = L;
  const woman = buildOf(L) === 0;
  // the shape: the shoulders, the chest, a woman's waist
  c.r(woman ? 16 : 15, y0, woman ? 8 : 10, 1, top);
  c.r(15, y0 + 1, 10, 10, top);
  if (woman) {
    c.p(15, y0 + 6, null);
    c.p(24, y0 + 6, null);
    c.p(15, y0 + 7, null);
    c.p(24, y0 + 7, null);
  }
  const neck = () => {
    c.r(18, y0, 4, 1, skin);
    c.r(19, y0 + 1, 2, 1, skin);
  };
  switch (L.topStyle) {
    case 0: // a t-shirt
      if (!back) neck();
      c.r(16, y0, 8, 1, top);
      if (!back) c.r(18, y0, 4, 1, shade(skin, 0.9));
      break;
    case 1: // a shirt with a collar and buttons
      if (!back) {
        c.r(18, y0, 4, 1, skin);
        c.p(17, y0, top2);
        c.p(22, y0, top2);
        c.p(18, y0 + 1, top2);
        c.p(21, y0 + 1, top2);
        for (let y = y0 + 2; y < y0 + 10; y += 2) c.p(19, y, shade(top, 0.75));
        c.r(16, y0 + 3, 2, 2, shade(top, 0.88));
      } else c.r(16, y0, 8, 1, top2);
      break;
    case 2: // a hoodie: the hood lying at the neck, the strings, the pocket
      c.r(16, y0 - 1, 8, 2, shade(top, 0.86));
      if (!back) {
        c.r(18, y0 - 1, 4, 2, skin);
        c.r(18, y0 + 1, 1, 3, top2);
        c.r(21, y0 + 1, 1, 3, top2);
        c.r(16, y0 + 6, 8, 3, shade(top, 0.85));
        c.r(17, y0 + 6, 6, 1, shade(top, 0.75));
      } else {
        c.r(16, y0, 8, 4, shade(top, 0.86));
        c.r(17, y0 + 4, 6, 1, shade(top, 0.78));
      }
      c.r(15, y0 + 10, 10, 1, shade(top, 0.8));
      break;
    case 3: // a dress with short sleeves
      if (!back) neck();
      break;
    case 4: // a striped top
      for (const y of [y0 + 2, y0 + 4, y0 + 6, y0 + 8]) c.r(15, y, 10, 1, top2);
      if (!back) neck();
      break;
    case 5: // a tank top, trimmed
      c.r(15, y0, 10, 2, skin);
      c.r(16, y0, 2, 2, top);
      c.r(22, y0, 2, 2, top);
      c.r(18, y0 + 2, 4, 1, top2);
      if (back) c.r(18, y0 + 1, 4, 1, top);
      break;
    case 6: // overalls over a t-shirt: the bib, the straps, the buttons
      if (!back) neck();
      c.r(17, y0 + 4, 6, 7, L.bottom);
      c.r(17, y0, 1, 4, L.bottom);
      c.r(22, y0, 1, 4, L.bottom);
      if (!back) {
        c.p(17, y0 + 4, top2);
        c.p(22, y0 + 4, top2);
        c.r(18, y0 + 6, 4, 2, shade(L.bottom, 0.82));
      }
      break;
    case 7: // a knitted jumper with a pattern
      for (let x = 15; x < 25; x++) c.p(x, y0 + 3 + ((x - 15) % 2), top2);
      for (let x = 16; x < 25; x += 3) c.p(x, y0 + 6, top2);
      c.r(15, y0 + 10, 10, 1, shade(top, 0.8));
      if (!back) c.r(17, y0, 6, 1, shade(top, 0.8));
      break;
    case 8: // an open jacket over a shirt
      if (!back) {
        c.r(18, y0, 4, 11, top2);
        c.r(17, y0, 1, 4, shade(top, 0.72));
        c.r(22, y0, 1, 4, shade(top, 0.72));
        c.r(15, y0 + 7, 2, 1, shade(top, 0.78));
        c.r(23, y0 + 7, 2, 1, shade(top, 0.78));
        c.r(19, y0, 2, 1, skin);
      } else c.r(16, y0 - 1, 8, 1, shade(top, 0.82));
      break;
    case 14: // a windbreaker: a zip, a collar band, a band at the waist
      c.r(16, y0 - 1, 8, 1, shade(top, 0.82));
      if (!back) {
        c.r(19, y0, 1, 10, top2);
        c.p(17, y0 + 2, top2);
        c.p(22, y0 + 2, top2);
      }
      c.r(15, y0 + 10, 10, 1, shade(top, 0.74));
      break;
    case 15: // a sundress: thin straps on bare shoulders
      c.r(15, y0, 10, 3, skin);
      c.r(17, y0, 1, 3, top);
      c.r(22, y0, 1, 3, top);
      c.r(16, y0 + 3, 8, 1, top);
      for (let x = 16; x < 24; x += 3) c.p(x, y0 + 6 + (x % 2), top2);
      break;
    case 16: // a swimsuit
      c.r(15, y0, 10, 3, skin);
      c.r(17, y0, 1, 3, top);
      c.r(22, y0, 1, 3, top);
      for (let x = 16; x < 24; x += 3) c.p(x, y0 + 6, top2);
      break;
    case 17: // a traveller's field jacket: a stand-up collar, pockets with flaps, a drawstring waist
      c.r(17, y0 - 1, 6, 1, shade(top, 0.86));
      if (!back) {
        c.r(19, y0, 1, 11, shade(top, 0.74));
        c.r(16, y0 + 2, 3, 3, shade(top, 0.9));
        c.r(21, y0 + 2, 3, 3, shade(top, 0.9));
        c.r(16, y0 + 2, 3, 1, top2);
        c.r(21, y0 + 2, 3, 1, top2);
        c.r(16, y0 + 7, 3, 2, shade(top, 0.9));
        c.r(21, y0 + 7, 3, 2, shade(top, 0.9));
      } else c.r(16, y0 + 2, 8, 1, shade(top, 0.86));
      c.r(15, y0 + 10, 10, 1, shade(top, 0.76));
      c.p(back ? 21 : 18, y0 + 10, top2);
      break;
    default:
      // the coats: their own long part is drawn over the legs
      break;
  }
  // a belt at the waist of trousers worn with a short top
  if (!isDress(L) && !COATS.has(L.topStyle) && L.topStyle !== 6 && (L.bottomStyle === 0 || L.bottomStyle === 3 || L.bottomStyle === 6)) c.r(15, y0 + 11, 10, 1, shade(L.bottom, 0.68));
  // a backpack: its straps from the front, the pack itself on the back
  if (L.acc === 7) {
    const col = L.accColor;
    if (back) {
      c.r(15, y0 + 1, 10, 10, col);
      c.r(15, y0 + 1, 10, 2, shade(col, 0.82));
      c.r(16, y0 + 6, 8, 3, shade(col, 0.88));
      c.r(19, y0 + 3, 2, 1, shade(col, 0.6));
    } else {
      c.r(16, y0, 1, 7, shade(col, 0.7));
      c.r(23, y0, 1, 7, shade(col, 0.7));
    }
  }
}

/** The arms from the front: hanging (swinging as one walks), or at whatever the hands are doing. */
function armsFront(c: Canvas, L: Look, P: Pose, back: boolean, fx: Fx): void {
  const y0 = 14 + P.dy;
  const sleeve = shade(COATS.has(L.topStyle) ? L.top : L.top, 0.88);
  const frac = sleeveOf(L);
  const col = (t: number) => (t <= frac ? sleeve : L.skin);
  const hand = handOf(L);
  const both = (draw: (right: boolean, X: (x: number, w?: number) => number) => void) => {
    for (const right of [false, true]) draw(right, (x, w = 1) => (right ? N - x - w : x));
  };
  if (P.arms === 'hold') return;
  if (fx.hug && (P.kind === 'stand' || P.kind === 'walk') && P.arms === 'down') {
    // hugging oneself against the cold: the forearms crossed over the chest, the hands on the far arms
    both((right, X) => limb(c, [[X(13, 2), y0 + 1], [X(13, 2), y0 + 5]], 2, col));
    limb(c, [[14, y0 + 5], [23, y0 + 5]], 2, (t) => (frac >= 1 ? sleeve : t < 0.15 && frac > 0 ? sleeve : L.skin));
    limb(c, [[16, y0 + 7], [25, y0 + 7]], 2, (t) => (frac >= 1 ? sleeve : t > 0.85 && frac > 0 ? sleeve : L.skin));
    c.r(23, y0 + 4, 2, 2, hand);
    c.r(15, y0 + 6, 2, 2, hand);
    return;
  }
  if (fx.skate && P.kind === 'stand' && P.arms === 'down') {
    // arms out for balance
    both((right, X) => {
      limb(c, [[X(13, 1), y0 + 1], [X(6, 1), y0 + 2]], 2, col);
      c.r(X(4, 2), y0 + 2, 2, 2, hand);
    });
    return;
  }
  switch (P.arms) {
    case 'down': {
      const swing = P.step === 1 ? 1 : P.step === 3 ? -1 : 0;
      both((right, X) => {
        const s = right ? -swing : swing;
        limb(c, [[X(13, 2), y0 + 1], [X(13, 2), y0 + 10 + s]], 2, col);
        c.r(X(13, 2), y0 + 11 + s, 2, 2, hand);
      });
      break;
    }
    case 'knees':
      // the hands on the knees
      both((right, X) => {
        limb(c, [[X(13, 2), y0 + 1], [X(13, 2), y0 + 7], [X(15, 2), y0 + 10]], 2, col);
        c.r(X(15, 2), y0 + 11, 2, 2, hand);
      });
      break;
    case 'lap':
      // the hands resting on the knees out to the sides
      both((right, X) => {
        limb(c, [[X(13, 2), y0 + 1], [X(12, 2), y0 + 8]], 2, col);
        c.r(X(12, 2), y0 + 9, 2, 2, hand);
      });
      break;
    case 'wash':
      // the forearms forward and in: the hands meet in front, under the tap
      both((right, X) => {
        limb(c, [[X(13, 2), y0 + 1], [X(13, 2), y0 + 6], [X(17, 2), y0 + 8]], 2, col);
        c.r(X(18, 2), y0 + 8 + (P.dy ? 0 : 1), 2, 2, hand);
      });
      break;
    case 'pray':
      // the palms together before the chest
      both((right, X) => {
        limb(c, [[X(13, 2), y0 + 1], [X(13, 2), y0 + 5], [X(17, 2), y0 + 7]], 2, col);
        if (!back) c.r(X(19, 1), y0 + 3, 1, 4, hand);
      });
      if (!back) c.r(19, y0 + 2, 2, 1, shade(hand, 0.92));
      break;
    case 'work': {
      // the near (right) arm up with the hammer, then down on the nail
      const up = P.f ? 2 : 0;
      const X = (x: number, w = 1) => (back ? N - x - w : x);
      limb(c, [[X(13, 2), y0 + 1], [X(13, 2), y0 + 10]], 2, col);
      c.r(X(13, 2), y0 + 11, 2, 2, hand);
      limb(c, [[X(25, 2), y0 + 1], [X(26, 2), y0 - 5 + up]], 2, col);
      c.r(X(26, 2), y0 - 7 + up, 2, 2, hand);
      c.r(X(26, 1), y0 - 12 + up, 1, 5, '#8a5a2e');
      c.r(X(25, 3), y0 - 13 + up, 3, 2, '#6a6470');
      break;
    }
    case 'eat': {
      // the cone held up by the chin
      const X = (x: number, w = 1) => (back ? N - x - w : x);
      limb(c, [[X(13, 2), y0 + 1], [X(13, 2), y0 + 10]], 2, col);
      c.r(X(13, 2), y0 + 11, 2, 2, hand);
      limb(c, [[X(25, 2), y0 + 1], [X(25, 2), y0 + 5], [X(23, 2), y0 + 1]], 2, col);
      c.r(X(23, 2), y0 - 1, 2, 2, hand);
      if (!back) {
        c.r(23, y0 - 4, 2, 3, '#e8a23a');
        c.p(23, y0 - 3, '#c07a20');
        c.r(22, y0 - 7, 4, 3, '#f4b6c8');
        c.p(22, y0 - 7, WHITE);
      }
      break;
    }
    case 'bars':
      // forward and a little apart, on the handlebars
      both((right, X) => {
        limb(c, [[X(13, 2), y0 + 1], [X(13, 2), y0 + 7]], 2, col);
        c.r(X(13, 2), y0 + 8, 2, 2, hand);
      });
      break;
  }
}

// ---- the body from the side ------------------------------------------------------------------------------------

/** A leg from the side: hip, knee, ankle (left columns), the foot pointing right. */
function legSide(c: Canvas, L: Look, pts: readonly Pt[], tint: number, footUp = 0): void {
  limb(c, pts, 3, (t) => shade(legCol(L, t), tint));
  const [ax, ay] = pts[pts.length - 1];
  shoe(c, L, ax, ay + 1 - footUp, true, tint);
}

function legsSide(c: Canvas, L: Look, P: Pose, near: boolean, fx: Fx): void {
  const y0 = 14 + P.dy;
  const tint = near ? 1 : 0.78;
  const hy = y0 + 11;
  switch (P.kind) {
    case 'stand':
    case 'walk': {
      // the near leg forward on the first step, back on the third; the two together in between
      const fwd = (P.step === 1) === near ? 1 : -1;
      if (fx.skate) {
        const k = P.dy ? 3 : -3;
        legSide(c, L, [[19, 24], [19 + (near ? k : -k) / 3, 30], [19 + (near ? k : -k), 36]], tint);
        c.r(18 + (near ? k : -k), 39, 7, 1, shade('#cfd8e4', tint));
        return;
      }
      if (P.step === 1 || P.step === 3) legSide(c, L, [[19, 24], [19 + fwd, 30], [19 + fwd * 3, 36]], tint);
      else if (P.step >= 0 && !near) legSide(c, L, [[18, 24], [18, 30], [17, 35]], tint, 0);
      else legSide(c, L, [[near ? 19 : 18, 24], [near ? 19 : 18, 36]], tint);
      if (near && L.bottomStyle === 6 && !isDress(L)) c.r(19 + (P.step === 1 ? 1 : P.step === 3 ? -1 : 0), 29, 2, 3, shade(L.bottom, 0.82));
      return;
    }
    case 'sit':
      // the thigh along the seat, the shin down
      limb(c, [[near ? 18 : 17, hy - 1], [near ? 24 : 23, hy - 1]], 3, (t) => shade(legCol(L, t * 0.45), tint));
      legSide(c, L, [[near ? 24 : 23, hy + 2], [near ? 24 : 23, 36]], tint);
      return;
    case 'crouch':
      // squatting on the heels: the knee high in front, the shin down
      limb(c, [[near ? 18 : 17, hy - 1], [near ? 23 : 22, hy - 4]], 3, (t) => shade(legCol(L, t * 0.45), tint));
      legSide(c, L, [[near ? 22 : 21, hy - 3], [near ? 21 : 20, 36]], tint);
      return;
    case 'ground': {
      // folded under: the thigh forward along the ground, the foot tucked back
      const lap = isDress(L) || L.bottomStyle === 4 ? (isDress(L) ? L.top : L.bottom) : legCol(L, 0.2);
      c.r(near ? 17 : 16, 35, 10, 2, shade(lap, tint));
      c.r(near ? 17 : 16, 37, 9, 1, shade(lap, 0.78 * tint));
      c.r(near ? 26 : 25, 36, 2, 2, shade(L.shoeStyle === 2 ? L.skin : L.shoes, tint));
      return;
    }
    case 'pedal': {
      // the feet go round with the pedals: the near one opposite the far one
      const crank: Pt[] = [[23, 34], [21, 36], [19, 34], [21, 32]];
      const [fx2, fy] = crank[(P.f + (near ? 0 : 2)) % 4];
      const kx = Math.round((18 + fx2) / 2) + 3;
      const ky = Math.round((hy + fy) / 2) - 2;
      limb(c, [[18, hy - 1], [kx, ky]], 3, (t) => shade(legCol(L, t * 0.45), tint));
      legSide(c, L, [[kx, ky + 1], [fx2, fy]], tint);
      return;
    }
  }
}

/** The body from the side, facing right. */
function torsoSide(c: Canvas, L: Look, P: Pose): void {
  const y0 = 14 + P.dy;
  const { top, top2, skin } = L;
  const ln = P.lean;
  // leaning: the shoulders forward of the hips
  const row = (y: number) => (y < y0 + 5 ? ln : y < y0 + 9 ? Math.ceil(ln / 2) : 0);
  const band = (y: number, h: number, x: number, w: number, col: string) => {
    for (let j = y; j < y + h; j++) c.r(x + row(j), j, w, 1, col);
  };
  band(y0, 11, 17, 6, top);
  // the hips: the trousers, a skirt, a dress, a coat
  const seated = P.kind !== 'stand' && P.kind !== 'walk';
  c.r(17, y0 + 11, 6, 2, legCol(L, 0));
  if (isDress(L)) {
    if (seated) c.r(16, y0 + 11, 9, 3, top);
    else band(y0 + 11, 7, 16, 8, top);
  } else if (L.bottomStyle === 2) seated ? c.r(16, y0 + 11, 9, 3, L.bottom) : c.r(16, y0 + 11, 8, 5, L.bottom);
  else if (L.bottomStyle === 4) seated ? c.r(16, y0 + 11, 10, 3, L.bottom) : c.r(16, y0 + 11, 8, 12, L.bottom);
  else if (L.topStyle !== 6 && !COATS.has(L.topStyle)) c.r(17, y0 + 11, 6, 1, shade(L.bottom, 0.68));
  switch (L.topStyle) {
    case 0:
    case 3:
      c.r(21 + ln, y0, 2, 1, skin);
      break;
    case 1:
      c.p(22 + ln, y0, top2);
      c.r(22 + ln, y0 + 2, 1, 7, shade(top, 0.82));
      break;
    case 2:
      // the hood bunched at the back of the neck, the pocket in front
      c.r(16 + ln, y0 - 1, 3, 3, shade(top, 0.86));
      c.r(21 + Math.ceil(ln / 2), y0 + 6, 2, 3, shade(top, 0.85));
      c.p(22 + ln, y0 + 1, top2);
      break;
    case 4:
      for (const y of [y0 + 2, y0 + 4, y0 + 6, y0 + 8]) c.r(17 + row(y), y, 6, 1, top2);
      break;
    case 5:
      c.r(17 + ln, y0, 6, 1, skin);
      c.r(18 + ln, y0 + 1, 3, 1, top2);
      break;
    case 6:
      band(y0 + 4, 7, 20, 3, L.bottom);
      c.r(20 + ln, y0, 1, 4, L.bottom);
      break;
    case 7:
      for (let x = 17; x < 23; x++) c.p(x + ln, y0 + 3 + ((x - 17) % 2), top2);
      c.r(17, y0 + 10, 6, 1, shade(top, 0.8));
      break;
    case 8:
      band(y0, 10, 22, 1, top2);
      c.r(19 + ln, y0 - 1, 3, 1, shade(top, 0.8));
      break;
    case 14:
      band(y0, 10, 22, 1, top2);
      c.r(17 + ln, y0 - 1, 4, 1, shade(top, 0.82));
      c.r(17, y0 + 10, 6, 1, shade(top, 0.74));
      break;
    case 15:
    case 16:
      c.r(17 + ln, y0, 6, 3, skin);
      c.r(19 + ln, y0, 1, 3, top);
      if (L.topStyle === 16) c.r(17 + ln, y0 + 3, 6, 1, top);
      break;
    case 17:
      c.r(18 + ln, y0 - 1, 4, 1, shade(top, 0.86));
      c.r(21 + ln, y0 + 2, 2, 3, shade(top, 0.9));
      c.r(21 + ln, y0 + 2, 2, 1, top2);
      c.r(17, y0 + 10, 6, 1, shade(top, 0.76));
      break;
  }
  if (COATS.has(L.topStyle)) {
    if (L.topStyle === 11) {
      band(y0, 13, 16, 8, top);
      for (let y = y0 + 3; y < y0 + 13; y += 3) c.r(16 + row(y), y, 8, 1, shade(top, 0.82));
      c.r(16 + ln, y0 - 1, 6, 1, top2);
      c.r(15 + ln, y0 - 3, 3, 3, top);
    } else {
      const hem = seated ? 3 : L.topStyle === 13 ? 9 : 7;
      if (seated) c.r(16, y0 + 11, 10, hem, top);
      else c.r(16, y0 + 11, 7, hem, top);
      c.r(16, y0 + 10 + hem, seated ? 10 : 7, 1, shade(top, 0.78));
      band(y0, 11, 22, 1, shade(top, 0.82));
      for (let y = y0 + 2; y < y0 + 10; y += 3) c.p(22 + row(y), y, top2);
      c.r(16 + ln, y0 + 9, 7, 1, shade(top, 0.7));
      c.r(18 + ln, y0 - 1, 4, 1, shade(top, 1.12));
      if (L.topStyle === 10) {
        c.r(15 + ln, y0 - 2, 3, 4, top);
        c.r(18 + ln, y0 + 2, 1, 5, shade(top, 1.25));
      }
      if (L.topStyle === 12) {
        c.r(18 + ln, y0 - 1, 5, 2, top2);
        band(y0, 10, 22, 1, top2);
      }
    }
  }
  if (L.acc === 7) {
    // the backpack behind
    c.r(13 + ln, y0 + 1, 4, 10, L.accColor);
    c.r(13 + ln, y0 + 1, 4, 2, shade(L.accColor, 0.82));
    c.r(17 + ln, y0, 1, 6, shade(L.accColor, 0.7));
  }
}

/** One arm from the side: `near` over the body, else behind it (darker). */
function armSide(c: Canvas, L: Look, P: Pose, near: boolean, fx: Fx): void {
  const y0 = 14 + P.dy;
  const ln = P.lean;
  const tint = near ? 0.88 : 0.7;
  const frac = sleeveOf(L);
  const col = (t: number) => shade(t <= frac ? L.top : L.skin, t <= frac ? tint : near ? 1 : 0.8);
  const hand = shade(handOf(L), near ? 1 : 0.8);
  const sx = (near ? 19 : 18) + ln;
  const sy = y0 + 1;
  const end = (pts: Pt[]) => {
    limb(c, pts, 2, col);
    const [hx, hy] = pts[pts.length - 1];
    c.r(hx, hy + 1, 2, 2, hand);
  };
  if (fx.hug && (P.kind === 'stand' || P.kind === 'walk') && P.arms === 'down') return end([[sx, sy], [sx, sy + 4], [22, sy + 4]]);
  if (fx.skate && P.kind === 'stand' && P.arms === 'down') return end(near ? [[sx, sy], [sx + 8, sy + 1]] : [[sx, sy], [sx - 9, sy + 1]]);
  switch (P.arms) {
    case 'down': {
      const swing = P.step === 1 ? -2 : P.step === 3 ? 2 : 0;
      return end([[sx, sy], [sx + (near ? swing : -swing), sy + 9]]);
    }
    case 'knees':
      return end([[sx, sy], [sx, sy + 6], [sx + 3, sy + 8]]);
    case 'lap':
      return end([[sx, sy], [sx + 1, sy + 6], [sx + 5, sy + 8]]);
    case 'wash':
      return end([[sx, sy], [sx, sy + 5], [sx + 6, sy + 6 + (P.dy ? 0 : 1)]]);
    case 'pray':
      if (!near) return limb(c, [[sx, sy], [sx, sy + 4]], 2, col);
      limb(c, [[sx, sy], [sx, sy + 4], [sx + 2, sy + 4]], 2, col);
      c.r(sx + 3, sy + 1, 2, 4, hand);
      return;
    case 'work': {
      if (!near) return end([[sx, sy], [sx, sy + 9]]);
      const up = P.f ? 2 : 0;
      end([[sx, sy], [sx + 1, sy + 3], [sx + 3, sy - 5 + up]]);
      c.r(sx + 4, sy - 11 + up, 1, 6, '#8a5a2e');
      c.r(sx + 3, sy - 12 + up, 4, 2, '#6a6470');
      return;
    }
    case 'eat':
      if (!near) return end([[sx, sy], [sx, sy + 9]]);
      end([[sx, sy], [sx, sy + 4], [sx + 3, sy]]);
      c.r(sx + 4, sy - 4, 2, 3, '#e8a23a');
      c.r(sx + 3, sy - 7, 4, 3, '#f4b6c8');
      c.p(sx + 3, sy - 7, WHITE);
      return;
    case 'bars':
      return end([[sx, sy], [sx + 4, sy + 4], [sx + 7, sy + 5]]);
    case 'hold':
      return;
  }
}

/** The body from the side, facing right (mirrored for left). */
function drawSide(c: Canvas, L: Look, P: Pose, blink: boolean, squint: boolean, fx: Fx): void {
  const y0 = 14 + P.dy;
  const hy = 5 + P.dy;
  hairBehind(c, L, hy, 'side', P.lean);
  if (P.hold && SEATED_HOLDS.has(P.hold)) stoolSide(c);
  armSide(c, L, P, false, fx);
  legsSide(c, L, P, false, fx);
  torsoSide(c, L, P);
  legsSide(c, L, P, true, fx);
  if (P.arms === 'hold') holdSide(c, L, P);
  else armSide(c, L, P, true, fx);
  headSide(c, L, hy, P.lean, blink, squint);
  accessory(c, L, 'side', hy, P.lean);
  void y0;
}

function drawFront(c: Canvas, L: Look, P: Pose, back: boolean, blink: boolean, squint: boolean, fx: Fx): void {
  const hy = 5 + P.dy;
  if (!back) hairBehind(c, L, hy, 'front');
  if (P.hold && SEATED_HOLDS.has(P.hold) && back) stoolFront(c);
  legsFront(c, L, P, fx);
  if (P.hold && SEATED_HOLDS.has(P.hold) && !back) stoolFront(c);
  torsoFront(c, L, P, back);
  skirtFront(c, L, P, back);
  if (P.kind === 'crouch') {
    // the knees in front of the body
    for (const right of [false, true]) c.r(right ? 22 : 14, 14 + P.dy + 7, 4, 3, legCol(L, 0.4));
  }
  armsFront(c, L, P, back, fx);
  headFront(c, L, hy, back, blink, squint);
  accessory(c, L, back ? 'back' : 'front', hy);
  if (P.arms === 'hold') holdFront(c, L, P, back);
}

// ---- instruments in the hands -------------------------------------------------------------------------------------

function stoolFront(c: Canvas): void {
  c.r(14, 34, 12, 2, WOOD);
  c.r(15, 36, 2, 3, WOOD_DARK);
  c.r(23, 36, 2, 3, WOOD_DARK);
}

function stoolSide(c: Canvas): void {
  c.r(15, 34, 10, 2, WOOD);
  c.r(16, 36, 2, 3, WOOD_DARK);
  c.r(22, 36, 2, 3, WOOD_DARK);
}

function holdFront(c: Canvas, L: Look, P: Pose, back: boolean): void {
  const y0 = 14 + P.dy;
  const f = P.f;
  const alt = f % 2;
  const frac = sleeveOf(L);
  const sl = shade(L.top, 0.88);
  const arm = (pts: Pt[]) => limb(c, pts, 2, (t) => (t <= frac ? sl : L.skin));
  const hand = handOf(L);
  switch (P.hold) {
    case 'piano':
      // at the keys: the forearms forward, the hands taking turns
      arm([[13, y0 + 1], [13, y0 + 6], [16, y0 + 8]]);
      arm([[25, y0 + 1], [25, y0 + 6], [22, y0 + 8]]);
      c.r(16, y0 + 8 + alt, 2, 2, hand);
      c.r(22, y0 + 9 - alt, 2, 2, hand);
      break;
    case 'guitar':
      if (back) {
        c.r(7, y0 - 2, 6, 2, WOOD_DARK);
        arm([[13, y0 + 1], [11, y0 + 3]]);
        arm([[25, y0 + 1], [25, y0 + 8]]);
        c.r(25, y0 + 9 + alt, 2, 2, hand);
        break;
      }
      // the body across the belly, the neck up to the left, one hand on the frets, the other strumming
      c.r(18, y0 + 5, 8, 6, WOOD);
      c.r(19, y0 + 4, 6, 8, WOOD);
      c.r(20, y0 + 5, 4, 1, WOOD_LIGHT);
      c.r(21, y0 + 7, 2, 2, WOOD_DARK);
      for (let i = 0; i < 11; i++) c.r(17 - i, y0 + 6 - Math.floor(i * 0.6), 2, 1, WOOD_DARK);
      for (let i = 0; i < 8; i++) c.p(17 - i, y0 + 6 - Math.floor(i * 0.6), STRING);
      c.r(5, y0, 2, 2, WOOD_DARK);
      arm([[13, y0 + 1], [11, y0 + 2]]);
      c.r(9, y0 + 1 + (f === 3 ? 1 : 0), 2, 2, hand);
      arm([[25, y0 + 1], [25, y0 + 5], [23, y0 + 6]]);
      c.r(21, y0 + 6 + (alt ? 2 : 0), 2, 2, hand);
      break;
    case 'accordion': {
      // a red box on the chest: keys on one side, buttons on the other, the bellows opening and closing
      const open = f === 1 || f === 2 ? 2 : 0;
      const x0 = 14 - open / 2;
      if (back) {
        c.r(x0 - 1, y0 + 2, 2, 8, ACC_RED);
        c.r(x0 + 11 + open, y0 + 2, 2, 8, ACC_RED);
        break;
      }
      c.r(x0, y0 + 2, 3, 9, ACC_RED);
      c.r(x0 + 1, y0 + 3, 1, 7, IVORY);
      const bw = 6 + open;
      for (let i = 0; i < bw; i++) c.r(x0 + 3 + i, y0 + 2 + (i % 2), 1, 9 - (i % 2) * 2, i % 2 ? '#3a3a44' : IVORY);
      c.r(x0 + 3 + bw, y0 + 2, 3, 9, ACC_RED);
      for (const [dx, dy] of [[1, 3], [1, 5], [1, 7]]) c.p(x0 + 3 + bw + dx, y0 + dy, IVORY);
      c.r(16, y0, 1, 3, EBONY);
      c.r(23, y0, 1, 3, EBONY);
      c.r(x0 - 2, y0 + 5 + alt, 2, 2, hand);
      c.r(x0 + 6 + bw, y0 + 6 - alt, 2, 2, hand);
      break;
    }
    case 'violin': {
      // under the chin on the left shoulder, the bow across, going and coming back
      const bow = [0, 2, 4, 2][f];
      if (back) {
        c.r(8, y0, 6, 2, '#8a3a1a');
        arm([[25, y0 + 1], [25, y0 + 5]]);
        c.r(21 - bow, y0 + 4, 12, 1, WOOD_LIGHT);
        break;
      }
      c.r(20, y0 - 1, 6, 4, '#8a3a1a');
      c.r(21, y0 - 2, 4, 6, '#8a3a1a');
      c.r(22, y0, 1, 2, EBONY);
      c.r(26, y0 - 1, 6, 1, EBONY);
      c.r(32, y0 - 2, 2, 2, WOOD_DARK);
      arm([[25, y0 + 1], [27, y0 + 2], [29, y0]]);
      c.r(29, y0 - 1, 2, 2, hand);
      arm([[13, y0 + 1], [13, y0 + 5], [11 + bow, y0 + 5]]);
      c.r(11 + bow, y0 + 4, 2, 2, hand);
      c.r(8 + bow, y0 + 2, 15, 1, WOOD_LIGHT);
      c.r(8 + bow, y0 + 3, 15, 1, '#f0ecd8');
      break;
    }
    case 'bandura':
      if (back) {
        c.r(9, y0 - 6, 3, 9, WOOD_LIGHT);
        arm([[13, y0 + 1], [13, y0 + 6]]);
        arm([[25, y0 + 1], [25, y0 + 6]]);
        break;
      }
      // on the lap, round and wide, its neck up by the left shoulder, both hands plucking
      c.r(14, y0 + 3, 12, 10, WOOD_LIGHT);
      c.r(15, y0 + 2, 10, 12, WOOD_LIGHT);
      c.r(16, y0 + 13, 8, 1, WOOD);
      c.r(18, y0 + 6, 3, 3, WOOD_DARK);
      for (let x = 15; x < 25; x += 2) c.r(x, y0 + 2, 1, 11, STRING);
      c.r(10, y0 - 6, 4, 10, WOOD_LIGHT);
      c.r(11, y0 - 7, 2, 1, WOOD);
      for (let y = y0 - 5; y < y0 + 3; y += 2) c.p(12, y, STRING);
      arm([[13, y0 + 1], [13, y0 + 5]]);
      c.r(15, y0 + 5 + alt, 2, 2, hand);
      arm([[25, y0 + 1], [25, y0 + 6]]);
      c.r(22, y0 + 8 - alt, 2, 2, hand);
      break;
    case 'sopilka':
      if (back) {
        arm([[13, y0 + 1], [15, y0 + 5]]);
        arm([[25, y0 + 1], [23, y0 + 5]]);
        break;
      }
      // a wooden pipe from the lips down, the fingers lifting in turn
      c.r(19, y0 - 3, 2, 12, '#c9a050');
      c.r(19, y0 + 9, 2, 1, WOOD);
      for (const y of [y0 + 2, y0 + 4, y0 + 6]) c.p(20, y, WOOD_DARK);
      arm([[13, y0 + 1], [13, y0 + 4], [17, y0 + 4]]);
      c.r(18, y0 + 2 + alt, 4, 2, hand);
      arm([[25, y0 + 1], [25, y0 + 6], [21, y0 + 7]]);
      c.r(18, y0 + 6 - alt, 4, 2, hand);
      break;
  }
}

function holdSide(c: Canvas, L: Look, P: Pose): void {
  const y0 = 14 + P.dy;
  const f = P.f;
  const alt = f % 2;
  const frac = sleeveOf(L);
  const sl = shade(L.top, 0.88);
  const arm = (pts: Pt[]) => limb(c, pts, 2, (t) => (t <= frac ? sl : L.skin));
  const hand = handOf(L);
  switch (P.hold) {
    case 'piano':
      arm([[19, y0 + 1], [19, y0 + 5], [26, y0 + 7]]);
      c.r(27, y0 + 7 + alt, 2, 2, hand);
      break;
    case 'guitar':
      c.r(20, y0 + 4, 6, 7, WOOD);
      c.r(21, y0 + 3, 4, 9, WOOD);
      c.r(22, y0 + 6, 2, 2, WOOD_DARK);
      for (let i = 0; i < 10; i++) c.r(25 + i, y0 + 4 - Math.floor(i * 0.5), 1, 2, WOOD_DARK);
      arm([[19, y0 + 1], [20, y0 + 5]]);
      c.r(21, y0 + 6 + (alt ? 2 : 0), 2, 2, hand);
      c.r(31, y0 - 1 + (f === 3 ? 1 : 0), 2, 2, hand);
      break;
    case 'accordion': {
      const open = f === 1 || f === 2 ? 1 : 0;
      c.r(21, y0 + 2, 3, 9, ACC_RED);
      for (let i = 0; i < 2 + open; i++) c.r(24 + i, y0 + 2, 1, 9, i % 2 ? '#3a3a44' : IVORY);
      c.r(26 + open, y0 + 2, 3, 9, ACC_RED);
      c.r(27 + open, y0 + 3, 1, 7, IVORY);
      arm([[19, y0 + 1], [20, y0 + 5]]);
      c.r(20, y0 + 6 - alt, 2, 2, hand);
      c.r(29 + open, y0 + 4 + alt, 2, 2, hand);
      break;
    }
    case 'violin': {
      const bow = [0, 3, 6, 3][f];
      c.r(21, y0 - 3, 10, 3, '#8a3a1a');
      c.r(31, y0 - 3, 3, 1, EBONY);
      arm([[19, y0 + 1], [24, y0 - 1], [29, y0 - 2]]);
      c.r(31, y0 - 2, 2, 2, hand);
      c.r(20, y0 + 4 - (bow > 3 ? 1 : 0), 2, 2, hand);
      for (let i = 0; i < 10; i++) c.p(17 + i + bow, y0 + 4 - i, WOOD_LIGHT);
      break;
    }
    case 'bandura':
      c.r(20, y0 + 2, 7, 10, WOOD_LIGHT);
      c.r(21, y0 + 1, 5, 12, WOOD_LIGHT);
      for (let y = y0 + 2; y < y0 + 12; y += 2) c.r(21, y, 5, 1, STRING);
      c.r(18, y0 - 6, 3, 9, WOOD_LIGHT);
      arm([[19, y0 + 1], [20, y0 + 5]]);
      c.r(22, y0 + 5 + alt, 2, 2, hand);
      c.r(24, y0 + 8 - alt, 2, 2, hand);
      break;
    case 'sopilka':
      for (let i = 0; i < 10; i++) c.r(24 + Math.floor(i / 2), y0 - 3 + i, 2, 1, '#c9a050');
      arm([[19, y0 + 1], [20, y0 + 4], [24, y0 + 3]]);
      c.r(25, y0 + 1 + alt, 2, 2, hand);
      c.r(27, y0 + 4 - alt, 2, 2, hand);
      break;
  }
}

// ---- the figure ---------------------------------------------------------------------------------------------------

function heroGrid(L: Look, dir: Dir, P: Pose, blink: boolean, fx: Fx, frame: number): (string | null)[][] {
  const c = new Canvas(N);
  const squint = !!fx.sweat;
  if (dir === 'down' || dir === 'up') drawFront(c, L, P, dir === 'up', blink, squint, fx);
  else {
    drawSide(c, L, P, blink, squint, fx);
    if (dir === 'left') c.flip();
  }
  const keep = new Set([L.eye, WHITE, MOUTH, LENS, OPEN_MOUTH, LOVE, '#f4d35e', shade(L.hair, 0.75), shade(L.skin, 0.74), mix(L.skin, ROSY, 0.42), mix(L.skin, ROSY, 0.18)]);
  const g = finish(c.g, true, keep);
  const side = dir === 'left' || dir === 'right';
  const mx = (x: number) => (dir === 'left' ? N - 1 - x : x);
  const put = (x: number, y: number, col: string) => {
    if (x >= 0 && x < N && y >= 0 && y < N) g[y][mx(x)] = col;
  };
  const dy = P.dy;
  // a puff of breath in the frost, now and then (soft, no outline)
  if (fx.breath && frame % 2 === 0) {
    const pts: Pt[] = side ? [[26, 10], [27, 10], [27, 9], [28, 9], [28, 10], [29, 9]] : dir === 'down' ? [[21, 12], [22, 12], [22, 11], [23, 11], [24, 11]] : [[24, 3], [25, 3], [25, 2], [26, 2]];
    for (const [x, y] of pts) put(x + (side ? P.lean : 0), y + dy, '#f2f6fbc0');
  }
  // a drop of sweat at the temple
  if (fx.sweat && dir !== 'up') {
    put(side ? 17 : 24, 6 + dy, '#bfe6ff');
    put(side ? 17 : 24, 7 + dy, '#8fcff5');
  }
  // the shiver: a pixel to the side and back
  if (fx.hug && frame % 2 === 1) for (const row of g) row.unshift(row.pop() ?? null);
  return g;
}

/**
 * The hero (or another player) facing `dir` in `pose`, the `frame` of its movement (a walk's step, a hammer's
 * blow, the pedals' turn), the eyes shut for a `blink`,
 * the weather's `fx` on it. Drawn on a grid of HERO_PX (marked so: `layersSize`); cached.
 */
export function heroLayers(look: Look, dir: Dir, pose: PoseName, frame: number, blink = false, fx: Fx = {}): Layer[] {
  const P = poseOf(pose, frame);
  const f = (fx.hug ? 1 : 0) | (fx.breath ? 2 : 0) | (fx.sweat ? 4 : 0) | (fx.skate ? 8 : 0);
  const key = `hero|${JSON.stringify(look)}|${dir}|${P.kind}|${P.arms}|${P.hold ?? ''}|${P.step}|${P.dy}|${P.lean}|${P.f}|${blink}|${f}|${f ? frame % 2 : 0}`;
  return remember(key, () => sizedLayers(layersOf(heroGrid(look, dir, P, blink, fx, frame)), N));
}

/** Parts of the hero to show on a small card (x, y, w, h on the HERO_PX grid). */
export const HERO_CROP = {
  full: [0, 0, 40, 40],
  head: [10, 0, 20, 20],
  face: [13, 2, 14, 14],
  top: [8, 10, 24, 22],
  bottom: [8, 22, 24, 18],
  shoes: [10, 30, 20, 10],
  acc: [6, 0, 28, 28],
  hands: [6, 14, 28, 18],
} as const satisfies Record<string, readonly [number, number, number, number]>;
