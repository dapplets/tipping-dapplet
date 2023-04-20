import { NearNetworks } from '../interfaces';
import { connectWallet } from './identityService';

export class TippingContractService {
  private _contract: any;

  constructor(private _network: NearNetworks, private _address: string) {
    this._contract = Core.contract('near', this._address, {
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
  }

  // VIEW

  async getTotalTipsByItemId(itemId: string): Promise<string> {
    const contract = await this._contract;
    const tipsAmount = await contract.getTotalTipsByItemId({ itemId: itemId });
    return tipsAmount;
  }

  async getAvailableTipsByAccount(accountGlobalId: string): Promise<string> {
    const contract = await this._contract;
    const tipsAmount = await contract.getAvailableTipsByAccount({ accountGlobalId });
    return tipsAmount;
  }

  async calculateFee(donationAmount: string): Promise<string> {
    const contract = await this._contract;
    const donationFee = await contract.calculateFee({ donationAmount });
    return donationFee;
  }

  async getWalletForAutoclaim(accountGId: string): Promise<string | null> {
    const contract = await this._contract;
    const walletForAutoclaim = await contract.getWalletForAutoclaim({ accountGId });
    return walletForAutoclaim;
  }

  // CALL

  async sendTips(accountGId: string, itemId: string, totalAmount: string): Promise<string> {
    await connectWallet(this._network);
    const contract = await this._contract;
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
    await connectWallet(this._network);
    const contract = await this._contract;
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

  async setWalletForAutoclaim(accountGId: string, wallet: string): Promise<void> {
    await connectWallet(this._network);
    const contract = await this._contract;
    await contract.account.functionCall(
      contract.contractId,
      'setWalletForAutoclaim',
      {
        accountGId,
        wallet,
      },
      '100000000000000',
    );
  }

  async deleteWalletForAutoclaim(accountGId: string): Promise<void> {
    await connectWallet(this._network);
    const contract = await this._contract;
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
