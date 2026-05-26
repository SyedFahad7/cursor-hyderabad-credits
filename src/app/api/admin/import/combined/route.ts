import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { parseCombinedCsv } from "@/lib/csv";
import { getEventBySlug } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const eventSlug = (searchParams.get("event") ?? "").trim();
  if (!eventSlug) {
    return NextResponse.json(
      { message: "Missing ?event=<slug>." },
      { status: 400 },
    );
  }
  const event = await getEventBySlug(eventSlug);
  if (!event) {
    return NextResponse.json({ message: "Unknown event." }, { status: 404 });
  }

  const text = await req.text();
  if (!text.trim()) {
    return NextResponse.json({ message: "Empty CSV." }, { status: 400 });
  }

  let parsed;
  try {
    parsed = parseCombinedCsv(text);
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Invalid CSV" },
      { status: 400 },
    );
  }

  if (!parsed.hasEmail && !parsed.hasUrl) {
    return NextResponse.json(
      {
        message:
          "CSV needs an 'email' column, a 'cursor_url' column, or both. Headers can be: email, cursor_url, promo_link, url, link, code, etc.",
      },
      { status: 400 },
    );
  }

  const sb = getSupabaseAdmin();
  const out: {
    attendees: { inserted: number; skipped: number };
    credits: { inserted: number; skipped: number };
    rejected: { row: number; reason: string }[];
  } = {
    attendees: { inserted: 0, skipped: 0 },
    credits: { inserted: 0, skipped: 0 },
    rejected: parsed.rejected.map((r) => ({ row: r.row, reason: r.reason })),
  };

  // --- Attendees ---
  if (parsed.attendees.length > 0) {
    const emails = parsed.attendees.map((r) => r.email);
    const { data: existing } = await sb
      .from("attendees")
      .select("email")
      .eq("event_id", event.id)
      .in("email", emails);
    const existingSet = new Set(
      (existing ?? []).map((r: { email: string }) => r.email.toLowerCase()),
    );
    const toInsert = parsed.attendees
      .filter((r) => !existingSet.has(r.email))
      .map((r) => ({ ...r, event_id: event.id }));
    out.attendees.skipped = parsed.attendees.length - toInsert.length;

    if (toInsert.length > 0) {
      const chunkSize = 500;
      for (let i = 0; i < toInsert.length; i += chunkSize) {
        const chunk = toInsert.slice(i, i + chunkSize);
        const { error } = await sb.from("attendees").insert(chunk);
        if (error) {
          return NextResponse.json(
            { message: `Attendee insert failed: ${error.message}` },
            { status: 500 },
          );
        }
      }
      out.attendees.inserted = toInsert.length;
    }
  }

  // --- Credits ---
  if (parsed.credits.length > 0) {
    const urls = parsed.credits.map((r) => r.cursor_url);
    const { data: existing } = await sb
      .from("credit_links")
      .select("cursor_url")
      .in("cursor_url", urls);
    const existingSet = new Set(
      (existing ?? []).map((r: { cursor_url: string }) => r.cursor_url),
    );
    const toInsert = parsed.credits
      .filter((r) => !existingSet.has(r.cursor_url))
      .map((r) => ({ ...r, event_id: event.id }));
    out.credits.skipped = parsed.credits.length - toInsert.length;

    if (toInsert.length > 0) {
      const chunkSize = 500;
      for (let i = 0; i < toInsert.length; i += chunkSize) {
        const chunk = toInsert.slice(i, i + chunkSize);
        const { error } = await sb.from("credit_links").insert(chunk);
        if (error) {
          return NextResponse.json(
            { message: `Credit insert failed: ${error.message}` },
            { status: 500 },
          );
        }
      }
      out.credits.inserted = toInsert.length;
    }
  }

  return NextResponse.json(out);
}
