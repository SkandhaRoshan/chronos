import { call0GInference } from '../llm/ogClient.js';
import type { AgentDefinition, AgentOutput, SwarmState } from './types.js';
import { logger } from '../logger.js';

function extractJson(text: string): Record<string, unknown> {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try { return JSON.parse(match[0]); } catch { return {}; }
}

function clamp(n: number): number { return Math.min(1, Math.max(0, n)); }

/**
 * @dev Prompts individual specialized agent modules via decentralized 0G Compute network nodes.
 */
export async function runAgent(
  agent: AgentDefinition,
  state: SwarmState,
  followUpContext?: string,
  runId?: string
): Promise<AgentOutput> {
  const systemPrompt = `${agent.prompt} IMPORTANT: prediction output parameters must settle to a strict uppercase value matching exactly "YES", "NO", or "NEUTRAL". You MUST respond using raw valid JSON inside your response layout: {"prediction": "YES"|"NO"|"NEUTRAL", "confidence": 0.0-1.0, "reasoning": "..."}`;
  
  const priorContext = state.outputs && state.outputs.length > 0 
    ? `\n\nPrior workspace state execution histories:\n${JSON.stringify(state.outputs.map(o => ({ agentId: o.agentId, prediction: o.prediction })), null, 2)}` 
    : '';
    
  const userMessage = `Query: ${state.query}${priorContext}${followUpContext ? `\nSupervisor Context: ${followUpContext}` : ''}`;
  const fullPrompt = `${systemPrompt}\n\n${userMessage}`;

  logger.info(`[Swarm Integration] Running execution inference loop block for agent: ${agent.name}`);
  const raw = await call0GInference(fullPrompt, 0.2, 1024);
  
  const parsed = extractJson(raw);
  const prediction = typeof parsed.prediction === 'string' ? parsed.prediction.toUpperCase() : 'NEUTRAL';
  const confidence = typeof parsed.confidence === 'number' ? clamp(parsed.confidence) : 0.85;
  const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : raw.slice(0, 300);

  logger.info(`[Swarm Outcome] Agent [${agent.name}] completed run. Verdict: ${prediction} (${(confidence * 100).toFixed(0)}%)`);
  
  return {
    agentId: agent.id,
    agentName: agent.name,
    prediction,
    confidence,
    reasoning,
    data: parsed.data && typeof parsed.data === 'object' ? (parsed.data as Record<string, unknown>) : undefined,
    weight: agent.weight,
  };
}
