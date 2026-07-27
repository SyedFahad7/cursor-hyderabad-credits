import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getEventByLumaId } from "@/lib/events";
import { claimAndEmailCredit } from "@/lib/claimCredit";
import {
  isLumaApproved,
  parseLumaWebhookPayload,
  verifyLumaWebhookSignature,
} from "@/lib/lumaWebhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Insert-first idempotency. Returns false if this Webhook-Id was already seen. */
async function beginDelivery(
  id: string,
  eventType: string,
): Promise<boolean> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("webhook_deliveries").insert({
    id,
    event_type: eventType,
    outcome: "processing",
  });
  if (error?.code === "23505") return false;
  if (error) {
    console.error("[luma webhook] delivery insert failed", error);
    throw new Error(error.message);
  }
  return true;
}

async function finishDelivery(
  id: string,
  outcome: string,
  extra?: { email?: string | null; eventId?: string | null },
) {
  const sb = getSupabaseAdmin();
  await sb
    .from("webhook_deliveries")
    .update({
      outcome,
      ...(extra?.email !== undefined && { email: extra.email }),
      ...(extra?.eventId !== undefined && { event_id: extra.eventId }),
    })
    .eq("id", id);
}

async function upsertAttendee(args: {
  eventId: string;
  email: string;
  name: string | null;
}) {
  const sb = getSupabaseAdmin();
  const email = args.email.trim().toLowerCase();

  const { data: existing } = await sb
    .from("attendees")
    .select("id,name")
    .eq("event_id", args.eventId)
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    if (args.name && !existing.name) {
      await sb
        .from("attendees")
        .update({ name: args.name })
        .eq("id", existing.id);
    }
    return;
  }

  const { error } = await sb.from("attendees").insert({
    event_id: args.eventId,
    email,
    name: args.name,
  });
  if (error && error.code !== "23505") {
    throw new Error(error.message);
  }
}

export async function POST(req: Request) {
  const secret = process.env.LUMA_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error("[luma webhook] LUMA_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { message: "Webhook not configured." },
      { status: 503 },
    );
  }

  const rawBody = await req.text();
  const signature =
    req.headers.get("webhook-signature") ??
    req.headers.get("Webhook-Signature");
  const timestamp =
    req.headers.get("webhook-timestamp") ??
    req.headers.get("Webhook-Timestamp");
  const webhookId =
    req.headers.get("webhook-id") ?? req.headers.get("Webhook-Id");

  const verified = verifyLumaWebhookSignature({
    secret,
    signatureHeader: signature,
    timestampHeader: timestamp,
    body: rawBody,
  });
  if (!verified.ok) {
    console.warn("[luma webhook] signature failed", verified.reason);
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!webhookId) {
    return NextResponse.json({ message: "Missing Webhook-Id" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = parseLumaWebhookPayload(rawBody);
  } catch (e) {
    console.warn("[luma webhook] parse failed", e);
    try {
      if (await beginDelivery(webhookId, "unknown")) {
        await finishDelivery(webhookId, "parse_error");
      }
    } catch {
      /* ignore */
    }
    return NextResponse.json({ ok: true, ignored: true, reason: "parse_error" });
  }

  const { type, guest } = parsed;

  let claimed;
  try {
    claimed = await beginDelivery(webhookId, type);
  } catch {
    return NextResponse.json({ message: "Delivery tracking failed" }, { status: 500 });
  }
  if (!claimed) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  if (
    type !== "guest.registered" &&
    type !== "guest.updated" &&
    type !== "ticket.registered"
  ) {
    await finishDelivery(webhookId, "ignored_type");
    return NextResponse.json({ ok: true, ignored: true });
  }

  if (!guest || !guest.lumaEventId) {
    await finishDelivery(webhookId, "missing_guest_or_event");
    return NextResponse.json({ ok: true, ignored: true });
  }

  const event = await getEventByLumaId(guest.lumaEventId);
  if (!event) {
    await finishDelivery(webhookId, "unmapped_event", {
      email: guest.email,
    });
    return NextResponse.json({ ok: true, ignored: true, reason: "unmapped_event" });
  }

  // Allowlist sync: approved guests get into attendees before doors open.
  if (isLumaApproved(guest.approvalStatus) && !guest.checkedIn) {
    try {
      await upsertAttendee({
        eventId: event.id,
        email: guest.email,
        name: guest.name,
      });
      await finishDelivery(webhookId, "allowlist_upsert", {
        email: guest.email,
        eventId: event.id,
      });
      return NextResponse.json({ ok: true, action: "allowlist_upsert" });
    } catch (e) {
      console.error("[luma webhook] allowlist upsert failed", e);
      await finishDelivery(webhookId, "allowlist_upsert_error", {
        email: guest.email,
        eventId: event.id,
      });
      return NextResponse.json({ message: "Upsert failed" }, { status: 500 });
    }
  }

  // Door flow: QR check-in → ensure allowlist → claim + email
  if (guest.checkedIn) {
    // Claim only for approved guests, or when approval_status is absent
    // (some payloads may omit it on check-in updates).
    if (
      guest.approvalStatus &&
      !isLumaApproved(guest.approvalStatus)
    ) {
      await finishDelivery(webhookId, "checked_in_not_approved", {
        email: guest.email,
        eventId: event.id,
      });
      return NextResponse.json({ ok: true, ignored: true });
    }

    try {
      await upsertAttendee({
        eventId: event.id,
        email: guest.email,
        name: guest.name,
      });
    } catch (e) {
      console.error("[luma webhook] check-in upsert failed", e);
      await finishDelivery(webhookId, "checkin_upsert_error", {
        email: guest.email,
        eventId: event.id,
      });
      return NextResponse.json({ message: "Upsert failed" }, { status: 500 });
    }

    const result = await claimAndEmailCredit({
      email: guest.email,
      eventSlug: event.slug,
      event,
      ip: "luma-webhook",
      ua: `luma-webhook/${type}`,
      source: "luma",
    });

    await finishDelivery(webhookId, `checkin_${result.outcome}`, {
      email: guest.email,
      eventId: event.id,
    });
    return NextResponse.json({
      ok: true,
      action: "checkin_claim",
      outcome: result.outcome,
      emailDelivered: result.emailDelivered,
    });
  }

  await finishDelivery(webhookId, "no_action", {
    email: guest.email,
    eventId: event.id,
  });
  return NextResponse.json({ ok: true, ignored: true });
}
