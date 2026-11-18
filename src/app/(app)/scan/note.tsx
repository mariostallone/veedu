import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import {
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
  SectionLabel,
} from '@/components/ui';
import { useAddListItems, useListItems, useSingletonList } from '@/features/lists/api';
import { usePantry } from '@/features/pantry/api';
import { useScanNote } from '@/features/scan/api';
import { PhotoCapture } from '@/features/scan/PhotoCapture';
import type { Photo } from '@/features/scan/photo';
import { formatQty, planNoteItems, storeOptions, type NoteRow } from '@/lib/domain';
import type { PantryItem } from '@/lib/types';
import { space } from '@/theme';

/** Photograph the fridge note, tick the items to keep, then add them to the shopping list. */
export default function ScanNote() {
  const list = useSingletonList('shopping');
  const items = useListItems(list.data?.id);
  const pantry = usePantry();
  const scan = useScanNote();
  const add = useAddListItems();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [rows, setRows] = useState<NoteRow<PantryItem>[] | null>(null);

  if (list.isPending || pantry.isPending || (list.data && items.isPending)) return <Loading />;
  if (!list.data) {
    return (
      <Screen edges={['bottom']}>
        <Stack.Screen options={{ title: 'Scan note' }} />
        <EmptyState title="No shopping list yet" message="The shopping list could not be found." />
      </Screen>
    );
  }
  const listId = list.data.id;
  const existing = items.data ?? [];
  const pantryItems = pantry.data ?? [];

  function analyse(next: Photo) {
    setPhoto(next);
    setRows(null);
    scan.mutate(
      { photo: next, stores: storeOptions(existing) },
      { onSuccess: (found) => setRows(planNoteItems(found, pantryItems, existing)) },
    );
  }

  const selected = rows?.filter((r) => r.selected) ?? [];

  function addSelected() {
    add.mutate(
      selected.map((r) => ({
        list_id: listId,
        text: r.text,
        qty: r.qty,
        group_name: r.store,
        pantry_item_id: r.pantry?.id ?? null,
        source: 'photo' as const,
      })),
      { onSuccess: () => router.back() },
    );
  }

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: 'Scan note' }} />
      <PhotoCapture
        hint="Photograph a handwritten or printed shopping note and its items will be listed for you to check."
        photo={photo}
        busy={scan.isPending || add.isPending}
        onPhoto={analyse}
      />
      {scan.isPending ? <Body muted>Reading the note…</Body> : null}
      {scan.isError ? (
        <>
          <ErrorNote error={scan.error} />
          {photo ? <Button label="Try again" variant="secondary" onPress={() => analyse(photo)} /> : null}
        </>
      ) : null}

      {rows && rows.length === 0 ? (
        <EmptyState title="No items found" message="Try a closer photo with the note filling the frame." />
      ) : null}

      {rows && rows.length > 0 ? (
        <>
          <SectionLabel>Found {rows.length} items</SectionLabel>
          <Card>
            {rows.map((r, i) => (
              <Row
                key={i}
                title={r.qty === 1 ? r.text : `${r.text} × ${formatQty(r.qty, '').trim()}`}
                last={i === rows.length - 1}
                left={
                  <Checkbox
                    checked={r.selected}
                    label={`Add ${r.text}`}
                    onChange={(next) => setRows(rows.map((x, j) => (j === i ? { ...x, selected: next } : x)))}
                  />
                }
                subtitle={
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, paddingTop: 2 }}>
                    {r.store ? <Chip label={r.store} /> : null}
                    {r.pantry ? <Chip label={`In pantry: ${formatQty(r.pantry.qty, r.pantry.unit)}`} tone="accent" /> : null}
                    {r.duplicate ? <Chip label="Already on the list" tone="warn" /> : null}
                  </View>
                }
              />
            ))}
          </Card>
          <Caption>Store names are guesses from the note. Nothing is added until you tap the button.</Caption>
          <ErrorNote error={add.error} />
          <Button
            label={selected.length === 0 ? 'Select items to add' : `Add ${selected.length} to list`}
            onPress={addSelected}
            disabled={selected.length === 0}
            loading={add.isPending}
          />
        </>
      ) : null}
    </Screen>
  );
}
