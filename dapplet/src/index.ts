import {} from '@dapplets/dapplet-extension';
import WHITE_ICON from './icons/money-twiter-light.svg';
import DARK_ICON from './icons/money-twiter-dark.svg';
import NEAR_DARK_ICON from './icons/near-dark.svg';
import { Tweet } from '../../overlay/src/interfaces';
import { PaymentRepository } from './repositories/PaymentRepository';
import { TippingsRepository } from './TippingsRepository';
import { TippingService } from './tippingService';
import { IdentityService } from './services/IdentityService';

const { parseNearAmount, formatNearAmount } = Core.near.utils.format;

@Injectable
export default class TwitterFeature {
  @Inject('twitter-adapter.dapplet-base.eth')
  public adapter: any;

  private paymentRepository = new PaymentRepository();
  private tippingsRepository = new TippingsRepository();
  private tippingService = new TippingService(this.tippingsRepository, this.paymentRepository);
  private identityService = new IdentityService();

  private _step: number;
  private _network: string;

  private _overlay = Core.overlay({ name: 'overlay', title: 'Tipping Near' }).listen({
    getAllUserStat: () =>
      this.tippingService
        .getAllUserStat()
        .then((x) => this._overlay.send('getAllUserStat_done', x))
        .catch((e) => this._overlay.send('getAllUserStat_undone', e)),
    donateToUser: (_: any, { type, message }: any) =>
      this.tippingService
        .donateToUser(message.nearAccountId, message.donateAmount)
        .then(() => this._overlay.send('donateToUser_done'))
        .catch((e) => this._overlay.send('donateToUser_undone', e)),
  });

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

    Core.onAction(() => this._overlay.send(''));

    const { button, avatarBadge } = this.adapter.exports;

    this.adapter.attachConfig({
      PROFILE: (profile: any) => [
        button({
          DEFAULT: {
            hidden: true,
            init: this.onProfileButtonDefaultInit,
          },
          LINK: {
            img: NEAR_DARK_ICON,
            label: 'Link Account',
            tooltip: 'Link account with NEAR wallet',
            exec: this.onProfileButtonLinkExec,
          },
          UNLINK: {
            img: NEAR_DARK_ICON,
            label: 'Unlink Account',
            tooltip: 'Unlink account from NEAR wallet',
            exec: this.onProfileButtonUnlinkExec,
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
            hidden: true,
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

  onProfileButtonDefaultInit = async (ctx, me) => {
    const user = this.adapter.getCurrentUser();
    const isMyProfile = ctx.id === user.username;
    if (isMyProfile) {
      const nearAccount = await this.identityService.getNearAccount('twitter/' + ctx.id);
      me.state = nearAccount ? 'UNLINK' : 'LINK';
    }
  };

  onProfileButtonLinkExec = (ctx, me) => {
    const nearAccount = this.parseNearId(ctx.authorFullname, this._network);
    if (!nearAccount) {
      alert('Add NEAR Account ID in your profile name before continue.');
    } else {
      this.identityService.requestVerification(`twitter/${ctx.id}`, false, 'https://twitter.com/' + ctx.id);
    }
  };

  onProfileButtonUnlinkExec = (ctx, me) => {
    const nearAccount = this.parseNearId(ctx.authorFullname, this._network);
    if (nearAccount) {
      alert('Remove NEAR Account ID from your profile name before continue.');
    } else {
      this.identityService.requestVerification(`twitter/${ctx.id}`, true, 'https://twitter.com/' + ctx.id);
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
    const nearId = this.parseNearId(tweet.authorFullname, this._network);
    if (nearId) {
      me.hidden = false;
      me.nearId = nearId;
      me.label = await this.getDonationsLabel(tweet.id);
    }
  };

  onPostButtonExec = async (tweet, me) => {
    await this.tippingService.addDonation(me.nearId, tweet.id, this._step);
    me.label = await this.getDonationsLabel(tweet.id);
    if (this._overlay.isOpen()) this._overlay.send('updated');
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

  async getDonationsLabel(tweetId: string): Promise<string> {
    const totalTweetDonation = await this.tippingService.getTotalDonationByTweet(tweetId);
    return totalTweetDonation ? formatNearAmount(parseNearAmount(totalTweetDonation.toString()), 4) + ' NEAR' : 'Tip';
  }

  parseNearId(fullname: string, network: string): string | null {
    const regExpMainnet = /(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+\.near/;
    const regExpTestnet = /(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+\.testnet/;
    const nearId = fullname.toLowerCase().match(network === 'testnet' ? regExpTestnet : regExpMainnet);

    return nearId && nearId[0];
  }
}
