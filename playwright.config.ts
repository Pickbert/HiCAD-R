import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const port = Number(process.env.E2E_PORT ?? 3100);
const dataDir = process.env.HICAD_E2E_DATA_DIR ?? join(tmpdir(), `hicad-playwright-${process.pid}`);
const baseURL = `http://127.0.0.1:${port}`;
const noProxyHosts = Array.from(new Set([...(process.env.NO_PROXY ?? process.env.no_proxy ?? '').split(',').filter(Boolean), '127.0.0.1', 'localhost', '::1'])).join(',');
process.env.NO_PROXY = noProxyHosts;
process.env.no_proxy = noProxyHosts;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 15_000
  },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: `PORT=${port} DATA_DIR=${JSON.stringify(dataDir)} NODE_ENV=test DEV_ACTIVATION_CODE=e2e-code HICAD_FORCE_BUILD=0 ./start.sh`,
    url: `${baseURL}/api/health`,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
