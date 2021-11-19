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

  async getTotalDonationByItem(itemId: string): Promise<number> {
    const contract = await this.contract;
    const tipsAmount = await contract.getTotalTipsByItemId({ itemId: itemId });
    return Number(formatNearAmount(tipsAmount));
  }

  async donateByTweet(externalAccount: string, itemId: string, amount: number): Promise<void> {
    const contract = await this.contract;
    await contract.sendTips({
      recipientExternalAccount: externalAccount,
      itemId: itemId,
    }, undefined, amount);
  }

  async getAvailableTipsByExternalAccount(externalAccount: string): Promise<number> {
    const contract = await this.contract;
    const tipsAmount = await contract.getAvailableTipsByExternalAccount({ externalAccount });
    return Number(formatNearAmount(tipsAmount));
  }

  async claimTokens(): Promise<void> {
    const contract = await this.contract;
    await contract.claimTokens();
  }
}
