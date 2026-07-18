import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);
const protectionHeaders: Record<string, string> | undefined = process.env
  .VERCEL_AUTOMATION_BYPASS_SECRET
  ? {
      'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
      'x-vercel-set-bypass-cookie': 'true',
    }
  : process.env.VERCEL_OIDC_TOKEN
    ? { 'x-vercel-trusted-oidc-idp-token': process.env.VERCEL_OIDC_TOKEN }
    : undefined;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // Phaser movement is intentionally real-time; keeping local concurrency modest
  // avoids starving WebGL/tween frames while still parallelizing the short views.
  workers: isCI ? 1 : 2,
  timeout: 120_000,
  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      animations: 'disabled',
      // Self-hosted fonts rasterize with different edge antialiasing on macOS
      // and Linux. Keep the structural diff budget strict while tolerating
      // small per-pixel color differences between those renderers.
      threshold: 0.35,
      maxDiffPixelRatio: 0.035,
    },
  },
  reporter: isCI
    ? [['line'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  outputDir: 'test-results',
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8080',
    colorScheme: 'dark',
    locale: 'en-US',
    contextOptions: { reducedMotion: 'reduce' },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    extraHTTPHeaders: protectionHeaders,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } },
    },
    {
      name: 'chromium-wide',
      grep: /@visual/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'firefox',
      grep: /@cross-browser/,
      use: { ...devices['Desktop Firefox'], viewport: { width: 1024, height: 768 } },
    },
    {
      name: 'webkit',
      grep: /@cross-browser/,
      use: { ...devices['Desktop Safari'], viewport: { width: 1024, height: 768 } },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: isCI ? 'npm run start:e2e' : 'npm run dev:e2e',
        url: 'http://localhost:8080',
        reuseExistingServer: !isCI,
        timeout: 180_000,
      },
});
