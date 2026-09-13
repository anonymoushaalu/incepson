import { LiveFlow } from "./routes/LiveFlow.js";
import { Decisions } from "./routes/Decisions.js";
import { Policy } from "./routes/Policy.js";
import { Device } from "./routes/Device.js";
import { Attacks } from "./routes/Attacks.js";
import { Chain } from "./routes/Chain.js";
import { Settings } from "./routes/Settings.js";
import { Background } from "./components/Background.js";
import { Roller } from "./components/Roller.js";
import { useAgentPayStore } from "./store/useAgentPayStore.js";
import { useRollerStore } from "./store/useRollerStore.js";

const SECTIONS = [
  { id: "flow", label: "Live Flow", content: <LiveFlow /> },
  { id: "decisions", label: "Decisions", content: <Decisions /> },
  { id: "policy", label: "Policy", content: <Policy /> },
  { id: "device", label: "Device", content: <Device /> },
  { id: "attacks", label: "Attacks", content: <Attacks /> },
  { id: "chain", label: "On-Chain", content: <Chain /> },
  { id: "settings", label: "Settings", content: <Settings /> },
];

function ConnectionBadge() {
  const connected = useAgentPayStore((s) => s.connected);
  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-400" title={connected ? "Live" : "Disconnected"}>
      <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-400 shadow-[0_0_8px_theme(colors.emerald.400)]" : "bg-red-500"}`} />
      {connected ? "Live" : "Disconnected"}
    </span>
  );
}

function App() {
  const activeIndex = useRollerStore((s) => s.activeIndex);
  const goTo = useRollerStore((s) => s.goTo);

  return (
    <div className="min-h-screen text-slate-100">
      <Background />

      <nav className="sticky top-0 z-20 border-b border-white/5 bg-slate-950/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-6 py-3">
          <span className="mr-4 shrink-0 bg-gradient-to-r from-brand-400 to-violet-glow bg-clip-text text-sm font-bold text-transparent">
            AgentPay
          </span>
          {SECTIONS.map((section, i) => (
            <button
              key={section.id}
              onClick={() => goTo(i)}
              className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                activeIndex === i
                  ? "bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              {section.label}
            </button>
          ))}
          <div className="ml-auto shrink-0 pl-4">
            <ConnectionBadge />
          </div>
        </div>
      </nav>

      <Roller sections={SECTIONS} />

      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center gap-1.5">
        {SECTIONS.map((section, i) => (
          <button
            key={section.id}
            onClick={() => goTo(i)}
            className={`pointer-events-auto h-1.5 rounded-full transition-all ${
              activeIndex === i ? "w-6 bg-brand-400" : "w-1.5 bg-white/20 hover:bg-white/40"
            }`}
            aria-label={`Go to ${section.label}`}
          />
        ))}
      </div>
    </div>
  );
}

export default App;
