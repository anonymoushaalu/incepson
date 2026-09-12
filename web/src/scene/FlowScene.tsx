import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { NODES } from "./layout.js";
import { FlowNode } from "./nodes/FlowNode.js";
import { FlowEdges } from "./FlowEdges.js";
import { NodeInspector } from "./NodeInspector.js";
import { CameraReset } from "./CameraReset.js";
import { BudgetWall } from "./BudgetWall.js";
import { Packet } from "./Packet.js";
import { IntentCountdown } from "./IntentCountdown.js";
import { useFlowEvents } from "./useFlowEvents.js";
import { useSceneStore } from "../store/useSceneStore.js";
import { useAgentPayStore } from "../store/useAgentPayStore.js";

/**
 * The <Canvas> root. frameloop="demand": this scene is idle between SSE
 * events and node hover, not a continuously spinning showcase -- rendering
 * only when something invalidates keeps it cheap to leave open in the
 * background across a 5-minute pitch. Packet.tsx and BudgetWall.tsx each
 * call invalidate() themselves every frame they're still animating, since
 * demand mode does not auto-continue a useFrame loop on its own.
 */
export function FlowScene() {
  const resetCamera = useSceneStore((s) => s.resetCamera);
  const packets = useFlowEvents();
  const pendingIntent = useAgentPayStore((s) => s.snapshot?.pendingIntent);

  return (
    <div className="relative h-[600px] w-full overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
      <Canvas
        frameloop="demand"
        dpr={[1, 2]}
        camera={{ position: [0, 3, 12], fov: 50 }}
        onPointerMissed={() => useSceneStore.getState().selectNode(null)}
        fallback={
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            WebGL context could not be created.
          </div>
        }
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 8, 5]} intensity={0.8} />

        <FlowEdges />
        <BudgetWall />
        {NODES.map((node) => (
          <FlowNode key={node.id} node={node} pulsing={node.id === "device" && !!pendingIntent} />
        ))}
        {packets.map((spec) => (
          <Packet key={spec.id} spec={spec} />
        ))}
        <IntentCountdown />

        <CameraReset />
        <OrbitControls
          makeDefault
          enableDamping
          minDistance={4}
          maxDistance={25}
          target={[0, 0.5, 0]}
        />
      </Canvas>

      <NodeInspector />

      <button
        onClick={resetCamera}
        className="absolute bottom-4 right-4 rounded-md border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
      >
        Reset view
      </button>
    </div>
  );
}
