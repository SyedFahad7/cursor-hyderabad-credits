import { redirect } from "next/navigation";
import Link from "next/link";
import { verifyAdminSession } from "@/lib/adminAuth";
import { getSupabaseAdmin, type DashboardStats } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Attempt = {
  id: number;
  email: string | null;
  outcome: string;
  created_at: string;
  ip: string | null;
};

type RecentClaim = {
  id: string;
  email: string;
  name: string | null;
  claimed_at: string | null;
};

async function loadDashboard(): Promise<{
  stats: DashboardStats | null;
  attempts: Attempt[];
  recent: RecentClaim[];
  analytics: {
    last24h: number;
    successRate: number;
    notFoundCount: number;
  };
}> {
  const sb = getSupabaseAdmin();
  const [statsRes, attemptsRes, recentRes, analyticsRes] = await Promise.all([
    sb.from("dashboard_stats").select("*").single(),
    sb
      .from("claim_attempts")
      .select("id,email,outcome,created_at,ip")
      .order("created_at", { ascending: false })
      .limit(15),
    sb
      .from("attendees")
      .select("id,email,name,claimed_at")
      .eq("claimed", true)
      .order("claimed_at", { ascending: false })
      .limit(10),
    sb
      .from("claim_attempts")
      .select("outcome,created_at")
      .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
  ]);

  const analyticsRows = (analyticsRes.data ?? []) as { outcome: string }[];
  const last24h = analyticsRows.length;
  const successes = analyticsRows.filter((a) => a.outcome === "success").length;
  const notFoundCount = analyticsRows.filter((a) => a.outcome === "not_found").length;
  const successRate = last24h > 0 ? Math.round((successes / last24h) * 100) : 0;

  return {
    stats: (statsRes.data as DashboardStats | null) ?? null,
    attempts: (attemptsRes.data ?? []) as Attempt[],
    recent: (recentRes.data ?? []) as RecentClaim[],
    analytics: { last24h, successRate, notFoundCount },
  };
}

export default async function AdminDashboardPage() {
  if (!(await verifyAdminSession())) redirect("/admin/login");

  const { stats, attempts, recent, analytics } = await loadDashboard();

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-ink-muted">
            Live view of attendee claims and credit pool.
          </p>
        </div>
        <Link
          href="/api/admin/export"
          className="btn-ghost"
          prefetch={false}
        >
          Export claims CSV
        </Link>
      </div>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total attendees" value={stats?.total_attendees ?? 0} />
        <StatCard label="Claimed" value={stats?.total_claimed ?? 0} />
        <StatCard
          label="Remaining credits"
          value={stats?.remaining_credits ?? 0}
          tone={
            (stats?.remaining_credits ?? 0) === 0
              ? "warn"
              : (stats?.remaining_credits ?? 0) < 10
                ? "warn"
                : "default"
          }
        />
        <StatCard label="Total credit pool" value={stats?.total_credits ?? 0} />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Attempts (24h)" value={analytics.last24h} subtle />
        <StatCard label="Success rate (24h)" value={`${analytics.successRate}%`} subtle />
        <StatCard label="Not-on-list (24h)" value={analytics.notFoundCount} subtle />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Recent successful claims">
          {recent.length === 0 ? (
            <Empty>No claims yet.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-ink">{r.email}</div>
                    {r.name && (
                      <div className="text-xs text-ink-dim">{r.name}</div>
                    )}
                  </div>
                  <div className="text-xs text-ink-dim">
                    {r.claimed_at ? new Date(r.claimed_at).toLocaleString() : "—"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Latest attempts">
          {attempts.length === 0 ? (
            <Empty>No attempts logged yet.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {attempts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-ink">
                      {a.email ?? "(unknown)"}
                    </div>
                    <div className="text-xs text-ink-dim">
                      {a.ip ?? "—"} · {new Date(a.created_at).toLocaleString()}
                    </div>
                  </div>
                  <OutcomeBadge outcome={a.outcome} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
  subtle = false,
}: {
  label: string;
  value: number | string;
  tone?: "default" | "warn";
  subtle?: boolean;
}) {
  return (
    <div
      className={`panel p-5 ${
        subtle ? "bg-bg-subtle/60" : ""
      } ${tone === "warn" ? "border-amber-500/30" : ""}`}
    >
      <div className="text-xs uppercase tracking-wide text-ink-dim">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-ink">
        {value}
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel p-5">
      <h2 className="mb-3 text-sm font-semibold text-ink">{title}</h2>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-sm text-ink-dim">{children}</p>;
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const map: Record<string, string> = {
    success: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    duplicate: "bg-amber-400/15 text-amber-200 border-amber-400/30",
    not_found: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    no_credits: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    rate_limited: "bg-amber-400/15 text-amber-200 border-amber-400/30",
    error: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  };
  const cls = map[outcome] ?? "bg-line text-ink-muted border-line";
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${cls}`}>
      {outcome}
    </span>
  );
}
