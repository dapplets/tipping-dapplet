import { test, expect } from './fixtures';
import fs from 'fs';
import path from 'path';

// login info
const { TWITTER_EMAIL, TWITTER_USERNAME, TWITTER_PASSWORD, SECRET_PHRASE } = process.env;

const tipsReciever = {
  username: 'alsakhaev',
  bio: 'Web3 Developer at Dapplets',
};

const artifactsPath = path.join(__dirname, '..', 'artifacts');
const cookiesPath = path.join(artifactsPath, 'cookies.json');

test('Unbind', async ({ context }) => {
  // apply cookies if exist
  test.setTimeout(80000);
  if (fs.existsSync(cookiesPath)) {
    const cookies = fs.readFileSync(cookiesPath, 'utf8');
    const deserializedCookies = JSON.parse(cookies);
    await context.addCookies(deserializedCookies);
  }

  const page = await context.newPage();
  await page.goto(`https://twitter.com/${tipsReciever.username}`);
  // await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);
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

    await page.waitForTimeout(5000);
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

  // check claim button text
  await page.locator(`span:has-text("Unbind")`).click();
  await page.pause();


  // // connect near wallet
  // const [newPage] = await Promise.all([
  //   context.waitForEvent('page'),
  //   page.getByTestId('wallet-to-connect-near_mainnet').click(),
  // ]);
  // await newPage.waitForLoadState();
  // await expect(newPage).toHaveURL('https://app.mynearwallet.com/');
  // await newPage.getByRole('button', { name: 'Import Existing Account' }).click(), await newPage.waitForLoadState();
  // await expect(newPage).toHaveURL('https://app.mynearwallet.com/recover-account');
  // await newPage.getByRole('button', { name: 'Recover Account' }).first().click();
  // await newPage.waitForLoadState();
  // await expect(newPage).toHaveURL('https://app.mynearwallet.com/recover-seed-phrase');
  // await newPage.locator('input').type(SECRET_PHRASE);
  // await newPage.getByRole('button', { name: 'Find My Account' }).click();
  // await newPage.getByRole('button', { name: 'Next' }).click();

  // const [newPage2] = await Promise.all([
  //   context.waitForEvent('page'),
  //   await newPage.getByRole('button', { name: 'Connect' }).click(),
  //   await page.waitForTimeout(5000)
  // ]);
  // await newPage2.getByRole('button', { name: 'Next' }).click();

  // const [newPage3] = await Promise.all([
  //   context.waitForEvent('page'),
  //   await newPage2.getByRole('button', { name: 'Connect' }).click(),
  //   await newPage2.waitForTimeout(5000)
  // ]);
  // await newPage3.getByRole('button', { name: 'Approve' }).click(),
  // await newPage3.waitForTimeout(5000)

  // // open notification was tipped
  // await page.locator(`span:has-text("was tipped")`);
  // // check claim button new text
  // await page.getByTestId('app-text-transition-container').locator(`span:has-text("Claim and get")`);
});
