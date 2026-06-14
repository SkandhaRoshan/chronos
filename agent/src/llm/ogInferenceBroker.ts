import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from '@0gfoundation/0g-compute-ts-sdk';
import { logger } from '../logger.js';

let brokerCache: any = null;

export function usesStaticApiKey(): boolean {
  return !!process.env.OG_COMPUTE_API_KEY;
}

export function getWalletPrivateKeyForCompute(): string | undefined {
  return process.env.OPERATOR_PRIVATE_KEY || process.env.OG_COMPUTE_WALLET_PRIVATE_KEY || process.env.WALLET_PRIVATE_KEY;
}

/**
 * @dev High-fidelity, consolidated 0G Compute Broker connection initializer.
 * Resolves proper RPC path configuration layers to satisfy type checks.
 */
export async function getComputeBroker() {
  if (brokerCache) return brokerCache;

  if (usesStaticApiKey()) {
    brokerCache = {
      inference: {
        getRequestHeaders: async () => ({}),
        processResponse: async () => true,
        getServiceMetadata: async () => ({
          endpoint: process.env.OG_COMPUTE_BASE_URL || "https://router-api.0g.ai/v1",
          model: process.env.OG_COMPUTE_MODEL_AGENTS || "zai-org/GLM-5-FP8",
        }),
      },
    };
    return brokerCache;
  }

  const pk = getWalletPrivateKeyForCompute();
  if (!pk) throw new Error("OPERATOR_PRIVATE_KEY missing from configuration environment profile.");

  const network = process.env.OG_NETWORK || 'testnet';
  const rpcUrl = network === 'mainnet'
    ? 'https://evmrpc.0g.ai'
    : 'https://evmrpc-testnet.0g.ai';

  logger.info({ network, rpcUrl }, "[0G Infrastructure] Initiating decentralized channel client broker connection...");

  const ogProvider = new ethers.JsonRpcProvider(rpcUrl);
  const ogWallet = new ethers.Wallet(pk, ogProvider);
  
  brokerCache = await createZGComputeNetworkBroker(ogWallet);
  logger.info("[0G Infrastructure] On-chain compute broker client successfully initialized.");
  return brokerCache;
}

export function resetComputeBrokerCache() {
  brokerCache = null;
}
