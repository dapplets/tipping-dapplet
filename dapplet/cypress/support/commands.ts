/// <reference types="cypress" />

Cypress.Commands.add('getByTestId', (selector, ...args) => {
  return cy.get(`[data-testid="${selector}"]`, ...args);
});

Cypress.Commands.add('openDappletsOverlay', (params?: Partial<{ wipe: boolean }>) => {
  cy.on('uncaught:exception', (err, runnable) => {
    // returning false here prevents Cypress from
    // failing the test
    return false;
  });

  if (params?.wipe) {
    cy.get('dapplets-overlay-manager');
    cy.window().then((win) => win.dapplets.wipeAllExtensionData());
    cy.reload();
  }

  // injects overlay
  cy.get('dapplets-overlay-manager');

  // show minimized overlay
  cy.window().then((win) => win.dapplets.openPopup());
  cy.get('dapplets-overlay-manager').should('not.have.class', 'dapplets-overlay-hidden');

  // expands to ubersausage mode
  // cy.getByTestId('show-tabs-button').click()

  // opens dapplets list
  // cy.getByTestId('toggle-overlay-button').click()
  cy.getByTestId('system-tab-dapplets').click();

  // cy.getByTestId('system-tab-settings').click()
  // cy.getByTestId('toggle-overlay-button').click()

  cy.get('dapplets-overlay-manager').should('not.have.class', 'dapplets-overlay-collapsed');
});

Cypress.Commands.add('runDapplet', (dappletIdToActivate) =>
  cy
    .get('dapplets-overlay-manager')
    .find(`[data-testid="${dappletIdToActivate}"]`)
    .find('[data-testid=activation-dapplet]')
    .then((button) => {
      button.hasClass('not-active-switch') &&
        cy
          .get('dapplets-overlay-manager')
          .find(`[data-testid="${dappletIdToActivate}"]`)
          .find('[data-testid=activation-dapplet]')
          .click();
    }),
);
