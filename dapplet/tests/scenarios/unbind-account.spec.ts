import { test } from '../fixtures/my-near-wallet';

test('Unbind', async ({ page, restoreAndConnectWallet }) => {
  await page.goto(process.env.TWITTER_TEST_PROFILE_URL);

  // click unbind
  await page.getByLabel('Profile').first().click();
  await page.getByText('Unbind').click();
  await page.getByTestId('wallet-to-connect-near_mainnet').click();

  await restoreAndConnectWallet(process.env.SECRET_PHRASE);
});
