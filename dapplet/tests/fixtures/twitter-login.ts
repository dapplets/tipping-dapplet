import { test as base, DappletExecutor } from '@dapplets/dapplet-playwright';
import fs from 'fs';
import path from 'path';

const artifactsPath = path.join(__dirname, '..', 'artifacts');
const cookiesPath = path.join(artifactsPath, 'cookies.json');

const tipsReciever = {
  username: 'alsakhaev',
  bio: 'Web3 Developer at Dapplets',
};

export type TwitterLoginOptions = {
  twitterPassword: string;
  twitterEmail: string;
  twitterUsername: string;
};

type ExtendParams = Parameters<typeof base.extend<TwitterLoginOptions>>;

export const fixture: ExtendParams[0] = {
  twitterPassword: [null, { option: true }],
  twitterEmail: [null, { option: true }],
  twitterUsername: [null, { option: true }],

  page: async ({ context, twitterPassword, twitterEmail, twitterUsername }, use) => {
    if (fs.existsSync(cookiesPath)) {
      const cookies = fs.readFileSync(cookiesPath, 'utf8');
      const deserializedCookies = JSON.parse(cookies);
      await context.addCookies(deserializedCookies);
    }

    const page = await context.newPage();

    await page.goto('https://twitter.com/alsakhaev');
    await page.waitForTimeout(5000); // ToDo: remove

    // ToDo: move to POM
    const isSigningIn = await page.isVisible('//*[@id="layers"]//input');
    if (isSigningIn) {
      const emailInput = await page.locator('//*[@id="layers"]//input');
      await emailInput.type(twitterEmail);
      await page.getByRole('button', { name: 'Next' }).click();

      // unusual activity popup
      const extraInput = await page.locator('input[name=text]');
      if (extraInput) {
        await extraInput.type(twitterUsername);
        await page.getByRole('button', { name: 'Next' }).click();
      }

      await page.locator('input[name=password]').type(twitterPassword);
      await page.getByRole('button', { name: 'Log in' }).click();

      // ToDo: sometimes 2FA popup appears
      // if (await page.getByText('Check your email').isVisible()) {
      //   await page.pause();
      // }

      await page.waitForTimeout(5000);
      await page.locator(`span:has-text("${tipsReciever.bio}")`); // ToDo: remove hardcoded values

      // save cookies to reuse later
      const cookies = await context.cookies();
      const cookieJson = JSON.stringify(cookies);
      fs.mkdirSync(artifactsPath, { recursive: true });
      fs.writeFileSync(cookiesPath, cookieJson);
    }

    await use(page);
  },
};

export const test = base.extend<TwitterLoginOptions>(fixture).extend(DappletExecutor.fixture);

export const expect = test.expect;
