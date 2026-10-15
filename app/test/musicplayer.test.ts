import { existsSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MOODS, MusicPlayer, moodOf, trackOf, type Deck } from '../src/musicplayer';

function fakeDeck(log: string[], name: string): Deck {
  return {
    load: (url) => void log.push(`${name} load ${url}`),
    play: () => void log.push(`${name} play`),
    pause: () => void log.push(`${name} pause`),
    fade: (to, secs) => void log.push(`${name} fade ${to} ${secs}`),
  };
}

describe('the music', () => {
  it('follows the place, the night and what is playing in the room', () => {
    expect(moodOf({ dark: 0, place: 'village' })).toBe('village');
    expect(moodOf({ dark: 0.9, place: 'village' })).toBe('night');
    expect(moodOf({ dark: 0.9, place: 'cave' })).toBe('cave');
    expect(moodOf({ dark: 0.9, place: 'village', playing: 'radio' })).toBe('radio');
    expect(moodOf({ dark: 0 })).toBe('home');
  });

  it('follows the hour and the season in town, the rain, the feasts, and the places with a sound of their own', () => {
    const town = { place: 'village' as const, outdoors: true };
    // the hours: the morning, the day by the season, the evening, the night
    expect(moodOf({ ...town, dark: 0.1, minute: 7 * 60, season: 'Autumn', day: 2 })).toBe('morning');
    expect(moodOf({ ...town, dark: 0, minute: 13 * 60, season: 'Autumn', day: 2 })).toBe('autumn');
    expect(moodOf({ ...town, dark: 0, minute: 13 * 60, season: 'Winter', day: 2 })).toBe('winter');
    // every other day the town's own tune instead of the season's, so the days do not all sound alike
    expect(moodOf({ ...town, dark: 0, minute: 13 * 60, season: 'Winter', day: 3 })).toBe('village');
    expect(moodOf({ ...town, dark: 0.35, minute: 19 * 60, season: 'Summer', day: 2 })).toBe('evening');
    expect(moodOf({ ...town, dark: 0.9, minute: 23 * 60, season: 'Summer', day: 2 })).toBe('night');
    // the rain out of doors by day
    expect(moodOf({ ...town, dark: 0, minute: 13 * 60, season: 'Spring', day: 2, weather: 'rain' })).toBe('rain');
    expect(moodOf({ ...town, dark: 0, minute: 13 * 60, season: 'Spring', day: 2, weather: 'storm' })).toBe('rain');
    // the feasts on their day in town, over the hour and the weather
    expect(moodOf({ ...town, dark: 0, minute: 11 * 60, season: 'Winter', day: 2, festival: 'lunar_new_year' })).toBe('lunar');
    expect(moodOf({ ...town, dark: 0.5, minute: 20 * 60, season: 'Summer', day: 2, festival: 'town_day' })).toBe('townday');
    expect(moodOf({ ...town, dark: 0.8, minute: 21 * 60, season: 'Autumn', day: 2, festival: 'halloween' })).toBe('halloween');
    expect(moodOf({ ...town, dark: 0.8, minute: 18 * 60, season: 'Winter', day: 2, festival: 'winter_lights' })).toBe('winterlights');
    expect(moodOf({ ...town, dark: 0.7, minute: 22 * 60, season: 'Summer', day: 2, festival: 'kupala' })).toBe('midsummer');
    // a feast does not follow one indoors, and a record in the room is played over all
    expect(moodOf({ place: 'cafe', dark: 0, minute: 11 * 60, festival: 'lunar_new_year' })).toBe('cafe');
    expect(moodOf({ ...town, dark: 0, minute: 11 * 60, festival: 'lunar_new_year', playing: 'radio' })).toBe('radio');
    // places with a sound of their own
    expect(moodOf({ place: 'church', dark: 0, minute: 10 * 60 })).toBe('church');
    expect(moodOf({ place: 'temple', dark: 0.9, minute: 23 * 60 })).toBe('temple');
    expect(moodOf({ place: 'grove', dark: 0.9, minute: 22 * 60 })).toBe('grove');
    expect(moodOf({ place: 'rift_spring', dark: 0 })).toBe('rift_spring');
    expect(moodOf({ place: 'mirror', dark: 0.9 })).toBe('mirror');
    // home: the day, the evening with the lamp on, the night
    expect(moodOf({ place: 'home', dark: 0, minute: 14 * 60 })).toBe('home');
    expect(moodOf({ place: 'home', dark: 0.4, minute: 19 * 60 })).toBe('home_evening');
    expect(moodOf({ place: 'home', dark: 0.9, minute: 23 * 60 + 30 })).toBe('night');
  });

  it('crossfades slowly between the hours and quickly into a new place', () => {
    const log: string[] = [];
    const decks = [fakeDeck(log, 'A'), fakeDeck(log, 'B')];
    const p = new MusicPlayer(() => decks.shift() as Deck, '/');
    p.want('morning', 0);
    p.want('autumn', 1);
    p.want('autumn', 3);
    expect(log).toContain('A fade 0 6');
    expect(log).toContain('B fade 1 6');
  });

  it('has a recorded piece for every mood, small enough for a phone', () => {
    let total = 0;
    for (const m of MOODS) {
      const file = `public/${trackOf(m, '')}`;
      expect(existsSync(file), file).toBe(true);
      total += statSync(file).size;
    }
    // the first eleven pieces in stereo, the rest in mono: all of it within what a phone app may carry
    expect(total).toBeLessThan(18 * 1024 * 1024);
  });

  it('crossfades to a new mood on the other deck, and does not restart the same one', () => {
    const log: string[] = [];
    const decks = [fakeDeck(log, 'A'), fakeDeck(log, 'B')];
    const p = new MusicPlayer(() => decks.shift() as Deck, '/');
    p.want('home', 0);
    p.want('home', 5);
    p.want('village', 6);
    // a change of mood waits a moment (the dusk can flicker between day and night)
    expect(log.filter((l) => l.includes('village'))).toEqual([]);
    p.want('village', 8);
    expect(log).toContain('B load /music/village.ogg');
    expect(log).toContain('A fade 0 2.5');
    expect(log).toContain('B fade 1 2.5');
    expect(log.filter((l) => l === 'A load /music/home.ogg').length).toBe(1);
  });

  it('pauses while hidden and goes on where it was when shown', () => {
    const log: string[] = [];
    const decks = [fakeDeck(log, 'A'), fakeDeck(log, 'B')];
    const p = new MusicPlayer(() => decks.shift() as Deck, '/');
    p.want('forest', 0);
    log.length = 0;
    p.setPaused(true);
    expect(log).toEqual(['A pause']);
    p.setPaused(false);
    expect(log).toEqual(['A pause', 'A play']);
  });
});
