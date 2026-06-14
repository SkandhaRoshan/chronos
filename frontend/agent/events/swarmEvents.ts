import EventEmitter from "events";
export const swarmBus = new EventEmitter();
export type SwarmEvent = { type: string; runId: string; timestamp: string; data?: any };
