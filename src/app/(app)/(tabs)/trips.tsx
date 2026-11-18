import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Body, Button, Caption, Card, EmptyState, ErrorNote, Loading, ProgressBar, Screen, SectionLabel } from '@/components/ui';
import { useAllListItems, useTrips } from '@/features/lists/api';
import { daysToGo, formatMoney, toIsoDate, tripProgress } from '@/lib/domain';
import type { List, ListItem } from '@/lib/types';
import { space, type, useColors } from '@/theme';

function TripCard({ trip, items, today }: { trip: List; items: ListItem[]; today: string }) {
  const c = useColors();
  const gifts = items.filter((i) => (i.category ?? 'gifts') === 'gifts');
  const g = tripProgress(gifts);
  const all = tripProgress(items);
  const over = trip.budget != null && all.spent > trip.budget;
  const countdown = daysToGo(trip.starts_on, today);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/trips/[id]', params: { id: trip.id } })}
      accessibilityRole="button"
      accessibilityLabel={`Open ${trip.title}`}
      style={({ pressed }) => pressed && { opacity: 0.7 }}>
      <Card style={{ paddingVertical: space.lg, gap: space.sm }}>
        <Text style={[type.heading, { color: c.text }]}>{trip.title}</Text>
        {countdown ? <Caption>{countdown}</Caption> : <Caption>No date set</Caption>}
        <ProgressBar value={g.total ? g.done / g.total : 0} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
          <Caption>
            Gifts bought {g.done}/{g.total}
          </Caption>
          <Caption style={over ? { color: c.danger, fontWeight: '700' } : undefined}>
            Spent {formatMoney(all.spent)}
            {trip.budget != null ? ` of ${formatMoney(trip.budget)}` : ''}
          </Caption>
        </View>
      </Card>
    </Pressable>
  );
}

export default function TripsTab() {
  const trips = useTrips();
  const items = useAllListItems();
  const [showArchived, setShowArchived] = useState(false);
  const today = toIsoDate(new Date());

  if (trips.isLoading || items.isLoading) return <Loading />;

  const byList = (id: string) => (items.data ?? []).filter((i) => i.list_id === id);
  const sorted = [...(trips.data ?? [])].sort((a, b) =>
    (a.starts_on ?? '9999-12-31').localeCompare(b.starts_on ?? '9999-12-31'),
  );
  const active = sorted.filter((t) => !t.archived);
  const archived = sorted.filter((t) => t.archived);

  return (
    <Screen
      title="Trips"
      right={<Button label="New trip" onPress={() => router.push('/trips/edit')} style={{ minHeight: 40 }} />}>
      <ErrorNote error={trips.error ?? items.error} />
      {active.length === 0 ? (
        <EmptyState
          title="No trips yet"
          message="Plan gifts, packing and what to bring back for your next trip."
          action={<Button label="Plan a trip" onPress={() => router.push('/trips/edit')} />}
        />
      ) : (
        active.map((t) => <TripCard key={t.id} trip={t} items={byList(t.id)} today={today} />)
      )}

      {archived.length > 0 ? (
        <>
          <SectionLabel
            right={
              <Pressable onPress={() => setShowArchived((s) => !s)} accessibilityRole="button" hitSlop={8}>
                <Body muted>{showArchived ? 'Hide' : `Show (${archived.length})`}</Body>
              </Pressable>
            }>
            Archived
          </SectionLabel>
          {showArchived ? archived.map((t) => <TripCard key={t.id} trip={t} items={byList(t.id)} today={today} />) : null}
        </>
      ) : null}
    </Screen>
  );
}
