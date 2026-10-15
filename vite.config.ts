import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  test: { include: ['src/**/*.test.{ts,tsx}'] },
  plugins: [tailwindcss()],
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname.replace(/^\/(\w:)/, '$1') } },
  server: { host: '127.0.0.1', watch: { ignored: ['**/.implementation-backups/**', '**/.implementation-worktrees/**', '**/test-results/**', '**/docs/design-review/screenshots/**', '**/*-results.txt', '**/debug-browser.txt'] } },
  worker: { format: 'es' },
  optimizeDeps: { entries: ['index.html', 'browser-tests/*-harness.tsx'], exclude: ['cubing'] },
});
