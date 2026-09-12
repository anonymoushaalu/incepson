import type { FlowNodeId } from "../store/useSceneStore.js";

export interface NodeLayout {
  id: FlowNodeId;
  label: string;
  position: [number, number, number];
  color: string;
  description: string;
  ownerModule: string;
}

// Hand-placed layout for the enforcement graph:
//   AGENT -> SIGNALS -> POLICY -> { ALLOW -> HEDERA, ESCALATE -> DEVICE, DENY }
// x grows left->right along the decision flow, y separates the three
// outcome branches, z stays 0 (a flat graph reads better under OrbitControls
// than a needlessly 3D one for a first-time viewer).
export const NODES: NodeLayout[] = [
  {
    id: "agent",
    label: "AGENT",
    position: [-6, 0, 0],
    color: "#94a3b8",
    description: "The LLM tool-calling loop. One tool: request_payment(service, amount, reason). No knowledge of Hedera or x402.",
    ownerModule: "src/agent/index.ts",
  },
  {
    id: "signals",
    label: "SIGNALS",
    position: [-3, 0, 0],
    color: "#94a3b8",
    description: "Deterministic checks on the raw merchant response and the requested amount. No language model.",
    ownerModule: "src/signals/index.ts",
  },
  {
    id: "policy",
    label: "POLICY ENGINE",
    position: [0, 0, 0],
    color: "#94a3b8",
    description: "Pure function. No I/O, no clock reads, no LLM. Hard denials are checked before escalation signals.",
    ownerModule: "src/policy/engine.ts",
  },
  {
    id: "allow",
    label: "ALLOW",
    position: [3, 2.2, 0],
    color: "#10b981",
    description: "In-budget, allowlisted, not anomalous. Settles autonomously.",
    ownerModule: "src/broker/index.ts",
  },
  {
    id: "escalate",
    label: "ESCALATE",
    position: [3, 0, 0],
    color: "#f59e0b",
    description: "Legal but worth a human's attention. Waits for a physical button press.",
    ownerModule: "src/intents/index.ts",
  },
  {
    id: "deny",
    label: "DENY",
    position: [3, -2.2, 0],
    color: "#ef4444",
    description: "Breaches a hard limit. Refused unconditionally, no appeal, zero network activity.",
    ownerModule: "src/broker/index.ts",
  },
  {
    id: "hedera",
    label: "HEDERA",
    position: [6.5, 2.2, 0],
    color: "#a78bfa",
    description: "Settlement over x402, via the public x402.org facilitator, on Hedera testnet.",
    ownerModule: "src/payments/x402.ts",
  },
  {
    id: "device",
    label: "ESP32",
    position: [6.5, 0, 0],
    color: "#f59e0b",
    description: "OLED + button. Holds no key material. Verifies the HMAC locally before arming.",
    ownerModule: "firmware/agentpay_device",
  },
];

export const NODE_MAP: Record<FlowNodeId, NodeLayout> = Object.fromEntries(
  NODES.map((n) => [n.id, n])
) as Record<FlowNodeId, NodeLayout>;

export interface EdgeLayout {
  from: FlowNodeId;
  to: FlowNodeId;
  /** Which decision this edge represents, if any -- used to color the edge
   *  and to know which edge a spawned packet should travel. */
  branch?: "ALLOW" | "ESCALATE" | "DENY";
}

export const EDGES: EdgeLayout[] = [
  { from: "agent", to: "signals" },
  { from: "signals", to: "policy" },
  { from: "policy", to: "allow", branch: "ALLOW" },
  { from: "policy", to: "escalate", branch: "ESCALATE" },
  { from: "policy", to: "deny", branch: "DENY" },
  { from: "allow", to: "hedera", branch: "ALLOW" },
  { from: "escalate", to: "device", branch: "ESCALATE" },
];
