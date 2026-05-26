import { ClaimForm } from "@/components/ClaimForm";
import { BrandMark } from "@/components/BrandMark";
import { Footer } from "@/components/Footer";
import { publicEvent } from "@/lib/env";
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
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center px-5 pt-20 sm:pt-28">
      <div className="flex flex-col items-center text-center">
        <div className="animate-float">
          <BrandMark size={56} />
        </div>

        {stats && (
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-line bg-bg-panel/70 px-3 py-1 text-xs text-ink-muted">
            <span
              className={`h-2 w-2 rounded-full ${
                remaining > 0 ? "bg-emerald-400" : "bg-rose-400"
              }`}
            />
            {remaining > 0
              ? `${remaining} credit${remaining === 1 ? "" : "s"} available`
              : "All credits claimed"}
          </div>
        )}

        {stats && (
          <p className="mt-3 text-[13px] text-ink-dim">
            {claimed} of {totalAttendees} attendees have already claimed
          </p>
        )}

        <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
          <span className="text-gradient-hyd">{publicEvent.name}</span>
        </h1>
        <p className="mt-3 max-w-md text-[15px] text-ink-muted">
          Claim your free Cursor credits below.{" "}
          <span className="text-ink">Takes a few seconds.</span>
        </p>
      </div>

      <div className="mt-10 w-full panel p-6 sm:p-8">
        <ClaimForm />
      </div>

      <p className="mt-6 max-w-md text-center text-[12px] leading-relaxed text-ink-dim">
        Only attendees registered for the meetup on Luma can claim credits.
        One credit per person.
      </p>

      <Footer />
    </main>
  );
}
