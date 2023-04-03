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
  GetConnectedAccountsArgs,
  Account,
  NearAccount,
  ExternalAccountName,
  AccountGlobalId,
  SendTipsToWalletCallbackArgs,
  SetWalletForAutoclaimCallbackArgs,
  DeleteWalletForAutoclaimCallbackArgs,
  ClaimTokensCallbackArgs,
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

export function sendTips(externalAccount: ExternalAccountName, originId: string, itemId: string): void {
  _active();
  assert(Context.prepaidGas >= 50 * TGAS, "Please attach at least 50 Tgas"); // ToDo: perhaps need to increase
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

  const cAContractAddress = getCAContractAddress();
  const accountGlobalId = externalAccount + "/" + originId;
  if (cAContractAddress == null) {
    _saveTipsInContract(accountGlobalId, donationAmount);
    _finishTipping(accountGlobalId, itemId, donationAmount, feeAmount);
  } else {
    const callbackArgs = new SendTipsToWalletCallbackArgs(accountGlobalId, itemId, donationAmount, feeAmount);
    _askForConnectionAccounts<SendTipsToWalletCallbackArgs>(
      externalAccount,
      originId,
      cAContractAddress,
      "sendTipsToWalletCallback",
      callbackArgs
    );
  }
}

export function sendTipsToWalletCallback(
  accountGId: AccountGlobalId,
  itemId: string,
  donationAmount: u128,
  feeAmount: u128
): void {
  _active();
  logging.log(
    "accountId: " +
      accountGId +
      ", itemId: " +
      itemId +
      ", donationAmount: " +
      donationAmount.toString() +
      ", feeAmount: " +
      feeAmount.toString()
  );
  const response = get_callback_result();
  if (response.status == XCC_SUCCESS) {
    const connectedAccounts = decode<Account[][] | null>(response.buffer);
    if (connectedAccounts != null && connectedAccounts.length != 0 && connectedAccounts[0].length != 0) {
      logging.log(`The connected accounts list for ${accountGId} has been received.`);
      const connectedAccountsGIds: AccountGlobalId[] = [];
      for (let i = 0; i < connectedAccounts.length; i++) {
        for (let k = 0; k < connectedAccounts[i].length; k++) {
          connectedAccountsGIds.push(connectedAccounts[i][k].id);
        }
      }
      const autoclaimWallet = walletsForAutoclaim.get(accountGId);
      if (!autoclaimWallet) {
        logging.log("A wallet for autoclaim is not determined.");
        _saveTipsInContract(accountGId, donationAmount);
      } else if (
        !connectedAccountsGIds.includes(autoclaimWallet + "/" + (storage.get<string>(senderOrigin, "") as string))
      ) {
        logging.log("A wallet for autoclaim is not in Connected Accounts list.");
        _saveTipsInContract(accountGId, donationAmount);
      } else {
        ContractPromiseBatch.create(autoclaimWallet!).transfer(donationAmount);
        logging.log(
          Context.sender + " tips " + donationAmount.toString() + " NEAR to " + accountGId + " <=> " + autoclaimWallet!
        );
      }
    } else {
      logging.log(`The connected accounts list for ${accountGId} is empty.`);
      _saveTipsInContract(accountGId, donationAmount);
    }
  } else {
    logging.log("There was an error contacting Connected Accounts contract.");
    _saveTipsInContract(accountGId, donationAmount);
  }
  _finishTipping(accountGId, itemId, donationAmount, feeAmount);
}

export function setWalletForAutoclaim(
  externalAccount: ExternalAccountName,
  originId: string,
  wallet: NearAccount
): void {
  _active();
  assert(Context.prepaidGas >= 50 * TGAS, "Please attach at least 50 Tgas"); // ToDo: perhaps need to increase
  const cAContractAddress = getCAContractAddress();
  assert(cAContractAddress != null, "Connected Accounts contract is not specified.");
  const callbackArgs = new SetWalletForAutoclaimCallbackArgs(externalAccount, originId, wallet);
  if (cAContractAddress)
    _askForConnectionAccounts<SetWalletForAutoclaimCallbackArgs>(
      externalAccount,
      originId,
      cAContractAddress,
      "setWalletForAutoclaimCallback",
      callbackArgs
    );
}

export function setWalletForAutoclaimCallback(
  accountId: ExternalAccountName,
  originId: string,
  wallet: NearAccount
): void {
  _active();
  const response = get_callback_result();
  assert(response.status == XCC_SUCCESS, "There was an error contacting Connected Accounts contract.");
  const connectedAccounts = decode<Account[][] | null>(response.buffer);
  assert(
    connectedAccounts != null && connectedAccounts.length != 0 && connectedAccounts[0].length != 0,
    `The connected accounts list for ${accountId} is empty. Connect ${wallet}${
      wallet == Context.sender ? "" : ` and ${Context.sender}`
    } with ${accountId}.`
  );
  logging.log(`The connected accounts list for ${accountId} has been received.`);
  const connectedAccountsGIds: AccountGlobalId[] = [];
  for (let i = 0; i < connectedAccounts!.length; i++) {
    for (let k = 0; k < connectedAccounts![i].length; k++) {
      connectedAccountsGIds.push(connectedAccounts![i][k].id);
    }
  }
  const accountGId = accountId + "/" + originId;
  const walletGId = wallet + "/" + (storage.get<string>(senderOrigin, "") as string);
  assert(
    connectedAccountsGIds.includes(walletGId),
    `${accountId} is not connected with the ${wallet} in the Connected Accounts service. Connect ${wallet} with ${accountId}.`
  );

  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! HIDE FOR TESTING !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

  // assert(
  //   connectedAccountsGIds.includes(Context.sender + "/" + (storage.get<string>(senderOrigin, "") as string)),
  //   `${accountId} is not connected with the ${Context.sender} in the Connected Accounts service. Connect ${Context.sender} with ${accountId}.`
  // );

  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

  const autoclaimWallet = walletsForAutoclaim.get(accountGId);
  walletsForAutoclaim.set(accountGId, wallet);
  logging.log(
    `${wallet} has been set ${
      autoclaimWallet ? "instead of " + autoclaimWallet + " " : ""
    }for autoclaim from ${accountId}.`
  );
}

export function deleteWalletForAutoclaim(externalAccount: ExternalAccountName, originId: string): void {
  _active();
  const walletForAutoclaim = walletsForAutoclaim.get(externalAccount + "/" + originId);
  assert(walletForAutoclaim != null, `Wallet for autoclaim has not been set yet.`);
  if (walletForAutoclaim == Context.sender) {
    walletsForAutoclaim.delete(externalAccount + "/" + originId);
    return;
  }
  assert(Context.prepaidGas >= 50 * TGAS, "Please attach at least 50 Tgas"); // ToDo: perhaps need to increase
  const cAContractAddress = getCAContractAddress();
  assert(cAContractAddress != null, "Connected Accounts contract is not specified.");
  const callbackArgs = new DeleteWalletForAutoclaimCallbackArgs(externalAccount, originId);
  if (cAContractAddress)
    _askForConnectionAccounts<DeleteWalletForAutoclaimCallbackArgs>(
      externalAccount,
      originId,
      cAContractAddress,
      "deleteWalletForAutoclaimCallback",
      callbackArgs
    );
}

export function deleteWalletForAutoclaimCallback(accountId: ExternalAccountName, originId: string): void {
  _active();
  const response = get_callback_result();
  assert(response.status == XCC_SUCCESS, "There was an error contacting Connected Accounts contract.");
  const connectedAccounts = decode<Account[][] | null>(response.buffer);
  const accountGId = accountId + "/" + originId;
  const autoclaimWallet = walletsForAutoclaim.get(accountGId);
  assert(
    connectedAccounts != null && connectedAccounts.length != 0 && connectedAccounts[0].length != 0,
    `The connected accounts list for ${accountId} is empty. Sign the transaction by ${autoclaimWallet!} to stop autoclaim to it.`
  );
  logging.log(`The connected accounts list for ${accountId} has been received.`);
  const connectedAccountsGIds: AccountGlobalId[] = [];
  for (let i = 0; i < connectedAccounts!.length; i++) {
    for (let k = 0; k < connectedAccounts![i].length; k++) {
      connectedAccountsGIds.push(connectedAccounts![i][k].id);
    }
  }

  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! HIDE FOR TESTING !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

  // assert(
  //   connectedAccountsGIds.includes(Context.sender + "/" + (storage.get<string>(senderOrigin, "") as string)),
  //   `${accountId} is not connected with the ${Context.sender} in the Connected Accounts service. Connect ${Context.sender} with ${accountId}.`
  // );

  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

  walletsForAutoclaim.delete(accountGId);
  logging.log(`${autoclaimWallet!} has been unset from autoclaim to ${accountId}.`);
}

export function claimTokens(accountId: ExternalAccountName, originId: string): void {
  _active();
  assert(Context.prepaidGas >= 50 * TGAS, "Please attach at least 50 Tgas"); // ToDo: perhaps need to increase
  const cAContractAddress = getCAContractAddress();
  assert(cAContractAddress != null, "Connected Accounts contract is not specified.");
  const callbackArgs = new ClaimTokensCallbackArgs(accountId, originId);
  if (cAContractAddress) {
    _askForConnectionAccounts(accountId, originId, cAContractAddress, "claimTokensCallback", callbackArgs);
  }
}

export function claimTokensCallback(accountId: ExternalAccountName, originId: string): void {
  _active();
  const response = get_callback_result();
  assert(response.status == XCC_SUCCESS, "There was an error contacting Connected Accounts contract.");
  const connectedAccounts = decode<Account[][] | null>(response.buffer);
  assert(
    connectedAccounts != null && connectedAccounts.length != 0 && connectedAccounts[0].length != 0,
    `The connected accounts list for ${accountId} is empty. Connect ${Context.sender} with ${accountId}.`
  );
  logging.log(`The connected accounts list for ${accountId} has been received.`);

  const connectedAccountsGIds: AccountGlobalId[] = [];
  for (let i = 0; i < connectedAccounts!.length; i++) {
    for (let k = 0; k < connectedAccounts![i].length; k++) {
      connectedAccountsGIds.push(connectedAccounts![i][k].id);
    }
  }

  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! HIDE FOR TESTING !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

  // assert(
  //   connectedAccountsGIds.includes(Context.sender + "/" + (storage.get<string>(senderOrigin, "") as string)),
  //   `You can claim tips from ${accountId} only by sending the transaction by the wallet from its Connected Accounts list.`
  // );

  // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

  const accountGId = accountId + "/" + originId;
  const autoclaimWallet = walletsForAutoclaim.get(accountGId);

  // ATTENTION: If autoclaimWallet is not in CA, the Context.sender is set as new autoclaimWallet!!!
  if (autoclaimWallet && connectedAccountsGIds.includes(autoclaimWallet)) {
    _claim(accountGId, autoclaimWallet);
  } else {
    walletsForAutoclaim.set(accountGId, Context.sender);
    logging.log(`${Context.sender} has been set for autoclaim from ${accountId}.`);
    _claim(accountGId, Context.sender);
  }
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

function _askForConnectionAccounts<T>(
  accountId: ExternalAccountName,
  originId: string,
  cAContractAddress: string | null,
  callbackName: string,
  callbackArgs: T
): void {
  const args: GetConnectedAccountsArgs = new GetConnectedAccountsArgs(accountId, originId);
  if (cAContractAddress && cAContractAddress != null) {
    const promise: ContractPromise = ContractPromise.create(
      cAContractAddress,
      "getConnectedAccounts",
      args.encode(),
      20 * TGAS, // ToDo: perhaps need to increase
      NO_DEPOSIT
    );

    const callbackPromise = promise.then(
      Context.contractName,
      callbackName,
      callbackArgs,
      20 * TGAS, // ToDo: perhaps need to increase
      NO_DEPOSIT
    );

    callbackPromise.returnAsResult();
  }
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
