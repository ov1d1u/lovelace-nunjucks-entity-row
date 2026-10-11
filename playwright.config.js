import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/frontend',
  use: { baseURL: 'http://127.0.0.1:4173', headless: true },
  webServer: { command: 'npm run build && node tests/frontend/server.mjs', port: 4173 },
});
