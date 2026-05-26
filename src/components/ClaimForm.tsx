"use client";

import { useState, type FormEvent } from "react";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; email: string }
  | { kind: "already"; email: string }
  | { kind: "not_found" }
  | { kind: "no_credits" }
  | { kind: "rate_limited"; retry: number }
  | { kind: "error"; message: string };

export function ClaimForm() {
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
        body: JSON.stringify({ email: trimmed }),
      });
      const json = (await res.json()) as { outcome: string; retryAfter?: number; message?: string };

      switch (json.outcome) {
        case "success":
          setState({ kind: "success", email: trimmed });
          break;
        case "already_claimed":
          setState({ kind: "already", email: trimmed });
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
          setState({ kind: "error", message: json.message ?? "Something went wrong." });
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
      <ResultPanel
        tone="success"
        title="Check your email for your Cursor credits"
        body={
          <>
            We just sent your unique credit link to{" "}
            <strong className="text-ink">{state.email}</strong>. It can take a
            minute to arrive — check spam if you don&apos;t see it.
          </>
        }
      />
    );
  }

  if (state.kind === "already") {
    return (
      <ResultPanel
        tone="warn"
        title="You've already claimed your credit"
        body={
          <>
            <strong className="text-ink">{state.email}</strong> has already
            been issued credits. We re-sent the original link to your inbox so
            you can find it again.
          </>
        }
      />
    );
  }

  if (state.kind === "not_found") {
    return (
      <ResultPanel
        tone="error"
        title="This email isn't on the attendee list"
        body={
          <>
            Only attendees registered for the meetup on Luma can claim credits.
            Make sure you&apos;re using the same email you signed up with.
          </>
        }
        action={
          <button
            type="button"
            onClick={() => {
              setEmail("");
              setState({ kind: "idle" });
            }}
            className="btn-ghost mt-4 w-full"
          >
            Try a different email
          </button>
        }
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
            We&apos;ve run out of Cursor credits for this event. Please reach out to
            the organizer if you believe this is a mistake.
          </>
        }
      />
    );
  }

  if (state.kind === "rate_limited") {
    return (
      <ResultPanel
        tone="warn"
        title="Slow down a moment"
        body={
          <>
            Too many attempts from your network. Please try again in about{" "}
            <strong className="text-ink">{state.retry}s</strong>.
          </>
        }
        action={
          <button
            type="button"
            onClick={() => setState({ kind: "idle" })}
            className="btn-ghost mt-4 w-full"
          >
            OK
          </button>
        }
      />
    );
  }

  if (state.kind === "error") {
    return (
      <ResultPanel
        tone="error"
        title="Something went wrong"
        body={<>{state.message}. Please try again in a moment.</>}
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

  const loading = state.kind === "loading";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-ink">Email</span>
        <input
          type="email"
          required
          autoFocus
          inputMode="email"
          autoComplete="email"
          spellCheck={false}
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
          disabled={loading}
        />
        <span className="mt-2 block text-[12px] text-ink-dim">
          Use the same email you signed up with on Luma.
        </span>
      </label>

      <button type="submit" disabled={loading || !email} className="btn-primary">
        {loading ? (
          <>
            <Spinner /> Sending…
          </>
        ) : (
          "Email me my credit"
        )}
      </button>
    </form>
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
  const toneStyles: Record<typeof tone, string> = {
    success: "border-emerald-500/30 bg-emerald-500/[0.06]",
    warn: "border-amber-400/30 bg-amber-400/[0.06]",
    error: "border-rose-500/30 bg-rose-500/[0.06]",
  };
  const dot: Record<typeof tone, string> = {
    success: "bg-emerald-400",
    warn: "bg-amber-300",
    error: "bg-rose-400",
  };
  return (
    <div className={`rounded-xl border p-5 ${toneStyles[tone]}`}>
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${dot[tone]}`} />
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
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path
        d="M21 12a9 9 0 0 1-9 9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
