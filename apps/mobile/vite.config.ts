import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';

const p = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

// `--mode artifact` inlines everything into one HTML file (for the shareable sample).
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'artifact' ? [viteSingleFile()] : [])],
  resolve: {
    alias: {
      '@lw/core': p('../../packages/core/src/index.ts'),
      '@lw/content': p('../../packages/content/src/index.ts'),
      '@lw/engine': p('../../packages/engine/src/index.ts'),
      '@lw/game': p('../../packages/game/src/index.ts'),
      '@lw/world': p('../../packages/world/src/index.ts'),
    },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
    outDir: mode === 'artifact' ? 'dist-artifact' : 'dist',
  },
  server: { port: 5173 },
}));
