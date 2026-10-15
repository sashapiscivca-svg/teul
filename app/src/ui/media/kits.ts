// The instruments the hero plays: recorded one note every three semitones (crates/teul-music sprites.rs keeps the
// same table), and which things of the world are which instrument.

import { t } from '../../i18n';

export type KitId = 'piano' | 'guitar' | 'accordion' | 'violin' | 'bandura' | 'sopilka';

export interface Kit {
  id: KitId;
  name: string;
  low: number;
  high: number;
  /** Seconds of one slot in the sprite. */
  slot: number;
  /** How it plays a chord: struck together, strummed, pumped on the bellows, or not at all (one voice). */
  chords: 'block' | 'strum' | 'bellows' | 'arp' | 'none';
  /** How the hands are seen holding it (character.ts). */
  pose: 'piano' | 'guitar' | 'accordion' | 'violin' | 'bandura' | 'sopilka';
  /** The way it is played freely: keys, chord buttons, or holes. */
  free: 'keys' | 'chords' | 'strings' | 'holes';
}

export const KITS: Record<KitId, Kit> = {
  piano: { id: 'piano', name: t('media.kits.piano'), low: 36, high: 96, slot: 2.4, chords: 'block', pose: 'piano', free: 'keys' },
  guitar: { id: 'guitar', name: t('media.kits.guitar'), low: 40, high: 82, slot: 2.0, chords: 'strum', pose: 'guitar', free: 'chords' },
  accordion: { id: 'accordion', name: t('media.kits.accordion'), low: 41, high: 89, slot: 2.0, chords: 'bellows', pose: 'accordion', free: 'keys' },
  violin: { id: 'violin', name: t('media.kits.violin'), low: 55, high: 97, slot: 2.1, chords: 'none', pose: 'violin', free: 'strings' },
  bandura: { id: 'bandura', name: t('media.kits.bandura'), low: 40, high: 88, slot: 2.2, chords: 'arp', pose: 'bandura', free: 'strings' },
  sopilka: { id: 'sopilka', name: t('media.kits.sopilka'), low: 60, high: 96, slot: 1.8, chords: 'none', pose: 'sopilka', free: 'holes' },
};

/** Which instrument a thing of the world is (by its item id). */
export function kitOfItem(item: string): KitId | null {
  if (/piano|synth/.test(item)) return 'piano';
  if (/guitar/.test(item)) return 'guitar';
  if (/accordion/.test(item)) return 'accordion';
  if (/violin/.test(item)) return 'violin';
  if (/bandura/.test(item)) return 'bandura';
  if (/sopilka|flute|recorder/.test(item)) return 'sopilka';
  return null;
}

/** The recorded key nearest to `key` and the playback rate that bends it there. */
export function sampleFor(kit: Kit, key: number): { index: number; rate: number } {
  const k = Math.max(kit.low - 12, Math.min(kit.high + 12, key));
  const index = Math.max(0, Math.min(Math.floor((kit.high - kit.low) / 3), Math.round((k - kit.low) / 3)));
  const base = kit.low + index * 3;
  return { index, rate: Math.pow(2, (k - base) / 12) };
}
