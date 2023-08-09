export {}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Window extends WindowDapplets {}

  interface WindowDapplets {
    dapplets: InjectedDappletsApi
  }

  interface InjectedDappletsApi {
    openPopup(): Promise<void>
    addTrustedUser(account: string): Promise<void>
    addRegistry(url: string, isDev: boolean): Promise<void>
    removeRegistry(url: string): Promise<void>
    wipeAllExtensionData(): Promise<void>
  }

  namespace Cypress {
    interface Chainable {
      getByTestId<E extends Node = HTMLElement>(
        testId: string,
        options?: Partial<Loggable & Timeoutable & Withinable & Shadow>
      ): Chainable<JQuery<E>>
      openDappletsOverlay(params?: Partial<{ wipe: boolean }>): void
      runDapplet(dappletIdToActivate: string): void
    }
  }
}
