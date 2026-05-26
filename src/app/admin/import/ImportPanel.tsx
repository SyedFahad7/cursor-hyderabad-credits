"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type Props = {
  kind: "attendees" | "credits";
  title: string;
  description: string;
  sampleHref?: string;
};

type Result = {
  inserted: number;
  skipped: number;
  rejected: { row: number; reason: string }[];
};

export function ImportPanel({ kind, title, description, sampleHref }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    setResult(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      const res = await fetch(`/api/admin/import/${kind}`, {
        method: "POST",
        headers: { "content-type": "text/csv" },
        body: text,
      });
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
    <div className="panel p-5">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <p className="mt-1 text-sm text-ink-muted">{description}</p>
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) upload(f);
        }}
        className="rounded-xl border border-dashed border-line bg-bg-subtle/60 p-6 text-center"
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
        {sampleHref && (
          <a
            href={sampleHref}
            download
            className="mt-3 inline-block text-xs text-ink-dim underline underline-offset-2 hover:text-ink-muted"
          >
            Download sample CSV
          </a>
        )}
      </div>

      {busy && <p className="mt-3 text-sm text-ink-muted">Uploading…</p>}

      {error && (
        <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-3 rounded-xl border border-line bg-bg-subtle/60 p-4 text-sm">
          <p className="text-ink">
            Imported <strong>{result.inserted}</strong> new ·{" "}
            <span className="text-ink-muted">skipped {result.skipped}</span>
            {result.rejected.length > 0 && (
              <>
                {" "}
                · <span className="text-rose-300">{result.rejected.length} rejected</span>
              </>
            )}
          </p>
          {result.rejected.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-ink-dim">
                Show rejected rows
              </summary>
              <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-ink-muted">
                {result.rejected.map((r) => (
                  <li key={r.row}>
                    Row {r.row}: {r.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
