import "dotenv/config";
import { chronosAgent } from "./orchestrator.js";

console.log("Starting Chronos agent...");
chronosAgent.start();
console.log("Agent started. Press Ctrl+C to stop.");
