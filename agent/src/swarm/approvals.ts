import type { ConsensusResult, ActionConfig, PendingRunPayload } from './types.js';
import { logger } from '../logger.js';

const pendingStore = new Map<string, PendingRunPayload>();

export function registerPending(runId: string, payload: PendingRunPayload): void {
  pendingStore.set(runId, payload);
  logger.info({ runId, decision: payload.consensus.decision, confidence: payload.consensus.confidence }, 'Successfully cached pending validation run inside context database maps.');
}

export function takePending(runId: string): PendingRunPayload | undefined {
  const payload = pendingStore.get(runId);
  if (payload) pendingStore.delete(runId);
  return payload;
}

export async function sendApprovalSuggestion(params: {
  runId: string;
  query: string;
  consensus: ConsensusResult;
  action: ActionConfig;
  apiBaseUrl: string;
}): Promise<void> {
  logger.info({
    runId: params.runId,
    decision: params.consensus.decision,
    confidence: `${(params.consensus.confidence * 100).toFixed(0)}%`,
    action: params.action.type,
    endpoint: `${params.apiBaseUrl}/runs/${params.runId}/approve`
  }, "🔐 [HARDWARE RUN APPROVAL SEQUENCE PROMPTED BY FIREWALL]");
}
