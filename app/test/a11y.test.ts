import { describe, expect, it } from 'vitest';
import { a11yClasses, captionDue, cueColor, nameOf, SOUND_CAPTIONS, stillFor, TEXT_SCALE, applyA11y, motionReduced } from '../src/a11y';
import { allWords } from '../src/i18n';
import { DEFAULT_PREFS, sanitize } from '../src/prefs';

describe('accessibility preferences', () => {
  it('start plain, with motion following the system', () => {
    expect(DEFAULT_PREFS).toMatchObject({ textSize: 0, contrast: false, motion: 'auto', colorblind: false, bigTargets: false, readable: false, captions: false });
  });

  it('are cleaned when read back', () => {
    const p = sanitize({ textSize: 2, contrast: true, motion: 'reduce', colorblind: true, bigTargets: true, readable: true, captions: true });
    expect(p).toMatchObject({ textSize: 2, contrast: true, motion: 'reduce', colorblind: true, bigTargets: true, readable: true, captions: true });
    const bad = sanitize({ textSize: 7, contrast: 'yes', motion: 'wild', colorblind: 1, bigTargets: null, readable: {}, captions: 'on' });
    expect(bad).toMatchObject({ textSize: 0, contrast: false, motion: 'auto', colorblind: false, bigTargets: false, readable: false, captions: false });
  });

  it('turn into classes on the page', () => {
    const c = a11yClasses({ ...DEFAULT_PREFS, textSize: 1, contrast: true, captions: true }, false);
    expect(c['a11y-text-1']).toBe(true);
    expect(c['a11y-text-2']).toBe(false);
    expect(c['a11y-contrast']).toBe(true);
    expect(c['a11y-captions']).toBe(true);
    expect(c['a11y-still']).toBe(false);
    expect(TEXT_SCALE[0]).toBe(1);
    expect(TEXT_SCALE[2]).toBeGreaterThan(TEXT_SCALE[1]);
  });

  it('hold motion back when asked, or when the system asks and the setting follows it', () => {
    expect(stillFor('reduce', false)).toBe(true);
    expect(stillFor('full', true)).toBe(false);
    expect(stillFor('auto', true)).toBe(true);
    expect(stillFor('auto', false)).toBe(false);
    applyA11y({ ...DEFAULT_PREFS, motion: 'reduce' }, null);
    expect(motionReduced()).toBe(true);
    applyA11y({ ...DEFAULT_PREFS, motion: 'full' }, null);
    expect(motionReduced()).toBe(false);
  });

  it('give the cues a colour-blind safe palette', () => {
    applyA11y({ ...DEFAULT_PREFS }, null);
    const normal = [cueColor('hint'), cueColor('go'), cueColor('alert')];
    applyA11y({ ...DEFAULT_PREFS, colorblind: true }, null);
    const safe = [cueColor('hint'), cueColor('go'), cueColor('alert')];
    expect(safe).not.toEqual(normal);
    expect(new Set(safe).size).toBe(3);
    applyA11y({ ...DEFAULT_PREFS }, null);
  });
});

describe('captions', () => {
  it('every captioned sound has words in both languages', () => {
    const words = allWords();
    for (const key of new Set(Object.values(SOUND_CAPTIONS))) {
      expect(words[key], key).toBeDefined();
      expect(words[key][0].length).toBeGreaterThan(3);
      expect(words[key][1]).not.toMatch(/[А-Яа-яЄєІіЇїҐґ]/);
    }
  });

  it('come for sounds that matter, not too faint, not again too soon', () => {
    const last = new Map<string, number>();
    expect(captionDue('knock', 0.9, 1000, last)).toBe(true);
    expect(captionDue('knock', 0.05, 1000, last)).toBe(false);
    expect(captionDue('rustle', 0.9, 1000, last)).toBe(false);
    last.set(SOUND_CAPTIONS.knock, 1000);
    expect(captionDue('knock', 0.9, 3000, last)).toBe(false);
    expect(captionDue('knock', 0.9, 8000, last)).toBe(true);
    // the church and the peal are the same caption
    last.set(SOUND_CAPTIONS.church, 1000);
    expect(captionDue('peal', 0.9, 2000, last)).toBe(false);
  });
});

describe('names of controls', () => {
  it('prefer the label, then the text, then a title', () => {
    expect(nameOf({ ariaLabel: 'Close', text: 'x' })).toBe('Close');
    expect(nameOf({ text: ' Shop ' })).toBe('Shop');
    expect(nameOf({ text: '', title: 'Turn left' })).toBe('Turn left');
    expect(nameOf({ dataLabel: 'Menu' })).toBe('Menu');
    expect(nameOf({})).toBe('');
  });
});
