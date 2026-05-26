import { cache } from "react";
import { getSupabaseAdmin, type Event, type EventStats } from "./supabase";

/**
 * Fetch all events. Uses React's `cache` so multiple components in the same
 * render share one DB call.
 */
export const listEvents = cache(async (): Promise<Event[]> => {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("events")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[events.listEvents]", error);
    return [];
  }
  return (data ?? []) as Event[];
});

export const listActiveEvents = cache(async (): Promise<Event[]> => {
  const all = await listEvents();
  return all.filter((e) => e.active);
});

export async function getEventBySlug(slug: string): Promise<Event | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("events")
    .select("*")
    .eq("slug", slug.toLowerCase().trim())
    .maybeSingle();
  if (error) {
    console.error("[events.getEventBySlug]", error);
    return null;
  }
  return (data as Event | null) ?? null;
}

export async function getEventStats(slug: string): Promise<EventStats | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("event_stats")
    .select("*")
    .eq("slug", slug.toLowerCase().trim())
    .maybeSingle();
  if (error) {
    console.error("[events.getEventStats]", error);
    return null;
  }
  return (data as EventStats | null) ?? null;
}

export async function listEventStats(): Promise<EventStats[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("event_stats")
    .select("*")
    .order("event_date", { ascending: false, nullsFirst: false });
  if (error) {
    console.error("[events.listEventStats]", error);
    return [];
  }
  return (data ?? []) as EventStats[];
}

/** Strict slug validation: lowercase letters, numbers, hyphens; 2-60 chars. */
export const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

export function isValidSlug(s: string): boolean {
  return SLUG_REGEX.test(s) && s.length >= 2 && s.length <= 60;
}
