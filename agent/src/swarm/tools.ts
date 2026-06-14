import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getProtocolAdapter } from "../adapters/index.js";

export const fetchApyTool = tool(
  async ({ protocol, chainId }) => {
    try {
      const adapter = getProtocolAdapter(protocol, chainId);
      let apy = 0;
      if (protocol === "aave") apy = await (adapter as any).getApy();
      if (protocol === "staking") apy = await (adapter as any).getApy();
      return JSON.stringify({ protocol, apy });
    } catch (e) {
      return JSON.stringify({ protocol, apy: 0, error: String(e) });
    }
  },
  {
    name: "fetch_apy",
    description: "Fetch current APY for a protocol",
    schema: z.object({ protocol: z.enum(["aave", "uniswap", "staking"]), chainId: z.number().default(17000) }),
  }
);

export const computeVolatilityTool = tool(
  async ({ protocol, chainId, hours }) => {
    // Simplified: return mock volatility
    const volatility = Math.random() * 0.05;
    return JSON.stringify({ protocol, hours, volatility });
  },
  {
    name: "compute_volatility",
    description: "Compute APY volatility",
    schema: z.object({ protocol: z.enum(["aave", "uniswap", "staking"]), chainId: z.number().default(17000), hours: z.number().default(24) }),
  }
);

export const TOOL_REGISTRY = {
  fetch_apy: fetchApyTool,
  compute_volatility: computeVolatilityTool,
};
