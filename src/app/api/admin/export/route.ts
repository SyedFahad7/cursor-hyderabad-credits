import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { toCsv } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("attendees")
    .select("email,name,claimed,claimed_at,credit_id")
    .order("claimed_at", { ascending: false });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

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
      email: string;
      name: string | null;
      claimed: boolean;
      claimed_at: string | null;
      credit_id: string | null;
    }) => ({
      email: r.email,
      name: r.name ?? "",
      claimed: r.claimed ? "yes" : "no",
      claimed_at: r.claimed_at ?? "",
      cursor_url: r.credit_id ? creditMap.get(r.credit_id) ?? "" : "",
    }),
  );

  const csv = toCsv(rows, ["email", "name", "claimed", "claimed_at", "cursor_url"]);
  const filename = `cursor-hyderabad-claims-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
