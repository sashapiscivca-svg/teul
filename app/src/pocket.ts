// What a buyer pays for a thing from the pocket: the first of its `buys` that fits (the item itself, one of its
// tags as `#tag`, or `*` for anything), a price of 0 meaning it does not take that. The same rule as the core's
// `buy_price`, so the pocket can show the prices before anything is sold.

export function buyPrice(buys: readonly [string, number][], item: string, tags: readonly string[]): number | null {
  const hit = buys.find(([k]) => k === '*' || k === item || (k.startsWith('#') && tags.includes(k.slice(1))));
  return hit && hit[1] > 0 ? hit[1] : null;
}

/** The core's share of the catalogue price a thing of the home fetches second-hand (`SELL_BACK_PERCENT`). */
export const SELL_BACK_PERCENT = 40;

/** The coins a thing cost in the catalogue: all of an `all`, the least of an `any`, 0 for what is not coins. */
export function coinPrice(acquire: unknown): number {
  if (!acquire || typeof acquire !== 'object') return 0;
  const a = acquire as { coins?: number; all?: unknown[]; any?: unknown[] };
  if (typeof a.coins === 'number') return a.coins;
  if (Array.isArray(a.all)) return a.all.reduce<number>((s, x) => s + coinPrice(x), 0);
  if (Array.isArray(a.any)) return a.any.length ? Math.min(...a.any.map(coinPrice)) : 0;
  return 0;
}

/** What a thing of the home sells for second-hand, or null when nobody buys it (free, a key, carried, clothes). */
export function sellBackPrice(def: { acquire: unknown; key?: boolean; carry?: boolean; wear?: unknown } | undefined): number | null {
  if (!def || def.key || def.carry || def.wear) return null;
  const coins = Math.floor((coinPrice(def.acquire) * SELL_BACK_PERCENT) / 100);
  return coins > 0 ? coins : null;
}
