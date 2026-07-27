"use client";

import { useState, type FormEvent } from "react";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; email: string; emailDelivered: boolean }
  | { kind: "already"; email: string; emailDelivered: boolean }
  | { kind: "not_found" }
  | { kind: "no_credits" }
  | { kind: "rate_limited"; retry: number }
  | { kind: "error"; message: string };

export function ClaimForm({ eventSlug }: { eventSlug: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: trimmed, eventSlug }),
      });
      const json = (await res.json()) as {
        outcome: string;
        emailDelivered?: boolean;
        retryAfter?: number;
        message?: string;
      };

      switch (json.outcome) {
        case "success":
          setState({
            kind: "success",
            email: trimmed,
            emailDelivered: !!json.emailDelivered,
          });
          break;
        case "already_claimed":
          setState({
            kind: "already",
            email: trimmed,
            emailDelivered: !!json.emailDelivered,
          });
          break;
        case "not_found":
          setState({ kind: "not_found" });
          break;
        case "no_credits":
          setState({ kind: "no_credits" });
          break;
        case "rate_limited":
          setState({ kind: "rate_limited", retry: json.retryAfter ?? 60 });
          break;
        default:
          setState({
            kind: "error",
            message: json.message ?? "Something went wrong.",
          });
      }
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error.",
      });
    }
  }

  if (state.kind === "success") {
    return (
      <EmailOnlyResult
        tone="success"
        title="Check your email"
        email={state.email}
        emailDelivered={state.emailDelivered}
        alreadyClaimed={false}
      />
    );
  }

  if (state.kind === "already") {
    return (
      <EmailOnlyResult
        tone="warn"
        title="You've already claimed"
        email={state.email}
        emailDelivered={state.emailDelivered}
        alreadyClaimed
      />
    );
  }

  if (state.kind === "no_credits") {
    return (
      <ResultPanel
        tone="warn"
        title="No credits remaining"
        body={
          <>
            We&apos;ve run out of Cursor credits for this event. Please reach
            out to the organizer if you believe this is a mistake.
          </>
        }
      />
    );
  }

  if (state.kind === "not_found") {
    return (
      <ResultPanel
        tone="warn"
        title="Email not on the list"
        body={
          <>
            We couldn&apos;t find <strong className="text-ink">{email}</strong>{" "}
            for this event. Use the same email you registered with on Luma, or
            reach out to the organizer if you believe this is a mistake.
          </>
        }
        action={
          <button
            type="button"
            onClick={() => setState({ kind: "idle" })}
            className="btn-ghost mt-4 w-full"
          >
            Try a different email
          </button>
        }
      />
    );
  }

  if (state.kind === "rate_limited") {
    return (
      <ResultPanel
        tone="warn"
        title="Too many attempts"
        body={
          <>
            Please wait about {state.retry} seconds before trying again.
          </>
        }
      />
    );
  }

  if (state.kind === "error") {
    return (
      <ResultPanel
        tone="error"
        title="Something went wrong"
        body={state.message}
        action={
          <button
            type="button"
            onClick={() => setState({ kind: "idle" })}
            className="btn-ghost mt-4 w-full"
          >
            Try again
          </button>
        }
      />
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-ink">
          Email you registered with
        </span>
        <input
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="input"
          disabled={state.kind === "loading"}
        />
      </label>
      <button
        type="submit"
        disabled={state.kind === "loading"}
        className="btn-primary w-full"
      >
        {state.kind === "loading" ? (
          <span className="inline-flex items-center justify-center gap-2">
            <Spinner />
            Claiming…
          </span>
        ) : (
          "Get my Cursor credits"
        )}
      </button>
      <p className="text-center text-[12.5px] text-ink-dim">
        We&apos;ll email your unique credit link. It won&apos;t be shown on this
        page.
      </p>
    </form>
  );
}

function EmailOnlyResult({
  tone,
  title,
  email,
  emailDelivered,
  alreadyClaimed,
}: {
  tone: "success" | "warn";
  title: string;
  email: string;
  emailDelivered: boolean;
  alreadyClaimed: boolean;
}) {
  const tonePalette: Record<typeof tone, string> = {
    success: "border-emerald-500/30 bg-emerald-500/[0.06]",
    warn: "border-amber-400/30 bg-amber-400/[0.06]",
  };
  const dot: Record<typeof tone, string> = {
    success: "bg-emerald-500",
    warn: "bg-amber-400",
  };

  return (
    <div className={`rounded-xl border p-5 ${tonePalette[tone]}`}>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dot[tone]}`} />
        <h3 className="text-[15px] font-semibold text-ink 2xl:text-[16px]">
          {title}
        </h3>
      </div>

      <div className="mt-3 space-y-2 text-[14px] leading-relaxed text-ink-muted">
        {alreadyClaimed ? (
          <p>
            A credit was already assigned for{" "}
            <strong className="text-ink">{email}</strong>.
          </p>
        ) : (
          <p>
            Your credit is ready for{" "}
            <strong className="text-ink">{email}</strong>.
          </p>
        )}

        {emailDelivered ? (
          <p>
            We emailed the unique link to that address
            {alreadyClaimed ? " again" : ""}. Check inbox and spam — it can take
            a minute.
          </p>
        ) : (
          <p className="text-amber-700 dark:text-amber-300/90">
            We couldn&apos;t send the email just now. Please try again in a
            moment, or contact the organizer so they can resend it.
          </p>
        )}

        <p className="text-[12.5px] text-ink-dim">
          For security, the credit link is only sent by email — never shown on
          this page. Redeem while logged into the correct Cursor account
          (individual plans only).
        </p>
      </div>
    </div>
  );
}

function ResultPanel({
  tone,
  title,
  body,
  action,
}: {
  tone: "success" | "warn" | "error";
  title: string;
  body: React.ReactNode;
  action?: React.ReactNode;
}) {
  const border: Record<typeof tone, string> = {
    success: "border-emerald-500/30 bg-emerald-500/[0.06]",
    warn: "border-amber-400/30 bg-amber-400/[0.06]",
    error: "border-rose-500/30 bg-rose-500/[0.06]",
  };
  const dot: Record<typeof tone, string> = {
    success: "bg-emerald-500",
    warn: "bg-amber-400",
    error: "bg-rose-500",
  };
  return (
    <div className={`rounded-xl border p-5 ${border[tone]}`}>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dot[tone]}`} />
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      </div>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">{body}</p>
      {action}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <path
        d="M21 12a9 9 0 0 1-9 9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
