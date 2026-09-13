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

// Bounded replay buffer so a reconnecting SSE client (Last-Event-ID) doesn't
// silently miss a decision that happened during the gap -- a demo-scale
// session emits at most a few dozen events; 200 is generous headroom, not a
// real memory concern.
const REPLAY_BUFFER_SIZE = 200;
let nextEventId = 1;
const replayBuffer: { id: number; event: BusEvent }[] = [];

export function publish(event: BusEvent): void {
  const id = nextEventId++;
  replayBuffer.push({ id, event });
  if (replayBuffer.length > REPLAY_BUFFER_SIZE) replayBuffer.shift();
  emitter.emit("event", { id, event });
}

export function subscribe(listener: (id: number, event: BusEvent) => void): () => void {
  const handler = (payload: { id: number; event: BusEvent }) => listener(payload.id, payload.event);
  emitter.on("event", handler);
  return () => emitter.off("event", handler);
}

/** Events strictly after lastEventId, in order. Used to replay a gap on SSE
 *  reconnect; returns everything still buffered if lastEventId predates the
 *  buffer's oldest entry (the client will also get a fresh /api/state
 *  snapshot on connect, so a full-history gap is not a correctness issue,
 *  just a slightly less seamless resume). */
export function eventsSince(lastEventId: number): { id: number; event: BusEvent }[] {
  return replayBuffer.filter((e) => e.id > lastEventId);
}
