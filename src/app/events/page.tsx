"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarX, ChevronRight, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FORMAT_LABELS, STATUS_LABELS, formatDate } from "@/lib/utils";
import type { PadelEvent } from "@/lib/types";
import { AppPage, BottomNav, TopBar } from "@/components/shell";
import { Badge, Button, EmptyState, PageLoader } from "@/components/ui";

type EventWithCount = PadelEvent & { event_players: Array<{ count: number }>; mine: boolean };

export default function EventsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [events, setEvents] = useState<EventWithCount[] | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: organized }, { data: participations }] = await Promise.all([
        supabase
          .from("events")
          .select("*, event_players(count)")
          .eq("organizer_id", user.id)
          .order("created_at", { ascending: false }),
        supabase.from("event_players").select("event_id").eq("profile_id", user.id),
      ]);

      const organizedList = (organized ?? []).map((e) => ({ ...e, mine: true }));
      const organizedIds = new Set(organizedList.map((e) => e.id));
      const joinedIds = (participations ?? [])
        .map((p) => p.event_id)
        .filter((id) => !organizedIds.has(id));

      let joined: EventWithCount[] = [];
      if (joinedIds.length > 0) {
        const { data } = await supabase
          .from("events")
          .select("*, event_players(count)")
          .in("id", joinedIds)
          .order("created_at", { ascending: false });
        joined = (data ?? []).map((e) => ({ ...e, mine: false }));
      }

      setEvents(
        [...organizedList, ...joined].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ) as EventWithCount[],
      );
    })();
  }, [supabase]);

  return (
    <>
      <TopBar title="Mes événements" />
      <AppPage>
        {events === null ? (
          <PageLoader />
        ) : events.length === 0 ? (
          <EmptyState
            icon={<CalendarX className="size-6" />}
            title="Aucun événement"
            body="Crée ton premier americano, mexicano ou tournoi en moins d'une minute."
            action={
              <Link href="/events/new">
                <Button>Créer un événement</Button>
              </Link>
            }
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {events.map((e) => (
              <li key={e.id}>
                <Link
                  href={e.mine ? `/events/${e.id}` : `/join/${e.share_code}`}
                  className="flex items-center gap-3 bg-surface border border-border rounded-(--radius-card) p-4 transition-all duration-150 hover:border-border-strong active:scale-[0.99]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{e.name}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <Badge tone="lime">{FORMAT_LABELS[e.format]}</Badge>
                      <Badge
                        tone={e.status === "active" ? "warning" : e.status === "completed" ? "success" : "muted"}
                      >
                        {STATUS_LABELS[e.status]}
                      </Badge>
                      {!e.mine && <Badge tone="info">Participant</Badge>}
                      <span className="inline-flex items-center gap-1 text-xs text-ink-faint font-medium">
                        <Users className="size-3.5" aria-hidden />
                        {e.event_players?.[0]?.count ?? 0}
                      </span>
                    </div>
                    <p className="text-xs text-ink-faint mt-1.5">{formatDate(e.created_at)}</p>
                  </div>
                  <ChevronRight className="size-5 text-ink-faint shrink-0" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </AppPage>
      <BottomNav />
    </>
  );
}
