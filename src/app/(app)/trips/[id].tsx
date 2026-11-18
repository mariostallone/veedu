import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  Avatar,
  Body,
  Button,
  Caption,
  Card,
  Checkbox,
  EmptyState,
  ErrorNote,
  Loading,
  ProgressBar,
  Row,
  Screen,
  SectionLabel,
  Segmented,
} from '@/components/ui';
import { useMemberMap } from '@/features/household/api';
import { useList, useListItems, useToggleListItem } from '@/features/lists/api';
import { itemCategory, TRIP_TABS } from '@/features/trips/api';
import { daysToGo, formatMoney, groupBy, toIsoDate, tripProgress } from '@/lib/domain';
import type { TripCategory } from '@/lib/types';
import { space, type, useColors } from '@/theme';

export default function TripDetail() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useList(id);
  const items = useListItems(id);
  const toggle = useToggleListItem();
  const members = useMemberMap();
  const [tab, setTab] = useState<TripCategory>('gifts');

  if (trip.isLoading || items.isLoading) return <Loading />;
  if (!trip.data) {
    return (
      <Screen edges={['bottom']}>
        <Stack.Screen options={{ title: 'Trip' }} />
        <EmptyState title="Trip not found" message="It may have been deleted." action={<Button label="Back to trips" onPress={() => router.dismissTo('/trips')} />} />
      </Screen>
    );
  }

  const t = trip.data;
  const all = items.data ?? [];
  const p = tripProgress(all);
  const over = t.budget != null && p.spent > t.budget;
  const countdown = daysToGo(t.starts_on, toIsoDate(new Date()));
  const inTab = all.filter((i) => itemCategory(i) === tab);
  const groups = groupBy(inTab, (i) => i.group_name, { fallback: 'Everyone' });
  const label = TRIP_TABS.find((o) => o.value === tab)!.label;

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: t.title }} />
      <Card style={{ paddingVertical: space.lg, gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Text style={[type.heading, { color: c.text }]}>{t.title}</Text>
            <Caption>
              {[countdown, t.archived ? 'Archived' : null].filter(Boolean).join(' · ') || 'No date set'}
            </Caption>
          </View>
          <Button
            label="Edit"
            variant="secondary"
            style={{ minHeight: 40 }}
            onPress={() => router.push({ pathname: '/trips/edit', params: { id: t.id } })}
          />
        </View>
        <ProgressBar value={p.total ? p.done / p.total : 0} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
          <Caption>
            {p.done}/{p.total} done
          </Caption>
          <Caption style={over ? { color: c.danger, fontWeight: '700' } : undefined}>
            Spent {formatMoney(p.spent)}
            {t.budget != null ? ` of ${formatMoney(t.budget)}` : ''} · planned {formatMoney(p.planned)}
          </Caption>
        </View>
      </Card>

      <Segmented options={TRIP_TABS} value={tab} onChange={setTab} />
      <ErrorNote error={items.error ?? toggle.error} />

      {inTab.length === 0 ? (
        <EmptyState title={`No ${label.toLowerCase()} yet`} message="Add the first one below." />
      ) : (
        groups.map((g) => (
          <View key={g.key} style={{ gap: space.xs }}>
            <SectionLabel right={<Caption>{formatMoney(tripProgress(g.items).planned)}</Caption>}>{g.key}</SectionLabel>
            <Card>
              {g.items.map((item, i) => {
                const owner = item.owner_id ? members.get(item.owner_id) : undefined;
                const cost = item.cost != null ? item.cost * item.qty : null;
                return (
                  <Row
                    key={item.id}
                    last={i === g.items.length - 1}
                    muted={item.done}
                    title={item.qty > 1 ? `${item.text} ×${item.qty}` : item.text}
                    subtitle={item.note ?? undefined}
                    left={
                      <Checkbox
                        checked={item.done}
                        label={`Mark ${item.text} ${item.done ? 'not done' : 'done'}`}
                        onChange={(done) => toggle.mutate({ item, done })}
                      />
                    }
                    right={
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                        {cost != null ? <Body muted>{formatMoney(cost)}</Body> : null}
                        {owner ? <Avatar name={owner.display_name} color={owner.color} /> : null}
                      </View>
                    }
                    onPress={() => router.push({ pathname: '/trips/item', params: { listId: t.id, id: item.id, category: tab } })}
                  />
                );
              })}
            </Card>
          </View>
        ))
      )}

      <Button label={`Add to ${label}`} onPress={() => router.push({ pathname: '/trips/item', params: { listId: t.id, category: tab } })} />
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/trips/edit', params: { id: t.id } })} hitSlop={8}>
        <Caption style={{ textAlign: 'center' }}>Archive, duplicate or delete this trip in Edit</Caption>
      </Pressable>
    </Screen>
  );
}
