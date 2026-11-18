import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { cachedHouseholdId } from '@/lib/offline';
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

export const pantryMutationKeys = {
  create: ['pantry', 'create'],
  update: ['pantry', 'update'],
  delete: ['pantry', 'delete'],
  adjustQty: ['pantry', 'adjust-qty'],
} as const;

type PantryPatch = Partial<NewPantryItem> & { id: string };

// Module-level so a queued offline change can resume after a restart (see registerPantryMutationDefaults).
const createFn = async (householdId: string, item: NewPantryItem) =>
  unwrap(await supabase.from('pantry_items').insert({ ...item, household_id: householdId }).select().single()) as PantryItem;
const updateFn = async ({ id, ...patch }: PantryPatch) =>
  unwrap(await supabase.from('pantry_items').update(patch).eq('id', id).select().single()) as PantryItem;
const deleteFn = async (id: string) => {
  unwrap(await supabase.from('pantry_items').delete().eq('id', id));
};
const adjustFn = async ({ id, delta }: { id: string; delta: number }) =>
  unwrap(await supabase.rpc('adjust_pantry_qty', { p_id: id, p_delta: delta })) as PantryItem;

/** Registers the defaults that let queued pantry mutations resume after a restart. */
export function registerPantryMutationDefaults(queryClient: QueryClient) {
  const k = pantryMutationKeys;
  queryClient.setMutationDefaults(k.create, {
    mutationFn: (v: NewPantryItem) => createFn(cachedHouseholdId(queryClient), v),
  });
  queryClient.setMutationDefaults(k.update, { mutationFn: updateFn });
  queryClient.setMutationDefaults(k.delete, { mutationFn: deleteFn });
  queryClient.setMutationDefaults(k.adjustQty, { mutationFn: adjustFn });
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
    mutationKey: pantryMutationKeys.create,
    mutationFn: (item: NewPantryItem) => createFn(household.id, item),
    onSettled: invalidate,
  });
}

export function useUpdatePantryItem() {
  const invalidate = useInvalidatePantryAndLists();
  return useMutation({
    mutationKey: pantryMutationKeys.update,
    mutationFn: updateFn,
    onSettled: invalidate,
  });
}

export function useDeletePantryItem() {
  const invalidate = useInvalidatePantryAndLists();
  return useMutation({
    mutationKey: pantryMutationKeys.delete,
    mutationFn: deleteFn,
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
    mutationKey: pantryMutationKeys.adjustQty,
    mutationFn: adjustFn,
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
