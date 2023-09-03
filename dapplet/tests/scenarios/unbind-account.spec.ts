import { test } from '../fixtures/my-near-wallet';

test('Unbind', async ({ page, restoreAndConnectWallet, confirmNewSession }) => {
  await page.goto(process.env.TWITTER_TEST_PROFILE_URL);

  const unbindButton = await page.getByTestId(`PROFILE/${process.env.GITHUB_AUTH_USERNAME}/unbindButton`);

  const isUnbindButton = await unbindButton.boundingBox();

  if (isUnbindButton.width && isUnbindButton.width > 100) {
    await page.getByTestId(`PROFILE/${process.env.TWITTER_AUTH_USERNAME}/unbindButton`).click();
    await page.getByTestId('wallet-to-connect-near_mainnet').click();
    await restoreAndConnectWallet(process.env.NEAR_SECRET_PHRASE);

    await confirmNewSession();

    await page.getByTestId('actions-label').getByRole('button', { name: 'Ok' }).click();
    await page.waitForTimeout(5000);
  } else {
    await page.getByText('Claim').click();
    const checkModal = await page.getByTestId('actions-label').all();
    if (checkModal.length) {
      await page.getByTestId('actions-label').getByRole('button', { name: 'Ok' }).click();
    }
    // open my near wallet

    await page.getByTestId('wallet-to-connect-near_mainnet').click();

    await restoreAndConnectWallet(process.env.NEAR_SECRET_PHRASE);

    await confirmNewSession();

    await page.getByTestId('actions-label').getByRole('button', { name: 'Ok' }).click();
    await page.waitForTimeout(15000);
    await page.getByTestId(`PROFILE/${process.env.TWITTER_AUTH_USERNAME}/unbindButton`).click();
    await page.getByTestId('actions-label').getByRole('button', { name: 'Ok' }).click();
    await page.waitForTimeout(5000);
  }
});
