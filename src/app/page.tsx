import Link from "next/link";
import { redirect } from "next/navigation";
import { CursorLogo } from "@/components/CursorLogo";
import { PublicPage } from "@/components/PublicShell";
import { listActiveEvents } from "@/lib/events";

export const dynamic = "force-dynamic";
export const revalidate = 30;

export default async function HomePage() {
  const events = await listActiveEvents();

  // Most common case: a single active event → take the user straight to it.
  if (events.length === 1) {
    redirect(`/e/${events[0].slug}`);
  }

  return (
    <PublicPage>
      <div className="flex w-full flex-col items-center text-center">
        <CursorLogo priority className="mb-7 2xl:mb-9 3xl:mb-10" />

        <h1 className="mt-4 text-fluid-display font-semibold tracking-tight text-ink">
          Cursor Hyderabad
        </h1>
        <p className="mt-2.5 max-w-md text-fluid-lead text-ink-muted 2xl:mt-3">
          Pick your event to claim your free Cursor credits.
        </p>
      </div>

      <div className="mt-8 w-full space-y-3 2xl:mt-10">
        {events.length === 0 && (
          <div className="panel p-6 text-center text-[14px] text-ink-muted">
            No active events right now. Check back closer to the next meetup or
            hackathon.
          </div>
        )}

        {events.map((e) => (
          <Link
            key={e.id}
            href={`/e/${e.slug}`}
            className="panel group block p-5 text-left transition hover:border-ink/20 hover:bg-bg-subtle/60 2xl:p-6"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold text-ink 2xl:text-[16px]">
                  {e.name}
                </div>
                {(e.tagline || e.event_date) && (
                  <div className="mt-0.5 truncate text-[12.5px] text-ink-muted 2xl:text-[13px]">
                    {[e.event_date && formatDate(e.event_date), e.tagline]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                )}
              </div>
              <span className="shrink-0 text-ink-dim transition group-hover:translate-x-0.5 group-hover:text-ink">
                →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </PublicPage>
  );
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
