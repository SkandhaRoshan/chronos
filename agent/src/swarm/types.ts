export interface AgentDefinition {
  id: string;
  name: string;
  role: string;
  prompt: string;
  tools?: string[];
  weight?: number;
  metadata?: Record<string, unknown>;
}

export interface AgentOutput {
  agentId: string;
  agentName: string;
  prediction: string;
  confidence: number;
  reasoning: string;
  data?: Record<string, unknown>;
  weight?: number;
}

export interface SwarmState {
  query: string;
  context?: Record<string, unknown>;
  agents: AgentDefinition[];
  outputs: AgentOutput[];
  consensus?: any;
  action?: any;
  error?: string;
  runId?: string;
  consensusThreshold?: number;
  requireHumanApproval?: boolean;
  pendingApproval?: boolean;
  storageUri?: string | null;
  telegramChatId?: number;
  _agentQueue?: string[];
  _workflow?: 'sequential' | 'supervisor';
  _supervisorFollowUp?: Record<string, string>;
  _supervisorRound?: number;
  supervisorMaxRounds?: number;
}

export interface ConsensusResult {
  decision: string;
  confidence: number;
  breakdown: any[];
  threshold: number;
  shouldAct: boolean;
}
export interface ActionConfig { type: string; params: Record<string, unknown>; }
export interface ActionResult { error?: string;  type: string; success: boolean; output: unknown; }
export interface PendingRunPayload { consensus: any; action: ActionConfig; query: string; createdAt: string; }
export interface TaskInfo<T> {
  id: string;
  definitionName: string;
  status: string;
  taskData: T;
  startedAt: number;
  lastUpdatedAt: number;
  finishedAt: number | null;
  statusMessage: string;
  resourcesTaken: string[];
}
export type TaskInfoUnknown = TaskInfo<unknown>;
export interface SwarmArtifact {
  query: string;
  outputs: any[];
  consensus?: any;
  runId?: string;
  timestamp: string;
}
export interface SupervisorRoutingDecision {
  action: 'dispatch' | 'redispatch' | 'done';
  agentId: string | null;
  followUpContext: string | null;
  reasoning: string;
}
export interface SupervisorSynthesisDecision {
  decision: string;
  confidence: number;
  shouldAct: boolean;
  reasoning: string;
  agentSummaries: any[];
  gaps: string | null;
}
export interface SupervisorAgentSummary {
  agentId: string;
  agentName: string;
  assessment: string;
  weight: number;
}
