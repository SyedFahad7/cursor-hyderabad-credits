import type { Metadata, Viewport } from "next";
import "./globals.css";

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
  themeColor: "#05060a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-bg text-ink antialiased">
        <div className="relative min-h-screen overflow-hidden bg-hyd-skyline">
          <div className="grid-bg pointer-events-none absolute inset-0" />
          <div className="relative">{children}</div>
        </div>
      </body>
    </html>
  );
}
