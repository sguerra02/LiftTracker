import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure'
  },
  projects: [
    // Full Chromium (not the headless shell) so notifications and service workers behave like a real phone browser.
    { name: 'phone', use: { ...devices['Pixel 7'], channel: 'chromium' } }
  ],
  webServer: {
    command: 'node tests/server.mjs',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI
  }
});
