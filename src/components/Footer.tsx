import Image from "next/image";
import { publicEvent } from "@/lib/env";

export function Footer() {
  return (
    <footer className="mt-auto w-full pt-10 text-center">
      <p className="text-[13px] text-ink-muted">
        Presented by{" "}
        <span className="font-medium text-ink">{publicEvent.organizer}</span>
      </p>
      <p className="mt-1 text-[12px] text-ink-dim">
        Hosted by {publicEvent.host}
      </p>
      <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-ink-dim">
        <span>Powered by</span>
        <div className="relative h-4 w-[72px] opacity-70 dark:opacity-100">
          <Image
            src="/LOCKUP_HORIZONTAL_2D_DARK.png"
            alt="Cursor"
            fill
            className="object-contain object-left dark:brightness-100 brightness-0"
            sizes="72px"
          />
        </div>
      </div>
    </footer>
  );
}
