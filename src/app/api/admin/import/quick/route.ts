import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAdminSession } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getEventBySlug } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z
  .object({
    eventSlug: z.string().min(2).max(60),
    email: z.string().email().max(320).optional(),
    name: z.string().max(200).optional(),
    cursor_url: z.string().url().max(2000).optional(),
  })
  .refine((b) => Boolean(b.email || b.cursor_url), {
    message: "Provide an email, a cursor_url, or both.",
  });

type Result = {
  attendee?: { added: boolean; reason?: string };
  credit?: { added: boolean; reason?: string };
};

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
            ? e.issues.map((i) => i.message).join("; ")
            : "Invalid request",
      },
      { status: 400 },
    );
  }

  const event = await getEventBySlug(body.eventSlug);
  if (!event) {
    return NextResponse.json({ message: "Unknown event." }, { status: 404 });
  }

  const sb = getSupabaseAdmin();
  const out: Result = {};

  if (body.email) {
    const email = body.email.trim().toLowerCase();
    const { data: existing } = await sb
      .from("attendees")
      .select("id")
      .eq("event_id", event.id)
      .eq("email", email)
      .maybeSingle();
    if (existing) {
      out.attendee = { added: false, reason: "already in this event" };
    } else {
      const { error } = await sb.from("attendees").insert({
        event_id: event.id,
        email,
        name: body.name?.trim() || null,
      });
      if (error) {
        out.attendee = { added: false, reason: error.message };
      } else {
        out.attendee = { added: true };
      }
    }
  }

  if (body.cursor_url) {
    const url = body.cursor_url.trim();
    const { data: existing } = await sb
      .from("credit_links")
      .select("id")
      .eq("cursor_url", url)
      .maybeSingle();
    if (existing) {
      out.credit = { added: false, reason: "already exists" };
    } else {
      const { error } = await sb.from("credit_links").insert({
        event_id: event.id,
        cursor_url: url,
      });
      if (error) {
        out.credit = { added: false, reason: error.message };
      } else {
        out.credit = { added: true };
      }
    }
  }

  return NextResponse.json(out);
}
