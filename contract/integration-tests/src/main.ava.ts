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

  // Deploy the contract
  await contract.deploy(process.argv[2]);

  // Import CA contract
  const caContract = await root.importContract({
    mainnetContract: "connected-accounts.near",
    blockId: 88884919,
    withData: true,
  });

  // Save state for test runs, it is unique for each test
  t.context.worker = worker;
  t.context.accounts = { root, contract, alice, bob, caContract };
});

test.afterEach(async (t) => {
  // Stop Sandbox server
  await t.context.worker.tearDown().catch((error) => {
    console.log("Failed to stop the Sandbox:", error);
  });
});

// ====== Global Objects ======

const ACCOUNT_1 = {
  id: "username",
  originId: "social_network",
  itemId: "https://social_network.com/username/status/14920813",
};
const globalIdAcc_1 = ACCOUNT_1.id + "/" + ACCOUNT_1.originId;
const globalIdTwitterUser_1 = "teremovskii/twitter";
const twitterUserItemId_1 = "https://twitter.com/teremovskii/status/1336406078574256135";
const twitterUserItemId_2 = "https://twitter.com/teremovskii/status/1336";
const user_wallet = "nikter.near";

// ======= TESTS =======

test("integration test", async (t) => {
  // == TEST 1 ==
  console.log("== TEST 1 ==: initialize contract");
  // ============

  const { alice, contract } = t.context.accounts;
  await alice.call(contract, "initialize", {
    ownerAccountId: alice.accountId,
    caContractAddress: "connected-accounts.near",
    maxAmountPerItem: "10000000000000000000000000",
    maxAmountPerTip: "1000000000000000000000000",
    network: "mainnet",
  });

  const ownerAccountId = await contract.view("getOwnerAccount", {});
  const cAContractAddress = await contract.view("getCAContractAddress", {});
  const maxAmountPerItem = await contract.view("getMaxAmountPerItem", {});
  const cmaxAmountPerTip = await contract.view("getMaxAmountPerTip", {});

  t.is(ownerAccountId, alice.accountId);
  t.is(cAContractAddress, "connected-accounts.near");
  t.is(maxAmountPerItem, "10000000000000000000000000");
  t.is(cmaxAmountPerTip, "1000000000000000000000000");

  // ============ CA contract initialization =============

  // const STAKE = "1000000000000000000000"; // 0.001 NEAR
  // await alice.call(caContract, "initialize", {
  //   ownerAccountId: alice.accountId,
  //   oracleAccountId: alice.accountId,
  //   minStakeAmount: STAKE,
  // });

  // const ownerAccountId_caContract = await caContract.view("getOwnerAccount", {});
  // const oracleAccountId_caContract = await caContract.view("getOracleAccount", {});
  // const minStakeAmount_caContract = await caContract.view("getMinStakeAmount", {});

  // t.is(ownerAccountId_caContract, alice.accountId);
  // t.is(oracleAccountId_caContract, alice.accountId);
  // t.is(minStakeAmount_caContract, STAKE);

  // == TEST 2 ==
  console.log("== TEST 2 ==: send tips to twitter account without connected accounts");
  // ============

  const tipAmount_2 = NEAR.parse("0.02 N").toString();

  await alice.call(
    contract,
    "sendTips",
    {
      accountGId: globalIdAcc_1,
      itemId: ACCOUNT_1.itemId,
    },
    {
      attachedDeposit: tipAmount_2,
      gas: "300000000000000",
    }
  );

  const totalTipsByItemId_2 = await contract.view("getTotalTipsByItemId", { itemId: ACCOUNT_1.itemId });
  const totalTipsByAccount_2 = await contract.view("getTotalTipsByAccount", {
    accountGlobalId: globalIdAcc_1,
  });
  const availableTipsByAccount_2 = await contract.view("getAvailableTipsByAccount", {
    accountGlobalId: globalIdAcc_1,
  });
  const walletForAutoclaim_2 = await contract.view("getWalletForAutoclaim", {
    accountGId: globalIdAcc_1,
  });

  t.is(totalTipsByItemId_2, "19417475728155339805825");
  t.is(totalTipsByAccount_2, "19417475728155339805825");
  t.is(availableTipsByAccount_2, "19417475728155339805825");
  t.is(walletForAutoclaim_2, null);

  // == TEST 3 ==
  console.log("== TEST 3 ==: send tips to twitter account with connected accounts");
  // ============

  const tipAmount_3 = NEAR.parse("0.02 N").toString();

  await alice.call(
    contract,
    "sendTips",
    {
      accountGId: globalIdTwitterUser_1,
      itemId: twitterUserItemId_1,
    },
    {
      attachedDeposit: tipAmount_3,
      gas: "300000000000000",
    }
  );

  const totalTipsByItemId_3 = await contract.view("getTotalTipsByItemId", {
    itemId: twitterUserItemId_1,
  });
  const totalTipsByAccount_3 = await contract.view("getTotalTipsByAccount", {
    accountGlobalId: globalIdTwitterUser_1,
  });
  const availableTipsByAccount_3 = await contract.view("getAvailableTipsByAccount", {
    accountGlobalId: globalIdTwitterUser_1,
  });
  const walletForAutoclaim_3 = await contract.view("getWalletForAutoclaim", {
    accountGId: globalIdTwitterUser_1,
  });

  t.is(totalTipsByItemId_3, "19417475728155339805825");
  t.is(totalTipsByAccount_3, "19417475728155339805825");
  t.is(availableTipsByAccount_3, "19417475728155339805825");
  t.is(walletForAutoclaim_3, null);

  // == TEST 4 ==
  console.log("== TEST 4 ==: set the wallet for autoclaim");
  // ============

  await alice.call(
    contract,
    "setWalletForAutoclaim",
    {
      accountGId: globalIdTwitterUser_1,
      wallet: user_wallet,
    },
    {
      gas: "300000000000000",
    }
  );

  // check:

  await alice.call(
    contract,
    "sendTips",
    {
      accountGId: globalIdTwitterUser_1,
      itemId: twitterUserItemId_1,
    },
    {
      attachedDeposit: tipAmount_3,
      gas: "300000000000000",
    }
  );

  const totalTipsByItemId_4 = await contract.view("getTotalTipsByItemId", {
    itemId: twitterUserItemId_1,
  });
  const totalTipsByAccount_4 = await contract.view("getTotalTipsByAccount", {
    accountGlobalId: globalIdTwitterUser_1,
  });
  const availableTipsByAccount_4 = await contract.view("getAvailableTipsByAccount", {
    accountGlobalId: globalIdTwitterUser_1,
  });
  const walletForAutoclaim_4 = await contract.view("getWalletForAutoclaim", {
    accountGId: globalIdTwitterUser_1,
  });

  t.is(totalTipsByItemId_4, "38834951456310679611650");
  t.is(totalTipsByAccount_4, "38834951456310679611650");
  t.is(availableTipsByAccount_4, "19417475728155339805825");
  t.is(walletForAutoclaim_4, user_wallet);

  // == TEST 5 ==
  console.log("== TEST 5 ==: claim tips");
  // ============

  await alice.call(
    contract,
    "claimTokens",
    { accountGId: globalIdTwitterUser_1 },
    {
      gas: "300000000000000",
    }
  );

  const totalTipsByItemId_5 = await contract.view("getTotalTipsByItemId", {
    itemId: twitterUserItemId_1,
  });
  const totalTipsByAccount_5 = await contract.view("getTotalTipsByAccount", {
    accountGlobalId: globalIdTwitterUser_1,
  });
  const availableTipsByAccount_5 = await contract.view("getAvailableTipsByAccount", {
    accountGlobalId: globalIdTwitterUser_1,
  });
  const walletForAutoclaim_5 = await contract.view("getWalletForAutoclaim", {
    accountGId: globalIdTwitterUser_1,
  });

  t.is(totalTipsByItemId_5, "38834951456310679611650");
  t.is(totalTipsByAccount_5, "38834951456310679611650");
  t.is(availableTipsByAccount_5, "0");
  t.is(walletForAutoclaim_5, user_wallet);

  // == TEST 6 ==
  console.log("== TEST 6 ==: send tips with autoclaim");
  // ============

  await alice.call(
    contract,
    "sendTips",
    {
      accountGId: globalIdTwitterUser_1,
      itemId: twitterUserItemId_2,
    },
    {
      attachedDeposit: tipAmount_3,
      gas: "300000000000000",
    }
  );

  const totalTipsByItemId_6 = await contract.view("getTotalTipsByItemId", {
    itemId: twitterUserItemId_2,
  });
  const totalTipsByAccount_6 = await contract.view("getTotalTipsByAccount", {
    accountGlobalId: globalIdTwitterUser_1,
  });
  const availableTipsByAccount_6 = await contract.view("getAvailableTipsByAccount", {
    accountGlobalId: globalIdTwitterUser_1,
  });
  const walletForAutoclaim_6 = await contract.view("getWalletForAutoclaim", {
    accountGId: globalIdTwitterUser_1,
  });

  t.is(totalTipsByItemId_6, "19417475728155339805825");
  t.is(totalTipsByAccount_6, "58252427184466019417475");
  t.is(availableTipsByAccount_6, "0");
  t.is(walletForAutoclaim_6, user_wallet);

  // == TEST 7 ==
  console.log("== TEST 7 ==: delete wallet for autoclaim by wallet from CA");
  // ============
  await alice.call(
    contract,
    "deleteWalletForAutoclaim",
    {
      accountGId: globalIdTwitterUser_1,
    },
    {
      gas: "300000000000000",
    }
  );
  const walletForAutoclaim_7 = await contract.view("getWalletForAutoclaim", {
    accountGId: globalIdTwitterUser_1,
  });
  t.is(walletForAutoclaim_7, null);

  // == TEST 8 ==
  console.log("== TEST 8 ==: delete wallet for autoclaim by inself");
  // ============

  await alice.call(
    contract,
    "sendTips",
    {
      accountGId: globalIdTwitterUser_1,
      itemId: twitterUserItemId_2,
    },
    {
      attachedDeposit: tipAmount_3,
      gas: "300000000000000",
    }
  );

  await alice.call(
    contract,
    "claimTokens",
    { accountGId: globalIdTwitterUser_1 },
    {
      gas: "300000000000000",
    }
  );

  const walletForAutoclaim_8 = await contract.view("getWalletForAutoclaim", {
    accountGId: globalIdTwitterUser_1,
  });

  t.is(walletForAutoclaim_8, alice.accountId);

  await alice.call(
    contract,
    "deleteWalletForAutoclaim",
    {
      accountGId: globalIdTwitterUser_1,
    },
    {
      gas: "300000000000000",
    }
  );

  const walletForAutoclaim_8_1 = await contract.view("getWalletForAutoclaim", {
    accountGId: globalIdTwitterUser_1,
  });

  t.is(walletForAutoclaim_8_1, null);

  // == TEST 9 ==
  console.log("== TEST 9 ==: change wallet for autoclaim");
  // ============

  await alice.call(
    contract,
    "sendTips",
    {
      accountGId: globalIdTwitterUser_1,
      itemId: twitterUserItemId_2,
    },
    {
      attachedDeposit: tipAmount_3,
      gas: "300000000000000",
    }
  );

  await alice.call(contract, "claimTokens", { accountGId: globalIdTwitterUser_1 }, { gas: "300000000000000" });

  const walletForAutoclaim_9 = await contract.view("getWalletForAutoclaim", {
    accountGId: globalIdTwitterUser_1,
  });

  t.is(walletForAutoclaim_9, alice.accountId);

  await alice.call(
    contract,
    "setWalletForAutoclaim",
    {
      accountGId: globalIdTwitterUser_1,
      wallet: user_wallet,
    },
    {
      gas: "300000000000000",
    }
  );

  const walletForAutoclaim_9_1 = await contract.view("getWalletForAutoclaim", {
    accountGId: globalIdTwitterUser_1,
  });

  t.is(walletForAutoclaim_9_1, user_wallet);
});
