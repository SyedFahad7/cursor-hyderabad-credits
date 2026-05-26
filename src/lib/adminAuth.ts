import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getServerEnv } from "./env";

const COOKIE_NAME = "chyd_admin";
const SESSION_TTL_HOURS = 12;

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export type AdminSession = {
  issuedAt: number;
  expiresAt: number;
};

export function buildSessionCookie(): { name: string; value: string; options: Record<string, unknown> } {
  const env = getServerEnv();
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_HOURS * 60 * 60 * 1000;
  const payload = `${now}.${expiresAt}`;
  const sig = sign(payload, env.ADMIN_SESSION_SECRET);
  const value = `${payload}.${sig}`;

  return {
    name: COOKIE_NAME,
    value,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: SESSION_TTL_HOURS * 60 * 60,
    },
  };
}

export function clearSessionCookie() {
  return {
    name: COOKIE_NAME,
    value: "",
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 0,
    },
  };
}

export async function verifyAdminSession(): Promise<boolean> {
  const env = getServerEnv();
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return false;
  const parts = raw.split(".");
  if (parts.length !== 3) return false;
  const [issuedAtStr, expiresAtStr, sig] = parts;
  const expected = sign(`${issuedAtStr}.${expiresAtStr}`, env.ADMIN_SESSION_SECRET);
  if (!safeEqual(sig!, expected)) return false;
  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;
  return true;
}

export function checkAdminPassword(submitted: string): boolean {
  const env = getServerEnv();
  if (!submitted) return false;
  if (submitted.length !== env.ADMIN_PASSWORD.length) return false;
  return safeEqual(submitted, env.ADMIN_PASSWORD);
}
