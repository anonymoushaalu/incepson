import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { LiveFlow } from "./routes/LiveFlow.js";
import { Decisions } from "./routes/Decisions.js";
import { Policy } from "./routes/Policy.js";
import { Device } from "./routes/Device.js";
import { Attacks } from "./routes/Attacks.js";
import { Chain } from "./routes/Chain.js";
import { PageTransition } from "./components/PageTransition.js";
import { useAgentPayStore } from "./store/useAgentPayStore.js";

const NAV_LINKS = [
  { to: "/", label: "Live Flow", end: true },
  { to: "/decisions", label: "Decisions" },
  { to: "/policy", label: "Policy" },
  { to: "/device", label: "Device" },
  { to: "/attacks", label: "Attacks" },
  { to: "/chain", label: "On-Chain" },
];

function ConnectionBadge() {
  const connected = useAgentPayStore((s) => s.connected);
  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-500" title={connected ? "Live" : "Disconnected"}>
      <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-red-500"}`} />
      {connected ? "Live" : "Disconnected"}
    </span>
  );
}

function App() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-6 py-3">
          <span className="mr-4 shrink-0 text-sm font-bold text-slate-300">AgentPay</span>
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
          <div className="ml-auto shrink-0 pl-4">
            <ConnectionBadge />
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl p-6">
        <AnimatePresence mode="wait">
          <PageTransition key={location.pathname}>
            <Routes location={location}>
              <Route path="/" element={<LiveFlow />} />
              <Route path="/decisions" element={<Decisions />} />
              <Route path="/policy" element={<Policy />} />
              <Route path="/device" element={<Device />} />
              <Route path="/attacks" element={<Attacks />} />
              <Route path="/chain" element={<Chain />} />
            </Routes>
          </PageTransition>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
