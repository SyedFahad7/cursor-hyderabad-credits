import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendCreditEmail } from "@/lib/email";
import { buildTrackedCreditUrl } from "@/lib/trackLink";
import { logClaimAttempt } from "@/lib/claimCredit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReissueRow = {
  status: "success" | "not_found" | "event_not_found" | "no_credits";
  cursor_url: string | null;
  attendee_id: string | null;
  attendee_name: string | null;
  event_name: string | null;
};

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const sb = getSupabaseAdmin();

  const { data: attendee, error: aErr } = await sb
    .from("attendees")
    .select("id,event_id,email,name,claimed")
    .eq("id", id)
    .maybeSingle();

  if (aErr || !attendee) {
    return NextResponse.json({ message: "Attendee not found" }, { status: 404 });
  }

  const { data, error } = await sb.rpc("reissue_credit", {
    p_attendee_id: id,
  });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const row = (Array.isArray(data) ? data[0] : data) as ReissueRow | undefined;
  if (!row) {
    return NextResponse.json(
      { message: "Unexpected empty reissue result." },
      { status: 500 },
    );
  }

  if (row.status === "not_found") {
    return NextResponse.json({ message: "Attendee not found" }, { status: 404 });
  }
  if (row.status === "no_credits") {
    await logClaimAttempt({
      eventId: attendee.event_id,
      email: attendee.email,
      ip: "admin",
      ua: "admin-reissue",
      outcome: "no_credits",
      source: "admin",
      emailDelivered: false,
    });
    return NextResponse.json(
      {
        message:
          "No unused credits left in this event's pool. Import more credits, then try Reissue again.",
      },
      { status: 409 },
    );
  }
  if (row.status !== "success" || !row.cursor_url) {
    return NextResponse.json(
      { message: `Reissue failed (${row.status}).` },
      { status: 500 },
    );
  }

  const { data: event } = await sb
    .from("events")
    .select("name,host,organizer,event_date")
    .eq("id", attendee.event_id)
    .single();

  if (!event) {
    return NextResponse.json(
      { message: "Credit reassigned but event missing for email." },
      { status: 500 },
    );
  }

  let emailDelivered = false;
  try {
    await sendCreditEmail({
      to: attendee.email,
      name: attendee.name,
      creditUrl: buildTrackedCreditUrl(attendee.id, row.cursor_url),
      event,
    });
    emailDelivered = true;
    await sb
      .from("attendees")
      .update({ credit_email_sent_at: new Date().toISOString() })
      .eq("id", attendee.id);
  } catch (e) {
    console.warn("[reissue] email failed", e);
  }

  await logClaimAttempt({
    eventId: attendee.event_id,
    email: attendee.email,
    ip: "admin",
    ua: "admin-reissue",
    outcome: "success",
    source: "admin",
    emailDelivered,
  });

  return NextResponse.json({
    ok: true,
    emailDelivered,
    message: emailDelivered
      ? "Fresh credit assigned and emailed."
      : "Fresh credit assigned, but email failed — use Resend.",
  });
}
