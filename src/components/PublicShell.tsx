import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";
import type { ReactNode } from "react";

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-bg transition-colors duration-300">
      <div className="grid-bg pointer-events-none absolute inset-0" />
      <ThemeToggle />
      <div className="relative">{children}</div>
    </div>
  );
}

export function PublicPage({
  children,
  footer = true,
}: {
  children: ReactNode;
  footer?: boolean;
}) {
  return (
    <PublicShell>
      <main className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col items-center px-5 pb-12 pt-16 sm:pt-20">
        {children}
        {footer && <Footer />}
      </main>
    </PublicShell>
  );
}
