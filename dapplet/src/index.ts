import { } from '@dapplets/dapplet-extension';
import EXAMPLE_IMG from './icons/money-svgrepo-com.svg';

// https://twitter.com/rimberjack
// https://twitter.com/ilblackdragon
// https://twitter.com/LearnNear


// (([a-z\d]+[\-_])*[a-z\d]+\.)*([a-z\d]+[\-_])*[a-z\d]+\.near

const nameStorage = 'tippings';

interface ButtonCTXProps {
  authorFullname: string;
  authorImg: string;
  authorUsername: string;
  id: string;
  parent: null
  text: string;
  theme: string;
}

interface ITipping {
  tweetId: string;
  nearId: string;
  count: number;
}

@Injectable
export default class TwitterFeature {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any,  @typescript-eslint/explicit-module-boundary-types
  @Inject('twitter-adapter.dapplet-base.eth') public adapter: any;
  private _overlay: any;

  async activate(): Promise<void> {

    const { button } = this.adapter.exports;
    this.adapter.attachConfig({
      POST: (ctx: ButtonCTXProps) =>
        button({
          DEFAULT: {
            img: EXAMPLE_IMG,
            tooltip: 'Send donation',
            exec: async () => {
              await saveTippingInStorage(parsingTipping(ctx));
              console.log('getTippingInStorage в exec:', await getTippingInStorage());
            },
          },
        }),
    });

    async function saveTippingInStorage(newValue: ITipping) {
      if (!newValue) return false;

      const prevValue = await getTippingInStorage() || [];
      const update = updateTippings(prevValue, newValue);
      await Core.storage.set(nameStorage, JSON.stringify(update));
    }

    async function getTippingInStorage(): Promise<ITipping[]> {
      return JSON.parse(await Core.storage.get(nameStorage) || "[]");
    }


    function parsingTipping(value: ButtonCTXProps): ITipping {
      const nearId = getNearId(value.authorFullname);

      return nearId && {
        count: 0,
        nearId: nearId,
        tweetId: value.id
      }
    }

    function getNearId(authorFullname: string): string | null {
      const regExp = /(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+\.near/;

      const nearId = authorFullname
        .toLowerCase()
        .match(regExp);

      return nearId && nearId[0];
    }

    function updateTippings(prevTippings: ITipping[], newTipping: ITipping): ITipping[] {
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
  }
}

