import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { Footer } from "@/components/Footer";
import { publicEvent } from "@/lib/env";

export const metadata = { title: "Email not registered — Cursor Hyderabad Meetup" };

export default function InvalidPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center px-5 pt-20 sm:pt-28">
      <BrandMark size={52} />
      <div className="mt-8 w-full panel p-8 text-center">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-300">
          ×
        </span>
        <h1 className="mt-4 text-2xl font-semibold">
          This email isn&apos;t on the attendee list
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Only approved attendees of {publicEvent.name} can claim credits.
          Use the same email you registered with on Luma.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link href="/" className="btn-ghost">Try another email</Link>
          {publicEvent.supportEmail && (
            <a
              href={`mailto:${publicEvent.supportEmail}`}
              className="text-sm text-ink-muted underline underline-offset-2 hover:text-ink"
            >
              Contact the organizer
            </a>
          )}
        </div>
      </div>
      <Footer />
    </main>
  );
}
