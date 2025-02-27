const express = require('express');
const router = express.Router();
const axios = require('axios');
const jsonFile = require('jsonfile');
const {Buffer} = require("node:buffer");
const config = jsonFile.readFileSync('./config.json');

let timeCaching = {
    timeCacheStats: 0,
    timeCache: 0,
    timeCacheStatsTx: 0,
    timeCacheStatsWallets: 0,
    timeCacheStatsDelegates: 0
}

let dataCaching = {
    stats: {},
}

let lastBlock = null;

async function getAddress(address) {
    let result = null;
    try {
        const data = (await axios.get(config.node + '/api/wallets/' + address)).data.data;
        let attributes = data.attributes;
        if (attributes['delegate']) {
            attributes['voteBalance'] = (attributes['voteBalance'] / 1e8).toFixed(8);
            attributes['forgedFees'] = (attributes['forgedFees'] / 1e8).toFixed(8);
            attributes['forgedRewards'] = (attributes['forgedRewards'] / 1e8).toFixed(8);
            if (attributes['delegate']['lastBlock']) {
                let lastBlock = attributes['delegate']['lastBlock'];
                lastBlock['totalAmount'] = (lastBlock['totalAmount'] / 1e8).toFixed(8);
                lastBlock['totalFee'] = (lastBlock['totalFee'] / 1e8).toFixed(8);
                lastBlock['reward'] = (lastBlock['reward'] / 1e8).toFixed(8);
                attributes['delegate']['lastBlock'] = lastBlock;
            }
        }

        result = {
            address: data.address,
            publicKey: data.publicKey || false,
            balance: (data.balance / 1e8).toFixed(8),
            nonce: data.nonce,
            attributes: attributes,

        }
    } catch (e) {

    }
    return result;
}

async function getSupply() {
    let result = null;
    const burnAddress = await getAddress(config['burn']);
    const teamAddress = await getAddress('STQK9x2xzfM54n3cACrNahiq5CaWB2HwqR');
    const communityAddress = await getAddress('SU1znm5azz52GUdvXf7r7RdcR667WMCLMf')


    try {
        const data = (await axios.get(config.node + '/api/blockchain')).data.data;
        const totalSupply = (data.supply / 1e8)

        result = {
            symbol: "STH",
            chainId: data.block.id,
            height: data.block.height,
            totalSupply: totalSupply.toFixed(8),
            circulation: (totalSupply - burnAddress.balance * 1 - teamAddress.balance * 1 - communityAddress.balance * 1).toFixed(8),
            burned: {
                address: burnAddress.address,
                amount: burnAddress.balance
            },
            devFund: {
                address: 'STQK9x2xzfM54n3cACrNahiq5CaWB2HwqR',
                amount: teamAddress.balance
            },
            communityFund: {
                address: 'SU1znm5azz52GUdvXf7r7RdcR667WMCLMf',
                amount: communityAddress.balance
            },

        }

    } catch (e) {

    }
    return result;
}

async function getLastBlock() {
    const currTime = Math.floor(Date.now() / 1000);
    if (currTime - timeCaching['timeCache'] >= 8 || !lastBlock) {
        timeCaching['timeCache'] = Math.floor(Date.now() / 1000);
        try {
            lastBlock = (await axios.get(config.node + '/api/blocks/last')).data.data;
        } catch (e) {

        }
    }
    return lastBlock;
}

async function calcRNG(blockId) {
    //Uint8Array – представляет каждый байт в ArrayBuffer как отдельное число; возможные значения находятся от 0 до 255
    const rnd = await Uint8Array.from(Buffer.from(blockId, 'hex'));
    let result = [];
    for (let i = 0; i < rnd.length; i++) {
        result.push(rnd[i])
    }
    return (result);
}


async function getTransactions(page, limit) {
    const currTime = Math.floor(Date.now() / 1000);
    let result = {};
    console.log(currTime - timeCaching['timeCacheStatsTx'])
    if (currTime - timeCaching['timeCacheStatsTx'] >= 60) {
        timeCaching['timeCacheStatsTx'] = Math.floor(Date.now() / 1000);
        try {
            result = (await axios.get(config.node + '/api/transactions?page=' + page + '&limit=' + limit)).data;
        } catch (e) {
            console.log('err:getTransactions');
        }
    }
    return result;
}

async function getWallets(page, limit) {
    const currTime = Math.floor(Date.now() / 1000);
    let result = {};
    if (currTime - timeCaching['timeCacheStatsWallets'] >= 60) {
        timeCaching['timeCacheStatsWallets'] = Math.floor(Date.now() / 1000);
        try {
            result = (await axios.get(config.node + '/api/wallets?page=' + page + '&limit=' + limit)).data;
        } catch (e) {
            console.log('err:getTransactions');
        }
    }
    return result;
}

async function getDelegates(page, limit) {
    const currTime = Math.floor(Date.now() / 1000);
    let result = {};
    if (currTime - timeCaching['timeCacheStatsDelegates'] >= 60) {
        timeCaching['timeCacheStatsDelegates'] = Math.floor(Date.now() / 1000);
        try {
            result = (await axios.get(config.node + '/api/delegates?page=' + page + '&limit=' + limit)).data;
        } catch (e) {
            console.log('err:getDelegates');
        }
    }
    return result;
}


async function chainStats() {
    const txs = await getTransactions(1, 1);
    const wallets = await getWallets(1, 1);
    const delegates = await getDelegates(1, 1);
    const blocks = await getLastBlock();

    const currTime = Math.floor(Date.now() / 1000);
    if (currTime - timeCaching['timeCacheStats'] >= 1800) {
        timeCaching['timeCacheStats'] = Math.floor(Date.now() / 1000);
        try {
            dataCaching['stats'] = {
                height: blocks['height'],
                transactions: txs['meta']['totalCount'],
                wallets: wallets['meta']['totalCount'],
                delegates: delegates['meta']['totalCount'],
            }
        } catch (e) {
            console.log('err:chainStats');
        }

    }


    return dataCaching['stats'];
}

/* GET home page. */
router.get('/', function (req, res, next) {
    res.render('index', {title: 'SmartHoldem API Wrapper'});
});

router.get('/stats', async function (req, res, next) {
    res.json(await chainStats());
});




router.get('/trng', async function (req, res, next) {
    const block = await getLastBlock();
    const rng = await calcRNG(block.id);
    res.json({
        blockId: block.id,
        timestamp: block.timestamp,
        values: rng
    });
});

router.get('/trng-1', async function (req, res, next) {
    const block = await getLastBlock();
    const rng = await calcRNG(block.id);
    res.json(rng[0]);
});


router.get('/blockchain', async function (req, res, next) {
    res.json(await getSupply())
});

module.exports = router;
