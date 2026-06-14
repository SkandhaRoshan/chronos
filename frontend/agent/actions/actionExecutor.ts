import { getProtocolAdapter } from "../adapters/index.js";
import { logger } from "../logger.js";

export interface ProtocolAction {
  protocol: "aave" | "uniswap" | "staking";
  chainId: number;
  type: "deposit" | "withdraw";
  amount: bigint;
}

export interface ExecutionResult {
  success: boolean;
  action: ProtocolAction;
  txHash?: string;
  error?: string;
}

const inFlightActions = new Set<string>();

function generateActionId(action: ProtocolAction): string {
  return `${action.chainId}-${action.protocol}-${action.type}-${action.amount.toString()}`;
}

/**
 * @dev Validates and routes financial transaction steps to the respective protocol adapter.
 */
export async function executeAction(action: ProtocolAction): Promise<ExecutionResult> {
  const actionId = generateActionId(action);
  
  if (inFlightActions.has(actionId)) {
    logger.warn({ actionId }, "Execution block: Transaction execution instance already in-flight.");
    return { success: false, action, error: "Action target instance in-flight" };
  }
  
  inFlightActions.add(actionId);

  try {
    const adapter = getProtocolAdapter(action.protocol, action.chainId) as any;
    let txHash: string = "0x";
    
    // Explicitly check method configurations or leverage standard fallback bindings
    if (action.type === "deposit") {
      if (typeof adapter.deposit === 'function') {
        txHash = await adapter.deposit(action.amount);
      } else if (typeof adapter.stake === 'function') {
        txHash = await adapter.stake(action.amount);
      }
    } else if (action.type === "withdraw") {
      if (typeof adapter.withdraw === 'function') {
        txHash = await adapter.withdraw(action.amount);
      } else if (typeof adapter.unstake === 'function') {
        txHash = await adapter.unstake(action.amount);
      }
    }
    
    logger.info({ action, txHash }, "Transaction routing transaction step executed successfully.");
    return { success: true, action, txHash };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error({ action, error }, "Automated transaction allocation instance failed execution.");
    return { success: false, action, error };
  } finally {
    inFlightActions.delete(actionId);
  }
}

export async function executeBatch(actions: ProtocolAction[]): Promise<ExecutionResult[]> {
  const results: ExecutionResult[] = [];
  for (const action of actions) {
    results.push(await executeAction(action));
  }
  return results;
}
