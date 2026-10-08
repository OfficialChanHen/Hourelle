import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Unit tests for the pure logic in src/lib: no browser, no database. The lib modules
// read localStorage and window events, so a small in-memory stand-in is installed
// before each file (test/setup.ts). No .env file is read, so the backend stays off.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
    env: { TZ: 'America/Chicago' },
  },
})
