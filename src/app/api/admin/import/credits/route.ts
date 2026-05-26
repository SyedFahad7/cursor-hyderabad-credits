import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { parseCreditsCsv } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const text = await req.text();
  if (!text.trim()) {
    return NextResponse.json({ message: "Empty CSV." }, { status: 400 });
  }

  let parsed;
  try {
    parsed = parseCreditsCsv(text);
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Invalid CSV" },
      { status: 400 },
    );
  }

  if (parsed.rows.length === 0) {
    return NextResponse.json({
      inserted: 0,
      skipped: 0,
      rejected: parsed.rejected,
    });
  }

  const sb = getSupabaseAdmin();
  const urls = parsed.rows.map((r) => r.cursor_url);

  const { data: existing } = await sb
    .from("credit_links")
    .select("cursor_url")
    .in("cursor_url", urls);
  const existingSet = new Set((existing ?? []).map((r: { cursor_url: string }) => r.cursor_url));

  const toInsert = parsed.rows.filter((r) => !existingSet.has(r.cursor_url));
  const skipped = parsed.rows.length - toInsert.length;

  if (toInsert.length > 0) {
    const chunkSize = 500;
    for (let i = 0; i < toInsert.length; i += chunkSize) {
      const chunk = toInsert.slice(i, i + chunkSize);
      const { error } = await sb.from("credit_links").insert(chunk);
      if (error) {
        return NextResponse.json(
          { message: `Insert failed: ${error.message}` },
          { status: 500 },
        );
      }
    }
  }

  return NextResponse.json({
    inserted: toInsert.length,
    skipped,
    rejected: parsed.rejected.map((r) => ({ row: r.row, reason: r.reason })),
  });
}
