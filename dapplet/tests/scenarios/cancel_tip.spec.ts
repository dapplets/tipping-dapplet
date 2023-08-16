import { test, expect } from '../fixtures/my-near-wallet';

const registryUrl = 'http://localhost:3001/dapplet.json';

test('Send Tip and check change text to button claim', async ({
  page,
  skipOnboarding,
  enableDevServer,
  activateDapplet,
}) => {
  test.setTimeout(80000);

  await skipOnboarding();
  await enableDevServer(registryUrl);
  await activateDapplet('tipping-near-dapplet', registryUrl);

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
