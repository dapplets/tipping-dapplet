import { test } from '../fixtures/my-near-wallet';

test('Rebind', async ({ page, restoreAndConnectWallet, confirmNewSession }) => {
  await page.goto(process.env.TWITTER_TEST_PROFILE_URL);

  // click rebind
  await page.getByLabel('Profile').first().click();
  await page.getByText('rebind').click();
  await page.getByTestId('wallet-to-connect-near_mainnet').click();

  await restoreAndConnectWallet(process.env.SECRET_PHRASE);
  await confirmNewSession();
  // alert rebind
  await page
    .getByTestId('actions-label')
    .getByText('If you want to bind another wallet, login into it using the Extension');
  await page.getByTestId('actions-label').getByRole('button', { name: 'Ok' }).click();
});
