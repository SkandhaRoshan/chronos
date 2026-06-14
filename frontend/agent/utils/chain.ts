import { defineChain, createPublicClient, http } from 'viem';

export const robinhoodTestnet = defineChain({
  id: 46630,
  name: 'Robinhood Testnet',
  nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.RPC_URL || 'https://robinhood-testnet.g.alchemy.com/v2/g_PavdhsuS-04ZcDhDwPl'] },
    public: { http: [process.env.RPC_URL || 'https://robinhood-testnet.g.alchemy.com/v2/g_PavdhsuS-04ZcDhDwPl'] },
  },
  blockExplorers: {
    default: { name: 'Robinhood Explorer', url: 'https://explorer.testnet.chain.robinhood.com' },
  },
  testnet: true,
});

export const createRobinhoodPublicClient = () => {
  return createPublicClient({
    chain: robinhoodTestnet,
    transport: http(process.env.RPC_URL)
  });
};
