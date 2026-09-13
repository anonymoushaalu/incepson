import { useRef } from "react";
import { useFrame, invalidate } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import type { Group, Mesh, Vector3Tuple } from "three";

export interface PacketSpec {
  id: number;
  /** Ordered waypoints the packet travels. For a DENY, the last waypoint is
   *  the midpoint of the policy->deny edge, not the deny node itself -- the
   *  packet visibly stops short of the wall rather than reaching it. */
  path: Vector3Tuple[];
  color: string;
  /** Seconds to traverse the whole path. */
  duration: number;
  /** HBAR amount this packet represents, shown as a floating label so a
   *  travelling decision reads as real money moving, not an anonymous dot. */
  amountHbar: number;
  onArrive: (id: number) => void;
}

const SPEED_EASE = (t: number) => t * t * (3 - 2 * t); // smoothstep, no extra dep

/** A single travelling payment. Removes itself via onArrive once it reaches
 *  the end of its path -- FlowScene owns the list and drops it on that
 *  callback, so there is no unbounded packet accumulation. */
export function Packet({ spec }: { spec: PacketSpec }) {
  const groupRef = useRef<Group>(null);
  const meshRef = useRef<Mesh>(null);
  const elapsed = useRef(0);
  const arrivedRef = useRef(false);

  useFrame((_, delta) => {
    if (!groupRef.current || arrivedRef.current) return;
    elapsed.current += delta;
    const t = Math.min(1, elapsed.current / spec.duration);
    const eased = SPEED_EASE(t);

    const segments = spec.path.length - 1;
    const segmentT = eased * segments;
    const segmentIndex = Math.min(segments - 1, Math.floor(segmentT));
    const localT = segmentT - segmentIndex;

    const from = spec.path[segmentIndex];
    const to = spec.path[segmentIndex + 1];
    groupRef.current.position.set(
      from[0] + (to[0] - from[0]) * localT,
      from[1] + (to[1] - from[1]) * localT,
      from[2] + (to[2] - from[2]) * localT
    );

    // Coin-flip spin while travelling -- purely cosmetic, gives the token a
    // sense of physical motion rather than sliding like a flat sprite.
    if (meshRef.current) meshRef.current.rotation.y += delta * 6;

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
    <group ref={groupRef} position={spec.path[0]}>
      <mesh ref={meshRef}>
        <cylinderGeometry args={[0.16, 0.16, 0.045, 20]} />
        <meshStandardMaterial color={spec.color} emissive={spec.color} emissiveIntensity={1.2} toneMapped={false} metalness={0.6} roughness={0.2} />
      </mesh>
      <pointLight color={spec.color} intensity={2.5} distance={2.5} decay={2} />
      <Text
        position={[0, 0.32, 0]}
        fontSize={0.16}
        color={spec.color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.008}
        outlineColor="#020617"
        // troika-three-text lays out glyphs asynchronously; under
        // frameloop="demand" the canvas can have already painted the frame
        // this mounted in before the glyph mesh is ready, leaving the label
        // invisible until something else happens to invalidate again. This
        // re-requests a frame the moment layout actually finishes.
        onSync={() => invalidate()}
      >
        {spec.amountHbar.toFixed(4)}
      </Text>
    </group>
  );
}
