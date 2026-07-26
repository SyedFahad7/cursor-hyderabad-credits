import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAdminSession } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IdSchema = z.string().uuid();
const Body = z.object({
  targetEventId: z.string().uuid(),
});

type Ctx = { params: Promise<{ id: string }> };

type TransferRow = {
  status: "success" | "same_event" | "source_not_found" | "target_not_found";
  transferred: number;
};

export async function POST(req: Request, ctx: Ctx) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!IdSchema.safeParse(id).success) {
    return NextResponse.json({ message: "Invalid event id." }, { status: 400 });
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

  if (body.targetEventId === id) {
    return NextResponse.json(
      { message: "Source and target event must be different." },
      { status: 400 },
    );
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc("transfer_unused_credits", {
    p_source_event_id: id,
    p_target_event_id: body.targetEventId,
  });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const row = (Array.isArray(data) ? data[0] : data) as TransferRow | undefined;
  if (!row) {
    return NextResponse.json(
      { message: "Unexpected empty transfer result." },
      { status: 500 },
    );
  }

  if (row.status === "same_event") {
    return NextResponse.json(
      { message: "Source and target event must be different." },
      { status: 400 },
    );
  }
  if (row.status === "source_not_found" || row.status === "target_not_found") {
    return NextResponse.json({ message: "Unknown event." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    transferred: Number(row.transferred) || 0,
  });
}
