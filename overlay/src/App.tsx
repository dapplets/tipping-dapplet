import React, { useEffect, useState } from 'react';
import { Button, Container, Header, List } from 'semantic-ui-react';
import { bridge } from './dappletBridge';
import { IPayment, ISendTipping, ITipping, ITippingsState } from './interfaces';
import { groupBy } from 'lodash';
import './app.css';

export default () => {
  const [tippings, setTippings] = useState<null | ITippingsState[]>(null);

  useEffect(() => {
    bridge.onData(item => {
      const mergeArr = merge(tippingParsing(item.tippings), item.payment);
      setTippings(mergeArr);
    })
  }, []);

  function merge(arr1: any, arr2: any) {
    let merged = [];

    for (let i = 0; i < arr1.length; i++) {
      merged.push({
        ...arr1[i],
        ...(arr2.find((itmInner: IPayment) => itmInner.nearId === arr1[i].nearId) ?? { payment: 0 })
      });
    }

    return merged;
  }

  function tippingParsing(tippings: ITipping[]) {
    const group = groupBy(tippings, 'nearId');

    return Object.keys(group)
      .reduce((acc: any, item) => {
        const obj = group[item]
          .reduce((acc: any, item) => {
            return {
              nearId: item.nearId,
              count: acc.count + item.count
            }
          }, { count: 0, });

        acc.push(obj);
        return acc;
      }, []);
  }

  async function onClick(config: ISendTipping) {
    try {
      // fisabled true
      await isWalletConnected();
      await onSendTipping(config);
    }
    catch (error) {
      console.error('ERROR to APP.tsx:', error);
    }
  }

  async function isWalletConnected() {
    bridge.isWalletConnected()
      .then(async (isWalletConnected) => {
        if (isWalletConnected) return await bridge.getCurrentNearAccount();

        return bridge.connectWallet();
      });
  }

  async function onSendTipping({ count, nearId }: ISendTipping) {
    count > 0 && bridge.sendNearToken({ nearId, count });
  }

  return (
    <React.Fragment>
      <Container className="c-container">
        <Header as="h1" className='title'>Tipping Near</Header>
      </Container>

      <Container style={{ margin: 20 }}>
        <List className='list' divided relaxed>
          {tippings && tippings.map(({ nearId, count, payment }, key) => {
            const resultCount = toFixed(count - payment);

            return (
              <List.Item
                key={key}
                style={{ display: 'flex', justifyContent: 'space-between' }}>
                <List.Content>
                  <List.Header as="h3">{nearId}</List.Header>
                  <List.Description as="span">{toFixed(count)} NEAR ({toFixed(payment)} already paid)</List.Description>
                </List.Content>
                <Button
                  style={{ marginLeft: 'auto', maxWidth: 140, width: '100%', whiteSpace: 'nowrap' }}
                  onClick={() => onClick({ nearId, count: resultCount })}
                  disabled={resultCount === 0}
                >
                  Send {resultCount} NEAR
                </Button>
              </List.Item>
            );
          })}
        </List>
      </Container>
    </React.Fragment>
  );
};

function toFixed(value: number): number {
  const power = Math.pow(10, 14);
  return Number(String(Math.round(value * power) / power));
}