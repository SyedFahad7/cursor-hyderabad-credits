import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ClaimForm } from "@/components/ClaimForm";
import { CursorLogo } from "@/components/CursorLogo";
import { PublicPage } from "@/components/PublicShell";
import { getEventBySlug, getEventStats } from "@/lib/events";

export const dynamic = "force-dynamic";
export const revalidate = 15;

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return { title: "Event not found" };
  return {
    title: `${event.name} — Claim your Cursor credits`,
    description: event.tagline ?? "Claim your Cursor credits.",
  };
}

export default async function EventClaimPage({ params }: { params: Params }) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const stats = await getEventStats(slug);
  const remaining = stats?.remaining_credits ?? 0;

  const status: "available" | "sold_out" | "closed" = !event.active
    ? "closed"
    : remaining === 0
      ? "sold_out"
      : "available";

  const badgeText =
    status === "available"
      ? "Credits available"
      : status === "sold_out"
        ? "All credits claimed"
        : "Claims closed";

  const badgeClass =
    status === "available"
      ? "status-badge"
      : status === "sold_out"
        ? "status-badge status-badge--warn"
        : "status-badge status-badge--off";

  const dotClass =
    status === "available"
      ? "status-dot"
      : status === "sold_out"
        ? "status-dot status-dot--warn"
        : "status-dot status-dot--off";

  return (
    <PublicPage>
      <div className="flex w-full flex-col items-center text-center">
        <CursorLogo priority className="mb-7 2xl:mb-9 3xl:mb-10" />

        {stats && (
          <div className={badgeClass}>
            <span className={dotClass} />
            {badgeText}
          </div>
        )}

        <h1 className="mt-7 text-fluid-display font-semibold tracking-tight text-ink 2xl:mt-9">
          {event.name}
        </h1>
        <p className="mt-2.5 max-w-sm text-fluid-lead text-ink-muted 2xl:mt-3 2xl:max-w-md">
          {event.tagline ?? "Get your free credits from Cursor. Sign up in seconds."}
        </p>
      </div>

      <div className="mt-8 w-full panel p-6 sm:p-7 2xl:mt-10 2xl:p-8 3xl:p-9">
        {status === "closed" ? (
          <div className="text-center">
            <h3 className="text-[16px] font-semibold text-ink 2xl:text-[17px]">
              This event isn&apos;t accepting claims right now
            </h3>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-muted 2xl:text-[15px]">
              The organizer has closed credit claims for{" "}
              <span className="text-ink">{event.name}</span>. If you think this
              is a mistake, please reach out to the host.
            </p>
          </div>
        ) : (
          <ClaimForm eventSlug={event.slug} />
        )}
      </div>
    </PublicPage>
  );
}
