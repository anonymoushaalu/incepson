import { motion } from "framer-motion";
import type { ReactNode } from "react";

/** DOM-only fade/slide on route change, via Framer Motion -- this is the
 *  library's actual job per docs/FRONTEND_PLAN.md: it never touches a
 *  three.js object's transform, only page-level DOM elements. */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
