import { defineConfig } from '@playwright/test';

const port = Number(process.env.PW_PORT ?? 4321);
const baseURL = `http://127.0.0.1:${port}`;

// A second preview server for the SHOW_DRAFTS build (dist-drafts), so
// analytics.spec.ts can exercise reel_open/affiliate_click on draft content
// that the production build never generates pages for. Exported so the spec
// can build an absolute URL against it.
export const draftsPort = Number(process.env.PW_DRAFTS_PORT ?? 4323);
export const draftsBaseURL = `http://127.0.0.1:${draftsPort}`;

export default defineConfig({
  testDir: './tests',
  testIgnore: ['**/unit/**'],
  fullyParallel: true,
  workers: 4,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: `pnpm preview --port ${port} --host 127.0.0.1`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `SHOW_DRAFTS=1 pnpm build && SHOW_DRAFTS=1 astro preview --port ${draftsPort} --host 127.0.0.1`,
      url: draftsBaseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: 'mobile-375',
      use: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true },
    },
    {
      name: 'tablet-768',
      use: { viewport: { width: 768, height: 1024 }, hasTouch: true },
    },
    {
      name: 'desktop-1440',
      use: { viewport: { width: 1440, height: 900 } },
    },
  ],
});
