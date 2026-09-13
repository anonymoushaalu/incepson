import { useEffect, useRef, useState } from "react";
import { useMotionValue, useSpring } from "framer-motion";

interface MoneyProps {
  value: number;
  decimals?: number;
  suffix?: string;
  className?: string;
}

/** Animated HBAR amount, ported in spirit from react-bits' CountUp: a spring
 *  chases the target value instead of the number just snapping on every SSE
 *  update. Pulses briefly on change so a live decision reads as an event,
 *  not a silent re-render. */
export function Money({ value, decimals = 4, suffix = " HBAR", className = "" }: MoneyProps) {
  const motionValue = useMotionValue(value);
  const spring = useSpring(motionValue, { stiffness: 120, damping: 20, mass: 0.6 });
  const [display, setDisplay] = useState(value);
  const [pulsing, setPulsing] = useState(false);
  const prevValue = useRef(value);

  useEffect(() => {
    if (value !== prevValue.current) {
      prevValue.current = value;
      motionValue.set(value);
      setPulsing(true);
      const id = setTimeout(() => setPulsing(false), 400);
      return () => clearTimeout(id);
    }
  }, [value, motionValue]);

  useEffect(() => {
    const unsubscribe = spring.on("change", (v) => setDisplay(v));
    return unsubscribe;
  }, [spring]);

  return (
    <span className={`${pulsing ? "count-pulse" : ""} ${className}`}>
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}
