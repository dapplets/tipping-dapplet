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
