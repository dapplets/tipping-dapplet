import { test } from '../fixtures/fixtures';
import fs from 'fs';
import path from 'path';
import { Overlay } from '../pages/overlay';
import { MyNearWallet } from '../pages/my-near-wallet';

const tipsReciever = {
  username: 'alsakhaev',
  bio: 'Web3 Developer at Dapplets',
};

const artifactsPath = path.join(__dirname, '..', 'artifacts');
const cookiesPath = path.join(artifactsPath, 'cookies.json');

test('Send Tip and check change text to button claim', async ({ context }) => {
  // apply cookies if exist
  test.setTimeout(80000);
  if (fs.existsSync(cookiesPath)) {
    const cookies = fs.readFileSync(cookiesPath, 'utf8');
    const deserializedCookies = JSON.parse(cookies);
    await context.addCookies(deserializedCookies);
  }

  const page = await context.newPage();

  const overlay = new Overlay(page);
  const myNearWallet = new MyNearWallet(page);
  
  await overlay.runDapplet(tipsReciever, context, artifactsPath, cookiesPath);

  // check claim button text
  await page.getByTestId('app-text-transition-container').locator(`span:has-not-text("Claim and get")`);

  // click send tip and cancel
  await page.getByTitle('Send donation').first().click();
  await page.waitForTimeout(3000);
  await page.getByTestId('actions-label');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.locator(`span:has-not-text("NEAR")`);
  await page.waitForTimeout(5000);

  // click send tip and ok
  await page.getByTitle('Send donation').first().dblclick();
  await page.waitForTimeout(3000);
  await page.getByTitle('Send donation').first().getByText('0.10 NEAR');
  await page.waitForTimeout(3000);
  await page.getByTestId('actions-label').getByRole('button', { name: 'Ok' }).click();
  await page.waitForTimeout(2000);

  await myNearWallet.openNearPageForTip(context);

  // open notification was tipped
  await page.locator(`span:has-text("was tipped")`);
  // check claim button new text
  await page.getByTestId('app-text-transition-container').locator(`span:has-text("Claim and get")`);
});
