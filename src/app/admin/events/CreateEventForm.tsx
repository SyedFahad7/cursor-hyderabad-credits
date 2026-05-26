"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

// Sensible defaults so you (Syed Fahad, Cursor Hyderabad ambassador) don't
// retype these every time you make a new event.
const DEFAULTS = {
  organizer: "Cursor Hyderabad",
  host: "Syed Fahad",
  credit_amount: "$15",
};

export function CreateEventForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Capture the form ref synchronously — React nulls e.currentTarget after await.
    const form = e.currentTarget;
    setBusy(true);
    setErr(null);
    setOk(null);
    const fd = new FormData(form);
    const body = {
      slug: String(fd.get("slug") ?? "").trim(),
      name: String(fd.get("name") ?? "").trim(),
      tagline: String(fd.get("tagline") ?? "").trim() || null,
      credit_amount: String(fd.get("credit_amount") ?? "").trim() || null,
      event_date: String(fd.get("event_date") ?? "").trim() || null,
      organizer: String(fd.get("organizer") ?? "").trim() || null,
      host: String(fd.get("host") ?? "").trim() || null,
      active: fd.get("active") === "on",
    };

    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok) throw new Error(json.message ?? "Failed");
      formRef.current?.reset();
      setOk(
        `Created "${body.name}". Next: import attendees + credits at /admin/import?event=${body.slug}`,
      );
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="panel space-y-4 p-5 md:p-6"
    >
      <h2 className="text-[15px] font-semibold text-ink">Create event</h2>

      <Field
        label="Slug"
        hint="Lowercase letters, numbers, hyphens. Becomes the URL: /e/<slug>"
      >
        <input
          name="slug"
          required
          pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
          minLength={2}
          maxLength={60}
          placeholder="cafe-cursor-jul-15"
          className="input"
        />
      </Field>

      <Field label="Event name" hint="Shown big at the top of the claim page.">
        <input
          name="name"
          required
          minLength={2}
          maxLength={120}
          placeholder="Cafe Cursor Hyderabad"
          className="input"
        />
      </Field>

      <Field
        label="Tagline"
        hint="One-liner shown right under the event name. Optional."
      >
        <input
          name="tagline"
          maxLength={200}
          placeholder="Get your free credits from Cursor. Sign up in seconds."
          className="input"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Credit amount"
          hint="Shown in the email. E.g. $15."
        >
          <input
            name="credit_amount"
            maxLength={80}
            defaultValue={DEFAULTS.credit_amount}
            placeholder="$15"
            className="input"
          />
        </Field>
        <Field label="Event date" hint="Optional. Shown in the email.">
          <input name="event_date" type="date" className="input" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Host"
          hint="The person running the event (you). Shown as 'Hosted by …' in the email."
        >
          <input
            name="host"
            maxLength={120}
            defaultValue={DEFAULTS.host}
            placeholder="Syed Fahad"
            className="input"
          />
        </Field>
        <Field
          label="Organizer"
          hint="The community / brand. Shown as 'Presented by …' in the email."
        >
          <input
            name="organizer"
            maxLength={120}
            defaultValue={DEFAULTS.organizer}
            placeholder="Cursor Hyderabad"
            className="input"
          />
        </Field>
      </div>

      <label className="flex items-start gap-2.5 rounded-xl border border-line bg-bg-subtle/60 p-3 text-[12.5px] text-ink-muted">
        <input
          name="active"
          type="checkbox"
          defaultChecked
          className="mt-0.5 h-4 w-4 rounded border-line bg-bg-subtle accent-ink"
        />
        <span>
          <span className="font-medium text-ink">Live</span> — when checked,
          attendees can claim at{" "}
          <code className="rounded bg-bg-subtle px-1">/e/{"<slug>"}</code> and
          it appears on the homepage picker. Uncheck to draft an event or stop
          claims after it&apos;s over.
        </span>
      </label>

      {err && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300/90">
          {err}
        </p>
      )}
      {ok && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300/90">
          {ok}
        </p>
      )}

      <button type="submit" disabled={busy} className="btn-primary">
        {busy ? "Creating…" : "Create event"}
      </button>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-medium text-ink">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-[11px] leading-relaxed text-ink-dim">
          {hint}
        </span>
      )}
    </label>
  );
}
