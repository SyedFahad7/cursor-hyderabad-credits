import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAdminSession } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchBody = z.object({
  name: z.string().min(2).max(120).optional(),
  tagline: z.string().max(200).optional().nullable(),
  credit_amount: z.string().max(80).optional().nullable(),
  event_date: z.string().optional().nullable(),
  organizer: z.string().max(120).optional().nullable(),
  host: z.string().max(120).optional().nullable(),
  active: z.boolean().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  let body;
  try {
    body = PatchBody.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      {
        message:
          e instanceof z.ZodError
            ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
            : "Invalid request",
      },
      { status: 400 },
    );
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("events")
    .update({
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.tagline !== undefined && { tagline: body.tagline?.trim() || null }),
      ...(body.credit_amount !== undefined && {
        credit_amount: body.credit_amount?.trim() || null,
      }),
      ...(body.event_date !== undefined && { event_date: body.event_date || null }),
      ...(body.organizer !== undefined && { organizer: body.organizer?.trim() || null }),
      ...(body.host !== undefined && { host: body.host?.trim() || null }),
      ...(body.active !== undefined && { active: body.active }),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, event: data });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const sb = getSupabaseAdmin();

  // Refuse if attendees/credits exist — admin should explicitly empty first.
  const [attRes, credRes] = await Promise.all([
    sb.from("attendees").select("id", { count: "exact", head: true }).eq("event_id", id),
    sb.from("credit_links").select("id", { count: "exact", head: true }).eq("event_id", id),
  ]);
  const attCount = attRes.count ?? 0;
  const credCount = credRes.count ?? 0;
  if (attCount > 0 || credCount > 0) {
    return NextResponse.json(
      {
        message: `Cannot delete: event still has ${attCount} attendees and ${credCount} credits. Remove them first.`,
      },
      { status: 409 },
    );
  }

  const { error } = await sb.from("events").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
