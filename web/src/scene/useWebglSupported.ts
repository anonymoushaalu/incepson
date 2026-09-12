import { useEffect, useState } from "react";

/** True/false once checked, null while unchecked (first render, SSR-safe).
 *  Canvas's own `fallback` prop only covers a context-creation failure
 *  mid-render; this check avoids even mounting <Canvas> when WebGL is
 *  known unavailable up front (e.g. some locked-down projector laptops). */
export function useWebglSupported(): boolean | null {
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      setSupported(!!gl);
    } catch {
      setSupported(false);
    }
  }, []);

  return supported;
}
