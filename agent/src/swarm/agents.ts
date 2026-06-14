import type { AgentDefinition } from './types.js';

export const SCOUT_AGENT: AgentDefinition = {
  id: 'scout',
  name: 'Scout',
  role: 'data_fetcher',
  weight: 0.3,
  prompt: 'Fetch APYs for Aave, Uniswap, Staking. Return YES if significant differential exists.',
  tools: ['fetch_apy'],
};

export const RISK_AGENT: AgentDefinition = {
  id: 'risk',
  name: 'Risk Analyst',
  role: 'risk_evaluator',
  weight: 0.2,
  prompt: 'Assess volatility and risk. Return YES if risk is acceptable, NO if too high.',
  tools: ['compute_volatility'],
};

export const STRATEGIST_AGENT: AgentDefinition = {
  id: 'strategist',
  name: 'Strategist',
  role: 'allocator',
  weight: 0.5,
  prompt: 'Propose allocation percentages. Return YES with data field containing allocation.',
  tools: ['fetch_apy', 'compute_volatility'],
};

export const EXECUTOR_AGENT: AgentDefinition = {
  id: 'executor',
  name: 'Executor',
  role: 'action_planner',
  weight: 0.4,
  prompt: 'Plan rebalancing steps. Return YES if drift >5%, otherwise NO.',
  tools: [],
};

export const ALL_AGENTS = [SCOUT_AGENT, RISK_AGENT, STRATEGIST_AGENT, EXECUTOR_AGENT];
