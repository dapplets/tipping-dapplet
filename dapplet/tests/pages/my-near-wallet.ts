import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../fixtures/fixtures';
import fs from 'fs';
const { TWITTER_EMAIL, TWITTER_USERNAME, TWITTER_PASSWORD, SECRET_PHRASE } = process.env;
export class MyNearWallet {
  public readonly root: Locator;
  public readonly profile: Locator;

  constructor(public readonly page: Page) {}

  async openNearPageForTip(context) {
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      this.page.getByTestId('wallet-to-connect-near_mainnet').click(),
    ]);
    await newPage.waitForLoadState();
    await expect(newPage).toHaveURL('https://app.mynearwallet.com/');
    await newPage.getByRole('button', { name: 'Import Existing Account' }).click(), await newPage.waitForLoadState();
    await expect(newPage).toHaveURL('https://app.mynearwallet.com/recover-account');
    await newPage.getByRole('button', { name: 'Recover Account' }).first().click();
    await newPage.waitForLoadState();
    await expect(newPage).toHaveURL('https://app.mynearwallet.com/recover-seed-phrase');
    await newPage.locator('input').type(SECRET_PHRASE);
    await newPage.getByRole('button', { name: 'Find My Account' }).click();
    await newPage.getByRole('button', { name: 'Next' }).click();
    const [newPage2] = await Promise.all([
      context.waitForEvent('page'),
      await newPage.getByRole('button', { name: 'Connect' }).click(),
      await this.page.waitForTimeout(5000),
    ]);
    await newPage2.getByRole('button', { name: 'Next' }).click();

    const [newPage3] = await Promise.all([
      context.waitForEvent('page'),
      await newPage2.getByRole('button', { name: 'Connect' }).click(),
      await newPage2.waitForTimeout(5000),
    ]);
    await newPage3.getByRole('button', { name: 'Approve' }).click();
    await newPage3.waitForTimeout(5000);
  }

  async openNearPageDefault(context) {
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      this.page.getByTestId('wallet-to-connect-near_mainnet').click(),
    ]);
    await newPage.waitForLoadState();

    await expect(newPage).toHaveURL('https://app.mynearwallet.com/');
    await newPage.getByRole('button', { name: 'Import Existing Account' }).click(), await newPage.waitForLoadState();
    await expect(newPage).toHaveURL('https://app.mynearwallet.com/recover-account');
    await newPage.getByRole('button', { name: 'Recover Account' }).first().click();
    await newPage.waitForLoadState();
    await expect(newPage).toHaveURL('https://app.mynearwallet.com/recover-seed-phrase');
    await newPage.locator('input').type(SECRET_PHRASE);
    await newPage.getByRole('button', { name: 'Find My Account' }).click();
    await newPage.getByRole('button', { name: 'Next' }).click();

    const [newPage2] = await Promise.all([
      context.waitForEvent('page'),
      await newPage.getByRole('button', { name: 'Connect' }).click(),
      await this.page.waitForTimeout(5000),
    ]);
    await newPage2.getByRole('button', { name: 'Next' }).click();
    await newPage2.getByRole('button', { name: 'Connect' }).click(), await newPage2.waitForTimeout(5000);
  }
  async y() {
    console.log('');
  }
}
