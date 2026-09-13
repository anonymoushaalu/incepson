import { GlowButton } from "../components/GlowButton.js";
import { useRollerStore } from "../store/useRollerStore.js";

/**
 * First panel in the roller. Purely explanatory -- no live data, nothing
 * that needs the SSE connection -- so it's safe to render before /api/state
 * ever resolves, and doubles as the "still connecting" screen on a cold load.
 */
export function Intro() {
  const goTo = useRollerStore((s) => s.goTo);

  return (
    <div className="flex min-h-[calc(100vh-56px-3rem)] flex-col items-center justify-center text-center">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 shadow-[0_0_60px_-15px_var(--color-brand-500)]">
        <img src="/incepson-hero.png" alt="An AI agent requests a payment; a human hand holds authorization" className="w-full" />
      </div>

      <h1 className="mt-8 bg-gradient-to-r from-brand-400 via-white to-coin-400 bg-clip-text text-3xl font-extrabold text-transparent sm:text-4xl">
        Let your agent spend. Keep the wallet.
      </h1>
      <p className="mt-4 max-w-2xl text-sm text-slate-400 sm:text-base">
        AgentPay lets an autonomous AI agent request payments on its own -- but it never gets to approve them. A
        deterministic policy engine, with no AI in the loop at all, checks every request against hard limits before a
        single tinybar moves. Anything borderline goes to a physical button on real hardware. Everything that settles,
        settles for real on Hedera testnet.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FeatureCard
          title="Policy before AI"
          body="Five deterministic checks -- allowlist, per-tx cap, daily budget, injection detection, anomaly detection -- run before the agent's request ever reaches a wallet."
        />
        <FeatureCard
          title="Hardware escalation"
          body="Anything the policy can't clear outright waits for a real button press on an ESP32, HMAC-verified end to end. No approval, no spend."
        />
        <FeatureCard
          title="Real settlement"
          body="Every approved payment is a real Hedera testnet transaction, watchable live on HashScan as it happens."
        />
      </div>

      <GlowButton tone="brand" glow onClick={() => goTo(1)} className="mt-10">
        Enter the live dashboard →
      </GlowButton>
    </div>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-4 text-left backdrop-blur">
      <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
      <p className="mt-1 text-xs text-slate-500">{body}</p>
    </div>
  );
}
