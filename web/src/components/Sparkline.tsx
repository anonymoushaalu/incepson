/** Tiny inline SVG sparkline of cumulative settled spend over the visible
 *  requests. No charting library for a dozen points. */
export function Sparkline({ values, width = 240, height = 48 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) {
    return <div className="text-xs text-slate-600">Not enough data yet.</div>;
  }
  const max = Math.max(...values, 0.0001);
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - (v / max) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={points} fill="none" stroke="#10b981" strokeWidth={1.5} />
      <circle
        cx={width}
        cy={height - (values[values.length - 1] / max) * height}
        r={2.5}
        fill="#10b981"
      />
    </svg>
  );
}
