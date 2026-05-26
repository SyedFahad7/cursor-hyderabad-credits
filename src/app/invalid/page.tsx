import Link from "next/link";
import { CursorLogo } from "@/components/CursorLogo";
import { PublicPage } from "@/components/PublicShell";
import { publicEvent } from "@/lib/env";

export const metadata = { title: "Email not registered — Cursor Hyderabad Meetup" };

export default function InvalidPage() {
  return (
    <PublicPage>
      <CursorLogo className="mb-8" />
      <div className="w-full panel p-8 text-center">
        <h1 className="text-xl font-semibold">Email not on the attendee list</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Only approved attendees of {publicEvent.name} can claim credits. Use
          the same email you registered with on Luma.
        </p>
        <Link href="/" className="btn-ghost mt-6">
          Try another email
        </Link>
      </div>
    </PublicPage>
  );
}
