import { } from '@dapplets/dapplet-extension';
import WHITE_ICON from './icons/money-twiter-light.svg';
import DARK_ICON from './icons/money-twiter-dark.svg';
import { ButtonCTXProps } from '../../overlay/src/interfaces';
import { PaymentRepository } from './PaymentRepository';
import { TippingsRepository } from './TippingsRepository';

// https://twitter.com/rimberjack
// https://twitter.com/ilblackdragon
// https://twitter.com/LearnNear

// (([a-z\d]+[\-_])*[a-z\d]+\.)*([a-z\d]+[\-_])*[a-z\d]+\.near

// receiver_id: "alsakhaev.testnet"

export const nameTippings = 'tippings';
export const namePayments = 'payments';

const { parseNearAmount, formatNearAmount } = Core.near.utils.format;

const paymentRepository = new PaymentRepository();
const tippingsRepository = new TippingsRepository();

@Injectable
export default class TwitterFeature {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any,  @typescript-eslint/explicit-module-boundary-types
  @Inject('twitter-adapter.dapplet-base.eth') public adapter: any;
  private _overlay: any;

  async activate(): Promise<void> {
    const network = await Core.storage.get('network');

    if (!this._overlay) {
      this._overlay = (<any>Core)
        .overlay({ name: 'overlay', title: 'Tipping Near' })
        .listen({
          connectWallet: async () => {
            try {
              const wallet = await Core.wallet({ type: 'near', network: network });
              await wallet.connect();
              this._overlay.send('connectWallet_done', wallet.accountId);
            } catch (err) {
              this._overlay.send('connectWallet_undone', err);
            }
          },
          disconnectWallet: async () => {
            try {
              const wallet = await Core.wallet({ type: 'near', network: network });
              await wallet.disconnect();
              this._overlay.send('disconnectWallet_done');
            } catch (err) {
              this._overlay.send('disconnectWallet_undone', err);
            }
          },
          isWalletConnected: async () => {
            try {
              const wallet = await Core.wallet({ type: 'near', network: network });
              const isWalletConnected = await wallet.isConnected();
              this._overlay.send('isWalletConnected_done', isWalletConnected);
            } catch (err) {
              this._overlay.send('isWalletConnected_undone', err);
            }
          },
          getCurrentNearAccount: async () => {
            try {
              const wallet = await Core.wallet({ type: 'near', network: network });
              this._overlay.send('getCurrentNearAccount_done', wallet.accountId);
            } catch (err) {
              this._overlay.send('getCurrentNearAccount_undone', err);
            }
          },
          sendNearToken: async (_: any, { type, message }: any) => {
            try {
              const wallet = await Core.wallet({ type: 'near', network: network });

              // Переписать на async/await
              wallet.sendMoney(
                message.nearId,
                parseNearAmount(String(message.count))
              )
                .then(async () => {
                  // current_sending: false,

                  await paymentRepository.create({ nearId: message.nearId, payment: message.count })
                  await this.updateOverlay();
                })
            }
            catch (err) {
              console.error('ERROR:', err);
            }
          }
        });
    }

    Core.onAction(() => this.openOverlay());

    const { button } = this.adapter.exports;
    this.adapter.attachConfig({
      POST: (ctx: ButtonCTXProps) =>
        button({
          initial: 'HIDDEN',
          HIDDEN: {
            hidden: true,
            init: async (_, me) => {
              const nearId = this.getNearId(ctx.authorFullname, network);
              if (nearId) {
                me.state = 'READY';
                await this.setCountToLabel(ctx, me);
              }
            }
          },
          READY: {
            img: {
              DARK: WHITE_ICON,
              LIGHT: DARK_ICON
            },
            label: 'Tip',
            tooltip: 'Send donation',
            exec: async (_, me) => {
              const nearId = this.getNearId(ctx.authorFullname, network);
              if (nearId) await tippingsRepository.create(await tippingsRepository.parsing(nearId, ctx))

              await this.updateOverlay();
              await this.setCountToLabel(ctx, me);
            },
          }
        }),
    });
  }

  async setCountToLabel(ctx: ButtonCTXProps, me: any): Promise<void> {
    const getTippingInStorage = await tippingsRepository.getAll();
    for (const item of getTippingInStorage) {
      if (item.tweetId === ctx.id) {
        me.label = formatNearAmount(parseNearAmount(item.count.toString()), 4) + ' NEAR';
        break;
      }
    }
  }

  getNearId(authorFullname: string, network: string): string | null {
    const regExpMainnet = /(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+\.near/;
    const regExpTestnet = /(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+\.testnet/;
    const nearId = authorFullname
      .toLowerCase()
      .match(network === 'testnet' ? regExpTestnet : regExpMainnet);

    return nearId && nearId[0];
  }

  async openOverlay(): Promise<void> {
    const tippings = await tippingsRepository.getAll();
    const payment = await paymentRepository.getAll();
    this._overlay.send('data', { tippings, payment });
  }

  async updateOverlay(): Promise<void> {
    if (this._overlay.isOpen()) this.openOverlay();
  }
}
