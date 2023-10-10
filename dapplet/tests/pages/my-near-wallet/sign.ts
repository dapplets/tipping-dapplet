import { Page } from '@playwright/test';

export class Sign {
  constructor(public readonly page: Page) {}

  async clickApprove(): Promise<void> {
    await this.page.getByRole('button', { name: 'Approve' }).click();
    await this.page.waitForEvent('close');
  }
}
