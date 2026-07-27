import { createHmac, timingSafeEqual } from "crypto";
import { getServerEnv } from "@/lib/env";

function appBaseUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit && !/^https?:\/\/(localhost|127\.)/i.test(explicit)) {
    return explicit.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  if (explicit) return explicit.replace(/\/$/, "");
  return null;
}

function signAttendeeId(attendeeId: string): string {
  const secret = getServerEnv().ADMIN_SESSION_SECRET;
  return createHmac("sha256", secret).update(`credit-click:${attendeeId}`).digest("hex").slice(0, 32);
}

export function verifyTrackedLinkSig(attendeeId: string, sig: string): boolean {
  const expected = signAttendeeId(attendeeId);
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(sig, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Wrap a Cursor credit URL so we can record first click in admin Activity. */
export function buildTrackedCreditUrl(
  attendeeId: string | null | undefined,
  creditUrl: string,
): string {
  if (!attendeeId) return creditUrl;
  const base = appBaseUrl();
  if (!base) return creditUrl;
  const sig = signAttendeeId(attendeeId);
  return `${base}/api/t/${attendeeId}?s=${sig}`;
}
