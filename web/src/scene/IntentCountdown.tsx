import { useFrame, invalidate } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { NODE_MAP } from "./layout.js";
import { useAgentPayStore } from "../store/useAgentPayStore.js";

const DEVICE_POS = NODE_MAP.device.position;
const ABOVE: [number, number, number] = [DEVICE_POS[0], DEVICE_POS[1] + 0.75, DEVICE_POS[2]];

/**
 * Renders the pending intent's countdown directly above the ESP32 node, in
 * scene -- not just a panel below the fold. Ticks every frame while an
 * intent is pending (this is the one place in the scene that needs
 * frame-by-frame updates purely from wall-clock time, so it self-invalidates
 * continuously while active and stops the moment nothing is pending).
 */
export function IntentCountdown() {
  const pendingIntent = useAgentPayStore((s) => s.snapshot?.pendingIntent);

  useFrame(() => {
    if (!pendingIntent) return;
    invalidate();
  });

  if (!pendingIntent) return null;

  const secondsLeft = Math.max(0, Math.round((new Date(pendingIntent.expires_at).getTime() - Date.now()) / 1000));

  return (
    <group position={ABOVE}>
      <Text fontSize={0.22} color="#fbbf24" anchorX="center" anchorY="bottom" outlineWidth={0.01} outlineColor="#000000">
        {`${secondsLeft}s`}
      </Text>
      <Text position={[0, -0.28, 0]} fontSize={0.11} color="#fcd34d" anchorX="center" anchorY="bottom">
        {`${pendingIntent.amount_hbar.toFixed(4)} HBAR pending`}
      </Text>
    </group>
  );
}
