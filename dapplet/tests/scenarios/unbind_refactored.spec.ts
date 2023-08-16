import { test, expect } from '../fixtures/my-near-wallet';

test('Unbind', async ({ page, restoreAndConnectWallet, confirmNewSession, approveTransaction }) => {
  test.setTimeout(80000);

  // click unbind
  await page.getByLabel('Profile').first().click();
  await page.getByText('Unbind').click();
  await page.getByTestId('wallet-to-connect-near_mainnet').click();

  await restoreAndConnectWallet(process.env.SECRET_PHRASE);

});
