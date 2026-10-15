import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  base: './',
  build: { target: 'es2022' },
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __BUILD_ID__: JSON.stringify(`${pkg.version}+${new Date().toISOString().slice(0, 16)}`) },
  server: { fs: { allow: ['..'] } },
  // Under load a heavy test (the whole engine, every language) can outrun the default 5 s.
  test: { environment: 'node', include: ['test/**/*.test.ts'], testTimeout: 60000 },
});
