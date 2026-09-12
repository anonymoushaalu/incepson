import { create } from "zustand";

/** 3D scene UI state ONLY -- never payment data. Kept separate from
 *  useAgentPayStore per the layered-separation pattern: the data store and
 *  the scene store are different concerns, so no two libraries (SSE-driven
 *  React state vs. framer-motion-driven node feedback) ever fight over the
 *  same object's transform. */

export type FlowNodeId =
  | "agent"
  | "signals"
  | "policy"
  | "allow"
  | "escalate"
  | "deny"
  | "hedera"
  | "device";

interface SceneState {
  selectedNode: FlowNodeId | null;
  hoveredNode: FlowNodeId | null;
  cameraResetToken: number;
}

interface SceneActions {
  selectNode: (id: FlowNodeId | null) => void;
  hoverNode: (id: FlowNodeId | null) => void;
  resetCamera: () => void;
}

export const useSceneStore = create<SceneState & SceneActions>((set) => ({
  selectedNode: null,
  hoveredNode: null,
  cameraResetToken: 0,

  selectNode: (id) => set((state) => ({ selectedNode: state.selectedNode === id ? null : id })),
  hoverNode: (id) => set({ hoveredNode: id }),
  resetCamera: () => set((state) => ({ cameraResetToken: state.cameraResetToken + 1, selectedNode: null })),
}));
