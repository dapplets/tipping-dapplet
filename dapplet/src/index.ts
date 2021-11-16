import { } from '@dapplets/dapplet-extension';
import EXAMPLE_IMG from './icons/money-svgrepo-com.svg';
import { ButtonCTXProps, ITipping } from '../../overlay/src/interfaces';

// https://twitter.com/rimberjack
// https://twitter.com/ilblackdragon
// https://twitter.com/LearnNear

// (([a-z\d]+[\-_])*[a-z\d]+\.)*([a-z\d]+[\-_])*[a-z\d]+\.near

export const nameStorage = 'tippings';

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
                .then((item) => {
                  console.log(item);
                })
            }
            catch (err) {
              console.error('ERROR:', err);
            }
          }
        });
    }

    Core.onAction(() => this.openOverlay());

    const wallet = await Core.wallet({ type: 'near', network: 'testnet' });
    console.log(wallet);

    const { button } = this.adapter.exports;
    this.adapter.attachConfig({
      POST: (ctx: ButtonCTXProps) =>
        button({
          DEFAULT: {
            img: EXAMPLE_IMG,
            tooltip: 'Send donation',
            exec: async () => {
              await this.saveTippingInStorage(this.parsingTipping(ctx));
              await this.updateOverlay();
            },
          },
        }),
    });
  }

  async saveTippingInStorage(newValue: ITipping): Promise<void> {
    if (!newValue) return;

    const prevValue = await this.getTippingInStorage() || [];
    const update = this.updateTippings(prevValue, newValue);
    await Core.storage.set(nameStorage, JSON.stringify(update));
  }

  async getTippingInStorage(): Promise<ITipping[]> {
    return JSON.parse(await Core.storage.get(nameStorage) || "[]");
  }

  parsingTipping(value: ButtonCTXProps): ITipping {
    const nearId = this.getNearId(value.authorFullname);

    return nearId && {
      count: 1,
      nearId: nearId,
      tweetId: value.id
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

  updateTippings(prevTippings: ITipping[], newTipping: ITipping): ITipping[] {
    const itemIndex = prevTippings.findIndex(item => item.nearId === newTipping.nearId);
    if (itemIndex === -1) return [...prevTippings, newTipping];

    const getTipping = prevTippings[itemIndex];
    const updateTipping = { ...getTipping, count: getTipping.count + 1 }

    return [
      ...prevTippings.slice(0, itemIndex),
      updateTipping,
      ...prevTippings.slice(itemIndex + 1)
    ]
  }

  async openOverlay(): Promise<void> {
    const getTippings = await this.getTippingInStorage();
    this._overlay.send('data', getTippings);
  }

  async updateOverlay(): Promise<void> {
    if (this._overlay.isOpen()) this.openOverlay();
  }
}