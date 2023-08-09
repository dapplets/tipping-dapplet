import { defineConfig } from 'cypress';
import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';

const version = 'v0.59.0-alpha.1';
const extensionUrl = `https://github.com/dapplets/dapplet-extension/releases/download/${version}/dapplet-extension.zip`;
const extensionsPath = path.join(__dirname, 'extension')
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

export default defineConfig({
  defaultCommandTimeout: 25000,
  e2e: {
    setupNodeEvents(on) {
      on('before:browser:launch', async (_, launchOptions) => {
        if (!fs.existsSync(versionPath)) {
          await downloadAndUnzip(extensionUrl, versionPath);
        }

        launchOptions.extensions.push(versionPath);
        return launchOptions;
      });
    },
    video: false,
  },
  chromeWebSecurity: false,
  includeShadowDom: true,
});
