import type { Locator, Page } from '@playwright/test';
import fs from 'fs';
const { TWITTER_EMAIL, TWITTER_USERNAME, TWITTER_PASSWORD } = process.env;
export class Overlay {
  public readonly root: Locator;
  public readonly profile: Locator;

  constructor(public readonly page: Page) {}

  async goto(username) {
    await this.page.goto(`https://twitter.com/${username}`);
    // await page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(5000);
  }

  async loginRequired(tipsReciever, context, artifactsPath, cookiesPath) {
    const isSigningIn = await this.page.isVisible('//*[@id="layers"]//input');
    if (isSigningIn) {
      const emailInput = await this.page.locator('//*[@id="layers"]//input');
      await emailInput.type(TWITTER_EMAIL);
      await this.page.getByRole('button', { name: 'Next' }).click();

      // unusual activity popup
      const extraInput = await this.page.locator('input[name=text]');
      if (extraInput) {
        await extraInput.type(TWITTER_USERNAME);
        await this.page.getByRole('button', { name: 'Next' }).click();
      }

      await this.page.locator('input[name=password]').type(TWITTER_PASSWORD);
      await this.page.getByRole('button', { name: 'Log in' }).click();

      // ToDo: sometimes 2FA popup appears
      // if (await page.getByText('Check your email').isVisible()) {
      //   await page.pause();
      // }

      await this.page.waitForTimeout(5000);
      await this.page.locator(`span:has-text("${tipsReciever.bio}")`); // ToDo: remove hardcoded values

      // save cookies to reuse later
      const cookies = await context.cookies();
      const cookieJson = JSON.stringify(cookies);
      fs.mkdirSync(artifactsPath, { recursive: true });
      fs.writeFileSync(cookiesPath, cookieJson);
    }
  }

  async openOverlay() {
    await this.page.evaluate('window.dapplets.openPopup()');
    await this.page.getByText('Skip tutorial').click();
    await this.page.getByTestId('system-tab-dapplets').click();
  }
  async addDevRegistry() {
    await this.page.getByTestId('system-tab-settings').click();
    await this.page.getByTestId('settings-page-developer').click();
    await this.page.getByRole('button', { name: 'Disabled' }).nth(2).click();
    await this.page.getByText('tipping-near-dapplet');
  }

  async activateDapplet() {
    await this.page.getByTestId('system-tab-dapplets').click();
    await this.page.getByTestId('tipping-near-dapplet').getByTestId('activation-dapplet').click();
  }

  async closeOverlay() {
    await this.page.getByTestId('system-tab-dapplets').click();
    await this.page.waitForEvent(
      'console',
      (msg) => msg.text().includes('tipping-near-dapplet') && msg.text().includes('is loaded'),
    );
  }

  async runDapplet (tipsReciever,context,artifactsPath,cookiesPath){
    await this.goto(tipsReciever.username);
    // log in if required
    await this.loginRequired(tipsReciever, context, artifactsPath, cookiesPath);
  
    // open overlay
    await this.openOverlay();
  
    // add dev registry
    await this.addDevRegistry();
  
    // activate dapplet
    await this.activateDapplet();
  
    // close overlay
    await this.closeOverlay();
  }
}
