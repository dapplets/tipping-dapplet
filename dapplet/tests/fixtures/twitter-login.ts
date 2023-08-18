import { test as base, DappletExecutor } from '@dapplets/dapplet-playwright';
import fs from 'fs';
import path from 'path';
import { ImapFlow } from "imapflow";

const artifactsPath = path.join(__dirname, '..', 'artifacts');
const cookiesPath = path.join(artifactsPath, 'cookies.json');

type ExtendParams = Parameters<typeof base.extend<{}>>;

export const fixture: ExtendParams[0] = {
  page: async ({ context }, use) => {
    test.setTimeout(200000); // authorization in Twitter is a long process

    if (fs.existsSync(cookiesPath)) {
      const cookies = fs.readFileSync(cookiesPath, "utf8");
      const deserializedCookies = JSON.parse(cookies);
      await context.addCookies(deserializedCookies);
    }

    const page = await context.newPage();

    await page.goto("https://twitter.com/" + process.env.TWITTER_AUTH_USERNAME);
    await page.waitForTimeout(5000); // ToDo: remove

    // ToDo: move to POM
    const isSigningIn = await page.isVisible('//*[@id="layers"]//input');
    if (isSigningIn) {
      const emailInput = await page.locator('//*[@id="layers"]//input');
      await emailInput.type(process.env.TWITTER_AUTH_EMAIL);
      await page.getByRole("button", { name: "Next" }).click();

      // unusual activity popup
      const extraInput = await page.locator("input[name=text]");
      if (extraInput) {
        await extraInput.type(process.env.TWITTER_AUTH_USERNAME);
        await page.getByRole("button", { name: "Next" }).click();
      }

      await page
        .locator("input[name=password]")
        .type(process.env.TWITTER_AUTH_PASSWORD);
      await page.getByRole("button", { name: "Log in" }).click();

      await page.waitForTimeout(5000); // ToDo: remove

      // email popup
      if (await page.getByText("Check your email").isVisible()) {
        const confirmationCode = await waitForConfirmationCode();
        if (confirmationCode) {
          throw new Error(
            "Twitter reqested email confirmation code that could not be recevied"
          );
        }

        const extraInput = await page.locator("input[name=text]");
        await extraInput.type(confirmationCode);
        await page.getByRole("button", { name: "Next" }).click();
      }

      await page.waitForTimeout(5000);
      await page.locator(`span:has-text("${process.env.TWITTER_AUTH_BIO}")`); // ToDo: remove hardcoded values

      // save cookies to reuse later
      const cookies = await context.cookies();
      const cookieJson = JSON.stringify(cookies);
      fs.mkdirSync(artifactsPath, { recursive: true });
      fs.writeFileSync(cookiesPath, cookieJson);
    }

    await use(page);
  },
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
