import { NearNetwork } from '../interfaces';

type NearAccount = string;
type ExternalAccount = string;

export class IdentityService {
  private _contract: any;
  private _nearByExternal = new Map<ExternalAccount, NearAccount>();

  constructor(network: NearNetwork) {
    const address =
      network === NearNetwork.TESTNET
        ? 'app.tipping.testnet'
        : network === NearNetwork.MAINNET
        ? 'app.tipping.near'
        : null;

    if (address === null) throw new Error('Unsupported network');

    this._contract = Core.contract('near', address, {
      viewMethods: ['getNearAccount', 'getMinStakeAmount', 'getRequestStatus'],
      changeMethods: ['requestVerification'],
      network,
    });
  }

  public async getNearAccount(externalAccount: ExternalAccount, isNoCache = false): Promise<NearAccount> {
    const contract = await this._contract;

    // caching requests
    if (!this._nearByExternal.has(externalAccount) || isNoCache) {
      this._nearByExternal.set(externalAccount, contract.getNearAccount({ externalAccount }));
    }

    return this._nearByExternal.get(externalAccount);
  }

  public async requestVerification(externalAccount: ExternalAccount, isUnlink: boolean, url: string): Promise<void> {
    const contract = await this._contract;
    const stake = await contract.getMinStakeAmount();
    const requestId = await contract.requestVerification({ externalAccount, isUnlink, url }, undefined, stake);

    await new Promise<void>((res, rej) => {
      const timerId = setInterval(async () => {
        const status = await contract.getRequestStatus({ id: requestId });
        if (status === 0) {
          // not found
          console.log(`Verification request ${requestId} is NOT FOUND`);
          clearInterval(timerId);
          rej("Exception: request id doesn't exist in the contract.");
        } else if (status === 2) {
          // approved
          console.log(`Verification request ${requestId} is APPROVED`);
          clearInterval(timerId);
          res();
        } else if (status === 3) {
          // rejected
          console.log(`Verification request ${requestId} is REJECTED`);
          clearInterval(timerId);
          rej('The oracle rejected your verification request.');
        } else {
          // pending
          console.log(`Verification request ${requestId} is PENDING`);
        }
      }, 5000);
    });
  }
}
