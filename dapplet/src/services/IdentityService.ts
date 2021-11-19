type NearAccount = string;
type ExternalAccount = string;

export class IdentityService {
  private contract = Core.contract('near', 'app.tipping.testnet', {
    viewMethods: ['getNearAccount', 'getMinStakeAmount'],
    changeMethods: ['requestVerification'],
  });

  private _nearByExternal = new Map<ExternalAccount, NearAccount>();

  public async getNearAccount(externalAccount: ExternalAccount): Promise<NearAccount> {
    const contract = await this.contract;

    // caching requests
    if (!this._nearByExternal.has(externalAccount)) {
      this._nearByExternal.set(externalAccount, contract.getNearAccount({ externalAccount }));
    }

    return this._nearByExternal.get(externalAccount);
  }

  public async requestVerification(externalAccount: ExternalAccount, isUnlink: boolean, url: string): Promise<void> {
    const contract = await this.contract;
    const stake = await contract.getMinStakeAmount();
    const requestId = await contract.requestVerification({ externalAccount, isUnlink, url }, undefined, stake);
    console.log('requestId', requestId);
  }
}
