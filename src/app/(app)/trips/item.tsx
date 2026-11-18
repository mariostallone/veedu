import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { Button, Card, ChoiceChips, ErrorNote, Field, Loading, Screen, Stepper, Caption } from '@/components/ui';
import { useMembers } from '@/features/household/api';
import { useAddListItem, useDeleteListItem, useListItems, useUpdateListItem } from '@/features/lists/api';
import { itemCategory, TRIP_TABS } from '@/features/trips/api';
import { parseAmount } from '@/lib/domain';
import type { ListItem, TripCategory } from '@/lib/types';
import { space } from '@/theme';

/** Add (`?listId=&category=`) or edit (`?id=&listId=`) a trip item. */
export default function TripItemEditor() {
  const { listId, id, category } = useLocalSearchParams<{ listId: string; id?: string; category?: string }>();
  const items = useListItems(listId);
  if (id && items.isLoading) return <Loading />;
  const existing = id ? items.data?.find((i) => i.id === id) : undefined;
  const cat = TRIP_TABS.some((t) => t.value === category) ? (category as TripCategory) : 'gifts';
  return <ItemForm listId={listId} item={existing} category={cat} groups={items.data ?? []} key={existing?.id ?? 'new'} />;
}

function ItemForm({ listId, item, category, groups }: { listId: string; item?: ListItem; category: TripCategory; groups: ListItem[] }) {
  const add = useAddListItem();
  const update = useUpdateListItem();
  const remove = useDeleteListItem();
  const members = useMembers();
  const [text, setText] = useState(item?.text ?? '');
  const [group, setGroup] = useState(item?.group_name ?? '');
  const [cost, setCost] = useState(item?.cost != null ? String(item.cost) : '');
  const [qty, setQty] = useState(item?.qty ?? 1);
  const [ownerId, setOwnerId] = useState<string | null>(item?.owner_id ?? null);
  const [note, setNote] = useState(item?.note ?? '');
  const [cat, setCat] = useState<TripCategory>(item ? itemCategory(item) : category);

  const existingGroups = [...new Set(groups.map((i) => i.group_name?.trim()).filter((g): g is string => !!g))];
  const costValue = parseAmount(cost);
  const costError = Number.isNaN(costValue) ? 'Enter a number, like 25' : null;
  const valid = text.trim().length > 0 && !costError && qty > 0;
  const memberList = members.data ?? [];
  const ownerName = memberList.find((m) => m.user_id === ownerId)?.display_name ?? null;

  async function save() {
    const fields = {
      text: text.trim(),
      group_name: group.trim() || null,
      cost: costValue as number | null,
      qty,
      owner_id: ownerId,
      note: note.trim() || null,
      category: cat,
    };
    if (item) await update.mutateAsync({ id: item.id, ...fields });
    else await add.mutateAsync({ list_id: listId, ...fields });
    router.back();
  }

  function askDelete() {
    const go = async () => {
      if (!item) return;
      await remove.mutateAsync(item.id);
      router.back();
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete "${item?.text}"?`)) go();
      return;
    }
    Alert.alert('Delete this item?', item?.text, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: go },
    ]);
  }

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: item ? 'Edit item' : 'New item' }} />
      <Card style={{ paddingVertical: space.lg, gap: space.md }}>
        <Field label="Item" value={text} onChangeText={setText} placeholder="Silk saree" autoFocus={!item} />
        <Caption>List</Caption>
        <ChoiceChips
          options={TRIP_TABS.map((t) => t.label)}
          value={TRIP_TABS.find((t) => t.value === cat)!.label}
          onChange={(l) => l && setCat(TRIP_TABS.find((t) => t.label === l)!.value)}
        />
        <Field label="Person or group" value={group} onChangeText={setGroup} placeholder="Amma & Appa" />
        {existingGroups.length > 0 ? <ChoiceChips options={existingGroups} value={group.trim() || null} onChange={(g) => setGroup(g ?? '')} /> : null}
        <Field label="Cost each (optional)" value={cost} onChangeText={setCost} placeholder="25" keyboardType="decimal-pad" error={costError} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Caption>Quantity</Caption>
          <Stepper value={qty} label={text || 'item'} onChange={(d) => setQty((q) => Math.max(1, q + d))} />
        </View>
        {memberList.length > 0 ? (
          <>
            <Caption>Who is buying it</Caption>
            <ChoiceChips
              options={memberList.map((m) => m.display_name)}
              value={ownerName}
              onChange={(n) => setOwnerId(memberList.find((m) => m.display_name === n)?.user_id ?? null)}
            />
          </>
        ) : null}
        <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="Size, colour, shop…" multiline />
      </Card>
      <ErrorNote error={add.error ?? update.error ?? remove.error} />
      <Button label={item ? 'Save' : 'Add item'} onPress={save} disabled={!valid} loading={add.isPending || update.isPending} />
      {item ? <Button label="Delete item" variant="danger" onPress={askDelete} loading={remove.isPending} /> : null}
    </Screen>
  );
}
