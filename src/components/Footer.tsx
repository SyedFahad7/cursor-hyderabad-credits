import Image from "next/image";
import { publicEvent } from "@/lib/env";

const X_PROFILE = "https://x.com/fahad_developer";

export function Footer() {
  return (
    <footer className="mt-8 w-full shrink-0 pt-4 text-center md:mt-10 2xl:mt-6">
      <p className="text-[13px] text-ink-muted">
        Presented by{" "}
        <span className="font-medium text-ink">{publicEvent.organizer}</span>
      </p>
      <p className="mt-1 text-[12px] text-ink-dim">
        Hosted by{" "}
        <a
          href={X_PROFILE}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink-muted underline decoration-ink-dim/50 underline-offset-2 transition hover:text-ink hover:decoration-ink"
        >
          {publicEvent.host}
        </a>
      </p>
      <p className="mt-2 text-[12px] text-ink-dim">
        Contact / questions / ideas? Shoot a question to us{" "}
        <a
          href={X_PROFILE}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink-muted underline decoration-ink-dim/50 underline-offset-2 transition hover:text-ink hover:decoration-ink"
        >
          here
        </a>
      </p>
      <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-ink-dim">
        <span>Powered by</span>
        <div className="relative h-4 w-[72px] opacity-70 dark:opacity-100">
          <Image
            src="/LOCKUP_HORIZONTAL_2D_DARK.png"
            alt="Cursor"
            fill
            className="object-contain object-left brightness-0 dark:brightness-100"
            sizes="72px"
          />
        </div>
      </div>
    </footer>
  );
}
