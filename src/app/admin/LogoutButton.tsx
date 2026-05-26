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
      className="ml-2 rounded-lg border border-line bg-bg-subtle px-3 py-1.5 text-sm text-ink-muted transition hover:text-ink"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
