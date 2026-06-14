import { logger } from '../logger.js';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  eventType: string;
  data: Record<string, unknown>;
  txHash?: string;
}

/**
 * @dev Records immutable system audit records for agent action cycles.
 */
export async function logAuditEvent(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<string> {
  const fullEntry: AuditLogEntry = {
    id: `${entry.eventType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  
  // Safe, structured system logger output that integrates with your daemon stream
  logger.info({ auditRecord: fullEntry }, `[Audit Log] Context entry written successfully for type: ${entry.eventType}`);
  return fullEntry.id;
}
