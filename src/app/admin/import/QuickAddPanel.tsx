"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

type Props = {
  events: { slug: string; name: string }[];
  initialEvent?: string;
};

type Result = {
  attendee?: { added: boolean; reason?: string };
  credit?: { added: boolean; reason?: string };
};

export function QuickAddPanel({ events, initialEvent }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eventSlug, setEventSlug] = useState(
    initialEvent && events.some((e) => e.slug === initialEvent)
      ? initialEvent
      : events[0]?.slug ?? "",
  );

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const email = String(fd.get("email") ?? "").trim();
    const name = String(fd.get("name") ?? "").trim();
    const cursor_url = String(fd.get("cursor_url") ?? "").trim();

    if (!email && !cursor_url) {
      setError("Enter an email, a Cursor URL, or both.");
      return;
    }

    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/admin/import/quick", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventSlug,
          email: email || undefined,
          name: name || undefined,
          cursor_url: cursor_url || undefined,
        }),
      });
      const json = (await res.json()) as Result & { message?: string };
      if (!res.ok) throw new Error(json.message ?? "Failed");
      setResult(json);
      formRef.current?.reset();
      router.refresh();
      // Re-focus email for rapid-fire entry
      setTimeout(() => emailRef.current?.focus(), 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink 2xl:text-[17px]">
            Quick add
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            One-off attendee or credit. Use this for walk-ins, extra promo
            codes, or fixing a typo. Fill one or both fields.
          </p>
        </div>
        <span className="hidden shrink-0 rounded-full border border-line bg-bg-subtle px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-wide text-ink-muted sm:inline-flex">
          Manual
        </span>
      </div>

      <form
        ref={formRef}
        onSubmit={onSubmit}
        className="space-y-3"
        autoComplete="off"
      >
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-ink">
            Target event
          </span>
          <select
            value={eventSlug}
            onChange={(e) => setEventSlug(e.target.value)}
            className="input"
            disabled={busy}
          >
            {events.map((e) => (
              <option key={e.slug} value={e.slug}>
                {e.name}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium text-ink">
              Email <span className="text-ink-dim font-normal">(optional)</span>
            </span>
            <input
              ref={emailRef}
              name="email"
              type="email"
              placeholder="walkin@example.com"
              className="input"
              disabled={busy}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-medium text-ink">
              Name <span className="text-ink-dim font-normal">(optional)</span>
            </span>
            <input
              name="name"
              type="text"
              placeholder="Alex Walkin"
              className="input"
              disabled={busy}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-ink">
            Cursor URL{" "}
            <span className="text-ink-dim font-normal">(optional)</span>
          </span>
          <input
            name="cursor_url"
            type="url"
            placeholder="https://cursor.com/referral?code=…"
            className="input"
            disabled={busy}
          />
        </label>

        {error && (
          <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300/90">
            {error}
          </p>
        )}

        {result && (
          <div className="rounded-xl border border-line bg-bg-subtle/60 p-3 text-[13px] space-y-1">
            {result.attendee && (
              <ResultLine
                label="Attendee"
                added={result.attendee.added}
                reason={result.attendee.reason}
              />
            )}
            {result.credit && (
              <ResultLine
                label="Credit"
                added={result.credit.added}
                reason={result.credit.reason}
              />
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-ink-dim">
            Enter another after submitting — the form stays focused for
            rapid-fire entry.
          </p>
          <button type="submit" disabled={busy} className="btn-primary w-auto">
            {busy ? "Adding…" : "Add"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ResultLine({
  label,
  added,
  reason,
}: {
  label: string;
  added: boolean;
  reason?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${
          added
            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
            : "bg-amber-400/15 text-amber-700 dark:text-amber-300"
        }`}
      >
        {added ? "✓" : "·"}
      </span>
      <span className="text-ink">
        <span className="font-medium">{label}:</span>{" "}
        <span className="text-ink-muted">
          {added ? "added" : `skipped — ${reason ?? "unknown"}`}
        </span>
      </span>
    </div>
  );
}
