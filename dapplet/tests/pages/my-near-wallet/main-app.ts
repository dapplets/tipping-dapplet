import { Page } from '@playwright/test';
import { RecoverAccount } from './recover-account';

export class MainApp {
  constructor(public readonly page: Page) {}

  async clickImportExistingAccount(): Promise<RecoverAccount> {
    await this.page.getByRole('button', { name: 'Import Existing Account' }).click();
    await this.page.waitForURL('https://app.mynearwallet.com/recover-account');
    return new RecoverAccount(this.page);
  }
}
