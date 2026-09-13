/** Visible marker for anything simulated or not fully wired to a real
 *  device/action -- e.g. /device's software-approve button (real HMAC and
 *  real approveIntent() call, but not a physical button press). Never omit
 *  this where the label "simulated" applies. */
export function MockBadge({ label = "mock data" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-700 bg-amber-950/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-400">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      {label}
    </span>
  );
}
