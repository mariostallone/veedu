import { Link, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Avatar, Caption, Card, Chip, EmptyState, ErrorNote, Loading, Row, Screen, SectionLabel } from '@/components/ui';
import { useHomeSummary } from '@/features/home/api';
import { describeActivity, timeAgo, type AttentionKind } from '@/lib/domain';
import { useHousehold } from '@/lib/session';
import { radius, space, type, useColors } from '@/theme';

const KIND_CHIP: Record<AttentionKind, { label: string; tone: 'danger' | 'warn' | 'neutral' }> = {
  overdue: { label: 'Overdue', tone: 'danger' },
  expired: { label: 'Expired', tone: 'danger' },
  expiring: { label: 'Expiring', tone: 'warn' },
  low: { label: 'Low', tone: 'warn' },
};

function StatTile({ value, label, href, tone }: { value: number; label: string; href: Href; tone?: 'warn' | 'danger' }) {
  const c = useColors();
  const router = useRouter();
  const color = value > 0 && tone ? c[tone] : c.text;
  return (
    <Pressable
      onPress={() => router.navigate(href)}
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
      style={({ pressed }) => [
        {
          flexBasis: '47%',
          flexGrow: 1,
          backgroundColor: c.card,
          borderColor: c.border,
          borderWidth: 1,
          borderRadius: radius.lg,
          padding: space.md,
          gap: 2,
        },
        pressed && { opacity: 0.6 },
      ]}>
      <Text style={{ fontSize: 30, fontWeight: '800', color, fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text style={[type.caption, { color: c.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

export default function Home() {
  const c = useColors();
  const router = useRouter();
  const { household, me } = useHousehold();
  const home = useHomeSummary();
  const [showAll, setShowAll] = useState(false);

  const attention = showAll ? home.attention.all : home.attention.items;

  return (
    <Screen
      title={`Hi, ${me.display_name}`}
      subtitle={household.name}
      refreshing={home.refreshing}
      onRefresh={home.refresh}
      right={
        <Link href="/settings" asChild>
          <Pressable accessibilityRole="button" accessibilityLabel="Household settings" hitSlop={8}>
            <Avatar name={me.display_name} color={me.color} size={34} />
          </Pressable>
        </Link>
      }>
      {home.loading ? (
        <Loading />
      ) : (
        <>
          <ErrorNote error={home.error} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
            <StatTile value={home.stats.low} label="Running low" href="/pantry" tone="warn" />
            <StatTile value={home.stats.expiring} label="Expiring this month" href="/pantry" tone="warn" />
            <StatTile value={home.stats.shopping} label="On shopping list" href="/shop" />
            <StatTile value={home.stats.todosThisWeek} label="To-dos this week" href="/todo" />
          </View>

          <SectionLabel>Needs attention</SectionLabel>
          <Card>
            {attention.length === 0 ? (
              <EmptyState title="All clear" message="Nothing is low, expiring or overdue." />
            ) : (
              attention.map((a, i) => (
                <Row
                  key={a.key}
                  title={a.title}
                  subtitle={a.detail}
                  right={<Chip label={KIND_CHIP[a.kind].label} tone={KIND_CHIP[a.kind].tone} />}
                  onPress={() => router.navigate(a.tab === 'todo' ? '/todo' : '/pantry')}
                  last={i === attention.length - 1 && home.attention.total <= 5}
                />
              ))
            )}
            {home.attention.total > 5 ? (
              <Row
                title={showAll ? 'Show fewer' : `See all ${home.attention.total}`}
                titleStyle={{ color: c.accent }}
                onPress={() => setShowAll((v) => !v)}
                last
              />
            ) : null}
          </Card>

          <SectionLabel>Recent</SectionLabel>
          <Card>
            {home.recent.length === 0 ? (
              <EmptyState title="Quiet week" message="Changes from the last 7 days will show up here." />
            ) : (
              home.recent.slice(0, 8).map((e, i, all) => {
                const who = e.userId ? home.members.get(e.userId) : undefined;
                return (
                  <Row
                    key={e.key}
                    left={<Avatar name={who?.display_name ?? '?'} color={who?.color ?? c.textMuted} size={28} />}
                    title={describeActivity(e, who?.display_name ?? 'Someone')}
                    titleStyle={type.body}
                    subtitle={<Caption>{timeAgo(e.atMs, home.nowMs)}</Caption>}
                    last={i === all.length - 1}
                  />
                );
              })
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}
