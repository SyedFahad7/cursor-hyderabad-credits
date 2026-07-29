"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type LogRow = {
  id: number;
  level: "info" | "warn" | "error" | string;
  source: string;
  message: string;
  detail: Record<string, unknown> | null;
  created_at: string;
};

const LEVEL_STYLES: Record<string, string> = {
  error: "bg-red-500/15 text-red-500 border-red-500/30",
  warn: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  info: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
};

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function DebugLogsWidget() {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);
  const [lastFetch, setLastFetch] = useState<string | null>(null);
  const openRef = useRef(open);
  openRef.current = open;

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (errorsOnly) params.set("level", "error");
      const res = await fetch(`/api/admin/debug-logs?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        setApiError(json?.message ?? `HTTP ${res.status}`);
        return;
      }
      if (!json.ok) {
        setApiError(json.error ?? "Unknown error");
        setHint(json.hint ?? null);
        setLogs([]);
        return;
      }
      setApiError(null);
      setHint(null);
      setLogs(json.logs ?? []);
      setLastFetch(new Date().toLocaleTimeString());
    } catch (e) {
      setApiError(e instanceof Error ? e.message : String(e));
    }
  }, [errorsOnly]);

  // Poll every 4s while the panel is open.
  useEffect(() => {
    if (!open) return;
    void fetchLogs();
    const t = setInterval(() => {
      if (openRef.current) void fetchLogs();
    }, 4000);
    return () => clearInterval(t);
  }, [open, fetchLogs]);

  const toggleExpanded = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyLogs = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(logs, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const errorCount = logs.filter((l) => l.level === "error").length;

  return (
    <>
      {/* Floating toggle button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Live debug logs"
        className="fixed bottom-5 right-5 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-bg-panel/90 text-ink-muted shadow-lg backdrop-blur transition hover:scale-105 hover:text-ink"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 2l1.5 1.5M16 2l-1.5 1.5M9 7.5a3 3 0 0 1 6 0v.5H9v-.5z" />
          <path d="M5 11a7 7 0 0 1 14 0v3a7 7 0 0 1-14 0v-3z" />
          <path d="M12 8v13M2 13h3M19 13h3M3 8l3 2M21 8l-3 2M3 19l3-2M21 19l-3-2" />
        </svg>
        {errorCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {errorCount > 99 ? "99+" : errorCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 right-5 z-50 flex max-h-[70vh] w-[min(480px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-xl border border-line bg-bg-panel/95 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between gap-2 border-b border-line/70 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[13px] font-semibold">Live debug logs</span>
              {lastFetch && (
                <span className="text-[11px] text-ink-dim">· {lastFetch}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setErrorsOnly((v) => !v)}
                className={`rounded-md border px-2 py-0.5 text-[11px] transition ${
                  errorsOnly
                    ? "border-red-500/40 bg-red-500/15 text-red-500"
                    : "border-line text-ink-muted hover:text-ink"
                }`}
              >
                Errors only
              </button>
              <button
                type="button"
                onClick={copyLogs}
                className="rounded-md border border-line px-2 py-0.5 text-[11px] text-ink-muted transition hover:text-ink"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-1.5 py-0.5 text-[13px] text-ink-dim transition hover:text-ink"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {apiError && (
              <div className="mb-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-[12px] text-red-500">
                <div className="font-semibold">Log fetch failed</div>
                <div className="mt-0.5 break-all">{apiError}</div>
                {hint && <div className="mt-1 text-ink-muted">{hint}</div>}
              </div>
            )}

            {!apiError && logs.length === 0 && (
              <div className="p-4 text-center text-[12px] text-ink-dim">
                No logs yet. Check someone in on Luma, or trigger a claim, and
                entries will appear here within a few seconds.
              </div>
            )}

            <ul className="space-y-1.5">
              {logs.map((log) => {
                const isOpen = expanded.has(log.id);
                return (
                  <li
                    key={log.id}
                    className="rounded-lg border border-line/60 bg-bg/60"
                  >
                    <button
                      type="button"
                      onClick={() => toggleExpanded(log.id)}
                      className="flex w-full items-start gap-2 px-2.5 py-1.5 text-left"
                    >
                      <span
                        className={`mt-0.5 shrink-0 rounded border px-1.5 py-0 text-[10px] font-semibold uppercase ${
                          LEVEL_STYLES[log.level] ??
                          "border-line text-ink-muted"
                        }`}
                      >
                        {log.level}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-[12px] leading-snug">
                          {log.message}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-ink-dim">
                          {log.source} · {fmtTime(log.created_at)}
                        </span>
                      </span>
                    </button>
                    {isOpen && log.detail && (
                      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all border-t border-line/50 px-2.5 py-1.5 text-[10.5px] leading-relaxed text-ink-muted">
                        {JSON.stringify(log.detail, null, 2)}
                      </pre>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
