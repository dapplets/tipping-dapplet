import { test as base } from './fixtures';
import { MainApp } from '../pages/my-near-wallet/main-app';
import { Login } from '../pages/my-near-wallet/login';
import { Sign } from '../pages/my-near-wallet/sign';

export type MyNearWalletOptions = {
  restoreAndConnectWallet(seedPhrase: string): Promise<void>;
  confirmNewSession(): Promise<void>;
  approveTransaction(): Promise<void>;
};

export const test = base.extend<MyNearWalletOptions>({
  restoreAndConnectWallet: async ({ context }, use) => {
    await use(async (seedPhrase: string) => {
      const page = await context.waitForEvent('page');
      const mainAppPage = new MainApp(page);
      const recoverAccountPage = await mainAppPage.clickImportExistingAccount();
      const recoverSeedPage = await recoverAccountPage.clickRecoverAccount();
      const loginPage = await recoverSeedPage.performRecovery(seedPhrase);
      await loginPage.clickNext();
      await loginPage.clickConnect();
    });
  },
  confirmNewSession: async ({ context }, use) => {
    await use(async () => {
      const page = await context.waitForEvent('page');
      const loginPage = new Login(page);
      await loginPage.clickNext();
      await loginPage.clickConnect();
    });
  },
  approveTransaction: async ({ context }, use) => {
    await use(async () => {
      const page = await context.waitForEvent('page');
      const signPage = new Sign(page);
      await signPage.clickApprove();
    });
  },
});

export const expect = test.expect;
