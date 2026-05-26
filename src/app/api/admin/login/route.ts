import { NextResponse } from "next/server";
import { z } from "zod";
import { buildSessionCookie, checkAdminPassword } from "@/lib/adminAuth";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ password: z.string().min(1).max(256) });

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rate = checkRateLimit(`admin-login:${ip}`);
  if (!rate.ok) {
    return NextResponse.json(
      { message: "Too many attempts. Try again later." },
      { status: 429 },
    );
  }
  let body;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }
  if (!checkAdminPassword(body.password)) {
    return NextResponse.json({ message: "Incorrect password." }, { status: 401 });
  }
  const cookie = buildSessionCookie();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookie.name, cookie.value, cookie.options);
  return res;
}
