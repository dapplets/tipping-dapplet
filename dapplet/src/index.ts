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
  connectNewAccount,
} from './services/identityService';
import { debounce } from 'lodash';
import { equals, getMilliseconds, lte, sum, formatNear, getCurrentUserAsync } from './helpers';
import { ICurrentProfile, NearNetworks } from './interfaces';
import * as messages from './messages';

const { parseNearAmount, formatNearAmount } = Core.near.utils.format;
const TIPPING_TESTNET_CONTRACT_ADDRESS = 'v2.tipping.testnet';
const TIPPING_MAINNET_CONTRACT_ADDRESS = 'v2.tipping.near';

interface IState {
  ctx: ICurrentProfile;
  waitForClaim: boolean;
}

@Injectable
export default class {
  @Inject('social-virtual-config.dapplet-base.eth')
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
  private _isItAnInternalWalletLogin = false;

  private _globalContext = {};
  public state = Core.state<IState>({ ctx: null, waitForClaim: false });

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
      if (!this._isItAnInternalWalletLogin) {
        this._tippingService = new TippingContractService(this.network, this.tippingContractAddress);
        this.executeInitWidgetFunctions();
      }
    });
  }

  async pasteWidgets(): Promise<void> {
    this.network = await Core.getPreferredConnectedAccountsNetwork(); // ATTENTION: tipping network depends on the preffered CA network
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
      GLOBAL: (global) => {
        this._globalContext = global;
      },
      PROFILE: (ctx: ICurrentProfile) => {
        if (!ctx.authorUsername) return;
        this.state[ctx.id].ctx.next(ctx);
        return [
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
        ];
      },
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
    const { username, websiteName } = await getCurrentUserAsync(this._globalContext);
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
      if (this.state[profile.id].waitForClaim.value) {
        me.label = 'Waiting...';
        me.disabled = true;
        me.loading = true;
        me.hidden = false;
      } else {
        me.label = `Claim${Number(availableTokens) === 0 ? '' : ' and get ' + availableTokens + ' Ⓝ'}`;
        me.disabled = false;
        me.loading = false;
        me.hidden = false;
      }
    } else {
      me.hidden = true;
    }
  };

  onProfileButtonClaimExec = async (profile, me) => {
    me.disabled = true;
    me.loading = true;
    me.label = 'Waiting...';
    this.state[profile.id].waitForClaim.next(true);
    const { username, websiteName } = await getCurrentUserAsync(this._globalContext);
    const accountGId = createAccountGlobalId(profile.id, websiteName);
    try {
      const nearAccountsFromCA = await getNearAccountsFromCa(accountGId, this.network);
      this._isItAnInternalWalletLogin = true;
      const walletAccountId = await connectWallet(this.network, this.tippingContractAddress);
      if (nearAccountsFromCA.length === 0 || !nearAccountsFromCA.includes(walletAccountId)) {
        if (
          nearAccountsFromCA.length !== 0 &&
          !(await Core.confirm(
            messages.offerToReloginOrConnectAccount({ username, websiteName, walletAccountId, nearAccountsFromCA }),
          ))
        ) {
          return this.executeInitWidgetFunctions();
        } else {
          await Core.alert(messages.aboutCA);
          const isConnected = await connectNewAccount(walletAccountId, this.network, this.state[profile.id].ctx);
          if (!isConnected) return this.executeInitWidgetFunctions();
        }
      }
      const tokens = await this._tippingService.getAvailableTipsByAccount(accountGId);
      const availableTokens = Number(formatNearAmount(tokens, 4));

      if (!availableTokens) {
        if (await Core.confirm(messages.settingTippingWallet(walletAccountId))) {
          const txHash = await this._tippingService.setWalletForAutoclaim(accountGId, walletAccountId);

          Core.notify({
            title: 'Tipping Dapplet',
            message: messages.claimed(walletAccountId, this.network, txHash),
            teaser: messages.teaserClaimed(walletAccountId),
          });
        }
      } else if (await Core.confirm(messages.claiming(walletAccountId, availableTokens))) {
        const txHash = await this._tippingService.claimTokens(accountGId);

        Core.notify({
          title: 'Tipping Dapplet',
          message: messages.claimed(walletAccountId, this.network, txHash, availableTokens),
          teaser: messages.teaserClaimed(walletAccountId, availableTokens),
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      this._isItAnInternalWalletLogin = false;
      this.state[profile.id].waitForClaim.next(false);
      this.executeInitWidgetFunctions();
    }
  };

  onProfileButtonUnbindInit = async (profile, me) => {
    const { username, websiteName } = await getCurrentUserAsync(this._globalContext);
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
    const { username, websiteName } = await getCurrentUserAsync(this._globalContext);
    const accountGId = createAccountGlobalId(profile.id, websiteName);
    try {
      const walletForAutoclaim = await this._tippingService.getWalletForAutoclaim(accountGId);
      this._isItAnInternalWalletLogin = true;
      const walletAccountId = await connectWallet(this.network, this.tippingContractAddress);
      const nearAccountsFromCA = await getNearAccountsFromCa(accountGId, this.network);
      if (walletForAutoclaim === walletAccountId || nearAccountsFromCA.includes(walletAccountId)) {
        if (await Core.confirm(messages.unbinding(walletForAutoclaim, username))) {
          await this._tippingService.deleteWalletForAutoclaim(accountGId);

          Core.notify({
            title: 'Tipping Dapplet',
            message: messages.unbinded(walletForAutoclaim, username),
            teaser: messages.teaserUnbinded(walletForAutoclaim, username),
          });
        }
      } else {
        if (
          await Core.confirm(
            messages.offerToReloginOrConnectAccount({
              username,
              websiteName,
              walletAccountId,
              nearAccountsFromCA,
              walletForAutoclaim,
            }),
          )
        ) {
          const isConnected = await connectNewAccount(walletAccountId, this.network, this.state[profile.id].ctx);
          if (!isConnected) return this.executeInitWidgetFunctions();
          if (await Core.confirm(messages.unbinding(walletForAutoclaim, username))) {
            await this._tippingService.deleteWalletForAutoclaim(accountGId);

            Core.notify({
              title: 'Tipping Dapplet',
              message: messages.unbinded(walletForAutoclaim, username),
              teaser: messages.teaserUnbinded(walletForAutoclaim, username),
            });
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      this._isItAnInternalWalletLogin = false;
      this.executeInitWidgetFunctions();
    }
  };

  onProfileButtonRebindInit = async (profile, me) => {
    const { username, websiteName } = await getCurrentUserAsync(this._globalContext);
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
    const { username, websiteName } = await getCurrentUserAsync(this._globalContext);
    const accountGId = createAccountGlobalId(profile.id, websiteName);
    try {
      const walletForAutoclaim = await this._tippingService.getWalletForAutoclaim(accountGId);
      this._isItAnInternalWalletLogin = true;
      const walletAccountId = await connectWallet(this.network, this.tippingContractAddress);
      const nearAccountsFromCA = await getNearAccountsFromCa(accountGId, this.network);
      if (walletForAutoclaim === walletAccountId) {
        await Core.alert(messages.rebindError(walletForAutoclaim));
      } else if (nearAccountsFromCA.includes(walletAccountId)) {
        if (await Core.confirm(messages.rebinding(username, walletAccountId, walletForAutoclaim))) {
          await this._tippingService.setWalletForAutoclaim(accountGId, walletAccountId);

          Core.notify({
            title: 'Tipping Dapplet',
            message: messages.binded(walletAccountId, username),
            teaser: messages.teaserBinded(walletAccountId, username),
          });
        }
      } else {
        if (
          await Core.confirm(
            messages.offerToReloginOrConnectAccount({
              username,
              websiteName,
              walletAccountId,
              nearAccountsFromCA,
              walletForAutoclaim,
            }),
          )
        ) {
          const isConnected = await connectNewAccount(walletAccountId, this.network, this.state[profile.id].ctx);
          if (!isConnected) return this.executeInitWidgetFunctions();
          if (await Core.confirm(messages.rebinding(username, walletAccountId, walletForAutoclaim))) {
            await this._tippingService.setWalletForAutoclaim(accountGId, walletAccountId);
            Core.notify({
              title: 'Tipping Dapplet',
              message: messages.binded(walletAccountId, username),
              teaser: messages.teaserBinded(walletAccountId, username),
            });
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      this._isItAnInternalWalletLogin = false;
      this.executeInitWidgetFunctions();
    }
  };

  onProfileAvatarBadgeInit = async (profile, me) => {
    const { websiteName } = await getCurrentUserAsync(this._globalContext);
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
      Core.openPage(`https://explorer.testnet.near.org/accounts/${me.nearAccount}`);
    } else if (this.network === NearNetworks.Mainnet) {
      Core.openPage(`https://explorer.near.org/accounts/${me.nearAccount}`);
    } else {
      throw new Error('Unsupported network');
    }
  };

  onPostButtonInit = async (post, me) => {
    const { websiteName } = await getCurrentUserAsync(this._globalContext);
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

  onDebounceDonate = async (me, externalAccount: string, tweetId: string, amount: string, tweet) => {
    const tweetGId = 'tweet/' + tweetId;

    try {
      const { websiteName } = await getCurrentUserAsync(this._globalContext);
      const accountGId = createAccountGlobalId(externalAccount, websiteName);
      me.loading = true;
      me.disabled = true;
      const fee = await this._tippingService.calculateFee(amount);
      const total = sum(amount, fee);
      if (await Core.confirm(messages.tipTransfer(amount, fee, externalAccount, websiteName))) {
        const txHash = await this._tippingService.sendTips(accountGId, tweetGId, total);
        const explorerUrl =
          this.network === NearNetworks.Mainnet ? 'https://explorer.near.org' : 'https://explorer.testnet.near.org';
        Core.notify({
          title: 'Tipping Dapplet',
          message: messages.successfulTipTransfer(amount, explorerUrl, txHash, tweet, websiteName),
          teaser: messages.teaserSuccessfulTipTransfer(amount),
        });
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

  onPostButtonExec = async (post, me) => {
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
    me.debouncedDonate(me, post.authorUsername, post.id, me.amount, post);
  };

  onPostAvatarBadgeInit = async (post, me) => {
    try {
      const { websiteName } = await getCurrentUserAsync(this._globalContext);
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

  onPostAvatarBadgeExec = (_, me) => {
    if (this.network === NearNetworks.Testnet) {
      Core.openPage(`https://explorer.testnet.near.org/accounts/${me.nearAccount}`);
    } else if (this.network === NearNetworks.Mainnet) {
      Core.openPage(`https://explorer.near.org/accounts/${me.nearAccount}`);
    } else {
      throw new Error('Unsupported network');
    }
  };
}
