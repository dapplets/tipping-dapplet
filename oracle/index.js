const { connect, keyStores, Contract, KeyPair } = require('near-api-js');
const puppeteer = require('puppeteer');

require('dotenv').config();

async function start() {
    const keyStore = new keyStores.InMemoryKeyStore();
    const keyPair = KeyPair.fromString(process.env.PRIVATE_KEY);
    await keyStore.setKey(process.env.NETWORK_ID, process.env.ORACLE_ACCOUNT_ID, keyPair);

    const config = {
        keyStore, 
        networkId: process.env.NETWORK_ID,
        nodeUrl: process.env.NODE_URL,
        walletUrl: process.env.WALLET_URL,
        helperUrl: process.env.HELPER_URL,
        explorerUrl: process.env.EXPLORER_URL
    };

    const near = await connect(config);
    const account = await near.account(process.env.ORACLE_ACCOUNT_ID);

    const contract = new Contract(
        account,
        process.env.CONTRACT_ACCOUNT_ID,
        {
            viewMethods: ["getExternalAccount", "getNearAccount", "getOracleAccount", "getPendingRequests", "getVerificationRequest"],
            changeMethods: ["approveRequest", "rejectRequest"],
            sender: account
        }
    );

    const oracleAccount = await contract.getOracleAccount();

    const pendingRequests = await contract.getPendingRequests();

    if (pendingRequests.length === 0) {
        console.log('No pending requests.');
        return;
    }

    console.log(`Found ${pendingRequests.length} pending requests.`);
    console.log(`Browser launching...`);

    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    console.log(`Browser launched.`);

    for (let i = 0; i < pendingRequests.length; i++) {
        try {
            const requestId = pendingRequests[i];

            console.log(`Verification ${i + 1} of ${pendingRequests.length} request. ID: ${requestId}`);
            const request = await contract.getVerificationRequest({ id: requestId });

            let { nearAccount, externalAccount, isUnlink, proofUrl } = request;
            
            nearAccount = nearAccount.toLowerCase();
            externalAccount = externalAccount.toLowerCase();

            const [socialNetwork, username] = externalAccount.split('/');

            if (socialNetwork === 'twitter') {
                console.log(`${isUnlink ? "Unlink" : "Link"} "${nearAccount}" <=> "${externalAccount}" with proof: ${proofUrl}`);

                await page.goto(request.proofUrl, { waitUntil: 'networkidle2' });
                let title = await page.title();
                title = title.toLowerCase();

                if (!isUnlink) {
                    if (title.indexOf('@' + username) !== -1 && title.indexOf(nearAccount) !== -1) {
                        console.log(`Approving request...`);
                        await contract.approveRequest({ args: { requestId } });
                    } else {
                        console.log(`Rejecting request...`);
                        await contract.rejectRequest({ args: { requestId } });
                    }
                } else {
                    if (title.indexOf('@' + username) !== -1 && title.indexOf(nearAccount) === -1) {
                        console.log(`Approving request...`);
                        await contract.approveRequest({ args: { requestId } });
                    } else {
                        console.log(`Rejecting request...`);
                        await contract.rejectRequest({ args: { requestId } });
                    }
                }
            } else {
                console.log(`Unsupported social network: "${socialNetwork}". Rejecting request...`);
                await contract.rejectRequest({ args: { requestId } });
            }
        } catch (e) {
            console.error(e);
        }
    }

    await browser.close();
}

start()
    .then(() => {
        process.exit();
    })
    .catch(e => {
        console.error(e);
        process.exit();
    });