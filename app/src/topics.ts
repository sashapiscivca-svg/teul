// What the town talks about these days, besides the weather: the celebration being got ready for (or just held),
// and the nuclear plant beyond the fields — some for it, some against, some just curious, each person always the
// same way, and what they say follows the story as it goes.

import { has, t } from './i18n';
import type { FestivalView, NppView } from './types';

/** For (1), against (-1), not sure (0): by the person's id, as the core decides it (npp.rs `npp_opinion`). */
export function nppOpinion(id: string): -1 | 0 | 1 {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193) >>> 0;
  const k = h % 5;
  return k <= 1 ? 1 : k <= 3 ? -1 : 0;
}

type NppGroup = 'rumour' | 'talk' | 'building' | 'rising' | 'running';

function nppGroup(id: string): NppGroup {
  if (id === 'rumour') return 'rumour';
  if (['announced', 'hearing', 'debate', 'protest'].includes(id)) return 'talk';
  if (['approved', 'site', 'workers', 'cranes'].includes(id)) return 'building';
  if (id === 'launch') return 'running';
  return 'rising';
}

/** A few lines of what is on people's minds today (none if nothing is). */
export function townTopics(id: string, festival: FestivalView | null, npp: NppView | null): string[] {
  const out: string[] = [];
  if (festival) {
    const prep = `topics.prep.${festival.id}`;
    if (festival.phase === 'prep') out.push(...(has(prep) ? t(prep).split('\n') : []), t('topics.getReady', { name: festival.name }));
    else if (festival.phase === 'day') out.push(t('topics.happy', { name: festival.name }), t('topics.toSquare'));
    else out.push(...t('topics.after').split('\n'));
  }
  if (npp) {
    out.push(...t(`topics.npp.${nppGroup(npp.id)}.${nppOpinion(id)}`).split('\n'));
  }
  return out;
}
