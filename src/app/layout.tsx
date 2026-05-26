import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import "./globals.css";

const outfit = localFont({
  src: "../../public/fonts/Outfit.ttf",
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cursor Hyderabad Meetup — Claim your credits",
  description:
    "Approved attendees of the Cursor Hyderabad Meetup can claim their Cursor credits here.",
  openGraph: {
    title: "Cursor Hyderabad Meetup — Claim your credits",
    description:
      "Approved attendees of the Cursor Hyderabad Meetup can claim their Cursor credits here.",
    type: "website",
  },
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f3" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={outfit.variable}>
      <body
        className={`${outfit.className} min-h-screen bg-bg font-sans text-ink antialiased transition-colors duration-300`}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
