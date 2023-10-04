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
    return this._contract;
  }

  private async _addInteractionsWithFunctionalKey(session: any): Promise<any> {
    this._contract = await session.contract(this._address, {
      viewMethods: TippingContractService.viewMethods,
      changeMethods: TippingContractService.changeMethods,
    });
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
    const rawResult = await this._contractCall({
      methodName: 'sendTips',
      args: {
        accountGId,
        itemId,
      },
      gas: '50000000000000',
      attachedDeposit: totalAmount,
    });
    return rawResult.transaction.hash;
  }

  async claimTokens(accountGId: string): Promise<string> {
    const rawResult = await this._contractCall({
      methodName: 'claimTokens',
      args: {
        accountGId,
      },
      gas: '100000000000000',
    });
    return rawResult.transaction.hash;
  }

  async setWalletForAutoclaim(accountGId: string, wallet: string): Promise<string> {
    const rawResult = await this._contractCall({
      methodName: 'setWalletForAutoclaim',
      args: {
        accountGId,
        wallet,
      },
      gas: '100000000000000',
    });
    return rawResult.transaction.hash;
  }

  async deleteWalletForAutoclaim(accountGId: string): Promise<string> {
    const rawResult = await this._contractCall({
      methodName: 'deleteWalletForAutoclaim',
      args: {
        accountGId,
      },
      gas: '100000000000000',
    });
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

  async _contractCall(props: { methodName: string; args: any; gas: string; attachedDeposit?: string }): Promise<any> {
    const { account, contractId } = await this._getContractForCallRequests();

    // Resolve difference between old and new near-api-js APIs
    const isNewNearApi = (<any>Core).extension?.satisfied?.('>=0.63.0-alpha.1');
    const contractCallArgs = isNewNearApi
      ? [{ contractId, ...props }]
      : [contractId, props.methodName, props.args, props.gas, props.attachedDeposit];
    return account.functionCall(...contractCallArgs);
  }
}

export default TippingContractService;
