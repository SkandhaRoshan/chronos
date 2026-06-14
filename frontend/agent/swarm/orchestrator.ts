import { randomUUID } from 'crypto';
import { StateGraph, END, START } from '@langchain/langgraph';
import type { SwarmState, AgentDefinition, ActionConfig } from './types.js';
import { runAgent } from './runner.js';
import { buildConsensus } from './consensus.js';
import { executeAction } from './actions.js';
import { logger } from '../logger.js';

// Fully specified channel schema definition mappings to comply with LangGraph parameters
const graphChannels = {
  query: { value: (x: string, y: string) => y ?? x, default: () => "" },
  agents: { value: (x: any[], y: any[]) => y ?? x, default: () => [] },
  outputs: { value: (x: any[], y: any[]) => x.concat(y), default: () => [] },
  consensusThreshold: { value: (x: number, y: number) => y ?? x, default: () => 0.6 },
  requireHumanApproval: { value: (x: boolean, y: boolean) => y ?? x, default: () => false },
  pendingApproval: { value: (x: boolean, y: boolean) => y ?? x, default: () => false },
  runId: { value: (x: string, y: string) => y ?? x, default: () => "" },
  storageUri: { value: (x: string | null, y: string | null) => y ?? x, default: () => null },
  consensus: { value: (x: any, y: any) => y ?? x, default: () => null },
  action: { value: (x: any, y: any) => y ?? x, default: () => null },
  _agentQueue: { value: (x: string[], y: string[]) => y ?? x, default: () => [] },
  _workflow: { value: (x: string, y: string) => y ?? x, default: () => "sequential" }
};

/**
 * @dev Constructs a structurally compliant multi-agent sequential execution pipeline state graph.
 */
export function buildSequentialGraph(actionConfig?: ActionConfig, apiBaseUrl?: string) {
  const effectiveAction: ActionConfig = actionConfig ?? { type: 'none', params: {} };

  const graph = new StateGraph<any>({ channels: graphChannels })
    .addNode('assign_run', async (state) => {
      return { runId: state.runId || randomUUID() };
    })
    .addNode('init', async (state) => {
      logger.info(`Starting sequential swarm loop — Processing query: "${state.query}"`);
      return { _agentQueue: state.agents.map((a: any) => a.id), _workflow: 'sequential' };
    })
    .addNode('run_agent', async (state: any) => {
      const nextId = state._agentQueue[0];
      const agent = state.agents.find((a: any) => a.id === nextId);
      if (!agent) throw new Error(`Target sub-agent reference ID ${nextId} missing from array configuration.`);
      
      const output = await runAgent(agent, state, undefined, state.runId);
      return { 
        outputs: [output], 
        _agentQueue: state._agentQueue.slice(1) 
      };
    })
    .addNode('aggregate', async (state) => {
      const consensus = buildConsensus(state.outputs, state.consensusThreshold ?? 0.6);
      return { consensus };
    })
    .addNode('persist_storage', async (state) => {
      return { storageUri: `0g://${state.runId}` };
    })
    .addNode('execute', async (state) => {
      if (!state.consensus) return {};
      const result = await executeAction(state.consensus, effectiveAction, state.query);
      return { action: result };
    })
    .addEdge(START, 'assign_run')
    .addEdge('assign_run', 'init')
    .addEdge('init', 'run_agent')
    .addConditionalEdges('run_agent', (state: any) => {
      return state._agentQueue.length > 0 ? 'run_agent' : 'aggregate';
    })
    .addEdge('aggregate', 'persist_storage')
    .addEdge('persist_storage', 'execute')
    .addEdge('execute', END);

  return graph.compile();
}

export function buildSupervisorGraph(actionConfig?: ActionConfig, apiBaseUrl?: string) {
  return buildSequentialGraph(actionConfig, apiBaseUrl);
}

export function buildRebalanceGraph() {
  return buildSequentialGraph();
}
