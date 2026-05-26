import Link from "next/link";
import { CursorLogo } from "@/components/CursorLogo";
import { PublicPage } from "@/components/PublicShell";

export const metadata = { title: "Already claimed — Cursor Hyderabad Meetup" };

export default function AlreadyClaimedPage() {
  return (
    <PublicPage>
      <CursorLogo className="mb-8" />
      <div className="w-full panel p-8 text-center">
        <h1 className="text-xl font-semibold">You&apos;ve already claimed</h1>
        <p className="mt-2 text-sm text-ink-muted">
          We re-sent the original link to your inbox. One credit per attendee.
        </p>
        <Link href="/" className="btn-ghost mt-6">
          Back to home
        </Link>
      </div>
    </PublicPage>
  );
}
