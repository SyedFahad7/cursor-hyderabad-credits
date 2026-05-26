"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { fmtDateTime } from "@/lib/dates";

export type AttendeeRow = {
  id: string;
  event_id: string;
  email: string;
  name: string | null;
  claimed: boolean;
  claimed_at: string | null;
  credit_id: string | null;
  created_at: string;
  event_name?: string;
  event_slug?: string;
};

type Props = {
  rows: AttendeeRow[];
  events: { slug: string; name: string }[];
  initialQuery: string;
  initialStatus: "all" | "claimed" | "unclaimed";
  initialEvent: string;
};

export function AttendeesTable({
  rows,
  events,
  initialQuery,
  initialStatus,
  initialEvent,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(initialQuery);
  const [status, setStatus] = useState<"all" | "claimed" | "unclaimed">(
    initialStatus,
  );
  const [eventSlug, setEventSlug] = useState(initialEvent);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; msg: string } | null>(
    null,
  );
  const [, startTransition] = useTransition();

  function applyFilters(next: { q?: string; status?: string; event?: string }) {
    const sp = new URLSearchParams(params?.toString() ?? "");
    if (next.q !== undefined) {
      if (next.q) sp.set("q", next.q);
      else sp.delete("q");
    }
    if (next.status !== undefined) {
      if (next.status && next.status !== "all") sp.set("status", next.status);
      else sp.delete("status");
    }
    if (next.event !== undefined) {
      if (next.event) sp.set("event", next.event);
      else sp.delete("event");
    }
    startTransition(() => {
      router.push(`/admin/attendees?${sp.toString()}`);
    });
  }

  async function resend(id: string) {
    setBusyId(id);
    setFlash(null);
    try {
      const res = await fetch(`/api/admin/attendees/${id}/resend`, {
        method: "POST",
      });
      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok) throw new Error(json.message ?? "Failed");
      setFlash({ kind: "ok", msg: "Email re-sent." });
    } catch (e) {
      setFlash({ kind: "err", msg: e instanceof Error ? e.message : "Failed" });
    } finally {
      setBusyId(null);
    }
  }

  async function revoke(id: string) {
    if (
      !confirm("Revoke this attendee's credit? The link goes back into the pool.")
    )
      return;
    setBusyId(id);
    setFlash(null);
    try {
      const res = await fetch(`/api/admin/attendees/${id}/revoke`, {
        method: "POST",
      });
      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok) throw new Error(json.message ?? "Failed");
      setFlash({ kind: "ok", msg: "Credit revoked." });
      router.refresh();
    } catch (e) {
      setFlash({ kind: "err", msg: e instanceof Error ? e.message : "Failed" });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="panel flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="search"
            placeholder="Search by email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyFilters({ q });
            }}
            className="input"
          />
          <select
            value={eventSlug}
            onChange={(e) => {
              setEventSlug(e.target.value);
              applyFilters({ event: e.target.value });
            }}
            className="input sm:max-w-[220px]"
          >
            <option value="">All events</option>
            {events.map((e) => (
              <option key={e.slug} value={e.slug}>
                {e.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => applyFilters({ q })}
            className="btn-ghost shrink-0"
          >
            Search
          </button>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-line bg-bg-subtle p-1 text-xs">
          {(["all", "claimed", "unclaimed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatus(s);
                applyFilters({ status: s });
              }}
              className={`rounded-lg px-3 py-1.5 transition ${
                status === s ? "bg-line text-ink" : "text-ink-muted hover:text-ink"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {flash && (
        <div
          className={`rounded-xl border px-3 py-2 text-sm ${
            flash.kind === "ok"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
              : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-200"
          }`}
        >
          {flash.msg}
        </div>
      )}

      <div className="panel overflow-x-auto scroll-thin">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-xs uppercase text-ink-dim">
            <tr>
              <Th>Email</Th>
              <Th>Event</Th>
              <Th>Name</Th>
              <Th>Status</Th>
              <Th>Claimed at</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-dim">
                  No attendees match your filters.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-bg-subtle/60">
                <Td className="font-medium text-ink">{r.email}</Td>
                <Td className="text-ink-muted">
                  <span className="chip" title={r.event_slug}>
                    {r.event_name}
                  </span>
                </Td>
                <Td className="text-ink-muted">{r.name ?? "—"}</Td>
                <Td>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] ${
                      r.claimed
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                        : "border-line bg-bg-subtle text-ink-muted"
                    }`}
                  >
                    {r.claimed ? "claimed" : "pending"}
                  </span>
                </Td>
                <Td className="text-ink-muted">
                  {r.claimed_at ? fmtDateTime(r.claimed_at) : "—"}
                </Td>
                <Td className="text-right">
                  <div className="inline-flex gap-2">
                    <button
                      type="button"
                      onClick={() => resend(r.id)}
                      disabled={!r.claimed || busyId === r.id}
                      className="btn-ghost h-8 px-3 text-xs disabled:opacity-40"
                    >
                      {busyId === r.id ? "…" : "Resend"}
                    </button>
                    <button
                      type="button"
                      onClick={() => revoke(r.id)}
                      disabled={!r.claimed || busyId === r.id}
                      className="h-8 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 text-xs text-rose-700 transition hover:bg-rose-500/20 disabled:opacity-40 dark:text-rose-200"
                    >
                      Revoke
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-dim">
        Showing up to 200 attendees. Use search or event filter to narrow down.
      </p>
    </div>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <th className={`px-4 py-3 ${className ?? ""}`}>{children}</th>;
}
function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 align-middle ${className ?? ""}`}>{children}</td>
  );
}
