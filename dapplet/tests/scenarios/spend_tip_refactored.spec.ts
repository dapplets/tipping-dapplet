import { test, expect } from '../fixtures/my-near-wallet';

test('Send Tip and check change text to button claim', async ({
  page,
  restoreAndConnectWallet,
  confirmNewSession,
  approveTransaction,
}) => {
  test.setTimeout(80000);

  // check claim button text
  await page.getByTestId('app-text-transition-container').locator(`span:has-not-text("Claim and get")`);

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
