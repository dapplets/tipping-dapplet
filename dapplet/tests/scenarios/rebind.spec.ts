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

test('Rebind', async ({ context }) => {
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

  // click rebind
  await page.getByLabel('Profile').first().click();
  await page.getByText('rebind').click();

  // open my near wallet
  await myNearWallet.openNearPageDefault(context);

  // alert rebind
  await page
    .getByTestId('actions-label')
    .getByText('If you want to bind another wallet, login into it using the Extension');
  await page.getByTestId('actions-label').getByRole('button', { name: 'Ok' }).click();
});
