import { NearNetworks } from '../interfaces';
import { getSession } from './identityService';
import * as packageInfo from '../../package.json';

class TippingContractService {
  private _contract: any;
  static viewMethods = [
    'getMaxAmountPerItem',
    'getMaxAmountPerTip',
    'getTotalTipsByItemId',
    'getTotalTipsByAccount',
    'getAvailableTipsByAccount',
    'calculateFee',
    'getWalletForAutoclaim',
  ];
  static changeMethods = ['sendTips', 'claimTokens', 'setWalletForAutoclaim', 'deleteWalletForAutoclaim'];

  constructor(private _network: NearNetworks, private _address: string) {}

  // CREATE CONTRACT

  private async _createContractForViewRequests(): Promise<any> {
    this._contract = await Core.contract('near', this._address, {
      viewMethods: TippingContractService.viewMethods,
      changeMethods: TippingContractService.changeMethods,
      network: this._network,
    });
    console.log('1 manifest.name', this._contract.account._app === packageInfo?.name);
    return this._contract;
  }

  private async _addInteractionsWithFunctionalKey(session: any): Promise<any> {
    this._contract = await session.contract(this._address, {
      viewMethods: TippingContractService.viewMethods,
      changeMethods: TippingContractService.changeMethods,
    });
    console.log('2 manifest.name', this._contract.account._app === packageInfo?.name);
    return this._contract;
  }

  // VIEW

  async getTotalTipsByItemId(itemId: string): Promise<string> {
    const contract = await this._getContractForViewRequests();
    return contract.getTotalTipsByItemId({ itemId: itemId });
  }

  async getAvailableTipsByAccount(accountGlobalId: string): Promise<string> {
    const contract = await this._getContractForViewRequests();
    return contract.getAvailableTipsByAccount({ accountGlobalId });
  }

  async calculateFee(donationAmount: string): Promise<string> {
    const contract = await this._getContractForViewRequests();
    return contract.calculateFee({ donationAmount });
  }

  async getWalletForAutoclaim(accountGId: string): Promise<string | null> {
    const contract = await this._getContractForViewRequests();
    return contract.getWalletForAutoclaim({ accountGId });
  }

  // CALL

  async sendTips(accountGId: string, itemId: string, totalAmount: string): Promise<string> {
    const contract = await this._getContractForCallRequests();
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
    const contract = await this._getContractForCallRequests();
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
    const contract = await this._getContractForCallRequests();
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

  async deleteWalletForAutoclaim(accountGId: string): Promise<string> {
    const contract = await this._getContractForCallRequests();
    const rawResult = await contract.account.functionCall(
      contract.contractId,
      'deleteWalletForAutoclaim',
      {
        accountGId,
      },
      '100000000000000',
    );
    return rawResult.transaction.hash;
  }

  // INTERNAL

  async _getContractForViewRequests(): Promise<any> {
    return this._contract || this._createContractForViewRequests();
  }

  async _getContractForCallRequests(): Promise<any> {
    if (this._contract.account._app === packageInfo?.name) {
      const session = await getSession(this._network, this._address);
      await this._addInteractionsWithFunctionalKey(session);
    }
    return this._contract;
  }
}

export default TippingContractService;
