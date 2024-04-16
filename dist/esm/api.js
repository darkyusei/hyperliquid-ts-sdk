import axios from 'axios';
import http from 'http';
import https from 'https';
import { WebsocketManager } from './websocketmanager';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';
export class API {
    baseUrl;
    httpAgent;
    httpsAgent;
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        const httpProxyUrl = process.env.HTTP_PROXY;
        const httpsProxyUrl = process.env.HTTPS_PROXY;
        if (httpProxyUrl) {
            this.httpAgent = new HttpProxyAgent(httpProxyUrl, { keepAlive: true });
        }
        else {
            this.httpAgent = new http.Agent({ keepAlive: true });
        }
        if (httpsProxyUrl) {
            this.httpsAgent = new HttpsProxyAgent(httpsProxyUrl, { keepAlive: true });
        }
        else {
            this.httpsAgent = new https.Agent({ keepAlive: true });
        }
    }
    async post(urlPath, payload = {}, config = {}) {
        try {
            const response = await axios.post(this.baseUrl + urlPath, payload, Object.assign(config, {
                httpAgent: this.httpAgent,
                httpsAgent: this.httpsAgent,
            }));
            return response.data;
        }
        catch (error) {
            console.log(error);
            throw error;
        }
    }
}
export class Info extends API {
    wsManager;
    constructor(baseUrl, skipWs = false) {
        super(baseUrl);
        if (!skipWs) {
            this.wsManager = new WebsocketManager(this.baseUrl);
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
