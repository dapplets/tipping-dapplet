import { test, expect } from '../fixtures/fixtures';
import fs from 'fs';
import path from 'path';
import { Overlay } from '../pages/overlay';

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

  await overlay.runDapplet(tipsReciever, context, artifactsPath, cookiesPath);

  // check claim button text
  await page.getByTestId('app-text-transition-container').locator(`span:has-not-text("Claim and get")`);

  // click send tip and cancel
  const tipButton = await page.getByTitle('Send donation').first();
  await page.waitForTimeout(3000); // ToDo: remove timeouts
  const textBefore = await tipButton.innerText();
  await tipButton.click();
  await page.getByTestId('actions-label').getByRole('button', { name: 'Cancel' }).click();
  await page.waitForTimeout(3000); // ToDo: remove timeouts

  const textAfter = await page.getByTitle('Send donation').first().innerText();
  expect(textAfter).toEqual(textBefore);
});
