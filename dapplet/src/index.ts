import {} from '@dapplets/dapplet-extension';
import WHITE_ICON from './icons/money-twiter-light.svg';
import DARK_ICON from './icons/money-twiter-dark.svg';
import NEAR_DARK_ICON from './icons/near-dark.svg';
// import { PaymentRepository } from './repositories/PaymentRepository';
// import { TippingsRepository } from './repositories/TippingsRepository';
// import { TippingService } from './services/TippingService';
import { TippingContractService } from './services/TippingContractService';
import { IdentityService } from './services/IdentityService';
import { debounce } from 'lodash';

const { parseNearAmount, formatNearAmount } = Core.near.utils.format;

@Injectable
export default class TwitterFeature {
  @Inject('twitter-adapter.dapplet-base.eth')
  public adapter: any;

  // private paymentRepository = new PaymentRepository();
  // private tippingsRepository = new TippingsRepository();
  // private tippingService = new TippingService(this.tippingsRepository, this.paymentRepository);
  private tippingService = new TippingContractService();
  private identityService = new IdentityService();

  private _step: number;
  private _network: string;

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

  async activate(): Promise<void> {
    this._step = await Core.storage.get('step');
    this._network = await Core.storage.get('network');

    if (this._step <= 0) {
      throw new Error(
        'A donation step must be more than zero. ' + 'Change the step parameter in the dapplet settings.',
      );
    }

    if (!(this._network === 'mainnet' || this._network === 'testnet')) {
      throw new Error(
        'Only "mainnet" and "testnet" networks are supported. ' +
          'Change the network parameter in the dapplet settings.',
      );
    }

    // Core.onAction(() => this._overlay.send(''));

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
            amount: 0,
            debouncedDonate: debounce(this.onDebounceDonate, 1000),
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
    const user = this.adapter.getCurrentUser();
    const isMyProfile = profile.id === user.username;
    if (isMyProfile) {
      const tokens = await this.tippingService.getAvailableTipsByExternalAccount('twitter/' + profile.id);
      const availableTokens = tokens.toFixed(3);
      me.label = `Claim ${availableTokens} Ⓝ`;
      me.hidden = false;
    } else {
      me.hidden = true;
    }
  };

  onProfileButtonClaimExec = async (profile, me) => {
    const nearAccount = await this.identityService.getNearAccount('twitter/' + profile.id);
    if (!nearAccount) {
      alert('You must link NEAR account before continue.');
    } else {
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
    }
  };

  onProfileButtonDefaultInit = async (profile, me) => {
    // ToDo: getCurrentUser throws an error sometimes
    const user = this.adapter.getCurrentUser();
    const isMyProfile = profile.id === user.username;
    if (isMyProfile) {
      const nearAccount = await this.identityService.getNearAccount('twitter/' + profile.id);
      if (!nearAccount) {
        me.label = 'Link';
        me.tooltip = 'Link account with NEAR wallet';
      } else {
        me.label = 'Unlink';
        me.tooltip = 'Unlink account from NEAR wallet';
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
          alert('Add NEAR Account ID in your profile name before continue.');
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

  onProfileAvatarBadgeExec = (ctx, me) => {
    window.open(`https://explorer.testnet.near.org/accounts/${me.nearAccount}`, '_blank');
  };

  onPostButtonInit = async (tweet, me) => {
    me.donationsAmount = await this.tippingService.getTotalDonationByItem('tweet/' + tweet.id);
    me.label = me.donationsAmount ? this.formatNear(me.donationsAmount) + ' NEAR' : 'Tip';
  };

  onDebounceDonate = async (me: any, externalAccount: string, tweetId: string, amount: number) => {
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
      me.amount = 0;
      me.label = me.donationsAmount ? this.formatNear(me.donationsAmount) + ' NEAR' : 'Tip';
    }
  };

  onPostButtonExec = async (tweet, me) => {
    me.amount += this._step;
    me.label = this.formatNear(me.donationsAmount + me.amount) + ' NEAR';
    const externalAccount = 'twitter/' + tweet.authorUsername;
    await me.debouncedDonate(me, externalAccount, tweet.id, parseNearAmount(me.amount.toString()));
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
    window.open(`https://explorer.testnet.near.org/accounts/${me.nearAccount}`, '_blank');
  };

  parseNearId(fullname: string, network: string): string | null {
    const regExpMainnet = /(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+\.near/;
    const regExpTestnet = /(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+\.testnet/;
    const nearId = fullname.toLowerCase().match(network === 'testnet' ? regExpTestnet : regExpMainnet);

    return nearId && nearId[0];
  }

  formatNear(amount: number): string {
    return Number(formatNearAmount(parseNearAmount(amount.toString()), 4)).toFixed(2);
  }
}
