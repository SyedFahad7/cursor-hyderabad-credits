import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

const REPLAY_WINDOW_SECONDS = 5 * 60;

export function verifyLumaWebhookSignature(args: {
  secret: string;
  signatureHeader: string | null;
  timestampHeader: string | null;
  body: string;
  nowSeconds?: number;
}): { ok: true } | { ok: false; reason: string } {
  const { secret, signatureHeader, timestampHeader, body } = args;
  if (!signatureHeader) return { ok: false, reason: "Missing Webhook-Signature" };

  const parts: Record<string, string> = {};
  for (const part of signatureHeader.split(",")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    parts[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }

  const t = parts.t ?? timestampHeader ?? "";
  const v1 = parts.v1 ?? "";
  if (!t || !v1) return { ok: false, reason: "Invalid signature header" };

  const ts = Number(t);
  if (!Number.isFinite(ts)) return { ok: false, reason: "Invalid timestamp" };

  const now = args.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > REPLAY_WINDOW_SECONDS) {
    return { ok: false, reason: "Timestamp outside replay window" };
  }

  const signedPayload = `${t}.${body}`;
  const expected = createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  try {
    const expectedBuf = Buffer.from(expected, "utf8");
    const actualBuf = Buffer.from(v1, "utf8");
    if (
      expectedBuf.length !== actualBuf.length ||
      !timingSafeEqual(expectedBuf, actualBuf)
    ) {
      return { ok: false, reason: "Signature mismatch" };
    }
  } catch {
    return { ok: false, reason: "Signature mismatch" };
  }

  return { ok: true };
}

const TicketSchema = z
  .object({
    checked_in_at: z.string().nullable().optional(),
  })
  .passthrough();

const GuestSchema = z
  .object({
    email: z.string().email().optional(),
    user_email: z.string().email().optional(),
    name: z.string().nullable().optional(),
    user_name: z.string().nullable().optional(),
    approval_status: z.string().optional(),
    checked_in_at: z.string().nullable().optional(),
    event_id: z.string().optional(),
    event_api_id: z.string().optional(),
    api_id: z.string().optional(),
    id: z.string().optional(),
    event_tickets: z.array(TicketSchema).optional(),
  })
  .passthrough();

const PayloadSchema = z.object({
  type: z.string(),
  data: z.unknown(),
});

export type LumaGuestInfo = {
  email: string;
  name: string | null;
  approvalStatus: string | null;
  checkedIn: boolean;
  lumaEventId: string | null;
};

/** Luma "Going" / approved guests. */
export function isLumaApproved(status: string | null | undefined): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === "approved" || s === "going";
}

function guestCheckedIn(guest: z.infer<typeof GuestSchema>): boolean {
  if (guest.checked_in_at) return true;
  const tickets = guest.event_tickets ?? [];
  return tickets.some((t) => Boolean(t.checked_in_at));
}

function extractGuestBlob(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  const obj = data as Record<string, unknown>;
  if (obj.guest && typeof obj.guest === "object") return obj.guest;
  return data;
}

function extractLumaEventId(
  data: unknown,
  guest: z.infer<typeof GuestSchema>,
): string | null {
  if (guest.event_id) return guest.event_id;
  if (guest.event_api_id) return guest.event_api_id;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (typeof obj.event_id === "string") return obj.event_id;
    if (typeof obj.event_api_id === "string") return obj.event_api_id;
    const event = obj.event;
    if (event && typeof event === "object") {
      const e = event as Record<string, unknown>;
      if (typeof e.id === "string") return e.id;
      if (typeof e.api_id === "string") return e.api_id;
    }
  }
  return null;
}

export function parseLumaWebhookPayload(body: string): {
  type: string;
  guest: LumaGuestInfo | null;
} {
  const json = JSON.parse(body) as unknown;
  const envelope = PayloadSchema.parse(json);
  const guestRaw = extractGuestBlob(envelope.data);
  const guestParsed = GuestSchema.safeParse(guestRaw);

  if (!guestParsed.success) {
    return { type: envelope.type, guest: null };
  }

  const g = guestParsed.data;
  const email = (g.email ?? g.user_email ?? "").trim().toLowerCase();
  if (!email) {
    return { type: envelope.type, guest: null };
  }

  return {
    type: envelope.type,
    guest: {
      email,
      name: (g.name ?? g.user_name ?? null) || null,
      approvalStatus: g.approval_status ?? null,
      checkedIn: guestCheckedIn(g),
      lumaEventId: extractLumaEventId(envelope.data, g),
    },
  };
}
