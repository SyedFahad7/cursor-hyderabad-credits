import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#05060a",
          panel: "#0b0d14",
          subtle: "#10131c",
        },
        line: "#1e2230",
        ink: {
          DEFAULT: "#f4f5f7",
          muted: "#9aa3b2",
          dim: "#5e6675",
        },
        accent: {
          DEFAULT: "#7c5cff",
          glow: "#9b7bff",
          warm: "#ff7a59",
        },
        hyd: {
          gold: "#f5b042",
          rose: "#ff5277",
          violet: "#7c5cff",
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
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      backgroundImage: {
        "hyd-skyline":
          "radial-gradient(1200px 600px at 50% -10%, rgba(124,92,255,0.18) 0%, rgba(5,6,10,0) 60%), radial-gradient(800px 400px at 80% 10%, rgba(255,82,119,0.10) 0%, rgba(5,6,10,0) 60%), radial-gradient(900px 500px at 10% 30%, rgba(245,176,66,0.08) 0%, rgba(5,6,10,0) 60%)",
        "grid-faint":
          "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(124,92,255,0.35), 0 8px 40px -6px rgba(124,92,255,0.45)",
        panel: "0 1px 0 rgba(255,255,255,0.04) inset, 0 30px 80px -40px rgba(0,0,0,0.6)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
      },
      animation: {
        shimmer: "shimmer 2.5s linear infinite",
        float: "float 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
