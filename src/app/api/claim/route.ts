import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendCreditEmail } from "@/lib/email";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.string().email().max(320),
});

type ClaimRow = {
  status:
    | "success"
    | "already_claimed"
    | "not_found"
    | "no_credits";
  cursor_url: string | null;
  attendee_id: string | null;
  attendee_name: string | null;
};

export async function POST(req: Request) {
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent") ?? "";
  const sb = getSupabaseAdmin();

  const rate = checkRateLimit(`claim:${ip}`);
  if (!rate.ok) {
    await logAttempt({ email: null, ip, ua, outcome: "rate_limited" });
    return NextResponse.json(
      { outcome: "rate_limited", retryAfter: rate.retryAfterSeconds },
      { status: 429, headers: { "retry-after": String(rate.retryAfterSeconds) } },
    );
  }

  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json(
      { outcome: "error", message: "Please enter a valid email." },
      { status: 400 },
    );
  }
  const email = parsed.email.trim().toLowerCase();

  try {
    const { data, error } = await sb.rpc("claim_attendee_credit", {
      p_email: email,
    });

    if (error) {
      console.error("[claim] rpc error", error);
      await logAttempt({ email, ip, ua, outcome: "error" });
      return NextResponse.json(
        { outcome: "error", message: "Server error. Please try again." },
        { status: 500 },
      );
    }

    const row = (Array.isArray(data) ? data[0] : data) as ClaimRow | undefined;
    if (!row) {
      await logAttempt({ email, ip, ua, outcome: "error" });
      return NextResponse.json(
        { outcome: "error", message: "Unexpected response." },
        { status: 500 },
      );
    }

    switch (row.status) {
      case "not_found":
        await logAttempt({ email, ip, ua, outcome: "not_found" });
        return NextResponse.json({ outcome: "not_found" });

      case "no_credits":
        await logAttempt({ email, ip, ua, outcome: "no_credits" });
        return NextResponse.json({ outcome: "no_credits" });

      case "already_claimed": {
        // Re-send the originally assigned URL for convenience
        if (row.cursor_url) {
          try {
            await sendCreditEmail({
              to: email,
              name: row.attendee_name,
              creditUrl: row.cursor_url,
            });
          } catch (e) {
            console.warn("[claim] resend on already_claimed failed", e);
          }
        }
        await logAttempt({ email, ip, ua, outcome: "duplicate" });
        return NextResponse.json({ outcome: "already_claimed" });
      }

      case "success": {
        if (!row.cursor_url) {
          await logAttempt({ email, ip, ua, outcome: "error" });
          return NextResponse.json(
            { outcome: "error", message: "Credit assignment failed." },
            { status: 500 },
          );
        }
        try {
          await sendCreditEmail({
            to: email,
            name: row.attendee_name,
            creditUrl: row.cursor_url,
          });
        } catch (e) {
          console.error("[claim] email send failed; rolling back", e);
          // Roll back so the credit isn't lost to a failed email
          if (row.attendee_id) {
            await sb.rpc("revoke_credit", { p_attendee_id: row.attendee_id });
          }
          await logAttempt({ email, ip, ua, outcome: "error" });
          return NextResponse.json(
            {
              outcome: "error",
              message: "We couldn't send the email. Please try again.",
            },
            { status: 502 },
          );
        }
        await logAttempt({ email, ip, ua, outcome: "success" });
        return NextResponse.json({ outcome: "success" });
      }

      default:
        await logAttempt({ email, ip, ua, outcome: "error" });
        return NextResponse.json(
          { outcome: "error", message: "Unknown status." },
          { status: 500 },
        );
    }
  } catch (e) {
    console.error("[claim] unhandled", e);
    await logAttempt({ email, ip, ua, outcome: "error" });
    return NextResponse.json(
      { outcome: "error", message: "Unexpected error." },
      { status: 500 },
    );
  }
}

async function logAttempt(args: {
  email: string | null;
  ip: string;
  ua: string;
  outcome:
    | "success"
    | "duplicate"
    | "not_found"
    | "no_credits"
    | "rate_limited"
    | "error";
}) {
  try {
    const sb = getSupabaseAdmin();
    await sb.from("claim_attempts").insert({
      email: args.email,
      ip: args.ip,
      user_agent: args.ua,
      outcome: args.outcome,
    });
  } catch {
    // never let logging failures take down the request
  }
}
