import { publicEvent } from "@/lib/env";

export function Footer() {
  return (
    <footer className="mt-16 pb-10 text-center text-xs text-ink-dim">
      <p>
        Presented by{" "}
        <span className="text-ink-muted">{publicEvent.organizer}</span>
      </p>
      <p className="mt-1">
        Hosted by {publicEvent.host} · {publicEvent.date}
      </p>
      <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-ink-dim">
        <span>Powered by</span>
        <span className="rounded-md border border-line bg-bg-subtle px-2 py-0.5 font-medium text-ink-muted">
          Cursor
        </span>
      </div>
    </footer>
  );
}
