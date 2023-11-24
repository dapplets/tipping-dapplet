import { CARequestStatus, NearNetworks, TConnectedAccountsVerificationRequestInfo } from '../interfaces';
import { getCurrentProfileAsync } from '../helpers';
import { CARequestStatusMsg } from '../messages';

export const getSession = async (network: NearNetworks, contractId: string): Promise<any> => {
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

export const getNearAccountsFromCa = async (accountGId: string, network: NearNetworks): Promise<string[]> => {
  const connectedAccounts = await Core.connectedAccounts.getNet(accountGId, network);
  const walletOrigin = createNearOrigin(network);
  return connectedAccounts
    ? connectedAccounts.filter((id) => id.indexOf(walletOrigin) !== -1).map((id) => id.split('/')[0])
    : [];
};

export const connectNewAccount = async (
  walletAccountId: string,
  network: NearNetworks,
  profile: any,
): Promise<boolean> => {
  try {
    const requestStatus = await makeNewCAConnection(walletAccountId, network, profile);
    if (requestStatus === 'rejected') {
      return false;
    }
  } catch (err) {
    console.log(err); // ToDo: problems in CA
    return false;
  }
  return true;
};

const makeNewCAConnection = async (
  walletAccountId: string,
  walletNetwork: NearNetworks,
  profile: any,
): Promise<CARequestStatus> => {
  const { authorFullname, authorImg, authorUsername, parent } = await getCurrentProfileAsync(profile.value);
  const websiteNameLowerCase = parent?.websiteName.toLowerCase();
  const firstProofUrl = 'https://' + websiteNameLowerCase + '.com/' + authorUsername;
  const args = {
    firstAccountId: authorUsername,
    firstOriginId: websiteNameLowerCase,
    firstAccountImage: authorImg,
    secondAccountId: walletAccountId,
    secondOriginId: createNearOrigin(walletNetwork),
    secondAccountImage: null,
    isUnlink: false,
    firstProofUrl,
  };
  const conditionType = `${websiteNameLowerCase}/near-${walletNetwork}`;
  const condition = {
    type: conditionType,
    user: authorFullname,
  };
  await Core.connectedAccounts.requestVerification(args, condition, walletNetwork);
  const accountGId = createAccountGlobalId(authorUsername, parent?.websiteName);
  const { pendingRequest, pendingRequestId } = await getCAPendingRequest(accountGId, walletNetwork);
  if (pendingRequestId !== -1 && pendingRequest) {
    const requestStatus = await waitForCAVerificationRequestResolve(pendingRequestId, walletNetwork);
    await Core.alert(
      CARequestStatusMsg(
        pendingRequest.firstAccount.split('/')[0],
        pendingRequest.secondAccount.split('/')[0],
        requestStatus,
      ),
    );
    return requestStatus;
  }
  return makeNewCAConnection(walletAccountId, walletNetwork, profile); // ToDo: improve if it's possible
};

const getCAPendingRequest = async (
  accountGId: string,
  network?: NearNetworks,
): Promise<{
  pendingRequest: TConnectedAccountsVerificationRequestInfo;
  pendingRequestId: number;
}> => {
  const pendingRequestsIds = await Core.connectedAccounts.getPendingRequests(network);
  if (pendingRequestsIds && pendingRequestsIds.length) {
    for (const id of pendingRequestsIds) {
      const request = await Core.connectedAccounts.getVerificationRequest(id, network);
      if (request.firstAccount === accountGId || request.secondAccount === accountGId) {
        return { pendingRequest: request, pendingRequestId: id };
      }
    }
  }
  return { pendingRequest: null, pendingRequestId: -1 };
};

const waitForCAVerificationRequestResolve = async (id: number, network?: NearNetworks): Promise<CARequestStatus> => {
  try {
    const requestStatus = await Core.connectedAccounts.getRequestStatus(id, network);
    if (requestStatus === 'pending') {
      await new Promise((res) => setTimeout(res, 5000));
      return waitForCAVerificationRequestResolve(id, network);
    } else {
      return requestStatus;
    }
  } catch (err) {
    console.log(err);
  }
};

const createNearOrigin = (network) => 'near/' + network;
