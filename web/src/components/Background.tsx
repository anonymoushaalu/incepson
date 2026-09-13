/** Ambient animated backdrop, ported in spirit from react-bits' Aurora/DarkVeil
 *  patterns (CSS blur + drift, no WebGL) so it can sit behind every section --
 *  including ones the 3D canvas isn't mounted on -- without a second GL
 *  context. Fixed and pointer-events:none so it never intercepts roller drag
 *  or button clicks. */
export function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-slate-950">
      <div
        className="aurora-layer"
        style={{ background: "radial-gradient(circle at 30% 30%, var(--color-brand-500), transparent 60%)" }}
      />
      <div
        className="aurora-layer"
        style={{
          background: "radial-gradient(circle at 70% 60%, var(--color-coin-500), transparent 55%)",
          animationDelay: "-8s",
          animationDirection: "reverse",
        }}
      />
      <div
        className="aurora-layer"
        style={{
          background: "radial-gradient(circle at 50% 85%, var(--color-emerald-glow), transparent 50%)",
          animationDelay: "-14s",
        }}
      />
      <div className="absolute inset-0 bg-slate-950/70" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(2,6,23,0.9)_100%)]" />
    </div>
  );
}
