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
      <main
        className="public-main mx-auto flex w-full max-w-[420px] flex-col
                   px-5 pt-14 pb-8
                   sm:pt-16
                   md:max-w-[440px] md:px-6 md:pt-20
                   lg:max-w-[460px]
                   2xl:max-w-[500px]
                   3xl:max-w-[560px]"
      >
        <div className="public-main-content">{children}</div>
        {footer && <Footer />}
      </main>
    </PublicShell>
  );
}
