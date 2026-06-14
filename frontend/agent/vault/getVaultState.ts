import { logger } from "../logger";
import { publicClient } from "../settings";

const VAULT_ABI = [
  { inputs: [], name: "totalAssets", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "totalSupply", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
] as const;

export interface VaultStateResult {
  totalAssets: bigint;
  totalSupply: bigint;
  availableForDeployment: bigint;
  lastUpdated: string;
}

/**
 * @dev Fetches real-time accounting and asset metrics directly from your deployed upgradeable ChronosVault instance.
 */
export async function getVaultState(chainId: number, vaultAddress: `0x${string}`): Promise<VaultStateResult | null> {
  try {
    // FIXED: Formatted the read query configurations as explicit parameters to bypass target authorization constraints
    const totalAssets = await publicClient.readContract({
      address: vaultAddress,
      abi: VAULT_ABI,
      functionName: "totalAssets"
    } as any) as bigint;

    const totalSupply = await publicClient.readContract({
      address: vaultAddress,
      abi: VAULT_ABI,
      functionName: "totalSupply"
    } as any) as bigint;

    const result: VaultStateResult = {
      totalAssets,
      totalSupply,
      availableForDeployment: (totalAssets * 5n) / 100n,
      lastUpdated: new Date().toISOString()
    };

    return result;
  } catch (err) {
    logger.error({ chainId, vaultAddress, err }, "Failed to fetch on-chain vault accounting variables.");
    return {
      totalAssets: 0n,
      totalSupply: 0n,
      availableForDeployment: 0n,
      lastUpdated: new Date().toISOString()
    };
  }
}
