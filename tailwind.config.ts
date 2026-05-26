import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    screens: {
      sm: "640px",
      md: "768px", // laptops
      lg: "1024px",
      xl: "1280px",
      "2xl": "1440px", // monitors & large displays
    },
    extend: {
      colors: {
        bg: {
          DEFAULT: "var(--color-bg)",
          panel: "var(--color-bg-panel)",
          subtle: "var(--color-bg-subtle)",
        },
        line: "var(--color-line)",
        ink: {
          DEFAULT: "var(--color-ink)",
          muted: "var(--color-ink-muted)",
          dim: "var(--color-ink-dim)",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-outfit)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      transitionDuration: {
        theme: "300ms",
      },
    },
  },
  plugins: [],
};

export default config;
