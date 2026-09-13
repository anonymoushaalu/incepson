import { useEffect, useState } from "react";
import { invalidate } from "@react-three/fiber";
import type { Vector3Tuple } from "three";
import { useAgentPayStore } from "../store/useAgentPayStore.js";
import { NODE_MAP } from "./layout.js";
import type { PacketSpec } from "./Packet.js";

const BRANCH_COLOR: Record<string, string> = {
  ALLOW: "#10b981",
  ESCALATE: "#f59e0b",
  DENY: "#ef4444",
};

let nextPacketId = 0;
// Module-level, not a ref: React 19 StrictMode (dev only) mounts this
// component twice in a row, which resets any per-instance ref back to its
// initial value on the second mount. A per-instance "already handled" guard
// therefore does not survive the remount, and BOTH mounts' effects see the
// same decisionSeq as new -- spawning two Packet instances sharing one id,
// each independently animating and calling onArrive, with the second
// filter() operating on a scene that already lost track of the first
// packet's removal. Module scope survives the remount and closes this.
let lastHandledSeqGlobal = 0;

/** Turns real decision SSE events into packet specs. This is the seam
 *  between the data store (useAgentPayStore) and the scene: the only place
 *  a decision event is translated into a three.js path. */
export function useFlowEvents() {
  const decisionSeq = useAgentPayStore((s) => s.decisionSeq);
  const lastDecision = useAgentPayStore((s) => s.lastDecision);
  const [packets, setPackets] = useState<PacketSpec[]>([]);

  useEffect(() => {
    if (decisionSeq === 0 || decisionSeq === lastHandledSeqGlobal || !lastDecision) return;
    lastHandledSeqGlobal = decisionSeq;

    const decision = lastDecision.decision as "ALLOW" | "ESCALATE" | "DENY";
    const agent = NODE_MAP.agent.position;
    const signals = NODE_MAP.signals.position;
    const policy = NODE_MAP.policy.position;

    let path: Vector3Tuple[];
    if (decision === "DENY") {
      // Stops at the midpoint of policy->deny, not the deny node itself --
      // the wall is visual, not a location the packet is allowed to reach.
      const deny = NODE_MAP.deny.position;
      const midpoint: Vector3Tuple = [
        (policy[0] + deny[0]) / 2,
        (policy[1] + deny[1]) / 2,
        (policy[2] + deny[2]) / 2,
      ];
      path = [agent, signals, policy, midpoint];
    } else if (decision === "ALLOW") {
      const allow = NODE_MAP.allow.position;
      const hedera = NODE_MAP.hedera.position;
      path = [agent, signals, policy, allow, hedera];
    } else {
      const escalate = NODE_MAP.escalate.position;
      const device = NODE_MAP.device.position;
      path = [agent, signals, policy, escalate, device];
    }

    const id = nextPacketId++;
    setPackets((prev) => [
      ...prev,
      {
        id,
        path,
        color: BRANCH_COLOR[decision] ?? "#94a3b8",
        duration: decision === "DENY" ? 1.1 : 1.8,
        amountHbar: lastDecision.amountHbar,
        onArrive: (arrivedId) => {
          setPackets((p) => p.filter((packet) => packet.id !== arrivedId));
          // Deferred one frame: called from inside Packet's useFrame, so
          // React hasn't committed the removal yet in this exact callstack.
          requestAnimationFrame(() => invalidate());
        },
      },
    ]);
    invalidate();
  }, [decisionSeq, lastDecision]);

  return packets;
}
