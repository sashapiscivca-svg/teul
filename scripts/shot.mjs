#!/usr/bin/env node
// Screenshot of a page in headless Firefox.
// Usage: node scripts/shot.mjs --url URL --out file.png [--w 844] [--h 390] [--wait 1500] [--eval "js"] [--then-wait 500]
import { withFirefox } from './bidi.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
if (!args.url || !args.out) {
  console.error('need --url and --out');
  process.exit(2);
}
await withFirefox(
  async (page) => {
    await page.goto(args.url);
    await page.sleep(Number(args.wait ?? 1500));
    if (args.eval) {
      const value = await page.eval(args.eval);
      if (value !== undefined) console.log(`[eval] ${typeof value === 'string' ? value : JSON.stringify(value)}`);
      await page.sleep(Number(args['then-wait'] ?? 500));
    }
    await page.shot(args.out);
    console.log(`saved ${args.out}`);
    for (const e of page.errors()) console.log(`[${e.level}] ${e.text}`);
  },
  { width: Number(args.w ?? 844), height: Number(args.h ?? 390) },
);
