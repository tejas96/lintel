import { defineConfig, devices } from '@playwright/test';
import { apiEnvironment, E2E } from './support/environment';

/**
 * Browser journeys and accessibility checks against the built API and web app.
 * The API's start command first resets the end-to-end database (fresh
 * migrations and seeds), so every run starts from the same studio.
 *
 * Browsers: CI installs Playwright's Chromium (`playwright install --with-deps
 * chromium`). Locally the already-installed Chromium build of this Playwright
 * version is used, or Google Chrome with E2E_BROWSER_CHANNEL=chrome; this
 * suite never downloads a browser by itself.
 */
const channel = process.env.E2E_BROWSER_CHANNEL;

export default defineConfig({
  testDir: './tests',
  // The journeys share one seeded studio and change it, so they run in order.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: './test-results',
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never', outputFolder: './playwright-report' }]]
    : [['list'], ['html', { open: 'never', outputFolder: './playwright-report' }]],
  use: {
    baseURL: E2E.webUrl,
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...(channel ? { channel } : {}),
  },
  projects: [
    { name: 'sign-in sessions', testMatch: /sessions\.setup\.ts/ },
    {
      name: 'journeys',
      use: { ...devices['Desktop Chrome'], ...(channel ? { channel } : {}) },
      dependencies: ['sign-in sessions'],
    },
  ],
  webServer: [
    {
      command: 'node scripts/prepare-database.mjs && node ../api/dist/main.js',
      url: `${E2E.apiUrl}/v1/health`,
      env: apiEnvironment(),
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: `node scripts/ensure-web-build.mjs && pnpm --dir ../web exec next start --port ${E2E.webPort}`,
      url: `${E2E.webUrl}/sign-in`,
      env: { API_INTERNAL_URL: E2E.apiUrl, NEXT_TELEMETRY_DISABLED: '1' },
      reuseExistingServer: false,
      timeout: 600_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
