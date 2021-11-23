import GeneralBridge from '@dapplets/dapplet-overlay-bridge';
import { ISendTipping, onDataProps } from './interfaces';
import { UserStat } from '../../dapplet/src/services/tippingService';

class Bridge extends GeneralBridge {
  _subId: number = 0;

  onUpdate(callback: () => void) {
    this.subscribe('updated', () => {
      this._subId = Math.trunc(Math.random() * 1_000_000_000);
      callback();
      return this._subId.toString();
    });
  }

  async getAllUserStat(): Promise<UserStat[]> {
    return this.call(
      'getAllUserStat',
      null,
      'getAllUserStat_done',
      'getAllUserStat_undone'
    );
  }

  async donateToUser(nearAccountId: string, donateAmount: number): Promise<string> {
    return this.call(
      'donateToUser',
      { nearAccountId, donateAmount },
      'donateToUser_done',
      'donateToUser_undone'
    );
  }

  public async call(
    method: string,
    args: any,
    callbackEventDone: string,
    callbackEventUndone: string
  ): Promise<any> {
    return new Promise((res, rej) => {
      this.publish(this._subId.toString(), {
        type: method,
        message: args,
      });
      this.subscribe(callbackEventDone, (result: any) => {
        this.unsubscribe(callbackEventDone);
        this.unsubscribe(callbackEventUndone);
        res(result);
      });
      this.subscribe(callbackEventUndone, () => {
        this.unsubscribe(callbackEventUndone);
        this.unsubscribe(callbackEventDone);
        rej('The transaction was rejected.');
      });
    });
  }
}

const bridge = new Bridge();

export { bridge, Bridge };
