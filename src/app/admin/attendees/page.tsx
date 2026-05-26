import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { listEvents } from "@/lib/events";
import { AttendeesTable, type AttendeeRow } from "./AttendeesTable";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; status?: string; event?: string }>;

export default async function AttendeesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (!(await verifyAdminSession())) redirect("/admin/login");

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const status =
    params.status === "claimed" || params.status === "unclaimed"
      ? params.status
      : "all";
  const eventSlug = (params.event ?? "").trim();

  const events = await listEvents();
  const sb = getSupabaseAdmin();

  const selectedEvent = eventSlug
    ? events.find((e) => e.slug === eventSlug) ?? null
    : null;

  let query = sb
    .from("attendees")
    .select("id,event_id,email,name,claimed,claimed_at,credit_id,created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (selectedEvent) query = query.eq("event_id", selectedEvent.id);
  if (q) query = query.ilike("email", `%${q}%`);
  if (status === "claimed") query = query.eq("claimed", true);
  if (status === "unclaimed") query = query.eq("claimed", false);

  const { data, error } = await query;

  const rows = (data ?? []) as AttendeeRow[];

  // Quick lookup map for event name display
  const eventMap = new Map(events.map((e) => [e.id, e]));
  const rowsWithEvent = rows.map((r) => ({
    ...r,
    event_name: eventMap.get(r.event_id)?.name ?? "—",
    event_slug: eventMap.get(r.event_id)?.slug ?? "",
  }));

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="text-[1.75rem] font-semibold tracking-tight md:text-3xl 2xl:text-[2rem]">
          Attendees
        </h1>
        <p className="mt-1 text-sm text-ink-muted 2xl:text-[15px]">
          Search, resend the credit email, or revoke an issued credit.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          {error.message}
        </div>
      )}

      <AttendeesTable
        rows={rowsWithEvent}
        events={events.map((e) => ({ slug: e.slug, name: e.name }))}
        initialQuery={q}
        initialStatus={status}
        initialEvent={eventSlug}
      />
    </div>
  );
}
