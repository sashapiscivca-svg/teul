// The music: pieces written for each place (crates/teul-music), played by real instruments from a SoundFont and
// recorded ahead of time (scripts/build-music.sh), streamed here from app/public/music. Two decks crossfade when
// the place changes; the music pauses while the app is hidden.

export const MOODS = [
  'home', 'village', 'forest', 'night', 'cave', 'fields', 'farm', 'race', 'radio', 'vinyl', 'musicbox',
  // the hours and the seasons in town, the rain, home of an evening
  'morning', 'evening', 'spring', 'summer', 'autumn', 'winter', 'rain', 'home_evening',
  // places with a sound of their own, the rift worlds, the town inside out
  'cafe', 'church', 'temple', 'grove', 'rift_spring', 'rift_summer', 'rift_autumn', 'mirror',
  // the town's feasts
  'lunar', 'townday', 'halloween', 'winterlights', 'midsummer',
] as const;
/** A place's piece, or a record from the shelf (`rec/<id>`, app/public/music/rec). */
export type Mood = (typeof MOODS)[number] | `rec/${string}`;

/** Where one is, as far as the music is concerned. */
export type MusicPlace =
  | 'home' | 'village' | 'forest' | 'cave' | 'fields' | 'farm' | 'race'
  | 'cafe' | 'church' | 'temple' | 'grove' | 'rift_spring' | 'rift_summer' | 'rift_autumn' | 'mirror';

export interface MoodScene {
  /** 0 in daylight, 1 deep night. */
  dark: number;
  place?: MusicPlace;
  playing?: 'radio' | 'vinyl' | 'musicbox' | `rec/${string}` | (typeof MOODS)[number];
  /** The minute of the day (0..1439). */
  minute?: number;
  season?: 'Spring' | 'Summer' | 'Autumn' | 'Winter';
  /** The world day (some days the town has its own tune instead of the season's). */
  day?: number;
  weather?: string;
  /** The feast the town celebrates today (on its day, not while getting ready). */
  festival?: string | null;
  /** Out of doors in the town (a feast and the rain are heard there). */
  outdoors?: boolean;
}

/** Each feast's music (the ids of crates/teul-core/src/festival.rs and holidays.rs). */
const FEASTS: Record<string, Mood> = {
  lunar_new_year: 'lunar',
  town_day: 'townday',
  harvest_fair: 'townday',
  halloween: 'halloween',
  winter_lights: 'winterlights',
  new_year: 'winterlights',
  new_year_eve: 'winterlights',
  kupala: 'midsummer',
  flower_festival: 'spring',
  spring_carnival: 'townday',
};
const SEASONS: Record<string, Mood> = { Spring: 'spring', Summer: 'summer', Autumn: 'autumn', Winter: 'winter' };
const OWN: ReadonlySet<string> = new Set(['cafe', 'church', 'temple', 'grove', 'rift_spring', 'rift_summer', 'rift_autumn', 'mirror', 'cave']);

/**
 * What should be playing, in this order: something in the room; a place with a sound of its own (the café, the
 * church, the temple, the forest circle, a rift world, the cave); the town's feast, out of doors; the rain out of
 * doors by day; the night; then the hour (morning, evening) and the season in town, the evening at home; else
 * the place's own piece.
 */
export function moodOf(s: MoodScene): Mood {
  if (s.playing) return s.playing;
  const place = s.place ?? 'home';
  if (OWN.has(place)) return place as Mood;
  const minute = s.minute ?? 12 * 60;
  const town = place === 'village';
  if (town && s.festival && FEASTS[s.festival] && (s.outdoors ?? true) && (minute >= 8 * 60 || minute < 60)) return FEASTS[s.festival];
  if ((s.outdoors ?? place !== 'home') && (s.weather === 'rain' || s.weather === 'storm') && s.dark < 0.6) return 'rain';
  if (place === 'home') {
    if (s.dark > 0.75) return 'night';
    if (minute >= 18 * 60 && minute < 23 * 60 + 30) return 'home_evening';
    return s.dark > 0.6 ? 'night' : 'home';
  }
  if (s.dark > 0.6) return 'night';
  if (town && s.minute !== undefined) {
    if (minute >= 5 * 60 && minute < 9 * 60 + 30) return 'morning';
    if (minute >= 18 * 60 || s.dark > 0.3) return 'evening';
    if (s.season && (s.day ?? 0) % 2 === 0) return SEASONS[s.season];
  }
  return place;
}

/** Moods of the same place changing with the hour cross slowly; going into a new place, quickly. */
const TOWN_HOURS: ReadonlySet<string> = new Set(['village', 'morning', 'evening', 'night', 'spring', 'summer', 'autumn', 'winter', 'rain']);
const HOME_HOURS: ReadonlySet<string> = new Set(['home', 'home_evening', 'night']);

/** How long the crossing from one mood to the next takes. */
export function crossing(from: Mood | null, to: Mood): number {
  if (from === null) return 1;
  const same = (set: ReadonlySet<string>) => set.has(from) && set.has(to);
  return same(TOWN_HOURS) || same(HOME_HOURS) ? SLOW : FADE;
}

export function trackOf(mood: Mood, base: string): string {
  return `${base}music/${mood}.ogg`;
}

/** One player of the two. */
export interface Deck {
  load(url: string): void;
  play(): void;
  pause(): void;
  /** Moves the deck's level to `to` (0..1) over `secs`. */
  fade(to: number, secs: number): void;
}

const FADE = 2.5;
/** The crossing between two hours of the same place. */
const SLOW = 6;
/** A new mood must hold this long before the music follows it (the dusk flickers between day and night). */
const SETTLE = 1.5;

export class MusicPlayer {
  private decks: Deck[] = [];
  private active = -1;
  private mood: Mood | null = null;
  private pending: { mood: Mood; since: number } | null = null;
  private paused = false;

  constructor(
    private readonly makeDeck: () => Deck,
    private readonly base: string,
  ) {}

  private deck(i: number): Deck {
    while (this.decks.length <= i) this.decks.push(this.makeDeck());
    return this.decks[i];
  }

  /** Called often with what the scene wants (`now` in seconds); changes the piece once the wish holds. */
  want(mood: Mood, now: number): void {
    if (mood === this.mood) {
      this.pending = null;
      return;
    }
    if (this.mood !== null) {
      if (!this.pending || this.pending.mood !== mood) {
        this.pending = { mood, since: now };
        return;
      }
      if (now - this.pending.since < SETTLE) return;
    }
    this.pending = null;
    const next = this.active === 0 ? 1 : 0;
    const was = this.mood;
    this.mood = mood;
    // the hour turning in the same place: a long, slow crossing; a new place: the usual one
    const secs = crossing(was, mood);
    if (this.active >= 0) this.deck(this.active).fade(0, secs);
    const d = this.deck(next);
    d.load(trackOf(mood, this.base));
    d.fade(0, 0);
    if (!this.paused) d.play();
    d.fade(1, this.active >= 0 ? secs : 1);
    this.active = next;
  }

  /** Hidden app, goodbye screen: the music stops where it is and goes on from there. */
  setPaused(on: boolean): void {
    if (on === this.paused) return;
    this.paused = on;
    if (this.active < 0) return;
    const d = this.deck(this.active);
    if (on) d.pause();
    else d.play();
  }
}

/** A deck on an <audio> element streamed into the Web Audio graph (so the music volume applies to it). */
export function mediaDeck(ctx: AudioContext, out: AudioNode): Deck {
  const el = new Audio();
  el.loop = true;
  el.preload = 'auto';
  const gain = ctx.createGain();
  gain.gain.value = 0;
  ctx.createMediaElementSource(el).connect(gain).connect(out);
  let stopAt = 0;
  return {
    load(url) {
      el.src = url;
      el.currentTime = 0;
    },
    play() {
      void el.play().catch(() => undefined);
    },
    pause() {
      el.pause();
    },
    fade(to, secs) {
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      if (secs <= 0) gain.gain.setValueAtTime(to, t);
      else gain.gain.linearRampToValueAtTime(to, t + secs);
      // a silent deck stops playing (and decoding) once it has faded
      window.clearTimeout(stopAt);
      if (to === 0 && secs > 0) stopAt = window.setTimeout(() => el.pause(), secs * 1000 + 100);
    },
  };
}
