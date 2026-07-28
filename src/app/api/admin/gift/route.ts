import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAdminSession } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendCreditEmail } from "@/lib/email";
import { buildTrackedCreditUrl } from "@/lib/trackLink";
import { logClaimAttempt } from "@/lib/claimCredit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.string().email().max(320),
  name: z.string().max(120).optional().nullable(),
  mode: z.enum(["auto", "manual"]),
  sourceEventId: z.string().uuid().optional().nullable(),
});

type GiftRow = {
  status: "success" | "invalid_email" | "event_not_found" | "no_credits";
  gift_cursor_url: string | null;
  gift_event_id: string | null;
  gift_event_name: string | null;
  gift_event_slug: string | null;
  gift_credit_id: string | null;
  gift_attendee_id: string | null;
};

export async function POST(req: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      {
        message:
          e instanceof z.ZodError
            ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
            : "Invalid request",
      },
      { status: 400 },
    );
  }

  if (body.mode === "manual" && !body.sourceEventId) {
    return NextResponse.json(
      { message: "Pick an event with leftover credits." },
      { status: 400 },
    );
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc("gift_unused_credit", {
    p_email: body.email.trim().toLowerCase(),
    p_name: body.name?.trim() || null,
    p_source_event_id:
      body.mode === "manual" ? body.sourceEventId ?? null : null,
  });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const row = (Array.isArray(data) ? data[0] : data) as GiftRow | undefined;
  if (!row) {
    return NextResponse.json(
      { message: "Unexpected empty gift result." },
      { status: 500 },
    );
  }

  if (row.status === "invalid_email") {
    return NextResponse.json({ message: "Invalid email." }, { status: 400 });
  }
  if (row.status === "event_not_found") {
    return NextResponse.json({ message: "Unknown event." }, { status: 404 });
  }
  if (row.status === "no_credits") {
    await logClaimAttempt({
      eventId: row.gift_event_id,
      email: body.email.trim().toLowerCase(),
      ip: "admin",
      ua: "admin-gift",
      outcome: "no_credits",
      source: "admin",
      emailDelivered: false,
    });
    return NextResponse.json(
      {
        message:
          body.mode === "manual"
            ? "That event has no leftover credits left."
            : "No leftover credits in any event.",
      },
      { status: 409 },
    );
  }

  if (
    row.status !== "success" ||
    !row.gift_cursor_url ||
    !row.gift_event_id ||
    !row.gift_attendee_id
  ) {
    return NextResponse.json(
      { message: `Gift failed (${row.status}).` },
      { status: 500 },
    );
  }

  const { data: event } = await sb
    .from("events")
    .select("name,host,organizer,event_date")
    .eq("id", row.gift_event_id)
    .single();

  if (!event) {
    return NextResponse.json(
      { message: "Credit reserved but event missing for email." },
      { status: 500 },
    );
  }

  let emailDelivered = false;
  try {
    await sendCreditEmail({
      to: body.email.trim().toLowerCase(),
      name: body.name?.trim() || null,
      creditUrl: buildTrackedCreditUrl(row.gift_attendee_id, row.gift_cursor_url),
      event,
      purpose: "gift",
    });
    emailDelivered = true;
    await sb
      .from("attendees")
      .update({ credit_email_sent_at: new Date().toISOString() })
      .eq("id", row.gift_attendee_id);
  } catch (e) {
    console.warn("[gift] email failed", e);
  }

  await logClaimAttempt({
    eventId: row.gift_event_id,
    email: body.email.trim().toLowerCase(),
    ip: "admin",
    ua: "admin-gift",
    outcome: "success",
    source: "admin",
    emailDelivered,
  });

  return NextResponse.json({
    ok: true,
    emailDelivered,
    eventName: row.gift_event_name,
    eventSlug: row.gift_event_slug,
    message: emailDelivered
      ? `Gift sent to ${body.email.trim().toLowerCase()} from “${row.gift_event_name}”.`
      : `Credit reserved from “${row.gift_event_name}”, but email failed — use Resend on Attendees.`,
  });
}
