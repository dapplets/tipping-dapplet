import React, { useEffect, useState } from 'react';
import { Button, Container, Header, List } from 'semantic-ui-react';
import { bridge } from './dappletBridge';
import './app.css';
import { ITipping } from './interfaces';

export default () => {
  const [tippings, setTippings] = useState<null | ITipping[]>(null);

  useEffect(() => bridge.onData(setTippings), []);

  return (
    <React.Fragment>
      <Container className="c-container">
        <Header as="h1" className='title'>Tipping Near</Header>
      </Container>

      <Container style={{ margin: 20 }}>
        <List className='list' divided relaxed>
          {tippings && tippings.map(({ nearId, count, tweetId }) => {

            return (
              <List.Item style={{ display: 'flex', justifyContent: 'space-between' }} key={tweetId}>
                <List.Content>
                  <List.Header as="h3">{nearId}:</List.Header>
                  <List.Description as="span">{count} NEAR</List.Description>
                </List.Content>
                <Button style={{ marginLeft: 'auto' }}>Send</Button>
              </List.Item>
            )
          })}
        </List>
      </Container>
    </React.Fragment>
  );
};
