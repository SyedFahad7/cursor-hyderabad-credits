import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getEventByLumaId } from "@/lib/events";
import { claimAndEmailCredit } from "@/lib/claimCredit";
import { logSystem, errMessage } from "@/lib/systemLog";
import {
  isLumaApproved,
  parseLumaWebhookPayload,
  verifyLumaWebhookSignature,
} from "@/lib/lumaWebhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SRC = "luma-webhook";

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
    await logSystem("error", SRC, "webhook_deliveries insert failed", {
      webhookId: id,
      error: error.message,
    });
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
  /** When true, stamp checked_in_at (first check-in only, never overwritten). */
  checkedIn?: boolean;
}) {
  const sb = getSupabaseAdmin();
  const email = args.email.trim().toLowerCase();

  const { data: existing } = await sb
    .from("attendees")
    .select("id,name,checked_in_at")
    .eq("event_id", args.eventId)
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    const patch: Record<string, unknown> = {};
    if (args.name && !existing.name) patch.name = args.name;
    if (args.checkedIn && !existing.checked_in_at) {
      patch.checked_in_at = new Date().toISOString();
    }
    if (Object.keys(patch).length > 0) {
      const { error } = await sb
        .from("attendees")
        .update(patch)
        .eq("id", existing.id);
      // 42703 = column missing (checkin-tracking-migration.sql not run yet).
      // Never fail the check-in over tracking metadata.
      if (error?.code === "42703" && "checked_in_at" in patch) {
        await logSystem("warn", SRC, "checked_in_at column missing — run checkin-tracking-migration.sql");
        delete patch.checked_in_at;
        if (Object.keys(patch).length > 0) {
          await sb.from("attendees").update(patch).eq("id", existing.id);
        }
      }
    }
    return;
  }

  let { error } = await sb.from("attendees").insert({
    event_id: args.eventId,
    email,
    name: args.name,
    ...(args.checkedIn && { checked_in_at: new Date().toISOString() }),
  });
  if (error?.code === "42703" && args.checkedIn) {
    await logSystem("warn", SRC, "checked_in_at column missing — run checkin-tracking-migration.sql");
    ({ error } = await sb.from("attendees").insert({
      event_id: args.eventId,
      email,
      name: args.name,
    }));
  }
  if (error && error.code !== "23505") {
    throw new Error(error.message);
  }
}

export async function POST(req: Request) {
  const secret = process.env.LUMA_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error("[luma webhook] LUMA_WEBHOOK_SECRET is not set");
    await logSystem("error", SRC, "LUMA_WEBHOOK_SECRET is not set on server");
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
    await logSystem("error", SRC, `Signature verification failed: ${verified.reason}`, {
      webhookId,
      hasSignatureHeader: Boolean(signature),
      hasTimestampHeader: Boolean(timestamp),
    });
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!webhookId) {
    await logSystem("warn", SRC, "Missing Webhook-Id header");
    return NextResponse.json({ message: "Missing Webhook-Id" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = parseLumaWebhookPayload(rawBody);
  } catch (e) {
    console.warn("[luma webhook] parse failed", e);
    await logSystem("error", SRC, "Payload parse failed", {
      webhookId,
      error: errMessage(e),
      bodySnippet: rawBody.slice(0, 500),
    });
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
    await logSystem("info", SRC, `Ignored webhook type: ${type}`, { webhookId });
    return NextResponse.json({ ok: true, ignored: true });
  }

  if (!guest || !guest.lumaEventId) {
    await finishDelivery(webhookId, "missing_guest_or_event");
    await logSystem("warn", SRC, "Payload missing guest email or Luma event id", {
      webhookId,
      type,
      hasGuest: Boolean(guest),
      lumaEventId: guest?.lumaEventId ?? null,
      bodySnippet: rawBody.slice(0, 500),
    });
    return NextResponse.json({ ok: true, ignored: true });
  }

  const event = await getEventByLumaId(guest.lumaEventId);
  if (!event) {
    await finishDelivery(webhookId, "unmapped_event", {
      email: guest.email,
    });
    await logSystem("warn", SRC, "No portal event mapped to this Luma event id", {
      webhookId,
      type,
      lumaEventId: guest.lumaEventId,
      email: guest.email,
      hint: "Set this Luma event ID on the event in /admin/events",
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
      await logSystem("info", SRC, `Allowlist synced: ${guest.email}`, {
        webhookId,
        event: event.slug,
      });
      return NextResponse.json({ ok: true, action: "allowlist_upsert" });
    } catch (e) {
      console.error("[luma webhook] allowlist upsert failed", e);
      await logSystem("error", SRC, "Allowlist upsert failed", {
        webhookId,
        email: guest.email,
        event: event.slug,
        error: errMessage(e),
      });
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
      await logSystem("warn", SRC, `Checked in but not approved: ${guest.email}`, {
        webhookId,
        event: event.slug,
        approvalStatus: guest.approvalStatus,
      });
      return NextResponse.json({ ok: true, ignored: true });
    }

    try {
      await upsertAttendee({
        eventId: event.id,
        email: guest.email,
        name: guest.name,
        checkedIn: true,
      });
    } catch (e) {
      console.error("[luma webhook] check-in upsert failed", e);
      await logSystem("error", SRC, "Check-in attendee upsert failed", {
        webhookId,
        email: guest.email,
        event: event.slug,
        error: errMessage(e),
      });
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
    await logSystem(
      result.outcome === "success" || result.outcome === "already_claimed"
        ? result.emailDelivered
          ? "info"
          : "error"
        : "warn",
      SRC,
      `Check-in claim for ${guest.email}: ${result.outcome}, email ${
        result.emailDelivered ? "sent" : "NOT sent"
      }`,
      {
        webhookId,
        event: event.slug,
        outcome: result.outcome,
        emailDelivered: result.emailDelivered,
        message: result.message ?? null,
      },
    );
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
  await logSystem("info", SRC, `No action for ${guest.email} (${type})`, {
    webhookId,
    event: event.slug,
    approvalStatus: guest.approvalStatus,
    checkedIn: guest.checkedIn,
  });
  return NextResponse.json({ ok: true, ignored: true });
}
