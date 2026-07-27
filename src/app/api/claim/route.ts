import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { getEventBySlug, isValidSlug } from "@/lib/events";
import { claimAndEmailCredit, logClaimAttempt } from "@/lib/claimCredit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.string().email().max(320),
  eventSlug: z.string().min(2).max(60),
});

export async function POST(req: Request) {
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent") ?? "";

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
    await logClaimAttempt({
      eventId: null,
      email: null,
      ip,
      ua,
      outcome: "rate_limited",
      source: "public",
      emailDelivered: false,
    });
    return NextResponse.json(
      { outcome: "rate_limited", retryAfter: rate.retryAfterSeconds },
      { status: 429, headers: { "retry-after": String(rate.retryAfterSeconds) } },
    );
  }

  const event = await getEventBySlug(eventSlug);
  if (!event || !event.active) {
    await logClaimAttempt({
      eventId: null,
      email: parsed.email,
      ip,
      ua,
      outcome: "event_not_found",
      source: "public",
      emailDelivered: false,
    });
    return NextResponse.json(
      { outcome: "event_not_found", message: "Event not found." },
      { status: 404 },
    );
  }

  const result = await claimAndEmailCredit({
    email: parsed.email,
    eventSlug,
    event,
    ip,
    ua,
    source: "public",
  });

  switch (result.outcome) {
    case "event_not_found":
      return NextResponse.json({ outcome: "event_not_found" }, { status: 404 });
    case "not_found":
      return NextResponse.json({ outcome: "not_found" });
    case "no_credits":
      return NextResponse.json({ outcome: "no_credits" });
    case "already_claimed":
      // Never return the credit URL to the browser — email only.
      return NextResponse.json({
        outcome: "already_claimed",
        emailDelivered: result.emailDelivered,
      });
    case "success":
      return NextResponse.json({
        outcome: "success",
        emailDelivered: result.emailDelivered,
      });
    default:
      return NextResponse.json(
        {
          outcome: "error",
          message: result.message ?? "Unexpected error.",
        },
        { status: 500 },
      );
  }
}
