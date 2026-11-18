import { useCallback } from 'react';

import { useAddListItems, useCreateList } from '@/features/lists/api';
import { templateItems } from '@/lib/domain';
import type { List, ListItem, TripCategory } from '@/lib/types';
import { supabase, unwrap } from '@/lib/supabase';

export const TRIP_TABS: readonly { value: TripCategory; label: string }[] = [
  { value: 'gifts', label: 'Gifts' },
  { value: 'packing', label: 'Packing' },
  { value: 'bring_back', label: 'Bring back' },
];

/** Items without a category belong on the Gifts tab, so nothing disappears. */
export function itemCategory(item: Pick<ListItem, 'category'>): TripCategory {
  return item.category ?? 'gifts';
}

/** Creates "<title> (copy)" with the same budget and every item unchecked. Resolves to the new trip. */
export function useDuplicateTrip() {
  const createList = useCreateList();
  const addItems = useAddListItems();
  return {
    isPending: createList.isPending || addItems.isPending,
    error: createList.error ?? addItems.error,
    duplicate: useCallback(
      async (trip: List): Promise<List> => {
        const created = await createList.mutateAsync({
          kind: 'trip',
          title: `${trip.title} (copy)`,
          budget: trip.budget,
          starts_on: null,
        });
        const items = unwrap(
          await supabase.from('list_items').select('*').eq('list_id', trip.id).order('position'),
        ) as ListItem[];
        if (items.length) {
          await addItems.mutateAsync(templateItems(items).map((i) => ({ ...i, list_id: created.id })));
        }
        return created;
      },
      [createList, addItems],
    ),
  };
}
