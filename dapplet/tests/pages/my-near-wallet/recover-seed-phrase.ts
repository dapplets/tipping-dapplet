import { Page } from '@playwright/test';
import { Login } from './login';

export class RecoverSeedPhrase {
  public readonly url = 'https://app.mynearwallet.com/recover-seed-phrase';

  constructor(public readonly page: Page) {}

  async typeSecretPhrase(phrase: string): Promise<void> {
    await this.page.locator('input').type(phrase);
  }

  async clickFindMyAccount(): Promise<void> {
    await this.page.getByRole('button', { name: 'Find My Account' }).click();
  }

  async performRecovery(phrase: string): Promise<Login> {
    await this.typeSecretPhrase(phrase);
    await this.clickFindMyAccount();
    await this.page.waitForURL(/https:\/\/app.mynearwallet.com\/login/);
    return new Login(this.page);
  }
}
