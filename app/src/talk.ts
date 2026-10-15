// What the townsfolk say over their heads: each their own line, out of who they are (their work, their age,
// their other half, a pram or a wheelchair), what they are doing, the hour, the weather and the season, their
// mood, and the news of the town. The same person says the same thing in the same moment (deterministic), two
// people rarely the same thing at once.

import { has, t } from './i18n';
import { idSeed, mix } from './village';

export interface TalkCtx {
  id: string;
  /** First name. */
  name: string;
  gender: string;
  age: string;
  young?: boolean;
  /** First name of their other half, if any. */
  partner?: string;
  role?: string;
  activity: string;
  /** morning, day, evening, night */
  part: string;
  /** clear, cloudy, rain, storm, snow, fog */
  weather: string;
  /** Spring, Summer, Autumn, Winter */
  season: string;
  mood: number;
  mobility?: string | null;
  pram?: boolean;
  news: string[];
  /** Lines that go with how they feel today (see feel.ts). */
  extra?: string[];
  /** What is on the town's mind these days (a celebration, the plant): see topics.ts. */
  topics?: string[];
}

/** The name a person goes by: the first name, or «отець Павло» (“Father Pavlo”) for the priest. */
export function firstName(full: string): string {
  const w = full.split(' ');
  return (w[0] === 'отець' || w[0] === 'Father') && w.length > 1 ? `${w[0]} ${w[1]}` : w[0];
}

/** The lines of a word-table entry (one line each, the same count in every language). */
function said(key: string): string[] {
  return has(key) ? t(key).split('\n') : [];
}

const WORK_ROLES = ['baker', 'factory_baker', 'miller', 'seller', 'vendor', 'waiter', 'bartender', 'librarian', 'teacher', 'doctor', 'nurse', 'officer', 'night_officer', 'firefighter', 'firefighter_night', 'farmer', 'harvester', 'sawyer', 'forester', 'priest', 'caretaker', 'groom', 'jockey', 'old_miner', 'tower_keeper', 'journalist', 'editor', 'photographer', 'radio_host', 'technician', 'mayor', 'clerk', 'florist', 'vet', 'vet_nurse', 'coach', 'craftsman', 'winemaker', 'vintner', 'weaver', 'cheesemaker', 'receptionist', 'driver', 'collector'];
const DOINGS = ['leisure', 'shop', 'eat', 'home', 'sick', 'injured', 'interview', 'patrol', 'firefight', 'school'];

function linesOf(c: TalkCtx): string[] {
  const out: string[] = [];
  const add = (xs: string[] | undefined, times = 1) => {
    for (let i = 0; i < times; i++) out.push(...(xs ?? []));
  };
  if (c.age === 'child') {
    add(said('talk.child'));
    add(c.season === 'Winter' ? said('talk.childWinter') : c.season === 'Summer' ? said('talk.childSummer') : []);
    return out;
  }
  add(said('talk.small'));
  if (c.activity === 'work' && c.role && WORK_ROLES.includes(c.role)) add(said(`talk.work.${c.role}`), 3);
  if (DOINGS.includes(c.activity)) add(said(`talk.doing.${c.activity}`), 2);
  add(said(`talk.part.${c.part}`));
  add(said(`talk.weather.${c.weather}`));
  add(said(`talk.season.${c.season}`));
  if (c.age === 'elder') add(said('talk.elder'));
  if (c.young) {
    add(said('talk.young'));
    if (c.part === 'evening' || c.part === 'night') add(said('talk.youngLate'), 2);
  }
  if (c.partner) add(t('talk.partner', { partner: c.partner }).split('\n'));
  if (c.pram) add(said('talk.pram'), 2);
  if (c.mobility === 'wheelchair') add(said('talk.wheelchair'));
  if (c.mobility === 'cane') add(said('talk.cane'));
  add(c.extra, 3);
  if (c.mood < -20) add(said('talk.moodLow'));
  else if (c.mood > 30) add(said('talk.moodHigh'));
  add(c.topics, 3);
  for (const n of c.news.slice(-3)) if (!n.includes(c.name)) out.push(t('talk.heard', { news: n }));
  return out;
}

/**
 * What someone says in a moment (`slot` changes every few seconds). `busy` are the lines being said around now:
 * someone else's line is not repeated if there is anything else to say.
 */
export function residentLine(c: TalkCtx, slot: number, busy: Set<string> = new Set()): string {
  const pool = linesOf(c);
  if (pool.length === 0) return t('talk.hello');
  const start = mix(idSeed(c.id), slot) % pool.length;
  for (let k = 0; k < pool.length; k++) {
    const line = pool[(start + k * 7) % pool.length];
    if (!busy.has(line)) return line;
  }
  return pool[start];
}

/** What someone says when the player taps them: their name, what they are, and a line of their own. */
export function residentIntro(c: TalkCtx, job: string, slot: number): string {
  const hello = t(`talk.hello.${c.part === 'morning' || c.part === 'evening' || c.part === 'night' ? c.part : 'day'}`);
  const who = c.age === 'child' ? t('talk.iAmChild', { name: c.name }) : t(job ? 'talk.iAmJob' : 'talk.iAm', { hello, name: c.name, job });
  return `${who} ${residentLine(c, slot)}`;
}
