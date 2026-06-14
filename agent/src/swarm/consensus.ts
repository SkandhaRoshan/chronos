import type { AgentOutput, ConsensusResult } from './types.js';

export function buildConsensus(outputs: AgentOutput[], threshold = 0.6): ConsensusResult {
  let weightedSum = 0;
  let totalWeight = 0;
  const breakdown = [];

  for (const out of outputs) {
    const weight = out.weight ?? 1.0;
    let directedScore = 0;
    const pred = out.prediction.toUpperCase();
    if (pred === 'YES') directedScore = out.confidence;
    else if (pred === 'NO') directedScore = -out.confidence;
    const weightedScore = weight * directedScore;
    weightedSum += weightedScore;
    totalWeight += weight;
    breakdown.push({ agentId: out.agentId, vote: out.prediction, weight, weightedScore });
  }

  const normalised = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const confidence = Math.abs(normalised);
  const decision = normalised > 0.05 ? 'YES' : normalised < -0.05 ? 'NO' : 'NEUTRAL';

  return { decision, confidence, breakdown, threshold, shouldAct: confidence >= threshold && decision !== 'NEUTRAL' };
}
