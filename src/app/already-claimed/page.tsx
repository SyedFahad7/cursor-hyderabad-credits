import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { Footer } from "@/components/Footer";

export const metadata = { title: "Already claimed — Cursor Hyderabad Meetup" };

export default function AlreadyClaimedPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center px-5 pt-20 sm:pt-28">
      <BrandMark size={52} />
      <div className="mt-8 w-full panel p-8 text-center">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-200">
          !
        </span>
        <h1 className="mt-4 text-2xl font-semibold">
          You&apos;ve already claimed your credit
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          We re-sent the original link to your inbox so you can find it again.
          Each attendee can claim only once.
        </p>
        <Link href="/" className="btn-ghost mt-6">
          Back to home
        </Link>
      </div>
      <Footer />
    </main>
  );
}
