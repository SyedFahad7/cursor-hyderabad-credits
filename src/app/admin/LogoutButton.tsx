"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/admin/logout", { method: "POST" });
        router.replace("/admin/login");
        router.refresh();
      }}
      className="shrink-0 rounded-lg border border-line bg-bg-subtle px-2.5 py-1.5 text-[12px] text-ink-muted transition hover:text-ink md:px-3 md:text-[13px]"
    >
      {busy ? "…" : "Sign out"}
    </button>
  );
}
