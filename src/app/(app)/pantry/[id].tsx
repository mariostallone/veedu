import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import {
  Body,
  Button,
  Card,
  ChoiceChips,
  EmptyState,
  ErrorNote,
  Field,
  Loading,
  Screen,
  SectionLabel,
} from '@/components/ui';
import {
  useCreatePantryItem,
  useDeletePantryItem,
  usePantry,
  useUpdatePantryItem,
} from '@/features/pantry/api';
import {
  DEFAULT_PANTRY_CATEGORIES,
  DEFAULT_PANTRY_UNITS,
  DEFAULT_STORES,
  isValidIsoDate,
  mergeSuggestions,
  parseQty,
} from '@/lib/domain';
import type { PantryItem } from '@/lib/types';
import { space } from '@/theme';

type Params = { id: string; name?: string; category?: string; unit?: string; keep?: string };

export default function PantryEditor() {
  const params = useLocalSearchParams<Params>();
  const isNew = params.id === 'new';
  const pantry = usePantry();

  if (pantry.isPending) return <Loading />;
  if (pantry.isError) {
    return (
      <Screen edges={['bottom']}>
        <ErrorNote error={pantry.error} />
        <Button label="Try again" variant="secondary" onPress={() => pantry.refetch()} />
      </Screen>
    );
  }
  const existing = isNew ? undefined : pantry.data.find((p) => p.id === params.id);
  if (!isNew && !existing) {
    return (
      <Screen edges={['bottom']}>
        <Stack.Screen options={{ title: 'Pantry item' }} />
        <EmptyState
          title="Item not found"
          message="It may have been removed on the other phone."
          action={<Button label="Back to pantry" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }
  return <EditorForm existing={existing} all={pantry.data} prefill={params} />;
}

function EditorForm({ existing, all, prefill }: { existing?: PantryItem; all: PantryItem[]; prefill: Params }) {
  const create = useCreatePantryItem();
  const update = useUpdatePantryItem();
  const remove = useDeletePantryItem();

  const [name, setName] = useState(existing?.name ?? prefill.name ?? '');
  const [category, setCategory] = useState(existing?.category ?? prefill.category ?? 'Other');
  const [unit, setUnit] = useState(existing?.unit ?? prefill.unit ?? 'pack');
  const [qty, setQty] = useState(String(existing?.qty ?? 0));
  const [keepMin, setKeepMin] = useState(String(existing?.keep_min ?? prefill.keep ?? 1));
  const [store, setStore] = useState(existing?.store ?? '');
  const [expiry, setExpiry] = useState(existing?.expires_on ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const categories = mergeSuggestions(all.map((p) => p.category), DEFAULT_PANTRY_CATEGORIES);
  const units = mergeSuggestions(all.map((p) => p.unit), DEFAULT_PANTRY_UNITS);
  const stores = mergeSuggestions(all.map((p) => p.store), DEFAULT_STORES);

  const qtyValue = parseQty(qty);
  const keepValue = parseQty(keepMin);
  const errors = {
    name: name.trim() ? null : 'Give the item a name',
    qty: qtyValue === null ? 'Enter a number, e.g. 2 or 1.5' : null,
    keep: keepValue === null ? 'Enter a number, e.g. 2 or 1.5' : null,
    expiry: expiry.trim() && !isValidIsoDate(expiry.trim()) ? 'Use the format YYYY-MM-DD' : null,
  };
  const valid = !Object.values(errors).some(Boolean);
  const saving = create.isPending || update.isPending;

  function save() {
    setSubmitted(true);
    if (!valid || qtyValue === null || keepValue === null) return;
    const values = {
      name: name.trim(),
      category: category.trim() || 'Other',
      unit: unit.trim() || 'pack',
      qty: qtyValue,
      keep_min: keepValue,
      store: store.trim() || null,
      expires_on: expiry.trim() || null,
      notes: notes.trim() || null,
    };
    const options = { onSuccess: () => router.back() };
    if (existing) update.mutate({ id: existing.id, ...values }, options);
    else create.mutate(values, options);
  }

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: existing ? 'Edit item' : 'New item' }} />
      <Card style={{ paddingVertical: space.lg, gap: space.lg }}>
        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Basmati rice"
          maxLength={80}
          error={submitted ? errors.name : null}
        />
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Field
              label="In stock"
              value={qty}
              onChangeText={setQty}
              keyboardType="decimal-pad"
              error={submitted ? errors.qty : null}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Keep at least"
              value={keepMin}
              onChangeText={setKeepMin}
              keyboardType="decimal-pad"
              error={submitted ? errors.keep : null}
            />
          </View>
        </View>
      </Card>

      <SectionLabel>Category</SectionLabel>
      <Field value={category} onChangeText={setCategory} placeholder="Category" accessibilityLabel="Category" />
      <ChoiceChips options={categories} value={category} onChange={(v) => v && setCategory(v)} />

      <SectionLabel>Unit</SectionLabel>
      <Field value={unit} onChangeText={setUnit} placeholder="Unit" accessibilityLabel="Unit" autoCapitalize="none" />
      <ChoiceChips options={units} value={unit} onChange={(v) => v && setUnit(v)} />

      <SectionLabel>Store</SectionLabel>
      <Field value={store} onChangeText={setStore} placeholder="Where you buy it (optional)" accessibilityLabel="Store" />
      <ChoiceChips options={stores} value={store || null} onChange={(v) => setStore(v ?? '')} />

      <SectionLabel>Expiry and notes</SectionLabel>
      <Card style={{ paddingVertical: space.lg, gap: space.lg }}>
        <Field
          label="Expiry date (optional)"
          value={expiry}
          onChangeText={setExpiry}
          placeholder="YYYY-MM-DD"
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={10}
          error={submitted ? errors.expiry : null}
        />
        <Field
          label="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          multiline
          style={{ minHeight: 80, paddingTop: space.md, textAlignVertical: 'top' }}
        />
      </Card>

      <ErrorNote error={create.error ?? update.error ?? remove.error} />
      <Button label={existing ? 'Save changes' : 'Add to pantry'} onPress={save} loading={saving} />

      {existing ? (
        confirmDelete ? (
          <Card style={{ paddingVertical: space.lg, gap: space.md }}>
            <Body>Delete {existing.name}? This removes it for both of you.</Body>
            <Button
              label="Yes, delete"
              variant="danger"
              loading={remove.isPending}
              onPress={() => remove.mutate(existing.id, { onSuccess: () => router.back() })}
            />
            <Button label="Keep it" variant="secondary" onPress={() => setConfirmDelete(false)} />
          </Card>
        ) : (
          <Button label="Delete item" variant="danger" onPress={() => setConfirmDelete(true)} />
        )
      ) : null}
    </Screen>
  );
}
