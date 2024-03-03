import { Wallet } from 'ethers';
import { API, Info } from './api';
import {
  OrderWire,
  ZERO_ADDRESS,
  getTimestampMs,
  orderGroupToNumber,
  orderSpecPreprocessing,
  orderSpecToOrderWire,
  signL1Action,
  signUsdTransferAction,
} from './signing';
import {
  ApiResponse,
  CancelByCloidRequest,
  CancelRequest,
  OrderRequest,
  OrderSpec,
  OrderType,
  Universe,
} from './types';
import { DEFAULT_SLIPPAGE, MAINNET_API_URL } from './constants';
import { five } from './util';

export class Exchange extends API {
  private wallet: Wallet;
  private vaultAddress: string | undefined;
  private meta: Universe;
  private coinToAsset: Record<string, number>;
  private info: Info;
  private isMainnet: boolean;

  static async create(
    wallet: Wallet,
    baseUrl: string,
    vaultAddress: string | undefined = undefined,
  ): Promise<Exchange> {
    const info = new Info(baseUrl, true);
    const meta = await info.meta();
    return new Exchange(wallet, baseUrl, meta, vaultAddress);
  }

  constructor(
    wallet: Wallet,
    baseUrl: string,
    meta: Universe,
    vaultAddress: string | undefined = undefined,
  ) {
    super(baseUrl);
    this.isMainnet = baseUrl === MAINNET_API_URL
    this.wallet = wallet;
    this.vaultAddress = vaultAddress;

    this.meta = meta;
    this.coinToAsset = {};
    for (const { name } of this.meta.universe) {
      this.coinToAsset[name] = this.meta.universe.findIndex(
        (assetInfo) => assetInfo.name === name,
      );
    }

    this.info = new Info(baseUrl, true);
  }

  private async _postAction(
    action:
      | {
          type: 'cancel';
          cancels: { asset: number; oid: number }[];
        }
      | {
        type: 'cancelByCloid';
        cancels: { asset: number; cloid: string }[];
      }
      | {
          type: 'order';
          grouping;
          orders: OrderWire[];
        }
      | {
          type: 'usdTransfer';
          chain;
          payload;
        },
    signature: { r: string; s: string; v: number },
    nonce: number,
  ): Promise<ApiResponse> {
    const payload = {
      action,
      nonce,
      signature,
      vaultAddress: this.vaultAddress,
    };
    return await this.post('/exchange', payload);
  }

  async marketOrder(
    coin: string,
    isBuy: boolean,
    sz: number,
    reduceOnly = false,
    slippage = DEFAULT_SLIPPAGE
  ): Promise<ApiResponse> {
    const px = await this.slippage_price(coin, isBuy, slippage);
    return await this.order(coin, isBuy, sz, px, {"limit": {"tif": "Ioc"}}, reduceOnly);
  }

  private async slippage_price(
    coin: string,
    is_buy: boolean,
    slippage: number,
    px?: number
): Promise<number> {
    if (!px) {
        const mids = await this.info.allMids()
        // Get midprice
        px = parseFloat(mids[coin]);
    }
    // Calculate Slippage
    px *= is_buy ? (1 + slippage) : (1 - slippage);
    // We round px to 5 significant figures and 6 decimals
    return five(px);
}

  async order(
    coin: string,
    isBuy: boolean,
    sz: number,
    limitPx: number,
    orderType: OrderType,
    reduceOnly = false,
    cloid ?: string,
  ): Promise<ApiResponse> {
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

  async bulkOrders(orderRequests: OrderRequest[]): Promise<ApiResponse> {
    const orderSpecs: OrderSpec[] = orderRequests.map((order) => ({
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

    const timestamp = getTimestampMs();
    const grouping = 'na';
    const typeArr = orderRequests[0].cloid ? '(uint32,bool,uint64,uint64,bool,uint8,uint6,string)[]' : '(uint32,bool,uint64,uint64,bool,uint8,uint64)[]'
    const signature = await signL1Action(
      this.wallet,
      [typeArr, 'uint8'],
      [
        orderSpecs.map((os) => orderSpecPreprocessing(os)),
        orderGroupToNumber(grouping),
      ],
      this.vaultAddress === undefined ? ZERO_ADDRESS : this.vaultAddress,
      timestamp,
      this.isMainnet
    );

    return await this._postAction(
      {
        type: 'order',
        grouping,
        orders: orderSpecs.map(orderSpecToOrderWire),
      },
      signature,
      timestamp,
    );
  }

  async cancel(coin: string, oid: number): Promise<any> {
    return this.bulkCancel([{ coin, oid }]);
  }

  async cancelByCloid(coin:string, cloid: string): Promise<any> {
    return this.bulkCancelByCloid([{ coin, cloid }]);
  }

  async bulkCancel(cancelRequests: CancelRequest[]): Promise<ApiResponse> {
    const timestamp = getTimestampMs();
    const signature = await signL1Action(
      this.wallet,
      ['(uint32,uint64)[]'],
      [
        cancelRequests.map((cancel) => [
          this.coinToAsset[cancel.coin],
          cancel.oid,
        ]),
      ],
      this.vaultAddress === undefined ? ZERO_ADDRESS : this.vaultAddress,
      timestamp,
      this.isMainnet
    );

    return this._postAction(
      {
        type: 'cancel',
        cancels: cancelRequests.map((cancel) => ({
          asset: this.coinToAsset[cancel.coin],
          oid: cancel.oid,
        })),
      },
      signature,
      timestamp,
    );
  }

  async bulkCancelByCloid(cancelRequests: CancelByCloidRequest[]): Promise<ApiResponse> {
    const timestamp = getTimestampMs();
    const signature = await signL1Action(
      this.wallet,
      ['(uint32,string)[]'],
      [
        cancelRequests.map((cancel) => [
          this.coinToAsset[cancel.coin],
          cancel.cloid,
        ]),
      ],
      this.vaultAddress === undefined ? ZERO_ADDRESS : this.vaultAddress,
      timestamp,
      this.isMainnet
    );

    return this._postAction(
      {
        type: 'cancelByCloid',
        cancels: cancelRequests.map((cancel) => ({
          asset: this.coinToAsset[cancel.coin],
          cloid: cancel.cloid,
        })),
      },
      signature,
      timestamp,
    );
  }

  async usdTransfer(
    amount: string,
    destination = this.wallet.address,
  ): Promise<any> {
    const timestamp = getTimestampMs();
    const payload = {
      destination,
      amount,
      time: timestamp,
    };
    const signature = await signUsdTransferAction(this.wallet, payload);

    return this._postAction(
      {
        type: 'usdTransfer',
        chain: 'Arbitrum',
        payload,
      },
      signature,
      timestamp,
    );
  }
}
