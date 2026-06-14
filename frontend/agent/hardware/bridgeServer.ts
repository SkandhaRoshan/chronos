import { randomUUID } from 'crypto';
import readline from 'readline';
import { logger } from '../logger.js';

export interface ApprovalRequest {
  id: string;
  summary: string;
  details: any;
  tx: { to: string; value: string; data: string };
  timeoutMs?: number;
}

export interface ApprovalResult {
  id: string;
  approved: boolean;
  signature?: string;
  txHash?: string;
  error?: string;
}

/**
 * @title BridgeServer
 * @dev Simulates low-level transaction signing verification flows through a hardware console port link.
 */
export class BridgeServer {
  private async requestCliApproval(request: ApprovalRequest): Promise<ApprovalResult> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    
    console.log(`\n🔐 [HARDWARE SECURITY VERIFICATION REQUIRED]`);
    console.log(`   Instance ID : ${request.id}`);
    console.log(`   Summary     : ${request.summary}`);
    console.log(`   Telemetry   :`, JSON.stringify(request.details, null, 2).replace(/\n/g, '\n   '));

    const answer = await new Promise<string>((resolve) => {
      rl.question('\n👉 Confirm cryptographic signature on Ledger? (y/n): ', resolve);
    });
    
    rl.close();
    const approved = answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
    
    return {
      id: request.id,
      approved,
      signature: approved ? `0x${"f".repeat(130)}` : undefined,
      txHash: approved ? `0x${"a".repeat(64)}` : undefined,
    };
  }

  async requestApproval(request: Omit<ApprovalRequest, 'id'>): Promise<ApprovalResult> {
    const id = randomUUID();
    const fullRequest: ApprovalRequest = { ...request, id };
    return this.requestCliApproval(fullRequest);
  }
}
