// Time of day, ambient light and lamps, derived from room settings and item props.

import { daylight, lerpColor, type Daylight } from '../daylight';
import type { ItemDef, PlacementView } from '../types';

/** The minute of the day that governs the light: the real clock, or the one the player fixed. */
export function lightMinute(settings: Record<string, string>, realMinute: number): number {
  if (settings.time_mode === 'fixed' && settings.time_fixed) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(settings.time_fixed);
    if (m) return Number(m[1]) * 60 + Number(m[2]);
  }
  return realMinute;
}

export interface Ambient {
  /** Colour and strength of the overlay that tints the whole scene. */
  tint: string;
  tintAlpha: number;
  dark: number;
  sky: string;
}

/** The day's light, mixed with the player's ambient colour. */
export function ambientFor(settings: Record<string, string>, minute: number): Ambient {
  const dl: Daylight = daylight(minute);
  const colour = /^#[0-9a-fA-F]{6}$/.test(settings.ambient_color ?? '') ? settings.ambient_color : null;
  if (!colour) return { tint: dl.tint, tintAlpha: Math.min(0.44, dl.tintAlpha), dark: dl.dark, sky: dl.sky };
  const strength = Math.max(0, Math.min(100, Number(settings.ambient_strength ?? 40))) / 100;
  // The player's colour takes over the tint in proportion to its strength.
  return {
    tint: lerpColor(dl.tint, colour, strength),
    tintAlpha: Math.min(0.5, Math.min(0.44, dl.tintAlpha) + strength * 0.3),
    dark: dl.dark,
    sky: dl.sky,
  };
}

export interface Lamp {
  color: string;
  /** 0 to 1. */
  strength: number;
  lit: boolean;
}

/** Whether and how a placed item gives light. */
export function lampOf(def: ItemDef | undefined, p: PlacementView, dark: number): Lamp | null {
  if (!def?.tags.includes('light')) return null;
  // crystals and glowing mushrooms light the dark in their own colour
  const own = def.tags.includes('self_glow') ? (p.colors.glow ?? def.slots.glow?.default) : undefined;
  const color = /^#[0-9a-fA-F]{6}$/.test(p.props?.light_color ?? '') ? p.props.light_color : (own ?? '#ffd27a');
  const raw = Number(p.props?.light_strength ?? 70);
  const strength = Math.max(0, Math.min(100, Number.isFinite(raw) ? raw : 70)) / 100;
  const lit = p.props?.lit === '1' ? true : p.props?.lit === '0' ? false : dark > 0.22;
  return { color, strength, lit };
}

/** Shadows are on unless the player turned them off. */
export function shadowsOn(settings: Record<string, string>): boolean {
  return settings.shadows !== '0';
}

export type WallMode = 'full' | 'cut' | 'down';

export function wallMode(settings: Record<string, string>): WallMode {
  const m = settings.wall_mode;
  return m === 'full' || m === 'down' ? m : 'cut';
}
