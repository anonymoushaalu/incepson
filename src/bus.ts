import { EventEmitter } from "node:events";

export type BusEvent =
  | { type: "decision"; requestId: string; service: string; amountHbar: number; decision: string; code: string; explanation: string; txId?: string }
  | { type: "budget_reset" };

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

export function publish(event: BusEvent): void {
  emitter.emit("event", event);
}

export function subscribe(listener: (event: BusEvent) => void): () => void {
  emitter.on("event", listener);
  return () => emitter.off("event", listener);
}
