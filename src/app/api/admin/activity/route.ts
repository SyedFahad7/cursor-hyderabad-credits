import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const eventId = (searchParams.get("event") ?? "").trim() || null;
  const source = (searchParams.get("source") ?? "").trim() || null;
  const sinceIso =
    searchParams.get("since") ??
    new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const sb = getSupabaseAdmin();

  let attemptsQ = sb
    .from("claim_attempts")
    .select(
      "id,email,outcome,created_at,ip,event_id,user_agent,source,email_delivered",
    )
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(150);

  let webhooksQ = sb
    .from("webhook_deliveries")
    .select("id,event_type,outcome,email,event_id,processed_at")
    .gte("processed_at", sinceIso)
    .order("processed_at", { ascending: false })
    .limit(100);

  let clicksQ = sb
    .from("attendees")
    .select("id,email,name,event_id,credit_link_clicked_at,credit_email_sent_at,claimed_at")
    .not("credit_link_clicked_at", "is", null)
    .gte("credit_link_clicked_at", sinceIso)
    .order("credit_link_clicked_at", { ascending: false })
    .limit(50);

  if (eventId) {
    attemptsQ = attemptsQ.eq("event_id", eventId);
    webhooksQ = webhooksQ.eq("event_id", eventId);
    clicksQ = clicksQ.eq("event_id", eventId);
  }
  if (source) {
    attemptsQ = attemptsQ.eq("source", source);
  }

  const [attemptsRes, webhooksRes, clicksRes, eventsRes] = await Promise.all([
    attemptsQ,
    webhooksQ,
    clicksQ,
    sb.from("events").select("id,slug,name"),
  ]);

  const attempts = attemptsRes.data ?? [];
  const webhooks = webhooksRes.data ?? [];
  const clicks = clicksRes.data ?? [];

  const successes = attempts.filter((a) => a.outcome === "success");
  const emailsSent = attempts.filter((a) => a.email_delivered === true);
  const emailsFailed = attempts.filter(
    (a) =>
      a.email_delivered === false &&
      (a.outcome === "success" || a.outcome === "duplicate"),
  );
  const lumaCheckins = attempts.filter(
    (a) => a.source === "luma" && a.outcome === "success",
  );
  const noCredits = attempts.filter((a) => a.outcome === "no_credits");
  const notFound = attempts.filter((a) => a.outcome === "not_found");
  const webhookErrors = webhooks.filter(
    (w) =>
      w.outcome?.includes("error") ||
      w.outcome === "unmapped_event" ||
      w.outcome === "parse_error",
  );

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    events: eventsRes.data ?? [],
    analytics: {
      attempts: attempts.length,
      successes: successes.length,
      emailsSent: emailsSent.length,
      emailsFailed: emailsFailed.length,
      lumaCheckins: lumaCheckins.length,
      linkClicks: clicks.length,
      noCredits: noCredits.length,
      notFound: notFound.length,
      webhookEvents: webhooks.length,
      webhookIssues: webhookErrors.length,
      clickRate:
        emailsSent.length > 0
          ? Math.round((clicks.length / emailsSent.length) * 100)
          : 0,
      emailSuccessRate:
        successes.length +
          attempts.filter((a) => a.outcome === "duplicate").length >
        0
          ? Math.round(
              (emailsSent.length /
                Math.max(
                  1,
                  attempts.filter(
                    (a) =>
                      a.outcome === "success" || a.outcome === "duplicate",
                  ).length,
                )) *
                100,
            )
          : 0,
    },
    attempts,
    webhooks,
    clicks,
  });
}
