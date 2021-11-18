import { expect } from '@jest/globals';
import 'regenerator-runtime/runtime';

let near;
let contract;
let accountId;

beforeAll(async function () {
    near = await nearlib.connect(nearConfig);
    accountId = nearConfig.contractName;
    contract = await near.loadContract(nearConfig.contractName, {
        viewMethods: [
            'getExternalAccount',
            'getNearAccount',
            'getMinStakeAmount',
            'getOracleAccount',
            'getOwnerAccount',
            'getPendingRequests',
            'getVerificationRequest'
        ],
        changeMethods: [
            'initialize',
            'approveRequest',
            'rejectRequest',
            'unlinkAll',
            'changeOwnerAccount',
            'changeOracleAccount',
            'changeMinStake',
            'requestVerification'
        ],
        sender: accountId,
    });
});

test('initialize contract', async () => {
    const STAKE = "1000000000000000000000"; // 0.001 NEAR

    await contract.initialize({
        args: {
            ownerAccountId: accountId,
            oracleAccountId: accountId,
            minStakeAmount: STAKE
        }
    })

    const ownerAccountId = await contract.getOwnerAccount();
    const oracleAccountId = await contract.getOracleAccount();
    const minStakeAmount = await contract.getMinStakeAmount();

    expect(ownerAccountId).toMatch(accountId);
    expect(oracleAccountId).toMatch(accountId);
    expect(minStakeAmount).toMatch(STAKE);
});

const EXTERNAL_ACCOUNT_1 = 'social_network/username';

test('linked accounts must be empty', async () => {
    const externalAccount = await contract.getExternalAccount({
        nearAccount: accountId
    });

    const nearAccount = await contract.getNearAccount({
        externalAccount: EXTERNAL_ACCOUNT_1
    });

    expect(externalAccount).toBeNull();
    expect(nearAccount).toBeNull();
});

test('pending requests must be empty', async () => {
    const pendingRequests = await contract.getPendingRequests();
    expect(pendingRequests).toMatchObject([]);

    const request = await contract.getVerificationRequest({ id: 0 });
    expect(request).toBeNull();
});

test('creates request', async () => {
    const id = await contract.requestVerification({
        args: { 
            externalAccount: EXTERNAL_ACCOUNT_1, 
            isUnlink: false,
            url: "https://example.com"
        },
        amount: "1000000000000000000000"
    });

    const pendingRequests = await contract.getPendingRequests();
    expect(pendingRequests).toMatchObject([id]);

    const request = await contract.getVerificationRequest({ id: id });
    expect(request).toMatchObject({
        nearAccount: accountId,
        externalAccount: EXTERNAL_ACCOUNT_1,
        isUnlink: false,
        proofUrl: "https://example.com"
    });
});