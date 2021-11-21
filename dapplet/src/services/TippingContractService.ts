const { formatNearAmount } = Core.near.utils.format;

export class TippingContractService {
  private contract = Core.contract('near', 'app.tipping.testnet', {
    viewMethods: [
      'getNearAccount',
      'getMinStakeAmount',
      'getTotalTipsByItemId',
      'getTotalTipsByExternalAccount',
      'getAvailableTipsByExternalAccount',
    ],
    changeMethods: ['sendTips', 'claimTokens'],
  });

  async getTotalDonationByItem(itemId: string): Promise<string> {
    const contract = await this.contract;
    const tipsAmount = await contract.getTotalTipsByItemId({ itemId: itemId });
    return tipsAmount;
  }

  async donateByTweet(externalAccount: string, itemId: string, amount: string): Promise<void> {
    const contract = await this.contract;
    await contract.sendTips({
      recipientExternalAccount: externalAccount,
      itemId: itemId,
    }, undefined, amount);
  }

  async getAvailableTipsByExternalAccount(externalAccount: string): Promise<string> {
    const contract = await this.contract;
    const tipsAmount = await contract.getAvailableTipsByExternalAccount({ externalAccount });
    return tipsAmount;
  }

  async claimTokens(): Promise<void> {
    const contract = await this.contract;
    await contract.claimTokens();
  }
}
