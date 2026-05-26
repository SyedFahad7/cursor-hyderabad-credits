import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "./env";

/**
 * Server-side Supabase client using the SERVICE ROLE key.
 * NEVER import this from a Client Component or expose to the browser.
 * Bypasses Row-Level Security — only use inside route handlers / server actions.
 */
let serverClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (serverClient) return serverClient;
  const env = getServerEnv();
  serverClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "x-app": "cursor-hyderabad-credits" } },
    },
  );
  return serverClient;
}

export type Event = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  credit_amount: string | null;
  event_date: string | null;
  organizer: string | null;
  host: string | null;
  active: boolean;
  created_at: string;
};

export type EventStats = {
  event_id: string;
  slug: string;
  name: string;
  active: boolean;
  event_date: string | null;
  total_attendees: number;
  total_claimed: number;
  total_credits: number;
  remaining_credits: number;
};

export type Attendee = {
  id: string;
  event_id: string;
  email: string;
  name: string | null;
  claimed: boolean;
  claimed_at: string | null;
  credit_id: string | null;
  created_at: string;
};

export type CreditLink = {
  id: string;
  event_id: string;
  cursor_url: string;
  assigned_to: string | null;
  assigned_at: string | null;
  used: boolean;
  created_at: string;
};

export type DashboardStats = {
  total_attendees: number;
  total_claimed: number;
  total_credits: number;
  remaining_credits: number;
  active_events: number;
};

export type ClaimOutcome =
  | "success"
  | "duplicate"
  | "not_found"
  | "no_credits"
  | "rate_limited"
  | "event_not_found"
  | "error";
