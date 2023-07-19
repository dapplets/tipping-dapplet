export interface ITipping {
  tweetId: string;
  nearId: string;
  count: number;
}

export interface IPayment {
  nearId: string;
  payment: number;
}

export enum NearNetworks {
  Mainnet = 'mainnet',
  Testnet = 'testnet',
}

export interface ICurrentUser {
  username?: string;
  fullname?: string;
  img?: string;
  websiteName: string;
}

export type TConnectedAccountsVerificationRequestInfo = {
  firstAccount: string;
  secondAccount: string;
  isUnlink: boolean;
  firstProofUrl: string;
  secondProofUrl: string;
  transactionSender: string;
};

export type CARequestStatus = 'not found' | 'pending' | 'approved' | 'rejected';

export enum NotificationActions {
  CANCEL = 'CANCEL',
  ConnectNewAccount_OK = 'ConnectNewAccount_OK',
  SetWalletForAutoclaim_OK = 'SetWalletForAutoclaim_OK',
  Claim_OK = 'Claim_OK',
  Unbind_OK = 'Unbind_OK',
  Relogin_OK = 'Relogin_OK',
  Rebind_OK = 'Rebind_OK',
  Relogin2_OK = 'Relogin2_OK',
  Tip_OK = 'Tip_OK',
  Tip_Cancel = 'Tip_Cancel',
}