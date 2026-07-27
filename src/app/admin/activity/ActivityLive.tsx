"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fmtDateTime } from "@/lib/dates";

type EventRow = { id: string; slug: string; name: string };

type Attempt = {
  id: number;
  email: string | null;
  outcome: string;
  created_at: string;
  ip: string | null;
  event_id: string | null;
  user_agent: string | null;
  source: string | null;
  email_delivered: boolean | null;
};

type Webhook = {
  id: string;
  event_type: string | null;
  outcome: string | null;
  email: string | null;
  event_id: string | null;
  processed_at: string;
};

type Click = {
  id: string;
  email: string;
  name: string | null;
  event_id: string;
  credit_link_clicked_at: string | null;
  credit_email_sent_at: string | null;
  claimed_at: string | null;
};

type Analytics = {
  attempts: number;
  successes: number;
  emailsSent: number;
  emailsFailed: number;
  lumaCheckins: number;
  linkClicks: number;
  noCredits: number;
  notFound: number;
  webhookEvents: number;
  webhookIssues: number;
  clickRate: number;
  emailSuccessRate: number;
};

type Payload = {
  generatedAt: string;
  events: EventRow[];
  analytics: Analytics;
  attempts: Attempt[];
  webhooks: Webhook[];
  clicks: Click[];
};

const OUTCOME_STYLE: Record<string, string> = {
  success:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  duplicate:
    "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-200",
  not_found:
    "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  no_credits:
    "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-200",
  error:
    "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-200",
  rate_limited:
    "border-line bg-bg-subtle text-ink-muted",
  event_not_found:
    "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200",
};

function Chip({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${className}`}
    >
      {children}
    </span>
  );
}

export function ActivityLive() {
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [live, setLive] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const qs = new URLSearchParams();
      if (eventFilter) qs.set("event", eventFilter);
      if (sourceFilter) qs.set("source", sourceFilter);
      const res = await fetch(`/api/admin/activity?${qs.toString()}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as Payload & { message?: string };
      if (!res.ok) throw new Error(json.message ?? "Failed to load activity");
      setData(json);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setBusy(false);
    }
  }, [eventFilter, sourceFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => {
      void load();
    }, 5000);
    return () => clearInterval(t);
  }, [live, load]);

  const eventMap = useMemo(
    () => new Map((data?.events ?? []).map((e) => [e.id, e])),
    [data?.events],
  );

  const a = data?.analytics;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className="h-9 rounded-xl border border-line bg-bg px-3 text-sm"
          >
            <option value="">All events</option>
            {(data?.events ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="h-9 rounded-xl border border-line bg-bg px-3 text-sm"
          >
            <option value="">All sources</option>
            <option value="luma">Luma check-in</option>
            <option value="public">Public claim page</option>
            <option value="admin">Admin resend</option>
          </select>
          <button
            type="button"
            onClick={() => void load()}
            disabled={busy}
            className="btn-ghost h-9 px-3 text-sm disabled:opacity-40"
          >
            {busy ? "Refreshing…" : "Refresh"}
          </button>
          <label className="flex items-center gap-2 text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={live}
              onChange={(e) => setLive(e.target.checked)}
              className="h-4 w-4 rounded border-line accent-ink"
            />
            Live (5s)
          </label>
        </div>
        <p className="text-xs text-ink-dim">
          Last update:{" "}
          {data?.generatedAt ? fmtDateTime(data.generatedAt) : "—"} · last 24h
        </p>
      </div>

      {err && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300/90">
          {err}
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <Stat label="Attempts" value={a?.attempts ?? 0} />
        <Stat label="Credits claimed" value={a?.successes ?? 0} />
        <Stat label="Emails sent" value={a?.emailsSent ?? 0} tone="ok" />
        <Stat label="Email failed" value={a?.emailsFailed ?? 0} tone="warn" />
        <Stat label="Luma check-ins" value={a?.lumaCheckins ?? 0} />
        <Stat
          label="Link clicks"
          value={a?.linkClicks ?? 0}
          hint={a ? `${a.clickRate}% of emails` : undefined}
        />
        <Stat label="No credits" value={a?.noCredits ?? 0} tone="warn" />
        <Stat label="Not on list" value={a?.notFound ?? 0} tone="warn" />
        <Stat label="Webhook events" value={a?.webhookEvents ?? 0} />
        <Stat
          label="Webhook issues"
          value={a?.webhookIssues ?? 0}
          tone="warn"
        />
        <Stat
          label="Email success"
          value={`${a?.emailSuccessRate ?? 0}%`}
          tone="ok"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="panel overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">Live claim log</h2>
            <p className="text-xs text-ink-dim">
              Who claimed, email delivery, source, time
            </p>
          </div>
          <div className="max-h-[520px] overflow-auto scroll-thin">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="sticky top-0 bg-bg-panel text-left text-[11px] uppercase text-ink-dim">
                <tr>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Event</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Outcome</th>
                  <th className="px-3 py-2">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(data?.attempts ?? []).length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-8 text-center text-ink-dim"
                    >
                      No claim attempts in the last 24h.
                    </td>
                  </tr>
                )}
                {(data?.attempts ?? []).map((row) => (
                  <tr key={row.id} className="hover:bg-bg-subtle/60">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-ink-muted">
                      {fmtDateTime(row.created_at)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-ink">
                        {row.email ?? "—"}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-ink-muted">
                      {row.event_id
                        ? eventMap.get(row.event_id)?.name ?? "—"
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Chip className="border-line bg-bg-subtle text-ink-muted">
                        {row.source ?? "—"}
                      </Chip>
                    </td>
                    <td className="px-3 py-2">
                      <Chip
                        className={
                          OUTCOME_STYLE[row.outcome] ??
                          "border-line bg-bg-subtle text-ink-muted"
                        }
                      >
                        {row.outcome}
                      </Chip>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {row.email_delivered === true && (
                        <span className="text-emerald-700 dark:text-emerald-300">
                          sent
                        </span>
                      )}
                      {row.email_delivered === false && (
                        <span className="text-rose-700 dark:text-rose-300">
                          failed
                        </span>
                      )}
                      {row.email_delivered == null && (
                        <span className="text-ink-dim">n/a</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="panel overflow-hidden">
            <div className="border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">
                Luma webhook deliveries
              </h2>
              <p className="text-xs text-ink-dim">
                Check-ins, allowlist sync, unmapped / errors
              </p>
            </div>
            <div className="max-h-[280px] overflow-auto scroll-thin">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="sticky top-0 bg-bg-panel text-left text-[11px] uppercase text-ink-dim">
                  <tr>
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(data?.webhooks ?? []).length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-8 text-center text-ink-dim"
                      >
                        No Luma webhooks yet. Check in a guest to see events.
                      </td>
                    </tr>
                  )}
                  {(data?.webhooks ?? []).map((w) => (
                    <tr key={w.id} className="hover:bg-bg-subtle/60">
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-ink-muted">
                        {fmtDateTime(w.processed_at)}
                      </td>
                      <td className="px-3 py-2 text-ink">{w.email ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-ink-dim">
                        {w.event_type ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <Chip
                          className={
                            w.outcome?.includes("error") ||
                            w.outcome === "unmapped_event"
                              ? OUTCOME_STYLE.error
                              : w.outcome?.startsWith("checkin_success")
                                ? OUTCOME_STYLE.success
                                : "border-line bg-bg-subtle text-ink-muted"
                          }
                        >
                          {w.outcome ?? "—"}
                        </Chip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel overflow-hidden">
            <div className="border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">
                Credit link clicks
              </h2>
              <p className="text-xs text-ink-dim">
                First time they open the tracked link from the email
              </p>
            </div>
            <div className="max-h-[200px] overflow-auto scroll-thin">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="sticky top-0 bg-bg-panel text-left text-[11px] uppercase text-ink-dim">
                  <tr>
                    <th className="px-3 py-2">Clicked</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Event</th>
                    <th className="px-3 py-2">Email sent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(data?.clicks ?? []).length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-8 text-center text-ink-dim"
                      >
                        No link clicks yet.
                      </td>
                    </tr>
                  )}
                  {(data?.clicks ?? []).map((c) => (
                    <tr key={c.id} className="hover:bg-bg-subtle/60">
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-ink-muted">
                        {fmtDateTime(c.credit_link_clicked_at)}
                      </td>
                      <td className="px-3 py-2 text-ink">{c.email}</td>
                      <td className="px-3 py-2 text-xs text-ink-muted">
                        {eventMap.get(c.event_id)?.name ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-ink-dim">
                        {fmtDateTime(c.credit_email_sent_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "ok" | "warn";
}) {
  const toneClass =
    tone === "ok"
      ? "text-emerald-700 dark:text-emerald-300"
      : tone === "warn"
        ? "text-amber-700 dark:text-amber-300"
        : "text-ink";
  return (
    <div className="panel px-3 py-3 md:px-4">
      <div className="text-[11px] uppercase tracking-wide text-ink-dim">
        {label}
      </div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${toneClass}`}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-ink-dim">{hint}</div>}
    </div>
  );
}
