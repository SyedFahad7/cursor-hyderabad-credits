import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/adminAuth";
import { listEventStats } from "@/lib/events";
import { GiftForm } from "./GiftForm";

export const dynamic = "force-dynamic";

export default async function AdminGiftPage() {
  if (!(await verifyAdminSession())) redirect("/admin/login");

  const events = await listEventStats();

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="text-[1.75rem] font-semibold tracking-tight md:text-3xl 2xl:text-[2rem]">
          Gift credits
        </h1>
        <p className="mt-1 text-sm text-ink-muted 2xl:text-[15px]">
          Send leftover Cursor credits to any email as a gift. Auto picks the
          oldest event with leftovers, or choose a pool yourself.
        </p>
      </div>
      <GiftForm events={events} />
    </div>
  );
}
