import { EventEmitter } from "node:events";
import type { IntentRow } from "./intents/index.js";

export type BusEvent =
  | { type: "decision"; requestId: string; service: string; amountHbar: number; decision: string; code: string; explanation: string; txId?: string }
  | { type: "budget_reset" }
  | { type: "intent_pending"; intent: IntentRow }
  | { type: "intent_timeout"; intentId: string }
  | { type: "intent_resolved"; intentId: string; approved: boolean };

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

export function publish(event: BusEvent): void {
  emitter.emit("event", event);
}

export function subscribe(listener: (event: BusEvent) => void): () => void {
  emitter.on("event", listener);
  return () => emitter.off("event", listener);
}
