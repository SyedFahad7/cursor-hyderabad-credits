"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { EventStats } from "@/lib/supabase";

type Props = {
  events: EventStats[];
};

export function GiftForm({ events }: Props) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [sourceEventId, setSourceEventId] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; msg: string } | null>(
    null,
  );

  const withLeftovers = useMemo(
    () =>
      [...events]
        .filter((e) => e.remaining_credits > 0)
        .sort((a, b) => {
          const ad = a.event_date ?? "";
          const bd = b.event_date ?? "";
          if (ad && bd && ad !== bd) return ad.localeCompare(bd);
          if (ad && !bd) return -1;
          if (!ad && bd) return 1;
          return a.name.localeCompare(b.name);
        }),
    [events],
  );

  const autoSource = withLeftovers[0] ?? null;
  const totalLeftovers = events.reduce((sum, e) => sum + e.remaining_credits, 0);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch("/api/admin/gift", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          name: name.trim() || null,
          mode,
          sourceEventId: mode === "manual" ? sourceEventId || null : null,
        }),
      });
      const json = (await res.json()) as { message?: string; ok?: boolean };
      if (!res.ok) throw new Error(json.message ?? "Gift failed");
      setFlash({ kind: "ok", msg: json.message ?? "Gift sent." });
      setEmail("");
      setName("");
    } catch (err) {
      setFlash({
        kind: "err",
        msg: err instanceof Error ? err.message : "Gift failed",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Events with leftovers" value={withLeftovers.length} />
        <Stat label="Total leftover credits" value={totalLeftovers} />
        <Stat
          label="Auto picks"
          value={autoSource ? autoSource.name : "—"}
          subtle
        />
      </section>

      <form onSubmit={onSubmit} className="panel max-w-xl space-y-4 p-5 md:p-6">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Send a gift</h2>
          <p className="mt-1 text-[12.5px] text-ink-dim">
            Pulls one unused leftover credit and emails it. Works for any email
            — even if they already claimed before.
          </p>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-ink">
            Recipient email
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="friend@example.com"
            className="input"
            disabled={busy}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-ink">
            Name <span className="font-normal text-ink-dim">(optional)</span>
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Optional"
            maxLength={120}
            className="input"
            disabled={busy}
          />
        </label>

        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-[12.5px] font-medium text-ink">
            Credit source
          </legend>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-bg-subtle/60 p-3">
            <input
              type="radio"
              name="mode"
              checked={mode === "auto"}
              onChange={() => setMode("auto")}
              className="mt-0.5 h-4 w-4 accent-ink"
              disabled={busy}
            />
            <span className="text-[12.5px] text-ink-muted">
              <span className="font-medium text-ink">Auto</span> — take one
              leftover from the oldest event that still has unused credits
              {autoSource ? (
                <>
                  {" "}
                  (currently{" "}
                  <strong className="text-ink">{autoSource.name}</strong>,{" "}
                  {autoSource.remaining_credits} left)
                </>
              ) : (
                " (none available)"
              )}
              .
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-bg-subtle/60 p-3">
            <input
              type="radio"
              name="mode"
              checked={mode === "manual"}
              onChange={() => setMode("manual")}
              className="mt-0.5 h-4 w-4 accent-ink"
              disabled={busy}
            />
            <span className="text-[12.5px] text-ink-muted">
              <span className="font-medium text-ink">Select event</span> — choose
              which event&apos;s leftover pool to use.
            </span>
          </label>
        </fieldset>

        {mode === "manual" && (
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium text-ink">
              Event pool
            </span>
            <select
              required={mode === "manual"}
              value={sourceEventId}
              onChange={(e) => setSourceEventId(e.target.value)}
              className="input"
              disabled={busy || withLeftovers.length === 0}
            >
              <option value="">Pick an event…</option>
              {withLeftovers.map((e) => (
                <option key={e.event_id} value={e.event_id}>
                  {e.name} — {e.remaining_credits} leftover
                  {!e.active ? " (hidden)" : ""}
                </option>
              ))}
            </select>
          </label>
        )}

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

        <button
          type="submit"
          disabled={busy || totalLeftovers === 0}
          className="btn-primary disabled:opacity-40"
        >
          {busy ? "Sending…" : "Send gift credit"}
        </button>

        {totalLeftovers === 0 && (
          <p className="text-[12px] text-amber-700 dark:text-amber-300/90">
            No leftover credits in any event. Import or transfer leftovers first.
          </p>
        )}
      </form>

      {withLeftovers.length > 0 && (
        <div className="panel overflow-x-auto scroll-thin">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="text-left text-[11px] uppercase text-ink-dim">
              <tr>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Leftovers</th>
                <th className="px-4 py-3">Pool</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {withLeftovers.map((e) => (
                <tr key={e.event_id} className="hover:bg-bg-subtle/60">
                  <td className="px-4 py-3 font-medium text-ink">{e.name}</td>
                  <td className="px-4 py-3 text-ink">{e.remaining_credits}</td>
                  <td className="px-4 py-3 text-ink-muted">{e.total_credits}</td>
                  <td className="px-4 py-3 text-ink-dim">
                    {e.active ? "active" : "hidden"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  subtle,
}: {
  label: string;
  value: string | number;
  subtle?: boolean;
}) {
  return (
    <div className="panel px-3 py-3 md:px-4">
      <div className="text-[11px] uppercase tracking-wide text-ink-dim">
        {label}
      </div>
      <div
        className={`mt-1 font-semibold text-ink ${
          subtle ? "truncate text-sm" : "text-xl tabular-nums"
        }`}
        title={typeof value === "string" ? value : undefined}
      >
        {value}
      </div>
    </div>
  );
}
