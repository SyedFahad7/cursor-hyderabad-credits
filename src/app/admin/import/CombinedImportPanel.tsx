"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type Props = {
  events: { slug: string; name: string }[];
  initialEvent?: string;
};

type Result = {
  attendees: { inserted: number; skipped: number };
  credits: { inserted: number; skipped: number };
  rejected: { row: number; reason: string }[];
};

export function CombinedImportPanel({ events, initialEvent }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [eventSlug, setEventSlug] = useState(
    initialEvent && events.some((e) => e.slug === initialEvent)
      ? initialEvent
      : events[0]?.slug ?? "",
  );

  async function upload(file: File) {
    if (!eventSlug) {
      setError("Pick a target event first.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      const res = await fetch(
        `/api/admin/import/combined?event=${encodeURIComponent(eventSlug)}`,
        {
          method: "POST",
          headers: { "content-type": "text/csv" },
          body: text,
        },
      );
      const json = (await res.json()) as Result & { message?: string };
      if (!res.ok) throw new Error(json.message ?? "Import failed");
      setResult(json);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel p-5 md:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink 2xl:text-[17px]">
            Combined import
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            One CSV with both columns. Paste your Luma email column next to the
            promo-URL column Cursor sends you, save, drop it here.
          </p>
        </div>
        <span className="hidden shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300 sm:inline-flex">
          Recommended
        </span>
      </div>

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

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) upload(f);
        }}
        className="mt-4 rounded-xl border border-dashed border-line bg-bg-subtle/60 p-8 text-center"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
        <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-bg-panel text-ink-muted">
          ↑
        </div>
        <p className="text-sm text-ink-muted">
          Drop a .csv file here or{" "}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-ink underline underline-offset-2"
          >
            browse
          </button>
        </p>
        {fileName && (
          <p className="mt-2 text-xs text-ink-dim">Selected: {fileName}</p>
        )}
        <p className="mt-3 text-[11px] text-ink-dim">
          Headers: <code className="rounded bg-bg-panel px-1">email</code> and{" "}
          <code className="rounded bg-bg-panel px-1">cursor_url</code> (or any
          of <em>promo_link, url, link, code</em>). Order doesn&apos;t matter.
        </p>
        <a
          href="/samples/combined.sample.csv"
          download
          className="mt-2 inline-block text-[11px] text-ink-dim underline underline-offset-2 hover:text-ink-muted"
        >
          Download sample CSV
        </a>
      </div>

      {busy && <p className="mt-3 text-sm text-ink-muted">Uploading…</p>}

      {error && (
        <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300/90">
          {error}
        </p>
      )}

      {result && (
        <ResultSummary result={result} eventSlug={eventSlug} />
      )}
    </div>
  );
}

function ResultSummary({
  result,
  eventSlug,
}: {
  result: Result;
  eventSlug: string;
}) {
  const aAdded = result.attendees.inserted;
  const aSkipped = result.attendees.skipped;
  const cAdded = result.credits.inserted;
  const cSkipped = result.credits.skipped;
  const totalParsed = aAdded + aSkipped + cAdded + cSkipped;

  // All rows already existed — most common confusion point.
  const allDuplicates = aAdded === 0 && cAdded === 0 && totalParsed > 0;
  const partialSuccess = aAdded + cAdded > 0;

  return (
    <div className="mt-4 space-y-3">
      {allDuplicates && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-4 text-[13px]">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
            <div className="flex-1">
              <p className="font-medium text-ink">
                Already imported — nothing new added.
              </p>
              <p className="mt-1 text-ink-muted">
                These {aSkipped} attendees and {cSkipped} credits are already in
                the database. You probably uploaded this file before. Your event
                is set up — no action needed.
              </p>
            </div>
          </div>
        </div>
      )}

      {partialSuccess && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4 text-[13px]">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
            <div className="flex-1">
              <p className="font-medium text-ink">
                {aAdded > 0 && `${aAdded} attendees added`}
                {aAdded > 0 && cAdded > 0 && " · "}
                {cAdded > 0 && `${cAdded} credits added`}
              </p>
              {(aSkipped > 0 || cSkipped > 0) && (
                <p className="mt-1 text-ink-muted">
                  {aSkipped > 0 &&
                    `${aSkipped} attendee${aSkipped === 1 ? "" : "s"} skipped (already in this event)`}
                  {aSkipped > 0 && cSkipped > 0 && " · "}
                  {cSkipped > 0 &&
                    `${cSkipped} credit${cSkipped === 1 ? "" : "s"} skipped (URL already exists in the system)`}
                  .
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ResultBox
          label="Attendees"
          inserted={aAdded}
          skipped={aSkipped}
          href={`/admin/attendees?event=${eventSlug}`}
        />
        <ResultBox
          label="Credit URLs"
          inserted={cAdded}
          skipped={cSkipped}
          href={`/admin/credits?event=${eventSlug}`}
        />
        {result.rejected.length > 0 && (
          <details className="rounded-xl border border-rose-500/25 bg-rose-500/[0.05] p-3 text-[12.5px] sm:col-span-2">
            <summary className="cursor-pointer text-rose-700 dark:text-rose-300">
              {result.rejected.length} rejected row
              {result.rejected.length === 1 ? "" : "s"}
            </summary>
            <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-ink-muted">
              {result.rejected.map((r) => (
                <li key={r.row}>
                  Row {r.row}: {r.reason}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}

function ResultBox({
  label,
  inserted,
  skipped,
  href,
}: {
  label: string;
  inserted: number;
  skipped: number;
  href?: string;
}) {
  const total = inserted + skipped;
  return (
    <div className="rounded-xl border border-line bg-bg-subtle/60 p-3 text-[13px]">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wide text-ink-dim">
          {label}
        </div>
        {href && total > 0 && (
          <a
            href={href}
            className="text-[11px] text-ink-dim underline underline-offset-2 hover:text-ink-muted"
          >
            View →
          </a>
        )}
      </div>
      <div className="mt-1 text-ink">
        <span className="text-[17px] font-semibold">{inserted}</span>
        <span className="ml-1 text-ink-muted">added</span>
        {skipped > 0 && (
          <span className="ml-2 text-ink-dim">· {skipped} skipped</span>
        )}
      </div>
      {total > 0 && (
        <div className="mt-1 text-[11px] text-ink-dim">{total} in CSV</div>
      )}
    </div>
  );
}
