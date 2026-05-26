import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/adminAuth";
import { listEvents } from "@/lib/events";
import { CombinedImportPanel } from "./CombinedImportPanel";
import { ImportPanel } from "./ImportPanel";
import { QuickAddPanel } from "./QuickAddPanel";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ event?: string }>;

export default async function ImportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (!(await verifyAdminSession())) redirect("/admin/login");

  const params = await searchParams;
  const preselected = (params.event ?? "").trim();
  const events = await listEvents();
  const eventOptions = events.map((e) => ({ slug: e.slug, name: e.name }));

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="text-[1.75rem] font-semibold tracking-tight md:text-3xl 2xl:text-[2rem]">
          CSV import
        </h1>
        <p className="mt-1 text-sm text-ink-muted 2xl:text-[15px]">
          Pick the target event, drop your CSV. Combined import is the easiest
          flow — one file with both emails and Cursor URLs.
        </p>
      </div>

      {events.length === 0 ? (
        <div className="panel p-6 text-center">
          <p className="text-sm text-ink-muted">
            You don&apos;t have any events yet. Create one on the{" "}
            <a href="/admin/events" className="text-ink underline">
              Events
            </a>{" "}
            page first.
          </p>
        </div>
      ) : (
        <>
          <CombinedImportPanel
            events={eventOptions}
            initialEvent={preselected}
          />

          <QuickAddPanel
            events={eventOptions}
            initialEvent={preselected}
          />

          <details className="panel p-5">
            <summary className="cursor-pointer text-[13px] font-medium text-ink-muted hover:text-ink">
              Advanced: import attendees and credits as separate CSVs
            </summary>
            <p className="mt-2 text-[12.5px] text-ink-dim">
              Use these if you got the credit URLs and the attendee list at
              different times — e.g. Cursor sent you the URLs last week and your
              Luma export is fresh today.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
              <ImportPanel
                kind="attendees"
                title="Attendees only"
                description="CSV with an 'email' column. Optional 'name'. Duplicates per event are skipped."
                sampleHref="/samples/attendees.sample.csv"
                events={eventOptions}
                initialEvent={preselected}
              />
              <ImportPanel
                kind="credits"
                title="Credit URLs only"
                description="CSV with a 'cursor_url' column (or 'url' / 'link' / 'promo_link'). Existing URLs are skipped."
                sampleHref="/samples/credits.sample.csv"
                events={eventOptions}
                initialEvent={preselected}
              />
            </div>
          </details>
        </>
      )}
    </div>
  );
}
