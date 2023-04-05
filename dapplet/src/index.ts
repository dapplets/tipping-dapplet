import {} from '@dapplets/dapplet-extension';
import WHITE_ICON from './icons/money-twiter-light.svg';
import DARK_ICON from './icons/money-twiter-dark.svg';
import NEAR_BIG_ICON from './icons/near-big.svg';
import NEAR_SMALL_ICON from './icons/near-small.svg';
import NEAR_LINK_BLACK_ICON from './icons/near-link-black.svg';
import NEAR_LINK_WHITE_ICON from './icons/near-link-white.svg';
import { TippingContractService } from './services/TippingContractService';
import { debounce } from 'lodash';
import { equals, getMilliseconds, lte, sum } from './helpers';
import { ICurrentUser, NearNetworks } from './interfaces';

const { parseNearAmount, formatNearAmount } = Core.near.utils.format;

@Injectable
export default class TippingDapplet {
  @Inject('twitter-adapter.dapplet-base.eth')
  public adapter: any;

  private tippingService: TippingContractService;

  private _stepYocto: string;
  private _network: NearNetworks;
  private _debounceDelay: number;
  private _maxAmountPerItem = '10000000000000000000000000'; // 10 NEAR
  private _maxAmountPerTip = '1000000000000000000000000'; // 1 NEAR

  private _isWaitForCAPendingVRequest = false;
  private _initWidgetFunctioins: { [name: string]: () => Promise<void> } = {};
  executeInitWidgetFunctions = () => Promise.all(Object.values(this._initWidgetFunctioins).map((fn) => fn()));

  async activate(): Promise<void> {
    await this.pasteWidgets();
    Core.onConnectedAccountsUpdate(async () => {
      const network = await Core.getPreferredConnectedAccountsNetwork();
      if (network !== this._network) {
        this.adapter.detachConfig();
        this.pasteWidgets();
      } else {
        this.executeInitWidgetFunctions();
      }
    });
    Core.onWalletsUpdate(this.executeInitWidgetFunctions);
  }

  async pasteWidgets() {
    const step = await Core.storage.get('step');
    const delay = await Core.storage.get('delay');
    this._network = await Core.getPreferredConnectedAccountsNetwork(); // ATTENTION: tipping network depends on the preffered CA network

    // ATTENTION: now tipping works only with testnet
    if (this._network === 'mainnet') {
      alert('ATTENTION: now Tipping Dapplet works only with testnet');
      return;
    }
    if (step <= 0) {
      throw new Error('A donation step must be more than zero. Change the step parameter in the dapplet settings.');
    }
    if (delay <= 0) {
      throw new Error('A delay must be greater than zero. Change the delay parameter in the dapplet settings.');
    }

    this._stepYocto = parseNearAmount(step.toString());
    this._debounceDelay = getMilliseconds(delay);
    this.tippingService = new TippingContractService(this._network);

    const { button, avatarBadge } = this.adapter.exports;

    this.adapter.attachConfig({
      PROFILE: () => [
        button({
          DEFAULT: {
            hidden: true,
            img: { DARK: WHITE_ICON, LIGHT: DARK_ICON },
            tooltip: 'Claim tokens',
            init: this.onProfileButtonClaimInit,
            exec: this.onProfileButtonClaimExec,
          },
        }),
        button({
          DEFAULT: {
            hidden: true,
            img: { DARK: NEAR_LINK_WHITE_ICON, LIGHT: NEAR_LINK_BLACK_ICON },
            init: this.onProfileButtonLinkInit,
            exec: this.onProfileButtonLinkExec,
          },
        }),
        avatarBadge({
          DEFAULT: {
            img: NEAR_BIG_ICON,
            horizontal: 'right',
            vertical: 'bottom',
            hidden: true,
            init: this.onProfileAvatarBadgeInit,
            exec: this.onProfileAvatarBadgeExec,
          },
        }),
      ],
      POST: () => [
        button({
          DEFAULT: {
            img: { DARK: WHITE_ICON, LIGHT: DARK_ICON },
            label: 'Tip',
            tooltip: 'Send donation',
            amount: '0',
            donationsAmount: '0',
            nearAccount: '',
            debouncedDonate: debounce(this.onDebounceDonate, this._debounceDelay),
            init: this.onPostButtonInit,
            exec: this.onPostButtonExec,
          },
        }),
        avatarBadge({
          DEFAULT: {
            img: NEAR_SMALL_ICON,
            basic: true,
            horizontal: 'right',
            vertical: 'bottom',
            hidden: true,
            init: this.onPostAvatarBadgeInit,
            exec: this.onPostAvatarBadgeExec,
          },
        }),
      ],
    });
  }

  onProfileButtonClaimInit = async (profile, me) => {
    const { username, websiteName } = await this.getCurrentUserAsync();
    const isMyProfile = profile.id?.toLowerCase() === username?.toLowerCase();
    if (isMyProfile) {
      this._initWidgetFunctioins[[websiteName, username, 'claim'].join('/')] = () =>
        this.onProfileButtonClaimInit(profile, me);
      const tokens = await this.tippingService.getAvailableTipsByAccount(profile.id + '/' + websiteName.toLowerCase());
      const availableTokens = this.formatNear(tokens);
      if (Number(availableTokens) !== 0) {
        me.label = `Claim ${availableTokens} Ⓝ`;
        me.hidden = false;
      } else {
        me.hidden = true;
      }
    } else {
      me.hidden = true;
    }
  };

  onProfileButtonClaimExec = async (profile, me) => {
    const { websiteName } = await this.getCurrentUserAsync();
    try {
      const connectedAccounts = await Core.connectedAccounts.getConnectedAccounts(
        profile.id,
        websiteName.toLowerCase(),
      );
      const nearAccountsFromCA = connectedAccounts
        .flat()
        .filter((ca) => ca.id.indexOf('near/testnet') !== -1)
        .map((a) => a.id.split('/')[0]);
      if (nearAccountsFromCA.length === 0) {
        alert(
          'You must link your NEAR account to your Twitter account using the Connected Accounts service. Click |⋈ Link| button to continue.',
        );
        return;
      }
      const accountGId = profile.id + '/' + websiteName.toLowerCase();
      const tokens = await this.tippingService.getAvailableTipsByAccount(accountGId);
      const availableTokens = this.formatNear(tokens);
      me.disabled = true;
      me.loading = true;
      me.label = 'Waiting...';
      const prevSessions = await Core.sessions();
      const prevSession = prevSessions.find((x) => x.authMethod === 'near/' + this._network);
      const session = prevSession ?? (await Core.login({ authMethods: ['near/' + this._network] }));
      const wallet = await session.wallet();
      if (!nearAccountsFromCA.includes(wallet.accountId)) {
        alert(
          'You have connected accounts: ' + nearAccountsFromCA.join(', ') + '. Login with one of them to continue.',
        );
      } else {
        const txHash = await this.tippingService.claimTokens(accountGId);
        const explorerUrl =
          this._network === NearNetworks.Mainnet ? 'https://explorer.near.org' : 'https://explorer.testnet.near.org';
        alert(
          `Claimed ${availableTokens} $NEAR with @tippingdapplet. ` + `Tx link: ${explorerUrl}/transactions/${txHash}`,
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      me.disabled = false;
      me.loading = false;
      this.executeInitWidgetFunctions();
    }
  };

  onProfileButtonLinkInit = async (profile, me) => {
    const { username, websiteName } = await this.getCurrentUserAsync();
    const isMyProfile = profile.id.toLowerCase() === username?.toLowerCase();
    const parsedNearAccount = this.parseNearId(profile.authorFullname, this._network);

    if (isMyProfile) {
      this._initWidgetFunctioins[[websiteName, username, 'link'].join('/')] = () =>
        this.onProfileButtonLinkInit(profile, me);
      const connectedAccounts = await Core.connectedAccounts.getConnectedAccounts(username, 'twitter');
      const walletForAutoclaim = await this.tippingService.getWalletForAutoclaim(
        username + '/' + websiteName.toLowerCase(),
      );
      const pendingRequestsIds = await Core.connectedAccounts.getPendingRequests();
      let pendingRequest = null;
      let madeRequestId = -1;
      if (!walletForAutoclaim && pendingRequestsIds && pendingRequestsIds.length) {
        const requests = await Promise.all(
          pendingRequestsIds.map((pendingRequest) => Core.connectedAccounts.getVerificationRequest(pendingRequest)),
        );
        const gId = username + '/' + websiteName.toLowerCase();
        requests.forEach((request, i) => {
          if (request.firstAccount === gId || request.secondAccount === gId) {
            pendingRequest = request;
            madeRequestId = pendingRequestsIds[i];
          }
        });
      }
      if (walletForAutoclaim) {
        me.hidden = false;
        me.label = 'Unlink';
        me.tooltip = `Disable autoclaim from @${username} to ${walletForAutoclaim} NEAR wallet.`;
        me.hidden = false;
      } else if (madeRequestId !== -1 && pendingRequest) {
        if (this._isWaitForCAPendingVRequest) {
          return;
        } else {
          this._isWaitForCAPendingVRequest = true;
          me.label = 'Waiting...';
          me.hidden = false;
          const requestStatus = await this.waitForCAVerificationRequestResolve(madeRequestId);
          this._isWaitForCAPendingVRequest = false;
          alert(
            (pendingRequest.isUnlink ? 'Disconnection of ' : 'Connection of ') +
              pendingRequest.firstAccount.split('/')[0] +
              ' and ' +
              pendingRequest.secondAccount.split('/')[0] +
              ' has been ' +
              requestStatus,
          );
          this.executeInitWidgetFunctions();
        }
      } else if (connectedAccounts?.[0]?.[0]) {
        me.hidden = true;
      } else {
        me.label = 'Link';
        me.tooltip = `Link ${
          parsedNearAccount ? parsedNearAccount + ' ' : ''
        }account to @${username} using Connected Accounts smart contract`;
        me.hidden = false;
      }
    } else {
      me.hidden = true;
    }
  };

  onProfileButtonLinkExec = async (profile: { id: string; authorFullname: string }, me) => {
    const parsiedNearAccount = this.parseNearId(profile.authorFullname, this._network);
    const { websiteName, fullname, img } = await this.getCurrentUserAsync();
    const websiteNameLowerCase = websiteName.toLowerCase();
    try {
      const accountGId = profile.id + '/' + websiteName.toLowerCase();
      const walletForAutoclaim = await this.tippingService.getWalletForAutoclaim(accountGId);
      me.disabled = true;
      me.loading = true;
      me.label = 'Waiting...';
      if (walletForAutoclaim) {
        // unlink
        await this.tippingService.deleteWalletForAutoclaim(accountGId);
      } else {
        // link
        if (!parsiedNearAccount) {
          const exampleWallet = this._network === NearNetworks.Testnet ? 'yourwallet.testnet' : 'yourwallet.near';
          alert(
            `Before you continue, add your NEAR account ID to your ${websiteName} profile name. ` +
              'This is necessary for Oracle so that it can make sure that you own this Twitter account. ' +
              'After linking you can remove it back.\n' +
              `For example: "${profile.authorFullname} (${exampleWallet})"\n`,
          );
        } else {
          const prevSessions = await Core.sessions();
          const prevSession = prevSessions.find((x) => x.authMethod === 'near/' + this._network);
          const session = prevSession ?? (await Core.login({ authMethods: ['near/' + this._network] }));
          const wallet = await session.wallet();
          if (parsiedNearAccount !== wallet.accountId) {
            alert(
              `Check the wallet in your ${websiteName} profile name. ` +
                'It should be the same as you use for login. Now you logged in with ' +
                `${wallet.accountId}, and the wallet in your profile is ${parsiedNearAccount}.`,
            );
          } else {
            const args = {
              firstAccountId: profile.id,
              firstOriginId: websiteNameLowerCase,
              firstAccountImage: img,
              secondAccountId: parsiedNearAccount,
              secondOriginId: 'near/' + this._network,
              secondAccountImage: null,
              isUnlink: false,
              firstProofUrl: 'https://' + websiteNameLowerCase + '.com/' + profile.id,
            };
            const condition = {
              type: `${websiteNameLowerCase}/near-${this._network}`,
              user: fullname,
            };
            await Core.connectedAccounts.requestVerification(args, condition);
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      me.disabled = false;
      me.loading = false;
      this.executeInitWidgetFunctions();
    }
  };

  onProfileAvatarBadgeInit = async (profile, me) => {
    const { websiteName } = await this.getCurrentUserAsync();
    const nearAccount = await this.tippingService.getWalletForAutoclaim(profile.id + '/' + websiteName.toLowerCase());
    this._initWidgetFunctioins[[websiteName, profile.id, 'profile/badge'].join('/')] = () =>
      this.onProfileAvatarBadgeInit(profile, me);
    if (nearAccount) {
      me.hidden = false;
      me.tooltip = nearAccount;
      me.nearAccount = nearAccount;
    } else {
      me.hidden = true;
    }
  };

  onProfileAvatarBadgeExec = (_, me) => {
    if (this._network === NearNetworks.Testnet) {
      window.open(`https://explorer.testnet.near.org/accounts/${me.nearAccount}`, '_blank');
    } else if (this._network === NearNetworks.Mainnet) {
      window.open(`https://explorer.near.org/accounts/${me.nearAccount}`, '_blank');
    } else {
      throw new Error('Unsupported network');
    }
  };

  onPostButtonInit = async (post, me) => {
    const { websiteName } = await this.getCurrentUserAsync();
    this._initWidgetFunctioins[[websiteName, post.id, 'post/button'].join('/')] = () => this.onPostButtonInit(post, me);
    if (post.id && post.authorUsername) {
      me.hidden = false;
      me.donationsAmount = await this.tippingService.getTotalTipsByItemId('tweet/' + post.id);
      if (equals(me.donationsAmount, '0')) {
        me.label = 'Tip';
        return;
      }
      if (Number(this.formatNear(me.donationsAmount)) === 10) me.disabled = true;
      me.label = this.formatNear(me.donationsAmount) + ' NEAR';
    } else {
      me.hidden = true;
    }
  };

  onDebounceDonate = async (me: any, externalAccount: string, tweetId: string, amount: string) => {
    try {
      const { websiteName } = await this.getCurrentUserAsync();
      me.loading = true;
      me.disabled = true;
      const fee = await this.tippingService.calculateFee(amount);
      const total = sum(amount, fee);
      if (
        confirm(
          `You're tipping ${Core.near.utils.format.formatNearAmount(
            amount,
          )} Ⓝ to "@${externalAccount}" at "${websiteName}".\n` +
            `A tiny fee of ${Core.near.utils.format.formatNearAmount(fee)} Ⓝ for project development will be added.\n` +
            `Thank you for your support!`,
        )
      ) {
        const txHash = await this.tippingService.sendTips(
          externalAccount + '/' + websiteName.toLowerCase(),
          'tweet/' + tweetId,
          total,
        );
        const explorerUrl =
          this._network === NearNetworks.Mainnet ? 'https://explorer.near.org' : 'https://explorer.testnet.near.org';
        alert(
          `Tipped ${Core.near.utils.format.formatNearAmount(amount)} $NEAR with @tippingdapplet. ` +
            `Tx link: ${explorerUrl}/transactions/${txHash}`,
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      me.donationsAmount = await this.tippingService.getTotalTipsByItemId('tweet/' + tweetId);
      me.loading = false;
      me.disabled = false;
      me.amount = '0';
      me.label = equals(me.donationsAmount, '0') ? 'Tip' : this.formatNear(me.donationsAmount) + ' NEAR';
      this.executeInitWidgetFunctions();
    }
  };

  onPostButtonExec = async (tweet, me) => {
    const donationsAmount = Number(this.formatNear(me.donationsAmount));
    const donation = Number(this.formatNear(me.amount));
    const stepYocto = Number(this.formatNear(this._stepYocto));
    const result = Number((donationsAmount + donation + stepYocto).toFixed(2));

    if (result > 10) return (me.disabled = true);

    if (
      lte(sum(me.donationsAmount, me.amount, this._stepYocto), this._maxAmountPerItem) &&
      lte(sum(me.amount, this._stepYocto), this._maxAmountPerTip)
    ) {
      me.amount = sum(me.amount, this._stepYocto);
      me.label = this.formatNear(me.donationsAmount) + ' + ' + this.formatNear(me.amount) + ' NEAR';
    }

    me.debouncedDonate(me, tweet.authorUsername, tweet.id, me.amount);
  };

  onPostAvatarBadgeInit = async (post, me) => {
    try {
      const { websiteName } = await this.getCurrentUserAsync();
      this._initWidgetFunctioins[[websiteName, post.id, 'post/badge'].join('/')] = () =>
        this.onPostAvatarBadgeInit(post, me);
      if (post?.authorUsername && websiteName) {
        const nearAccount = await this.tippingService.getWalletForAutoclaim(
          post.authorUsername + '/' + websiteName.toLowerCase(),
        );
        if (nearAccount) {
          me.tooltip = nearAccount;
          me.nearAccount = nearAccount;
          me.hidden = false;
        } else {
          me.tooltip = '';
          me.nearAccount = '';
          me.hidden = true;
        }
      }
    } catch (err) {
      console.log(err);
    }
  };

  onPostAvatarBadgeExec = (ctx, me) => {
    if (this._network === NearNetworks.Testnet) {
      window.open(`https://explorer.testnet.near.org/accounts/${me.nearAccount}`, '_blank');
    } else if (this._network === NearNetworks.Mainnet) {
      window.open(`https://explorer.near.org/accounts/${me.nearAccount}`, '_blank');
    } else {
      throw new Error('Unsupported network');
    }
  };

  parseNearId(fullname: string, network: string): string | null {
    const regExpMainnet = /(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+\.near/;
    const regExpTestnet = /(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+\.testnet/;
    const nearId = fullname.toLowerCase().match(network === NearNetworks.Testnet ? regExpTestnet : regExpMainnet);

    return nearId && nearId[0];
  }

  formatNear(amount: string): string {
    return Number(formatNearAmount(amount, 4)).toFixed(2);
  }

  async getCurrentUserAsync(): Promise<ICurrentUser> {
    for (let i = 0; i < 10; i++) {
      try {
        const user: ICurrentUser = this.adapter.getCurrentUser();
        return user;
      } catch (e) {
        console.error(e);
      }
      await new Promise((res) => setTimeout(res, 500));
    }
    return { websiteName: '' };
  }

  waitForCAVerificationRequestResolve = async (id: number): Promise<any> => {
    try {
      const requestStatus = await Core.connectedAccounts.getRequestStatus(id);
      if (requestStatus === 'pending') {
        await new Promise((res) => setTimeout(res, 5000));
        return this.waitForCAVerificationRequestResolve(id);
      } else {
        return requestStatus;
      }
    } catch (err) {
      console.log(err);
    }
  };
}
