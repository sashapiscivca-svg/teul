import { describe, expect, it } from 'vitest';
import { ambientFor, lampOf, lightMinute, shadowsOn, wallMode } from '../src/render/lighting';
import type { ItemDef, PlacementView } from '../src/types';

const lamp = { id: 'floor_lamp', tags: ['light'] } as unknown as ItemDef;
const sofa = { id: 'sofa', tags: [] } as unknown as ItemDef;
const placed = (props: Record<string, string> = {}): PlacementView => ({ pid: 1, item: 'x', x: 0, y: 0, rot: 0, wall: null, on: null, colors: {}, props, known: true });

describe('lightMinute', () => {
  it('follows the real clock unless the player fixes the time', () => {
    expect(lightMinute({}, 600)).toBe(600);
    expect(lightMinute({ time_mode: 'real', time_fixed: '03:00' }, 600)).toBe(600);
    expect(lightMinute({ time_mode: 'fixed', time_fixed: '21:30' }, 600)).toBe(21 * 60 + 30);
  });

  it('ignores a fixed time that is not usable', () => {
    expect(lightMinute({ time_mode: 'fixed' }, 600)).toBe(600);
    expect(lightMinute({ time_mode: 'fixed', time_fixed: 'late' }, 600)).toBe(600);
  });
});

describe('ambientFor', () => {
  it('is the plain daylight without a player colour', () => {
    const a = ambientFor({}, 12 * 60);
    expect(a.tintAlpha).toBe(0);
    expect(a.dark).toBe(0);
  });

  it('lets the player colour tint the scene in proportion to its strength', () => {
    const weak = ambientFor({ ambient_color: '#ff0000', ambient_strength: '10' }, 12 * 60);
    const strong = ambientFor({ ambient_color: '#ff0000', ambient_strength: '90' }, 12 * 60);
    expect(strong.tintAlpha).toBeGreaterThan(weak.tintAlpha);
    expect(strong.tint).not.toBe(weak.tint);
    expect(strong.tintAlpha).toBeLessThanOrEqual(0.6);
  });

  it('ignores an invalid colour', () => {
    expect(ambientFor({ ambient_color: 'red' }, 12 * 60).tintAlpha).toBe(0);
  });
});

describe('lampOf', () => {
  it('is nothing for an item that gives no light', () => {
    expect(lampOf(sofa, placed(), 1)).toBeNull();
    expect(lampOf(undefined, placed(), 1)).toBeNull();
  });

  it('is lit at night and off by day, unless the player says otherwise', () => {
    expect(lampOf(lamp, placed(), 0.9)?.lit).toBe(true);
    expect(lampOf(lamp, placed(), 0)?.lit).toBe(false);
    expect(lampOf(lamp, placed({ lit: '1' }), 0)?.lit).toBe(true);
    expect(lampOf(lamp, placed({ lit: '0' }), 1)?.lit).toBe(false);
  });

  it('takes colour and strength from the props with safe defaults', () => {
    const l = lampOf(lamp, placed({ light_color: '#00ffaa', light_strength: '40' }), 1)!;
    expect(l.color).toBe('#00ffaa');
    expect(l.strength).toBeCloseTo(0.4, 9);
    const bad = lampOf(lamp, placed({ light_color: 'green', light_strength: 'lots' }), 1)!;
    expect(bad.color).toBe('#ffd27a');
    expect(bad.strength).toBeCloseTo(0.7, 9);
  });
});

describe('settings helpers', () => {
  it('reads shadows and the wall mode with defaults', () => {
    expect(shadowsOn({})).toBe(true);
    expect(shadowsOn({ shadows: '0' })).toBe(false);
    expect(wallMode({})).toBe('cut');
    expect(wallMode({ wall_mode: 'full' })).toBe('full');
    expect(wallMode({ wall_mode: 'down' })).toBe('down');
    expect(wallMode({ wall_mode: 'weird' })).toBe('cut');
  });
});
