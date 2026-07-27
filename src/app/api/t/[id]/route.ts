import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyTrackedLinkSig } from "@/lib/trackLink";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IdSchema = z.string().uuid();

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!IdSchema.safeParse(id).success) {
    return NextResponse.redirect(new URL("/", req.url), 302);
  }

  const sig = new URL(req.url).searchParams.get("s") ?? "";
  if (!verifyTrackedLinkSig(id, sig)) {
    return NextResponse.json({ message: "Invalid link." }, { status: 403 });
  }

  const sb = getSupabaseAdmin();
  const { data: attendee } = await sb
    .from("attendees")
    .select("id,credit_id,credit_link_clicked_at")
    .eq("id", id)
    .maybeSingle();

  if (!attendee?.credit_id) {
    return NextResponse.redirect(new URL("/", req.url), 302);
  }

  const { data: credit } = await sb
    .from("credit_links")
    .select("cursor_url")
    .eq("id", attendee.credit_id)
    .maybeSingle();

  if (!credit?.cursor_url) {
    return NextResponse.redirect(new URL("/", req.url), 302);
  }

  if (!attendee.credit_link_clicked_at) {
    await sb
      .from("attendees")
      .update({ credit_link_clicked_at: new Date().toISOString() })
      .eq("id", id)
      .is("credit_link_clicked_at", null);
  }

  return NextResponse.redirect(credit.cursor_url, 302);
}
