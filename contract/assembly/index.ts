import {
  PersistentUnorderedMap,
  storage,
  Context,
  logging,
  u128,
  ContractPromiseBatch,
  PersistentSet,
  PersistentVector,
} from "near-sdk-core";

type NearAccount = string; // example: user.near, user.testnet
type ExternalAccount = string; // example: twitter/user

//// MODELS

// Common
const OWNER_ACCOUNT_KEY = "a";

// Identity

const externalByNear = new PersistentUnorderedMap<NearAccount, ExternalAccount>("b");
const nearByExternal = new PersistentUnorderedMap<ExternalAccount, NearAccount>("c");
const ORACLE_ACCOUNT_KEY = "d";
const MIN_STAKE_AMOUNT_KEY = "e";

// Requests

@nearBindgen
export class VerificationRequest {
  constructor(
    public nearAccount: NearAccount,
    public externalAccount: ExternalAccount,
    public isUnlink: boolean,
    public proofUrl: string
  ) {}
}

const verificationRequests = new PersistentVector<VerificationRequest>("f");
const pendingRequests = new PersistentSet<u32>("g");

// INITIALIZATION

export function initialize(ownerAccountId: NearAccount, oracleAccountId: NearAccount, minStakeAmount: u128): void {
  assert(storage.get<NearAccount>(OWNER_ACCOUNT_KEY) == null, "Already initialized contract");
  storage.set(OWNER_ACCOUNT_KEY, ownerAccountId);
  storage.set(ORACLE_ACCOUNT_KEY, oracleAccountId);
  storage.set<u128>(MIN_STAKE_AMOUNT_KEY, minStakeAmount);
  logging.log(
    "Init contract with owner: " +
      ownerAccountId +
      ", oracle: " +
      oracleAccountId +
      " and min stake: " +
      minStakeAmount.toString()
  );
}

//// READ

// Identity

export function getExternalAccount(nearAccount: NearAccount): ExternalAccount | null {
  return externalByNear.get(nearAccount);
}

export function getNearAccount(externalAccount: ExternalAccount): NearAccount | null {
  return nearByExternal.get(externalAccount);
}

export function getOwnerAccount(): NearAccount | null {
  return storage.get<NearAccount>(OWNER_ACCOUNT_KEY);
}

export function getOracleAccount(): NearAccount | null {
  return storage.get<NearAccount>(ORACLE_ACCOUNT_KEY);
}

export function getMinStakeAmount(): u128 {
  return storage.get<u128>(MIN_STAKE_AMOUNT_KEY, new u128()) as u128;
}

// Requests

export function getPendingRequests(): u32[] {
  return pendingRequests.values();
}

export function getVerificationRequest(id: u32): VerificationRequest | null {
  if (!verificationRequests.containsIndex(id)) return null;
  return verificationRequests[id];
}

// WRITE

// Identity

export function approveRequest(requestId: u32): void {
  _onlyOracle();
  assert(verificationRequests.containsIndex(requestId), "Non-existent request ID");
  assert(pendingRequests.has(requestId), "The request has already been processed");
  const req = verificationRequests[requestId];

  // ToDo: check that delete will not be reverted
  pendingRequests.delete(requestId);

  if (req.isUnlink) {
    assert(externalByNear.contains(req.nearAccount), "The NEAR account doesn't have a linked account");
    assert(nearByExternal.contains(req.externalAccount), "The external account doesn't have a linked account");
    externalByNear.delete(req.nearAccount);
    nearByExternal.delete(req.externalAccount);

    logging.log("Accounts " + req.nearAccount + " and " + req.externalAccount + " are unlinked");
  } else {
    assert(!externalByNear.contains(req.nearAccount), "The NEAR account already has a linked account");
    assert(!nearByExternal.contains(req.externalAccount), "The external account already has a linked account");
    externalByNear.set(req.nearAccount, req.externalAccount);
    nearByExternal.set(req.externalAccount, req.nearAccount);

    logging.log("Accounts " + req.nearAccount + " and " + req.externalAccount + " are linked");
  }
}

export function rejectRequest(requestId: u32): void {
  _onlyOracle();
  assert(verificationRequests.containsIndex(requestId), "Non-existent request ID");
  assert(pendingRequests.has(requestId), "The request has already been processed");
  pendingRequests.delete(requestId);
}

export function changeOwnerAccount(newAccountId: NearAccount): void {
  _onlyOwner();
  storage.set(OWNER_ACCOUNT_KEY, newAccountId);
  logging.log("Changed owner: " + newAccountId);
}

export function changeOracleAccount(newAccountId: NearAccount): void {
  _onlyOwner();
  storage.set(ORACLE_ACCOUNT_KEY, newAccountId);
  logging.log("Changed oracle: " + newAccountId);
}

export function changeMinStake(minStakeAmount: u128): void {
  _onlyOwner();
  storage.set<u128>(MIN_STAKE_AMOUNT_KEY, minStakeAmount);
  logging.log("Changed min stake: " + minStakeAmount.toString());
}

export function unlinkAll(): void {
  _onlyOwner();
  externalByNear.clear();
  nearByExternal.clear();
}


// Requests

export function requestVerification(externalAccount: ExternalAccount, isUnlink: boolean, url: string): u32 {
  assert(Context.sender == Context.predecessor, "Cross-contract calls is not allowed");
  assert(
    Context.attachedDeposit >= (storage.get<u128>(MIN_STAKE_AMOUNT_KEY, new u128()) as u128),
    "Insufficient stake amount"
  );

  const id = verificationRequests.push(new VerificationRequest(Context.sender, externalAccount, isUnlink, url));
  pendingRequests.add(id);
  ContractPromiseBatch.create(storage.get<NearAccount>(ORACLE_ACCOUNT_KEY) as string).transfer(Context.attachedDeposit);

  logging.log(
    Context.sender + " requests to link " + externalAccount + " account. Proof ID: " + id.toString() + " URL: " + url
  );

  return id;
}

// HELPERS

function _onlyOracle(): void {
  assert(storage.get<NearAccount>(ORACLE_ACCOUNT_KEY) == Context.sender, "Only oracle account can write");
}

function _onlyOwner(): void {
  assert(storage.get<NearAccount>(OWNER_ACCOUNT_KEY) == Context.sender, "Only owner account can write");
}
