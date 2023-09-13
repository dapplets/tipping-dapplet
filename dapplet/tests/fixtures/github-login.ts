import { test as base, DappletExecutor } from '@dapplets/dapplet-playwright';
import fs from 'fs';
import path from 'path';
import { ImapFlow } from "imapflow";

const artifactsPath = path.join(__dirname, '..', 'artifacts');
const cookiesPath = path.join(artifactsPath, 'cookies.json');

type ExtendParams = Parameters<typeof base.extend<{

}>>;

export const fixture: ExtendParams[0] = {
  page: async ({ context }, use) => {
    test.setTimeout(200000); // authorization in Twitter is a long process

    if (fs.existsSync(cookiesPath)) {
      const cookies = fs.readFileSync(cookiesPath, "utf8");
      const deserializedCookies = JSON.parse(cookies);
      await context.addCookies(deserializedCookies);
    }

    const page = await context.newPage();
// change proccess env
    await page.goto("https://github.com/" + process.env.GITHUB_AUTH_USERNAME);
    // await page.waitForTimeout(5000); // ToDo: remove

    // ToDo: move to POM
    // change isSigningIn
    const isSigningIn = await page.getByText("Sign in").isVisible();
    if (isSigningIn) {
        await page.getByText("Sign in").click()
        await page.fill('[name="login"]', process.env.GITHUB_AUTH_USERNAME);
     
        await page.locator("input[name=password]").type(process.env.GITHUB_AUTH_PASSWORD)
        await page.locator("input[name=commit]").click()
     
    }

    
      const cookies = await context.cookies();
      const cookieJson = JSON.stringify(cookies);
      fs.mkdirSync(artifactsPath, { recursive: true });
      fs.writeFileSync(cookiesPath, cookieJson);
    

    await use(page);
  }
};

export const test = base.extend(fixture).extend(DappletExecutor.fixture);

export const expect = test.expect;

function waitForEventWithTimeout(
  emitter: NodeJS.EventEmitter,
  eventName: string,
  timeout: number
): Promise<any> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line prefer-const
    let timer;

    function listener(data) {
      clearTimeout(timer);
      emitter.removeListener(eventName, listener);
      resolve(data);
    }

    emitter.addListener(eventName, listener);
    timer = setTimeout(() => {
      emitter.removeListener(eventName, listener);
      reject(new Error("timeout waiting for " + eventName));
    }, timeout);
  });
}

async function waitForConfirmationCode(): Promise<string | undefined> {
  const client = new ImapFlow({
    host: process.env.IMAP_AUTH_HOST,
    port: 993,
    secure: true,
    auth: {
      user: process.env.IMAP_AUTH_USER,
      pass: process.env.IMAP_AUTH_PASS,
    },
    logger: false,
  });

  await client.connect();

  try {
    await client.mailboxOpen("INBOX");

    const newMessageCount = await waitForEventWithTimeout(
      client,
      "exists",
      60000
    );

    const message = await client.fetchOne(newMessageCount.count, {
      envelope: true,
    });

    const code = /[0-9a-z]*$/gm.exec(message.envelope.subject)?.[0];
    return code;
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}
