import { getSupabaseAdmin, type Event } from "@/lib/supabase";
import { sendCreditEmail } from "@/lib/email";
import { getEventBySlug } from "@/lib/events";
import { buildTrackedCreditUrl } from "@/lib/trackLink";
import { logSystem, errMessage } from "@/lib/systemLog";

export type ClaimRpcStatus =
  | "success"
  | "already_claimed"
  | "not_found"
  | "no_credits"
  | "event_not_found";

export type ClaimAttemptOutcome =
  | "success"
  | "duplicate"
  | "not_found"
  | "no_credits"
  | "rate_limited"
  | "event_not_found"
  | "error";

export type ClaimSource = "public" | "luma" | "admin";

type ClaimRow = {
  status: ClaimRpcStatus;
  cursor_url: string | null;
  attendee_id: string | null;
  attendee_name: string | null;
  event_name: string | null;
};

export type ClaimAndEmailResult = {
  outcome:
    | "success"
    | "already_claimed"
    | "not_found"
    | "no_credits"
    | "event_not_found"
    | "error";
  creditUrl: string | null;
  emailDelivered: boolean;
  event: Event | null;
  attendeeName: string | null;
  attendeeId: string | null;
  message?: string;
};

export async function logClaimAttempt(args: {
  eventId: string | null;
  email: string | null;
  ip: string;
  ua: string;
  outcome: ClaimAttemptOutcome;
  source?: ClaimSource;
  emailDelivered?: boolean | null;
}) {
  try {
    const sb = getSupabaseAdmin();
    await sb.from("claim_attempts").insert({
      event_id: args.eventId,
      email: args.email,
      ip: args.ip,
      user_agent: args.ua,
      outcome: args.outcome,
      source: args.source ?? null,
      email_delivered:
        args.emailDelivered === undefined ? null : args.emailDelivered,
    });
  } catch {
    // never let logging failures take down the request
  }
}

async function markEmailSent(attendeeId: string | null | undefined) {
  if (!attendeeId) return;
  try {
    const sb = getSupabaseAdmin();
    await sb
      .from("attendees")
      .update({ credit_email_sent_at: new Date().toISOString() })
      .eq("id", attendeeId);
  } catch {
    /* ignore */
  }
}

async function sendTrackedCreditEmail(args: {
  to: string;
  name: string | null;
  creditUrl: string;
  event: Event;
  attendeeId: string | null;
}) {
  const tracked = buildTrackedCreditUrl(args.attendeeId, args.creditUrl);
  await sendCreditEmail({
    to: args.to,
    name: args.name,
    creditUrl: tracked,
    event: args.event,
  });
  await markEmailSent(args.attendeeId);
}

/**
 * Atomically assign a credit (if needed) and best-effort email the URL.
 * Shared by the public claim form and the Luma check-in webhook.
 */
export async function claimAndEmailCredit(args: {
  email: string;
  eventSlug: string;
  /** Pre-resolved event avoids an extra lookup when the caller already has it. */
  event?: Event | null;
  ip: string;
  ua: string;
  source?: ClaimSource;
  /** When false, skip email (caller will handle). Default true. */
  sendEmail?: boolean;
}): Promise<ClaimAndEmailResult> {
  const email = args.email.trim().toLowerCase();
  const eventSlug = args.eventSlug.toLowerCase().trim();
  const sendEmail = args.sendEmail !== false;
  const source = args.source ?? "public";
  const sb = getSupabaseAdmin();

  const event =
    args.event !== undefined ? args.event : await getEventBySlug(eventSlug);

  if (!event || !event.active) {
    await logClaimAttempt({
      eventId: event?.id ?? null,
      email,
      ip: args.ip,
      ua: args.ua,
      outcome: "event_not_found",
      source,
      emailDelivered: false,
    });
    return {
      outcome: "event_not_found",
      creditUrl: null,
      emailDelivered: false,
      event: event ?? null,
      attendeeName: null,
      attendeeId: null,
    };
  }

  try {
    const { data, error } = await sb.rpc("claim_attendee_credit", {
      p_email: email,
      p_event_slug: eventSlug,
    });

    if (error) {
      console.error("[claimCredit] rpc error", error);
      await logSystem("error", "claim", "claim_attendee_credit RPC failed", {
        email,
        event: eventSlug,
        source,
        error: error.message,
      });
      await logClaimAttempt({
        eventId: event.id,
        email,
        ip: args.ip,
        ua: args.ua,
        outcome: "error",
        source,
        emailDelivered: false,
      });
      return {
        outcome: "error",
        creditUrl: null,
        emailDelivered: false,
        event,
        attendeeName: null,
        attendeeId: null,
        message: "Server error. Please try again.",
      };
    }

    const row = (Array.isArray(data) ? data[0] : data) as ClaimRow | undefined;
    if (!row) {
      await logClaimAttempt({
        eventId: event.id,
        email,
        ip: args.ip,
        ua: args.ua,
        outcome: "error",
        source,
        emailDelivered: false,
      });
      return {
        outcome: "error",
        creditUrl: null,
        emailDelivered: false,
        event,
        attendeeName: null,
        attendeeId: null,
        message: "Unexpected response.",
      };
    }

    switch (row.status) {
      case "event_not_found":
        await logClaimAttempt({
          eventId: event.id,
          email,
          ip: args.ip,
          ua: args.ua,
          outcome: "event_not_found",
          source,
          emailDelivered: false,
        });
        return {
          outcome: "event_not_found",
          creditUrl: null,
          emailDelivered: false,
          event,
          attendeeName: null,
          attendeeId: null,
        };

      case "not_found":
        await logClaimAttempt({
          eventId: event.id,
          email,
          ip: args.ip,
          ua: args.ua,
          outcome: "not_found",
          source,
          emailDelivered: false,
        });
        return {
          outcome: "not_found",
          creditUrl: null,
          emailDelivered: false,
          event,
          attendeeName: null,
          attendeeId: null,
        };

      case "no_credits":
        await logClaimAttempt({
          eventId: event.id,
          email,
          ip: args.ip,
          ua: args.ua,
          outcome: "no_credits",
          source,
          emailDelivered: false,
        });
        return {
          outcome: "no_credits",
          creditUrl: null,
          emailDelivered: false,
          event,
          attendeeName: row.attendee_name,
          attendeeId: row.attendee_id,
        };

      case "already_claimed": {
        let emailDelivered = false;
        if (sendEmail && row.cursor_url) {
          try {
            await sendTrackedCreditEmail({
              to: email,
              name: row.attendee_name,
              creditUrl: row.cursor_url,
              event,
              attendeeId: row.attendee_id,
            });
            emailDelivered = true;
          } catch (e) {
            console.warn("[claimCredit] resend on already_claimed failed", e);
            await logSystem("error", "email", "Credit email failed (already_claimed resend)", {
              email,
              event: eventSlug,
              source,
              error: errMessage(e),
            });
          }
        }
        await logClaimAttempt({
          eventId: event.id,
          email,
          ip: args.ip,
          ua: args.ua,
          outcome: "duplicate",
          source,
          emailDelivered: sendEmail ? emailDelivered : null,
        });
        return {
          outcome: "already_claimed",
          creditUrl: row.cursor_url,
          emailDelivered,
          event,
          attendeeName: row.attendee_name,
          attendeeId: row.attendee_id,
        };
      }

      case "success": {
        if (!row.cursor_url) {
          await logClaimAttempt({
            eventId: event.id,
            email,
            ip: args.ip,
            ua: args.ua,
            outcome: "error",
            source,
            emailDelivered: false,
          });
          return {
            outcome: "error",
            creditUrl: null,
            emailDelivered: false,
            event,
            attendeeName: row.attendee_name,
            attendeeId: row.attendee_id,
            message: "Credit assignment failed.",
          };
        }

        let emailDelivered = false;
        if (sendEmail) {
          try {
            await sendTrackedCreditEmail({
              to: email,
              name: row.attendee_name,
              creditUrl: row.cursor_url,
              event,
              attendeeId: row.attendee_id,
            });
            emailDelivered = true;
          } catch (e) {
            console.warn("[claimCredit] email send failed (claim still valid)", e);
            await logSystem("error", "email", "Credit email failed (claim succeeded, email did not send)", {
              email,
              event: eventSlug,
              source,
              error: errMessage(e),
            });
          }
        }

        await logClaimAttempt({
          eventId: event.id,
          email,
          ip: args.ip,
          ua: args.ua,
          outcome: "success",
          source,
          emailDelivered: sendEmail ? emailDelivered : null,
        });
        return {
          outcome: "success",
          creditUrl: row.cursor_url,
          emailDelivered,
          event,
          attendeeName: row.attendee_name,
          attendeeId: row.attendee_id,
        };
      }

      default:
        await logClaimAttempt({
          eventId: event.id,
          email,
          ip: args.ip,
          ua: args.ua,
          outcome: "error",
          source,
          emailDelivered: false,
        });
        return {
          outcome: "error",
          creditUrl: null,
          emailDelivered: false,
          event,
          attendeeName: null,
          attendeeId: null,
          message: "Unknown status.",
        };
    }
  } catch (e) {
    console.error("[claimCredit] unhandled", e);
    await logSystem("error", "claim", "Unhandled error in claimAndEmailCredit", {
      email,
      event: eventSlug,
      source,
      error: errMessage(e),
    });
    await logClaimAttempt({
      eventId: event.id,
      email,
      ip: args.ip,
      ua: args.ua,
      outcome: "error",
      source,
      emailDelivered: false,
    });
    return {
      outcome: "error",
      creditUrl: null,
      emailDelivered: false,
      event,
      attendeeName: null,
      attendeeId: null,
      message: "Unexpected error.",
    };
  }
}
