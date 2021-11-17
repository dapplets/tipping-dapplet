import { ButtonCTXProps, ITipping } from "../../overlay/src/interfaces";


interface ITippingsRepository {
	getAll: () => Promise<ITipping[]>;
	create: (tipping: ITipping) => Promise<void>;
	parsing: (nearId: string, ctxButton: ButtonCTXProps) => Promise<ITipping>;
}

export class TippingsRepository implements ITippingsRepository {
	private _tippings = 'tippings';
	private _step: number;

	constructor() {
		this.getStep()
	}

	private async getStep(): Promise<void> {
		this._step = await Core.storage.get('step');
	}

	async getAll(): Promise<ITipping[]> {
		return JSON.parse(await Core.storage.get(this._tippings) || "[]");
	}

	async create(tipping: ITipping): Promise<void> {
		if (!tipping) return;

		const prevValue = await this.getAll() || [];
		const update = this.updateTippings(prevValue, tipping);

		await Core.storage.set(this._tippings, JSON.stringify(update));
	}

	private updateTippings(prevValues: ITipping[], newValue: ITipping): ITipping[] {
		const itemIndex = prevValues.findIndex(item => item.tweetId === newValue.tweetId);
		if (itemIndex === -1) return [...prevValues, newValue];

		const getTipping = prevValues[itemIndex];
		const updateTipping = { ...getTipping, count: getTipping.count + this._step, }

		return [
			...prevValues.slice(0, itemIndex),
			updateTipping,
			...prevValues.slice(itemIndex + 1)
		];
	}

	public async parsing(nearId: string, ctxButton: ButtonCTXProps): Promise<ITipping> {
		return nearId && {
			nearId,
			count: this._step,
			tweetId: ctxButton.id
		}
	}
}