const sdk = require('@defillama/sdk');
const axios = require('axios');

const lsdTokens = [
  { name: 'Lido', address: '0xae7ab96520de3a18e5e111b5eaab095312d7fe84' },
  {
    name: 'Coinbase Wrapped Staked ETH',
    address: '0xbe9895146f7af43049ca1c1ae358b0541ea49704',
  },
  {
    name: 'Rocket Pool',
    address: '0xae78736cd615f374d3085123a210448e74fc6393',
  },
  { name: 'StakeWise', adress: '0xfe2e637202056d30016725477c5da089ab0a043a' },
  { name: 'Ankr', address: '0xe95a203b1a91a908f9b9ce46459d101078c2c3cb' },
  { name: 'Frax Ether', address: '0x5e8422345238f34275888049021821e8e08caa1f' },
  {
    name: 'SharedStake',
    address: '0x898bad2774eb97cf6b94605677f43b41871410b1',
  },
  { name: 'Stafi', address: '0x9559aaa82d9649c7a7b220e7c461d2e74c9a3593' },
  { name: 'StakeHound', address: '0xdfe66b14d37c77f4e9b180ceb433d1b164f0281d' },
];

const oneInchUrl = 'https://api.1inch.io/v5.0/1/quote';
const cbETHRateUrl =
  'https://api-public.sandbox.pro.coinbase.com/wrapped-assets/CBETH/conversion-rate';

module.exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  return await getRates();
};

const getRates = async () => {
  const marketRates = await getMarketRates();
  const expectedRates = await getExpectedRates();

  console.log(marketRates);

  return {
    marketRates,
    expectedRates,
  };
};

const getMarketRates = async () => {
  const eth = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
  const amount = 1e18;
  const urls = lsdTokens.map(
    (lsd) =>
      `${oneInchUrl}?fromTokenAddress=${lsd.address}&toTokenAddress=${eth}&amount=${amount}`
  );

  const marketRates = (await Promise.allSettled(urls.map((u) => axios.get(u))))
    .map((p) => p.value?.data)
    .filter(Boolean);

  return marketRates;
};

const getExpectedRates = async () => {
  // same for rETHStafi
  const rETHAbi = {
    inputs: [],
    name: 'getExchangeRate',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  };

  const ankrETHAbi = {
    inputs: [],
    name: 'ratio',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  };

  // --- cbETH
  const cbETHRate = Number((await axios.get(cbETHRateUrl)).data.amount);

  // --- rETH (rocket pool)
  const rETHRate =
    (
      await sdk.api.abi.call({
        target: lsdTokens.find((lsd) => lsd.name === 'Rocket Pool').address,
        chain: 'ethereum',
        abi: rETHAbi,
      })
    ).output / 1e18;

  // --- rETH (stafi)
  const rETHStafiRate =
    (
      await sdk.api.abi.call({
        target: lsdTokens.find((lsd) => lsd.name === 'Stafi').address,
        chain: 'ethereum',
        abi: rETHAbi,
      })
    ).output / 1e18;

  // --- ankrETH
  const ankrETHRate =
    1 /
    ((
      await sdk.api.abi.call({
        target: lsdTokens.find((lsd) => lsd.name === 'Ankr').address,
        chain: 'ethereum',
        abi: ankrETHAbi,
      })
    ).output /
      1e18);

  return lsdTokens.map((lsd) => ({
    ...lsd,
    expectedRate:
      lsd.name === 'Coinbase Wrapped Staked ETH'
        ? cbETHRate
        : lsd.name === 'Rocket Pool'
        ? rETHRate
        : lsd.name === 'Stafi'
        ? rETHStafiRate
        : lsd.name === 'Ankr'
        ? ankrETHRate
        : 1,
  }));
};
