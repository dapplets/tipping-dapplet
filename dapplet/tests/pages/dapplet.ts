import type { Locator, Page } from '@playwright/test';
import fs from 'fs';

export class Dapplet {
  public readonly root: Locator;
  public readonly profile: Locator;

  constructor(public readonly page: Page) {}
}
