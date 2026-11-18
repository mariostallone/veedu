import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { Button, Caption, Card, ChoiceChips, ErrorNote, Field, Loading, Screen } from '@/components/ui';
import { useCreateList, useDeleteList, useList, useUpdateList } from '@/features/lists/api';
import { useDuplicateTrip } from '@/features/trips/api';
import { addDays, isValidIsoDate, parseAmount, toIsoDate } from '@/lib/domain';
import type { List } from '@/lib/types';
import { space } from '@/theme';

/** New trip (no id) or edit an existing one (`?id=`). */
export default function TripEditor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useList(id);
  if (id && existing.isLoading) return <Loading />;
  // Key on the id so the form state resets when the trip data arrives.
  return <TripForm trip={existing.data} key={existing.data?.id ?? 'new'} />;
}

function confirm(title: string, message: string, action: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: action, style: 'destructive', onPress: onConfirm },
  ]);
}

function TripForm({ trip }: { trip?: List }) {
  const create = useCreateList();
  const update = useUpdateList();
  const remove = useDeleteList();
  const dup = useDuplicateTrip();
  const today = toIsoDate(new Date());
  const [title, setTitle] = useState(trip?.title ?? '');
  const [date, setDate] = useState(trip?.starts_on ?? '');
  const [budget, setBudget] = useState(trip?.budget != null ? String(trip.budget) : '');

  const dateError = date.trim() && !isValidIsoDate(date.trim()) ? 'Use the format YYYY-MM-DD' : null;
  const amount = parseAmount(budget);
  const budgetError = Number.isNaN(amount) ? 'Enter a number, like 1500' : null;
  const valid = title.trim().length > 0 && !dateError && !budgetError;
  const busy = create.isPending || update.isPending || remove.isPending || dup.isPending;
  const quick = [
    { label: 'In 1 month', value: addDays(today, 30) },
    { label: 'In 3 months', value: addDays(today, 90) },
    { label: 'In 6 months', value: addDays(today, 180) },
  ];

  async function save() {
    const fields = {
      title: title.trim(),
      starts_on: date.trim() || null,
      budget: amount as number | null,
    };
    if (trip) {
      await update.mutateAsync({ id: trip.id, ...fields });
      router.back();
    } else {
      const created = await create.mutateAsync({ kind: 'trip', ...fields });
      router.replace({ pathname: '/trips/[id]', params: { id: created.id } });
    }
  }

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: trip ? 'Edit trip' : 'New trip' }} />
      <Card style={{ paddingVertical: space.lg, gap: space.md }}>
        <Field label="Trip name" value={title} onChangeText={setTitle} placeholder="India 2027" autoFocus={!trip} />
        <Field
          label="Start date"
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
          autoCorrect={false}
          error={dateError}
        />
        <ChoiceChips
          options={quick.map((q) => q.label)}
          value={quick.find((q) => q.value === date.trim())?.label ?? null}
          onChange={(label) => setDate(quick.find((q) => q.label === label)?.value ?? '')}
        />
        <Field
          label="Budget (optional)"
          value={budget}
          onChangeText={setBudget}
          placeholder="1500"
          keyboardType="decimal-pad"
          error={budgetError}
        />
      </Card>
      <ErrorNote error={create.error ?? update.error ?? remove.error ?? dup.error} />
      <Button label={trip ? 'Save' : 'Create trip'} onPress={save} disabled={!valid} loading={create.isPending || update.isPending} />

      {trip ? (
        <View style={{ gap: space.sm, paddingTop: space.lg }}>
          <Caption>Archiving hides a finished trip from the main list. Duplicating copies every item, unchecked, as a template.</Caption>
          <Button
            label="Duplicate as template"
            variant="secondary"
            disabled={busy}
            loading={dup.isPending}
            onPress={async () => {
              const copy = await dup.duplicate(trip);
              router.replace({ pathname: '/trips/edit', params: { id: copy.id } });
            }}
          />
          <Button
            label={trip.archived ? 'Unarchive trip' : 'Archive trip'}
            variant="secondary"
            disabled={busy}
            onPress={async () => {
              await update.mutateAsync({ id: trip.id, archived: !trip.archived });
              router.dismissTo('/trips');
            }}
          />
          <Button
            label="Delete trip"
            variant="danger"
            disabled={busy}
            onPress={() =>
              confirm('Delete this trip?', 'Its items are deleted too. This cannot be undone.', 'Delete', async () => {
                await remove.mutateAsync(trip.id);
                router.dismissTo('/trips');
              })
            }
          />
        </View>
      ) : null}
    </Screen>
  );
}
