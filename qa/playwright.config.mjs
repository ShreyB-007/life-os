import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  outputDir: './report/artifacts',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [
    ['json', { outputFile: './report/results.json' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.PREVIEW_URL || 'http://localhost:4173',
    screenshot: 'on',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
