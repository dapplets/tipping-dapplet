import React, { useEffect, useState } from 'react';
import { Button, Container, Header, List } from 'semantic-ui-react';
import { bridge } from './dappletBridge';
import './app.css';
import { ISendTipping, ITipping } from './interfaces';
import { groupBy } from 'lodash';


export default () => {
  const [tippings, setTippings] = useState<null | ISendTipping[]>(null);

  useEffect(() => {
    bridge.onData(item => {
      const parsing = tippingParsing(item);
      setTippings(parsing);
    })
  }, []);

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
    bridge.sendNearToken({ nearId, count });
  }

  console.log(tippings);


  return (
    <React.Fragment>
      <Container className="c-container">
        <Header as="h1" className='title'>Tipping Near</Header>
      </Container>

      <Container style={{ margin: 20 }}>
        <List className='list' divided relaxed>
          {tippings && tippings.map(({ nearId, count }, key) => {
            console.log(nearId, count);


            return (
              <List.Item
                key={key}
                style={{ display: 'flex', justifyContent: 'space-between' }}>
                <List.Content>
                  <List.Header as="h3">{nearId}</List.Header>
                  <List.Description as="span">{count} NEAR</List.Description>
                </List.Content>
                <Button
                  style={{ marginLeft: 'auto' }}
                  onClick={() => onClick({ nearId, count })}
                >Send
                </Button>
              </List.Item>
            );
          })}
        </List>
      </Container>
    </React.Fragment>
  );
};
