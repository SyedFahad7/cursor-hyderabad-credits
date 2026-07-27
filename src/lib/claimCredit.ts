import { getSupabaseAdmin, type Event } from "@/lib/supabase";
import { sendCreditEmail } from "@/lib/email";
import { getEventBySlug } from "@/lib/events";

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
  message?: string;
};

export async function logClaimAttempt(args: {
  eventId: string | null;
  email: string | null;
  ip: string;
  ua: string;
  outcome: ClaimAttemptOutcome;
}) {
  try {
    const sb = getSupabaseAdmin();
    await sb.from("claim_attempts").insert({
      event_id: args.eventId,
      email: args.email,
      ip: args.ip,
      user_agent: args.ua,
      outcome: args.outcome,
    });
  } catch {
    // never let logging failures take down the request
  }
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
  /** When false, skip email (caller will handle). Default true. */
  sendEmail?: boolean;
}): Promise<ClaimAndEmailResult> {
  const email = args.email.trim().toLowerCase();
  const eventSlug = args.eventSlug.toLowerCase().trim();
  const sendEmail = args.sendEmail !== false;
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
    });
    return {
      outcome: "event_not_found",
      creditUrl: null,
      emailDelivered: false,
      event: event ?? null,
      attendeeName: null,
    };
  }

  try {
    const { data, error } = await sb.rpc("claim_attendee_credit", {
      p_email: email,
      p_event_slug: eventSlug,
    });

    if (error) {
      console.error("[claimCredit] rpc error", error);
      await logClaimAttempt({
        eventId: event.id,
        email,
        ip: args.ip,
        ua: args.ua,
        outcome: "error",
      });
      return {
        outcome: "error",
        creditUrl: null,
        emailDelivered: false,
        event,
        attendeeName: null,
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
      });
      return {
        outcome: "error",
        creditUrl: null,
        emailDelivered: false,
        event,
        attendeeName: null,
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
        });
        return {
          outcome: "event_not_found",
          creditUrl: null,
          emailDelivered: false,
          event,
          attendeeName: null,
        };

      case "not_found":
        await logClaimAttempt({
          eventId: event.id,
          email,
          ip: args.ip,
          ua: args.ua,
          outcome: "not_found",
        });
        return {
          outcome: "not_found",
          creditUrl: null,
          emailDelivered: false,
          event,
          attendeeName: null,
        };

      case "no_credits":
        await logClaimAttempt({
          eventId: event.id,
          email,
          ip: args.ip,
          ua: args.ua,
          outcome: "no_credits",
        });
        return {
          outcome: "no_credits",
          creditUrl: null,
          emailDelivered: false,
          event,
          attendeeName: row.attendee_name,
        };

      case "already_claimed": {
        let emailDelivered = false;
        if (sendEmail && row.cursor_url) {
          try {
            await sendCreditEmail({
              to: email,
              name: row.attendee_name,
              creditUrl: row.cursor_url,
              event,
            });
            emailDelivered = true;
          } catch (e) {
            console.warn("[claimCredit] resend on already_claimed failed", e);
          }
        }
        await logClaimAttempt({
          eventId: event.id,
          email,
          ip: args.ip,
          ua: args.ua,
          outcome: "duplicate",
        });
        return {
          outcome: "already_claimed",
          creditUrl: row.cursor_url,
          emailDelivered,
          event,
          attendeeName: row.attendee_name,
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
          });
          return {
            outcome: "error",
            creditUrl: null,
            emailDelivered: false,
            event,
            attendeeName: row.attendee_name,
            message: "Credit assignment failed.",
          };
        }

        let emailDelivered = false;
        if (sendEmail) {
          try {
            await sendCreditEmail({
              to: email,
              name: row.attendee_name,
              creditUrl: row.cursor_url,
              event,
            });
            emailDelivered = true;
          } catch (e) {
            console.warn("[claimCredit] email send failed (claim still valid)", e);
          }
        }

        await logClaimAttempt({
          eventId: event.id,
          email,
          ip: args.ip,
          ua: args.ua,
          outcome: "success",
        });
        return {
          outcome: "success",
          creditUrl: row.cursor_url,
          emailDelivered,
          event,
          attendeeName: row.attendee_name,
        };
      }

      default:
        await logClaimAttempt({
          eventId: event.id,
          email,
          ip: args.ip,
          ua: args.ua,
          outcome: "error",
        });
        return {
          outcome: "error",
          creditUrl: null,
          emailDelivered: false,
          event,
          attendeeName: null,
          message: "Unknown status.",
        };
    }
  } catch (e) {
    console.error("[claimCredit] unhandled", e);
    await logClaimAttempt({
      eventId: event.id,
      email,
      ip: args.ip,
      ua: args.ua,
      outcome: "error",
    });
    return {
      outcome: "error",
      creditUrl: null,
      emailDelivered: false,
      event,
      attendeeName: null,
      message: "Unexpected error.",
    };
  }
}
