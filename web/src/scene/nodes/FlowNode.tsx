import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { damp } from "maath/easing";
import type { Mesh } from "three";
import type { NodeLayout } from "../layout.js";
import { useSceneStore } from "../../store/useSceneStore.js";

/** One node in the enforcement graph. Hover/select feedback (scale) is
 *  driven imperatively in useFrame off useSceneStore -- no library other
 *  than maath's damp ever touches this mesh's transform, per the
 *  layered-separation rule in docs/FRONTEND_PLAN.md. */
export function FlowNode({ node }: { node: NodeLayout }) {
  const meshRef = useRef<Mesh>(null);
  const [localHover, setLocalHover] = useState(false);
  const selectedNode = useSceneStore((s) => s.selectedNode);
  const selectNode = useSceneStore((s) => s.selectNode);
  const hoverNode = useSceneStore((s) => s.hoverNode);

  const isSelected = selectedNode === node.id;

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const targetScale = isSelected ? 1.35 : localHover ? 1.15 : 1;
    damp(meshRef.current.scale, "x", targetScale, 0.15, delta);
    damp(meshRef.current.scale, "y", targetScale, 0.15, delta);
    damp(meshRef.current.scale, "z", targetScale, 0.15, delta);
  });

  return (
    <group position={node.position}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          selectNode(node.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setLocalHover(true);
          hoverNode(node.id);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setLocalHover(false);
          hoverNode(null);
          document.body.style.cursor = "auto";
        }}
      >
        <boxGeometry args={[1.4, 0.8, 0.4]} />
        <meshStandardMaterial
          color={node.color}
          emissive={node.color}
          emissiveIntensity={isSelected ? 0.6 : localHover ? 0.3 : 0.1}
        />
        {/* Child of the mesh, not a group sibling: it must scale WITH the
            box so the box's growing front face never overtakes it -- a
            sibling at a fixed z-offset gets occluded once the mesh scales
            past that offset (found live via a headless-Chrome screenshot
            during A3; the label vanished on select before this fix). */}
        <Text position={[0, 0, 0.21]} fontSize={0.18} color="#0f172a" anchorX="center" anchorY="middle" maxWidth={1.2}>
          {node.label}
        </Text>
      </mesh>
    </group>
  );
}
