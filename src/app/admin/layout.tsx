import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { LogoutButton } from "./LogoutButton";

export const dynamic = "force-dynamic";

// Each individual admin page (page.tsx) calls verifyAdminSession() and
// redirects to /admin/login on its own. This layout only renders the chrome.
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line/70 bg-bg-panel/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Link href="/admin" className="flex items-center gap-3">
            <BrandMark size={32} />
            <span className="text-sm font-medium text-ink">
              Admin · Cursor Hyderabad
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <NavLink href="/admin">Dashboard</NavLink>
            <NavLink href="/admin/attendees">Attendees</NavLink>
            <NavLink href="/admin/credits">Credits</NavLink>
            <NavLink href="/admin/import">Import</NavLink>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-8">{children}</div>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-lg px-3 py-1.5 text-ink-muted transition hover:bg-line hover:text-ink"
    >
      {children}
    </Link>
  );
}
