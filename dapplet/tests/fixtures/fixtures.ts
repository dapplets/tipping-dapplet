import { chromium, test as base, type BrowserContext } from '@playwright/test'
import path from 'path'
import * as fs from 'fs';
import AdmZip from 'adm-zip';

const version = 'v0.59.0-alpha.1';
const extensionUrl = `https://github.com/dapplets/dapplet-extension/releases/download/${version}/dapplet-extension.zip`;
const extensionsPath = path.join(__dirname, '..', 'artifacts')
const versionPath = path.join(extensionsPath, version)

const downloadAndUnzip = async (url: string, targetDirectory: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Cannot download Dapplet Extension ${version}: ${response.status} ${response.statusText}`);
  }

  const zipBuffer = Buffer.from(await response.arrayBuffer());

  if (!fs.existsSync(targetDirectory)) {
    fs.mkdirSync(targetDirectory, { recursive: true });
  }

  const zipFilePath = path.join(targetDirectory, 'temp.zip');
  fs.writeFileSync(zipFilePath, zipBuffer);

  const zip = new AdmZip(zipFilePath);
  zip.extractAllTo(targetDirectory, true);

  fs.unlinkSync(zipFilePath);
};

export const test = base.extend<{
  context: BrowserContext
  extensionId: string
}>({
  context: async ({}, use) => {

    if (!fs.existsSync(versionPath)) {
      await downloadAndUnzip(extensionUrl, versionPath);
    }
    
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${versionPath}`,
        `--load-extension=${versionPath}`,
      ],
    })
    await use(context)
    await context.close()
  },
  extensionId: async ({ context }, use) => {
    /*
    // for manifest v2:
    let [background] = context.backgroundPages()
    if (!background)
      background = await context.waitForEvent('backgroundpage')
    */

    // for manifest v3:
    let [background] = context.serviceWorkers()
    if (!background) background = await context.waitForEvent('serviceworker')

    const extensionId = background.url().split('/')[2]
    await use(extensionId)
  },
})
export const expect = test.expect
