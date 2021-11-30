export interface ITipping {
	tweetId: string;
	nearId: string;
	count: number;
}

export interface IPayment {
	nearId: string;
	payment: number;
}

export enum NearNetwork {
	MAINNET = 'mainnet',
	TESTNET = 'testnet',
  }
  