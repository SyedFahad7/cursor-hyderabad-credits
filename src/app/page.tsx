import { ClaimForm } from "@/components/ClaimForm";
import { CursorLogo } from "@/components/CursorLogo";
import { PublicPage } from "@/components/PublicShell";
import { getSupabaseAdmin, type DashboardStats } from "@/lib/supabase";

export const revalidate = 15;

async function getStats(): Promise<DashboardStats | null> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("dashboard_stats")
      .select("*")
      .single();
    if (error) return null;
    return data as DashboardStats;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const stats = await getStats();
  const remaining = stats?.remaining_credits ?? 0;
  const claimed = stats?.total_claimed ?? 0;
  const totalAttendees = stats?.total_attendees ?? 0;

  return (
    <PublicPage>
      <div className="flex w-full flex-col items-center text-center">
        <CursorLogo priority className="mb-8" />

        {stats && (
          <>
            <div className="status-badge">
              <span className="status-dot" />
              {remaining > 0
                ? `${remaining} credit${remaining === 1 ? "" : "s"} available`
                : "All credits claimed"}
            </div>
            <p className="mt-3 text-[13px] text-ink-dim">
              {claimed} of {totalAttendees} attendees have already claimed
            </p>
          </>
        )}

        <h1 className="mt-8 text-[2rem] font-semibold leading-tight tracking-tight text-ink sm:text-[2.25rem]">
          Cursor Hyderabad
        </h1>
        <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-ink-muted">
          Get your free credit from Cursor. Sign up in seconds.
        </p>
      </div>

      <div className="mt-8 w-full panel p-6 sm:p-7">
        <ClaimForm />
      </div>

      <p className="mt-6 max-w-sm text-center text-[12px] leading-relaxed text-ink-dim">
        Only participants registered for the event can obtain credits.
        One credit per person.
      </p>
    </PublicPage>
  );
}
