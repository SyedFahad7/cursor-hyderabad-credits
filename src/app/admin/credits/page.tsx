import { redirect } from "next/navigation";
import Link from "next/link";
import { verifyAdminSession } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { listEvents, listEventStats } from "@/lib/events";
import { fmtDateTime } from "@/lib/dates";
import { CreditsFilter } from "./CreditsFilter";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  event_id: string;
  cursor_url: string;
  used: boolean;
  assigned_to: string | null;
  assigned_at: string | null;
};

type SearchParams = Promise<{ event?: string }>;

export default async function CreditsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (!(await verifyAdminSession())) redirect("/admin/login");

  const params = await searchParams;
  const eventSlug = (params.event ?? "").trim();

  const [events, eventStats] = await Promise.all([
    listEvents(),
    listEventStats(),
  ]);

  const selectedEvent = eventSlug
    ? events.find((e) => e.slug === eventSlug) ?? null
    : null;

  const sb = getSupabaseAdmin();
  let query = sb
    .from("credit_links")
    .select("id,event_id,cursor_url,used,assigned_to,assigned_at")
    .order("created_at", { ascending: true })
    .limit(500);
  if (selectedEvent) query = query.eq("event_id", selectedEvent.id);

  const { data: credits } = await query;
  const rows = (credits ?? []) as Row[];

  // Aggregate counts: if filtered to one event, use that event's stats; else global
  const total = selectedEvent
    ? eventStats.find((s) => s.slug === selectedEvent.slug)?.total_credits ?? rows.length
    : eventStats.reduce((sum, s) => sum + s.total_credits, 0);
  const remaining = selectedEvent
    ? eventStats.find((s) => s.slug === selectedEvent.slug)?.remaining_credits ?? 0
    : eventStats.reduce((sum, s) => sum + s.remaining_credits, 0);
  const used = total - remaining;

  const eventMap = new Map(events.map((e) => [e.id, e]));

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[1.75rem] font-semibold tracking-tight md:text-3xl 2xl:text-[2rem]">
            Credits
          </h1>
          <p className="mt-1 text-sm text-ink-muted 2xl:text-[15px]">
            The pool of Cursor credit URLs. Raw URLs are admin-only.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-ink-muted">
          <span className="chip">
            Total: <strong className="text-ink ml-1">{total}</strong>
          </span>
          <span className="chip">
            Used: <strong className="text-ink ml-1">{used}</strong>
          </span>
          <span className="chip">
            Remaining: <strong className="text-ink ml-1">{remaining}</strong>
          </span>
        </div>
      </div>

      <CreditsFilter
        events={events.map((e) => ({ slug: e.slug, name: e.name }))}
        initialEvent={eventSlug}
      />

      <div className="panel overflow-x-auto scroll-thin">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-xs uppercase text-ink-dim">
            <tr>
              <th className="px-4 py-3">Cursor URL</th>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Assigned at</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-ink-dim">
                  No credit URLs yet. Import some on the{" "}
                  <Link className="text-ink underline" href="/admin/import">
                    Import
                  </Link>{" "}
                  page.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const ev = eventMap.get(r.event_id);
              return (
                <tr key={r.id} className="hover:bg-bg-subtle/60">
                  <td className="px-4 py-3">
                    <code className="break-all rounded bg-bg-subtle px-2 py-1 text-[12px] text-ink-muted">
                      {r.cursor_url}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <span className="chip">{ev?.name ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] ${
                        r.used
                          ? "border-amber-400/30 bg-amber-400/10 text-amber-700 dark:text-amber-200"
                          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                      }`}
                    >
                      {r.used ? "used" : "available"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {r.assigned_at
                      ? fmtDateTime(r.assigned_at)
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-dim">Showing up to 500 rows.</p>
    </div>
  );
}
