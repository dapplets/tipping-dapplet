import { } from '@dapplets/dapplet-extension';
import WHITE_ICON from './icons/money-twiter-light.svg';
import DARK_ICON from './icons/money-twiter-dark.svg';
import { Tweet } from '../../overlay/src/interfaces';
import { PaymentRepository } from './PaymentRepository';
import { TippingsRepository } from './TippingsRepository';
import { TippingService } from './tippingService';

const { parseNearAmount, formatNearAmount } = Core.near.utils.format;

@Injectable
export default class TwitterFeature {

  @Inject('twitter-adapter.dapplet-base.eth')
  public adapter: any;

  private paymentRepository = new PaymentRepository();
  private tippingsRepository = new TippingsRepository();
  private tippingService = new TippingService(this.tippingsRepository, this.paymentRepository);

  private _overlay = Core.overlay({ name: 'overlay', title: 'Tipping Near' })
    .listen({
      getAllUserStat: () =>
        this.tippingService.getAllUserStat()
          .then(x => this._overlay.send('getAllUserStat_done', x))
          .catch(e => this._overlay.send('getAllUserStat_undone', e)),
      donateToUser: (_: any, { type, message }: any) =>
        this.tippingService.donateToUser(message.nearAccountId, message.donateAmount)
          .then(() => this._overlay.send('donateToUser_done'))
          .catch(e => this._overlay.send('donateToUser_undone', e)),
    })

  async activate(): Promise<void> {
    const step = await Core.storage.get('step');
    const network = await Core.storage.get('network');

    if (!(network === 'mainnet' || network === 'testnet')) {
      throw new Error('Only "mainnet" and "testnet" networks are supported. '
        + 'Change the network parameter in the dapplet settings.');
    }

    if (step <= 0) {
      throw new Error('A donation step must be more than zero. '
        + 'Change the step parameter in the dapplet settings.');
    }

    Core.onAction(() => this._overlay.send(''));

    const { button } = this.adapter.exports;
    this.adapter.attachConfig({
      POST: (tweet: Tweet) =>
        button({
          DEFAULT: {
            img: { DARK: WHITE_ICON, LIGHT: DARK_ICON },
            label: 'Tip',
            tooltip: 'Send donation',
            hidden: true,
            init: async (_, me) => {
              const nearId = this.parseNearId(tweet.authorFullname, network);
              if (nearId) {
                me.hidden = false;
                me.nearId = nearId;
                me.label = await this.getDonationsLabel(tweet.id);
              }
            },
            exec: async (_, me) => {
              await this.tippingService.addDonation(me.nearId, tweet.id, step);
              me.label = await this.getDonationsLabel(tweet.id);
              if (this._overlay.isOpen()) this._overlay.send('updated');
            },
          }
        }),
    });
  }

  async getDonationsLabel(tweetId: string): Promise<string> {
    const totalTweetDonation = await this.tippingService.getTotalDonationByTweet(tweetId);
    return (totalTweetDonation)
      ? formatNearAmount(parseNearAmount(totalTweetDonation.toString()), 4) + ' NEAR'
      : 'Tip';
  }

  parseNearId(authorFullname: string, network: string): string | null {
    const regExpMainnet = /(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+\.near/;
    const regExpTestnet = /(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+\.testnet/;
    const nearId = authorFullname
      .toLowerCase()
      .match(network === 'testnet' ? regExpTestnet : regExpMainnet);

    return nearId && nearId[0];
  }
}
