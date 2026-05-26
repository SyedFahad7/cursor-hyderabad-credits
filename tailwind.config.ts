import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
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
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
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
