// The worlds behind the rifts (scripts/rift.py; the core's sky::RIFT_WORLDS): how each looks and sounds, what is
// said on arriving, what its beings say. The winter one is the town itself, inside out: drawn through the mirror
// shader (post.ts), its people replaced by other beings that keep their hours.

import type { Creature } from './creatures';
import { t } from '../i18n';

export const RIFT_WORLDS = ['rift_spring', 'rift_summer', 'rift_autumn', 'rift_winter'] as const;
export type RiftWorld = (typeof RIFT_WORLDS)[number];
export const MIRROR_TOWN: RiftWorld = 'rift_winter';

export function isRiftWorld(id: string | null | undefined): id is RiftWorld {
  return !!id && (RIFT_WORLDS as readonly string[]).includes(id);
}

/** The world the rifts open into in a month (the rift days fall only in March, June, September, December). */
export function worldOfMonth(month: number): RiftWorld | null {
  return month === 3 ? 'rift_spring' : month === 6 ? 'rift_summer' : month === 9 ? 'rift_autumn' : month === 12 ? 'rift_winter' : null;
}

export interface WorldLook {
  /** The sky behind it (a backdrop kind) and its light: a fixed hour, an ambient colour and strength. */
  backdrop: string;
  time: string;
  ambient: string;
  strength: string;
  /** A CSS filter over the whole picture where the shader is not used. */
  filter: string;
  arrive: string;
  leave: string;
  sound: string;
}

export const WORLD_LOOK: Record<RiftWorld, WorldLook> = {
  rift_spring: {
    backdrop: 'sky',
    time: '07:40',
    ambient: '#7fe0c0',
    strength: '38',
    filter: 'saturate(1.25) hue-rotate(8deg) brightness(1.04)',
    get arrive() { return t('wonders.worlds.springArrive'); },
    get leave() { return t('wonders.worlds.springLeave'); },
    sound: 'otherworld',
  },
  rift_summer: {
    backdrop: 'sky',
    time: '13:10',
    ambient: '#fff2c8',
    strength: '30',
    filter: 'saturate(0.55) brightness(1.16) contrast(1.05)',
    get arrive() { return t('wonders.worlds.summerArrive'); },
    get leave() { return t('wonders.worlds.summerLeave'); },
    sound: 'hush',
  },
  rift_autumn: {
    backdrop: 'sky',
    time: '17:50',
    ambient: '#ffb35a',
    strength: '48',
    filter: 'sepia(0.35) saturate(1.3) hue-rotate(-8deg)',
    get arrive() { return t('wonders.worlds.autumnArrive'); },
    get leave() { return t('wonders.worlds.autumnLeave'); },
    sound: 'otherworld',
  },
  rift_winter: {
    backdrop: 'space',
    time: '23:40',
    ambient: '#7a8cff',
    strength: '50',
    filter: 'invert(0.86) hue-rotate(180deg) saturate(1.4) contrast(1.1)',
    get arrive() { return t('wonders.worlds.winterArrive'); },
    get leave() { return t('wonders.worlds.winterLeave'); },
    sound: 'drone',
  },
};

/** What the beings say (in pieces) when one stops by them. */
export const BEING_LINES: Record<Creature, string[]> = {
  lantern: ['wonders.worlds.lantern1', 'wonders.worlds.lantern2', 'wonders.worlds.lantern3', 'wonders.worlds.lantern4'],
  moth: ['wonders.worlds.moth1', 'wonders.worlds.moth2', 'wonders.worlds.moth3'],
  deer: ['…', 'wonders.worlds.deer2', 'wonders.worlds.deer3'],
  shade: ['wonders.worlds.shade1', 'wonders.worlds.shade2', 'wonders.worlds.shade3'],
  seedling: ['wonders.worlds.seedling1', 'wonders.worlds.seedling2', 'wonders.worlds.seedling3'],
  gardener: ['wonders.worlds.gardener1', 'wonders.worlds.gardener2', 'wonders.worlds.gardener3'],
  saltwalker: ['wonders.worlds.saltwalker1', 'wonders.worlds.saltwalker2', 'wonders.worlds.saltwalker3'],
  beetle: ['wonders.worlds.beetle1', 'wonders.worlds.beetle2'],
  owl: ['wonders.worlds.owl1', 'wonders.worlds.owl2', 'wonders.worlds.owl3'],
  clockfox: ['wonders.worlds.clockfox1', 'wonders.worlds.clockfox2', 'wonders.worlds.clockfox3'],
  robed: ['…'],
  hunter: ['…'],
};

/** Where each being of a rift world stands and drifts (cells of the world's own map). */
export const BEING_SPOTS: Record<Exclude<RiftWorld, 'rift_winter'>, [number, number][]> = {
  rift_spring: [[22, 18], [34, 18], [18, 26], [38, 26], [28, 30], [28, 13], [10, 22], [46, 22]],
  rift_summer: [[24, 14], [36, 14], [30, 18], [14, 30], [46, 30], [22, 34], [38, 34], [30, 27]],
  rift_autumn: [[22, 22], [34, 22], [28, 15], [28, 29], [16, 16], [40, 16], [16, 30], [40, 30]],
};
