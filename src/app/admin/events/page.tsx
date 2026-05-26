import { redirect } from "next/navigation";
import Link from "next/link";
import { verifyAdminSession } from "@/lib/adminAuth";
import { listEventStats } from "@/lib/events";
import { CreateEventForm } from "./CreateEventForm";
import { EventsTable } from "./EventsTable";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  if (!(await verifyAdminSession())) redirect("/admin/login");

  const events = await listEventStats();

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="text-[1.75rem] font-semibold tracking-tight md:text-3xl 2xl:text-[2rem]">
          Events
        </h1>
        <p className="mt-1 text-sm text-ink-muted 2xl:text-[15px]">
          Create one event per meetup, hackathon, or Cafe Cursor. Attendees and
          credits are scoped per event.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-[2fr_3fr]">
        <CreateEventForm />
        <EventsTable rows={events} />
      </div>

      <p className="text-xs text-ink-dim">
        Public URLs:{" "}
        <code className="rounded bg-bg-subtle px-1.5 py-0.5">/e/&lt;slug&gt;</code>{" "}
        · Or share the root URL{" "}
        <Link href="/" className="text-ink-muted underline underline-offset-2">
          /
        </Link>{" "}
        to let attendees pick the event.
      </p>
    </div>
  );
}
