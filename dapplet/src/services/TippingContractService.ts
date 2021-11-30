import { NearNetwork } from '../interfaces';

export class TippingContractService {
  private _contract: any;

  constructor(network: NearNetwork) {
    const address =
      network === NearNetwork.TESTNET
        ? 'app.tipping.testnet'
        : network === NearNetwork.MAINNET
        ? 'app.tipping.near'
        : null;

    if (address === null) throw new Error('Unsupported network');

    this._contract = Core.contract('near', address, {
      viewMethods: [
        'getNearAccount',
        'getMinStakeAmount',
        'getTotalTipsByItemId',
        'getTotalTipsByExternalAccount',
        'getAvailableTipsByExternalAccount',
      ],
      changeMethods: ['sendTips', 'claimTokens'],
      network,
    });
  }

  async getTotalDonationByItem(itemId: string): Promise<string> {
    const contract = await this._contract;
    const tipsAmount = await contract.getTotalTipsByItemId({ itemId: itemId });
    return tipsAmount;
  }

  async donateByTweet(externalAccount: string, itemId: string, amount: string): Promise<void> {
    const contract = await this._contract;
    await contract.sendTips(
      {
        recipientExternalAccount: externalAccount,
        itemId: itemId,
      },
      undefined,
      amount,
    );
  }

  async getAvailableTipsByExternalAccount(externalAccount: string): Promise<string> {
    const contract = await this._contract;
    const tipsAmount = await contract.getAvailableTipsByExternalAccount({ externalAccount });
    return tipsAmount;
  }

  async claimTokens(): Promise<void> {
    const contract = await this._contract;
    await contract.claimTokens();
  }
}
