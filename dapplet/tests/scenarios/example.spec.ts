import { test } from '../fixtures/fixtures';
import fs from 'fs';
import path from 'path';
import { Overlay } from '../pages/overlay';

const tipsReciever = {
  username: 'alsakhaev',
  bio: 'Web3 Developer at Dapplets',
};

const artifactsPath = path.join(__dirname, '..', 'artifacts');
const cookiesPath = path.join(artifactsPath, 'cookies.json');

test('Login in twitter', async ({ context }) => {
  // apply cookies if exist
  if (fs.existsSync(cookiesPath)) {
    const cookies = fs.readFileSync(cookiesPath, 'utf8');
    const deserializedCookies = JSON.parse(cookies);
    await context.addCookies(deserializedCookies);
  }

  const page = await context.newPage();

  const overlay = new Overlay(page);

  await overlay.runDapplet(tipsReciever, context, artifactsPath, cookiesPath);
});
