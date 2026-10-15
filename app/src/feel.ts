// What the townsfolk feel, as it shows: a face, a little bubble now and then, a skip in the step or a slow
// walk, a wave to someone they like, words that change with how close they are. The feelings themselves come
// from the core (`feelings_view`); here they only become pictures and gestures — no numbers, no meters.

import type { Expression } from './character';
import { idSeed, mix } from './village';
import { t } from './i18n';

export type Mood = 'joyful' | 'content' | 'calm' | 'tired' | 'sleepy' | 'sad' | 'cross' | 'in_love' | 'unwell';
export type Warmth = 'stranger' | 'known' | 'warm' | 'close' | 'dear';
export type TieKind = 'couple' | 'family' | 'friends' | 'colleagues' | 'neighbours' | 'rivals' | 'crush' | 'courting' | 'sweethearts' | 'parted';

export interface ResidentFeel {
  id: string;
  mood: Mood;
  why: string;
  with?: string;
  cross?: string[];
  love?: string;
}

export interface Tie {
  a: string;
  b: string;
  kind: TieKind;
  state: 'fine' | 'quarrel' | 'made_up';
  admirer?: string;
  days: number;
}

export interface WarmthView {
  id: string;
  name: string;
  level: Warmth;
  words: string;
  greet: string;
  confide?: string;
  gift: boolean;
  faded: boolean;
  people: string[];
  today: string;
}

export interface FeelingsView {
  residents: ResidentFeel[];
  ties: Tie[];
  warmth: WarmthView[];
  gossip: string[];
}

export const WARMTH_ORDER: Warmth[] = ['stranger', 'known', 'warm', 'close', 'dear'];

export function warmer(a: Warmth, than: Warmth): boolean {
  return WARMTH_ORDER.indexOf(a) >= WARMTH_ORDER.indexOf(than);
}

/** The face that goes with a mood; `moment` is something just now (a surprise, a hug, a quarrel nearby). */
export function expressionOf(mood: Mood | undefined, moment: 'surprised' | 'love' | 'cross' | null = null): Expression | undefined {
  if (moment === 'surprised') return 'surprised';
  if (moment === 'cross') return 'angry';
  if (moment === 'love') return 'love';
  switch (mood) {
    case 'joyful':
      return 'grin';
    case 'content':
      return 'smile';
    case 'in_love':
      return 'love';
    case 'sad':
      return 'sad';
    case 'cross':
      return 'angry';
    case 'sleepy':
    case 'tired':
    case 'unwell':
      return 'sleepy';
    default:
      return undefined;
  }
}

export interface Emote {
  glyph: string;
  color: string;
}

// bright on the dark bubble
const COLORS: Record<string, string> = {
  heart: '#ff7d98',
  anger: '#ff5a50',
  rain: '#8fbcf0',
  note: '#c4a8ff',
  zzz: '#b4bcf0',
  drop: '#86c8f4',
  sparkle: '#ffd060',
  wave: '#ffd27a',
  exclaim: '#ff7060',
};

export function emote(glyph: string): Emote {
  return { glyph, color: COLORS[glyph] ?? '#f4eedf' };
}

export interface EmoteMoment {
  /** Waving at the player just now. */
  wave?: boolean;
  /** Near someone they are not speaking to. */
  quarrel?: boolean;
  /** With their sweetheart, or with someone they just made up with. */
  together?: boolean;
  /** Taken by surprise (a gift, a tap). */
  surprised?: boolean;
}

/**
 * The little bubble over someone's head, if any, at `time` (seconds): shown now and then, not all the time,
 * and not by everyone at once — each person keeps their own beat.
 */
export function emoteOf(id: string, mood: Mood | undefined, time: number, m: EmoteMoment = {}): Emote | null {
  if (m.surprised) return emote('exclaim');
  if (m.wave) return emote('wave');
  const seed = idSeed(id);
  const beat = 7 + (seed % 5);
  const slot = Math.floor((time + (seed % 97)) / beat);
  const phase = (time + (seed % 97)) % beat;
  // two who fell out, side by side, glare at each other most of the time
  if (m.quarrel) return phase < 3.6 ? emote('anger') : null;
  if (phase > 2.6) return null;
  const roll = mix(seed, slot) % 12;
  if (m.together && roll < 5) return emote('heart');
  switch (mood) {
    case 'joyful':
      return roll < 3 ? emote(roll === 0 ? 'sparkle' : 'note') : null;
    case 'in_love':
      return roll < 4 ? emote('heart') : null;
    case 'sad':
      return roll < 3 ? emote('rain') : null;
    case 'cross':
      return roll < 3 ? emote('anger') : null;
    case 'sleepy':
      return roll < 6 ? emote('zzz') : null;
    case 'tired':
      return roll < 1 ? emote('zzz') : null;
    case 'unwell':
      return roll < 3 ? emote('drop') : null;
    case 'content':
      return roll < 2 ? emote('note') : null;
    default:
      return null;
  }
}

/** A skip in the step of someone happy (pixels up), a sag for someone low. */
export function hopOf(mood: Mood | undefined, walking: boolean, time: number, id: string): number {
  if (!walking) return 0;
  if (mood === 'joyful' || mood === 'in_love') {
    const t = (time * 2.2 + (idSeed(id) % 10) / 10) % 1;
    return Math.round(Math.sin(t * Math.PI) * 3);
  }
  return 0;
}

/** How someone's mood changes their pace: a spring in the step, or dragging their feet. */
export function paceOf(mood: Mood | undefined): number {
  switch (mood) {
    case 'joyful':
    case 'in_love':
      return 1.12;
    case 'sad':
    case 'tired':
    case 'unwell':
      return 0.8;
    default:
      return 1;
  }
}

/** Words for how close someone is, for the people the player knows from the story (instead of hearts). */
export function warmthOfHearts(hearts: number): Warmth {
  return hearts >= 4 ? 'dear' : hearts >= 3 ? 'close' : hearts >= 1 ? 'warm' : 'known';
}

export function warmthWords(w: Warmth): string {
  switch (w) {
    case 'dear':
      return t('feel.dear');
    case 'close':
      return t('feel.close');
    case 'warm':
      return t('feel.warm');
    case 'known':
      return t('feel.known');
    default:
      return t('feel.stranger');
  }
}

/** What someone says now that goes with how they feel and why (mixed into their other lines). */
export function moodLines(mood: Mood | undefined, why: string | undefined, f: boolean): string[] {
  const g = (m: string, w: string) => (f ? w : m);
  switch (mood) {
    case 'joyful':
      if (why === 'birthday') return [t('feel.birthday1'), t('feel.birthday2')];
      if (why === 'holiday') return [t('feel.holiday1'), t('feel.holiday2')];
      if (why === 'made_up') return [t('feel.madeUp')];
      return [t('feel.joy1'), t('feel.joy2'), t('feel.joy3')];
    case 'content':
      return [t('feel.content1'), t('feel.content2')];
    case 'in_love':
      return [t('feel.love1'), t('feel.love2'), g(t('feel.love3'), t('feel.love3')), t('feel.love4')];
    case 'sad':
      if (why === 'parted') return [t('feel.parted1'), t('feel.parted2')];
      if (why === 'quarrel') return [t('feel.quarrel1'), g(t('feel.quarrelM'), t('feel.quarrelF'))];
      if (why === 'weather') return [t('feel.weather1'), t('feel.weather2')];
      return [t('feel.sad1'), t('feel.sad2')];
    case 'cross':
      if (why === 'quarrel') return [t('feel.cross1'), t('feel.cross2')];
      return [t('feel.cross3'), t('feel.cross4')];
    case 'tired':
      return [g(t('feel.tiredM'), t('feel.tiredF')), t('feel.tired2')];
    case 'sleepy':
      return [t('feel.sleepy1'), t('feel.sleepy2')];
    case 'unwell':
      return [t('feel.unwell1'), t('feel.unwell2')];
    default:
      return [];
  }
}

/** Whether someone fond of the player, idle nearby, comes over to say something (now and then). */
export function comesOver(id: string, level: Warmth, distance: number, time: number): boolean {
  if (!warmer(level, 'close') || distance > 9 || distance < 1.8) return false;
  const slot = Math.floor(time / 40);
  return mix(idSeed(id), slot) % (level === 'dear' ? 3 : 5) === 0;
}

export interface Point {
  x: number;
  y: number;
}

/** Someone walking over to the player: from where they were to beside them, in `walk` seconds, then standing. */
export function approach(from: Point, to: Point, t: number, walk: number): { x: number; y: number; walking: boolean; dx: number; dy: number } {
  const k = Math.max(0, Math.min(1, t / Math.max(0.1, walk)));
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return { x: from.x + dx * k, y: from.y + dy * k, walking: k < 1, dx: k < 1 ? Math.sign(dx) : 0, dy: k < 1 ? Math.sign(dy) : 0 };
}

/** The people a person is not speaking to today (for keeping them from chatting). */
export function quarrelling(view: FeelingsView | null, a: string, b: string): boolean {
  if (!view) return false;
  return view.ties.some((t) => t.state === 'quarrel' && t.kind !== 'colleagues' && ((t.a === a && t.b === b) || (t.a === b && t.b === a)));
}
