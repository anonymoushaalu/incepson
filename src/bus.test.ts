import { describe, it, expect, beforeEach } from "vitest";
import { publish, subscribe, eventsSince } from "./bus.js";

describe("bus: replay buffer", () => {
  it("assigns increasing ids and eventsSince returns only events after the given id", () => {
    publish({ type: "budget_reset" });
    publish({ type: "budget_reset" });
    const before = eventsSince(0);
    expect(before.length).toBeGreaterThanOrEqual(2);
    const lastId = before[before.length - 1].id;

    publish({ type: "budget_reset" });
    const after = eventsSince(lastId);
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe(lastId + 1);
  });

  it("returns an empty array when there is nothing newer than lastEventId", () => {
    publish({ type: "budget_reset" });
    const all = eventsSince(0);
    const latest = all[all.length - 1].id;
    expect(eventsSince(latest)).toEqual([]);
  });

  it("delivers id and event to subscribers", () => {
    const received: { id: number; type: string }[] = [];
    const unsubscribe = subscribe((id, event) => received.push({ id, type: event.type }));
    publish({ type: "intent_timeout", intentId: "abc" });
    unsubscribe();
    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("intent_timeout");
    expect(typeof received[0].id).toBe("number");
  });

  it("caps the replay buffer so memory doesn't grow unbounded", () => {
    // Publish well past REPLAY_BUFFER_SIZE (200) and confirm eventsSince(0)
    // never returns more than that many entries.
    for (let i = 0; i < 250; i++) publish({ type: "budget_reset" });
    const all = eventsSince(0);
    expect(all.length).toBeLessThanOrEqual(200);
  });
});
