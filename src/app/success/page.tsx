import Link from "next/link";
import { CursorLogo } from "@/components/CursorLogo";
import { PublicPage } from "@/components/PublicShell";
import { publicEvent } from "@/lib/env";

export const metadata = { title: "Check your email — Cursor Hyderabad Meetup" };

export default function SuccessPage() {
  return (
    <PublicPage>
      <CursorLogo className="mb-8" />
      <div className="w-full panel p-8 text-center">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
          ✓
        </span>
        <h1 className="mt-4 text-xl font-semibold">
          Check your email for your Cursor credits
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Your unique credit link is on its way. Check spam if it doesn&apos;t
          arrive in a minute.
        </p>
        <Link href="/" className="btn-ghost mt-6">
          Back to claim page
        </Link>
        {publicEvent.supportEmail && (
          <p className="mt-4 text-xs text-ink-dim">
            Trouble? Email {publicEvent.supportEmail}
          </p>
        )}
      </div>
    </PublicPage>
  );
}
