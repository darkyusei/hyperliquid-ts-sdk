"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Exchange = void 0;
const api_1 = require("./api");
const signing_1 = require("./signing");
const constants_1 = require("./constants");
const util_1 = require("./util");
class Exchange extends api_1.API {
    wallet;
    vaultAddress;
    meta;
    coinToAsset;
    info;
    isMainnet;
    static async create(wallet, baseUrl, vaultAddress = undefined) {
        const info = new api_1.Info(baseUrl, true);
        const meta = await info.meta();
        return new Exchange(wallet, baseUrl, meta, vaultAddress);
    }
    constructor(wallet, baseUrl, meta, vaultAddress = undefined) {
        super(baseUrl);
        this.isMainnet = baseUrl === constants_1.MAINNET_API_URL;
        this.wallet = wallet;
        this.vaultAddress = vaultAddress;
        this.meta = meta;
        this.coinToAsset = {};
        for (const { name } of this.meta.universe) {
            this.coinToAsset[name] = this.meta.universe.findIndex((assetInfo) => assetInfo.name === name);
        }
        this.info = new api_1.Info(baseUrl, true);
    }
    async _postAction(action, signature, nonce) {
        const payload = {
            action,
            nonce,
            signature,
            vaultAddress: this.vaultAddress,
        };
        return await this.post('/exchange', payload);
    }
    async marketOrder(coin, isBuy, sz, reduceOnly = false, slippage = constants_1.DEFAULT_SLIPPAGE) {
        const px = await this.slippage_price(coin, isBuy, slippage);
        return await this.order(coin, isBuy, sz, px, { "limit": { "tif": "Ioc" } }, reduceOnly);
    }
    async slippage_price(coin, is_buy, slippage, px) {
        if (!px) {
            const mids = await this.info.allMids();
            // Get midprice
            px = parseFloat(mids[coin]);
        }
        // Calculate Slippage
        px *= is_buy ? (1 + slippage) : (1 - slippage);
        // We round px to 5 significant figures and 6 decimals
        return (0, util_1.five)(px);
    }
    async order(coin, isBuy, sz, limitPx, orderType, reduceOnly = false, cloid) {
        return await this.bulkOrders([
            {
                coin,
                isBuy,
                sz,
                limitPx,
                orderType,
                reduceOnly,
                cloid,
            },
        ]);
    }
    async bulkOrders(orderRequests) {
        const orderSpecs = orderRequests.map((order) => ({
            order: {
                asset: this.coinToAsset[order.coin],
                isBuy: order.isBuy,
                reduceOnly: order.reduceOnly,
                limitPx: order.limitPx,
                sz: order.sz,
                cloid: order.cloid || undefined,
            },
            orderType: order.orderType,
        }));
        const timestamp = (0, signing_1.getTimestampMs)();
        const grouping = 'na';
        const signature = await (0, signing_1.signL1Action)(this.wallet, ['(uint32,bool,uint64,uint64,bool,uint8,uint64,byte)[]', 'uint8'], [
            orderSpecs.map((os) => (0, signing_1.orderSpecPreprocessing)(os)),
            (0, signing_1.orderGroupToNumber)(grouping),
        ], this.vaultAddress === undefined ? signing_1.ZERO_ADDRESS : this.vaultAddress, timestamp, this.isMainnet);
        return await this._postAction({
            type: 'order',
            grouping,
            orders: orderSpecs.map(signing_1.orderSpecToOrderWire),
        }, signature, timestamp);
    }
    async cancel(coin, oid) {
        return this.bulkCancel([{ coin, oid }]);
    }
    async cancelByCloid(coin, cloid) {
        return this.bulkCancelByCloid([{ coin, cloid }]);
    }
    async bulkCancel(cancelRequests) {
        const timestamp = (0, signing_1.getTimestampMs)();
        const signature = await (0, signing_1.signL1Action)(this.wallet, ['(uint32,uint64)[]'], [
            cancelRequests.map((cancel) => [
                this.coinToAsset[cancel.coin],
                cancel.oid,
            ]),
        ], this.vaultAddress === undefined ? signing_1.ZERO_ADDRESS : this.vaultAddress, timestamp, this.isMainnet);
        return this._postAction({
            type: 'cancel',
            cancels: cancelRequests.map((cancel) => ({
                asset: this.coinToAsset[cancel.coin],
                oid: cancel.oid,
            })),
        }, signature, timestamp);
    }
    async bulkCancelByCloid(cancelRequests) {
        const timestamp = (0, signing_1.getTimestampMs)();
        const signature = await (0, signing_1.signL1Action)(this.wallet, ['(uint32,string)[]'], [
            cancelRequests.map((cancel) => [
                this.coinToAsset[cancel.coin],
                cancel.cloid,
            ]),
        ], this.vaultAddress === undefined ? signing_1.ZERO_ADDRESS : this.vaultAddress, timestamp, this.isMainnet);
        return this._postAction({
            type: 'cancelByCloid',
            cancels: cancelRequests.map((cancel) => ({
                asset: this.coinToAsset[cancel.coin],
                cloid: cancel.cloid,
            })),
        }, signature, timestamp);
    }
    async usdTransfer(amount, destination = this.wallet.address) {
        const timestamp = (0, signing_1.getTimestampMs)();
        const payload = {
            destination,
            amount,
            time: timestamp,
        };
        const signature = await (0, signing_1.signUsdTransferAction)(this.wallet, payload);
        return this._postAction({
            type: 'usdTransfer',
            chain: 'Arbitrum',
            payload,
        }, signature, timestamp);
    }
}
exports.Exchange = Exchange;
