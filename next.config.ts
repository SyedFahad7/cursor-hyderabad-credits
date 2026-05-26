import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  // Ensure the Cursor logo is bundled into the serverless functions so the
  // email lib can read it from disk and embed as a CID inline attachment.
  // Without this Vercel's nft tracer may exclude it from the API bundle.
  outputFileTracingIncludes: {
    "/api/claim": ["./public/CUBE_2D_DARK.png"],
    "/api/admin/attendees/**": ["./public/CUBE_2D_DARK.png"],
  },
};

export default nextConfig;
