import { Line } from "@react-three/drei";
import { EDGES, NODE_MAP } from "./layout.js";

const BRANCH_COLOR: Record<string, string> = {
  ALLOW: "#10b981",
  ESCALATE: "#f59e0b",
  DENY: "#ef4444",
};

/** Static edges of the enforcement graph. Colour signals the branch a
 *  packet travelling that edge belongs to; unbranded edges (agent->signals,
 *  signals->policy) are neutral. */
export function FlowEdges() {
  return (
    <>
      {EDGES.map((edge) => {
        const from = NODE_MAP[edge.from];
        const to = NODE_MAP[edge.to];
        const color = edge.branch ? BRANCH_COLOR[edge.branch] : "#475569";
        return (
          <Line
            key={`${edge.from}-${edge.to}`}
            points={[from.position, to.position]}
            color={color}
            lineWidth={1.5}
            transparent
            opacity={0.6}
          />
        );
      })}
    </>
  );
}
