import { groupBy } from 'lodash';

import { TippingsRepository } from '../repositories/TippingsRepository';
import { PaymentRepository } from '../repositories/PaymentRepository';

const { parseNearAmount } = Core.near.utils.format;

export interface ButtonCTXProps {
  authorFullname: string;
  authorImg: string;
  authorUsername: string;
  id: string;
  parent: null;
  text: string;
  theme: string;
}

export interface ITipping {
  tweetId: string;
  nearId: string;
  count: number;
}

export interface ISendTipping {
  nearId: string;
  count: number;
}

export interface ITippingsState {
  nearId: string;
  count: number;
  payment: number;
}

export interface IPayment {
  nearId: string;
  payment: number;
}

export interface onDataProps {
  tippings: ITipping[];
  payment: IPayment[];
  method(): void;
}

export type UserStat = {
  nearId: string;
  count: number;
  payment: number;
  resultCount: number;
};

export class TippingService {
  constructor(private tippingsRepository: TippingsRepository, private paymentRepository: PaymentRepository) {}

  async getAllUserStat(): Promise<UserStat[]> {
    const tippings = await this.tippingsRepository.getAll();
    const payment = await this.paymentRepository.getAll();
    const mergeArr = merge(tippingParsing(tippings), payment);
    return mergeArr.map((x) => ({
      nearId: x.nearId,
      count: toFixed(x.count),
      payment: toFixed(x.payment),
      resultCount: toFixed(x.count - x.payment),
    }));
  }

  async getTotalDonationByItem(tweetId: string): Promise<number> {
    const getTippingInStorage = await this.tippingsRepository.getAll();
    for (const item of getTippingInStorage) {
      if (item.tweetId === tweetId) return item.count;
    }
    return 0;
  }

  async addDonation(nearAccountId: string, tweetId: string, amount: number): Promise<void> {
    // get current donation
    const tipping = (await this.tippingsRepository.getByTweetId(tweetId)) ?? {
      tweetId: tweetId,
      nearId: nearAccountId,
      count: 0,
    };

    // + amount
    tipping.count += amount;

    // update donate
    await this.tippingsRepository.upsert(tipping);
  }

  private async addPayment(nearAccountId: string, paymentAmount: number): Promise<void> {
    const p = (await this.paymentRepository.getByPaymentNearId(nearAccountId)) ?? {
      nearId: nearAccountId,
      payment: 0,
    };

    p.payment += paymentAmount;
    this.paymentRepository.upsert(p);
  }

  async donateToUser(nearAccountId: string, donateAmount: number): Promise<void> {
    const network = await Core.storage.get('network');
    const wallet = await Core.wallet({ type: 'near', network });

    if (!(await wallet.isConnected())) await wallet.connect();

    await wallet.sendMoney(nearAccountId, parseNearAmount(String(donateAmount)));
    await this.addPayment(nearAccountId, donateAmount);
  }

  async donateByTweet(nearAccountId: string, tweetId: string, amount: number): Promise<void> {
    await this.donateToUser(nearAccountId, amount);
    await this.addDonation(nearAccountId, tweetId, amount);
  }
}

function toFixed(value: number): number {
  const power = Math.pow(10, 14);
  return Number(String(Math.round(value * power) / power));
}

function tippingParsing(tippings: ITipping[]): ISendTipping[] {
  const group = groupBy(tippings, 'nearId');

  return Object.keys(group).reduce((acc: any, item) => {
    const obj = group[item].reduce(
      (acc: any, item) => {
        return {
          nearId: item.nearId,
          count: acc.count + item.count,
        };
      },
      { count: 0 },
    );

    acc.push(obj);
    return acc;
  }, []);
}

function merge(arr1: ISendTipping[], arr2: IPayment[]): ITippingsState[] {
  const merged = [];

  for (let i = 0; i < arr1.length; i++) {
    merged.push({
      ...arr1[i],
      ...(arr2.find((itmInner: IPayment) => itmInner.nearId === arr1[i].nearId) ?? { payment: 0 }),
    });
  }

  return merged;
}
