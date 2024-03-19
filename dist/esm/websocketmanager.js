import { WebSocket } from 'ws';
export class WebsocketManager {
    subscription_id_counter;
    wsReady;
    queuedSubscriptions;
    activeSubscriptions;
    socket;
    debug;
    alive = false;
    constructor(base_url, debug = false) {
        this.subscription_id_counter = 0;
        this.wsReady = false;
        this.queuedSubscriptions = [];
        this.activeSubscriptions = {};
        const wsUrl = `ws${base_url.slice('http'.length)}/ws`;
        this.debug = debug;
        this.connectWs(wsUrl, debug);
    }
    connectWs(wsUrl, debug) {
        this.socket = new WebSocket(wsUrl);
        this.debug = debug;
        this.socket.on('close', (code, reason) => {
            console.log('WebSocket disconnected', code, reason.toString('utf8'));
<<<<<<< HEAD
            if (code === 1006) {
                // 重连
                setTimeout(() => {
                    console.log('Reconnecting...');
                    this.connectWs(wsUrl, debug);
                }, 5000); // 5秒后重连
            }
            else {
                console.log("waiting");
            }
=======
            // if (code === 1006) {
            //   // 重连
            //   setTimeout(() => {
            //     console.log('Reconnecting...');
            //     this.connectWs(wsUrl, debug);
            //   }, 5000); // 5秒后重连
            // } else {
            //   console.log("waiting")
            // }
>>>>>>> f8a23103e941f6c23f1c81cc133e8ac9e32797fd
        });
        this.socket.on('error', (error) => {
            console.error('WebSocket error:', error);
            // this.socket.close()
        });
        this.socket.on('open', () => {
            this.alive = true;
            this.heartbeat();
            if (this.debug) {
                console.log('on_open');
            }
            this.wsReady = true;
            for (const [subscription, active_subscription] of this
                .queuedSubscriptions) {
                this.subscribe(subscription, active_subscription.callback, active_subscription.subscriptionId);
            }
        });
        this.socket.onmessage = (event) => {
            const message = event.data;
            if (message === 'Websocket connection established.') {
                if (this.debug) {
                    console.log(message);
                }
                return;
            }
            const wsMsg = JSON.parse(message);
            const identifier = this.wsMsgToIdentifier(wsMsg);
            if (identifier === null) {
                if (this.debug) {
                    console.log('Websocket not handling empty message');
                }
                return;
            }
            if (identifier === 'pong') {
                this.alive = true;
            }
            const active_subscriptions = this.activeSubscriptions[identifier];
            if (!active_subscriptions || active_subscriptions.length === 0) {
                if (this.debug) {
                    console.log('Websocket message from an unexpected subscription:', message, identifier);
                }
            }
            else {
                for (const active_subscription of active_subscriptions) {
                    active_subscription.callback(wsMsg);
                }
            }
        };
    }
    heartbeat() {
        setInterval(() => {
            this.socket.send(JSON.stringify({ method: 'ping' }));
        }, 30000);
    }
    subscribe(subscription, callback, subscription_id) {
        const subscriptionId = subscription_id || ++this.subscription_id_counter;
        if (!this.wsReady) {
            if (this.debug) {
                console.log('enqueueing subscription');
            }
            this.queuedSubscriptions.push([
                subscription,
                { callback, subscriptionId: subscriptionId },
            ]);
        }
        else {
            if (this.debug) {
                console.log('subscribing');
            }
            const identifier = this.subscriptionToIdentifier(subscription);
            if (subscription.type === 'userEvents') {
                if (this.activeSubscriptions[identifier] &&
                    this.activeSubscriptions[identifier].length !== 0) {
                    throw new Error('Cannot subscribe to UserEvents multiple times');
                }
            }
            this.activeSubscriptions[identifier] =
                this.activeSubscriptions[identifier] || [];
            this.activeSubscriptions[identifier].push({
                callback,
                subscriptionId: subscriptionId,
            });
            this.socket.send(JSON.stringify({ method: 'subscribe', subscription }));
        }
        return subscriptionId;
    }
    unsubscribe(subscription, subscription_id) {
        if (!this.wsReady) {
            throw new Error("Can't unsubscribe before websocket connected");
        }
        const identifier = this.subscriptionToIdentifier(subscription);
        const active_subscriptions = this.activeSubscriptions[identifier] || [];
        const new_active_subscriptions = active_subscriptions.filter((x) => x.subscriptionId !== subscription_id);
        if (new_active_subscriptions.length === 0) {
            this.socket.send(JSON.stringify({ method: 'unsubscribe', subscription }));
        }
        this.activeSubscriptions[identifier] = new_active_subscriptions;
        return new_active_subscriptions.length !== active_subscriptions.length;
    }
    subscriptionToIdentifier(subscription) {
        if (subscription.type === 'l2Book') {
            return `l2Book:${subscription.coin.toLowerCase()}`;
        }
        return subscription.type;
    }
    wsMsgToIdentifier(wsMsg) {
        if (wsMsg.channel === 'allMids') {
            return 'allMids';
        }
        else if (wsMsg.channel === 'l2Book') {
            return `l2Book:${wsMsg.data.coin.toLowerCase()}`;
        }
        else if (wsMsg.channel === 'trades') {
            const trades = wsMsg.data;
            if (trades.length === 0) {
                return null;
            }
            else {
                return `trades:${trades[0].coin.toLowerCase()}`;
            }
        }
        else if (wsMsg.channel === 'user') {
            return 'userEvents';
        }
        else if (wsMsg['channel'] === 'subscriptionResponse') {
            return 'subscriptionResponse';
        }
        else if (wsMsg['channel'] === 'pong') {
            return 'pong';
        }
        return wsMsg['channel'];
    }
}
