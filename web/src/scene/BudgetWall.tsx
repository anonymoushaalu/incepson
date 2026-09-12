import { useRef } from "react";
import { useFrame, invalidate } from "@react-three/fiber";
import { damp } from "maath/easing";
import type { Mesh } from "three";
import { NODE_MAP } from "./layout.js";
import { useAgentPayStore } from "../store/useAgentPayStore.js";

const MAX_HEIGHT = 2.0;
const WALL_X = (NODE_MAP.policy.position[0] + NODE_MAP.deny.position[0]) / 2;
// Wall grows UP from this floor, not outward from a center pivot: position.y
// is recomputed from the current scale every frame so the base stays fixed.
const WALL_FLOOR_Y = NODE_MAP.deny.position[1] - 1.3;

/**
 * A literal wall on the policy->deny edge whose height tracks
 * spentWindowHbar / daily_budget_hbar. When the drip attack fills the
 * budget, this visibly grows -- the aggregate limit made physical, not just
 * a number in a panel.
 */
export function BudgetWall() {
  const meshRef = useRef<Mesh>(null);
  const snapshot = useAgentPayStore((s) => s.snapshot);

  const fraction = snapshot ? Math.min(1, snapshot.spentWindowHbar / snapshot.policy.daily_budget_hbar) : 0;
  const targetScaleY = 0.05 + fraction * 0.95;

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const before = meshRef.current.scale.y;
    const stillMoving = damp(meshRef.current.scale, "y", targetScaleY, 0.4, delta);
    meshRef.current.position.y = WALL_FLOOR_Y + (meshRef.current.scale.y * MAX_HEIGHT) / 2;
    if (stillMoving || Math.abs(before - meshRef.current.scale.y) > 1e-4) invalidate();
  });

  return (
    <mesh ref={meshRef} position={[WALL_X, WALL_FLOOR_Y, 0]} scale={[1, 0.05, 1]}>
      <boxGeometry args={[0.15, MAX_HEIGHT, 1.2]} />
      <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.3} transparent opacity={0.7} />
    </mesh>
  );
}
