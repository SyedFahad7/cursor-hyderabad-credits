import Image from "next/image";
import { publicEvent } from "@/lib/env";

const X_PROFILE = "https://x.com/fahad_developer";
const LINKEDIN_PROFILE = "https://linkedin.com/in/syedfahads";

export function Footer() {
  return (
    <footer className="mt-8 w-full shrink-0 pt-4 text-center md:mt-10 2xl:mt-12 3xl:mt-14">
      <div className="space-y-1 text-[12px] leading-relaxed text-ink-dim 2xl:text-[13px] 3xl:text-[13.5px]">
        <p>Only participants registered for the event can obtain credits.</p>
        <p>One credit per person.</p>
      </div>

      <p className="mt-5 text-[13px] text-ink-muted 2xl:mt-6 2xl:text-[14px] 3xl:text-[14.5px]">
        Built With ❤️ By{" "}
        <a
          href={LINKEDIN_PROFILE}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-ink underline-offset-2 transition hover:underline"
        >
          {publicEvent.host}
        </a>
      </p>
      <p className="mt-1 text-[13px] text-ink-muted 2xl:text-[14px] 3xl:text-[14.5px]">
        Ambassador Hyderabad, India{" "}
        <span className="font-semibold text-ink">Cursor</span>
      </p>

      <p className="mt-4 text-[12px] text-ink-dim 2xl:mt-5 2xl:text-[13px] 3xl:text-[13.5px]">
        Contact / Questions / Ideas? Shoot a question to us{" "}
        <a
          href={X_PROFILE}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink-muted underline decoration-ink-dim/50 underline-offset-2 transition hover:text-ink hover:decoration-ink"
        >
          here
        </a>
      </p>

      <div className="mt-6 flex justify-center 2xl:mt-7">
        <div className="inline-flex items-center gap-2 rounded-full border border-line bg-bg-panel/80 px-3 py-1.5 text-[11px] text-ink-dim 2xl:text-[12px] 3xl:text-[12.5px]">
          <span>Powered by</span>
          <div className="relative h-3.5 w-[62px] 2xl:h-4 2xl:w-[72px] 3xl:h-[18px] 3xl:w-[80px]">
            <Image
              src="/LOCKUP_HORIZONTAL_2D_DARK.png"
              alt="Cursor"
              fill
              className="object-contain object-left brightness-0 dark:brightness-100"
              sizes="80px"
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
