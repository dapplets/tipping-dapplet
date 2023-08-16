import { test, expect } from '../fixtures/my-near-wallet';
import fs from 'fs';
import path from 'path';
import { Overlay } from '../pages/overlay';

const tipsReciever = {
  username: 'alsakhaev',
  bio: 'Web3 Developer at Dapplets',
};

const artifactsPath = path.join(__dirname, '..', 'artifacts');
const cookiesPath = path.join(artifactsPath, 'cookies.json');

test('Send Tip and check change text to button claim', async ({
  context,
  restoreAndConnectWallet,
  confirmNewSession,
  approveTransaction,
}) => {
  // apply cookies if exist
  test.setTimeout(80000);
  if (fs.existsSync(cookiesPath)) {
    const cookies = fs.readFileSync(cookiesPath, 'utf8');
    const deserializedCookies = JSON.parse(cookies);
    await context.addCookies(deserializedCookies);
  }

  const page = await context.newPage();

  const overlay = new Overlay(page);

  await overlay.runDapplet(tipsReciever, context, artifactsPath, cookiesPath);

  // check claim button text
  await page.getByTestId('app-text-transition-container').locator(`span:has-not-text("Claim and get")`);

  // ToDo: move to separate test
  // click send tip and cancel
  // await page.getByTitle('Send donation').first().click();
  // await page.waitForTimeout(3000);
  // await page.getByTestId('actions-label');
  // await page.getByRole('button', { name: 'Cancel' }).click();
  // await page.locator(`span:has-not-text("NEAR")`);
  // await page.waitForTimeout(5000);

  // click send tip and ok
  await page.getByTitle('Send donation').first().dblclick();
  await page.waitForTimeout(3000);
  await page.getByTitle('Send donation').first().getByText('0.10 NEAR');
  await page.waitForTimeout(3000);
  await page.getByTestId('actions-label').getByRole('button', { name: 'Ok' }).click();
  await page.waitForTimeout(2000);

  await page.getByTestId('wallet-to-connect-near_mainnet').click();

  await restoreAndConnectWallet(process.env.SECRET_PHRASE);
  await confirmNewSession();
  await approveTransaction();

  // open notification was tipped
  await page.locator(`span:has-text("was tipped")`);

  // check claim button new text
  await page.getByTestId('app-text-transition-container').locator(`span:has-text("Claim and get")`);
});
