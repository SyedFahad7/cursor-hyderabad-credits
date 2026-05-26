import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  cursor_url: string;
  used: boolean;
  assigned_to: string | null;
  assigned_at: string | null;
};

export default async function CreditsPage() {
  if (!(await verifyAdminSession())) redirect("/admin/login");

  const sb = getSupabaseAdmin();
  const [{ data: credits }, { data: stats }] = await Promise.all([
    sb
      .from("credit_links")
      .select("id,cursor_url,used,assigned_to,assigned_at")
      .order("created_at", { ascending: true })
      .limit(500),
    sb.from("dashboard_stats").select("*").single(),
  ]);

  const rows = (credits ?? []) as Row[];
  const used = rows.filter((r) => r.used).length;
  const total = stats?.total_credits ?? rows.length;
  const remaining = stats?.remaining_credits ?? rows.length - used;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Credits</h1>
          <p className="text-sm text-ink-muted">
            The pool of Cursor credit URLs. Raw URLs are admin-only.
          </p>
        </div>
        <div className="flex gap-3 text-sm text-ink-muted">
          <span className="chip">Total: <strong className="text-ink ml-1">{total}</strong></span>
          <span className="chip">Used: <strong className="text-ink ml-1">{used}</strong></span>
          <span className="chip">Remaining: <strong className="text-ink ml-1">{remaining}</strong></span>
        </div>
      </div>

      <div className="panel overflow-x-auto scroll-thin">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs uppercase text-ink-dim">
            <tr>
              <th className="px-4 py-3">Cursor URL</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Assigned at</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-ink-dim">
                  No credit URLs yet. Import some on the{" "}
                  <a className="text-ink underline" href="/admin/import">
                    Import
                  </a>{" "}
                  page.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-bg-subtle/60">
                <td className="px-4 py-3">
                  <code className="break-all rounded bg-bg-subtle px-2 py-1 text-[12px] text-ink-muted">
                    {r.cursor_url}
                  </code>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] ${
                      r.used
                        ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
                        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                    }`}
                  >
                    {r.used ? "used" : "available"}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink-muted">
                  {r.assigned_at ? new Date(r.assigned_at).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-dim">Showing up to 500 rows.</p>
    </div>
  );
}
