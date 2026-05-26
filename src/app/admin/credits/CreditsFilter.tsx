"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

type Props = {
  events: { slug: string; name: string }[];
  initialEvent: string;
};

export function CreditsFilter({ events, initialEvent }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function setEvent(slug: string) {
    const sp = new URLSearchParams(params?.toString() ?? "");
    if (slug) sp.set("event", slug);
    else sp.delete("event");
    startTransition(() => {
      router.push(`/admin/credits?${sp.toString()}`);
    });
  }

  return (
    <div className="panel flex flex-wrap items-center gap-3 p-4">
      <label className="text-[12.5px] text-ink-muted" htmlFor="event-filter">
        Event
      </label>
      <select
        id="event-filter"
        defaultValue={initialEvent}
        onChange={(e) => setEvent(e.target.value)}
        className="input max-w-xs"
      >
        <option value="">All events</option>
        {events.map((e) => (
          <option key={e.slug} value={e.slug}>
            {e.name}
          </option>
        ))}
      </select>
    </div>
  );
}
