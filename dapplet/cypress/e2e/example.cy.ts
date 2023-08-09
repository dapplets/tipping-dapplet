Cypress.on('uncaught:exception', (err, runnable) => {
  // returning false here prevents Cypress from failing the test
  return false;
});

const TWITTER_EMAIL = '';
const TWITTER_USERNAME = '';
const TWITTER_PASSWORD = '';
const TWITTER_FULLNAME = '';

const login = (loginInfo: { email: string; username: string; password: string; fullname: string }) => {
  cy.session(loginInfo, () => {
    cy.visit('https://twitter.com/alsakhaev'); // ToDo: remove hardcoded values
    cy.get('input').type(TWITTER_EMAIL);
    cy.get('span').contains('Next').click();

    // unusual window activity
    cy.get('input[name=text]').then(($el) => {
      if ($el.length) {
        cy.get('input[name=text]').type(TWITTER_USERNAME);
        cy.get('span').contains('Next').click();
      }
    });

    cy.get('input[name=password]').type(TWITTER_PASSWORD);
    cy.get('span').contains('Log in').click();

    cy.get('span').contains('Alexander Sakhaev'); // ToDo: remove hardcoded values
  });
};

describe('template spec', () => {
  it('passes', () => {
    login({
      email: TWITTER_EMAIL,
      username: TWITTER_USERNAME,
      password: TWITTER_PASSWORD,
      fullname: TWITTER_FULLNAME,
    });

    cy.visit('https://twitter.com/alsakhaev');
    cy.openDappletsOverlay({ wipe: true });
    cy.runDapplet('tipping-near-dapplet')
  });
});
