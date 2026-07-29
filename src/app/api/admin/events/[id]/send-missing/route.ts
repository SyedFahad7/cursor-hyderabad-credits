import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { claimAndEmailCredit } from "@/lib/claimCredit";
import { logSystem } from "@/lib/systemLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Emails are sent sequentially; cap per request so we stay well inside the
// function timeout. The response reports how many are left — click again.
const BATCH_SIZE = 40;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const sb = getSupabaseAdmin();

  const { data: event, error: eventErr } = await sb
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (eventErr || !event) {
    return NextResponse.json({ message: "Event not found." }, { status: 404 });
  }

  // Checked in at the door but never got a credit (pool was empty at the time).
  const { data: missing, error: missErr, count } = await sb
    .from("attendees")
    .select("id,email", { count: "exact" })
    .eq("event_id", id)
    .eq("claimed", false)
    .not("checked_in_at", "is", null)
    .order("checked_in_at", { ascending: true })
    .limit(BATCH_SIZE);
  if (missErr) {
    return NextResponse.json({ message: missErr.message }, { status: 500 });
  }

  const total = count ?? missing?.length ?? 0;
  if (!missing || missing.length === 0) {
    return NextResponse.json({
      ok: true,
      sent: 0,
      noCredits: 0,
      failed: 0,
      remaining: 0,
      message: "Nobody is waiting — every checked-in attendee has a credit.",
    });
  }

  let sent = 0;
  let noCredits = 0;
  let failed = 0;

  for (const a of missing) {
    const result = await claimAndEmailCredit({
      email: a.email,
      eventSlug: event.slug,
      event,
      ip: "admin",
      ua: "admin/send-missing",
      source: "admin",
    });

    if (
      (result.outcome === "success" || result.outcome === "already_claimed") &&
      result.emailDelivered
    ) {
      sent += 1;
    } else if (result.outcome === "no_credits") {
      noCredits += 1;
      // Pool is empty — no point trying the rest of the batch.
      break;
    } else {
      failed += 1;
    }
  }

  const remaining = Math.max(0, total - sent);

  await logSystem("info", "admin", `Send-missing for ${event.slug}: ${sent} sent`, {
    event: event.slug,
    sent,
    noCredits,
    failed,
    remaining,
  });

  return NextResponse.json({
    ok: true,
    sent,
    noCredits,
    failed,
    remaining,
    message:
      noCredits > 0
        ? `Sent ${sent}; credit pool ran out with ${remaining} attendee(s) still waiting. Import more URLs and run again.`
        : remaining > 0
          ? `Sent ${sent}; ${remaining} still waiting — click again to continue.`
          : `Sent ${sent}. Everyone who checked in now has a credit.`,
  });
}
