"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

type Props = {
  className?: string;
  priority?: boolean;
};

export function CursorLogo({ className = "", priority = false }: Props) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <div
      className={`relative h-8 w-[140px]
                  sm:h-9 sm:w-[160px]
                  2xl:h-10 2xl:w-[180px]
                  3xl:h-11 3xl:w-[200px]
                  ${className}`}
    >
      <Image
        src="/LOCKUP_HORIZONTAL_2D_DARK.png"
        alt="Cursor"
        fill
        priority={priority}
        className={`object-contain object-left transition-[filter,opacity] duration-300 ${
          mounted && resolvedTheme === "light" ? "brightness-0" : ""
        }`}
        sizes="(min-width: 1700px) 200px, (min-width: 1440px) 180px, 160px"
      />
    </div>
  );
}
