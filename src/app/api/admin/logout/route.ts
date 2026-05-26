import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function POST() {
  const cookie = clearSessionCookie();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookie.name, cookie.value, cookie.options);
  return res;
}
