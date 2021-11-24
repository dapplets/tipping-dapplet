import { ITipping } from "../interfaces";

interface ITippingsRepository {
	getAll: () => Promise<ITipping[]>;
	upsert: (tipping: ITipping) => Promise<void>;
}

export class TippingsRepository implements ITippingsRepository {
	private _tippings = 'tippings';

	async getAll(): Promise<ITipping[]> {
		return JSON.parse(await Core.storage.get(this._tippings) || "[]");
	}

	async getByTweetId(tweetId: string): Promise<ITipping | null> {
		const tippings = await this.getAll();
		return tippings.find(x => x.tweetId === tweetId) ?? null;
	}

	async upsert(newValue: ITipping): Promise<void> {
		if (!newValue) return;
		const prevValues = await this.getAll() || [];

		const itemIndex = prevValues.findIndex(item => item.tweetId === newValue.tweetId);
		if (itemIndex === -1) {
			// insert
			return Core.storage
				.set(this._tippings, JSON.stringify([...prevValues, newValue]));
		}

		prevValues[itemIndex] = newValue; // update
		return Core.storage.set(this._tippings, JSON.stringify(prevValues));
	}
}