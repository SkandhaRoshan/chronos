import { logger } from "../logger.js";
import { deployment } from "../settings.js";
import type { RebalancePlan } from "../planner/index.js";

// Token tracking benchmarks scaled off standard oracle indices
const TOKEN_PRICES: Record<string, number> = {
  USDC: 1,
  USDT: 1,
  ETH: 3200,
};

export type Verdict = "AUTO_EXECUTE" | "NEEDS_APPROVAL" | "BLOCKED";

export interface RiskAssessment {
  planId: string;
  verdict: Verdict;
  reason: string;
  riskScore: number;
  realValue: number;
  autoApproveLimit: number;
  timestamp: string;
}

export interface UserProfile {
  autoApproveLimitUsd: number;
  knownAddresses: string[];
}

async function fetchUserProfile(chainId: number, userId: string): Promise<UserProfile> {
  const envLimit = process.env.AUTO_APPROVE_LIMIT_USD;
  return {
    autoApproveLimitUsd: envLimit ? parseInt(envLimit, 10) : 100,
    knownAddresses: [deployment.simpleVault.toLowerCase()],
  };
}

function computeRealValueUsd(plan: RebalancePlan): number {
  if (plan.totalEstimatedValueUsd > 0) return plan.totalEstimatedValueUsd;
  
  // High-reliability balance parsing loop aligned to your metrics step layouts
  if (!plan.steps || !Array.isArray(plan.steps)) return 0;
  
  return plan.steps.reduce((acc, step: any) => {
    const amount = step.amountUsd || step.amount || 0;
    const symbol = (step.tokenIn || "USDC").toUpperCase();
    const price = TOKEN_PRICES[symbol] || 1;
    return acc + (amount * price);
  }, 0);
}

export async function assessRisk(
  chainId: number,
  plan: RebalancePlan,
  userId: string
): Promise<RiskAssessment> {
  const profile = await fetchUserProfile(chainId, userId);
  const realValue = computeRealValueUsd(plan);
  
  let verdict: Verdict = "AUTO_EXECUTE";
  let reason = "";
  let riskScore = 0;

  if (!plan.id || !plan.steps) {
    return {
      planId: plan.id || "malformed",
      verdict: "BLOCKED",
      reason: "Plan payload structural validation failed.",
      riskScore: 100,
      realValue: 0,
      autoApproveLimit: profile.autoApproveLimitUsd,
      timestamp: new Date().toISOString()
    };
  }

  if (plan.steps.length === 0) {
    return {
      planId: plan.id,
      verdict: "AUTO_EXECUTE",
      reason: "No rebalance actions needed – plan contains empty step indices",
      riskScore: 0,
      realValue: 0,
      autoApproveLimit: profile.autoApproveLimitUsd,
      timestamp: new Date().toISOString()
    };
  }

  // Evaluate structural firewall limits against execution context value balances
  if (realValue > profile.autoApproveLimitUsd) {
    verdict = "NEEDS_APPROVAL";
    reason = `Transaction value $${realValue.toFixed(2)} exceeds firewall threshold limit $${profile.autoApproveLimitUsd}`;
    riskScore = Math.min(100, Math.floor((realValue / profile.autoApproveLimitUsd) * 50));
  } else {
    verdict = "AUTO_EXECUTE";
    reason = `Transaction value $${realValue.toFixed(2)} sits within firewall baseline limits.`;
    riskScore = Math.floor((realValue / profile.autoApproveLimitUsd) * 20);
  }

  logger.info({ planId: plan.id, verdict, realValue, limit: profile.autoApproveLimitUsd, reason }, "Gatekeeper risk profile firewall evaluation complete.");
  return {
    planId: plan.id,
    verdict,
    reason,
    riskScore,
    realValue,
    autoApproveLimit: profile.autoApproveLimitUsd,
    timestamp: new Date().toISOString(),
  };
}
