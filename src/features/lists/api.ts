import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { cachedHouseholdId } from '@/lib/offline';
import { useHousehold } from '@/lib/session';
import { supabase, unwrap } from '@/lib/supabase';
import type { List, ListItem, ListKind, NewListItem } from '@/lib/types';

export const listsKey = (householdId: string) => ['lists', householdId] as const;
export const itemsKey = (listId: string) => ['items', listId] as const;

/** Every list in the household (shopping, to-do and trips). */
export function useLists() {
  const { household } = useHousehold();
  return useQuery({
    queryKey: listsKey(household.id),
    queryFn: async () =>
      unwrap(
        await supabase
          .from('lists')
          .select('*')
          .eq('household_id', household.id)
          .order('created_at'),
      ) as List[],
  });
}

/** The household's single shopping or to-do list. */
export function useSingletonList(kind: Extract<ListKind, 'shopping' | 'todo'>) {
  const { data, ...rest } = useLists();
  return { ...rest, data: data?.find((l) => l.kind === kind) };
}

export function useTrips() {
  const { data, ...rest } = useLists();
  return { ...rest, data: data?.filter((l) => l.kind === 'trip') };
}

export function useList(id: string | undefined) {
  const { data, ...rest } = useLists();
  return { ...rest, data: id ? data?.find((l) => l.id === id) : undefined };
}

export function useListItems(listId: string | undefined) {
  return useQuery({
    queryKey: itemsKey(listId ?? 'none'),
    enabled: !!listId,
    queryFn: async () =>
      unwrap(
        await supabase.from('list_items').select('*').eq('list_id', listId!).order('position'),
      ) as ListItem[],
  });
}

/** Items across every list in the household, e.g. for the Home summary. */
export function useAllListItems() {
  const { household } = useHousehold();
  return useQuery({
    queryKey: ['items', 'household', household.id],
    queryFn: async () =>
      unwrap(
        await supabase.from('list_items').select('*').eq('household_id', household.id).order('position'),
      ) as ListItem[],
  });
}

export const listMutationKeys = {
  createList: ['lists', 'create'],
  updateList: ['lists', 'update'],
  deleteList: ['lists', 'delete'],
  addItem: ['items', 'add'],
  addItems: ['items', 'add-many'],
  updateItem: ['items', 'update'],
  toggleItem: ['items', 'toggle'],
  deleteItem: ['items', 'delete'],
  clearDone: ['items', 'clear-done'],
} as const;

type NewList = Pick<List, 'kind' | 'title'> & Partial<Pick<List, 'starts_on' | 'budget'>>;
type ListPatch = Partial<Omit<List, 'id' | 'household_id' | 'kind'>> & { id: string };
type ItemPatch = Partial<Omit<NewListItem, 'list_id'>> & { id: string };

// The mutation functions live outside the hooks so they can also run after an app restart,
// when a queued offline change is resumed without any screen mounted.
const createListFn = async (householdId: string, list: NewList) =>
  unwrap(await supabase.from('lists').insert({ ...list, household_id: householdId }).select().single()) as List;
const updateListFn = async ({ id, ...patch }: ListPatch) =>
  unwrap(await supabase.from('lists').update(patch).eq('id', id).select().single()) as List;
const deleteListFn = async (id: string) => {
  unwrap(await supabase.from('lists').delete().eq('id', id));
};
const addItemFn = async (householdId: string, item: NewListItem) =>
  unwrap(await supabase.from('list_items').insert({ ...item, household_id: householdId }).select().single()) as ListItem;
const addItemsFn = async (householdId: string, items: NewListItem[]) =>
  unwrap(
    await supabase.from('list_items').insert(items.map((i) => ({ ...i, household_id: householdId }))).select(),
  ) as ListItem[];
const updateItemFn = async ({ id, ...patch }: ItemPatch) =>
  unwrap(await supabase.from('list_items').update(patch).eq('id', id).select().single()) as ListItem;
const toggleItemFn = async ({ item, done }: { item: ListItem; done: boolean }) =>
  unwrap(await supabase.from('list_items').update({ done }).eq('id', item.id).select().single()) as ListItem;
const deleteItemFn = async (id: string) => {
  unwrap(await supabase.from('list_items').delete().eq('id', id));
};
const clearDoneFn = async (listId: string) => {
  unwrap(await supabase.from('list_items').delete().eq('list_id', listId).eq('done', true));
};

/** Registers the defaults that let queued list mutations resume after a restart. */
export function registerListMutationDefaults(queryClient: QueryClient) {
  const k = listMutationKeys;
  const hid = () => cachedHouseholdId(queryClient);
  queryClient.setMutationDefaults(k.createList, { mutationFn: (v: NewList) => createListFn(hid(), v) });
  queryClient.setMutationDefaults(k.updateList, { mutationFn: updateListFn });
  queryClient.setMutationDefaults(k.deleteList, { mutationFn: deleteListFn });
  queryClient.setMutationDefaults(k.addItem, { mutationFn: (v: NewListItem) => addItemFn(hid(), v) });
  queryClient.setMutationDefaults(k.addItems, { mutationFn: (v: NewListItem[]) => addItemsFn(hid(), v) });
  queryClient.setMutationDefaults(k.updateItem, { mutationFn: updateItemFn });
  queryClient.setMutationDefaults(k.toggleItem, { mutationFn: toggleItemFn });
  queryClient.setMutationDefaults(k.deleteItem, { mutationFn: deleteItemFn });
  queryClient.setMutationDefaults(k.clearDone, { mutationFn: clearDoneFn });
}

function useInvalidateItems() {
  const queryClient = useQueryClient();
  // List writes can change pantry counts through database triggers.
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['items'] }),
      queryClient.invalidateQueries({ queryKey: ['pantry'] }),
    ]);
}

export function useCreateList() {
  const { household } = useHousehold();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: listMutationKeys.createList,
    mutationFn: (list: NewList) => createListFn(household.id, list),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['lists'] }),
  });
}

export function useUpdateList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: listMutationKeys.updateList,
    mutationFn: updateListFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['lists'] }),
  });
}

export function useDeleteList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: listMutationKeys.deleteList,
    mutationFn: deleteListFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['lists'] }),
  });
}

export function useAddListItem() {
  const { household } = useHousehold();
  const invalidate = useInvalidateItems();
  return useMutation({
    mutationKey: listMutationKeys.addItem,
    // household_id is overwritten from the list by a database trigger; it is sent to satisfy the type.
    mutationFn: (item: NewListItem) => addItemFn(household.id, item),
    onSettled: invalidate,
  });
}

export function useAddListItems() {
  const { household } = useHousehold();
  const invalidate = useInvalidateItems();
  return useMutation({
    mutationKey: listMutationKeys.addItems,
    mutationFn: (items: NewListItem[]) => addItemsFn(household.id, items),
    onSettled: invalidate,
  });
}

export function useUpdateListItem() {
  const invalidate = useInvalidateItems();
  return useMutation({
    mutationKey: listMutationKeys.updateItem,
    mutationFn: updateItemFn,
    onSettled: invalidate,
  });
}

/** Check/uncheck with an immediate on-screen update. */
export function useToggleListItem() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateItems();
  return useMutation({
    mutationKey: listMutationKeys.toggleItem,
    mutationFn: toggleItemFn,
    onMutate: async ({ item, done }) => {
      const key = itemsKey(item.list_id);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ListItem[]>(key);
      queryClient.setQueryData<ListItem[]>(key, (items) =>
        items?.map((i) => (i.id === item.id ? { ...i, done } : i)),
      );
      return { previous, key };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(ctx.key, ctx.previous);
    },
    onSettled: invalidate,
  });
}

export function useDeleteListItem() {
  const invalidate = useInvalidateItems();
  return useMutation({
    mutationKey: listMutationKeys.deleteItem,
    mutationFn: deleteItemFn,
    onSettled: invalidate,
  });
}

/** Removes every checked item from a list ("Clear checked"). */
export function useClearDone() {
  const invalidate = useInvalidateItems();
  return useMutation({
    mutationKey: listMutationKeys.clearDone,
    mutationFn: clearDoneFn,
    onSettled: invalidate,
  });
}
