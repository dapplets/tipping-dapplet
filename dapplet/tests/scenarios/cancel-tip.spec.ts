import { test, expect } from '../fixtures/my-near-wallet';

test('Send Tip and check change text to button claim', async ({ page }) => {
  await page.goto(process.env.TWITTER_TEST_PROFILE_URL)

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
