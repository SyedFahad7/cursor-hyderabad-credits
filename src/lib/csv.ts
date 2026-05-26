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
