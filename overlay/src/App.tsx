import React, { useEffect, useState } from 'react';
import { Button, Container, Header, List } from 'semantic-ui-react';
import { bridge } from './dappletBridge';
import { IPayment, ISendTipping, ITipping, ITippingsState } from './interfaces';
import { groupBy } from 'lodash';
import { UserStat } from '../../dapplet/src/services/tippingService';
import './app.css';

export default () => {
  const [userStat, setUserStat] = useState<UserStat[]>([]);

  useEffect(() => {
    bridge.getAllUserStat().then(setUserStat);
    bridge.onUpdate(() => bridge.getAllUserStat().then(setUserStat));
  }, []);

  async function onClick(config: ISendTipping) {
    try {
      // disabled true
      await bridge.donateToUser(config.nearId, config.count);
      const stat = await bridge.getAllUserStat();
      setUserStat(stat);
    }
    catch (error) {
      console.error('ERROR to APP.tsx:', error);
    }
  }

  return (
    <React.Fragment>
      <Container className="c-container">
        <Header as="h1" className='title'>Tipping Near</Header>
      </Container>

      <Container style={{ margin: 20 }}>
        <List className='list' divided relaxed>
          {userStat && userStat.map(({ nearId, count, payment, resultCount }, key) => {
            return (
              <List.Item
                key={key}
                style={{ display: 'flex', justifyContent: 'space-between' }}>
                <List.Content>
                  <List.Header as="h3">{nearId}</List.Header>
                  <List.Description as="span">{count} NEAR ({payment} already paid)</List.Description>
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