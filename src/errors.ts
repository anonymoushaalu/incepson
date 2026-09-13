import type { Request, Response, NextFunction } from "express";
import { env } from "./config.js";

/** Consistent { error, code } envelope across every route. `code` is a
 *  short machine-readable slug for the frontend to branch on;
 *  `error` is the human-readable message safe to show directly --
 *  callers are responsible for not passing anything sensitive as `error`
 *  (e.g. never pass a raw stack trace; do pass a caught SDK error's own
 *  message, which is what the OpenAI/x402 failures already return). */
export function sendError(res: Response, status: number, code: string, error: string): void {
  res.status(status).json({ error, code });
}

/** Blocks /api/dev/* and /api/device/simulate-approve when
 *  ENABLE_DEV_ENDPOINTS=false. See config.ts's enableDevEndpoints comment
 *  for why these are dangerous to leave open on a public deploy. */
export function requireDevEndpointsEnabled(req: Request, res: Response, next: NextFunction): void {
  if (!env.enableDevEndpoints) {
    sendError(res, 404, "DEV_ENDPOINTS_DISABLED", "Dev endpoints are disabled (ENABLE_DEV_ENDPOINTS=false).");
    return;
  }
  next();
}
