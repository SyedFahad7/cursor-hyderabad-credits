"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div
        className="fixed right-5 top-5 z-50 h-8 w-[52px] rounded-full border border-line bg-bg-panel/80"
        aria-hidden
      />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="group fixed right-5 top-5 z-50 flex h-8 w-[52px] items-center rounded-full border border-line bg-bg-panel/90 p-1 shadow-sm backdrop-blur transition-colors duration-300 hover:border-ink-dim/40"
    >
      <span
        className={`relative flex h-6 w-6 items-center justify-center rounded-full bg-ink text-bg shadow-sm transition-transform duration-300 ease-out ${
          isDark ? "translate-x-0" : "translate-x-[20px]"
        }`}
      >
        <SunIcon className={`absolute h-3.5 w-3.5 transition-all duration-300 ${isDark ? "scale-0 opacity-0" : "scale-100 opacity-100"}`} />
        <MoonIcon className={`absolute h-3.5 w-3.5 transition-all duration-300 ${isDark ? "scale-100 opacity-100" : "scale-0 opacity-0"}`} />
      </span>
    </button>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
