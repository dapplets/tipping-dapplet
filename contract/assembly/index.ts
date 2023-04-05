import {
  PersistentUnorderedMap,
  storage,
  Context,
  logging,
  u128,
  ContractPromiseBatch,
  ContractPromise,
} from "near-sdk-core";
import {
  get_callback_result,
  XCC_SUCCESS,
  TGAS,
  NO_DEPOSIT,
  Account,
  NearAccount,
  ExternalAccountName,
  AccountGlobalId,
  SetWalletForAutoclaimCallbackArgs,
  DeleteWalletForAutoclaimCallbackArgs,
  ClaimTokensCallbackArgs,
  GetCANetArgs,
  AreConnectedArgs,
} from "./external";

//// MODELS

// Common
const OWNER_ACCOUNT_KEY = "a";
const INIT_CONTRACT_KEY = "b";

// Settings
const CA_CONTRACT_KEY = "c";
const NEAR_NETWORK = "m";
const senderOrigin = "n";

// Tipping

const totalTipsByItem = new PersistentUnorderedMap<string, u128>("d");
const totalTipsByAccountGlobalId = new PersistentUnorderedMap<AccountGlobalId, u128>("e");
const availableTipsByAccountGlobalId = new PersistentUnorderedMap<AccountGlobalId, u128>("f");
const walletsForAutoclaim = new PersistentUnorderedMap<AccountGlobalId, NearAccount>("g");

const MAX_AMOUNT_PER_ITEM_KEY = "h";
const MAX_AMOUNT_PER_TIP_KEY = "k";

//// INITIALIZATION

export function initialize(
  ownerAccountId: NearAccount,
  caContractAddress: string,
  maxAmountPerItem: u128,
  maxAmountPerTip: u128,
  network: string
): void {
  assert(storage.getPrimitive<bool>(INIT_CONTRACT_KEY, false) == false, "Contract already initialized");

  storage.set<NearAccount>(OWNER_ACCOUNT_KEY, ownerAccountId);
  storage.set<NearAccount>(CA_CONTRACT_KEY, caContractAddress);
  storage.set<u128>(MAX_AMOUNT_PER_ITEM_KEY, maxAmountPerItem);
  storage.set<u128>(MAX_AMOUNT_PER_TIP_KEY, maxAmountPerTip);
  storage.set<bool>(INIT_CONTRACT_KEY, true);
  storage.set<string>(NEAR_NETWORK, network);
  storage.set<string>(senderOrigin, "near/" + network);
  logging.log("Init contract with owner: " + ownerAccountId + "and Connected Accounts contract: " + caContractAddress);
}

//// READ

// Settings

export function getOwnerAccount(): NearAccount | null {
  _active();
  return storage.get<NearAccount>(OWNER_ACCOUNT_KEY);
}

export function getCAContractAddress(): NearAccount | null {
  _active();
  return storage.get<NearAccount>(CA_CONTRACT_KEY);
}

export function getMaxAmountPerItem(): u128 {
  _active();
  return storage.get<u128>(MAX_AMOUNT_PER_ITEM_KEY, u128.Zero)!;
}

export function getMaxAmountPerTip(): u128 {
  _active();
  return storage.get<u128>(MAX_AMOUNT_PER_TIP_KEY, u128.Zero)!;
}

// Tipping

export function getTotalTipsByItemId(itemId: string): u128 {
  _active();
  return totalTipsByItem.get(itemId, u128.Zero)!;
}

export function getTotalTipsByAccount(accountGlobalId: AccountGlobalId): u128 {
  _active();
  return totalTipsByAccountGlobalId.get(accountGlobalId, u128.Zero)!;
}

export function getAvailableTipsByAccount(accountGlobalId: AccountGlobalId): u128 {
  _active();
  return availableTipsByAccountGlobalId.get(accountGlobalId, u128.Zero)!;
}

export function calculateFee(donationAmount: u128): u128 {
  _active();
  return u128.muldiv(donationAmount, u128.from(3), u128.from(100)); // 3%
}

export function getWalletForAutoclaim(accountGId: AccountGlobalId): NearAccount | null {
  _active();
  return walletsForAutoclaim.get(accountGId);
}

//// WRITE

// Settings

export function changeOwnerAccount(newAccountId: NearAccount): void {
  _active();
  _onlyOwner();
  storage.set(OWNER_ACCOUNT_KEY, newAccountId);
  logging.log("Changed owner: " + newAccountId);
}

export function changeCAContract(newContractAddress: NearAccount): void {
  _active();
  _onlyOwner();
  storage.set(CA_CONTRACT_KEY, newContractAddress);
  logging.log("Changed Connected Accounts contract: " + newContractAddress);
}

export function changeMaxAmountPerItem(maxAmountPerItem: u128): void {
  _active();
  _onlyOwner();
  storage.set<u128>(MAX_AMOUNT_PER_ITEM_KEY, maxAmountPerItem);
  logging.log("Changed max amount of item tips: " + maxAmountPerItem.toString());
}

export function changeMaxAmountPerTip(maxAmountPerTip: u128): void {
  _active();
  _onlyOwner();
  storage.set<u128>(MAX_AMOUNT_PER_TIP_KEY, maxAmountPerTip);
  logging.log("Changed max amount of one tip: " + maxAmountPerTip.toString());
}

// Tipping

export function sendTips(accountGId: AccountGlobalId, itemId: string): void {
  _active();
  assert(u128.gt(Context.attachedDeposit, u128.Zero), "Tips amounts must be greater than zero");
  assert(
    u128.le(
      u128.add(totalTipsByItem.get(itemId, u128.Zero)!, Context.attachedDeposit),
      storage.get<u128>(MAX_AMOUNT_PER_ITEM_KEY, u128.Zero)!
    ),
    "New total tips amount exceeds allowance"
  );
  const donationAmount = u128.muldiv(Context.attachedDeposit, u128.from(100), u128.from(103));
  const feeAmount = u128.sub(Context.attachedDeposit, donationAmount);
  assert(
    u128.le(donationAmount, storage.get<u128>(MAX_AMOUNT_PER_TIP_KEY, u128.Zero)!),
    "Tips amount exceeds allowance"
  );
  assert(!u128.eq(feeAmount, u128.Zero), "Donation cannot be free");
  const autoclaimWallet = walletsForAutoclaim.get(accountGId);
  if (!autoclaimWallet) {
    logging.log("A wallet for autoclaim is not determined.");
    _saveTipsInContract(accountGId, donationAmount);
  } else {
    ContractPromiseBatch.create(autoclaimWallet!).transfer(donationAmount);
    logging.log(
      Context.sender + " tips " + donationAmount.toString() + " NEAR to " + accountGId + " <=> " + autoclaimWallet!
    );
  }
  _finishTipping(accountGId, itemId, donationAmount, feeAmount);
}

export function setWalletForAutoclaim(accountGId: AccountGlobalId, wallet: NearAccount): void {
  _active();
  assert(Context.prepaidGas >= 50 * TGAS, "Please attach at least 50 Tgas");
  const cAContractAddress = getCAContractAddress();
  assert(cAContractAddress != null, "Connected Accounts contract is not specified.");
  const callbackArgs = new SetWalletForAutoclaimCallbackArgs(accountGId, wallet);
  if (cAContractAddress) {
    const args: GetCANetArgs = new GetCANetArgs(accountGId);
    const promise: ContractPromise = ContractPromise.create(
      cAContractAddress,
      "getNet",
      args.encode(),
      20 * TGAS,
      NO_DEPOSIT
    );
    const callbackPromise = promise.then(
      Context.contractName,
      "setWalletForAutoclaimCallback",
      callbackArgs,
      20 * TGAS,
      NO_DEPOSIT
    );
    callbackPromise.returnAsResult();
  }
}

export function setWalletForAutoclaimCallback(accountGId: ExternalAccountName, wallet: NearAccount): void {
  _active();
  const response = get_callback_result();
  assert(response.status == XCC_SUCCESS, "There was an error contacting Connected Accounts contract.");
  const connectedAccountsGIds = decode<AccountGlobalId[] | null>(response.buffer);
  assert(
    connectedAccountsGIds != null && connectedAccountsGIds.length != 1,
    `The connected accounts list for ${accountGId} is empty. Connect ${wallet}${
      wallet == Context.sender ? "" : ` and ${Context.sender}`
    } with ${accountGId}.`
  );
  logging.log(`The connected accounts list for ${accountGId} has been received.`);
  const walletGId = wallet + "/" + (storage.get<string>(senderOrigin, "") as string);
  assert(
    connectedAccountsGIds && connectedAccountsGIds.includes(walletGId),
    `${accountGId} is not connected with the ${wallet} in the Connected Accounts service. Connect ${wallet} with ${accountGId}.`
  );
  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! HIDE FOR TESTING !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  assert(
    connectedAccountsGIds &&
      connectedAccountsGIds.includes(Context.sender + "/" + (storage.get<string>(senderOrigin, "") as string)),
    `${accountGId} is not connected with the ${Context.sender} in the Connected Accounts service. Connect ${Context.sender} with ${accountGId}.`
  );
  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  const autoclaimWallet = walletsForAutoclaim.get(accountGId);
  walletsForAutoclaim.set(accountGId, wallet);
  logging.log(
    `${wallet} has been set ${
      autoclaimWallet ? "instead of " + autoclaimWallet + " " : ""
    }for autoclaim from ${accountGId}.`
  );
}

export function deleteWalletForAutoclaim(accountGId: AccountGlobalId): void {
  _active();
  const walletForAutoclaim = walletsForAutoclaim.get(accountGId);
  assert(walletForAutoclaim != null, `Wallet for autoclaim has not been set yet.`);
  if (walletForAutoclaim == Context.sender) {
    walletsForAutoclaim.delete(accountGId);
    return;
  }
  assert(Context.prepaidGas >= 50 * TGAS, "Please attach at least 50 Tgas");
  const cAContractAddress = getCAContractAddress();
  assert(cAContractAddress != null, "Connected Accounts contract is not specified.");
  const callbackArgs = new DeleteWalletForAutoclaimCallbackArgs(accountGId);
  if (cAContractAddress) {
    const senderGId = Context.sender + "/" + (storage.get<string>(senderOrigin, "") as string);
    const args: AreConnectedArgs = new AreConnectedArgs(accountGId, senderGId);
    const promise: ContractPromise = ContractPromise.create(
      cAContractAddress,
      "areConnected",
      args.encode(),
      20 * TGAS,
      NO_DEPOSIT
    );
    const callbackPromise = promise.then(
      Context.contractName,
      "deleteWalletForAutoclaimCallback",
      callbackArgs,
      20 * TGAS,
      NO_DEPOSIT
    );
    callbackPromise.returnAsResult();
  }
}

export function deleteWalletForAutoclaimCallback(accountGId: AccountGlobalId): void {
  _active();
  const response = get_callback_result();
  assert(response.status == XCC_SUCCESS, "There was an error contacting Connected Accounts contract.");
  const areConnected = decode<boolean>(response.buffer);
  const autoclaimWallet = walletsForAutoclaim.get(accountGId);
  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! HIDE FOR TESTING !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  assert(
    areConnected,
    `${accountGId} is not connected with the ${Context.sender} in the Connected Accounts service. Connect ${Context.sender} with ${accountGId}.`
  );
  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  walletsForAutoclaim.delete(accountGId);
  logging.log(`${autoclaimWallet!} has been unset from autoclaim to ${accountGId}.`);
}

export function claimTokens(accountGId: AccountGlobalId): void {
  _active();
  const autoclaimWallet = walletsForAutoclaim.get(accountGId);
  if (autoclaimWallet) {
    _claim(accountGId, autoclaimWallet);
    return;
  }
  assert(Context.prepaidGas >= 50 * TGAS, "Please attach at least 50 Tgas");
  const cAContractAddress = getCAContractAddress();
  assert(cAContractAddress != null, "Connected Accounts contract is not specified.");
  const callbackArgs = new ClaimTokensCallbackArgs(accountGId);
  if (cAContractAddress) {
    const senderGId = Context.sender + "/" + (storage.get<string>(senderOrigin, "") as string);
    const args: AreConnectedArgs = new AreConnectedArgs(accountGId, senderGId);
    const promise: ContractPromise = ContractPromise.create(
      cAContractAddress,
      "areConnected",
      args.encode(),
      20 * TGAS,
      NO_DEPOSIT
    );
    const callbackPromise = promise.then(
      Context.contractName,
      "claimTokensCallback",
      callbackArgs,
      20 * TGAS,
      NO_DEPOSIT
    );
    callbackPromise.returnAsResult();
  }
}

export function claimTokensCallback(accountGId: AccountGlobalId): void {
  _active();
  const response = get_callback_result();
  assert(response.status == XCC_SUCCESS, "There was an error contacting Connected Accounts contract.");
  const areConnected = decode<boolean>(response.buffer);
  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! HIDE FOR TESTING !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  assert(
    areConnected,
    `You can claim tips from ${accountGId} only by sending the transaction by the wallet from its Connected Accounts list.`
  );
  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  // ATTENTION: If autoclaimWallet is not in CA, the Context.sender is set as new autoclaimWallet
  walletsForAutoclaim.set(accountGId, Context.sender);
  logging.log(`${Context.sender} has been set for autoclaim from ${accountGId}.`);
  _claim(accountGId, Context.sender);
}

export function shutdown(): void {
  _onlyOwner();
  storage.set<bool>(INIT_CONTRACT_KEY, false);
  logging.log("Shutdown occured");
}

//// HELPERS

function _onlyOwner(): void {
  assert(storage.get<NearAccount>(OWNER_ACCOUNT_KEY) == Context.sender, "Only owner account can write");
}

function _active(): void {
  assert(storage.getPrimitive<bool>(INIT_CONTRACT_KEY, false) == true, "Contract inactive");
}

function _saveTipsInContract(accountGlobalId: AccountGlobalId, donationAmount: u128): void {
  const availableTips = availableTipsByAccountGlobalId.get(accountGlobalId, u128.Zero)!;
  const newAvailableTips = u128.add(availableTips, donationAmount);
  availableTipsByAccountGlobalId.set(accountGlobalId, newAvailableTips);
  logging.log(Context.sender + " tips " + donationAmount.toString() + " NEAR to " + accountGlobalId);
}

function _finishTipping(accountId: AccountGlobalId, itemId: string, donationAmount: u128, feeAmount: u128): void {
  // update item stat
  const oldTotalTipsByItem = totalTipsByItem.get(itemId, u128.Zero)!;
  const newTotalTipsByItem = u128.add(oldTotalTipsByItem, donationAmount);
  totalTipsByItem.set(itemId, newTotalTipsByItem);

  // update user stat
  const oldTotalTipsByExternal = totalTipsByAccountGlobalId.get(accountId, u128.Zero)!;
  const newTotalTipsByExternal = u128.add(oldTotalTipsByExternal, donationAmount);
  totalTipsByAccountGlobalId.set(accountId, newTotalTipsByExternal);

  // transfer donation fee to owner
  const owner = storage.get<NearAccount>(OWNER_ACCOUNT_KEY)!;
  ContractPromiseBatch.create(owner).transfer(feeAmount);
}

function _claim(from: AccountGlobalId, to: NearAccount): void {
  const availableTips = availableTipsByAccountGlobalId.get(from, u128.Zero)!;
  assert(u128.gt(availableTips, u128.Zero), "No tips to withdraw.");

  ContractPromiseBatch.create(to).transfer(availableTips);
  availableTipsByAccountGlobalId.set(from, u128.Zero);

  logging.log(to + " claimed " + availableTips.toString() + " NEAR from " + from);
}
