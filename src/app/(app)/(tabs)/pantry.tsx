import { router } from 'expo-router';
import { useMemo, useState } from 'react';
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
import { useAdjustPantryQty, usePantry } from '@/features/pantry/api';
import { PantryRow } from '@/features/pantry/PantryRow';
import {
  DEFAULT_PANTRY_CATEGORIES,
  QUICK_ADD_PANTRY,
  filterPantry,
  groupBy,
  mergeSuggestions,
  toIsoDate,
} from '@/lib/domain';
import { space } from '@/theme';

export default function PantryTab() {
  const pantry = usePantry();
  const adjust = useAdjustPantryQty();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const today = toIsoDate(new Date());

  const items = useMemo(() => pantry.data ?? [], [pantry.data]);
  const categories = useMemo(
    () => mergeSuggestions(items.map((i) => i.category), []),
    [items],
  );
  const groups = useMemo(
    () =>
      groupBy(filterPantry(items, query, category), (i) => i.category, {
        order: [...DEFAULT_PANTRY_CATEGORIES],
      }),
    [items, query, category],
  );

  const addButton = (
    <Button label="Add" onPress={() => router.push('/pantry/new')} style={{ minHeight: 40 }} />
  );

  if (pantry.isPending) {
    return (
      <Screen title="Pantry">
        <Loading />
      </Screen>
    );
  }

  if (pantry.isError) {
    return (
      <Screen title="Pantry">
        <ErrorNote error={pantry.error} />
        <Button label="Try again" variant="secondary" onPress={() => pantry.refetch()} />
      </Screen>
    );
  }

  if (items.length === 0) {
    return (
      <Screen title="Pantry" right={addButton}>
        <EmptyState
          title="Your pantry is empty"
          message="Add what you keep at home so you both know what is in stock. Tap a suggestion to start."
        />
        <SectionLabel>Quick add</SectionLabel>
        <ChoiceChips
          options={QUICK_ADD_PANTRY.map((q) => q.name)}
          value={null}
          onChange={(name) => {
            const q = QUICK_ADD_PANTRY.find((p) => p.name === name);
            if (!q) return;
            router.push({
              pathname: '/pantry/[id]',
              params: { id: 'new', name: q.name, category: q.category, unit: q.unit, keep: String(q.keep_min) },
            });
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen title="Pantry" subtitle={`${items.length} items`} right={addButton}>
      <Field
        value={query}
        onChangeText={setQuery}
        placeholder="Search pantry"
        accessibilityLabel="Search pantry"
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
      />
      {categories.length > 1 ? <ChoiceChips options={categories} value={category} onChange={setCategory} /> : null}
      <ErrorNote error={adjust.error} />
      {groups.length === 0 ? (
        <EmptyState title="Nothing matches" message="Try a different search or clear the category filter." />
      ) : (
        groups.map((g) => (
          <View key={g.key} style={{ gap: space.xs }}>
            <SectionLabel>{g.key}</SectionLabel>
            <Card>
              {g.items.map((item, i) => (
                <PantryRow
                  key={item.id}
                  item={item}
                  today={today}
                  last={i === g.items.length - 1}
                  onAdjust={(id, delta) => adjust.mutate({ id, delta })}
                />
              ))}
            </Card>
          </View>
        ))
      )}
      <Body muted style={{ textAlign: 'center' }}>
        Items below their keep-at-least level are added to the shopping list automatically.
      </Body>
    </Screen>
  );
}
