import { context, ContractPromise, ContractPromiseResult, u128 } from "near-sdk-as";

// Constants
export const TGAS: u64 = 1000000000000;
export const NO_DEPOSIT: u128 = u128.Zero;
export const XCC_SUCCESS = 1;

// Auxiliary Method: Make the callback private and return its result
export function get_callback_result(): ContractPromiseResult {
  assert(context.predecessor == context.contractName, "Only the contract itself can call this method");

  // Return the result from the external pool
  const results = ContractPromise.getResults();
  assert(results.length == 1, "This is a callback method");
  return results[0];
}

export type NearAccount = string; // example: user.near, user.testnet
export type ExternalAccountName = string; // example: user
export type AccountGlobalId = string; // example: user/twitter, user.near/near/mainnet, hash/ethereum

@nearBindgen
export class AccountState {
  constructor(
    public isMain: bool = false // true - main, false - not main
  ) {}
}

@nearBindgen
export class Account {
  constructor(public id: AccountGlobalId, public status: AccountState) {}
}

@nearBindgen
export class GetCANetArgs {
  constructor(public accountGId: AccountGlobalId) {}
}

@nearBindgen
export class AreConnectedArgs {
  constructor(public accountGId1: AccountGlobalId, public accountGId2: AccountGlobalId) {}
}

@nearBindgen
export class SendTipsToWalletCallbackArgs {
  constructor(
    public accountGId: AccountGlobalId,
    public itemId: string,
    public donationAmount: u128,
    public feeAmount: u128
  ) {}
}

@nearBindgen
export class SetWalletForAutoclaimCallbackArgs {
  constructor(public accountGId: AccountGlobalId, public wallet: NearAccount) {}
}

@nearBindgen
export class DeleteWalletForAutoclaimCallbackArgs {
  constructor(public accountGId: AccountGlobalId) {}
}

@nearBindgen
export class ClaimTokensCallbackArgs {
  constructor(public accountGId: AccountGlobalId) {}
}
