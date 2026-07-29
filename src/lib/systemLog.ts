import { getSupabaseAdmin } from "@/lib/supabase";

export type LogLevel = "info" | "warn" | "error";

/**
 * Fire-and-forget structured log into public.system_logs so failures are
 * visible in the admin debug panel (Vercel console logs are hard to reach
 * mid-event). Never throws — logging must not break the request.
 */
export async function logSystem(
  level: LogLevel,
  source: string,
  message: string,
  detail?: Record<string, unknown>,
) {
  try {
    const sb = getSupabaseAdmin();
    await sb.from("system_logs").insert({
      level,
      source,
      message,
      detail: detail ?? null,
    });
  } catch {
    // swallow — the console.* call at the call-site still fires
  }
}

export function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
