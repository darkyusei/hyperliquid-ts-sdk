"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Info = exports.API = void 0;
const axios_1 = __importDefault(require("axios"));
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const websocketmanager_1 = require("./websocketmanager");
const https_proxy_agent_1 = require("https-proxy-agent");
const http_proxy_agent_1 = require("http-proxy-agent");
class API {
    baseUrl;
    httpAgent;
    httpsAgent;
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        const httpProxyUrl = process.env.HTTP_PROXY;
        const httpsProxyUrl = process.env.HTTPS_PROXY;
        if (httpProxyUrl) {
            this.httpAgent = new http_proxy_agent_1.HttpProxyAgent(httpProxyUrl, { keepAlive: true });
        }
        else {
            this.httpAgent = new http_1.default.Agent({ keepAlive: true });
        }
        if (httpsProxyUrl) {
            this.httpsAgent = new https_proxy_agent_1.HttpsProxyAgent(httpsProxyUrl, { keepAlive: true });
        }
        else {
            this.httpsAgent = new https_1.default.Agent({ keepAlive: true });
        }
    }
    async post(urlPath, payload = {}) {
        try {
            const response = await axios_1.default.post(this.baseUrl + urlPath, payload, {
                httpAgent: this.httpAgent,
                httpsAgent: this.httpsAgent,
            });
            return response.data;
        }
        catch (error) {
            console.log(error);
            throw error;
        }
    }
}
exports.API = API;
class Info extends API {
    wsManager;
    constructor(baseUrl, skipWs = false) {
        super(baseUrl);
        if (!skipWs) {
            this.wsManager = new websocketmanager_1.WebsocketManager(this.baseUrl);
        }
    }
    async userState(user) {
        return await this.post('/info', {
            type: 'clearinghouseState',
            user,
        });
    }
    async vaultDetails(user, vaultAddress) {
        return await this.post('/info', {
            type: 'vaultDetails',
            user,
            vaultAddress,
        });
    }
    async metaAndAssetCtxs() {
        return await this.post('/info', {
            type: 'metaAndAssetCtxs',
        });
    }
    async openOrders(user) {
        return await this.post('/info', {
            type: 'openOrders',
            user,
        });
    }
    async allMids() {
        return await this.post('/info', {
            type: 'allMids',
        });
    }
    async userFills(user) {
        return await this.post('/info', {
            type: 'userFills',
            user,
        });
    }
    async meta() {
        return await this.post('/info', { type: 'meta' });
    }
    async fundingHistory(coin, startTime, endTime) {
        const request = endTime
            ? { type: 'fundingHistory', coin, startTime, endTime }
            : { type: 'fundingHistory', coin, startTime };
        return await this.post('/info', request);
    }
    async l2Snapshot(coin) {
        return await this.post('/info', { type: 'l2Book', coin });
    }
    async candlesSnapshot(coin, interval, startTime, endTime) {
        const request = { coin, interval, startTime, endTime };
        return await this.post('/info', {
            type: 'candleSnapshot',
            req: request,
        });
    }
    subscribe(subscription, callback) {
        this.wsManager.subscribe(subscription, callback);
    }
    unsubscribe(subscription, subscription_id) {
        if (!this.wsManager) {
            throw new Error('Cannot call unsubscribe since skipWs was used');
        }
        else {
            return this.wsManager.unsubscribe(subscription, subscription_id);
        }
    }
}
exports.Info = Info;
