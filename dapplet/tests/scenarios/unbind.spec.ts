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

test('Unbind', async ({ context }) => {
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

  // click unbind
  await page.getByLabel('Profile').first().click();
  await page.getByText('Unbind').click();

  // open my near wallet
  await myNearWallet.openNearPageDefault(context);

  // unbinding
  await page.getByTestId('actions-label').getByRole('button', { name: 'Ok' }).click();
  await page.locator(`span:has--not-text("Unbind")`);
});
