import Link from "next/link";
import { CursorLogo } from "@/components/CursorLogo";
import { PublicPage } from "@/components/PublicShell";

export const metadata = { title: "Event not found" };

export default function EventNotFound() {
  return (
    <PublicPage>
      <CursorLogo className="mb-8" />
      <div className="w-full panel p-8 text-center">
        <h1 className="text-xl font-semibold">Event not found</h1>
        <p className="mt-2 text-sm text-ink-muted">
          This event link is invalid or has been disabled.
        </p>
        <Link href="/" className="btn-ghost mt-6">
          See active events
        </Link>
      </div>
    </PublicPage>
  );
}
