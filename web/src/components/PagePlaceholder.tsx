export function PagePlaceholder({ title, milestone, description }: { title: string; milestone: string; description: string }) {
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-sm text-slate-500">{description}</p>
      </header>
      <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/50 p-8 text-center">
        <p className="text-sm text-slate-500">
          Not built yet — lands at <span className="font-mono text-slate-400">{milestone}</span>.
        </p>
        <p className="mt-1 text-xs text-slate-600">See docs/FRONTEND_PLAN.md for the build order.</p>
      </div>
    </div>
  );
}
