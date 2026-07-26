import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAdminSession } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { toCsv } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IdSchema = z.string().uuid();

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!IdSchema.safeParse(id).success) {
    return NextResponse.json({ message: "Invalid event id." }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data: event, error: eventError } = await sb
    .from("events")
    .select("id,slug,name")
    .eq("id", id)
    .maybeSingle();

  if (eventError) {
    return NextResponse.json({ message: eventError.message }, { status: 500 });
  }
  if (!event) {
    return NextResponse.json({ message: "Unknown event." }, { status: 404 });
  }

  const { data: credits, error } = await sb
    .from("credit_links")
    .select("cursor_url,created_at")
    .eq("event_id", id)
    .eq("used", false)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const rows = (credits ?? []).map(
    (c: { cursor_url: string; created_at: string }) => ({
      cursor_url: c.cursor_url,
      created_at: c.created_at,
      source_event_slug: event.slug as string,
      source_event_name: event.name as string,
    }),
  );

  const csv = toCsv(rows, [
    "cursor_url",
    "created_at",
    "source_event_slug",
    "source_event_name",
  ]);
  const filename = `cursor-leftover-credits-${event.slug}-${new Date()
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
