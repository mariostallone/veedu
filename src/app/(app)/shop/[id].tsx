import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Body, Button, Card, ChoiceChips, EmptyState, ErrorNote, Field, Loading, Screen, SectionLabel, Stepper } from '@/components/ui';
import { useDeleteListItem, useListItems, useSingletonList, useUpdateListItem } from '@/features/lists/api';
import { storeOptions } from '@/lib/domain';
import type { ListItem } from '@/lib/types';
import { space } from '@/theme';

export default function EditShoppingItem() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const list = useSingletonList('shopping');
  const items = useListItems(list.data?.id);
  if (list.isPending || items.isPending) return <Loading />;
  const item = items.data?.find((i) => i.id === id);
  if (!item) {
    return (
      <Screen edges={['bottom']}>
        <Stack.Screen options={{ title: 'Item' }} />
        <EmptyState title="Item not found" message="It may have been removed or cleared." action={<Button label="Back" onPress={() => router.back()} />} />
      </Screen>
    );
  }
  return <Editor item={item} stores={storeOptions(items.data ?? [])} />;
}

function Editor({ item, stores }: { item: ListItem; stores: string[] }) {
  const update = useUpdateListItem();
  const remove = useDeleteListItem();
  const [text, setText] = useState(item.text);
  const [qty, setQty] = useState(item.qty);
  const [store, setStore] = useState<string | null>(item.group_name);
  const [note, setNote] = useState(item.note ?? '');
  // Keep the current store selectable even if it is not one of the usual chips.
  const options = store && !stores.includes(store) ? [store, ...stores] : stores;

  function save() {
    update.mutate(
      { id: item.id, text: text.trim(), qty, group_name: store, note: note.trim() || null },
      { onSuccess: () => router.back() },
    );
  }

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: 'Edit item' }} />
      <Card style={{ paddingVertical: space.lg, gap: space.md }}>
        <Field label="Item" value={text} onChangeText={setText} autoCapitalize="sentences" />
        <Stepper
          label={item.text}
          value={qty}
          onChange={(d) => setQty((q) => Math.max(1, Math.round((q + d) * 100) / 100))}
        />
        <Field label="Note" value={note} onChangeText={setNote} placeholder="Brand, size, aisle…" />
      </Card>

      <SectionLabel>Store</SectionLabel>
      <ChoiceChips options={options} value={store} onChange={setStore} />

      {item.pantry_item_id ? (
        <Body muted>Checking this off adds {qty} to the matching pantry item.</Body>
      ) : null}

      <ErrorNote error={update.error ?? remove.error} />
      <Button label="Save" onPress={save} disabled={!text.trim()} loading={update.isPending} />
      <Button
        label="Delete item"
        variant="danger"
        loading={remove.isPending}
        onPress={() => remove.mutate(item.id, { onSuccess: () => router.back() })}
      />
    </Screen>
  );
}
