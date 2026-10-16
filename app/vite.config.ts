import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

// The build's identity is its version and the time of its source: SOURCE_DATE_EPOCH (the commit's time, set by the
// release scripts and by F-Droid's recipe) when given, so that two builds of one commit are the same byte for byte.
const sourceDate = process.env.SOURCE_DATE_EPOCH ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000) : new Date();

export default defineConfig({
  base: './',
  build: { target: 'es2022' },
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __BUILD_ID__: JSON.stringify(`${pkg.version}+${sourceDate.toISOString().slice(0, 16)}`) },
  server: { fs: { allow: ['..'] } },
  // Under load a heavy test (the whole engine, every language) can outrun the default 5 s.
  test: { environment: 'node', include: ['test/**/*.test.ts'], testTimeout: 60000 },
});
