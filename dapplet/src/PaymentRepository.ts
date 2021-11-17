// Class for interacting with paid tweets
import { } from '@dapplets/dapplet-extension';
import { IPayment } from "../../overlay/src/interfaces";

interface IPaymentRepository {
	getAll: () => Promise<IPayment[]>;
	create: (payment: IPayment) => Promise<void>;
}

export class PaymentRepository implements IPaymentRepository {
	private _payment = 'payments';

	public async getAll(): Promise<IPayment[]> {
		return JSON.parse(await Core.storage.get(this._payment) || "[]");
	}

	public async create(payment: IPayment): Promise<void> {
		const prevValue = await this.getAll() || [];
		const update = this.updatePayment(prevValue, payment);

		await Core.storage.set(this._payment, JSON.stringify(update)); // DataLayer
	}

	private updatePayment(prevValue: IPayment[], newValue: IPayment): IPayment[] {
		const itemIndex = prevValue.findIndex(item => item.nearId === newValue.nearId);
		if (itemIndex === -1) return [...prevValue, newValue];

		const getPayment = prevValue[itemIndex];
		const updatePayment = { ...getPayment, payment: getPayment.payment + newValue.payment }

		return [
			...prevValue.slice(0, itemIndex),
			updatePayment,
			...prevValue.slice(itemIndex + 1)
		];
	}
}
