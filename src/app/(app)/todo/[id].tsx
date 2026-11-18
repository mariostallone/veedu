import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { DatePicker } from '@/components/date-picker';
import { Avatar, Button, Card, ChoiceChips, ErrorNote, Field, Loading, Screen, SectionLabel } from '@/components/ui';
import { useMembers } from '@/features/household/api';
import {
  useAddListItem,
  useDeleteListItem,
  useListItems,
  useSingletonList,
  useUpdateListItem,
} from '@/features/lists/api';
import { REPEAT_OPTIONS, type IsoDate } from '@/lib/domain';
import { useHousehold } from '@/lib/session';
import type { ListItem } from '@/lib/types';
import { radius, space, type, useColors } from '@/theme';

export default function TodoEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const list = useSingletonList('todo');
  const items = useListItems(list.data?.id);
  const existing = isNew ? undefined : items.data?.find((i) => i.id === id);

  if (list.isLoading || (!isNew && items.isLoading)) return <Loading />;
  if (!list.data || (!isNew && !existing)) {
    return (
      <Screen edges={['bottom']}>
        <Stack.Screen options={{ title: 'To-do' }} />
        <ErrorNote error={list.error ?? items.error ?? new Error('This to-do no longer exists.')} />
        <Button label="Back" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }
  return <Form listId={list.data.id} existing={existing} />;
}

function Form({ listId, existing }: { listId: string; existing?: ListItem }) {
  const c = useColors();
  const { userId } = useHousehold();
  const members = useMembers();
  const add = useAddListItem();
  const update = useUpdateListItem();
  const remove = useDeleteListItem();

  const [text, setText] = useState(existing?.text ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [ownerId, setOwnerId] = useState<string | null>(existing ? existing.owner_id : userId);
  const [dueOn, setDueOn] = useState<IsoDate | null>(existing?.due_on ?? null);
  const [repeat, setRepeat] = useState<number | null>(existing?.repeat_every_days ?? null);

  const saving = add.isPending || update.isPending;
  const repeatLabels = REPEAT_OPTIONS.map((o) => o.label);
  // A custom interval set elsewhere stays selected as-is until the user picks another option.
  const repeatSelected = REPEAT_OPTIONS.find((o) => o.days === repeat)?.label ?? null;

  function save() {
    const fields = {
      text: text.trim(),
      note: note.trim() || null,
      owner_id: ownerId,
      due_on: dueOn,
      repeat_every_days: repeat,
    };
    const opts = { onSuccess: () => router.back() };
    if (existing) update.mutate({ id: existing.id, ...fields }, opts);
    else add.mutate({ list_id: listId, ...fields }, opts);
  }

  const ownerChip = (key: string | null, label: string, name?: string, color?: string) => {
    const on = ownerId === key;
    return (
      <Pressable
        key={key ?? 'none'}
        onPress={() => setOwnerId(key)}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          borderWidth: 1,
          borderRadius: radius.pill,
          paddingHorizontal: space.md,
          paddingVertical: 6,
          borderColor: on ? c.accent : c.border,
          backgroundColor: on ? c.accentSoft : c.card,
        }}>
        {name && color ? <Avatar name={name} color={color} size={20} /> : null}
        <Text style={{ color: on ? c.accent : c.text, fontWeight: '600', fontSize: 13 }}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: existing ? 'Edit to-do' : 'New to-do' }} />
      <Card style={{ paddingVertical: space.lg, gap: space.md }}>
        <Field label="What needs doing?" value={text} onChangeText={setText} placeholder="e.g. Fold the laundry" autoFocus={!existing} />
        <Field label="Notes" value={note} onChangeText={setNote} placeholder="Optional" multiline style={{ minHeight: 80, paddingTop: space.md, textAlignVertical: 'top' }} />
      </Card>

      <SectionLabel>Owner</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {(members.data ?? []).map((m) =>
          ownerChip(m.user_id, m.user_id === userId ? `${m.display_name} (you)` : m.display_name, m.display_name, m.color),
        )}
        {ownerChip(null, 'Anyone')}
      </View>

      <SectionLabel>Due</SectionLabel>
      <Card style={{ paddingVertical: space.lg }}>
        <DatePicker value={dueOn} onChange={setDueOn} />
      </Card>

      <SectionLabel>Repeat</SectionLabel>
      <ChoiceChips
        options={repeatLabels}
        value={repeatSelected}
        onChange={(label) => {
          const opt = REPEAT_OPTIONS.find((o) => o.label === label);
          if (opt) setRepeat(opt.days);
        }}
      />
      {repeat !== null && !dueOn ? (
        <Text style={[type.caption, { color: c.textMuted }]}>With no due date, the next one is counted from the day you tick it off.</Text>
      ) : null}

      <ErrorNote error={add.error ?? update.error ?? remove.error} />
      <Button label={existing ? 'Save' : 'Add to-do'} onPress={save} loading={saving} disabled={!text.trim()} />
      {existing ? (
        <Button
          label="Delete"
          variant="danger"
          loading={remove.isPending}
          onPress={() => remove.mutate(existing.id, { onSuccess: () => router.back() })}
        />
      ) : null}
    </Screen>
  );
}
