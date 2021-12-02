import { } from '@dapplets/dapplet-extension';
import WHITE_ICON from './icons/money-twiter-light.svg';
import DARK_ICON from './icons/money-twiter-dark.svg';
import NEAR_DARK_ICON from './icons/near-dark.svg';
import { TippingContractService } from './services/TippingContractService';
import { IdentityService } from './services/IdentityService';
import { debounce } from 'lodash';
import { equals, getMilliseconds, isParticipant, lte, sum } from './helpers';
import { NearNetwork } from './interfaces';

const { parseNearAmount, formatNearAmount } = Core.near.utils.format;

@Injectable
export default class TwitterFeature {
  @Inject('twitter-adapter.dapplet-base.eth')
  public adapter: any;

  private tippingService: TippingContractService;
  private identityService: IdentityService;

  private _stepYocto: string;
  private _network: NearNetwork;
  private _debounceDelay: number;
  private _maxAmountPerItem = '10000000000000000000000000'; // 10 NEAR
  private _maxAmountPerTip = '1000000000000000000000000'; // 1 NEAR

  // private _overlay = Core.overlay({ name: 'overlay', title: 'Tipping Near' }).listen({
  //   getAllUserStat: () =>
  //     this.tippingService
  //       .getAllUserStat()
  //       .then((x) => this._overlay.send('getAllUserStat_done', x))
  //       .catch((e) => this._overlay.send('getAllUserStat_undone', e)),
  //   donateToUser: (_: any, { type, message }: any) =>
  //     this.tippingService
  //       .donateToUser(message.nearAccountId, message.donateAmount)
  //       .then(() => this._overlay.send('donateToUser_done'))
  //       .catch((e) => this._overlay.send('donateToUser_undone', e)),
  // });

  // Core.onAction(() => this._overlay.send(''));

  async activate(): Promise<void> {
    const step = await Core.storage.get('step');
    const delay = await Core.storage.get('delay');
    this._network = await Core.storage.get('network');

    if (step <= 0) {
      throw new Error('A donation step must be more than zero. Change the step parameter in the dapplet settings.');
    }

    if (delay <= 0) {
      throw new Error('A delay must be greater than zero. Change the delay parameter in the dapplet settings.');
    }

    if (!(this._network === 'mainnet' || this._network === 'testnet')) {
      throw new Error(
        'Only "mainnet" and "testnet" networks are supported. Change the network parameter in the dapplet settings.',
      );
    }

    this._stepYocto = parseNearAmount(step.toString());
    this._debounceDelay = getMilliseconds(delay);
    this.identityService = new IdentityService(this._network);
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
            img: NEAR_DARK_ICON,
            init: this.onProfileButtonDefaultInit,
            exec: this.onProfileButtonLinkExec,
          },
        }),
        avatarBadge({
          DEFAULT: {
            img: NEAR_DARK_ICON,
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
            img: NEAR_DARK_ICON,
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
    const username = await this.getCurrentUserAsync();
    const isMyProfile = profile.id?.toLowerCase() === username?.toLowerCase();

    if (isMyProfile) {
      const tokens = await this.tippingService.getAvailableTipsByExternalAccount('twitter/' + profile.id);
      const availableTokens = this.formatNear(tokens);

      if (Number(availableTokens) === 0) me.disabled = true;
      me.label = `Claim ${availableTokens} Ⓝ`;
      me.hidden = false;
    } else {
      me.hidden = true;
    }
  };

  onProfileButtonClaimExec = async (profile, me) => {
    const nearAccount = await this.identityService.getNearAccount('twitter/' + profile.id);
    if (!nearAccount) return alert('You must link NEAR account before continue.');
    if (!isParticipant(nearAccount) && this._network === NearNetwork.MAINNET) {
      return alert('Claim tokens is available only for participants in closed testing.');
    }

    try {
      me.disabled = true;
      me.loading = true;
      me.label = 'Waiting...';
      await this.tippingService.claimTokens();
    } catch (e) {
      console.error(e);
    } finally {
      me.disabled = false;
      me.loading = false;
      this.onProfileButtonClaimInit(profile, me);
    }
  };

  onProfileButtonDefaultInit = async (profile, me) => {
    const username = await this.getCurrentUserAsync();
    const isMyProfile = profile.id.toLowerCase() === username?.toLowerCase();
    const parsingNearAccount = this.parseNearId(profile.authorFullname, this._network);

    if (isMyProfile) {
      const nearAccount = await this.identityService.getNearAccount('twitter/' + profile.id, true);
      if (!nearAccount) {
        me.label = 'Link';
        me.tooltip = `Link ${parsingNearAccount ? parsingNearAccount + ' ' : ''}account with NEAR wallet`;
      } else {
        me.label = 'Unlink';
        me.tooltip = `Unlink ${nearAccount} account from NEAR wallet`;
      }
      me.hidden = false;
    } else {
      me.hidden = true;
    }
  };

  onProfileButtonLinkExec = async (profile, me) => {
    const nearAccount = this.parseNearId(profile.authorFullname, this._network);
    try {
      me.disabled = true;
      me.loading = true;
      const linkedAccount = await this.identityService.getNearAccount('twitter/' + profile.id);
      me.label = 'Waiting...';
      if (linkedAccount) {
        // unlink
        if (nearAccount) {
          alert('Remove NEAR Account ID from your profile name before continue.');
        } else {
          await this.identityService.requestVerification(
            `twitter/${profile.id}`,
            true,
            'https://twitter.com/' + profile.id,
          );
        }
      } else {
        // link
        if (!nearAccount) {
          alert('Add your near account ID to your profile name before continuing.');
        } else {
          await this.identityService.requestVerification(
            `twitter/${profile.id}`,
            false,
            'https://twitter.com/' + profile.id,
          );
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      me.disabled = false;
      me.loading = false;
      this.onProfileButtonDefaultInit(profile, me);
    }
  };

  onProfileAvatarBadgeInit = async (ctx, me) => {
    const nearAccount = await this.identityService.getNearAccount('twitter/' + ctx.id);
    if (nearAccount) {
      me.hidden = false;
      me.tooltip = nearAccount;
      me.nearAccount = nearAccount;
    }
  };

  onProfileAvatarBadgeExec = (_, me) => {
    if (this._network === NearNetwork.TESTNET) {
      window.open(`https://explorer.testnet.near.org/accounts/${me.nearAccount}`, '_blank');
    } else if (this._network === NearNetwork.MAINNET) {
      window.open(`https://explorer.near.org/accounts/${me.nearAccount}`, '_blank');
    } else {
      throw new Error('Unsupported network');
    }
  };

  onPostButtonInit = async (tweet, me) => {
    me.donationsAmount = await this.tippingService.getTotalDonationByItem('tweet/' + tweet.id);
    if (equals(me.donationsAmount, '0')) return (me.label = 'Tip');

    if (Number(this.formatNear(me.donationsAmount)) === 10) me.disabled = true;
    me.label = this.formatNear(me.donationsAmount) + ' NEAR';
  };

  onDebounceDonate = async (me: any, externalAccount: string, tweetId: string, amount: string) => {
    try {
      me.loading = true;
      me.disabled = true;
      await this.tippingService.donateByTweet(externalAccount, 'tweet/' + tweetId, amount);
    } catch (e) {
      console.error(e);
    } finally {
      me.donationsAmount = await this.tippingService.getTotalDonationByItem('tweet/' + tweetId);
      me.loading = false;
      me.disabled = false;
      me.amount = '0';
      me.label = equals(me.donationsAmount, '0') ? 'Tip' : this.formatNear(me.donationsAmount) + ' NEAR';
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
      me.label = this.formatNear(sum(me.donationsAmount, me.amount)) + ' NEAR';
    }

    const externalAccount = 'twitter/' + tweet.authorUsername;
    await me.debouncedDonate(me, externalAccount, tweet.id, me.amount);
  };

  onPostAvatarBadgeInit = async (ctx, me) => {
    const nearAccount = await this.identityService.getNearAccount('twitter/' + ctx.authorUsername);
    if (nearAccount) {
      me.hidden = false;
      me.tooltip = nearAccount;
      me.nearAccount = nearAccount;
    }
  };

  onPostAvatarBadgeExec = (ctx, me) => {
    if (this._network === NearNetwork.TESTNET) {
      window.open(`https://explorer.testnet.near.org/accounts/${me.nearAccount}`, '_blank');
    } else if (this._network === NearNetwork.MAINNET) {
      window.open(`https://explorer.near.org/accounts/${me.nearAccount}`, '_blank');
    } else {
      throw new Error('Unsupported network');
    }
  };

  parseNearId(fullname: string, network: string): string | null {
    const regExpMainnet = /(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+\.near/;
    const regExpTestnet = /(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+\.testnet/;
    const nearId = fullname.toLowerCase().match(network === NearNetwork.TESTNET ? regExpTestnet : regExpMainnet);

    return nearId && nearId[0];
  }

  formatNear(amount: string): string {
    return Number(formatNearAmount(amount, 4)).toFixed(2);
  }

  async getCurrentUserAsync(): Promise<string | null> {
    let i = 0;

    while (i < 10) {
      i++;
      try {
        const user = this.adapter.getCurrentUser();
        return user ? user.username : null;
      } catch (e) {
        console.error(e);
      }
      await new Promise((res) => setTimeout(res, 1000));
    }

    return null;
  }
}
