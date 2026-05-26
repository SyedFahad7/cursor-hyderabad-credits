import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { AttendeesTable, type AttendeeRow } from "./AttendeesTable";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; status?: string }>;

export default async function AttendeesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (!(await verifyAdminSession())) redirect("/admin/login");

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const status = params.status === "claimed" || params.status === "unclaimed" ? params.status : "all";

  const sb = getSupabaseAdmin();
  let query = sb
    .from("attendees")
    .select("id,email,name,claimed,claimed_at,credit_id,created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (q) query = query.ilike("email", `%${q}%`);
  if (status === "claimed") query = query.eq("claimed", true);
  if (status === "unclaimed") query = query.eq("claimed", false);

  const { data, error } = await query;

  const rows = (data ?? []) as AttendeeRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Attendees</h1>
        <p className="text-sm text-ink-muted">
          Search, resend the credit email, or revoke an issued credit.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          {error.message}
        </div>
      )}

      <AttendeesTable rows={rows} initialQuery={q} initialStatus={status} />
    </div>
  );
}
