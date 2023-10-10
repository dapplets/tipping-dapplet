import { Page } from '@playwright/test';
import { RecoverSeedPhrase } from './recover-seed-phrase';

export class RecoverAccount {
  constructor(public readonly page: Page) {}

  async clickRecoverAccount(): Promise<RecoverSeedPhrase> {
    await this.page.getByRole('button', { name: 'Recover Account' }).first().click();
    await this.page.waitForURL('https://app.mynearwallet.com/recover-seed-phrase');
    return new RecoverSeedPhrase(this.page);
  }
}
