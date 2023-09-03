import { Page } from '@playwright/test';
import { RecoverSeedPhrase } from './recover-seed-phrase';

export class RecoverAccount {
  constructor(public readonly page: Page) {}

  async clickRecoverAccount(): Promise<RecoverSeedPhrase> {
  
    const password = await this.page.getByPlaceholder(`Enter password`);
    if(password){
      
      await this.page.getByPlaceholder(`Enter password`).type(process.env.NEAR_PASSWORD);
      await this.page.getByPlaceholder(`Confirm Password`).type(process.env.NEAR_PASSWORD);
 
      await this.page.locator('[class="sc-kOPcWz dlPXoE"]').first().click()
   
      await this.page.locator('[class="sc-kOPcWz dlPXoE"]').last().click()
     
      await this.page.getByText('Next').click()

    
    }
   
    await this.page.getByRole('button', { name: 'Recover Account' }).first().click();
  
    await this.page.waitForURL('https://app.mynearwallet.com/recover-seed-phrase');
    return new RecoverSeedPhrase(this.page);
  }
}
