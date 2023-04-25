import { NearNetworks } from './interfaces';

export const zeroDonationStepError =
  'A donation step must be more than zero. Change the step parameter in the dapplet settings.';

export const zeroDelayError = 'A delay must be greater than zero. Change the delay parameter in the dapplet settings.';

export const aboutCA =
  'We use the Connected Accounts service to verify user ownership of social media' +
  ' accounts and wallets. The service is based on the NEAR smart contract.' +
  ' Connected Accounts allow you to link accounts decentralized and identify' +
  ' yourself and other users on various web resources. More details can be found here:\n' +
  ' https://github.com/dapplets/connected-accounts-assembly';

export const offerToReloginOrConnectAccount = ({
  username,
  websiteName,
  walletAccountId,
  nearAccountsFromCA,
  walletForAutoclaim,
}: {
  username: string;
  websiteName: string;
  walletAccountId: string;
  nearAccountsFromCA: string[];
  walletForAutoclaim?: string;
}): string =>
  `You are logged in with ${walletAccountId}, that is not connected with @${username} ${websiteName} account. ` +
  `You can ${
    walletForAutoclaim || nearAccountsFromCA.length !== 0
      ? `login with ${walletForAutoclaim ? walletForAutoclaim + ' or with ' : ''}${
          nearAccountsFromCA.length !== 0 ? 'already connected wallets (' + nearAccountsFromCA.join(', ') + ')' : ''
        } or `
      : ''
  }connect ${walletAccountId} to @${username}. Do you want to make a new connection?`;

export const tipTransfer = (amount: string, fee: string, externalAccount: string, websiteName: string): string =>
  `You're tipping ${Core.near.utils.format.formatNearAmount(
    amount,
  )} Ⓝ to "@${externalAccount}" at "${websiteName}".\n` +
  `A tiny fee of ${Core.near.utils.format.formatNearAmount(fee)} Ⓝ for project development will be added.\n` +
  `Thank you for your support!`;

export const successfulTipTransfer = (amount: string, explorerUrl: string, txHash: string): string =>
  `Tipped ${Core.near.utils.format.formatNearAmount(amount)} $NEAR with @tippingdapplet. ` +
  `Tx link: ${explorerUrl}/transactions/${txHash}`;

export const settingTippingWallet = (walletAccountId: string): string =>
  `You are setting ${walletAccountId} as a tipping wallet with @tippingdapplet` + '\nContinue?';

export const claiming = (walletAccountId: string, availableTokens: number): string =>
  `You are claiming ${availableTokens.toFixed(
    2,
  )} $NEAR and setting ${walletAccountId} as a tipping wallet with @tippingdapplet` + '\nContinue?';

export const claimed = (
  walletAccountId: string,
  network: NearNetworks,
  txHash: string,
  availableTokens?: number,
): string => {
  const explorerUrl =
    network === NearNetworks.Mainnet ? 'https://explorer.near.org' : 'https://explorer.testnet.near.org';
  return (
    `Claimed ${
      availableTokens
        ? availableTokens.toFixed(2) + ' $NEAR to ' + walletAccountId
        : walletAccountId + ' as a tipping wallet'
    } with @tippingdapplet. ` + `Tx link: ${explorerUrl}/transactions/${txHash}`
  );
};

export const unbinding = (walletForAutoclaim: string, username: string): string =>
  `You are unbinding ${walletForAutoclaim} from @${username} in @tippingdapplet` + '\nContinue?';

export const unbinded = (walletForAutoclaim: string, username: string): string =>
  `${walletForAutoclaim} was unbinded from @${username} in @tippingdapplet`;

export const rebindError = (walletForAutoclaim: string): string =>
  `${walletForAutoclaim} is a tipping wallet now. If you want to bind another wallet, login to it in the extension.`;

export const rebinding = (username: string, walletAccountId: string, walletForAutoclaim: string): string =>
  `You are binding ${walletAccountId} to @${username} instead of ${walletForAutoclaim} in @tippingdapplet` +
  '\nContinue?';

export const binded = (walletAccountId: string, username: string): string =>
  `${walletAccountId} was binded to @${username} in @tippingdapplet`;
