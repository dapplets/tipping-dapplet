import { Page } from '@playwright/test';

export class Sign {
  constructor(public readonly page: Page) {}

  async clickApprove(): Promise<void> {
    const modal = await this.page.getByText('Close');
    if (modal) {
      modal.click();
    }
    const enterPassword = await this.page.getByPlaceholder('Enter password');
    if (enterPassword) {
      enterPassword.type(process.env.NEAR_PASSWORD);
      await this.page.getByText('Unlock Wallet').last().click();
    }
    await this.page.getByRole('button', { name: 'Approve' }).click();
    await this.page.waitForEvent('close');
  }
}
