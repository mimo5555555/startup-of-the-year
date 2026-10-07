import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const p = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@lw/core': p('./packages/core/src/index.ts'),
      '@lw/content': p('./packages/content/src/index.ts'),
      '@lw/engine': p('./packages/engine/src/index.ts'),
      '@lw/game': p('./packages/game/src/index.ts'),
      '@lw/world': p('./packages/world/src/index.ts'),
    },
  },
  test: {
    include: ['packages/*/test/**/*.test.ts', 'apps/*/test/**/*.test.ts'],
    environment: 'node',
  },
});
