import React, { useEffect, useState } from 'react';
import { Button, Container, Header, List } from 'semantic-ui-react';
import { bridge } from './dappletBridge';
import './app.css';
import { ISendTipping, ITipping } from './interfaces';


export default () => {
  const [tippings, setTippings] = useState<null | ITipping[]>(null);

  useEffect(() => bridge.onData(setTippings), []);

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

  return (
    <React.Fragment>
      <Container className="c-container">
        <Header as="h1" className='title'>Tipping Near</Header>
      </Container>

      <Container style={{ margin: 20 }}>
        <List className='list' divided relaxed>
          {tippings && tippings.map(({ nearId, count, tweetId }) => {

            return (
              <List.Item
                key={tweetId}
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
