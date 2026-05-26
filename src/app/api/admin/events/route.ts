import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAdminSession } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { SLUG_REGEX } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  slug: z.string().regex(SLUG_REGEX).min(2).max(60),
  name: z.string().min(2).max(120),
  tagline: z.string().max(200).optional().nullable(),
  credit_amount: z.string().max(80).optional().nullable(),
  event_date: z.string().optional().nullable(),
  organizer: z.string().max(120).optional().nullable(),
  host: z.string().max(120).optional().nullable(),
  active: z.boolean().default(true),
});

export async function POST(req: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = Body.parse(await req.json());
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
    .insert({
      slug: body.slug.toLowerCase().trim(),
      name: body.name.trim(),
      tagline: body.tagline?.trim() || null,
      credit_amount: body.credit_amount?.trim() || null,
      event_date: body.event_date || null,
      organizer: body.organizer?.trim() || null,
      host: body.host?.trim() || null,
      active: body.active,
    })
    .select()
    .single();

  if (error) {
    const status = error.code === "23505" ? 409 : 500;
    return NextResponse.json({ message: error.message }, { status });
  }
  return NextResponse.json({ ok: true, event: data });
}
