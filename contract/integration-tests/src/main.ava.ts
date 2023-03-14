import { Worker, NEAR, NearAccount } from "near-workspaces";
import anyTest, { TestFn } from "ava";

const test = anyTest as TestFn<{
  worker: Worker;
  accounts: Record<string, NearAccount>;
}>;

test.beforeEach(async (t) => {
  // Init the worker and start a Sandbox server
  const worker = await Worker.init();

  // Deploy contract
  const root = worker.rootAccount;

  // define users

  const alice = await root.createSubAccount("alice", {
    initialBalance: NEAR.parse("30 N").toJSON(),
  });

  const bob = await root.createSubAccount("bob", {
    initialBalance: NEAR.parse("30 N").toJSON(),
  });

  const contract = await root.createSubAccount("contract", {
    initialBalance: NEAR.parse("30 N").toJSON(),
  });

  // Deploy the contract.
  await contract.deploy(process.argv[2]);

  // Save state for test runs, it is unique for each test
  t.context.worker = worker;
  t.context.accounts = { root, contract, alice, bob };
});

test.afterEach(async (t) => {
  // Stop Sandbox server
  await t.context.worker.tearDown().catch((error) => {
    console.log("Failed to stop the Sandbox:", error);
  });
});

// ====== Global Objects ======

// const nearOriginId = "near/mainnet";
// const ethOriginId = "ethereum";

// const ACCOUNT_1 = {
//   id: "username",
//   originId: "social_network",
// };

// const ACCOUNT_2 = {
//   id: "username-2",
//   originId: "social_network-2",
// };

// const ACCOUNT_3 = {
//   id: "username-3",
//   originId: "social_network-3",
// };

// const ACCOUNT_4 = {
//   id: "username-4",
//   originId: "social_network-4",
// };

// const ACCOUNT_5 = {
//   id: "username-5",
//   originId: "social_network",
// };

// ======= TESTS =======

test("integration test", async (t) => {
  // == TEST 1 ==
  console.log("== TEST 1 ==: initialize contract");
  // ============

  const STAKE = "1000000000000000000000"; // 0.001 NEAR
  const { alice, bob, contract } = t.context.accounts;
  console.log("alice.accountId", alice.accountId);
  await alice.call(contract, "initialize", {
    ownerAccountId: alice.accountId,
    oracleAccountId: alice.accountId,
    minStakeAmount: STAKE,
    maxAmountPerItem: null,
    maxAmountPerTip: null,
  });

  const ownerAccountId = await contract.view("getOwnerAccount", {});
  const oracleAccountId = await contract.view("getOracleAccount", {});
  const minStakeAmount = await contract.view("getMinStakeAmount", {});

  t.is(ownerAccountId, alice.accountId);
  t.is(oracleAccountId, alice.accountId);
  t.is(minStakeAmount, STAKE);

  // ============ ALIASES =============

  // const getCA = (accountId: string, originId: string, closeness?: number): Promise<any> =>
  //   contract.view("getConnectedAccounts", {
  //     accountId,
  //     originId,
  //     closeness,
  //   });

  // const getPRequests = (): Promise<number[]> => contract.view("getPendingRequests", {});

  // interface IVerificationRequest {
  //   firstAccount: string;
  //   secondAccount: string;
  //   isUnlink: boolean;
  //   firstProofUrl: string;
  //   secondProofUrl: string;
  //   transactionSender: string;
  // }

  // const getVRequest = (id: number): Promise<IVerificationRequest | null> =>
  //   contract.view("getVerificationRequest", { id });

  // const requestVerification = (
  //   acc: NearAccount,
  //   firstAccountId: string,
  //   firstOriginId: string,
  //   secondAccountId: string,
  //   secondOriginId: string,
  //   signature: any,
  //   isUnlink: boolean,
  //   statement?: string
  // ): Promise<number> =>
  //   acc.call(
  //     contract,
  //     "requestVerification",
  //     {
  //       firstAccountId,
  //       firstOriginId,
  //       secondAccountId,
  //       secondOriginId,
  //       signature,
  //       isUnlink,
  //       firstProofUrl: firstOriginId === "social_network" ? "https://example.com" : "",
  //       secondProofUrl: secondOriginId === "social_network" ? "https://example.com" : "",
  //       statement,
  //     },
  //     {
  //       attachedDeposit:
  //         firstOriginId !== "ethereum" && secondOriginId !== "ethereum"
  //           ? NEAR.parse("0.001 N").toString()
  //           : undefined,
  //       gas:
  //         firstOriginId === "ethereum" || secondOriginId === "ethereum"
  //           ? "300000000000000"
  //           : undefined,
  //     }
  //   );

  // const aliceRequestVerification = (
  //   firstAccountId: string,
  //   firstOriginId: string,
  //   secondAccountId: string,
  //   secondOriginId: string,
  //   signature: any,
  //   isUnlink: boolean,
  //   statement?: string
  // ): Promise<number> =>
  //   requestVerification(
  //     alice,
  //     firstAccountId,
  //     firstOriginId,
  //     secondAccountId,
  //     secondOriginId,
  //     signature,
  //     isUnlink,
  //     statement
  //   );

  // const bobRequestVerification = (
  //   firstAccountId: string,
  //   firstOriginId: string,
  //   secondAccountId: string,
  //   secondOriginId: string,
  //   signature: any,
  //   isUnlink: boolean,
  //   statement?: string
  // ): Promise<number> =>
  //   requestVerification(
  //     bob,
  //     firstAccountId,
  //     firstOriginId,
  //     secondAccountId,
  //     secondOriginId,
  //     signature,
  //     isUnlink,
  //     statement
  //   );

  // const aliceApproveRequest = (requestId: number): Promise<void> =>
  //   alice.call(contract, "approveRequest", { requestId });

  // const bobApproveRequest = (requestId: number): Promise<void> =>
  //   bob.call(contract, "approveRequest", { requestId });

  // const aliceRejectRequest = (requestId: number): Promise<void> =>
  //   alice.call(contract, "rejectRequest", { requestId });

  // const bobRejectRequest = (requestId: number): Promise<void> =>
  //   bob.call(contract, "rejectRequest", { requestId });

  // const getStatus = (accountId: string, originId: string): Promise<boolean> =>
  //   contract.view("getStatus", {
  //     accountId,
  //     originId,
  //   });

  // const aliceChangeStatus = (accountId: string, originId: string, isMain: true): Promise<void> =>
  //   alice.call(contract, "changeStatus", {
  //     accountId,
  //     originId,
  //     isMain,
  //   });

  // const bobChangeStatus = (accountId: string, originId: string, isMain: true): Promise<void> =>
  //   bob.call(contract, "changeStatus", {
  //     accountId,
  //     originId,
  //     isMain,
  //   });

  // const getMainAccount = (accountId: string, originId: string): Promise<string | null> =>
  //   contract.view("getMainAccount", {
  //     accountId,
  //     originId,
  //   });

  // const getRequestStatus = (id: number): Promise<number> =>
  //   contract.view("getRequestStatus", {
  //     id,
  //   });

  // // ============ CONSTANTS ===========

  // const gAliceID = alice.accountId + "/" + nearOriginId;
  // const gBobID = bob.accountId + "/" + nearOriginId;
  // const gAcc_1ID = ACCOUNT_1.id + "/" + ACCOUNT_1.originId;
  // const gAcc_2ID = ACCOUNT_2.id + "/" + ACCOUNT_2.originId;
  // const gAcc_3ID = ACCOUNT_3.id + "/" + ACCOUNT_3.originId;
  // const gAcc_4ID = ACCOUNT_4.id + "/" + ACCOUNT_4.originId;
  // const gAcc_5ID = ACCOUNT_5.id + "/" + ACCOUNT_5.originId;

  // ==================================

  const EXTERNAL_ACCOUNT_1 = "social_network/username";

  // == TEST 2 ==
  console.log("== TEST 2 ==: linked accounts must be empty");
  // ============

  const externalAccount_2 = await contract.view("getExternalAccount", {
    nearAccount: alice.accountId,
  });
  const nearAccount_2 = await contract.view("getNearAccount", {
    externalAccount: EXTERNAL_ACCOUNT_1,
  });

  t.is(externalAccount_2, null);
  t.is(nearAccount_2, null);

  // == TEST 3 ==
  console.log("== TEST 3 ==: pending requests must be empty");
  // ============

  const pendingRequests_3 = await contract.view("getPendingRequests");
  t.deepEqual(pendingRequests_3, []);

  const request_3 = await contract.view("getVerificationRequest", { id: 0 });
  t.is(request_3, null);

  // == TEST 4 ==
  console.log("== TEST 4 ==: creates request");
  // ============

  const id_4 = await alice.call(
    contract,
    "requestVerification",
    {
      externalAccount: EXTERNAL_ACCOUNT_1,
      isUnlink: false,
      url: "https://example.com",
    },
    {
      attachedDeposit: NEAR.parse("0.001 N").toString(),
    }
  );

  const pendingRequests_4 = await contract.view("getPendingRequests");
  t.deepEqual(pendingRequests_4, [id_4]);

  const request_4 = await contract.view("getVerificationRequest", { id: id_4 });
  t.deepEqual(request_4, {
    nearAccount: alice.accountId,
    externalAccount: EXTERNAL_ACCOUNT_1,
    isUnlink: false,
    proofUrl: "https://example.com",
  });
});
