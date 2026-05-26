/**
 * Locale-stable date formatters.
 *
 * Why: `new Date(x).toLocaleString()` (no args) uses the runtime's locale.
 * The Next.js server is en-US, your browser is en-IN — that's a hydration
 * mismatch. By pinning the locale we render the same string everywhere.
 */

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const DATETIME_FMT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function fmtDate(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "—";
  return DATE_FMT.format(d);
}

export function fmtDateTime(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "—";
  return DATETIME_FMT.format(d);
}
