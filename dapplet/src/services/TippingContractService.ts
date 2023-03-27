import { NearNetworks } from '../interfaces';

export class TippingContractService {
  private _contract: any;

  constructor(network: NearNetworks) {
    const address =
      network === NearNetworks.Testnet
        ? 'dev-1679584536742-83217475458076'
        : // : network === NearNetworks.Mainnet
          // ? ''
          null;

    if (address === null) throw new Error('Unsupported network');

    this._contract = Core.contract('near', address, {
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
      network,
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
    console.log('### inside getWalletForAutoclaim(accountGId: string) in dapplet');
    const walletForAutoclaim = await contract.getWalletForAutoclaim({ accountGId });
    console.log('### walletForAutoclaim', walletForAutoclaim);
    return walletForAutoclaim;
  }

  // CALL

  async sendTips(externalAccount: string, originId: string, itemId: string, totalAmount: string): Promise<string> {
    const contract = await this._contract;
    const rawResult = await contract.account.functionCall(
      contract.contractId,
      'sendTips',
      {
        externalAccount,
        originId,
        itemId,
      },
      '300000000000000',
      totalAmount,
    );
    return rawResult.transaction.hash;
  }

  async claimTokens(accountId: string, originId: string): Promise<string> {
    const contract = await this._contract;
    const rawResult = await contract.account.functionCall(
      contract.contractId,
      'claimTokens',
      {
        accountId,
        originId,
      },
      '300000000000000',
    );
    return rawResult.transaction.hash;
  }

  async setWalletForAutoclaim(externalAccount: string, originId: string, wallet: string): Promise<void> {
    const contract = await this._contract;
    await contract.account.functionCall(
      contract.contractId,
      'setWalletForAutoclaim',
      {
        externalAccount,
        originId,
        wallet,
      },
      '300000000000000',
    );
  }

  async deleteWalletForAutoclaim(externalAccount: string, originId: string): Promise<void> {
    const contract = await this._contract;
    await contract.account.functionCall(
      contract.contractId,
      'deleteWalletForAutoclaim',
      {
        externalAccount,
        originId,
      },
      '300000000000000',
    );
  }
}
