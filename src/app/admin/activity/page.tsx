import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/adminAuth";
import { ActivityLive } from "./ActivityLive";

export const dynamic = "force-dynamic";

export default async function AdminActivityPage() {
  if (!(await verifyAdminSession())) redirect("/admin/login");

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="text-[1.75rem] font-semibold tracking-tight md:text-3xl 2xl:text-[2rem]">
          Activity
        </h1>
        <p className="mt-1 text-sm text-ink-muted 2xl:text-[15px]">
          Live claim + Luma webhook logs, email delivery, and credit-link click
          analytics (last 24 hours).
        </p>
      </div>
      <ActivityLive />
    </div>
  );
}
