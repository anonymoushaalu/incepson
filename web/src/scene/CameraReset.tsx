import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { damp3 } from "maath/easing";
import { Vector3 } from "three";
import { useSceneStore } from "../store/useSceneStore.js";

const DEFAULT_POSITION = new Vector3(0, 3, 12);

/** Smoothly returns the camera to its default position/target whenever
 *  useSceneStore's cameraResetToken changes ("Reset view" button). Lives
 *  inside <Canvas> since it needs useThree/useFrame. */
export function CameraReset() {
  const { camera } = useThree();
  const resetToken = useSceneStore((s) => s.cameraResetToken);
  const resettingRef = useRef(false);
  const lastToken = useRef(resetToken);

  if (lastToken.current !== resetToken) {
    lastToken.current = resetToken;
    resettingRef.current = true;
  }

  useFrame((_, delta) => {
    if (!resettingRef.current) return;
    damp3(camera.position, DEFAULT_POSITION, 0.4, delta);
    if (camera.position.distanceTo(DEFAULT_POSITION) < 0.02) {
      resettingRef.current = false;
    }
  });

  return null;
}
