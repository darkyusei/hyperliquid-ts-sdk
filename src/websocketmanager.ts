import { Subscription, WsMsg } from './types';
import {WebSocket} from 'ws';

type ActiveSubscription = {
  callback: (data: any) => void;
  subscriptionId: number;
};

export interface WebSocketType {
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  send(data: string | ArrayBuffer | Blob | ArrayBufferView): void;
  close(code?: number, reason?: string): void;
}

export class WebsocketManager {
  subscription_id_counter: number;
  wsReady: boolean;
  queuedSubscriptions: [Subscription, ActiveSubscription][];
  activeSubscriptions: Record<string, ActiveSubscription[]>;
  socket: WebSocket;
  debug: boolean;
  alive: boolean = false;

  constructor(base_url: string, debug = false) {
    this.subscription_id_counter = 0;
    this.wsReady = false;
    this.queuedSubscriptions = [];
    this.activeSubscriptions = {};

    const wsUrl = `ws${base_url.slice('http'.length)}/ws`;

    this.debug = debug;

    this.connectWs(wsUrl, debug);

  }
  
  connectWs(wsUrl: string, debug: boolean) {
    this.socket = new WebSocket(wsUrl) as WebSocketType;

    this.debug = debug;

    this.socket.on('close', (code: number, reason: Buffer) => {
        console.log('WebSocket disconnected', code, reason.toString('utf8'));
        // if (code === 1006) {
        //   // 重连
        //   setTimeout(() => {
        //     console.log('Reconnecting...');
        //     this.connectWs(wsUrl, debug);
        //   }, 5000); // 5秒后重连
        // } else {
        //   console.log("waiting")
        // }
        
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
      // this.socket.close()
    })

    this.socket.on('open', (): void => {
      this.alive = true
      this.heartbeat()
      if (this.debug) {
        console.log('on_open');
      }
      this.wsReady = true;
      for (const [subscription, active_subscription] of this
        .queuedSubscriptions) {
        this.subscribe(
          subscription,
          active_subscription.callback,
          active_subscription.subscriptionId,
        );
      }
    });

    this.socket.onmessage = (event: MessageEvent): void => {
      const message = event.data;
      if (message === 'Websocket connection established.') {
        if (this.debug) {
          console.log(message);
        }
        return;
      }

      const wsMsg: WsMsg = JSON.parse(message);
      const identifier = this.wsMsgToIdentifier(wsMsg);
      if (identifier === null) {
        if (this.debug) {
          console.log('Websocket not handling empty message');
        }
        return;
      }

      if (identifier === 'pong') {
        this.alive = true
      }

      const active_subscriptions = this.activeSubscriptions[identifier];
      if (!active_subscriptions || active_subscriptions.length === 0) {
        if (this.debug) {
          console.log(
            'Websocket message from an unexpected subscription:',
            message,
            identifier,
          );
        }
      } else {
        for (const active_subscription of active_subscriptions) {
          active_subscription.callback(wsMsg);
        }
      }
    };


  }

  heartbeat() {
    setInterval(()=> {
      this.socket.send(JSON.stringify({ method: 'ping' }))
    }, 30000)
  }

  subscribe(
    subscription: any,
    callback: (wsMsg: WsMsg) => void,
    subscription_id?: number,
  ): number {
    const subscriptionId = subscription_id || ++this.subscription_id_counter;
    if (!this.wsReady) {
      if (this.debug) {
        console.log('enqueueing subscription');
      }
      this.queuedSubscriptions.push([
        subscription,
        { callback, subscriptionId: subscriptionId },
      ]);
    } else {
      if (this.debug) {
        console.log('subscribing');
      }
      const identifier = this.subscriptionToIdentifier(subscription);
      if (subscription.type === 'userEvents') {
        if (
          this.activeSubscriptions[identifier] &&
          this.activeSubscriptions[identifier].length !== 0
        ) {
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

  unsubscribe(subscription: Subscription, subscription_id: number): boolean {
    if (!this.wsReady) {
      throw new Error("Can't unsubscribe before websocket connected");
    }
    const identifier = this.subscriptionToIdentifier(subscription);
    const active_subscriptions = this.activeSubscriptions[identifier] || [];
    const new_active_subscriptions = active_subscriptions.filter(
      (x) => x.subscriptionId !== subscription_id,
    );
    if (new_active_subscriptions.length === 0) {
      this.socket.send(JSON.stringify({ method: 'unsubscribe', subscription }));
    }
    this.activeSubscriptions[identifier] = new_active_subscriptions;
    return new_active_subscriptions.length !== active_subscriptions.length;
  }

  private subscriptionToIdentifier(subscription: Subscription): string {
    if (subscription.type === 'l2Book') {
      return `l2Book:${subscription.coin.toLowerCase()}`;
    }
    return subscription.type;
  }

  private wsMsgToIdentifier(wsMsg: WsMsg): string | null {
    if (wsMsg.channel === 'allMids') {
      return 'allMids';
    } else if (wsMsg.channel === 'l2Book') {
      return `l2Book:${wsMsg.data.coin.toLowerCase()}`;
    } else if (wsMsg.channel === 'trades') {
      const trades = wsMsg.data;
      if (trades.length === 0) {
        return null;
      } else {
        return `trades:${trades[0].coin.toLowerCase()}`;
      }
    } else if (wsMsg.channel === 'user') {
      return 'userEvents';
    } else if (wsMsg['channel'] === 'subscriptionResponse') {
      return 'subscriptionResponse';
    } else if (wsMsg['channel'] === 'pong') {
      return 'pong'
    }
    return wsMsg['channel'];
  }
}
