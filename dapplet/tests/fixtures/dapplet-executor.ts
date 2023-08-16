import { test as base } from '@dapplets/dapplet-playwright';

export type DappletExecutorOptions = {
  registryUrl: string;
  dappletName: string;
  onboarding?: boolean;
};

type ExtendParams = Parameters<typeof base.extend<DappletExecutorOptions>>;

export const fixture: ExtendParams[0] = {
  registryUrl: ['http://localhost:3001/dapplet.json', { option: true }],
  dappletName: [null, { option: true }],
  onboarding: [false, { option: true }],
  page: async ({ page, skipOnboarding, enableDevServer, activateDapplet, registryUrl, dappletName }, use) => {
    await skipOnboarding();
    await enableDevServer(registryUrl);
    await activateDapplet(dappletName, registryUrl);
    await use(page);
  },
};

export const test = base.extend<DappletExecutorOptions>(fixture);

export const expect = test.expect;
