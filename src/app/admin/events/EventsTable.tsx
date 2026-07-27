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
  const [msg, setMsg] = useState<string | null>(null);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [lumaIds, setLumaIds] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.event_id, r.luma_event_id ?? ""])),
  );

  async function saveLumaId(id: string, name: string) {
    setBusyId(id);
    setErr(null);
    setMsg(null);
    const value = (lumaIds[id] ?? "").trim();
    try {
      const res = await fetch(`/api/admin/events/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ luma_event_id: value || null }),
      });
      const json = (await res.json()) as { message?: string };
      if (!res.ok) throw new Error(json.message ?? "Failed");
      setMsg(
        value
          ? `Luma check-in auto-credit enabled for "${name}".`
          : `Luma event ID cleared for "${name}".`,
      );
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(id: string, next: boolean) {
    setBusyId(id);
    setErr(null);
    setMsg(null);
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
    if (
      !confirm(
        `Delete "${name}"? This is only allowed if the event has no attendees or credits.`,
      )
    )
      return;
    setBusyId(id);
    setErr(null);
    setMsg(null);
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

  async function transferLeftovers(
    source: EventStats,
    targetEventId: string,
  ) {
    const target = rows.find((r) => r.event_id === targetEventId);
    if (!target) {
      setErr("Pick a target event first.");
      return;
    }
    if (
      !confirm(
        `Transfer ${source.remaining_credits} leftover credit(s) from "${source.name}" to "${target.name}"?\n\nUsed/claimed credits stay on the source event.`,
      )
    ) {
      return;
    }

    setBusyId(source.event_id);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(
        `/api/admin/events/${source.event_id}/transfer-leftovers`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ targetEventId }),
        },
      );
      const json = (await res.json()) as {
        message?: string;
        transferred?: number;
      };
      if (!res.ok) throw new Error(json.message ?? "Transfer failed");
      setMsg(
        `Moved ${json.transferred ?? 0} leftover credit(s) to "${target.name}".`,
      );
      setTargets((prev) => {
        const next = { ...prev };
        delete next[source.event_id];
        return next;
      });
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Transfer failed");
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
      {msg && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200/90">
          {msg}
        </div>
      )}

      <div className="panel overflow-x-auto scroll-thin">
        <table className="w-full min-w-[760px] text-sm">
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
            {rows.map((e) => {
              const otherEvents = rows.filter(
                (r) => r.event_id !== e.event_id,
              );
              const selectedTarget = targets[e.event_id] ?? "";
              const busy = busyId === e.event_id;
              const canTransfer =
                e.remaining_credits > 0 &&
                Boolean(selectedTarget) &&
                !busy &&
                otherEvents.length > 0;

              return (
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
                    {e.luma_event_id && (
                      <div className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-300/90">
                        Luma check-in auto-credit enabled
                      </div>
                    )}
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
                    <div className="inline-flex flex-col items-end gap-2">
                      <div className="inline-flex flex-wrap items-center justify-end gap-2">
                        <Link
                          href={`/admin/import?event=${e.slug}`}
                          className="btn-ghost h-8 px-3 text-xs"
                        >
                          Import
                        </Link>
                        <a
                          href={`/api/admin/events/${e.event_id}/export-leftovers`}
                          className="btn-ghost h-8 px-3 text-xs"
                        >
                          Download leftovers
                        </a>
                        <button
                          type="button"
                          onClick={() => toggleActive(e.event_id, !e.active)}
                          disabled={busy}
                          className="btn-ghost h-8 px-3 text-xs disabled:opacity-40"
                        >
                          {e.active ? "Disable" : "Enable"}
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(e.event_id, e.name)}
                          disabled={busy}
                          className="h-8 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 text-xs text-rose-700 transition hover:bg-rose-500/20 disabled:opacity-40 dark:text-rose-200"
                        >
                          Delete
                        </button>
                      </div>

                      <div className="inline-flex flex-wrap items-center justify-end gap-2">
                        <input
                          value={lumaIds[e.event_id] ?? ""}
                          onChange={(ev) =>
                            setLumaIds((prev) => ({
                              ...prev,
                              [e.event_id]: ev.target.value,
                            }))
                          }
                          disabled={busy}
                          placeholder="Luma evt-…"
                          className="h-8 w-[140px] rounded-xl border border-line bg-bg px-2 text-xs text-ink disabled:opacity-40"
                          aria-label={`Luma event ID for ${e.name}`}
                        />
                        <button
                          type="button"
                          onClick={() => saveLumaId(e.event_id, e.name)}
                          disabled={
                            busy ||
                            (lumaIds[e.event_id] ?? "") ===
                              (e.luma_event_id ?? "")
                          }
                          className="btn-ghost h-8 px-3 text-xs disabled:opacity-40"
                        >
                          Save Luma ID
                        </button>
                      </div>

                      {otherEvents.length > 0 && (
                        <div className="inline-flex flex-wrap items-center justify-end gap-2">
                          <select
                            value={selectedTarget}
                            onChange={(ev) =>
                              setTargets((prev) => ({
                                ...prev,
                                [e.event_id]: ev.target.value,
                              }))
                            }
                            disabled={busy || e.remaining_credits === 0}
                            className="h-8 max-w-[180px] rounded-xl border border-line bg-bg px-2 text-xs text-ink disabled:opacity-40"
                            aria-label={`Transfer leftovers from ${e.name} to`}
                          >
                            <option value="">
                              {e.remaining_credits === 0
                                ? "No leftovers"
                                : "Move leftovers to…"}
                            </option>
                            {otherEvents.map((t) => (
                              <option key={t.event_id} value={t.event_id}>
                                {t.name}
                                {!t.active ? " (hidden)" : ""}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() =>
                              transferLeftovers(e, selectedTarget)
                            }
                            disabled={!canTransfer}
                            className="h-8 rounded-xl border border-line bg-bg-subtle px-3 text-xs text-ink transition hover:bg-bg disabled:opacity-40"
                          >
                            Transfer
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
