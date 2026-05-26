import { parse } from "csv-parse/sync";
import { z } from "zod";

const emailRow = z.object({
  email: z.string().email(),
  name: z.string().optional().nullable(),
});

const creditRow = z.object({
  cursor_url: z.string().url(),
});

export type AttendeeRow = { email: string; name: string | null };
export type CreditRow = { cursor_url: string };

export type ParseResult<T> = {
  rows: T[];
  rejected: { row: number; reason: string; raw: Record<string, unknown> }[];
};

function normaliseHeader(h: string) {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

export function parseAttendeesCsv(input: string): ParseResult<AttendeeRow> {
  const records = parse(input, {
    columns: (hdrs: string[]) => hdrs.map(normaliseHeader),
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as Record<string, string>[];

  const rows: AttendeeRow[] = [];
  const rejected: ParseResult<AttendeeRow>["rejected"] = [];
  const seen = new Set<string>();

  records.forEach((raw, idx) => {
    const candidate = {
      email: raw.email ?? raw.e_mail ?? raw.email_address ?? "",
      name:
        raw.name ?? raw.full_name ?? raw.first_name
          ? `${raw.first_name ?? ""} ${raw.last_name ?? ""}`.trim()
          : raw.name ?? null,
    };
    const result = emailRow.safeParse(candidate);
    if (!result.success) {
      rejected.push({
        row: idx + 2,
        reason: result.error.issues.map((i) => i.message).join("; "),
        raw,
      });
      return;
    }
    const email = result.data.email.toLowerCase().trim();
    if (seen.has(email)) {
      rejected.push({ row: idx + 2, reason: "Duplicate email in CSV", raw });
      return;
    }
    seen.add(email);
    rows.push({ email, name: (result.data.name ?? null) || null });
  });

  return { rows, rejected };
}

export function parseCreditsCsv(input: string): ParseResult<CreditRow> {
  const records = parse(input, {
    columns: (hdrs: string[]) => hdrs.map(normaliseHeader),
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as Record<string, string>[];

  const rows: CreditRow[] = [];
  const rejected: ParseResult<CreditRow>["rejected"] = [];
  const seen = new Set<string>();

  records.forEach((raw, idx) => {
    const url =
      raw.cursor_url ?? raw.url ?? raw.link ?? raw.credit_url ?? raw.code ?? "";
    const result = creditRow.safeParse({ cursor_url: url });
    if (!result.success) {
      rejected.push({
        row: idx + 2,
        reason: result.error.issues.map((i) => i.message).join("; "),
        raw,
      });
      return;
    }
    if (seen.has(result.data.cursor_url)) {
      rejected.push({ row: idx + 2, reason: "Duplicate URL in CSV", raw });
      return;
    }
    seen.add(result.data.cursor_url);
    rows.push({ cursor_url: result.data.cursor_url });
  });

  return { rows, rejected };
}

// =============================================================================
// Combined CSV: one sheet with both `email` and `cursor_url` columns.
// Column order doesn't matter; we look up by header name with aliases.
// This is the recommended import format: open the CSV Cursor sends you,
// paste your Luma email column next to it, save, upload.
// =============================================================================

export type CombinedRow = {
  email: string;
  name: string | null;
  cursor_url: string;
};

export type CombinedParseResult = {
  attendees: AttendeeRow[];
  credits: CreditRow[];
  pairs: CombinedRow[];
  rejected: { row: number; reason: string; raw: Record<string, unknown> }[];
  /** Whether the CSV had any email column at all */
  hasEmail: boolean;
  /** Whether the CSV had any url column at all */
  hasUrl: boolean;
};

function pickUrl(raw: Record<string, string>): string {
  return (
    raw.cursor_url ??
    raw.promo_url ??
    raw.promo_link ??
    raw.url ??
    raw.link ??
    raw.credit_url ??
    raw.code ??
    ""
  );
}

function pickEmail(raw: Record<string, string>): string {
  return raw.email ?? raw.e_mail ?? raw.email_address ?? raw.mail ?? "";
}

function pickName(raw: Record<string, string>): string | null {
  const first = (raw.first_name ?? "").trim();
  const last = (raw.last_name ?? "").trim();
  if (first || last) return `${first} ${last}`.trim();
  return raw.name ?? raw.full_name ?? null;
}

export function parseCombinedCsv(input: string): CombinedParseResult {
  const records = parse(input, {
    columns: (hdrs: string[]) => hdrs.map(normaliseHeader),
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as Record<string, string>[];

  const attendees: AttendeeRow[] = [];
  const credits: CreditRow[] = [];
  const pairs: CombinedRow[] = [];
  const rejected: CombinedParseResult["rejected"] = [];
  const seenEmail = new Set<string>();
  const seenUrl = new Set<string>();

  let hasEmail = false;
  let hasUrl = false;
  if (records.length > 0) {
    hasEmail = Boolean(pickEmail(records[0])) || "email" in records[0];
    hasUrl = Boolean(pickUrl(records[0])) || "cursor_url" in records[0];
    // Detect headers via the first row's key set
    const keys = Object.keys(records[0]);
    hasEmail =
      hasEmail ||
      keys.some((k) =>
        ["email", "e_mail", "email_address", "mail"].includes(k),
      );
    hasUrl =
      hasUrl ||
      keys.some((k) =>
        [
          "cursor_url",
          "promo_url",
          "promo_link",
          "url",
          "link",
          "credit_url",
          "code",
        ].includes(k),
      );
  }

  records.forEach((raw, idx) => {
    const rowNum = idx + 2; // +1 header, +1 1-indexed
    const emailRaw = pickEmail(raw).trim().toLowerCase();
    const urlRaw = pickUrl(raw).trim();
    const name = pickName(raw);

    const hasE = Boolean(emailRaw);
    const hasU = Boolean(urlRaw);

    // Skip wholly empty rows silently
    if (!hasE && !hasU) return;

    let emailOk: string | null = null;
    let urlOk: string | null = null;

    if (hasE) {
      const r = emailRow.safeParse({ email: emailRaw, name });
      if (!r.success) {
        rejected.push({
          row: rowNum,
          reason: `email: ${r.error.issues.map((i) => i.message).join("; ")}`,
          raw,
        });
      } else if (seenEmail.has(r.data.email)) {
        rejected.push({ row: rowNum, reason: "Duplicate email in CSV", raw });
      } else {
        seenEmail.add(r.data.email);
        emailOk = r.data.email;
        attendees.push({ email: r.data.email, name: r.data.name ?? null });
      }
    }

    if (hasU) {
      const r = creditRow.safeParse({ cursor_url: urlRaw });
      if (!r.success) {
        rejected.push({
          row: rowNum,
          reason: `cursor_url: ${r.error.issues.map((i) => i.message).join("; ")}`,
          raw,
        });
      } else if (seenUrl.has(r.data.cursor_url)) {
        rejected.push({ row: rowNum, reason: "Duplicate URL in CSV", raw });
      } else {
        seenUrl.add(r.data.cursor_url);
        urlOk = r.data.cursor_url;
        credits.push({ cursor_url: r.data.cursor_url });
      }
    }

    if (emailOk && urlOk) {
      pairs.push({ email: emailOk, name, cursor_url: urlOk });
    }
  });

  return { attendees, credits, pairs, rejected, hasEmail, hasUrl };
}

export function toCsv<T extends Record<string, unknown>>(rows: T[], headers: (keyof T)[]): string {
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const head = headers.join(",");
  const body = rows.map((r) => headers.map((h) => escape(r[h])).join(",")).join("\n");
  return `${head}\n${body}`;
}
