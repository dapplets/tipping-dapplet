import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import { BrowserOptions, DappletExecutor, RegistryTypes } from '@dapplets/dapplet-playwright';

dotenv.config();

const { GIT_BRANCH_NAME, CI } = process.env;

export default defineConfig<BrowserOptions & DappletExecutor.DappletExecutorOptions>({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!CI,
  retries: CI ? 2 : 0,
  workers: CI ? 1 : 1,
  reporter: 'line',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        newHeadless: CI ? true : false,
        extensionVersion: 'v0.61.0-alpha.4',
        registry: ['main', 'master'].includes(GIT_BRANCH_NAME) ? RegistryTypes.Prod : RegistryTypes.Test,
        devServerUrl: 'http://localhost:3001/dapplet.json',
        dappletName: 'tipping-near-dapplet',
      },
    },
  ],
  webServer: {
    command: 'npm run start',
    port: 3001,
    reuseExistingServer: !CI,
  },
});
