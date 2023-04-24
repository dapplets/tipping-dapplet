import { CARequestStatus, NearNetworks, TConnectedAccountsVerificationRequestInfo } from '../interfaces';
import { getCurrentUserAsync } from '../helpers';

export const getSession = async (network: NearNetworks, contractId: string) => {
  const prevSessions = await Core.sessions();
  const walletOrigin = createNearOrigin(network);
  const prevSession = prevSessions.find((x) => x.authMethod === walletOrigin);
  return (
    prevSession ??
    (await Core.login({
      authMethods: [walletOrigin],
      secureLogin: 'required',
      contractId,
    }))
  );
};

export const connectWallet = async (network: NearNetworks, contractId: string): Promise<string> => {
  const session = await getSession(network, contractId);
  const wallet = await session.wallet();
  return wallet.accountId;
};

export const createAccountGlobalId = (username: string, websiteName: string): string =>
  username + '/' + websiteName.toLowerCase();

export const getNearAccountsFromCa = async (accountGId: string, network: string): Promise<string[]> => {
  const connectedAccounts = await Core.connectedAccounts.getNet(accountGId);
  const walletOrigin = createNearOrigin(network);
  return connectedAccounts.filter((id) => id.indexOf(walletOrigin) !== -1).map((id) => id.split('/')[0]);
};

export const makeNewCAConnection = async (
  adapter: any,
  walletAccountId: string,
  walletNetwork: string,
): Promise<CARequestStatus> => {
  const { username, fullname, websiteName, img } = await getCurrentUserAsync(adapter);
  const websiteNameLowerCase = websiteName.toLowerCase();
  const args = {
    firstAccountId: username,
    firstOriginId: websiteNameLowerCase,
    firstAccountImage: img,
    secondAccountId: walletAccountId,
    secondOriginId: createNearOrigin(walletNetwork),
    secondAccountImage: null,
    isUnlink: false,
    firstProofUrl: 'https://' + websiteNameLowerCase + '.com/' + username,
  };
  const condition = {
    type: `${websiteNameLowerCase}/near-${walletNetwork}`,
    user: fullname,
  };
  await Core.connectedAccounts.requestVerification(args, condition);
  const accountGId = createAccountGlobalId(username, websiteName);
  const { pendingRequest, pendingRequestId } = await getCAPendingRequest(accountGId);
  if (pendingRequestId !== -1 && pendingRequest) {
    const requestStatus = await waitForCAVerificationRequestResolve(pendingRequestId);
    alert(
      'Connection of ' +
        pendingRequest.firstAccount.split('/')[0] +
        ' and ' +
        pendingRequest.secondAccount.split('/')[0] +
        ' has been ' +
        requestStatus,
    );
    return requestStatus;
  }
  return makeNewCAConnection(adapter, walletAccountId, walletNetwork); // ToDo: improve if it's possible
};

export const getCAPendingRequest = async (
  accountGId: string,
): Promise<{
  pendingRequest: TConnectedAccountsVerificationRequestInfo;
  pendingRequestId: number;
}> => {
  const pendingRequestsIds = await Core.connectedAccounts.getPendingRequests();
  if (pendingRequestsIds && pendingRequestsIds.length) {
    const requests = await Promise.all(
      pendingRequestsIds.map((pendingRequest) => Core.connectedAccounts.getVerificationRequest(pendingRequest)),
    );
    for (let i = 0; i < requests.length; i++) {
      if (requests[i].firstAccount === accountGId || requests[i].secondAccount === accountGId) {
        return { pendingRequest: requests[i], pendingRequestId: pendingRequestsIds[i] };
      }
    }
  }
  return { pendingRequest: null, pendingRequestId: -1 };
};

export const waitForCAVerificationRequestResolve = async (id: number): Promise<CARequestStatus> => {
  try {
    const requestStatus = await Core.connectedAccounts.getRequestStatus(id);
    if (requestStatus === 'pending') {
      await new Promise((res) => setTimeout(res, 5000));
      return waitForCAVerificationRequestResolve(id);
    } else {
      return requestStatus;
    }
  } catch (err) {
    console.log(err);
  }
};

const createNearOrigin = (network) => 'near/' + network;
