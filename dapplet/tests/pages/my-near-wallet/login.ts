import { Page } from "@playwright/test";

export class Login {
  constructor(public readonly page: Page) {}

  async clickNext(): Promise<void> {
    await this.page.getByRole('button', { name: 'Next' }).click();
  }

  async clickConnect(): Promise<void> {
    await this.page.getByRole('button', { name: 'Connect' }).click();
    await this.page.waitForEvent('close');
  }
}
