import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/adminAuth";
import { ImportPanel } from "./ImportPanel";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  if (!(await verifyAdminSession())) redirect("/admin/login");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">CSV import</h1>
        <p className="text-sm text-ink-muted">
          Upload attendee lists (from Luma) and Cursor credit URLs.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ImportPanel
          kind="attendees"
          title="Import attendees"
          description="CSV with an 'email' column. Optional 'name' column. Duplicates (case-insensitive) are skipped."
          sampleHref="/samples/attendees.sample.csv"
        />
        <ImportPanel
          kind="credits"
          title="Import credit URLs"
          description="CSV with a 'cursor_url' column (or 'url' / 'link'). Existing URLs are skipped."
          sampleHref="/samples/credits.sample.csv"
        />
      </div>
    </div>
  );
}
