import { logger } from '../logger.js';

let simulatedMode = true;
let simulatedSessionId: string | null = null;

export function initDMK(): any {
  logger.info('[Ledger] Simulated mode enabled');
  return {};
}

export function getDMK(): any {
  return {};
}

export function discoverDevices(onDevice: (d: any) => void, onError?: (e: Error) => void): void {
  if (simulatedMode) {
    onDevice({ id: 'sim', deviceModel: { productName: 'Simulated Ledger' } });
  }
}

export function stopDiscovering(): void {}

export async function connectDevice(deviceId: string): Promise<string> {
  simulatedSessionId = `sim-${Date.now()}`;
  logger.info(`[Ledger] Simulated connection: ${simulatedSessionId}`);
  return simulatedSessionId;
}

export function getActiveSession(): string | null {
  return simulatedSessionId;
}

export async function openApp(appName: string = 'Ethereum', sessionId?: string, onStatus?: (s: string) => void): Promise<void> {
  onStatus?.(`Simulated: opening ${appName}`);
  logger.info(`[Ledger] Simulated open app: ${appName}`);
}

export async function signTransaction(params: { tx: { to: string; value: string; data: string }; sessionId?: string }): Promise<{ signature: string; txHash: string }> {
  logger.info(`[Ledger] Simulated signing transaction: to=${params.tx.to} value=${params.tx.value}`);
  return { signature: '0x' + 'f'.repeat(130), txHash: '0x' + 'a'.repeat(64) };
}

export async function disconnectDevice(): Promise<void> {
  simulatedSessionId = null;
}

export function isSimulatedMode(): boolean {
  return simulatedMode;
}
