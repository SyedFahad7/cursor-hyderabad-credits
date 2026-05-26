"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { EventStats } from "@/lib/supabase";
import { fmtDate } from "@/lib/dates";

export function EventsTable({ rows }: { rows: EventStats[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function toggleActive(id: string, next: boolean) {
    setBusyId(id);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/events/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: next }),
      });
      const json = (await res.json()) as { message?: string };
      if (!res.ok) throw new Error(json.message ?? "Failed");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This is only allowed if the event has no attendees or credits.`)) return;
    setBusyId(id);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/events/${id}`, { method: "DELETE" });
      const json = (await res.json()) as { message?: string };
      if (!res.ok) throw new Error(json.message ?? "Failed");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      {err && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300/90">
          {err}
        </div>
      )}

      <div className="panel overflow-x-auto scroll-thin">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wide text-ink-dim md:text-xs">
            <tr>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Attendees</th>
              <th className="px-4 py-3">Credits</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-dim">
                  No events yet. Create one to start.
                </td>
              </tr>
            )}
            {rows.map((e) => (
              <tr key={e.event_id} className="hover:bg-bg-subtle/60">
                <td className="px-4 py-3">
                  <div className="font-medium text-ink">{e.name}</div>
                  <div className="text-[11.5px] text-ink-dim">
                    <Link
                      href={`/e/${e.slug}`}
                      target="_blank"
                      className="underline underline-offset-2 hover:text-ink-muted"
                    >
                      /e/{e.slug}
                    </Link>
                    {e.event_date && (
                      <>
                        {" · "}
                        {fmtDate(e.event_date)}
                      </>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-ink-muted">
                  <span className="text-ink">{e.total_claimed}</span>
                  <span className="text-ink-dim"> / {e.total_attendees}</span>
                </td>
                <td className="px-4 py-3 text-ink-muted">
                  <span className="text-ink">{e.remaining_credits}</span>
                  <span className="text-ink-dim"> / {e.total_credits}</span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] ${
                      e.active
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                        : "border-line bg-bg-subtle text-ink-muted"
                    }`}
                  >
                    {e.active ? "active" : "hidden"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex flex-wrap items-center justify-end gap-2">
                    <Link
                      href={`/admin/import?event=${e.slug}`}
                      className="btn-ghost h-8 px-3 text-xs"
                    >
                      Import
                    </Link>
                    <button
                      type="button"
                      onClick={() => toggleActive(e.event_id, !e.active)}
                      disabled={busyId === e.event_id}
                      className="btn-ghost h-8 px-3 text-xs disabled:opacity-40"
                    >
                      {e.active ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(e.event_id, e.name)}
                      disabled={busyId === e.event_id}
                      className="h-8 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 text-xs text-rose-700 transition hover:bg-rose-500/20 disabled:opacity-40 dark:text-rose-200"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
