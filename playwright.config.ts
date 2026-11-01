import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  testMatch: ['projects.spec.ts', 'studio.spec.ts'],
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
  webServer: {
    command: 'pnpm dev',
    url: 'http://127.0.0.1:5173/api/project',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
});
