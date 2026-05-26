import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    screens: {
      sm: "640px",
      md: "768px", // tablets / small laptops
      lg: "1024px", // laptops
      xl: "1280px", // large laptops
      "2xl": "1440px", // small monitors
      "3xl": "1700px", // 1440p+ monitors and ultrawides
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
      fontSize: {
        "fluid-display": [
          "clamp(2rem, 1.6rem + 1.6vw, 3rem)",
          { lineHeight: "1.1", letterSpacing: "-0.02em" },
        ],
        "fluid-lead": [
          "clamp(0.95rem, 0.85rem + 0.35vw, 1.125rem)",
          { lineHeight: "1.55" },
        ],
        "fluid-body": [
          "clamp(0.9rem, 0.85rem + 0.2vw, 1rem)",
          { lineHeight: "1.5" },
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
