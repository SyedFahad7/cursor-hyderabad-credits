import { z } from "zod";

const ServerEnv = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
  RESEND_API_KEY: z.string().min(5),
  RESEND_FROM_EMAIL: z.string().min(3),
  RESEND_REPLY_TO: z.string().optional(),
  ADMIN_PASSWORD: z.string().min(6),
  ADMIN_SESSION_SECRET: z.string().min(16),
  RATE_LIMIT_MAX: z.string().default("5"),
  RATE_LIMIT_WINDOW: z.string().default("60"),
});

let cached: z.infer<typeof ServerEnv> | null = null;

export function getServerEnv() {
  if (cached) return cached;
  const parsed = ServerEnv.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid or missing environment variables:\n${issues}\n\nCheck your .env.local against .env.example.`,
    );
  }
  cached = parsed.data;
  return cached;
}

export const publicEvent = {
  name: process.env.NEXT_PUBLIC_EVENT_NAME ?? "Cursor Hyderabad Meetup",
  date: process.env.NEXT_PUBLIC_EVENT_DATE ?? "May 24",
  host: process.env.NEXT_PUBLIC_EVENT_HOST ?? "Fahad",
  organizer:
    process.env.NEXT_PUBLIC_EVENT_ORGANIZER ?? "Cursor Hyderabad, India",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "",
};
