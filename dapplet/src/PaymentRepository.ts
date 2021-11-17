// Class for interacting with paid tweets
import { } from '@dapplets/dapplet-extension';
import { IPayment } from "../../overlay/src/interfaces";

interface IPaymentRepository {
	getAll: () => Promise<IPayment[]>;
	upsert: (tipping: IPayment) => Promise<void>;
}

export class PaymentRepository implements IPaymentRepository {
	private _payment = 'payments';

	public async getAll(): Promise<IPayment[]> {
		return JSON.parse(await Core.storage.get(this._payment) || "[]");
	}

	async getByPaymentNearId(nearAccountId: string): Promise<IPayment | null> {
		const payments = await this.getAll();
		return payments.find(x => x.nearId === nearAccountId) ?? null;
	}

	async upsert(newValue: IPayment): Promise<void> {
		const prevValues = await this.getAll() || [];

		const itemIndex = prevValues.findIndex(item => item.nearId === newValue.nearId);
		if (itemIndex === -1) {
			return Core.storage.set(this._payment, JSON.stringify([...prevValues, newValue]));
		}

		prevValues[itemIndex] = newValue; // update
		return Core.storage.set(this._payment, JSON.stringify(prevValues));
	}
}
