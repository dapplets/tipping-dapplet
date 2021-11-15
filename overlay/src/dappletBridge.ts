import GeneralBridge from '@dapplets/dapplet-overlay-bridge';

class Bridge extends GeneralBridge {
  _subId: number = 0;

  onData(callback: (data?: any) => void) {
    this.subscribe('data', (data: any) => { });
  }
}

const bridge = new Bridge();

export { bridge, Bridge };
