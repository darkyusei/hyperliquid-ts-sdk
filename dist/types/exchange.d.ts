import { Wallet } from 'ethers';
import { API } from './api';
import { ApiResponse, CancelByCloidRequest, CancelRequest, OrderRequest, OrderType, Universe } from './types';
export declare class Exchange extends API {
    private wallet;
    private vaultAddress;
    private meta;
    private coinToAsset;
    private info;
    private isMainnet;
    static create(wallet: Wallet, baseUrl: string, vaultAddress?: string | undefined): Promise<Exchange>;
    constructor(wallet: Wallet, baseUrl: string, meta: Universe, vaultAddress?: string | undefined);
    private _postAction;
    private _postUIAction;
    marketOrder(coin: string, isBuy: boolean, sz: number, reduceOnly?: boolean, slippage?: number): Promise<ApiResponse>;
    UIMarketOrder(coin: string, isBuy: boolean, sz: number, reduceOnly?: boolean, slippage?: number): Promise<ApiResponse>;
    private slippage_price;
    order(coin: string, isBuy: boolean, sz: number, limitPx: number, orderType: OrderType, reduceOnly?: boolean, cloid?: string): Promise<ApiResponse>;
    UIorder(coin: string, isBuy: boolean, sz: number, limitPx: number, orderType: OrderType, reduceOnly?: boolean): Promise<ApiResponse>;
    bulkOrders(orderRequests: OrderRequest[]): Promise<ApiResponse>;
    bulkUIOrders(orderRequests: OrderRequest[]): Promise<ApiResponse>;
    cancel(coin: string, oid: number): Promise<any>;
    UIcancel(coin: string, oid: number): Promise<any>;
    cancelByCloid(coin: string, cloid: string): Promise<any>;
    bulkCancel(cancelRequests: CancelRequest[]): Promise<ApiResponse>;
    bulkUICancel(cancelRequests: CancelRequest[]): Promise<ApiResponse>;
    bulkCancelByCloid(cancelRequests: CancelByCloidRequest[]): Promise<ApiResponse>;
    usdTransfer(amount: string, destination?: string): Promise<any>;
}
//# sourceMappingURL=exchange.d.ts.map