import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendCreditEmail } from "@/lib/email";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { getEventBySlug, isValidSlug } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.string().email().max(320),
  eventSlug: z.string().min(2).max(60),
});

type ClaimRow = {
  status:
    | "success"
    | "already_claimed"
    | "not_found"
    | "no_credits"
    | "event_not_found";
  cursor_url: string | null;
  attendee_id: string | null;
  attendee_name: string | null;
  event_name: string | null;
};

export async function POST(req: Request) {
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent") ?? "";
  const sb = getSupabaseAdmin();

  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json(
      { outcome: "error", message: "Please enter a valid email." },
      { status: 400 },
    );
  }

  const eventSlug = parsed.eventSlug.toLowerCase().trim();
  if (!isValidSlug(eventSlug)) {
    return NextResponse.json(
      { outcome: "event_not_found", message: "Unknown event." },
      { status: 400 },
    );
  }

  // Rate limit per (event, ip) so one busy event doesn't throttle another
  const rate = checkRateLimit(`claim:${eventSlug}:${ip}`);
  if (!rate.ok) {
    await logAttempt({
      eventId: null,
      email: null,
      ip,
      ua,
      outcome: "rate_limited",
    });
    return NextResponse.json(
      { outcome: "rate_limited", retryAfter: rate.retryAfterSeconds },
      { status: 429, headers: { "retry-after": String(rate.retryAfterSeconds) } },
    );
  }

  // Resolve the event so we can include event_id in audit log + email
  const event = await getEventBySlug(eventSlug);
  if (!event || !event.active) {
    await logAttempt({
      eventId: null,
      email: parsed.email,
      ip,
      ua,
      outcome: "event_not_found",
    });
    return NextResponse.json(
      { outcome: "event_not_found", message: "Event not found." },
      { status: 404 },
    );
  }

  const email = parsed.email.trim().toLowerCase();

  try {
    const { data, error } = await sb.rpc("claim_attendee_credit", {
      p_email: email,
      p_event_slug: eventSlug,
    });

    if (error) {
      console.error("[claim] rpc error", error);
      await logAttempt({
        eventId: event.id,
        email,
        ip,
        ua,
        outcome: "error",
      });
      return NextResponse.json(
        { outcome: "error", message: "Server error. Please try again." },
        { status: 500 },
      );
    }

    const row = (Array.isArray(data) ? data[0] : data) as ClaimRow | undefined;
    if (!row) {
      await logAttempt({
        eventId: event.id,
        email,
        ip,
        ua,
        outcome: "error",
      });
      return NextResponse.json(
        { outcome: "error", message: "Unexpected response." },
        { status: 500 },
      );
    }

    switch (row.status) {
      case "event_not_found":
        await logAttempt({
          eventId: event.id,
          email,
          ip,
          ua,
          outcome: "event_not_found",
        });
        return NextResponse.json({ outcome: "event_not_found" }, { status: 404 });

      case "not_found":
        await logAttempt({ eventId: event.id, email, ip, ua, outcome: "not_found" });
        return NextResponse.json({ outcome: "not_found" });

      case "no_credits":
        await logAttempt({ eventId: event.id, email, ip, ua, outcome: "no_credits" });
        return NextResponse.json({ outcome: "no_credits" });

      case "already_claimed": {
        let emailDelivered = false;
        if (row.cursor_url) {
          try {
            await sendCreditEmail({
              to: email,
              name: row.attendee_name,
              creditUrl: row.cursor_url,
              event,
            });
            emailDelivered = true;
          } catch (e) {
            console.warn("[claim] resend on already_claimed failed", e);
          }
        }
        await logAttempt({ eventId: event.id, email, ip, ua, outcome: "duplicate" });
        return NextResponse.json({
          outcome: "already_claimed",
          creditUrl: row.cursor_url,
          emailDelivered,
        });
      }

      case "success": {
        if (!row.cursor_url) {
          await logAttempt({ eventId: event.id, email, ip, ua, outcome: "error" });
          return NextResponse.json(
            { outcome: "error", message: "Credit assignment failed." },
            { status: 500 },
          );
        }
        // Email delivery is best-effort. The credit URL is returned to the
        // browser regardless so the attendee can claim immediately even when
        // Resend rejects the recipient (e.g. unverified-domain sandbox sender).
        let emailDelivered = false;
        try {
          await sendCreditEmail({
            to: email,
            name: row.attendee_name,
            creditUrl: row.cursor_url,
            event,
          });
          emailDelivered = true;
        } catch (e) {
          console.warn("[claim] email send failed (claim still valid)", e);
        }
        await logAttempt({
          eventId: event.id,
          email,
          ip,
          ua,
          outcome: "success",
        });
        return NextResponse.json({
          outcome: "success",
          creditUrl: row.cursor_url,
          emailDelivered,
        });
      }

      default:
        await logAttempt({ eventId: event.id, email, ip, ua, outcome: "error" });
        return NextResponse.json(
          { outcome: "error", message: "Unknown status." },
          { status: 500 },
        );
    }
  } catch (e) {
    console.error("[claim] unhandled", e);
    await logAttempt({ eventId: event.id, email, ip, ua, outcome: "error" });
    return NextResponse.json(
      { outcome: "error", message: "Unexpected error." },
      { status: 500 },
    );
  }
}

async function logAttempt(args: {
  eventId: string | null;
  email: string | null;
  ip: string;
  ua: string;
  outcome:
    | "success"
    | "duplicate"
    | "not_found"
    | "no_credits"
    | "rate_limited"
    | "event_not_found"
    | "error";
}) {
  try {
    const sb = getSupabaseAdmin();
    await sb.from("claim_attempts").insert({
      event_id: args.eventId,
      email: args.email,
      ip: args.ip,
      user_agent: args.ua,
      outcome: args.outcome,
    });
  } catch {
    // never let logging failures take down the request
  }
}
