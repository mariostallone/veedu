import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { supabase } from './supabase';

const TABLE_KEYS: Record<string, string[][]> = {
  pantry_items: [['pantry']],
  list_items: [['items'], ['pantry']],
  lists: [['lists']],
  household_members: [['members'], ['household']],
};

/**
 * Keeps both partners' screens in sync: any change in the household refetches the affected queries.
 * Mounted once inside the signed-in app.
 */
export function useRealtimeSync(householdId: string) {
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase.channel(`household:${householdId}`);
    for (const table of Object.keys(TABLE_KEYS)) {
      const refetch = () => {
        for (const queryKey of TABLE_KEYS[table]) queryClient.invalidateQueries({ queryKey });
      };
      const filter = `household_id=eq.${householdId}`;
      channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter }, refetch);
      channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter }, refetch);
      // Realtime cannot filter DELETE events, and they carry only the primary key, so listen to all.
      channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, refetch);
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, queryClient]);
}
