import { NearNetworks } from './interfaces';
export const nearUnicode = '\u24C3';

export const zeroDonationStepError =
  'The tip step must be more than zero. Change the step parameter in the dapplet settings.';

export const zeroDelayError = 'A delay must be greater than zero. Change the delay parameter in the dapplet settings.';

export const aboutCA =
  'We use Connected Accounts. It is the service to verify user ownership of web2' +
  ' accounts and wallets based on the NEAR smart-contract. It allow you to link' +
  ' accounts in decentralized way and identify yourself and other users ony' +
  ' supported web sites. More details can be found [here]' +
  '(https://github.com/dapplets/connected-accounts-assembly)';

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
  `You are logged in with ${nearUnicode}${walletAccountId}, that is not connected with @${username} ${websiteName} account. ` +
  `You can ${
    walletForAutoclaim || nearAccountsFromCA.length !== 0
      ? `login with ${
          walletForAutoclaim ? walletForAutoclaim + (nearAccountsFromCA.length !== 0 ? ' or with ' : '') : ''
        }${
          nearAccountsFromCA.length !== 0 ? 'already connected wallets (' + nearAccountsFromCA.join(', ') + ')' : ''
        } or `
      : ''
  }connect ${walletAccountId} to @${username}. Do you want to make a new connection?`;

export const tipTransfer = (amount: string, fee: string, externalAccount: string, websiteName: string): string =>
  `You're are about to tip ${Core.near.utils.format.formatNearAmount(amount)} $NEAR to @${externalAccount} ${
    websiteName === 'Twitter' ? 'tweet' : websiteName === 'GitHub' ? 'comment' : 'post'
  }.\n` + `${Core.near.utils.format.formatNearAmount(fee)}$NEAR fee`;

export const successfulTipTransfer = (
  amount: string,
  explorerUrl: string,
  txHash: string,
  postCtx: any,
  websiteName: string,
): string =>
  `${Core.near.utils.format.formatNearAmount(amount)} $NEAR was tipped to [${
    websiteName === 'Twitter' ? 'tweet' : websiteName === 'GitHub' ? 'comment' : 'post'
  }](${postCtx.url}). [Tx link](${explorerUrl}/transactions/${txHash})`;

export const settingTippingWallet = (walletAccountId: string): string =>
  `You are about to set ${nearUnicode}${walletAccountId} as a tipping wallet` + '\nContinue?';

export const claiming = (walletAccountId: string, availableTokens: number): string =>
  `You are about to claim ${availableTokens.toFixed(2)} $NEAR and set ${nearUnicode}${walletAccountId} as a tipping` +
  '\nContinue?';

export const claimed = (
  walletAccountId: string,
  network: NearNetworks,
  txHash: string,
  availableTokens?: number,
): string => {
  const explorerUrl =
    network === NearNetworks.Mainnet ? 'https://explorer.near.org' : 'https://explorer.testnet.near.org';

  return (
    `${
      availableTokens
        ? availableTokens.toFixed(2) + ' $NEAR of tips was claimed to  ' + nearUnicode + walletAccountId
        : nearUnicode + walletAccountId + ' has been set as a tipping wallet. '
    }` + ` [Tx link](${explorerUrl}/transactions/${txHash})`
  );
};

export const unbinding = (walletForAutoclaim: string, username: string): string =>
  `You are about to unbind ${nearUnicode}${walletForAutoclaim} from @${username}` + '\nContinue?';

export const unbinded = (walletForAutoclaim: string, username: string): string =>
  `${nearUnicode}${walletForAutoclaim} has been unbound from @${username}`;

export const rebindError = (walletForAutoclaim: string): string =>
  `${nearUnicode}${walletForAutoclaim} is a tipping wallet now. If you want to bind another wallet, login into it using the Extension.`;

export const rebinding = (username: string, walletAccountId: string, walletForAutoclaim: string): string =>
  `You are about to bind ${nearUnicode}${walletAccountId} to @${username} instead of ${walletForAutoclaim}` +
  '\nContinue?';

export const binded = (walletAccountId: string, username: string): string =>
  `${nearUnicode}${walletAccountId} has been bounded to @${username} in @tippingdapplet`;

export const CARequestStatusMsg = (firstAccount: string, secondAccount: string, requestStatus: string): string =>
  'Connection of ' + nearUnicode + firstAccount + ' and ' + secondAccount + ' has been ' + requestStatus;

export const teaserClaimed = (walletAccountId: string, availableTokens?: number) => {
  return `${
    availableTokens
      ? availableTokens.toFixed(2) + ' $NEAR of tips was claimed to  ' + nearUnicode + walletAccountId
      : nearUnicode + walletAccountId + ' has been set as a tipping wallet.'
  }`;
};

export const teaserUnbinded = (walletForAutoclaim: string, username: string) => {
  return `${nearUnicode}${walletForAutoclaim} has been unbound from @${username}`;
};

export const teaserBinded = (walletAccountId: string, username: string): string => {
  return `${nearUnicode}${walletAccountId} has been bounded to @${username} in @tippingdapplet`;
};

export const teaserSuccessfulTipTransfer = (amount: string): string => {
  return `${Core.near.utils.format.formatNearAmount(amount)} $NEAR was tipped.`;
};
