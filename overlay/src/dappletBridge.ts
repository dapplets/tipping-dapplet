import GeneralBridge from '@dapplets/dapplet-overlay-bridge';
import { ISendTipping } from './interfaces';

class Bridge extends GeneralBridge {
  _subId: number = 0;

  onData(callback: (data?: any) => void) {
    this.subscribe('data', (data: any) => {
      this._subId = Math.trunc(Math.random() * 1_000_000_000);
      callback(data);
      return this._subId.toString();
    });
  }

  async connectWallet(): Promise<string> {
    return this.call(
      'connectWallet',
      null,
      'connectWallet_done',
      'connectWallet_undone'
    );
  }

  async disconnectWallet(): Promise<string> {
    return this.call(
      'disconnectWallet',
      null,
      'disconnectWallet_done',
      'disconnectWallet_undone'
    );
  }

  async isWalletConnected(): Promise<boolean> {
    return this.call(
      'isWalletConnected',
      null,
      'isWalletConnected_done',
      'isWalletConnected_undone'
    );
  }

  async getCurrentNearAccount(): Promise<string> {
    return this.call(
      'getCurrentNearAccount',
      null,
      'getCurrentNearAccount_done',
      'getCurrentNearAccount_undone'
    );
  }

  sendNearToken({ nearId, count }: ISendTipping) {
    return this.call(
      'sendNearToken',
      { nearId, count },
      'sendNearToken_done',
      'sendNearToken_undone'
    )
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
