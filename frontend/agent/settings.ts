import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';
import dotenv from 'dotenv';

dotenv.config();

// Client 1: Points to Robinhood Chain L2 for RWA Stock Pool Liquidity tracking
export const publicClient = createPublicClient({
  transport: http(process.env.RPC_URL || "https://rpc.testnet.chain.robinhood.com")
});

// Client 2: High-availability RPC configuration for Arbitrum Sepolia
// Uses official Omnia/Arbitrum Sepolia public RPC node instead of landing pages
export const arbitrumClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(process.env.ARBITRUM_RPC_URL || "https://omniatech.io")
});

const privateKey = process.env.OPERATOR_PRIVATE_KEY as `0x${string}`;
const account = privateKey ? privateKeyToAccount(privateKey) : undefined;

export const walletClient = createWalletClient({
  account,
  transport: http(
    process.env.RPC_URL || "https://rpc.testnet.chain.robinhood.com",
  ),
});

export const deployment = {
  aavePool: "0x6AE43d3271ff68408398a449C623CEFEf22D16a7",    
  usdcAddress: "0x75FAF114EafB1BDbe2F0316DF893fd58CE46AA4d", 
  simpleVault: process.env.SIMPLE_VAULT_ADDRESS || "0x11Ae2665f9d798648311a5260a00a8a106cdfEC1"
};

export const settings = {
  chainId: Number(process.env.CHAIN_ID) || 46630,
  dbPath: process.env.DB_PATH || "./data/snapshot.db"
};
