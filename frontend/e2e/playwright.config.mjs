import { defineConfig } from '@playwright/test';
import process from 'node:process';

if (!process.env.REBOOK_SMOKE_ORIGIN || !process.env.REBOOK_SMOKE_API_URL) {
  throw new Error('Use npm run test:smoke to create isolated servers and data.');
}

export default defineConfig({
  testDir: '.', testMatch: 'journey.spec.mjs',
  fullyParallel: false, workers: 1, retries: 0,
  timeout: 45000, globalTimeout: 240000,
  expect: { timeout: 10000 },
  outputDir: '../test-results/smoke', reporter: 'list',
  use: {
    baseURL: process.env.REBOOK_SMOKE_ORIGIN,
    browserName: 'chromium', trace: 'retain-on-failure', screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
