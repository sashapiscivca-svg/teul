import { describe, expect, it } from 'vitest';
import { DEFAULT_LOOK, figureLayers, type Expression } from '../src/character';
import { approach, comesOver, emoteOf, expressionOf, hopOf, moodLines, paceOf, warmer, warmthOfHearts, warmthWords, type FeelingsView, type Mood } from '../src/feel';
import { peopleKnown } from '../src/ui/journal';
import { TownFeel } from '../src/townfeel';
import { talkFixture } from './feel.fixture';

describe('faces', () => {
  it('every feeling has a face of its own, and the plain face stays as it was', () => {
    const exprs: Expression[] = ['smile', 'grin', 'sad', 'angry', 'sleepy', 'surprised', 'love'];
    const plain = JSON.stringify(figureLayers(DEFAULT_LOOK, 'down', 'idle', 0));
    const drawn = new Set<string>([plain]);
    for (const expr of exprs) {
      for (const dir of ['down', 'right'] as const) {
        const f = JSON.stringify(figureLayers({ ...DEFAULT_LOOK, expr }, dir, 'idle', 0));
        expect(f).not.toBe(JSON.stringify(figureLayers(DEFAULT_LOOK, dir, 'idle', 0)));
        drawn.add(`${dir}|${f}`);
      }
    }
    expect(drawn.size).toBe(1 + exprs.length * 2);
    expect(JSON.stringify(figureLayers({ ...DEFAULT_LOOK, expr: undefined }, 'down', 'idle', 0))).toBe(plain);
    // the back of the head shows no face
    expect(JSON.stringify(figureLayers({ ...DEFAULT_LOOK, expr: 'grin' }, 'up', 'idle', 0))).toBe(JSON.stringify(figureLayers(DEFAULT_LOOK, 'up', 'idle', 0)));
  });

  it('moods map to faces, and a moment (a surprise, a glare) wins over the mood', () => {
    expect(expressionOf('joyful')).toBe('grin');
    expect(expressionOf('in_love')).toBe('love');
    expect(expressionOf('sad')).toBe('sad');
    expect(expressionOf('cross')).toBe('angry');
    expect(expressionOf('sleepy')).toBe('sleepy');
    expect(expressionOf('calm')).toBeUndefined();
    expect(expressionOf('joyful', 'surprised')).toBe('surprised');
    expect(expressionOf('content', 'cross')).toBe('angry');
  });
});

describe('bubbles', () => {
  const moods: Mood[] = ['joyful', 'in_love', 'sad', 'cross', 'sleepy', 'unwell'];
  it('show now and then, not all the time, and not for everyone at once', () => {
    for (const mood of moods) {
      const shown = Array.from({ length: 600 }, (_, t) => emoteOf('res_3', mood, t / 2)).filter(Boolean).length;
      expect(shown, mood).toBeGreaterThan(5);
      expect(shown, mood).toBeLessThan(400);
    }
    const at = Array.from({ length: 40 }, (_, i) => emoteOf(`res_${i}`, 'joyful', 100)).filter(Boolean).length;
    expect(at).toBeLessThan(30);
  });

  it('fit the feeling', () => {
    const glyphs = (mood: Mood) => new Set(Array.from({ length: 2000 }, (_, t) => emoteOf('res_5', mood, t / 3)?.glyph).filter(Boolean));
    expect([...glyphs('in_love')]).toEqual(['heart']);
    expect([...glyphs('sad')]).toEqual(['rain']);
    expect([...glyphs('cross')]).toEqual(['anger']);
    expect([...glyphs('sleepy')]).toEqual(['zzz']);
    expect(emoteOf('res_5', 'calm', 1, { wave: true })?.glyph).toBe('wave');
    expect(emoteOf('res_5', 'calm', 1, { surprised: true })?.glyph).toBe('exclaim');
    const quarrel = Array.from({ length: 400 }, (_, t) => emoteOf('res_5', 'joyful', t / 2, { quarrel: true })?.glyph).filter(Boolean);
    expect(new Set(quarrel)).toEqual(new Set(['anger']));
  });
});

describe('gestures', () => {
  it('the happy skip, the sad drag their feet', () => {
    const hops = Array.from({ length: 50 }, (_, t) => hopOf('joyful', true, t / 10, 'res_1'));
    expect(Math.max(...hops)).toBeGreaterThan(0);
    expect(hopOf('joyful', false, 1, 'res_1')).toBe(0);
    expect(Array.from({ length: 50 }, (_, t) => hopOf('sad', true, t / 10, 'res_1')).every((h) => h === 0)).toBe(true);
    expect(paceOf('joyful')).toBeGreaterThan(1);
    expect(paceOf('sad')).toBeLessThan(1);
    expect(paceOf(undefined)).toBe(1);
  });

  it('only close friends come over, from not too far, and not every time', () => {
    expect(comesOver('res_1', 'warm', 4, 0)).toBe(false);
    expect(comesOver('res_1', 'dear', 20, 0)).toBe(false);
    const times = Array.from({ length: 60 }, (_, k) => comesOver('res_1', 'dear', 5, k * 40)).filter(Boolean).length;
    expect(times).toBeGreaterThan(5);
    expect(times).toBeLessThan(50);
    const p = approach({ x: 0, y: 0 }, { x: 4, y: 0 }, 1, 2);
    expect(p).toMatchObject({ x: 2, walking: true });
    expect(approach({ x: 0, y: 0 }, { x: 4, y: 0 }, 5, 2)).toMatchObject({ x: 4, walking: false });
  });
});

describe('words, not numbers', () => {
  it('closeness and moods are told in words', () => {
    expect(warmer('dear', 'close')).toBe(true);
    expect(warmer('known', 'warm')).toBe(false);
    for (const n of [0, 1, 2, 3, 4, 5]) expect(warmthWords(warmthOfHearts(n))).not.toMatch(/\d/);
    for (const m of ['joyful', 'in_love', 'sad', 'cross', 'tired', 'sleepy', 'unwell'] as Mood[]) {
      expect(moodLines(m, 'day', true).length, m).toBeGreaterThan(0);
      for (const l of moodLines(m, 'day', false)) expect(l).not.toMatch(/\d/);
    }
  });

  it('the people page lists the closest first and keeps strangers out', () => {
    const page = peopleKnown(talkFixture.warmth);
    expect(page.map((p) => p.name)).toEqual(['Олена Ткач', 'Петро Бондар']);
    expect(page[0].confide).toBeTruthy();
  });
});

describe('the town on screen', () => {
  it('knows who walks with whom, who is not speaking, who waves', () => {
    const f = new TownFeel();
    f.set(talkFixture as FeelingsView);
    expect(f.withOf('res_2')).toBe('res_3');
    expect(f.quarrel('res_4', 'res_5')).toBe(true);
    expect(f.quarrel('res_2', 'res_5')).toBe(false);
    const poses = new Map([['res_1', { x: 5, y: 0, walking: false, dx: 0, dy: 0, visible: true }]]);
    const first = f.react(10, { x: 0, y: 0 }, poses, () => true, () => false);
    expect(first.waved).toEqual(['res_1']);
    expect(f.waving('res_1', 11)).toBe(true);
    // not again right away
    expect(f.react(12, { x: 0, y: 0 }, poses, () => true, () => false).waved).toEqual([]);
    expect(f.face('res_2', DEFAULT_LOOK, 0, false).expr).toBe('love');
    f.surprise('res_2', 0);
    expect(f.face('res_2', DEFAULT_LOOK, 0.5, false).expr).toBe('surprised');
    expect(f.face('res_2', DEFAULT_LOOK, 3, false).expr).toBe('love');
  });
});
