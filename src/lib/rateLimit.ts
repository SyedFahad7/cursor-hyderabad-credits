/**
 * In-memory sliding-window rate limiter. Per process/instance.
 *
 * Fine for a single Vercel region + low-volume meetup traffic. If you need
 * cross-region durability, swap for Upstash Redis. Keeping this in-memory
 * avoids an extra paid dependency.
 */

import { getServerEnv } from "./env";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function checkRateLimit(key: string): RateLimitResult {
  const env = getServerEnv();
  const max = Number(env.RATE_LIMIT_MAX);
  const windowMs = Number(env.RATE_LIMIT_WINDOW) * 1000;
  const now = Date.now();

  const existing = buckets.get(key);
  if (!existing || existing.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: max - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= max) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return {
    ok: true,
    remaining: max - existing.count,
    retryAfterSeconds: 0,
  };
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
