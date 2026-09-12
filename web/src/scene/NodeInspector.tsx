import { useSceneStore } from "../store/useSceneStore.js";
import { NODE_MAP } from "./layout.js";

/** DOM overlay (not drei/Html -- this sits outside the Canvas entirely, as a
 *  normal absolutely-positioned panel) showing the selected node's detail.
 *  Kept out of the Canvas so it's plain, readable, selectable text. */
export function NodeInspector() {
  const selectedNode = useSceneStore((s) => s.selectedNode);
  const selectNode = useSceneStore((s) => s.selectNode);

  if (!selectedNode) return null;
  const node = NODE_MAP[selectedNode];

  return (
    <div className="absolute right-4 top-4 w-72 rounded-lg border border-slate-700 bg-slate-900/95 p-4 shadow-xl backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-100">{node.label}</h3>
        <button
          onClick={() => selectNode(null)}
          className="text-slate-500 hover:text-slate-300"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      <p className="mt-2 text-sm text-slate-400">{node.description}</p>
      <p className="mt-3 font-mono text-xs text-slate-600">{node.ownerModule}</p>
    </div>
  );
}
