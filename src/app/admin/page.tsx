import { redirect } from "next/navigation";
import Link from "next/link";
import { verifyAdminSession } from "@/lib/adminAuth";
import { getSupabaseAdmin, type DashboardStats } from "@/lib/supabase";
import { listEventStats } from "@/lib/events";
import { fmtDateTime } from "@/lib/dates";

export const dynamic = "force-dynamic";

type Attempt = {
  id: number;
  email: string | null;
  outcome: string;
  created_at: string;
  ip: string | null;
  event_id: string | null;
};

type RecentClaim = {
  id: string;
  email: string;
  name: string | null;
  claimed_at: string | null;
  event_id: string;
};

async function loadDashboard(): Promise<{
  stats: DashboardStats | null;
  attempts: Attempt[];
  recent: RecentClaim[];
  analytics: { last24h: number; successRate: number; notFoundCount: number };
}> {
  const sb = getSupabaseAdmin();
  const [statsRes, attemptsRes, recentRes, analyticsRes] = await Promise.all([
    sb.from("dashboard_stats").select("*").single(),
    sb
      .from("claim_attempts")
      .select("id,email,outcome,created_at,ip,event_id")
      .order("created_at", { ascending: false })
      .limit(15),
    sb
      .from("attendees")
      .select("id,event_id,email,name,claimed_at")
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

  const [{ stats, attempts, recent, analytics }, eventStats] = await Promise.all([
    loadDashboard(),
    listEventStats(),
  ]);

  const eventMap = new Map(eventStats.map((e) => [e.event_id, e]));

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[1.75rem] font-semibold tracking-tight md:text-3xl 2xl:text-[2rem]">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-ink-muted 2xl:text-[15px]">
            Across {stats?.active_events ?? 0} active event
            {(stats?.active_events ?? 0) === 1 ? "" : "s"}.
          </p>
        </div>
        <Link
          href="/api/admin/export"
          className="btn-ghost self-start sm:self-auto"
          prefetch={false}
        >
          Export claims CSV
        </Link>
      </div>

      <section className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-5">
        <StatCard label="Active events" value={stats?.active_events ?? 0} />
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

      <section className="grid grid-cols-1 gap-3 md:gap-4 sm:grid-cols-3">
        <StatCard label="Attempts (24h)" value={analytics.last24h} subtle />
        <StatCard
          label="Success rate (24h)"
          value={`${analytics.successRate}%`}
          subtle
        />
        <StatCard
          label="Not-on-list (24h)"
          value={analytics.notFoundCount}
          subtle
        />
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-[15px] font-semibold text-ink 2xl:text-base">
            Events
          </h2>
          <Link
            href="/admin/events"
            className="text-[12.5px] text-ink-muted underline underline-offset-2 hover:text-ink"
          >
            Manage →
          </Link>
        </div>
        <div className="panel overflow-x-auto scroll-thin">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase text-ink-dim">
              <tr>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Attendees</th>
                <th className="px-4 py-3">Claimed</th>
                <th className="px-4 py-3">Remaining</th>
                <th className="px-4 py-3">Pool</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {eventStats.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-ink-dim"
                  >
                    No events yet.{" "}
                    <Link
                      href="/admin/events"
                      className="text-ink underline"
                    >
                      Create one
                    </Link>
                    .
                  </td>
                </tr>
              )}
              {eventStats.map((e) => (
                <tr key={e.event_id} className="hover:bg-bg-subtle/60">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink">{e.name}</div>
                    <div className="text-[11.5px] text-ink-dim">
                      <Link
                        href={`/e/${e.slug}`}
                        className="underline underline-offset-2 hover:text-ink-muted"
                        target="_blank"
                      >
                        /e/{e.slug}
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] ${
                        e.active
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                          : "border-line bg-bg-subtle text-ink-muted"
                      }`}
                    >
                      {e.active ? "active" : "hidden"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink">{e.total_attendees}</td>
                  <td className="px-4 py-3 text-ink">{e.total_claimed}</td>
                  <td
                    className={`px-4 py-3 ${
                      e.remaining_credits === 0
                        ? "text-rose-700 dark:text-rose-300"
                        : "text-ink"
                    }`}
                  >
                    {e.remaining_credits}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{e.total_credits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
        <Panel title="Recent successful claims">
          {recent.length === 0 ? (
            <Empty>No claims yet.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm text-ink">{r.email}</div>
                    <div className="text-xs text-ink-dim">
                      {eventMap.get(r.event_id)?.name ?? "—"}
                      {r.name && <> · {r.name}</>}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs text-ink-dim">
                    {r.claimed_at
                      ? fmtDateTime(r.claimed_at)
                      : "—"}
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
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm text-ink">
                      {a.email ?? "(unknown)"}
                    </div>
                    <div className="text-xs text-ink-dim">
                      {a.event_id
                        ? eventMap.get(a.event_id)?.name ?? "—"
                        : "—"}{" "}
                      · {a.ip ?? "—"} ·{" "}
                      {fmtDateTime(a.created_at)}
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
      className={`panel p-4 md:p-5 2xl:p-6 ${
        subtle ? "bg-bg-subtle/60" : ""
      } ${tone === "warn" ? "border-amber-500/30" : ""}`}
    >
      <div className="text-[11px] uppercase tracking-wide text-ink-dim md:text-xs">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-ink md:text-3xl 2xl:text-[2rem]">
        {value}
      </div>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel p-4 md:p-5 2xl:p-6">
      <h2 className="mb-3 text-sm font-semibold text-ink 2xl:text-[15px]">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-sm text-ink-dim">{children}</p>;
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const map: Record<string, string> = {
    success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    duplicate: "bg-amber-400/15 text-amber-700 dark:text-amber-200 border-amber-400/30",
    not_found: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
    no_credits: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
    rate_limited: "bg-amber-400/15 text-amber-700 dark:text-amber-200 border-amber-400/30",
    event_not_found: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
    error: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  };
  const cls = map[outcome] ?? "bg-line text-ink-muted border-line";
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${cls}`}
    >
      {outcome}
    </span>
  );
}
