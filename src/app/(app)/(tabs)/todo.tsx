import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  Avatar,
  Body,
  Button,
  Caption,
  Card,
  Checkbox,
  Chip,
  EmptyState,
  ErrorNote,
  Loading,
  Row,
  Screen,
  Segmented,
  SectionLabel,
} from '@/components/ui';
import { useMemberMap, useMembers } from '@/features/household/api';
import { useListItems, useSingletonList, useToggleListItem } from '@/features/lists/api';
import {
  filterTodosByOwner,
  recentlyDone,
  relativeDay,
  repeatLabel,
  toIsoDate,
  todoBucket,
  type TodoBucket,
  type TodoFilter,
} from '@/lib/domain';
import { useHousehold } from '@/lib/session';
import type { ListItem } from '@/lib/types';
import { space, useColors } from '@/theme';

const SECTIONS: { bucket: Exclude<TodoBucket, 'done'>; label: string }[] = [
  { bucket: 'overdue', label: 'Overdue' },
  { bucket: 'today', label: 'Today' },
  { bucket: 'this_week', label: 'This week' },
  { bucket: 'later', label: 'Later' },
  { bucket: 'someday', label: 'Someday' },
];

export default function TodosTab() {
  const c = useColors();
  const { userId } = useHousehold();
  const list = useSingletonList('todo');
  const items = useListItems(list.data?.id);
  const members = useMembers();
  const memberMap = useMemberMap();
  const toggle = useToggleListItem();
  const [filter, setFilter] = useState<TodoFilter>('everyone');
  const [showDone, setShowDone] = useState(false);

  const partners = (members.data ?? []).filter((m) => m.user_id !== userId);
  const partnerLabel = partners.length === 1 ? partners[0].display_name : 'Partner';
  const today = toIsoDate(new Date());

  const addButton = (
    <Button
      label="Add"
      onPress={() => router.push('/todo/new')}
      disabled={!list.data}
      style={{ minHeight: 40, paddingHorizontal: space.lg }}
    />
  );

  if (list.isLoading || items.isLoading) {
    return (
      <Screen title="To-dos">
        <Loading />
      </Screen>
    );
  }

  const visible = filterTodosByOwner(
    items.data ?? [],
    filter,
    userId,
    partners.map((m) => m.user_id),
  );
  const open = visible.filter((i) => !i.done);
  const done = recentlyDone(visible.filter((i) => i.done), 10);

  function renderRow(item: ListItem, last: boolean) {
    const owner = item.owner_id ? memberMap.get(item.owner_id) : undefined;
    const bucket = todoBucket(item, today);
    const repeat = repeatLabel(item.repeat_every_days, item.due_on);
    const subtitle =
      item.due_on || repeat ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
          {item.due_on ? (
            <Text style={{ fontSize: 13, color: bucket === 'overdue' ? c.danger : c.textMuted, fontWeight: bucket === 'overdue' ? '600' : '400' }}>
              {relativeDay(item.due_on, today)}
            </Text>
          ) : null}
          {repeat ? <Chip label={`↻ ${repeat}`} /> : null}
        </View>
      ) : undefined;
    return (
      <Row
        key={item.id}
        title={item.text}
        subtitle={subtitle}
        muted={item.done}
        last={last}
        onPress={() => router.push({ pathname: '/todo/[id]', params: { id: item.id } })}
        left={
          <Checkbox
            checked={item.done}
            label={`Mark ${item.text} ${item.done ? 'not done' : 'done'}`}
            onChange={(done) => toggle.mutate({ item, done })}
          />
        }
        right={owner ? <Avatar name={owner.display_name} color={owner.color} /> : undefined}
      />
    );
  }

  return (
    <Screen title="To-dos" right={addButton}>
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'mine', label: 'Mine' },
          { value: 'partner', label: partnerLabel },
          { value: 'everyone', label: 'Everyone' },
        ]}
      />
      <ErrorNote error={list.error ?? items.error ?? toggle.error} />

      {open.length === 0 && done.length === 0 ? (
        <EmptyState
          title="Nothing to do"
          message={filter === 'everyone' ? 'Add a chore, a document to sort out or a job for the attic.' : 'Nothing here for this filter.'}
        />
      ) : null}

      {SECTIONS.map(({ bucket, label }) => {
        const rows = open.filter((i) => todoBucket(i, today) === bucket);
        if (!rows.length) return null;
        return (
          <View key={bucket} style={{ gap: space.sm }}>
            <SectionLabel>
              <Text style={bucket === 'overdue' ? { color: c.danger } : undefined}>{label}</Text>
            </SectionLabel>
            <Card>{rows.map((item, i) => renderRow(item, i === rows.length - 1))}</Card>
          </View>
        );
      })}

      {done.length ? (
        <View style={{ gap: space.sm }}>
          <Pressable
            onPress={() => setShowDone((s) => !s)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showDone }}>
            <SectionLabel right={<Caption>{showDone ? 'Hide' : 'Show'}</Caption>}>{`Done (${done.length})`}</SectionLabel>
          </Pressable>
          {showDone ? <Card>{done.map((item, i) => renderRow(item, i === done.length - 1))}</Card> : null}
        </View>
      ) : null}
      {!list.data && !list.isLoading ? <Body muted>The to-do list is not set up yet.</Body> : null}
    </Screen>
  );
}
