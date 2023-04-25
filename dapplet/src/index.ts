import {} from '@dapplets/dapplet-extension';
import WHITE_ICON from './icons/money-twiter-light.svg';
import DARK_ICON from './icons/money-twiter-dark.svg';
import NEAR_BIG_ICON from './icons/near-big.svg';
import NEAR_SMALL_ICON from './icons/near-small.svg';
import NEAR_LINK_BLACK_ICON from './icons/near-link-black.svg';
import NEAR_LINK_WHITE_ICON from './icons/near-link-white.svg';
import TippingContractService from './services/TippingContractService';
import {
  connectWallet,
  createAccountGlobalId,
  getNearAccountsFromCa,
  makeNewCAConnection,
} from './services/identityService';
import { debounce } from 'lodash';
import { equals, getMilliseconds, lte, sum, formatNear, getCurrentUserAsync } from './helpers';
import { NearNetworks } from './interfaces';
import * as messages from './messages';

const { parseNearAmount, formatNearAmount } = Core.near.utils.format;
const TIPPING_TESTNET_CONTRACT_ADDRESS = 'dev-1680593274075-24217258210681';
const TIPPING_MAINNET_CONTRACT_ADDRESS = null;

@Injectable
export default class {
  @Inject('twitter-adapter.dapplet-base.eth')
  public adapter;
  public network: NearNetworks;
  public tippingContractAddress: string;
  private _$;
  private _tippingService: TippingContractService;

  private _stepYocto: string;
  private _debounceDelay: number;
  private _maxAmountPerItem = '10000000000000000000000000'; // 10 NEAR
  private _maxAmountPerTip = '1000000000000000000000000'; // 1 NEAR

  private _initWidgetFunctions: { [name: string]: () => Promise<void> } = {};
  executeInitWidgetFunctions = (): Promise<void[]> =>
    Promise.all(Object.values(this._initWidgetFunctions).map((fn) => fn()));

  async activate(): Promise<void> {
    await this.pasteWidgets();
    Core.onConnectedAccountsUpdate(async () => {
      const network = await Core.getPreferredConnectedAccountsNetwork();
      if (network !== this.network) {
        this.adapter.detachConfig();
        this.pasteWidgets();
      }
    });
    Core.onWalletsUpdate(async () => {
      this._tippingService = new TippingContractService(this.network, this.tippingContractAddress);
      this.executeInitWidgetFunctions();
    });
  }

  async pasteWidgets(): Promise<void> {
    // ATTENTION: now tipping works only with testnet
    this.network = await Core.getPreferredConnectedAccountsNetwork(); // ATTENTION: tipping network depends on the preffered CA network
    if (this.network === 'mainnet') {
      alert('ATTENTION: now Tipping Dapplet works only with testnet');
      return;
    }
    this.tippingContractAddress =
      this.network === NearNetworks.Testnet ? TIPPING_TESTNET_CONTRACT_ADDRESS : TIPPING_MAINNET_CONTRACT_ADDRESS;
    if (this.tippingContractAddress === null) throw new Error('Unsupported network');
    this._tippingService = new TippingContractService(this.network, this.tippingContractAddress);

    const step = await Core.storage.get('step');
    const delay = await Core.storage.get('delay');
    if (step <= 0) {
      throw new Error(messages.zeroDonationStepError);
    }
    if (delay <= 0) {
      throw new Error(messages.zeroDelayError);
    }
    this._stepYocto = parseNearAmount(step.toString());
    this._debounceDelay = getMilliseconds(delay);

    const { button, avatarBadge } = this.adapter.exports;
    const { $ } = this.adapter.attachConfig({
      PROFILE: () => [
        button({
          id: 'bindButton',
          DEFAULT: {
            hidden: true,
            img: { DARK: WHITE_ICON, LIGHT: DARK_ICON },
            tooltip: 'Bind tipping wallet',
            init: this.onProfileButtonClaimInit,
            exec: this.onProfileButtonClaimExec,
          },
        }),
        button({
          id: 'rebindButton',
          DEFAULT: {
            tooltip: 'Rebind tipping wallet',
            hidden: true,
            img: { DARK: NEAR_LINK_WHITE_ICON, LIGHT: NEAR_LINK_BLACK_ICON },
            init: this.onProfileButtonRebindInit,
            exec: this.onProfileButtonRebindExec,
          },
        }),
        button({
          id: 'unbindButton',
          DEFAULT: {
            tooltip: 'Unbind tipping wallet',
            hidden: true,
            img: { DARK: NEAR_LINK_WHITE_ICON, LIGHT: NEAR_LINK_BLACK_ICON },
            init: this.onProfileButtonUnbindInit,
            exec: this.onProfileButtonUnbindExec,
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
    this._$ = $;
  }

  onProfileButtonClaimInit = async (profile, me) => {
    const { username, websiteName } = await getCurrentUserAsync(this.adapter);
    const isMyProfile = profile.id?.toLowerCase() === username?.toLowerCase();
    if (isMyProfile) {
      this._initWidgetFunctions[[websiteName, username, 'claim'].join('/')] = () =>
        this.onProfileButtonClaimInit(profile, me);
      const accountGId = createAccountGlobalId(profile.id, websiteName);
      const walletForAutoclaim = await this._tippingService.getWalletForAutoclaim(accountGId);
      if (walletForAutoclaim) {
        me.hidden = true;
        return;
      }
      const tokens = await this._tippingService.getAvailableTipsByAccount(accountGId);
      const availableTokens = formatNear(tokens);
      me.label = `Claim${Number(availableTokens) === 0 ? '' : ' and get ' + availableTokens + ' Ⓝ'}`;
      me.disabled = false;
      me.loading = false;
      me.hidden = false;
    } else {
      me.hidden = true;
    }
  };

  onProfileButtonClaimExec = async (profile, me) => {
    me.disabled = true;
    me.loading = true;
    me.label = 'Waiting...';
    const { username, websiteName } = await getCurrentUserAsync(this.adapter);
    const accountGId = createAccountGlobalId(profile.id, websiteName);
    let nearAccountsFromCA: string[];
    let walletAccountId = '';
    try {
      nearAccountsFromCA = await getNearAccountsFromCa(accountGId, this.network);
      walletAccountId = await connectWallet(this.network, this.tippingContractAddress);
      if (nearAccountsFromCA.length === 0) {
        alert(messages.aboutCA);
        await this.connectNewAccount(walletAccountId);
      } else if (!nearAccountsFromCA.includes(walletAccountId)) {
        if (
          !confirm(
            messages.offerToReloginOrConnectAccount({ username, websiteName, walletAccountId, nearAccountsFromCA }),
          )
        )
          return this.executeInitWidgetFunctions();
        alert(messages.aboutCA);
        await this.connectNewAccount(walletAccountId);
      }
      const tokens = await this._tippingService.getAvailableTipsByAccount(accountGId);
      const availableTokens = Number(formatNearAmount(tokens, 4));
      nearAccountsFromCA = await getNearAccountsFromCa(accountGId, this.network);
      if (!availableTokens) {
        if (confirm(messages.settingTippingWallet(walletAccountId))) {
          const txHash = await this._tippingService.setWalletForAutoclaim(accountGId, walletAccountId);
          alert(messages.claimed(walletAccountId, this.network, txHash));
        }
      } else if (confirm(messages.claiming(walletAccountId, availableTokens))) {
        const txHash = await this._tippingService.claimTokens(accountGId);
        alert(messages.claimed(walletAccountId, this.network, txHash, availableTokens));
      }
    } catch (e) {
      console.error(e);
    } finally {
      this.executeInitWidgetFunctions();
    }
  };

  onProfileButtonUnbindInit = async (profile, me) => {
    const { username, websiteName } = await getCurrentUserAsync(this.adapter);
    const isMyProfile = profile.id?.toLowerCase() === username?.toLowerCase();
    if (isMyProfile) {
      this._initWidgetFunctions[[websiteName, username, 'unbind'].join('/')] = () =>
        this.onProfileButtonUnbindInit(profile, me);
      const accountGId = createAccountGlobalId(profile.id, websiteName);
      const walletForAutoclaim = await this._tippingService.getWalletForAutoclaim(accountGId);
      me.label = 'Unbind';
      me.disabled = false;
      me.loading = false;
      me.hidden = !walletForAutoclaim;
    } else {
      me.hidden = true;
    }
  };

  onProfileButtonUnbindExec = async (profile, me) => {
    me.disabled = true;
    me.loading = true;
    me.label = 'Waiting...';
    this._$(profile, 'rebindButton').disabled = true;
    const { username, websiteName } = await getCurrentUserAsync(this.adapter);
    const accountGId = createAccountGlobalId(profile.id, websiteName);
    try {
      const walletForAutoclaim = await this._tippingService.getWalletForAutoclaim(accountGId);
      const walletAccountId = await connectWallet(this.network, this.tippingContractAddress);
      const nearAccountsFromCA = await getNearAccountsFromCa(accountGId, this.network);
      if (walletForAutoclaim === walletAccountId || nearAccountsFromCA.includes(walletAccountId)) {
        if (confirm(messages.unbinding(walletForAutoclaim, username))) {
          await this._tippingService.deleteWalletForAutoclaim(accountGId);
          alert(messages.unbinded(walletForAutoclaim, username));
        }
      } else {
        if (
          confirm(
            messages.offerToReloginOrConnectAccount({
              username,
              websiteName,
              walletAccountId,
              nearAccountsFromCA,
              walletForAutoclaim,
            }),
          )
        ) {
          await this.connectNewAccount(walletAccountId);
          if (confirm(messages.unbinding(walletForAutoclaim, username))) {
            await this._tippingService.deleteWalletForAutoclaim(accountGId);
            alert(messages.unbinded(walletForAutoclaim, username));
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      this.executeInitWidgetFunctions();
    }
  };

  onProfileButtonRebindInit = async (profile, me) => {
    const { username, websiteName } = await getCurrentUserAsync(this.adapter);
    const isMyProfile = profile.id?.toLowerCase() === username?.toLowerCase();
    if (isMyProfile) {
      this._initWidgetFunctions[[websiteName, username, 'rebind'].join('/')] = () =>
        this.onProfileButtonRebindInit(profile, me);
      const accountGId = createAccountGlobalId(profile.id, websiteName);
      const walletForAutoclaim = await this._tippingService.getWalletForAutoclaim(accountGId);
      me.label = 'Rebind';
      me.disabled = false;
      me.loading = false;
      me.hidden = !walletForAutoclaim;
    } else {
      me.hidden = true;
    }
  };

  onProfileButtonRebindExec = async (profile, me) => {
    me.disabled = true;
    me.loading = true;
    me.label = 'Waiting...';
    this._$(profile, 'unbindButton').disabled = true;
    const { username, websiteName } = await getCurrentUserAsync(this.adapter);
    const accountGId = createAccountGlobalId(profile.id, websiteName);
    try {
      const walletForAutoclaim = await this._tippingService.getWalletForAutoclaim(accountGId);
      const walletAccountId = await connectWallet(this.network, this.tippingContractAddress);
      const nearAccountsFromCA = await getNearAccountsFromCa(accountGId, this.network);
      if (walletForAutoclaim === walletAccountId) {
        alert(messages.rebindError(walletForAutoclaim));
      } else if (nearAccountsFromCA.includes(walletAccountId)) {
        if (confirm(messages.rebinding(username, walletAccountId, walletForAutoclaim))) {
          await this._tippingService.setWalletForAutoclaim(accountGId, walletAccountId);
          alert(messages.binded(walletAccountId, username));
        }
      } else {
        if (
          confirm(
            messages.offerToReloginOrConnectAccount({
              username,
              websiteName,
              walletAccountId,
              nearAccountsFromCA,
              walletForAutoclaim,
            }),
          )
        ) {
          await this.connectNewAccount(walletAccountId);
          if (confirm(messages.rebinding(username, walletAccountId, walletForAutoclaim))) {
            await this._tippingService.setWalletForAutoclaim(accountGId, walletAccountId);
            alert(messages.binded(walletAccountId, username));
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      this.executeInitWidgetFunctions();
    }
  };

  onProfileAvatarBadgeInit = async (profile, me) => {
    const { websiteName } = await getCurrentUserAsync(this.adapter);
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
    if (this.network === NearNetworks.Testnet) {
      window.open(`https://explorer.testnet.near.org/accounts/${me.nearAccount}`, '_blank');
    } else if (this.network === NearNetworks.Mainnet) {
      window.open(`https://explorer.near.org/accounts/${me.nearAccount}`, '_blank');
    } else {
      throw new Error('Unsupported network');
    }
  };

  onPostButtonInit = async (post, me) => {
    const { websiteName } = await getCurrentUserAsync(this.adapter);
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

  onDebounceDonate = async (me, externalAccount: string, tweetId: string, amount: string) => {
    const tweetGId = 'tweet/' + tweetId;
    try {
      const { websiteName } = await getCurrentUserAsync(this.adapter);
      const accountGId = createAccountGlobalId(externalAccount, websiteName);
      me.loading = true;
      me.disabled = true;
      const fee = await this._tippingService.calculateFee(amount);
      const total = sum(amount, fee);
      if (confirm(messages.tipTransfer(amount, fee, externalAccount, websiteName))) {
        const txHash = await this._tippingService.sendTips(accountGId, tweetGId, total);
        const explorerUrl =
          this.network === NearNetworks.Mainnet ? 'https://explorer.near.org' : 'https://explorer.testnet.near.org';
        alert(messages.successfulTipTransfer(amount, explorerUrl, txHash));
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
      const { websiteName } = await getCurrentUserAsync(this.adapter);
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
    if (this.network === NearNetworks.Testnet) {
      window.open(`https://explorer.testnet.near.org/accounts/${me.nearAccount}`, '_blank');
    } else if (this.network === NearNetworks.Mainnet) {
      window.open(`https://explorer.near.org/accounts/${me.nearAccount}`, '_blank');
    } else {
      throw new Error('Unsupported network');
    }
  };

  connectNewAccount = async (walletAccountId: string): Promise<void[] | void> => {
    try {
      const requestStatus = await makeNewCAConnection(this.adapter, walletAccountId, this.network);
      if (requestStatus === 'rejected') {
        return this.executeInitWidgetFunctions();
      }
    } catch (err) {
      console.log(err); // ToDo: problems in CA
      return this.executeInitWidgetFunctions();
    }
  };
}
