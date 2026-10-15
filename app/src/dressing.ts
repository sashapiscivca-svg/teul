// What the town's people put on for the weather when they are out, by the air of the day: down coats, sheepskins,
// felt boots, fur hats and mittens in a frost; coats and scarves when it is cold; trenches and jumpers in the
// chill of spring and autumn; windbreakers when it is cool; their own clothes on a mild day; t-shirts, sundresses,
// shorts, sandals and panamas in the heat; a raincoat or an umbrella in the rain. Indoors (and in uniform) they
// stay as they are. Who wears what is decided by their own seed, so a person keeps to their own way of dressing.

export interface WeatherNow {
  season: string;
  sky: string;
  outdoors: boolean;
  /** The air out of doors, tenths of a degree (when known; else the season's usual). */
  air?: number;
}

const COATS = ['#2f3a5a', '#8a5a2e', '#3a3a44', '#c9a050', '#5a3a28', '#3f7f4a'];
const PUFFERS = ['#d9534f', '#2e2a36', '#a888d0', '#4a8fd0', '#3f7f4a', '#e8a23a'];
const RAINCOATS = ['#f4d35e', '#d9534f', '#4a8fd0', '#5aa469'];
const WOOL = ['#d9534f', '#4a8fd0', '#e8a23a', '#8a63c9', '#e8e0c8', '#5aa469'];
const LIGHT = ['#7ac9a8', '#f4d35e', '#c9a878', '#2f3a5a', '#d86aa0', '#e8e0c8'];
const SUMMER = ['#e8e0c8', '#f4d35e', '#5aa469', '#4a8fd0', '#d86aa0', '#7ac9a8'];

const USUAL: Record<string, number> = { Winter: -30, Spring: 110, Summer: 220, Autumn: 90 };

/** How someone meets the rain: under an umbrella (most grown-ups), in a raincoat (the children, some others), or
 * running for cover as they are. */
export function rainWay(seed: number, age: string): 'umbrella' | 'raincoat' | 'run' {
  if (age === 'child') return seed % 3 === 0 ? 'run' : 'raincoat';
  const k = Math.abs(seed) % 20;
  return k < 12 ? 'umbrella' : k < 16 ? 'raincoat' : 'run';
}

/** The look keys to set over a person's own for the weather (empty when nothing changes). */
export function dressForWeather(w: WeatherNow, seed: number, age: string, uniform: boolean, gender = ''): Record<string, string> {
  if (!w.outdoors || uniform) return {};
  const pick = <T,>(list: T[], salt: number) => list[Math.abs(seed * 7 + salt * 13) % list.length];
  const air = w.air ?? USUAL[w.season] ?? 150;
  const wet = w.sky === 'rain' || w.sky === 'storm';
  const child = age === 'child';
  const elder = age === 'elder';
  if (wet) {
    // the rain: most open an umbrella, some put on a raincoat and rubber boots, the rest run for cover as they are
    const way = rainWay(seed, age);
    if (way === 'umbrella') return { 'look.acc': '12', 'look.acc_color': pick(RAINCOATS, 6), 'look.shoe': '1', 'look.shoes_color': '#3a3a44' };
    if (way === 'raincoat') return { 'look.top': '10', 'look.top_color': child ? '#f4d35e' : pick(RAINCOATS, 1), 'look.top2_color': '#2f3a5a', 'look.shoe': '1', 'look.shoes_color': child ? '#d9534f' : '#3a3a44' };
  }
  if (air < -50) {
    // a hard frost: a sheepskin or a down coat, felt boots, a fur hat or a beanie, mittens
    const sheep = elder && seed % 2 === 0;
    return {
      'look.top': sheep ? '12' : '11',
      'look.top_color': sheep ? '#8a5a2e' : pick(PUFFERS, 2),
      'look.top2_color': '#f2ead8',
      'look.bottom': '0',
      'look.shoe': elder || child || seed % 3 === 0 ? '3' : '1',
      'look.shoes_color': elder || seed % 3 === 0 ? '#8a8a96' : '#3a2a20',
      'look.acc': elder || seed % 4 === 0 ? '14' : '8',
      'look.acc_color': elder ? '#5a3a28' : pick(WOOL, 4),
      'look.mitt': '1',
      'look.mitt_color': pick(WOOL, 7),
    };
  }
  if (air < 20 || w.sky === 'snow') {
    // cold: a coat (the young in down coats), boots, a beanie or a scarf, mittens for many
    const puffer = (child || seed % 3 === 1) && !elder;
    const out: Record<string, string> = { 'look.top': puffer ? '11' : '9', 'look.top_color': puffer ? pick(PUFFERS, 2) : pick(COATS, 2), 'look.top2_color': '#e8e0c8', 'look.shoe': '1', 'look.shoes_color': '#3a2a20' };
    if (seed % 3 === 0) Object.assign(out, { 'look.acc': '2', 'look.acc_color': pick(WOOL, 3) });
    else Object.assign(out, { 'look.acc': '8', 'look.acc_color': pick(WOOL, 4) });
    if (child || seed % 2 === 0) Object.assign(out, { 'look.mitt': '1', 'look.mitt_color': pick(WOOL, 5) });
    return out;
  }
  if (air < 100) {
    // chilly: a trench or a coat, or a warm jumper with a scarf
    const kind = seed % 3;
    if (kind === 0) return { 'look.top': '13', 'look.top_color': pick(['#c9a878', '#2f3a5a', '#5a3a28'], 2), 'look.top2_color': '#c9a050', 'look.shoe': '1', 'look.shoes_color': '#5a3a28' };
    if (kind === 1) return { 'look.top': '7', 'look.top_color': pick(WOOL, 2), 'look.top2_color': '#e8e0c8', 'look.acc': '2', 'look.acc_color': pick(WOOL, 5) };
    return { 'look.top': '9', 'look.top_color': pick(COATS, 2), 'look.top2_color': '#e8e0c8', 'look.shoe': '1', 'look.shoes_color': '#3a2a20' };
  }
  if (air < 170) {
    // cool: a windbreaker or a light jacket for some, the rest as they are
    if (seed % 3 === 2) return {};
    return { 'look.top': seed % 3 === 0 ? '14' : '8', 'look.top_color': pick(LIGHT, 3), 'look.top2_color': '#e8e0c8' };
  }
  if (air < 250) return {};
  // the heat: light clothes, sandals, a panama or a straw hat, dark glasses
  const out: Record<string, string> = { 'look.shoe': '2', 'look.shoes_color': pick(['#8a5a2e', '#4a8fd0', '#e8e0c8'], 4) };
  if (gender === 'f' && !child && seed % 2 === 0) Object.assign(out, { 'look.top': '15', 'look.top_color': pick(SUMMER, 2), 'look.top2_color': '#e8e0c8' });
  else Object.assign(out, { 'look.top': '0', 'look.top_color': pick(SUMMER, 2), 'look.top2_color': '#3a3a44', 'look.bottom': '1', 'look.bottom_color': pick(['#8a5a2e', '#4a8fd0', '#e8e0c8', '#3a3a44'], 3) });
  if (elder) Object.assign(out, { 'look.acc': '3', 'look.acc_color': '#d9534f' });
  else if (child || seed % 3 === 0) Object.assign(out, { 'look.acc': '13', 'look.acc_color': pick(SUMMER, 5) });
  else if (seed % 3 === 1) Object.assign(out, { 'look.acc': '11', 'look.acc_color': '#2a2438' });
  return out;
}
