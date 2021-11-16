import { } from '@dapplets/dapplet-extension';
import WHITE_ICON from './icons/money-twiter-light.svg';
import DARK_ICON from './icons/money-twiter-dark.svg';
import { ButtonCTXProps, IPayments, ITipping } from '../../overlay/src/interfaces';

// https://twitter.com/rimberjack
// https://twitter.com/ilblackdragon
// https://twitter.com/LearnNear

// (([a-z\d]+[\-_])*[a-z\d]+\.)*([a-z\d]+[\-_])*[a-z\d]+\.near

// receiver_id: "alsakhaev.testnet"

export const nameTippings = 'tippings';
export const namePayments = 'payments';

@Injectable
export default class TwitterFeature {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any,  @typescript-eslint/explicit-module-boundary-types
  @Inject('twitter-adapter.dapplet-base.eth') public adapter: any;
  private _overlay: any;

  async activate(): Promise<void> {
    if (!this._overlay) {
      this._overlay = (<any>Core)
        .overlay({ name: 'overlay', title: 'Tipping Near' })
        .listen({
          connectWallet: async () => {
            try {
              const wallet = await Core.wallet({ type: 'near', network: 'testnet' });
              await wallet.connect();
              this._overlay.send('connectWallet_done', wallet.accountId);
            } catch (err) {
              this._overlay.send('connectWallet_undone', err);
            }
          },
          disconnectWallet: async () => {
            try {
              const wallet = await Core.wallet({ type: 'near', network: 'testnet' });
              await wallet.disconnect();
              this._overlay.send('disconnectWallet_done');
            } catch (err) {
              this._overlay.send('disconnectWallet_undone', err);
            }
          },
          isWalletConnected: async () => {
            try {
              const wallet = await Core.wallet({ type: 'near', network: 'testnet' });
              const isWalletConnected = await wallet.isConnected();
              this._overlay.send('isWalletConnected_done', isWalletConnected);
            } catch (err) {
              this._overlay.send('isWalletConnected_undone', err);
            }
          },
          getCurrentNearAccount: async () => {
            try {
              const wallet = await Core.wallet({ type: 'near', network: 'testnet' });
              this._overlay.send('getCurrentNearAccount_done', wallet.accountId);
            } catch (err) {
              this._overlay.send('getCurrentNearAccount_undone', err);
            }
          },
          sendNearToken: async (_: any, { type, message }: any) => {
            try {
              const wallet = await Core.wallet({ type: 'near', network: 'testnet' });
              wallet.sendMoney(message.nearId, String(message.count) + '000000000000000000000000')
                .then(async () => {
                  await this.savePaymentsInStorage({ nearId: message.nearId, payment: message.count });
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
          DEFAULT: {
            img: {
              DARK: WHITE_ICON,
              LIGHT: DARK_ICON
            },
            label: 'Tip',
            tooltip: 'Send donation',
            exec: async (_, me) => {
              await this.saveTippingInStorage(this.parsingTipping(ctx));
              await this.updateOverlay();
              await this.setCountToLabel(ctx, me);
            },
            init: async (_, me) => {
              await this.setCountToLabel(ctx, me);
            }
          },
        }),
    });
  }

  async setCountToLabel(ctx: ButtonCTXProps, me: any): Promise<void> {
    const getTippingInStorage = await this.getTippingInStorage();

    for (const item of getTippingInStorage) {
      if (item.tweetId === ctx.id) {
        me.label = item.count + ' NEAR';
        break;
      }
    }
  }

  async saveTippingInStorage(newValue: ITipping): Promise<void> {
    if (!newValue) return;

    const prevValue = await this.getTippingInStorage() || [];
    const update = this.updateTippings(prevValue, newValue);

    await Core.storage.set(nameTippings, JSON.stringify(update)); // DataLayer
  }

  async savePaymentsInStorage(payments: IPayments): Promise<void> {
    const prevValue = await this.getPaymentsInStorage() || [];
    const update = this.updatePayment(prevValue, payments);

    await Core.storage.set(namePayments, JSON.stringify(update)); // DataLayer
  }

  async getTippingInStorage(): Promise<ITipping[]> {
    return JSON.parse(await Core.storage.get(nameTippings) || "[]"); // DataLayer (JSON => Object)
  }

  async getPaymentsInStorage(): Promise<IPayments[]> {
    return JSON.parse(await Core.storage.get('payments') || "[]"); // DataLayer (JSON => Object)
  }

  parsingTipping(ctxButton: ButtonCTXProps): ITipping {
    const nearId = this.getNearId(ctxButton.authorFullname);

    return nearId && {
      nearId,
      count: 1,
      tweetId: ctxButton.id
    }
  }

  getNearId(authorFullname: string): string | null {
    // const regExp = /(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+\.near/;
    const regExp = /(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+\.testnet/;
    const nearId = authorFullname
      .toLowerCase()
      .match(regExp);

    return nearId && nearId[0];
  }

  // Data Layer
  updateTippings(prevTippings: ITipping[], newTipping: ITipping): ITipping[] {
    const itemIndex = prevTippings.findIndex(item => item.tweetId === newTipping.tweetId);
    if (itemIndex === -1) return [...prevTippings, newTipping];

    const getTipping = prevTippings[itemIndex];
    const updateTipping = { ...getTipping, count: getTipping.count + 1, }

    return [
      ...prevTippings.slice(0, itemIndex),
      updateTipping,
      ...prevTippings.slice(itemIndex + 1)
    ]
  }

  updatePayment(prevPayment: IPayments[], newPayment: IPayments): IPayments[] {
    const itemIndex = prevPayment.findIndex(item => item.nearId === newPayment.nearId);
    if (itemIndex === -1) return [...prevPayment, newPayment];

    const getPayment = prevPayment[itemIndex];
    const updatePayment = { ...getPayment, payment: getPayment.payment + newPayment.payment }

    return [
      ...prevPayment.slice(0, itemIndex),
      updatePayment,
      ...prevPayment.slice(itemIndex + 1)
    ];
  }

  async openOverlay(): Promise<void> {
    const tippings = await this.getTippingInStorage();
    const payment = await this.getPaymentsInStorage();
    this._overlay.send('data', { tippings, payment });
  }

  async updateOverlay(): Promise<void> {
    if (this._overlay.isOpen()) this.openOverlay();
  }
}
