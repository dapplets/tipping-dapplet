import BigNumber from 'bignumber.js';
import { NEAR_ADDRESS, TESTERS_ADDRESSES } from '../config/TESTERS_ADDRESSES';
import { NearNetworks } from './interfaces';

export function sum(...values: string[]): string {
  let _sum = new BigNumber('0');

  for (const v of values) {
    const _a = new BigNumber(_sum);
    const _b = new BigNumber(v);
    _sum = _a.plus(_b);
  }

  return _sum.toFixed();
}

export function lte(a: string, b: string): boolean {
  const _a = new BigNumber(a);
  const _b = new BigNumber(b);
  return _a.lte(_b);
}

export function gte(a: string, b: string): boolean {
  const _a = new BigNumber(a);
  const _b = new BigNumber(b);
  return _a.gte(_b);
}

export function equals(a: string, b: string): boolean {
  const _a = new BigNumber(a);
  const _b = new BigNumber(b);
  return _a.isEqualTo(_b);
}

export function toFixedString(a: string, fractionDigits: number): string {
  return Number(a).toFixed(fractionDigits);
}

export function getMilliseconds(seconds: number): number {
  return seconds * 1000;
}

export function isParticipant(user: string, isTest = false): string | undefined {
  return isTest ? TESTERS_ADDRESSES.find((name) => name === user) : NEAR_ADDRESS.find((name) => name === user);
}

export function parseNearId(fullname: string, network: string): string | null {
  const regExpMainnet = /(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+\.near/;
  const regExpTestnet = /(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+\.testnet/;
  const nearId = fullname.toLowerCase().match(network === NearNetworks.Testnet ? regExpTestnet : regExpMainnet);

  return nearId && nearId[0];
}

export function formatNear(amount: string): string {
  const { formatNearAmount } = Core.near.utils.format;
  return Number(formatNearAmount(amount, 4)).toFixed(2);
}
