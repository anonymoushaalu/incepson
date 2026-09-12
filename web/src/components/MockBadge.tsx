/** Visible marker for any panel backed by store/mock.ts instead of a real
 *  endpoint. Never omit this where mock data renders -- see store/mock.ts. */
export function MockBadge({ label = "mock data" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-700 bg-amber-950/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-400">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      {label}
    </span>
  );
}
