import { Subscription, WsMsg } from './types';
import { WebSocket } from 'ws';
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
export declare class WebsocketManager {
    subscription_id_counter: number;
    wsReady: boolean;
    queuedSubscriptions: [Subscription, ActiveSubscription][];
    activeSubscriptions: Record<string, ActiveSubscription[]>;
    socket: WebSocket;
    debug: boolean;
    alive: boolean;
    constructor(base_url: string, debug?: boolean);
    connectWs(wsUrl: string, debug: boolean): void;
    heartbeat(): void;
    subscribe(subscription: any, callback: (wsMsg: WsMsg) => void, subscription_id?: number): number;
    unsubscribe(subscription: Subscription, subscription_id: number): boolean;
    private subscriptionToIdentifier;
    private wsMsgToIdentifier;
}
export {};
