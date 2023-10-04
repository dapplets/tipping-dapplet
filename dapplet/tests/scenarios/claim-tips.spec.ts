import { test } from '../fixtures/my-near-wallet';

test('Claim', async ({ page, restoreAndConnectWallet, confirmNewSession }) => {
  await page.goto(process.env.TWITTER_TEST_PROFILE_URL);

  // go to profile
  await page.getByLabel('Profile').first().click();

  //   check claim btn or rebind/unbind btn
  const rebind = await page.getByTestId('reply');

  if (rebind.nth(2)) {
    await page.getByText('Unbind').click();

    // open my near wallet
    await page.getByTestId('wallet-to-connect-near_mainnet').click();
    await restoreAndConnectWallet(process.env.SECRET_PHRASE);
    await confirmNewSession();

    // unbinding
    await page.getByTestId('actions-label').getByRole('button', { name: 'Ok' }).click();
    await page.locator(`span:has-not-text("Unbind")`);
  } else {
    await page.getByText('Claim').click();
    const checkModal = await page.getByTestId('actions-label').all();
    if (checkModal.length) {
      await page.getByTestId('actions-label').getByRole('button', { name: 'Ok' }).click();
    }
    // open my near wallet
    await page.getByTestId('wallet-to-connect-near_mainnet').click();
    await restoreAndConnectWallet(process.env.SECRET_PHRASE);
    await confirmNewSession();

    await page.getByTestId('actions-label').getByRole('button', { name: 'Ok' }).click();
    await page.waitForTimeout(3000);
    await page.isVisible('span:has-text("Unbind")');
  }
});
