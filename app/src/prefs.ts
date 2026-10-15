// Per-device preferences (sound, comfort, performance). They live in the browser's storage, not in the
// world: the world is the same on every device, how it is presented is up to the device.

export interface Prefs {
  master: number;
  music: number;
  effects: number;
  ambience: number;
  haptics: boolean;
  /** Where the joystick sits. */
  stick: 'left' | 'right';
  /** HUD scale: 0 small, 1 normal, 2 large. */
  hudSize: 0 | 1 | 2;
  quality: 'auto' | 'high' | 'low';
  /** The keys of a computer, by what they do (the codes of KeyboardEvent): one can set each one's own. */
  keys: KeyMap;
  /** The number of each of the place's buttons shown on it, for the keys 1–8 (on a computer). */
  keyHints: boolean;
  /** Which title splash greets the player. */
  splash: 'rift' | 'door' | 'depth' | 'seasons';
  /** Eerie things on the old feasts' nights and the rift nights (off: those days stay sweet). */
  horror: boolean;
  /** Size of the interface's words: 0 as drawn, 1 larger, 2 largest (the whole interface scales). */
  textSize: 0 | 1 | 2;
  /** A high-contrast interface. */
  contrast: boolean;
  /** Motion: `auto` follows the system's reduce-motion setting; `reduce` holds back shakes, flashes and sways. */
  motion: 'auto' | 'reduce' | 'full';
  /** Colours of the important cues safe for colour blindness. */
  colorblind: boolean;
  /** Larger touch targets. */
  bigTargets: boolean;
  /** A plain, readable font for long texts instead of the pixel one. */
  readable: boolean;
  /** Captions for the sounds that matter. */
  captions: boolean;
  /** The whole screen (the desktop app and a browser on a computer). */
  fullscreen: boolean;
}

export type KeyAction = 'act' | 'jump' | 'crouch' | 'turnLeft' | 'turnRight' | 'map' | 'swap';
export type KeyMap = Record<KeyAction, string>;
export const DEFAULT_KEYS: KeyMap = { act: 'KeyF', jump: 'Space', crouch: 'KeyC', turnLeft: 'KeyQ', turnRight: 'KeyE', map: 'KeyM', swap: 'KeyX' };

export const DEFAULT_PREFS: Prefs = { master: 0.8, music: 0.5, effects: 0.8, ambience: 0.7, haptics: true, stick: 'left', hudSize: 1, quality: 'auto', keys: { ...DEFAULT_KEYS }, keyHints: true, splash: 'rift', horror: false, textSize: 0, contrast: false, motion: 'auto', colorblind: false, bigTargets: false, readable: false, captions: false, fullscreen: false };

const KEY = 'teul.prefs';

function unit(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
}

/** Cleans anything read from storage, so a corrupted or old entry cannot break the interface. */
export function sanitize(raw: unknown): Prefs {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_PREFS;
  return {
    master: unit(r.master, d.master),
    music: unit(r.music, d.music),
    effects: unit(r.effects, d.effects),
    ambience: unit(r.ambience, d.ambience),
    haptics: typeof r.haptics === 'boolean' ? r.haptics : d.haptics,
    stick: r.stick === 'right' ? 'right' : 'left',
    hudSize: r.hudSize === 0 || r.hudSize === 2 ? r.hudSize : 1,
    quality: r.quality === 'high' || r.quality === 'low' ? r.quality : 'auto',
    keys: keysOf(r.keys),
    keyHints: r.keyHints !== false,
    splash: r.splash === 'door' || r.splash === 'depth' || r.splash === 'seasons' ? r.splash : 'rift',
    horror: r.horror === true,
    textSize: r.textSize === 1 || r.textSize === 2 ? r.textSize : 0,
    contrast: r.contrast === true,
    motion: r.motion === 'reduce' || r.motion === 'full' ? r.motion : 'auto',
    colorblind: r.colorblind === true,
    bigTargets: r.bigTargets === true,
    readable: r.readable === true,
    captions: r.captions === true,
    fullscreen: r.fullscreen === true,
  };
}

export function loadPrefs(): Prefs {
  try {
    const text = globalThis.localStorage?.getItem(KEY);
    return sanitize(text ? JSON.parse(text) : null);
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(p: Prefs): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(p));
  } catch {
    // storage can be blocked; preferences then last for this session only
  }
}

/** A stored key map, every action with a key of its own (anything unknown or doubled falls back to the default). */
function keysOf(v: unknown): KeyMap {
  const out = { ...DEFAULT_KEYS };
  if (!v || typeof v !== 'object') return out;
  const seen = new Set<string>();
  for (const k of Object.keys(DEFAULT_KEYS) as KeyAction[]) {
    const code = (v as Record<string, unknown>)[k];
    if (typeof code === 'string' && /^[A-Za-z0-9]{2,20}$/.test(code) && !seen.has(code)) out[k] = code;
    seen.add(out[k]);
  }
  return out;
}
