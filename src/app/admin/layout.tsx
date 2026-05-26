import { ThemeToggle } from "@/components/ThemeToggle";
import { CursorLogo } from "@/components/CursorLogo";
import { LogoutButton } from "./LogoutButton";
import { AdminNav } from "./AdminNav";
import Link from "next/link";

export const dynamic = "force-dynamic";

// Each individual admin page (page.tsx) calls verifyAdminSession() and
// redirects to /admin/login on its own. This layout only renders the chrome.
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-bg transition-colors duration-300">
      <div className="grid-bg pointer-events-none absolute inset-0" />
      <ThemeToggle />

      <header className="relative border-b border-line/70 bg-bg-panel/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6 2xl:max-w-[1400px] 3xl:max-w-[1600px]">
          <Link href="/admin" className="flex shrink-0 items-center gap-3">
            <CursorLogo />
            <span className="hidden text-[13px] font-medium text-ink-muted sm:inline-flex">
              <span className="mr-2 text-ink-dim">·</span> Admin
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <AdminNav />
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="relative mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8 2xl:max-w-[1400px] 2xl:py-10 3xl:max-w-[1600px]">
        {children}
      </div>
    </div>
  );
}
