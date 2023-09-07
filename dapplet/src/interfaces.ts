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

export interface ICurrentProfile {
  authorFullname: string;
  authorImg: string;
  authorUsername: string;
  id: string;
  parent?: {
    websiteName: string;
  };
  url: string;
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
