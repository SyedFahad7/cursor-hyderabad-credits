import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { toCsv } from "@/lib/csv";
import { getEventBySlug } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const eventSlug = (searchParams.get("event") ?? "").trim();
  const event = eventSlug ? await getEventBySlug(eventSlug) : null;
  if (eventSlug && !event) {
    return NextResponse.json({ message: "Unknown event." }, { status: 404 });
  }

  const sb = getSupabaseAdmin();
  let query = sb
    .from("attendees")
    .select("event_id,email,name,claimed,claimed_at,credit_id")
    .order("claimed_at", { ascending: false });
  if (event) query = query.eq("event_id", event.id);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const allEvents = await sb.from("events").select("id,slug,name");
  const eventMap = new Map(
    ((allEvents.data ?? []) as { id: string; slug: string; name: string }[]).map(
      (e) => [e.id, e],
    ),
  );

  let creditMap = new Map<string, string>();
  const creditIds = (data ?? [])
    .map((r: { credit_id: string | null }) => r.credit_id)
    .filter((x: string | null): x is string => Boolean(x));

  if (creditIds.length > 0) {
    const { data: credits } = await sb
      .from("credit_links")
      .select("id,cursor_url")
      .in("id", creditIds);
    creditMap = new Map(
      (credits ?? []).map((c: { id: string; cursor_url: string }) => [
        c.id,
        c.cursor_url,
      ]),
    );
  }

  const rows = (data ?? []).map(
    (r: {
      event_id: string;
      email: string;
      name: string | null;
      claimed: boolean;
      claimed_at: string | null;
      credit_id: string | null;
    }) => ({
      event_slug: eventMap.get(r.event_id)?.slug ?? "",
      event_name: eventMap.get(r.event_id)?.name ?? "",
      email: r.email,
      name: r.name ?? "",
      claimed: r.claimed ? "yes" : "no",
      claimed_at: r.claimed_at ?? "",
      cursor_url: r.credit_id ? creditMap.get(r.credit_id) ?? "" : "",
    }),
  );

  const csv = toCsv(rows, [
    "event_slug",
    "event_name",
    "email",
    "name",
    "claimed",
    "claimed_at",
    "cursor_url",
  ]);
  const namePart = event ? event.slug : "all";
  const filename = `cursor-claims-${namePart}-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
