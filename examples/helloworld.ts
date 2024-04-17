import { ethers } from 'ethers';
import { Exchange, Info, MAINNET_API_URL, MAINNET_UI_API_URL, TESTNET_API_URL, TESTNET_UI_API_URL } from '../src';

const secretKey: string = process.env.SECRET_KEY || '';

async function dohttp(info, wallet) {
  const address = wallet.address;

  console.log(await info.userState(address));
  console.log(await info.openOrders(address));
  console.log(await info.allMids());
  console.log(await info.userFills(address));
  console.log(await info.meta());
  console.log(
    await info.fundingHistory(
      'BTC',
      new Date().getTime() - 24 * 60 * 60 * 1000,
    ),
  );
  console.log((await info.l2Snapshot('BTC'))['levels'][0][0]);
  console.log(
    await info.candlesSnapshot(
      'BTC',
      '1d',
      new Date().getTime() - 24 * 60 * 60 * 1000,
      new Date().getTime(),
    ),
  );
}

async function dows(info, wallet) {
  const address = wallet.address;

  info.subscribe({ type: 'userEvents', user: address }, (event) => {
    console.log(event);
  });
  info.subscribe({ type: 'l2Book', coin: 'BTC' }, (event) => {
    console.log(event);
  });
  info.subscribe({ type: 'l2Book', coin: 'ETH' }, (event) => {
    console.log(event);
  });
  let i = 0;
  while (i < 1000) {
    await new Promise((resolve) => {
      setTimeout(resolve, 1000);
    });
    i++;
  }
}
async function doexchange(info, exchange, wallet) {
  const address = wallet.address;

  const oos = await info.openOrders(address);
  console.log(oos);
  const cancelRequests = oos.map((oo) => {
    return { coin: oo.coin, oid: oo.oid };
  });
  console.log(await exchange.bulkCancel(cancelRequests));

  // console.log(
  //   await exchange.bulkOrders([
  //     {
  //       coin: 'XRP',
  //       isBuy: true,
  //       sz: 1,
  //       limitPx: 1,
  //       orderType: { limit: { tif: 'Alo' } },
  //       reduceOnly: true,
  //     },
  //   ]),
  // );
}

async function main(): Promise<void> {
  const wallet = new ethers.Wallet("0xb86bca5ba4e66624d910027bfb7d5654f4bd5b1159be5b2bb416fb1a66e3df6f");
  const exchange = await Exchange.create(wallet, TESTNET_UI_API_URL);
  let orderId = 0
  try {
    const res = await exchange.UIorder('ARB', false, 10, 2, {
      limit: { tif: 'Gtc' },
    },
    false);
    console.log(res)
    orderId = (res.response.data.statuses[0] as any).resting.oid
    // await doexchange(info, exchange, wallet);
  } catch (error) {
    console.log(error);
  }

  // try {
  //   const res = await exchange.UIcancel("ARB", orderId)
  //   console.log(res)
  // } catch (error) {
  //   console.log(error);
  // }
}

async function marketOrder(): Promise<void> {
  const wallet = new ethers.Wallet("");
  const exchange = await Exchange.create(wallet, TESTNET_UI_API_URL);
  let orderId = 0
  try {
    const res = await exchange.UIMarketOrder('ETH', false, 0.01, false);
    console.log(res.response.data.statuses)
    orderId = (res.response.data.statuses[0] as any).resting.oid
    // await doexchange(info, exchange, wallet);
  } catch (error) {
    console.log(error);
  }

  // try {
  //   const res = await exchange.UIcancel("ARB", orderId)
  //   console.log(res)
  // } catch (error) {
  //   console.log(error);
  // }
}

main();
