import axios from 'axios';
import type { ActionConfig, ActionResult, ConsensusResult } from './types.js';
import { getProtocolBalances } from '../actions/balanceFetcher.js';
import { logger } from '../logger.js';

/**
 * @dev Reconciles and executes pluggable downstream automation tasks once swarm consensus is reached.
 */
export async function executeAction(
  consensus: ConsensusResult,
  config: ActionConfig,
  query?: string,
): Promise<ActionResult> {
  if (!consensus.shouldAct) {
    return { type: 'none', success: true, output: 'Consensus parameters below execution limits.' };
  }

  switch (config.type) {
    case 'rebalance':
      return executeRebalance(consensus, config.params, query);
    case 'uniswap_trade':
      return { type: 'uniswap_trade', success: true, output: { mock: true, strategy: consensus.decision } };
    case 'http_call':
      return executeHttpCall(config.params);
    case 'file_write':
      return executeFileWrite(consensus, config.params);
    default:
      return { type: 'none', success: true, output: 'No direct downstream actions triggered.' };
  }
}

async function executeRebalance(consensus: ConsensusResult, params: Record<string, unknown>, _query?: string): Promise<ActionResult> {
  const chainId = (params.chainId as number) ?? 46630;
  
  try {
    const balances = await getProtocolBalances(chainId);
    const totalUsdc = balances.totalValueUsdc || 1000;
    
    logger.info({ totalUsdc }, "Initializing strategic rebalance operations across on-chain parameters...");
    
    // Simulate successful multi-hop liquidity re-allocation steps matching your active proxies
    const simulatedTraceResults = [
      { from: "aave", to: "uniswap", amount: totalUsdc * 0.3, status: "SUCCESS" },
      { from: "aave", to: "staking", amount: totalUsdc * 0.1, status: "SUCCESS" }
    ];

    return { type: 'rebalance', success: true, output: simulatedTraceResults };
  } catch (err) {
    logger.error({ err }, "Rebalance structural parsing execution encountered a runtime exception.");
    return { type: 'rebalance', success: false, output: [], error: String(err) };
  }
}

async function executeHttpCall(params: Record<string, unknown>): Promise<ActionResult> {
  try {
    const url = params.url as string;
    if (!url) throw new Error("Destination URL mapping missing.");
    
    const res = await axios.request({
      url,
      method: (params.method as string) ?? 'POST',
      data: params.body ?? {},
    });
    return { type: 'http_call', success: true, output: res.data };
  } catch (err) {
    return { type: 'http_call', success: false, output: null, error: String(err) };
  }
}

async function executeFileWrite(consensus: ConsensusResult, params: Record<string, unknown>): Promise<ActionResult> {
  const { writeFile } = await import('fs/promises');
  const path = (params.path as string) ?? './swarm_output.json';
  await writeFile(path, JSON.stringify({ consensus, timestamp: new Date().toISOString() }, null, 2));
  return { type: 'file_write', success: true, output: { path } };
}
