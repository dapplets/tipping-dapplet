import { test, expect } from './fixtures';
import fs from 'fs';
import path from 'path';

// login info
const { TWITTER_EMAIL, TWITTER_USERNAME, TWITTER_PASSWORD } = process.env;

const tipsReciever = {
  username: 'alsakhaev',
  bio: 'Web3 Developer at Dapplets',
};

const artifactsPath = path.join(__dirname, '..', 'artifacts');
const cookiesPath = path.join(artifactsPath, 'cookies.json');

test('Login in twitter', async ({ context }) => {
  // apply cookies if exist
  if (fs.existsSync(cookiesPath)) {
    const cookies = fs.readFileSync(cookiesPath, 'utf8');
    const deserializedCookies = JSON.parse(cookies);
    await context.addCookies(deserializedCookies);
  }

  const page = await context.newPage();
  await page.goto(`https://twitter.com/${tipsReciever.username}`);
  await page.waitForLoadState('networkidle');

  // log in if required
  const isSigningIn = await page.isVisible('//*[@id="layers"]//input');
  if (isSigningIn) {
    const emailInput = await page.locator('//*[@id="layers"]//input');
    await emailInput.type(TWITTER_EMAIL);
    await page.getByRole('button', { name: 'Next' }).click();

    // unusual activity popup
    const extraInput = await page.locator('input[name=text]');
    if (extraInput) {
      await extraInput.type(TWITTER_USERNAME);
      await page.getByRole('button', { name: 'Next' }).click();
    }

    await page.locator('input[name=password]').type(TWITTER_PASSWORD);
    await page.getByRole('button', { name: 'Log in' }).click();

    // ToDo: sometimes 2FA popup appears
    // if (await page.getByText('Check your email').isVisible()) {
    //   await page.pause();
    // }

    await page.waitForLoadState('networkidle');
    await page.locator(`span:has-text("${tipsReciever.bio}")`); // ToDo: remove hardcoded values

    // save cookies to reuse later
    const cookies = await context.cookies();
    const cookieJson = JSON.stringify(cookies);
    fs.mkdirSync(artifactsPath, { recursive: true });
    fs.writeFileSync(cookiesPath, cookieJson);
  }

  // open overlay
  await page.evaluate('window.dapplets.openPopup()');
  await page.getByText('Skip tutorial').click();
  await page.getByTestId('system-tab-dapplets').click();

  // add dev registry
  await page.getByTestId('system-tab-settings').click();
  await page.getByTestId('settings-page-developer').click();
  await page.getByRole('button', { name: 'Disabled' }).nth(2).click();
  await page.getByText('tipping-near-dapplet');

  // activate dapplet
  await page.getByTestId('system-tab-dapplets').click();
  await page.getByTestId('tipping-near-dapplet').getByTestId('activation-dapplet').click();

  // close overlay
  await page.getByTestId('system-tab-dapplets').click();

  await page.waitForEvent(
    'console',
    (msg) => msg.text().includes('tipping-near-dapplet') && msg.text().includes('is loaded'),
    );
    
  // ToDo: work with dapplet injections
  
  // await page.pause();
});
