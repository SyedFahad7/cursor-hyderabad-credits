import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { Footer } from "@/components/Footer";
import { publicEvent } from "@/lib/env";

export const metadata = { title: "Check your email — Cursor Hyderabad Meetup" };

export default function SuccessPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center px-5 pt-20 sm:pt-28">
      <BrandMark size={52} />
      <div className="mt-8 w-full panel p-8 text-center">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
          ✓
        </span>
        <h1 className="mt-4 text-2xl font-semibold">
          Check your email for your Cursor credits
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Your unique credit link is on its way. If it doesn&apos;t show up in
          a minute, check your spam folder.
        </p>
        <div className="mt-6 rounded-xl border border-line bg-bg-subtle p-4 text-left text-[13px] text-ink-muted">
          <p className="text-ink">Important</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>Redeem while logged into the correct Cursor account.</li>
            <li>Credits work for individual accounts, not Team plans.</li>
          </ul>
        </div>
        <Link href="/" className="btn-ghost mt-6">
          Back to claim page
        </Link>
        <p className="mt-4 text-xs text-ink-dim">
          Trouble? Email{" "}
          <span className="text-ink-muted">{publicEvent.supportEmail || "the organizer"}</span>.
        </p>
      </div>
      <Footer />
    </main>
  );
}
