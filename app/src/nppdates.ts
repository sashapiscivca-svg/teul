// The plant's story by the calendar alone, for the screens drawn before the world is open (the title's town on
// its horizon): the same days as the core's npp.rs (checked against it in test/engine.test.ts).

import type { PlantOnHorizon } from './pixel/plant';

/** (stage id, year, month, day) — npp.rs STAGES. */
const STAGES: [string, number, number, number][] = [
  ['rumour', 2026, 10, 5], ['announced', 2026, 10, 26], ['hearing', 2026, 11, 14], ['debate', 2026, 11, 15], ['protest', 2026, 12, 5],
  ['approved', 2027, 1, 20], ['site', 2027, 3, 1], ['workers', 2027, 4, 12], ['cranes', 2027, 6, 1], ['towers', 2027, 10, 1],
  ['dome', 2029, 6, 1], ['launch', 2031, 9, 1],
];

const dayOf = (y: number, m: number, d: number) => Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);

/** The plant on a calendar date (days since 1970-01-01): its step and how far it is built; null before. */
export function plantOn(day: number): (PlantOnHorizon & { id: string }) | null {
  let k = -1;
  for (let i = 0; i < STAGES.length; i++) if (dayOf(STAGES[i][1], STAGES[i][2], STAGES[i][3]) <= day) k = i;
  if (k < 0) return null;
  const site = dayOf(2027, 3, 1);
  const launch = dayOf(2031, 9, 1);
  const built = day < site ? 0 : day >= launch ? 1000 : Math.floor(((day - site) * 1000) / (launch - site));
  return { stage: k, id: STAGES[k][0], built };
}

/** Minutes the test clock is moved ahead by (never in a release build: see main.ts). */
let ahead = 0;
export function setPlantClock(minutes: number): void {
  ahead = minutes;
}

/** Today's (by this device's calendar). */
export function plantToday(now = new Date(Date.now() + ahead * 60_000)): (PlantOnHorizon & { id: string }) | null {
  return plantOn(dayOf(now.getFullYear(), now.getMonth() + 1, now.getDate()));
}
