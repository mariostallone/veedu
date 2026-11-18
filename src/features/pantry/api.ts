import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useHousehold } from '@/lib/session';
import { supabase, unwrap } from '@/lib/supabase';
import type { NewPantryItem, PantryItem } from '@/lib/types';

export const pantryKey = (householdId: string) => ['pantry', householdId] as const;

/** All pantry items for the household, sorted by category then name. */
export function usePantry() {
  const { household } = useHousehold();
  return useQuery({
    queryKey: pantryKey(household.id),
    queryFn: async () =>
      unwrap(
        await supabase
          .from('pantry_items')
          .select('*')
          .eq('household_id', household.id)
          .order('category')
          .order('name'),
      ) as PantryItem[],
  });
}

export function usePantryItem(id: string | undefined) {
  const { data, ...rest } = usePantry();
  return { ...rest, data: id ? data?.find((p) => p.id === id) : undefined };
}

function useInvalidatePantryAndLists() {
  const queryClient = useQueryClient();
  // Pantry writes can add/remove shopping items through database triggers.
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['pantry'] }),
      queryClient.invalidateQueries({ queryKey: ['items'] }),
    ]);
}

export function useCreatePantryItem() {
  const { household } = useHousehold();
  const invalidate = useInvalidatePantryAndLists();
  return useMutation({
    mutationFn: async (item: NewPantryItem) =>
      unwrap(
        await supabase
          .from('pantry_items')
          .insert({ ...item, household_id: household.id })
          .select()
          .single(),
      ) as PantryItem,
    onSettled: invalidate,
  });
}

export function useUpdatePantryItem() {
  const invalidate = useInvalidatePantryAndLists();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<NewPantryItem> & { id: string }) =>
      unwrap(await supabase.from('pantry_items').update(patch).eq('id', id).select().single()) as PantryItem,
    onSettled: invalidate,
  });
}

export function useDeletePantryItem() {
  const invalidate = useInvalidatePantryAndLists();
  return useMutation({
    mutationFn: async (id: string) => {
      unwrap(await supabase.from('pantry_items').delete().eq('id', id));
    },
    onSettled: invalidate,
  });
}

/** +/- stepper. Updates the screen immediately, then applies the change atomically on the server. */
export function useAdjustPantryQty() {
  const { household } = useHousehold();
  const queryClient = useQueryClient();
  const invalidate = useInvalidatePantryAndLists();
  const key = pantryKey(household.id);
  return useMutation({
    mutationFn: async ({ id, delta }: { id: string; delta: number }) =>
      unwrap(await supabase.rpc('adjust_pantry_qty', { p_id: id, p_delta: delta })) as PantryItem,
    onMutate: async ({ id, delta }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<PantryItem[]>(key);
      queryClient.setQueryData<PantryItem[]>(key, (items) =>
        items?.map((p) => (p.id === id ? { ...p, qty: Math.max(0, p.qty + delta) } : p)),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
    },
    onSettled: invalidate,
  });
}
