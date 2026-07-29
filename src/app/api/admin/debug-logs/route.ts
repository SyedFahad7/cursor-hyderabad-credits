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
  const level = (searchParams.get("level") ?? "").trim() || null;
  // Incremental polling: only return rows newer than this id.
  const afterId = Number(searchParams.get("after") ?? 0) || 0;

  const sb = getSupabaseAdmin();
  let q = sb
    .from("system_logs")
    .select("id,level,source,message,detail,created_at")
    .order("id", { ascending: false })
    .limit(200);

  if (level) q = q.eq("level", level);
  if (afterId > 0) q = q.gt("id", afterId);

  const { data, error } = await q;

  if (error) {
    // Most likely: debug-logs-migration.sql not run yet.
    return NextResponse.json({
      ok: false,
      logs: [],
      error: error.message,
      hint: error.message.includes("system_logs")
        ? "Run supabase/debug-logs-migration.sql in the Supabase SQL editor."
        : undefined,
    });
  }

  return NextResponse.json({ ok: true, logs: data ?? [] });
}
