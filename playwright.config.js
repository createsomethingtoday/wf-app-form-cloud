import { defineConfig, devices } from '@playwright/test';

function normalizeBaseURL(value) {
  const baseURL = value || 'http://localhost:3000';
  return baseURL.endsWith('/') ? baseURL : `${baseURL}/`;
}

/**
 * Playwright config for the marketplace submission form.
 *
 * BASE_URL selects target:
 *   - unset or http://localhost:3000 → local dev (npm run dev)
 *   - https://webflow-app-form.webflow.io/app-form → production smoke
 *   - a staging URL once staging exists
 *
 * Test files live under tests/e2e/. Tests default to smoke only — they do
 * NOT submit to the production webhook. Full submit tests are gated behind
 * the E2E_ALLOW_SUBMIT=1 env var and should only be run against a staging
 * or local environment.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60 * 1000,
  expect: { timeout: 10 * 1000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: normalizeBaseURL(process.env.BASE_URL),
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
