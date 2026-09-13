import type { ButtonHTMLAttributes, ReactNode } from "react";

type Tone = "brand" | "emerald" | "red" | "amber" | "slate";

const TONE_SOLID: Record<Tone, string> = {
  brand: "bg-brand-600 hover:bg-brand-500",
  emerald: "bg-emerald-600 hover:bg-emerald-500",
  red: "bg-red-600 hover:bg-red-500",
  amber: "bg-amber-600 hover:bg-amber-500",
  slate: "bg-slate-800 hover:bg-slate-700",
};

interface GlowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
  glow?: boolean;
  children: ReactNode;
}

/** Solid-color action button with an optional animated gradient glow
 *  (react-bits StarBorder/SpecularButton in spirit, CSS-only). Use glow for
 *  the one or two primary actions on a section -- everything glowing at once
 *  reads as noise, not emphasis. */
export function GlowButton({ tone = "brand", glow = false, className = "", children, ...rest }: GlowButtonProps) {
  return (
    <button
      {...rest}
      className={`relative rounded-md px-4 py-2 text-sm font-medium text-white transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
        glow ? "glow-button" : TONE_SOLID[tone]
      } ${className}`}
    >
      {children}
    </button>
  );
}
