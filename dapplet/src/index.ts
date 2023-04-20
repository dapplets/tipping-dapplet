import {} from '@dapplets/dapplet-extension';
import WHITE_ICON from './icons/money-twiter-light.svg';
import DARK_ICON from './icons/money-twiter-dark.svg';
import NEAR_BIG_ICON from './icons/near-big.svg';
import NEAR_SMALL_ICON from './icons/near-small.svg';
import NEAR_LINK_BLACK_ICON from './icons/near-link-black.svg';
import NEAR_LINK_WHITE_ICON from './icons/near-link-white.svg';
import { TippingContractService } from './services/TippingContractService';
import {
  connectWallet,
  createAccountGlobalId,
  getNearAccountsFromCa,
  makeNewCAConnection,
  getCAPendingRequest,
  waitForCAVerificationRequestResolve,
} from './services/identityService';
import { debounce } from 'lodash';
import { equals, getMilliseconds, lte, sum, parseNearId, formatNear } from './helpers';
import { ICurrentUser, NearNetworks } from './interfaces';

const { parseNearAmount } = Core.near.utils.format;
const TIPPING_TESTNET_CONTRACT_ADDRESS = 'dev-1680593274075-24217258210681';
const TIPPING_MAINNET_CONTRACT_ADDRESS = null;

@Injectable
export default class TippingDapplet {
  @Inject('twitter-adapter.dapplet-base.eth')
  public adapter: any;

  private _network: NearNetworks;
  private _tippingContractAddress: string;
  private _tippingService: TippingContractService;

  private _stepYocto: string;
  private _debounceDelay: number;
  private _maxAmountPerItem = '10000000000000000000000000'; // 10 NEAR
  private _maxAmountPerTip = '1000000000000000000000000'; // 1 NEAR

  private _isWaitForCAPendingVRequest = false;
  private _initWidgetFunctions: { [name: string]: () => Promise<void> } = {};
  executeInitWidgetFunctions = () => Promise.all(Object.values(this._initWidgetFunctions).map((fn) => fn()));

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
    // ATTENTION: now tipping works only with testnet
    this._network = await Core.getPreferredConnectedAccountsNetwork(); // ATTENTION: tipping network depends on the preffered CA network
    if (this._network === 'mainnet') {
      alert('ATTENTION: now Tipping Dapplet works only with testnet');
      return;
    }
    this._tippingContractAddress =
      this._network === NearNetworks.Testnet ? TIPPING_TESTNET_CONTRACT_ADDRESS : TIPPING_MAINNET_CONTRACT_ADDRESS;
    if (this._tippingContractAddress === null) throw new Error('Unsupported network');
    this._tippingService = new TippingContractService(this._network, this._tippingContractAddress);

    const step = await Core.storage.get('step');
    const delay = await Core.storage.get('delay');
    if (step <= 0) {
      throw new Error('A donation step must be more than zero. Change the step parameter in the dapplet settings.');
    }
    if (delay <= 0) {
      throw new Error('A delay must be greater than zero. Change the delay parameter in the dapplet settings.');
    }
    this._stepYocto = parseNearAmount(step.toString());
    this._debounceDelay = getMilliseconds(delay);

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
      this._initWidgetFunctions[[websiteName, username, 'claim'].join('/')] = () =>
        this.onProfileButtonClaimInit(profile, me);
      const accountGId = createAccountGlobalId(profile.id, websiteName);
      const tokens = await this._tippingService.getAvailableTipsByAccount(accountGId);
      const availableTokens = formatNear(tokens);
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
    const accountGId = createAccountGlobalId(profile.id, websiteName);
    try {
      const nearAccountsFromCA = await getNearAccountsFromCa(accountGId, this._network);
      if (nearAccountsFromCA.length === 0) {
        alert(
          'You must link your NEAR account to your Twitter account using the Connected Accounts service. Click |⋈ Link| button to continue.',
        );
        return;
      }
      const tokens = await this._tippingService.getAvailableTipsByAccount(accountGId);
      const availableTokens = formatNear(tokens);
      me.disabled = true;
      me.loading = true;
      me.label = 'Waiting...';
      const walletAccountId = await connectWallet(this._network);
      if (!nearAccountsFromCA.includes(walletAccountId)) {
        alert(
          'You have connected accounts: ' + nearAccountsFromCA.join(', ') + '. Login with one of them to continue.',
        );
      } else {
        const txHash = await this._tippingService.claimTokens(accountGId);
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
    const accountGId = createAccountGlobalId(username, websiteName);
    const isMyProfile = profile.id.toLowerCase() === username?.toLowerCase();
    const parsedNearAccount = parseNearId(profile.authorFullname, this._network);

    if (isMyProfile) {
      this._initWidgetFunctions[[websiteName, username, 'link'].join('/')] = () =>
        this.onProfileButtonLinkInit(profile, me);

      const walletForAutoclaim = await this._tippingService.getWalletForAutoclaim(accountGId);
      if (walletForAutoclaim) {
        me.hidden = false;
        me.label = 'Unlink';
        me.tooltip = `Disable autoclaim from @${username} to ${walletForAutoclaim} NEAR wallet.`;
        me.hidden = false;
        return;
      }

      const { pendingRequest, pendingRequestId } = await getCAPendingRequest(accountGId);
      if (pendingRequestId !== -1 && pendingRequest) {
        if (!this._isWaitForCAPendingVRequest) {
          this._isWaitForCAPendingVRequest = true;
          me.label = 'Waiting...';
          me.hidden = false;
          const requestStatus = await waitForCAVerificationRequestResolve(pendingRequestId);
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
        return;
      }

      const connectedAccounts = await Core.connectedAccounts.getNet(accountGId);
      if (connectedAccounts && connectedAccounts.length > 1) {
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
    const { username, fullname, websiteName, img } = await this.getCurrentUserAsync();
    const parsiedNearAccount = parseNearId(fullname, this._network);
    try {
      const accountGId = createAccountGlobalId(username, websiteName);
      const walletForAutoclaim = await this._tippingService.getWalletForAutoclaim(accountGId);
      me.disabled = true;
      me.loading = true;
      me.label = 'Waiting...';
      if (walletForAutoclaim) {
        // unlink
        await this._tippingService.deleteWalletForAutoclaim(accountGId);
      } else {
        // link
        if (!parsiedNearAccount) {
          const exampleWallet = this._network === NearNetworks.Testnet ? 'yourwallet.testnet' : 'yourwallet.near';
          alert(
            `Before you continue, add your NEAR account ID to your ${websiteName} profile name. ` +
              'This is necessary for Oracle so that it can make sure that you own this Twitter account. ' +
              'After linking you can remove it back.\n' +
              `For example: "${fullname} (${exampleWallet})"\n`,
          );
        } else {
          const walletAccountId = await connectWallet(this._network);
          if (parsiedNearAccount !== walletAccountId) {
            alert(
              `Check the wallet in your ${websiteName} profile name. ` +
                'It should be the same as you use for login. Now you logged in with ' +
                `${walletAccountId}, and the wallet in your profile is ${parsiedNearAccount}.`,
            );
          } else {
            await makeNewCAConnection(username, fullname, img, websiteName, walletAccountId, this._network);
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
    const accountGId = createAccountGlobalId(profile.id, websiteName);
    const nearAccount = await this._tippingService.getWalletForAutoclaim(accountGId);
    this._initWidgetFunctions[[websiteName, profile.id, 'profile/badge'].join('/')] = () =>
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
    this._initWidgetFunctions[[websiteName, post.id, 'post/button'].join('/')] = () => this.onPostButtonInit(post, me);
    if (post.id && post.authorUsername) {
      me.hidden = false;
      me.donationsAmount = await this._tippingService.getTotalTipsByItemId('tweet/' + post.id);
      if (equals(me.donationsAmount, '0')) {
        me.label = 'Tip';
        return;
      }
      if (Number(formatNear(me.donationsAmount)) === 10) me.disabled = true;
      me.label = formatNear(me.donationsAmount) + ' NEAR';
    } else {
      me.hidden = true;
    }
  };

  onDebounceDonate = async (me: any, externalAccount: string, tweetId: string, amount: string) => {
    const tweetGId = 'tweet/' + tweetId;
    try {
      const { websiteName } = await this.getCurrentUserAsync();
      const accountGId = createAccountGlobalId(externalAccount, websiteName);
      me.loading = true;
      me.disabled = true;
      const fee = await this._tippingService.calculateFee(amount);
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
        const txHash = await this._tippingService.sendTips(accountGId, tweetGId, total);
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
      me.donationsAmount = await this._tippingService.getTotalTipsByItemId(tweetGId);
      me.loading = false;
      me.disabled = false;
      me.amount = '0';
      me.label = equals(me.donationsAmount, '0') ? 'Tip' : formatNear(me.donationsAmount) + ' NEAR';
      this.executeInitWidgetFunctions();
    }
  };

  onPostButtonExec = async (tweet, me) => {
    const donationsAmount = Number(formatNear(me.donationsAmount));
    const donation = Number(formatNear(me.amount));
    const stepYocto = Number(formatNear(this._stepYocto));
    const result = Number((donationsAmount + donation + stepYocto).toFixed(2));

    if (result > 10) return (me.disabled = true);

    if (
      lte(sum(me.donationsAmount, me.amount, this._stepYocto), this._maxAmountPerItem) &&
      lte(sum(me.amount, this._stepYocto), this._maxAmountPerTip)
    ) {
      me.amount = sum(me.amount, this._stepYocto);
      me.label = formatNear(me.donationsAmount) + ' + ' + formatNear(me.amount) + ' NEAR';
    }

    me.debouncedDonate(me, tweet.authorUsername, tweet.id, me.amount);
  };

  onPostAvatarBadgeInit = async (post, me) => {
    try {
      const { websiteName } = await this.getCurrentUserAsync();
      this._initWidgetFunctions[[websiteName, post.id, 'post/badge'].join('/')] = () =>
        this.onPostAvatarBadgeInit(post, me);
      if (post?.authorUsername && websiteName) {
        const accountGId = createAccountGlobalId(post.authorUsername, websiteName);
        const nearAccount = await this._tippingService.getWalletForAutoclaim(accountGId);
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
}
