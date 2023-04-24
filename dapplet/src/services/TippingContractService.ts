import { NearNetworks } from '../interfaces';
import { getSession } from './identityService';

export class TippingContractService {
  private _contract: any;

  constructor(private _network: NearNetworks, private _address: string) {}

  // CREATE CONTRACT

  async createContractForViewRequests() {
    this._contract = await Core.contract('near', this._address, {
      viewMethods: [
        'getMaxAmountPerItem',
        'getMaxAmountPerTip',
        'getTotalTipsByItemId',
        'getTotalTipsByAccount',
        'getAvailableTipsByAccount',
        'calculateFee',
        'getWalletForAutoclaim',
      ],
      changeMethods: ['sendTips', 'claimTokens', 'setWalletForAutoclaim', 'deleteWalletForAutoclaim'],
      network: this._network,
    });
    return this._contract;
  }

  async addInteractionsWithFunctionalKey(session: any) {
    this._contract = await session.contract(this._address, {
      viewMethods: [
        'getMaxAmountPerItem',
        'getMaxAmountPerTip',
        'getTotalTipsByItemId',
        'getTotalTipsByAccount',
        'getAvailableTipsByAccount',
        'calculateFee',
        'getWalletForAutoclaim',
      ],
      changeMethods: ['sendTips', 'claimTokens', 'setWalletForAutoclaim', 'deleteWalletForAutoclaim'],
    });
    return this._contract;
  }

  // VIEW

  async getTotalTipsByItemId(itemId: string): Promise<string> {
    const contract = this._contract || (await this.createContractForViewRequests());
    const tipsAmount = await contract.getTotalTipsByItemId({ itemId: itemId });
    return tipsAmount;
  }

  async getAvailableTipsByAccount(accountGlobalId: string): Promise<string> {
    const contract = this._contract || (await this.createContractForViewRequests());
    const tipsAmount = await contract.getAvailableTipsByAccount({ accountGlobalId });
    return tipsAmount;
  }

  async calculateFee(donationAmount: string): Promise<string> {
    const contract = this._contract || (await this.createContractForViewRequests());
    const donationFee = await contract.calculateFee({ donationAmount });
    return donationFee;
  }

  async getWalletForAutoclaim(accountGId: string): Promise<string | null> {
    const contract = this._contract || (await this.createContractForViewRequests());
    const walletForAutoclaim = await contract.getWalletForAutoclaim({ accountGId });
    return walletForAutoclaim;
  }

  // CALL

  async sendTips(accountGId: string, itemId: string, totalAmount: string): Promise<string> {
    const session = await getSession(this._network, this._address);
    await this.addInteractionsWithFunctionalKey(session);
    const contract = this._contract;
    const rawResult = await contract.account.functionCall(
      contract.contractId,
      'sendTips',
      {
        accountGId,
        itemId,
      },
      '50000000000000',
      totalAmount,
    );
    return rawResult.transaction.hash;
  }

  async claimTokens(accountGId: string): Promise<string> {
    const session = await getSession(this._network, this._address);
    await this.addInteractionsWithFunctionalKey(session);
    const contract = this._contract;
    const rawResult = await contract.account.functionCall(
      contract.contractId,
      'claimTokens',
      {
        accountGId,
      },
      '100000000000000',
    );
    return rawResult.transaction.hash;
  }

  async setWalletForAutoclaim(accountGId: string, wallet: string): Promise<string> {
    const session = await getSession(this._network, this._address);
    await this.addInteractionsWithFunctionalKey(session);
    const contract = this._contract;
    const rawResult = await contract.account.functionCall(
      contract.contractId,
      'setWalletForAutoclaim',
      {
        accountGId,
        wallet,
      },
      '100000000000000',
    );
    return rawResult.transaction.hash;
  }

  async deleteWalletForAutoclaim(accountGId: string): Promise<void> {
    const session = await getSession(this._network, this._address);
    await this.addInteractionsWithFunctionalKey(session);
    const contract = this._contract;
    await contract.account.functionCall(
      contract.contractId,
      'deleteWalletForAutoclaim',
      {
        accountGId,
      },
      '100000000000000',
    );
  }
}
