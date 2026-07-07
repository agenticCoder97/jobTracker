import { defineConfig, devices } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const isCI = !!process.env.CI;
const localPort = 3000;
const supabasePort = 3001;
const envPath = resolve(process.cwd(), '.env.local');

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim());
    if (!match) continue;
    const [, key, rawValue] = match;
    if (!key || rawValue === undefined || process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
}

const supabaseEnabled =
  process.env.NEXT_PUBLIC_PERSISTENCE_ADAPTER === 'supabase' &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabaseOnly = process.env.NEXT_PUBLIC_PERSISTENCE_ADAPTER === 'supabase';

const localWebServer = {
  command: `NEXT_PUBLIC_PERSISTENCE_ADAPTER=local PORT=${localPort} corepack pnpm dev`,
  url: `http://localhost:${localPort}`,
  reuseExistingServer: !isCI,
  timeout: 120_000,
};

const supabaseWebServer = {
  command: `NEXT_PUBLIC_PERSISTENCE_ADAPTER=supabase PORT=${supabasePort} corepack pnpm dev`,
  url: `http://localhost:${supabasePort}`,
  reuseExistingServer: !isCI,
  timeout: 120_000,
};

const webServer = [
  ...(supabaseOnly ? [] : [localWebServer]),
  ...(supabaseEnabled ? [supabaseWebServer] : []),
];

const localProject = {
  name: 'chromium',
  testIgnore: /(persistence|research-live)\.spec\.ts/,
  use: { ...devices['Desktop Chrome'] },
};

const supabaseProject = {
  name: 'chromium-supabase',
  testMatch: /(persistence|research-live)\.spec\.ts/,
  use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${supabasePort}` },
};

const projects = [
  ...(supabaseOnly ? [] : [localProject]),
  {
    ...supabaseProject,
    ...(supabaseEnabled ? {} : { testIgnore: /.*/ }),
  },
];

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: !supabaseOnly,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  ...(supabaseOnly ? { workers: 1 } : isCI ? { workers: 2 } : {}),
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${localPort}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects,
  webServer,
});
