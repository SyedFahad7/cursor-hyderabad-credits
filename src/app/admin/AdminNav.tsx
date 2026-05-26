"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/attendees", label: "Attendees" },
  { href: "/admin/credits", label: "Credits" },
  { href: "/admin/import", label: "Import" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="scroll-thin -mx-1 flex items-center gap-0.5 overflow-x-auto px-1 text-[13px] md:text-sm">
      {NAV.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/admin" && pathname?.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-lg px-2.5 py-1.5 transition md:px-3 ${
              active
                ? "bg-bg-subtle text-ink"
                : "text-ink-muted hover:bg-bg-subtle hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
