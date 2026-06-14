import "dotenv/config";
import { logger } from "./logger.js";
import { closeDatabase, initializeDatabase, insertProtocolSnapshot } from "./store.js";
import { settings } from "./settings.js";
import { randomUUID } from 'crypto';
import { collectProtocolData } from "./protocols/fetcher.js";
import { runAgent } from "./swarm/runner.js";
import { ALL_AGENTS } from "./swarm/agents.js";
import { buildConsensus } from "./swarm/consensus.js";
import { autoExecute, requestHardwareApproval } from "./executor/planExecutor.js";
import { BridgeServer } from "./hardware/bridgeServer.js";

class ChronosAgent {
  private statsInterval: NodeJS.Timeout | null = null;
  private isActive = false;
  private actionLoopBusy = false;
  private bridgeServer: BridgeServer;

  constructor() {
    this.bridgeServer = new BridgeServer(); 
  }

  async runStatsCycle(): Promise<void> {
    if (!this.isActive) return;
    try {
      logger.info("Starting stats collection cycle");
      const data = await collectProtocolData(settings.chainId);
      insertProtocolSnapshot(data);
      logger.info(`APYs: Aave=${data.aaveApy}%, Uniswap=${data.uniswapApy}%, Staking=${data.stakingApy}%`);
    } catch (err) {
      logger.error({ err }, "Stats cycle failed");
    }
  }

  private async runActionCycle(): Promise<void> {
    if (this.actionLoopBusy) return;
    this.actionLoopBusy = true;
    try {
      logger.info("Running action cycle – executing decentralized multi-agent swarm orchestration via 0G Compute Network");
      const currentAPYs = await collectProtocolData(settings.chainId);
      const query = `Current APYs: Aave=${currentAPYs.aaveApy}%, Uniswap=${currentAPYs.uniswapApy}%, Staking=${currentAPYs.stakingApy}%. Recommend rebalancing allocation.`;

      const outputs = [];
      for (const agent of ALL_AGENTS) {
        const state = { query, agents: ALL_AGENTS, outputs, consensusThreshold: 0.7 };
        const output = await runAgent(agent, state, undefined, randomUUID());
        outputs.push(output);
      }

      const consensus = buildConsensus(outputs, 0.7);
      logger.info(`Consensus: ${consensus.decision} with ${(consensus.confidence*100).toFixed(1)}% confidence, shouldAct=${consensus.shouldAct}`);

      if (!consensus.shouldAct) {
        logger.info("No rebalance needed.");
        return;
      }

      const strategistOut = outputs.find(o => o.agentId === 'strategist');
      const allocation = strategistOut?.data?.allocation || { aave: 30, uniswap: 50, staking: 20 };
      const totalValue = 500;
      
      const plan = {
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        intent: `Rebalance to ${JSON.stringify(allocation)}`,
        totalEstimatedValueUsd: totalValue,
        steps: [{ fromProtocol: 'aave' as const, toProtocol: 'uniswap' as const, amountUsd: totalValue * 0.2, tokenIn: 'USDC', tokenOut: 'ETH' }],
        confidence: consensus.confidence,
        reasoning: outputs.map(o => o.reasoning).join('\n'),
        requiresApproval: true,
      };

      const autoLimit = parseInt(process.env.AUTO_APPROVE_LIMIT_USD || '100', 10);
      const gate = plan.totalEstimatedValueUsd > autoLimit
        ? { verdict: 'NEEDS_APPROVAL' as const, reason: `Value $${plan.totalEstimatedValueUsd} > limit $${autoLimit}` }
        : { verdict: 'AUTO_EXECUTE' as const, reason: `Value within limit` };
      logger.info(`Gatekeeper: ${gate.verdict} – ${gate.reason}`);

      // FIXED: Injected mandatory "planId: plan.id" into both context assessment blocks
      if (gate.verdict === 'AUTO_EXECUTE') {
        const assessment = { planId: plan.id, verdict: 'AUTO_EXECUTE' as const, reason: gate.reason, riskScore: 0, realValue: plan.totalEstimatedValueUsd, autoApproveLimit: autoLimit, timestamp: new Date().toISOString() };
        const result = await autoExecute(settings.chainId, plan, assessment);
        if (result.success) logger.info(`✅ Auto-executed rebalance. TxHashes: ${result.txHashes.join(', ')}`);
        else logger.error(`Auto-execution failed: ${result.error}`);
      } else if (gate.verdict === 'NEEDS_APPROVAL') {
        const assessment = { planId: plan.id, verdict: 'NEEDS_APPROVAL' as const, reason: gate.reason, riskScore: 0, realValue: plan.totalEstimatedValueUsd, autoApproveLimit: autoLimit, timestamp: new Date().toISOString() };
        const result = await requestHardwareApproval(settings.chainId, plan, assessment, this.bridgeServer);
        if (result.success) logger.info(`✅ Hardware approval received. Rebalance executed. TxHashes: ${result.txHashes.join(', ')}`);
        else logger.error(`Hardware approval failed: ${result.error}`);
      }
    } catch (err) {
      logger.error({ err }, "Action cycle error");
    } finally {
      this.actionLoopBusy = false;
      if (this.isActive) setTimeout(() => this.runActionCycle(), 300000);
    }
  }

  start(): void {
    initializeDatabase(settings.dbPath);
    if (this.isActive || this.statsInterval) {
      logger.info("Agent already running");
      return;
    }
    this.isActive = true;
    this.runStatsCycle();
    this.statsInterval = setInterval(() => this.runStatsCycle(), 30000);
    this.runActionCycle();
    logger.info("Chronos agent started");
  }

  stop(): void {
    if (!this.isActive && !this.statsInterval) return;
    this.isActive = false;
    if (this.statsInterval) clearInterval(this.statsInterval);
    closeDatabase();
    logger.info("Chronos agent stopped");
  }
}

export const chronosAgent = new ChronosAgent();
