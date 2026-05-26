import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendCreditEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const sb = getSupabaseAdmin();
  const { data: attendee, error } = await sb
    .from("attendees")
    .select("id,email,name,claimed,credit_id")
    .eq("id", id)
    .single();

  if (error || !attendee) {
    return NextResponse.json({ message: "Attendee not found" }, { status: 404 });
  }
  if (!attendee.claimed || !attendee.credit_id) {
    return NextResponse.json(
      { message: "Attendee has no claimed credit to resend." },
      { status: 400 },
    );
  }

  const { data: credit, error: cErr } = await sb
    .from("credit_links")
    .select("cursor_url")
    .eq("id", attendee.credit_id)
    .single();

  if (cErr || !credit) {
    return NextResponse.json({ message: "Credit link missing." }, { status: 500 });
  }

  try {
    await sendCreditEmail({
      to: attendee.email,
      name: attendee.name,
      creditUrl: credit.cursor_url,
    });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Email failed" },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
