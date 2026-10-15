// The eerie nights, for those who like it (a setting, off by default). On Halloween, Walpurgis night, a Friday the
// 13th, Midsummer night and the rift nights, after dark, the town stops being itself. Small things happen anywhere
// (lights flicker, someone stands at the edge of sight, a knock at the door); and out of doors whole nights unfold
// (wonders/nightmare.ts): the mob with torches and pitchforks filling the streets, the masked figures in the wheat
// that come closer each time you look away, the one that hunts you to a lit door. Never gore, never a loss that
// stays: every dialog offers to walk away and every night ends on its own. With the setting off, those nights stay
// sweet. Pure: which night it is, and what happens in a moment of it (deterministic per seed and slot).
import { t } from './i18n';

export type Theme = 'halloween' | 'walpurgis' | 'friday13' | 'midsummer' | 'rift';

export interface Night {
  /** The holiday of the evening this night belongs to (the day before after midnight). */
  holiday: string | null;
  /** The holiday after that evening (its eve is tonight). */
  tomorrow: string | null;
  /** That evening was a rift day. */
  rift: boolean;
  /** Minute of the day now. */
  minute: number;
  place: string;
  /** That evening's date: month 1..12, day of the month, weekday 0 Monday .. 6 Sunday. */
  date?: { month: number; day: number; weekday: number };
}

export interface Choice {
  label: string;
  text: string;
  /** Walking away (every dialog has one). */
  leave?: boolean;
}

export interface HorrorEvent {
  kind: string;
  /** What happens, told plainly. */
  text: string;
  sound: string;
  /** Lights flicker for a moment. */
  flicker?: boolean;
  /** Someone at the edge of sight. */
  figure?: boolean;
  /** Fragments drifting by (whispers). */
  lines?: string[];
  /** A small dialog. */
  choices?: Choice[];
}

/** A night that unfolds out of doors (wonders/nightmare.ts). */
export type Scenario = 'mob' | 'field' | 'chase';

/** The evening a moment belongs to: after midnight and before five it is still last night. */
export function eveningOf(minute: number): 0 | -1 {
  return minute < 5 * 60 ? -1 : 0;
}

const DARK = (m: number) => m >= 21 * 60 || m < 5 * 60;

export function spookyTheme(n: Night): Theme | null {
  if (!DARK(n.minute)) return null;
  if (n.rift) return 'rift';
  if (n.holiday === 'halloween') return 'halloween';
  if (n.holiday === 'kupala' || n.holiday === 'midsummer' || n.tomorrow === 'midsummer') return 'midsummer';
  if (n.date) {
    if (n.date.month === 10 && n.date.day === 31) return 'halloween';
    if (n.date.month === 4 && n.date.day === 30) return 'walpurgis';
    if (n.date.month === 6 && n.date.day === 23) return 'midsummer';
    if (n.date.day === 13 && n.date.weekday === 4) return 'friday13';
  }
  return null;
}

function hash(a: number, b: number, c: number): number {
  let x = (a * 2654435761) ^ (b * 40503) ^ (c * 97);
  x = Math.imul(x ^ (x >>> 15), 2246822519);
  x = Math.imul(x ^ (x >>> 13), 3266489917);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

const AWAY = (): Choice => ({ label: t('horror.away'), text: t('horror.awayText'), leave: true });

const WHISPERS = (): string[] => [t('horror.whisper1'), t('horror.whisper2'), t('horror.whisper3'), t('horror.whisper4'), t('horror.whisper5'), t('horror.whisper6'), t('horror.whisper7'), t('horror.whisper8')];

type Make = () => HorrorEvent;

const ANYWHERE: Make[] = [
  () => ({ kind: 'flicker', text: t('horror.flicker'), sound: 'buzz', flicker: true }),
  () => ({ kind: 'figure', text: t('horror.figure'), sound: 'drone', figure: true }),
  () => ({ kind: 'whisper', text: t('horror.whisper'), sound: 'whisper', lines: WHISPERS() }),
];

const HOME: Make[] = [
  () => ({
    kind: 'knock',
    text: t('horror.knock'),
    sound: 'knock',
    choices: [
      { label: t('horror.knockOpen'), text: t('horror.knockOpenText') },
      { label: t('horror.knockAsk'), text: t('horror.knockAskText') },
      { label: t('horror.knockStay'), text: t('horror.knockStayText'), leave: true },
    ],
  }),
  () => ({
    kind: 'mirror',
    text: t('horror.mirror'),
    sound: 'sting',
    choices: [
      { label: t('horror.mirrorTurn'), text: t('horror.mirrorTurnText') },
      { label: t('horror.mirrorStay'), text: t('horror.mirrorStayText'), leave: true },
    ],
  }),
  () => ({
    kind: 'phone',
    text: t('horror.phone'),
    sound: 'breath',
    choices: [
      { label: t('horror.phoneLook'), text: t('horror.phoneLookText') },
      { label: t('horror.phoneHangUp'), text: t('horror.phoneHangUpText'), leave: true },
    ],
  }),
  () => ({ kind: 'tv', text: t('horror.tv'), sound: 'buzz', flicker: true }),
  () => ({ kind: 'cat', text: t('horror.catHome'), sound: 'hollow_meow' }),
];

const OUT: Make[] = [
  () => ({
    kind: 'bride',
    text: t('horror.bride'),
    sound: 'song_far',
    figure: true,
    choices: [
      { label: t('horror.brideGreet'), text: t('horror.brideGreetText') },
      { label: t('horror.brideCross'), text: t('horror.brideCrossText'), leave: true },
    ],
  }),
  () => ({ kind: 'cat', text: t('horror.catOut'), sound: 'hollow_meow' }),
  () => ({ kind: 'swing', text: t('horror.swing'), sound: 'scrape' }),
];

const CAVE: Make[] = [
  () => ({
    kind: 'steps',
    text: t('horror.steps'),
    sound: 'steps',
    figure: true,
    choices: [
      { label: t('horror.stepsTurn'), text: t('horror.stepsTurnText') },
      { label: t('horror.stepsLeave'), text: t('horror.stepsLeaveText'), leave: true },
    ],
  }),
];

/** Where the player is, as the nights see it. */
export function kindOf(place: string): 'home' | 'forest' | 'cave' | 'field' | 'rift' | 'town' | 'inside' {
  if (place === 'home') return 'home';
  if (place === 'forest') return 'forest';
  if (place === 'cave' || place === 'bar_cellar') return 'cave';
  if (place === 'fields' || place === 'farm' || place === 'vineyard') return 'field';
  if (place.startsWith('rift_') || place === 'otherside') return 'rift';
  if (place === 'village' || place === 'cemetery' || place === 'hippodrome' || place === 'dump') return 'town';
  return 'inside';
}

/** What happens in a moment (`slot`) of an eerie night; null most of the time, and always with the setting off. */
export function pickEvent(theme: Theme | null, place: string, seed: number, slot: number, enabled: boolean): HorrorEvent | null {
  if (!enabled || !theme) return null;
  const k = kindOf(place);
  const r = hash(seed, slot, theme.length * 31 + place.length);
  if (r > 0.55) return null;
  const pool: Make[] = [...ANYWHERE];
  if (k === 'home') pool.push(...HOME, ...HOME);
  if (k === 'town' || k === 'forest' || k === 'field') pool.push(...OUT);
  if (k === 'cave') pool.push(...CAVE, ...CAVE);
  // in the rift worlds only whispers and figures
  if (k === 'rift') pool.splice(0, pool.length, ANYWHERE[1], ANYWHERE[2]);
  const e = pool[Math.floor(hash(seed, slot, 7) * pool.length)]();
  if (e.choices && !e.choices.some((c) => c.leave)) e.choices.push(AWAY());
  return e;
}

/** Which whole night unfolds now (out of doors, now and then), by the night's character and the place. */
export function pickScenario(theme: Theme | null, place: string, seed: number, slot: number, enabled: boolean): Scenario | null {
  if (!enabled || !theme) return null;
  const k = kindOf(place);
  if (k !== 'town' && k !== 'field' && k !== 'forest') return null;
  if (hash(seed, slot, 1013) > 0.42) return null;
  const fits: Scenario[] =
    k === 'field' ? ['field', 'field', 'chase'] : k === 'forest' ? ['chase', 'chase', 'field'] : theme === 'friday13' || theme === 'rift' ? ['chase', 'chase', 'mob'] : ['mob', 'mob', 'chase'];
  return fits[Math.floor(hash(seed, slot, 2027) * fits.length)];
}

/** What a scenario says when it begins, and when it ends. */
export const SCENARIO_TEXT: Record<Scenario, { start: string; end: string; caught?: string }> = {
  mob: {
    get start() { return t('horror.mobStart'); },
    get end() { return t('horror.mobEnd'); },
  },
  field: {
    get start() { return t('horror.fieldStart'); },
    get end() { return t('horror.fieldEnd'); },
  },
  chase: {
    get start() { return t('horror.chaseStart'); },
    get end() { return t('horror.chaseEnd'); },
    get caught() { return t('horror.chaseCaught'); },
  },
};
