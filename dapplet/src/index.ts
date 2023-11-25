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
import {
  equals,
  getMilliseconds,
  lte,
  sum,
  formatNear,
  getCurrentUserAsync,
  truncateAddress,
  getDomainByWebsiteName,
} from './helpers';
import { ICurrentProfile, NearNetworks } from './interfaces';
import * as messages from './messages';

const { parseNearAmount, formatNearAmount } = Core.near.utils.format;

// *** SETTINGS ***
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ADAPTER_ID = 'social-virtual-config.dapplet-base.eth';
const TIPPING_CONTRACT_ADDRESSES = {
  [NearNetworks.Mainnet]: 'v2.tipping.near',
  [NearNetworks.Testnet]: 'v2.tipping.testnet',
};
const BREAK_FOR_CLAIM_NOTIFICATION = 1000 * 60 * 60 * 24 * 365; // ms
const MAX_AMOUNT_PER_ITEM = '10000000000000000000000000'; // 10 NEAR
const MAX_AMOUNT_PER_TIP = '1000000000000000000000000'; // 1 NEAR
// ***   ****   ***

interface IState {
  ctx: ICurrentProfile;
  waitForClaim: boolean;
  me;
}

interface IGlobal {
  fullname: string;
  id: 'global';
  img: string;
  parent: null;
  url: string;
  username: string;
  websiteName: string;
}

@Injectable
export default class {
  @Inject(ADAPTER_ID) public adapter;
  public network: NearNetworks;
  private _$;
  private _tippingServices: {
    [NearNetworks.Mainnet]: TippingContractService;
    [NearNetworks.Testnet]: TippingContractService;
  };
  private _tippingServiceDefault: TippingContractService;
  private _stepYocto: string;
  private _debounceDelay: number;
  private _initWidgetFunctions: { [name: string]: () => Promise<void> } = {};
  private _isItAnInternalWalletLogin = false;
  private _globalContext: IGlobal = null;
  public state = Core.state<IState>({ ctx: null, waitForClaim: false, me: null }); // Keys: <websiteName>/<accountId>

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
        this._tippingServiceDefault = this._tippingServices[this.network];
        this.executeInitWidgetFunctions();
      }
    });
  }

  async pasteWidgets(): Promise<void> {
    this.network = await Core.getPreferredConnectedAccountsNetwork(); // ATTENTION: tipping network depends on the preffered CA network
    const tippingServiceMainnet = new TippingContractService(
      NearNetworks.Mainnet,
      TIPPING_CONTRACT_ADDRESSES[NearNetworks.Mainnet],
    );
    const tippingServiceTestnet = new TippingContractService(
      NearNetworks.Testnet,
      TIPPING_CONTRACT_ADDRESSES[NearNetworks.Testnet],
    );
    this._tippingServices = {
      [NearNetworks.Mainnet]: tippingServiceMainnet,
      [NearNetworks.Testnet]: tippingServiceTestnet,
    };
    this._tippingServiceDefault = this._tippingServices[this.network];

    const step = await Core.storage.get('step');
    const delay = await Core.storage.get('delay');
    if (step <= 0) throw new Error(messages.zeroDonationStepError);
    if (delay <= 0) throw new Error(messages.zeroDelayError);
    this._stepYocto = parseNearAmount(step.toString());
    this._debounceDelay = getMilliseconds(delay);

    const { button, avatarBadge } = this.adapter.exports;
    const { $ } = this.adapter.attachConfig({
      GLOBAL: this.onGlobalInit,
      PROFILE: (ctx: ICurrentProfile) => {
        if (!ctx.authorUsername) return;
        this.state[ctx.parent.websiteName + '/' + ctx.id].ctx.next(ctx);
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

  checkAndShowNotification = async (
    tippingService: TippingContractService,
    network: NearNetworks,
    accountGId: string,
    username: string,
    websiteName: string,
    fullname: string,
  ) => {
    const walletForAutoclaim = await tippingService.getWalletForAutoclaim(accountGId);
    if (walletForAutoclaim) return;

    const tokens = await tippingService.getAvailableTipsByAccount(accountGId);
    const availableTokens = formatNear(tokens);
    if (Number(availableTokens) === 0) return;

    const storageDate = await Core.storage.get(`${websiteName}/${username}/${network}/date`);
    const date = storageDate && new Date(storageDate);
    const currentDate = new Date();
    if (!date || currentDate.valueOf() - date.valueOf() > BREAK_FOR_CLAIM_NOTIFICATION) {
      Core.storage.set(`${websiteName}/${username}/${network}/date`, currentDate);
      Core.notify({
        title: 'Tipping NEAR Dapplet',
        teaser: 'Claim and get ' + availableTokens + ' Ⓝ',
        message: `Claim ${websiteName} account [${fullname}](${
          getDomainByWebsiteName[websiteName] + username
        }) and get ${availableTokens} NEAR${network === NearNetworks.Testnet ? ' (testnet)' : ''}.`,
        payload: {
          key: 'tipping_claim',
          websiteName,
          username,
          fullname,
          network,
        },
        actions: [
          {
            action: 'claim',
            title: 'Claim tips',
          },
          {
            action: 'do_not_disturb',
            title: 'Do not disturb for this account',
          },
        ],
      });
    }
  };

  onGlobalInit = async (global: IGlobal) => {
    this._globalContext = global;
    const { username, websiteName, fullname } = await getCurrentUserAsync(global);
    const accountGId = createAccountGlobalId(username, websiteName);

    this.checkAndShowNotification(
      this._tippingServices[NearNetworks.Mainnet],
      NearNetworks.Mainnet,
      accountGId,
      username,
      websiteName,
      fullname,
    );
    this.checkAndShowNotification(
      this._tippingServices[NearNetworks.Testnet],
      NearNetworks.Testnet,
      accountGId,
      username,
      websiteName,
      fullname,
    );
  };

  onProfileButtonClaimInit = async (profile, me) => {
    const { username, websiteName } = await getCurrentUserAsync(this._globalContext);
    this.state[websiteName + '/' + profile.id].me.next(me);
    const isMyProfile = profile.id?.toLowerCase() === username?.toLowerCase();
    if (isMyProfile) {
      this._initWidgetFunctions[[websiteName, username, 'claim'].join('/')] = () =>
        this.onProfileButtonClaimInit(profile, me);
      const accountGId = createAccountGlobalId(profile.id, websiteName);
      const walletForAutoclaim = await this._tippingServiceDefault.getWalletForAutoclaim(accountGId);
      if (walletForAutoclaim) {
        me.hidden = true;
        return;
      }
      const tokens = await this._tippingServiceDefault.getAvailableTipsByAccount(accountGId);
      const availableTokens = formatNear(tokens);
      if (this.state[websiteName + '/' + profile.id].waitForClaim.value) {
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

  onButtonClaimExec = async (accountId: string, websiteName: string, fullname: string, network: NearNetworks) => {
    this.state[websiteName + '/' + accountId].waitForClaim.next(true);
    const accountGId = createAccountGlobalId(accountId, websiteName);
    try {
      const tippingService = this._tippingServices[network];
      const walletForAutoclaim = await tippingService.getWalletForAutoclaim(accountGId);
      if (walletForAutoclaim) {
        await Core.alert(messages.rebindError(walletForAutoclaim));
        return;
      }
      const nearAccountsFromCA = await getNearAccountsFromCa(accountGId, network);
      this._isItAnInternalWalletLogin = true;
      const walletAccountId = await connectWallet(network, TIPPING_CONTRACT_ADDRESSES[network]);
      if (nearAccountsFromCA.length === 0 || !nearAccountsFromCA.includes(walletAccountId)) {
        if (
          nearAccountsFromCA.length !== 0 &&
          !(await Core.confirm(
            messages.offerToReloginOrConnectAccount({
              username: accountId,
              websiteName,
              walletAccountId,
              nearAccountsFromCA,
            }),
          ))
        ) {
          return this.executeInitWidgetFunctions();
        } else {
          await Core.alert(messages.aboutCA);
          if (!this.state[websiteName + '/' + accountId].ctx.value) {
            this.state[websiteName + '/' + accountId].ctx.next({
              authorFullname: fullname,
              authorUsername: accountId,
              id: accountId,
              parent: { websiteName },
            });
          }
          Core.alert(messages.waitForTheCAConnect());
          const isConnected = await connectNewAccount(
            walletAccountId,
            network,
            this.state[websiteName + '/' + accountId].ctx,
          );
          if (!isConnected) return this.executeInitWidgetFunctions();
        }
      }
      const tokens = await tippingService.getAvailableTipsByAccount(accountGId);
      const availableTokens = Number(formatNearAmount(tokens, 4));

      if (!availableTokens) {
        if (await Core.confirm(messages.settingTippingWallet(walletAccountId))) {
          Core.alert(messages.waitForTheClaiming());
          const txHash = await tippingService.setWalletForAutoclaim(accountGId, walletAccountId);

          Core.notify({
            title: 'Tipping NEAR Dapplet',
            message: messages.claimed({ fullname, websiteName, walletAccountId, network, txHash }),
            teaser: messages.teaserClaimed(walletAccountId),
          });
        }
      } else if (await Core.confirm(messages.claiming(walletAccountId, availableTokens, fullname, websiteName))) {
        Core.alert(messages.waitForTheClaiming());
        const txHash = await tippingService.claimTokens(accountGId);

        Core.notify({
          title: 'Tipping NEAR Dapplet',
          message: messages.claimed({
            fullname,
            websiteName,
            walletAccountId,
            network,
            txHash,
            availableTokens,
          }),
          teaser: messages.teaserClaimed(walletAccountId, availableTokens),
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      this._isItAnInternalWalletLogin = false;
      this.state[websiteName + '/' + accountId].waitForClaim.next(false);
      this.executeInitWidgetFunctions();
    }
  };

  onProfileButtonClaimExec = async (profile, me) => {
    me.disabled = true;
    me.loading = true;
    me.label = 'Waiting...';
    this.onButtonClaimExec(profile.id, profile.parent.websiteName, profile.parent.fullname, this.network);
  };

  @OnEvent('notification_action')
  async handleNotificationActionWithDecorator(props) {
    const { payload, action, namespace } = props;
    const { key, websiteName, username, fullname, network } = payload;
    if (namespace === 'tipping-near-dapplet' && key === 'tipping_claim') {
      switch (action) {
        case 'do_not_disturb':
          Core.storage.set(`${websiteName}/${username}/${network}/date`, new Date(32534611200000)); // far future
          break;
        case 'claim': {
          const profileCtx = this.state[websiteName + '/' + username]?.ctx.value;
          const profileProxy = this.state[websiteName + '/' + username]?.me.value;
          if (profileCtx && network === this.network) {
            this.onProfileButtonClaimExec(profileCtx, profileProxy);
          } else {
            this.onButtonClaimExec(username, websiteName, fullname, network);
          }
          break;
        }
        default:
          console.error('The wrong notification action ID:', action);
      }
    }
  }

  onProfileButtonUnbindInit = async (profile, me) => {
    const { username, websiteName } = await getCurrentUserAsync(this._globalContext);
    const isMyProfile = profile.id?.toLowerCase() === username?.toLowerCase();
    if (isMyProfile) {
      this._initWidgetFunctions[[websiteName, username, 'unbind'].join('/')] = () =>
        this.onProfileButtonUnbindInit(profile, me);
      const accountGId = createAccountGlobalId(profile.id, websiteName);
      const walletForAutoclaim = await this._tippingServiceDefault.getWalletForAutoclaim(accountGId);

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
      const walletForAutoclaim = await this._tippingServiceDefault.getWalletForAutoclaim(accountGId);
      this._isItAnInternalWalletLogin = true;
      const walletAccountId = await connectWallet(this.network, TIPPING_CONTRACT_ADDRESSES[this.network]);
      const nearAccountsFromCA = await getNearAccountsFromCa(accountGId, this.network);
      if (walletForAutoclaim === walletAccountId || nearAccountsFromCA.includes(walletAccountId)) {
        if (await Core.confirm(messages.unbinding(walletForAutoclaim, username))) {
          await this._tippingServiceDefault.deleteWalletForAutoclaim(accountGId);

          Core.notify({
            title: 'Tipping NEAR Dapplet',
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
          const isConnected = await connectNewAccount(
            walletAccountId,
            this.network,
            this.state[websiteName + '/' + profile.id].ctx,
          );
          if (!isConnected) return this.executeInitWidgetFunctions();
          if (await Core.confirm(messages.unbinding(walletForAutoclaim, username))) {
            await this._tippingServiceDefault.deleteWalletForAutoclaim(accountGId);

            Core.notify({
              title: 'Tipping NEAR Dapplet',
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
      const walletForAutoclaim = await this._tippingServiceDefault.getWalletForAutoclaim(accountGId);
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
      const walletForAutoclaim = await this._tippingServiceDefault.getWalletForAutoclaim(accountGId);
      this._isItAnInternalWalletLogin = true;
      const walletAccountId = await connectWallet(this.network, TIPPING_CONTRACT_ADDRESSES[this.network]);
      const nearAccountsFromCA = await getNearAccountsFromCa(accountGId, this.network);
      if (walletForAutoclaim === walletAccountId) {
        await Core.alert(messages.rebindError(walletForAutoclaim));
      } else if (nearAccountsFromCA.includes(walletAccountId)) {
        if (await Core.confirm(messages.rebinding(username, walletAccountId, walletForAutoclaim))) {
          await this._tippingServiceDefault.setWalletForAutoclaim(accountGId, walletAccountId);

          Core.notify({
            title: 'Tipping NEAR Dapplet',
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
          const isConnected = await connectNewAccount(
            walletAccountId,
            this.network,
            this.state[websiteName + '/' + profile.id].ctx,
          );
          if (!isConnected) return this.executeInitWidgetFunctions();
          if (await Core.confirm(messages.rebinding(username, walletAccountId, walletForAutoclaim))) {
            await this._tippingServiceDefault.setWalletForAutoclaim(accountGId, walletAccountId);
            Core.notify({
              title: 'Tipping NEAR Dapplet',
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
    const nearAccount = await this._tippingServiceDefault.getWalletForAutoclaim(accountGId);
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
      me.donationsAmount = await this._tippingServiceDefault.getTotalTipsByItemId('tweet/' + post.id);
      if (equals(me.donationsAmount, '0')) {
        me.label = 'Tip';
        return;
      }
      const limit = Number(formatNear(MAX_AMOUNT_PER_ITEM));
      if (Number(formatNear(me.donationsAmount)) === limit) {
        me.disabled = true;
        me.tooltip = messages.limitPerItemExceeded(limit).slice(0, -1);
      } else {
        me.tooltip = 'Send donation';
      }
      me.label = formatNear(me.donationsAmount) + ' Ⓝ';
    } else {
      me.hidden = true;
    }
  };

  onDebounceDonate = async (me, externalAccount: string, tweetId: string, amount: string, tweet) => {
    const tweetGId = 'tweet/' + tweetId;

    try {
      const { websiteName } = await getCurrentUserAsync(this._globalContext);
      const accountGId = createAccountGlobalId(externalAccount, websiteName);
      const walletAccountId = await connectWallet(this.network, TIPPING_CONTRACT_ADDRESSES[this.network]);

      let addressFrom;

      let linkFrom;

      if (walletAccountId.includes('testnet') || walletAccountId.includes('near')) {
        addressFrom = walletAccountId;
      } else {
        addressFrom = truncateAddress(walletAccountId, 24);
      }

      if (this.network === NearNetworks.Testnet) {
        linkFrom = 'https://explorer.testnet.near.org/accounts/' + addressFrom;
      } else if (this.network === NearNetworks.Mainnet) {
        linkFrom = 'https://explorer.near.org/accounts/' + addressFrom;
      } else {
        linkFrom = 'https://explorer.near.org';
      }

      me.loading = true;
      me.disabled = true;
      const fee = await this._tippingServiceDefault.calculateFee(amount);
      const total = sum(amount, fee);

      if (await Core.confirm(messages.tipTransfer(amount, fee, externalAccount, websiteName))) {
        const txHash = await this._tippingServiceDefault.sendTips(accountGId, tweetGId, total);
        const explorerUrl =
          this.network === NearNetworks.Mainnet ? 'https://explorer.near.org' : 'https://explorer.testnet.near.org';

        Core.notify({
          title: 'Tipping NEAR Dapplet',
          message: messages.successfulTipTransfer(
            amount,
            explorerUrl,
            txHash,
            tweet,
            websiteName,
            addressFrom,
            linkFrom,
          ),
          teaser: messages.teaserSuccessfulTipTransfer(amount),
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      me.donationsAmount = await this._tippingServiceDefault.getTotalTipsByItemId(tweetGId);
      me.loading = false;
      me.disabled = false;
      me.amount = '0';
      me.label = equals(me.donationsAmount, '0') ? 'Tip' : formatNear(me.donationsAmount) + ' Ⓝ';
      this.executeInitWidgetFunctions();
    }
  };

  onPostButtonExec = async (post, me) => {
    const donationsAmount = Number(formatNear(me.donationsAmount));
    const donation = Number(formatNear(me.amount));
    const stepYocto = Number(formatNear(this._stepYocto));
    const result = Number((donationsAmount + donation + stepYocto).toFixed(2));
    const limit = Number(formatNear(MAX_AMOUNT_PER_ITEM));
    if (result > limit) {
      if (donation === 0) {
        me.disabled = true;
        me.label = formatNear(me.donationsAmount) + ' + ' + formatNear(this._stepYocto) + ' Ⓝ';
        await Core.alert(messages.limitPerItemExceeded(limit));
        me.label = formatNear(me.donationsAmount) + ' Ⓝ';
        return (me.disabled = false);
      }
      me.tooltip = messages.limitPerItemExceeded(limit).slice(0, -1);
      return (me.disabled = true);
    }
    if (
      lte(sum(me.donationsAmount, me.amount, this._stepYocto), MAX_AMOUNT_PER_ITEM) &&
      lte(sum(me.amount, this._stepYocto), MAX_AMOUNT_PER_TIP)
    ) {
      if (result === limit) me.disabled = true;
      me.amount = sum(me.amount, this._stepYocto);
      me.label = formatNear(me.donationsAmount) + ' + ' + formatNear(me.amount) + ' Ⓝ';
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
        const nearAccount = await this._tippingServiceDefault.getWalletForAutoclaim(accountGId);
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
