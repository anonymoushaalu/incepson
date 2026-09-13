import { useEffect, useRef, type ReactNode } from "react";
import { useRollerStore } from "../store/useRollerStore.js";

/**
 * The single-page "roller": every section is a full-width panel inside one
 * horizontally scroll-snapping track. Native CSS scroll-snap (not a
 * hand-rolled drag/wheel hijack) drives it, so trackpad swipe, mouse-wheel
 * (shift+wheel or a horizontal trackpad gesture), arrow keys once a panel is
 * focused, and a scrollbar drag all work for free with correct momentum and
 * accessibility -- a custom implementation would have to reinvent all of
 * that. useRollerStore is the seam: this component owns the actual scroll
 * position, the nav (App.tsx) only ever reads/requests an index.
 */
export function Roller({ sections }: { sections: { id: string; content: ReactNode }[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const setActiveIndex = useRollerStore((s) => s.setActiveIndex);
  const requestedIndex = useRollerStore((s) => s.requestedIndex);
  const clearRequest = useRollerStore((s) => s.clearRequest);

  // Nav click -> scroll the requested panel into view. IntersectionObserver
  // below picks up the resulting scroll and updates activeIndex naturally,
  // so this effect only ever initiates the scroll, never sets state itself.
  useEffect(() => {
    if (requestedIndex === null) return;
    panelRefs.current[requestedIndex]?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    clearRequest();
  }, [requestedIndex, clearRequest]);

  // Which panel is "active" is whichever one is most visible, not just
  // "first intersecting" -- during a fast swipe past a narrow panel both
  // neighbors can intersect briefly, and intersectionRatio is what
  // disambiguates which one actually holds the viewport center.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const mostVisible = entries.reduce((best, e) => (e.intersectionRatio > best.intersectionRatio ? e : best));
        if (mostVisible.intersectionRatio > 0.5) {
          const index = panelRefs.current.indexOf(mostVisible.target as HTMLDivElement);
          if (index !== -1) setActiveIndex(index);
        }
      },
      { root: track, threshold: [0.5, 0.75, 1] }
    );
    for (const panel of panelRefs.current) {
      if (panel) observer.observe(panel);
    }
    return () => observer.disconnect();
  }, [setActiveIndex, sections.length]);

  return (
    <div
      ref={trackRef}
      className="flex h-[calc(100vh-56px)] snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth"
      style={{ scrollbarGutter: "stable" }}
    >
      {sections.map((section, i) => (
        <div
          key={section.id}
          ref={(el) => {
            panelRefs.current[i] = el;
          }}
          className="h-full w-full shrink-0 snap-start overflow-y-auto"
        >
          <div className="mx-auto max-w-6xl p-6">{section.content}</div>
        </div>
      ))}
    </div>
  );
}
