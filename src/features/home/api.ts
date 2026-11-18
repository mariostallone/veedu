import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { useMemberMap } from '@/features/household/api';
import { useAllListItems, useLists } from '@/features/lists/api';
import { usePantry } from '@/features/pantry/api';
import { homeStats, needsAttention, recentActivity, toIsoDate } from '@/lib/domain';

/** Everything the Home tab shows, derived from the shared pantry/list queries. */
export function useHomeSummary() {
  const queryClient = useQueryClient();
  const pantry = usePantry();
  const items = useAllListItems();
  const lists = useLists();
  const members = useMemberMap();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['pantry'] }),
        queryClient.refetchQueries({ queryKey: ['items'] }),
        queryClient.refetchQueries({ queryKey: ['lists'] }),
        queryClient.refetchQueries({ queryKey: ['members'] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  const today = toIsoDate(new Date());
  const nowMs = new Date().getTime();
  const pantryItems = pantry.data ?? [];
  const listItems = items.data ?? [];
  const allLists = lists.data ?? [];
  const kindOf = new Map(allLists.map((l) => [l.id, l.kind]));
  const todos = listItems.filter((i) => kindOf.get(i.list_id) === 'todo');
  const shoppingOpen = listItems.filter((i) => kindOf.get(i.list_id) === 'shopping' && !i.done).length;

  return {
    today,
    nowMs,
    members,
    stats: homeStats(pantryItems, todos, shoppingOpen, today),
    attention: needsAttention(pantryItems, todos, today),
    recent: recentActivity(listItems, allLists, pantryItems, nowMs),
    loading: pantry.isPending || items.isPending || lists.isPending,
    error: pantry.error ?? items.error ?? lists.error,
    refreshing,
    refresh,
  };
}
