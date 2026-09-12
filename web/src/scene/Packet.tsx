import { useRef } from "react";
import { useFrame, invalidate } from "@react-three/fiber";
import type { Mesh, Vector3Tuple } from "three";

export interface PacketSpec {
  id: number;
  /** Ordered waypoints the packet travels. For a DENY, the last waypoint is
   *  the midpoint of the policy->deny edge, not the deny node itself -- the
   *  packet visibly stops short of the wall rather than reaching it. */
  path: Vector3Tuple[];
  color: string;
  /** Seconds to traverse the whole path. */
  duration: number;
  onArrive: (id: number) => void;
}

const SPEED_EASE = (t: number) => t * t * (3 - 2 * t); // smoothstep, no extra dep

/** A single travelling payment. Removes itself via onArrive once it reaches
 *  the end of its path -- FlowScene owns the list and drops it on that
 *  callback, so there is no unbounded packet accumulation. */
export function Packet({ spec }: { spec: PacketSpec }) {
  const meshRef = useRef<Mesh>(null);
  const elapsed = useRef(0);
  const arrivedRef = useRef(false);

  useFrame((_, delta) => {
    if (!meshRef.current || arrivedRef.current) return;
    elapsed.current += delta;
    const t = Math.min(1, elapsed.current / spec.duration);
    const eased = SPEED_EASE(t);

    const segments = spec.path.length - 1;
    const segmentT = eased * segments;
    const segmentIndex = Math.min(segments - 1, Math.floor(segmentT));
    const localT = segmentT - segmentIndex;

    const from = spec.path[segmentIndex];
    const to = spec.path[segmentIndex + 1];
    meshRef.current.position.set(
      from[0] + (to[0] - from[0]) * localT,
      from[1] + (to[1] - from[1]) * localT,
      from[2] + (to[2] - from[2]) * localT
    );

    if (t >= 1) {
      arrivedRef.current = true;
      spec.onArrive(spec.id);
    } else {
      // frameloop="demand" only renders when invalidated; a moving packet
      // must re-request the next frame itself, every frame, until arrival.
      invalidate();
    }
  });

  return (
    <mesh ref={meshRef} position={spec.path[0]}>
      <sphereGeometry args={[0.12, 12, 12]} />
      <meshStandardMaterial color={spec.color} emissive={spec.color} emissiveIntensity={1} toneMapped={false} />
    </mesh>
  );
}
